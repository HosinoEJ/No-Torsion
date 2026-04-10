const axios = require('axios');
const { validateProvinceAndCity, validateCountyForCity } = require('../../config/areaSelector');
const {
  allowedIdentities,
  allowedOtherSexTypes,
  allowedSexes,
  CUSTOM_OTHER_SEX_OPTION,
  getBirthYearLabelKey,
  getFormRuleDefinitions,
  getSexLabelKey,
  OTHER_SEX_OPTION
} = require('../../config/formConfig');
let ProxyAgentConstructor = null;
let cachedProxyAgent = null;

// 提交前统一做 trim，避免首尾空格造成前后端校验不一致。
function getTrimmedString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function parseIntegerString(value) {
  const text = getTrimmedString(value);
  if (!/^-?\d+$/.test(text)) {
    return null;
  }

  return Number.parseInt(text, 10);
}

function padNumber(value) {
  return String(value).padStart(2, '0');
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

function buildNormalizedSexValue(sex, sexOtherType, sexOther) {
  if (sex !== OTHER_SEX_OPTION) {
    return sex;
  }

  // “其他性别认同”最终会折叠成一个字符串，便于继续映射到单个 Google Form 字段。
  if (sexOtherType === CUSTOM_OTHER_SEX_OPTION) {
    return sexOther;
  }

  if (sexOtherType && sexOther) {
    return `${sexOtherType} / ${sexOther}`;
  }

  return sexOtherType || sexOther;
}

function hasProxyConfiguration() {
  return [
    process.env.HTTPS_PROXY,
    process.env.https_proxy,
    process.env.HTTP_PROXY,
    process.env.http_proxy,
    process.env.ALL_PROXY,
    process.env.all_proxy
  ].some((value) => typeof value === 'string' && value.trim());
}

function getProxyAgent() {
  if (!cachedProxyAgent) {
    if (!ProxyAgentConstructor) {
      ({ ProxyAgent: ProxyAgentConstructor } = require('proxy-agent'));
    }

    cachedProxyAgent = new ProxyAgentConstructor();
  }

  return cachedProxyAgent;
}

function normalizeGoogleFormProvinceValue(province) {
  return province === '臺灣' ? '臺灣（ROC）' : province;
}

function calculateApproximateAgeFromBirthYear(birthYear, now = new Date()) {
  if (!Number.isInteger(birthYear)) {
    return null;
  }

  return now.getUTCFullYear() - birthYear;
}

function buildGoogleFormSexFields(sexLabel, sexValue) {
  if (sexValue === '男性') {
    return [
      { entryId: 'entry.1422578992', label: sexLabel, value: '男' }
    ];
  }

  if (sexValue === '女性') {
    return [
      { entryId: 'entry.1422578992', label: sexLabel, value: '女' }
    ];
  }

  if (sexValue === 'MtF' || sexValue === 'FtM') {
    return [
      { entryId: 'entry.1422578992', label: sexLabel, value: sexValue }
    ];
  }

  // Google Form 的当前性别题型是单选 + “Other” 文本输入，因此需要拆成两个字段。
  return [
    { entryId: 'entry.1422578992', label: sexLabel, value: OTHER_SEX_OPTION },
    { entryId: 'entry.1422578992.other_option_response', label: sexLabel, value: sexValue }
  ];
}

// 把前端表单请求体校验并整理成后续可直接发往 Google Form 的结构。
function validateSubmission(body, t) {
  const errors = [];
  const formRuleDefinitions = getFormRuleDefinitions();
  const identity = getTrimmedString(body.identity);
  const formRules = Object.fromEntries(
    Object.entries(formRuleDefinitions).map(([field, definition]) => [
      field,
      {
        ...definition,
        label: t(definition.labelKey)
      }
    ])
  );
  formRules.birthYear.label = t(getBirthYearLabelKey(identity));
  formRules.sex.label = t(getSexLabelKey(identity));
  const birthYearValue = getTrimmedString(body.birth_year);
  const birthMonthValue = String(formRuleDefinitions.birthMonth.min);
  const birthDayValue = String(formRuleDefinitions.birthDay.min);
  const birthYear = parseIntegerString(body.birth_year);
  const birthMonth = formRuleDefinitions.birthMonth.min;
  const birthDay = formRuleDefinitions.birthDay.min;
  const sex = getTrimmedString(body.sex);
  const sexOtherType = getTrimmedString(body.sex_other_type);
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
  let birthDate = '';
  let googleFormAge = null;
  let validatedLocation = null;
  let validatedCounty = null;

  // 当前表单只采集出生年份，所以月/日会用规则定义里的最小值补齐成合法日期。
  if (!birthYearValue) {
    errors.push(t('formErrors.required', { label: formRules.birthYear.label }));
  } else {
    if (
      !Number.isInteger(birthYear)
      || birthYear < formRules.birthYear.min
      || birthYear > formRules.birthYear.max
    ) {
      errors.push(t('formErrors.invalidBirthDate', { label: formRules.birthYear.label }));
    } else {
      birthDate = `${String(birthYear).padStart(4, '0')}-${padNumber(birthMonth)}-${padNumber(birthDay)}`;

      if (!validateDateString(birthDate)) {
        errors.push(t('formErrors.invalidBirthDate', { label: formRules.birthYear.label }));
      } else {
        googleFormAge = calculateApproximateAgeFromBirthYear(birthYear);

        if (!Number.isInteger(googleFormAge) || googleFormAge < 0 || googleFormAge > 100) {
          errors.push(t('formErrors.ageRange', {
            label: formRules.birthYear.label,
            min: 0,
            max: 100
          }));
        }
      }
    }
  }

  if (!allowedIdentities.has(identity)) {
    errors.push(t('formErrors.invalidIdentity'));
  }

  if (!sex) {
    errors.push(t('formErrors.required', { label: formRules.sex.label }));
  } else if (!allowedSexes.has(sex)) {
    errors.push(t('formErrors.invalidSex'));
  }

  if (sexOtherType && !allowedOtherSexTypes.has(sexOtherType)) {
    errors.push(t('formErrors.invalidSex'));
  }

  if (sex === OTHER_SEX_OPTION && !sexOtherType && !sexOther) {
    errors.push(t('formErrors.otherSexRequired'));
  }

  if (sex === OTHER_SEX_OPTION && sexOtherType === CUSTOM_OTHER_SEX_OPTION && !sexOther) {
    errors.push(t('formErrors.otherSexRequired'));
  }

  if (!provinceCode) {
    errors.push(t('formErrors.required', { label: formRules.provinceCode.label }));
  }

  if (!cityCode) {
    errors.push(t('formErrors.required', { label: formRules.cityCode.label }));
  }

  if (provinceCode && cityCode) {
    // 省市联动数据来自统一配置，后端再次校验可以防止用户手工篡改 option value。
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
      birthDate,
      googleFormAge,
      birthYear: birthYearValue,
      birthMonth: birthMonthValue,
      birthDay: birthDayValue,
      // Google Form 当前只有一个地区字段，所以县区存在时与城市拼成一个字符串。
      province: validatedLocation ? validatedLocation.legacyProvinceName : '',
      city: validatedLocation ? validatedLocation.cityName : '',
      county: validatedCounty ? validatedCounty.countyName : '',
      schoolName,
      identity,
      sex: buildNormalizedSexValue(sex, sexOtherType, sexOther),
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
  const birthYearLabel = t(getBirthYearLabelKey(values.identity));
  const sexLabel = t(getSexLabelKey(values.identity));
  const cityValue = [values.city, values.county].filter(Boolean).join(' ');
  const fields = [
    // 线上 Google Form 仍沿用“年龄 + 旧性别选项”结构，这里统一做兼容转换。
    { entryId: 'entry.842223433', label: birthYearLabel, value: values.googleFormAge },
    { entryId: 'entry.1766160152', label: t('previewFields.province'), value: normalizeGoogleFormProvinceValue(values.province) },
    { entryId: 'entry.402227428', label: t('previewFields.city'), value: cityValue },
    { entryId: 'entry.5034928', label: t('previewFields.schoolName'), value: values.schoolName },
    { entryId: 'entry.500021634', label: t('previewFields.identity'), value: values.identity },
    ...buildGoogleFormSexFields(sexLabel, values.sex),
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

function buildConfirmationFields(values, t) {
  // 确认页展示使用“用户可读标签”，不暴露 Google Form 的 entry id。
  return [
    { label: t('form.fields.identity'), value: values.identity },
    { label: t(getBirthYearLabelKey(values.identity)), value: values.birthYear },
    { label: t(getSexLabelKey(values.identity)), value: values.sex },
    { label: t('form.fields.dateStart'), value: values.dateStart },
    { label: t('form.fields.dateEnd'), value: values.dateEnd },
    { label: t('form.fields.experience'), value: values.experience },
    { label: t('form.fields.schoolName'), value: values.schoolName },
    { label: t('form.fields.province'), value: values.province },
    { label: t('form.fields.city'), value: values.city },
    { label: t('form.fields.county'), value: values.county },
    { label: t('form.fields.schoolAddress'), value: values.schoolAddress },
    { label: t('form.fields.contactInformation'), value: values.contactInformation },
    { label: t('form.fields.headmasterName'), value: values.headmasterName },
    { label: t('form.fields.scandal'), value: values.scandal },
    { label: t('form.fields.other'), value: values.other }
  ];
}

// Google Form 需要 application/x-www-form-urlencoded，因此统一在这里编码。
function encodeGoogleFormFields(fields) {
  const params = new URLSearchParams();
  fields.forEach((field) => {
    params.append(field.entryId, field.value);
  });
  return params.toString();
}

function buildGoogleFormPrefillUrl(googleFormUrl, encodedPayload) {
  const normalizedUrl = getTrimmedString(googleFormUrl);

  if (!normalizedUrl) {
    return '';
  }

  const viewFormUrl = normalizedUrl.replace(/\/formResponse(?:\?.*)?$/i, '/viewform');
  const prefillParams = new URLSearchParams();
  prefillParams.set('usp', 'pp_url');

  new URLSearchParams(String(encodedPayload || '')).forEach((value, key) => {
    prefillParams.append(key, value);
  });

  return `${viewFormUrl}?${prefillParams.toString()}`;
}

// 真正发往 Google Form 的 HTTP 请求。
async function submitToGoogleForm(googleFormUrl, encodedPayload) {
  if (!getTrimmedString(googleFormUrl)) {
    throw new Error('未配置有效的 Google Form 提交地址');
  }

  const requestConfig = {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
    maxRedirects: 0,
    validateStatus(status) {
      return status >= 200 && status < 400;
    }
  };

  if (hasProxyConfiguration()) {
    const proxyAgent = getProxyAgent();

    requestConfig.proxy = false;
    requestConfig.httpAgent = proxyAgent;
    requestConfig.httpsAgent = proxyAgent;
  }

  await axios.post(googleFormUrl, encodedPayload, requestConfig);
}

module.exports = {
  buildGoogleFormPrefillUrl,
  buildConfirmationFields,
  buildGoogleFormFields,
  encodeGoogleFormFields,
  submitToGoogleForm,
  validateSubmission
};
