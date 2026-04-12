const crypto = require('crypto');
const {
  provinceOptions,
  validateCountyForCity,
  validateProvinceAndCity
} = require('../../config/areaSelector');
const { getInstitutionCorrectionRuleDefinitions } = require('../../config/institutionCorrectionConfig');
const { getClientIp } = require('./auditLogService');
const { getRuntimeBinding } = require('./runtimeContext');

const TABLE_NAME = 'institution_correction_submissions';
const schemaReadyByBinding = new WeakMap();
const CREATE_TABLE_STATEMENT = `
CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
  id TEXT PRIMARY KEY,
  school_name TEXT NOT NULL,
  province_code TEXT,
  province_name TEXT,
  city_code TEXT,
  city_name TEXT,
  county_code TEXT,
  county_name TEXT,
  school_address TEXT,
  contact_information TEXT,
  headmaster_name TEXT,
  correction_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  lang TEXT NOT NULL,
  source_path TEXT NOT NULL,
  client_ip_hash TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);
`;

class InstitutionCorrectionStorageUnavailableError extends Error {
  constructor(message = 'Institution correction storage is unavailable.') {
    super(message);
    this.name = 'InstitutionCorrectionStorageUnavailableError';
  }
}

function getTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNullableValue(value) {
  return value ? value : null;
}

function validateTextField(errors, t, label, value, { required = false, maxLength } = {}) {
  const text = getTrimmedString(value);

  if (required && !text) {
    errors.push(t('formErrors.required', { label }));
    return '';
  }

  if (typeof maxLength === 'number' && text.length > maxLength) {
    errors.push(t('formErrors.maxLength', { label, maxLength }));
  }

  return text;
}

function getProvinceByCode(provinceCode) {
  return provinceOptions.find((province) => province.code === provinceCode) || null;
}

function getConfiguredBindingNames() {
  return [
    String(process.env.D1_BINDING_NAME || '').trim(),
    'DB',
    'NCT_DB'
  ].filter(Boolean);
}

function getInstitutionCorrectionDatabaseBinding() {
  for (const bindingName of getConfiguredBindingNames()) {
    const binding = getRuntimeBinding(bindingName);
    if (binding && typeof binding.prepare === 'function') {
      return {
        binding,
        bindingName
      };
    }
  }

  return {
    binding: null,
    bindingName: ''
  };
}

async function ensureInstitutionCorrectionSchema(binding) {
  if (!binding) {
    throw new InstitutionCorrectionStorageUnavailableError();
  }

  const cachedReadyPromise = schemaReadyByBinding.get(binding);
  if (cachedReadyPromise) {
    return cachedReadyPromise;
  }

  if (typeof binding.exec !== 'function') {
    throw new InstitutionCorrectionStorageUnavailableError('Configured D1 binding does not support schema initialization.');
  }

  const readyPromise = Promise.resolve()
    .then(() => binding.exec(CREATE_TABLE_STATEMENT))
    .catch((error) => {
      schemaReadyByBinding.delete(binding);
      throw error;
    });

  schemaReadyByBinding.set(binding, readyPromise);
  return readyPromise;
}

function hashClientIp(ip) {
  const normalizedIp = getTrimmedString(ip);
  if (!normalizedIp || normalizedIp === 'unknown') {
    return null;
  }

  return crypto.createHash('sha256').update(normalizedIp).digest('hex');
}

