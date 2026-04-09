// 表單枚举值、长度规则和地区联动数据都集中在这里，前后端共用一套定义。
const SELF_IDENTITY = '受害者本人';
const AGENT_IDENTITY = '受害者的代理人';
const OTHER_SEX_OPTION = '__other_option__';
const CUSTOM_OTHER_SEX_OPTION = '__custom_other_sex__';
const allowedIdentities = new Set([SELF_IDENTITY, AGENT_IDENTITY]);
const allowedSexes = new Set(['女性', '男性', OTHER_SEX_OPTION]);
const otherSexTypeOptions = [
  { value: 'MtF', labelKey: 'form.sexIdentityOptions.mtf' },
  { value: 'FtM', labelKey: 'form.sexIdentityOptions.ftm' },
  { value: 'X', labelKey: 'form.sexIdentityOptions.x' },
  { value: 'Queer', labelKey: 'form.sexIdentityOptions.queer' }
];
const allowedOtherSexTypes = new Set([
  ...otherSexTypeOptions.map((option) => option.value),
  CUSTOM_OTHER_SEX_OPTION
]);
const identityOptions = [
  { value: SELF_IDENTITY, labelKey: 'form.identityOptions.self' },
  { value: AGENT_IDENTITY, labelKey: 'form.identityOptions.agent' }
];
const sexOptions = [
  { value: '女性', labelKey: 'form.sexOptions.female' },
  { value: '男性', labelKey: 'form.sexOptions.male' },
  { value: OTHER_SEX_OPTION, labelKey: 'form.sexOptions.other' }
];

function isAgentIdentity(identity) {
  return identity === AGENT_IDENTITY;
}

function getBirthYearLabelKey(identity) {
  return isAgentIdentity(identity) ? 'fields.victimBirthYear' : 'fields.birthYear';
}

function getSexLabelKey(identity) {
  return isAgentIdentity(identity) ? 'fields.victimSex' : 'fields.sex';
}

function getFormRuleDefinitions(now = new Date()) {
  const currentYear = now.getUTCFullYear();

  return {
    birthDate: { labelKey: 'fields.birthDate', required: true },
    // Worker 可能跨年持续复用同一模块实例，所以年份上限要按调用时动态计算。
    birthYear: { labelKey: 'fields.birthYear', required: true, min: 1900, max: currentYear },
    birthMonth: { labelKey: 'fields.birthMonth', required: true, min: 1, max: 12 },
    birthDay: { labelKey: 'fields.birthDay', required: true, min: 1, max: 31 },
    identity: { labelKey: 'fields.identity', required: true },
    sex: { labelKey: 'fields.sex', required: true },
    sexOther: { labelKey: 'fields.sexOther', maxLength: 30 },
    provinceCode: { labelKey: 'fields.provinceCode', required: true },
    cityCode: { labelKey: 'fields.cityCode', required: true },
    countyCode: { labelKey: 'fields.countyCode', required: false },
    schoolName: { labelKey: 'fields.schoolName', required: true, maxLength: 20 },
    schoolAddress: { labelKey: 'fields.schoolAddress', maxLength: 50 },
    dateStart: { labelKey: 'fields.dateStart', required: true },
    dateEnd: { labelKey: 'fields.dateEnd' },
    experience: { labelKey: 'fields.experience', maxLength: 8000 },
    headmasterName: { labelKey: 'fields.headmasterName', maxLength: 10 },
    contactInformation: { labelKey: 'fields.contactInformation', required: true, maxLength: 30 },
    scandal: { labelKey: 'fields.scandal', maxLength: 3000 },
    other: { labelKey: 'fields.other', maxLength: 3000 }
  };
}

function getLocalizedFormRules(t, now = new Date()) {
  const formRuleDefinitions = getFormRuleDefinitions(now);

  return Object.fromEntries(
    Object.entries(formRuleDefinitions).map(([field, definition]) => [
      field,
      {
        ...definition,
        label: t(definition.labelKey)
      }
    ])
  );
}

function getLocalizedIdentityOptions(t) {
  return identityOptions.map((option) => ({
    value: option.value,
    label: t(option.labelKey)
  }));
}

function getLocalizedSexOptions(t) {
  return sexOptions.map((option) => ({
    value: option.value,
    label: t(option.labelKey)
  }));
}

function getLocalizedOtherSexTypeOptions(t) {
  return otherSexTypeOptions.map((option) => ({
    value: option.value,
    label: t(option.labelKey)
  }));
}

module.exports = {
  AGENT_IDENTITY,
  CUSTOM_OTHER_SEX_OPTION,
  OTHER_SEX_OPTION,
  SELF_IDENTITY,
  allowedIdentities,
  allowedOtherSexTypes,
  allowedSexes,
  getBirthYearLabelKey,
  getFormRuleDefinitions,
  getLocalizedFormRules,
  getLocalizedIdentityOptions,
  getLocalizedOtherSexTypeOptions,
  getLocalizedSexOptions,
  getSexLabelKey,
  identityOptions,
  isAgentIdentity,
  otherSexTypeOptions,
  sexOptions
};
