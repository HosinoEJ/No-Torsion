const axios = require('axios');
const { validateProvinceAndCity, validateCountyForCity } = require('../../config/areaSelector');
const { allowedIdentities, allowedSexes, formRuleDefinitions } = require('../../config/formConfig');

// 提交前统一做 trim，避免首尾空格造成前后端校验不一致。
function getTrimmedString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

// 只接受 YYYY-MM-DD，且必须是一个真实存在的日期。
function validateDateString(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

// 文本字段的公共校验：必填和长度限制统一从这里走。
function validateTextField(errors, t, label, value, { required = false, maxLength }) {
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

// 把前端表单请求体校验并整理成后续可直接发往 Google Form 的结构。
function validateSubmission(body, t) {
  const errors = [];
  const formRules = Object.fromEntries(
    Object.entries(formRuleDefinitions).map(([field, definition]) => [
      field,
      {
        ...definition,
        label: t(definition.labelKey)
      }
    ])
  );
  const ageValue = getTrimmedString(body.age);
  const age = Number.parseInt(ageValue, 10);
  const identity = getTrimmedString(body.identity);
  const sex = getTrimmedString(body.sex);
  const sexOther = validateTextField(errors, t, formRules.sexOther.label, body.sex_other, {
    maxLength: formRules.sexOther.maxLength
  });
  const provinceCode = getTrimmedString(body.provinceCode);
  const cityCode = getTrimmedString(body.cityCode);
  const countyCode = getTrimmedString(body.countyCode);
  const schoolName = validateTextField(errors, t, formRules.schoolName.label, body.school_name, {
    required: formRules.schoolName.required,
    maxLength: formRules.schoolName.maxLength
  });
  const schoolAddress = validateTextField(errors, t, formRules.schoolAddress.label, body.school_address, {
    maxLength: formRules.schoolAddress.maxLength
  });
  const dateStart = getTrimmedString(body.date_start);
  const dateEnd = getTrimmedString(body.date_end);
  const experience = validateTextField(errors, t, formRules.experience.label, body.experience, {
    maxLength: formRules.experience.maxLength
  });
  const headmasterName = validateTextField(errors, t, formRules.headmasterName.label, body.headmaster_name, {
    maxLength: formRules.headmasterName.maxLength
  });
  const contactInformation = validateTextField(errors, t, formRules.contactInformation.label, body.contact_information, {
    required: formRules.contactInformation.required,
    maxLength: formRules.contactInformation.maxLength
  });
  const scandal = validateTextField(errors, t, formRules.scandal.label, body.scandal, {
    maxLength: formRules.scandal.maxLength
  });
  const other = validateTextField(errors, t, formRules.other.label, body.other, {
    maxLength: formRules.other.maxLength
  });
  let validatedLocation = null;
  let validatedCounty = null;

  if (!Number.isInteger(age) || age < formRules.age.min || age > formRules.age.max) {
    errors.push(t('formErrors.ageRange', {
      label: formRules.age.label,
      min: formRules.age.min,
      max: formRules.age.max
    }));
  }

  if (!allowedIdentities.has(identity)) {
    errors.push(t('formErrors.invalidIdentity'));
  }

  if (!sex) {
    errors.push(t('formErrors.required', { label: formRules.sex.label }));
  } else if (!allowedSexes.has(sex)) {
    errors.push(t('formErrors.invalidSex'));
  }

  if (sex === '__other_option__' && !sexOther) {
    errors.push(t('formErrors.otherSexRequired'));
  }

  if (!provinceCode) {
    errors.push(t('formErrors.required', { label: formRules.provinceCode.label }));
  }

  if (!cityCode) {
    errors.push(t('formErrors.required', { label: formRules.cityCode.label }));
  }

  if (provinceCode && cityCode) {
    validatedLocation = validateProvinceAndCity(provinceCode, cityCode);
    if (!validatedLocation) {
      errors.push(t('formErrors.provinceCityMismatch'));
    }
  }

  if (validatedLocation && countyCode) {
    validatedCounty = validateCountyForCity(cityCode, countyCode);
    if (!validatedCounty) {
      errors.push(t('formErrors.cityCountyMismatch'));
    }
  }

  if (!dateStart) {
    errors.push(t('formErrors.required', { label: formRules.dateStart.label }));
  } else if (!validateDateString(dateStart)) {
    errors.push(t('formErrors.invalidFormat', { label: formRules.dateStart.label }));
  }

  if (dateEnd && !validateDateString(dateEnd)) {
    errors.push(t('formErrors.invalidFormat', { label: formRules.dateEnd.label }));
  }

  if (dateStart && dateEnd && dateEnd < dateStart) {
    errors.push(t('formErrors.endDateBeforeStart', {
      endLabel: formRules.dateEnd.label,
      startLabel: formRules.dateStart.label
    }));
  }

  return {
    errors,
    values: {
      age,
      // Google Form 当前只有一个地区字段，所以县区存在时与城市拼成一个字符串。
      province: validatedLocation ? validatedLocation.legacyProvinceName : '',
      city: validatedLocation
        ? [validatedLocation.cityName, validatedCounty ? validatedCounty.countyName : ''].filter(Boolean).join(' ')
        : '',
      schoolName,
      identity,
      sex: sex === '__other_option__' ? sexOther : sex,
      schoolAddress,
      experience,
      dateStart,
      dateEnd,
      headmasterName,
      contactInformation,
      scandal,
      other
    }
  };
}

// 这里维护的是“站内字段 -> Google Form entry.xxx” 的最终映射。
function buildGoogleFormFields(values, t) {
  const fields = [
    { entryId: 'entry.842223433', label: t('previewFields.age'), value: String(values.age) },
    { entryId: 'entry.1766160152', label: t('previewFields.province'), value: values.province },
    { entryId: 'entry.402227428', label: t('previewFields.city'), value: values.city },
    { entryId: 'entry.5034928', label: t('previewFields.schoolName'), value: values.schoolName },
    { entryId: 'entry.500021634', label: t('previewFields.identity'), value: values.identity },
    { entryId: 'entry.1422578992', label: t('previewFields.sex'), value: values.sex },
    { entryId: 'entry.1390240202', label: t('previewFields.schoolAddress'), value: values.schoolAddress },
    { entryId: 'entry.578287646', label: t('previewFields.experience'), value: values.experience },
    { entryId: 'entry.1533497153', label: t('previewFields.headmasterName'), value: values.headmasterName },
    { entryId: 'entry.883193772', label: t('previewFields.contactInformation'), value: values.contactInformation },
    { entryId: 'entry.1400127416', label: t('previewFields.scandal'), value: values.scandal },
    { entryId: 'entry.2022959936', label: t('previewFields.other'), value: values.other }
  ];

  if (values.dateStart) {
    fields.push({ entryId: 'entry.1344969670', label: t('previewFields.dateStart'), value: values.dateStart });
  }

  if (values.dateEnd) {
    fields.push({ entryId: 'entry.129670533', label: t('previewFields.dateEnd'), value: values.dateEnd });
  }

  return fields;
}

// Google Form 需要 application/x-www-form-urlencoded，因此统一在这里编码。
function encodeGoogleFormFields(fields) {
  const params = new URLSearchParams();
  fields.forEach((field) => {
    params.append(field.entryId, field.value);
  });
  return params.toString();
}

// 真正发往 Google Form 的 HTTP 请求。
async function submitToGoogleForm(googleFormUrl, encodedPayload) {
  await axios.post(googleFormUrl, encodedPayload, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000
  });
}

module.exports = {
  buildGoogleFormFields,
  encodeGoogleFormFields,
  submitToGoogleForm,
  validateSubmission
};