function validateInstitutionCorrectionSubmission(body, t) {
  const errors = [];
  const ruleDefinitions = getInstitutionCorrectionRuleDefinitions();
  const rules = Object.fromEntries(
    Object.entries(ruleDefinitions).map(([field, definition]) => [
      field,
      {
        ...definition,
        label: t(definition.labelKey)
      }
    ])
  );

  const schoolName = validateTextField(errors, t, rules.schoolName.label, body.school_name, {
    required: rules.schoolName.required,
    maxLength: rules.schoolName.maxLength
  });
  const schoolAddress = validateTextField(errors, t, rules.schoolAddress.label, body.school_address, {
    maxLength: rules.schoolAddress.maxLength
  });
  const contactInformation = validateTextField(errors, t, rules.contactInformation.label, body.contact_information, {
    maxLength: rules.contactInformation.maxLength
  });
  const headmasterName = validateTextField(errors, t, rules.headmasterName.label, body.headmaster_name, {
    maxLength: rules.headmasterName.maxLength
  });
  const correctionContent = validateTextField(errors, t, rules.correctionContent.label, body.correction_content, {
    maxLength: rules.correctionContent.maxLength
  });
  const provinceCode = getTrimmedString(body.provinceCode);
  const cityCode = getTrimmedString(body.cityCode);
  const countyCode = getTrimmedString(body.countyCode);

  let validatedProvince = null;
  let validatedLocation = null;
  let validatedCounty = null;

  if (provinceCode) {
    validatedProvince = getProvinceByCode(provinceCode);
    if (!validatedProvince) {
      errors.push(t('institutionCorrection.validation.invalidProvince'));
    }
  }

  if (cityCode && !provinceCode) {
    errors.push(t('institutionCorrection.validation.provinceCityMismatch'));
  } else if (provinceCode && cityCode) {
    validatedLocation = validateProvinceAndCity(provinceCode, cityCode);
    if (!validatedLocation) {
      errors.push(t('institutionCorrection.validation.provinceCityMismatch'));
    }
  }

  if (countyCode && !cityCode) {
    errors.push(t('institutionCorrection.validation.cityCountyMismatch'));
  } else if (cityCode && countyCode) {
    validatedCounty = validateCountyForCity(cityCode, countyCode);
    if (!validatedCounty) {
      errors.push(t('institutionCorrection.validation.cityCountyMismatch'));
    }
  }

  return {
    errors,
    values: {
      schoolName,
      provinceCode: validatedLocation ? validatedLocation.provinceCode : (validatedProvince ? validatedProvince.code : ''),
      province: validatedLocation ? validatedLocation.provinceName : (validatedProvince ? validatedProvince.name : ''),
      cityCode: validatedLocation ? validatedLocation.cityCode : '',
      city: validatedLocation ? validatedLocation.cityName : '',
      countyCode: validatedCounty ? validatedCounty.countyCode : '',
      county: validatedCounty ? validatedCounty.countyName : '',
      schoolAddress,
      contactInformation,
      headmasterName,
      correctionContent
    }
  };
}

async function saveInstitutionCorrectionSubmission({ req, values }) {
  const { binding, bindingName } = getInstitutionCorrectionDatabaseBinding();
  if (!binding) {
    throw new InstitutionCorrectionStorageUnavailableError();
  }

  await ensureInstitutionCorrectionSchema(binding);

  const submissionId = crypto.randomUUID();
  const userAgent = getTrimmedString(req.get ? req.get('user-agent') : req.headers?.['user-agent']).slice(0, 512);
  const createdAt = new Date().toISOString();

  await binding
    .prepare(`
      INSERT INTO ${TABLE_NAME} (
        id,
        school_name,
        province_code,
        province_name,
        city_code,
        city_name,
        county_code,
        county_name,
        school_address,
        contact_information,
        headmaster_name,
        correction_content,
        status,
        lang,
        source_path,
        client_ip_hash,
        user_agent,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      submissionId,
      values.schoolName,
      normalizeNullableValue(values.provinceCode),
      normalizeNullableValue(values.province),
      normalizeNullableValue(values.cityCode),
      normalizeNullableValue(values.city),
      normalizeNullableValue(values.countyCode),
      normalizeNullableValue(values.county),
      normalizeNullableValue(values.schoolAddress),
      normalizeNullableValue(values.contactInformation),
      normalizeNullableValue(values.headmasterName),
      normalizeNullableValue(values.correctionContent),
      'pending',
      getTrimmedString(req.lang) || 'zh-CN',
      getTrimmedString(req.originalUrl || req.path || '/map/correction/submit'),
      hashClientIp(getClientIp(req)),
      normalizeNullableValue(userAgent),
      createdAt
    )
    .run();

  return {
    bindingName,
    submissionId,
    createdAt
  };
}

module.exports = {
  CREATE_TABLE_STATEMENT,
  InstitutionCorrectionStorageUnavailableError,
  TABLE_NAME,
  getInstitutionCorrectionDatabaseBinding,
  saveInstitutionCorrectionSubmission,
  validateInstitutionCorrectionSubmission
};
