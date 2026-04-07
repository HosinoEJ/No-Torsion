// 表單枚举值、长度规则和地区联动数据都集中在这里，前后端共用一套定义。
const allowedIdentities = new Set(['受害者本人', '受害者的代理人']);
const allowedSexes = new Set(['男', '女', 'MtF', 'FtM', '__other_option__']);
const currentYear = new Date().getUTCFullYear();
const identityOptions = [
  { value: '受害者本人', labelKey: 'form.identityOptions.self' },
  { value: '受害者的代理人', labelKey: 'form.identityOptions.agent' }
];
const sexOptions = [
  { value: '男', labelKey: 'form.sexOptions.male' },
  { value: '女', labelKey: 'form.sexOptions.female' },
  { value: 'MtF', labelKey: 'form.sexOptions.mtf' },
  { value: 'FtM', labelKey: 'form.sexOptions.ftm' },
  { value: '__other_option__', labelKey: 'form.sexOptions.other' }
];
const formRuleDefinitions = {
  birthDate: { labelKey: 'fields.birthDate', required: true },
  birthYear: { labelKey: 'fields.birthYear', required: true, min: 1900, max: currentYear },
  birthMonth: { labelKey: 'fields.birthMonth', required: true, min: 1, max: 12 },
  birthDay: { labelKey: 'fields.birthDay', required: true, min: 1, max: 31 },
  identity: { labelKey: 'fields.identity', required: true },
  sex: { labelKey: 'fields.sex', required: true },
  sexOther: { labelKey: 'fields.sexOther', maxLength: 10 },
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

function getLocalizedFormRules(t) {
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

module.exports = {
  allowedIdentities,
  allowedSexes,
  formRuleDefinitions,
  getLocalizedFormRules,
  getLocalizedIdentityOptions,
  getLocalizedSexOptions,
  identityOptions,
  sexOptions
};
