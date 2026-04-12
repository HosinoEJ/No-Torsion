function getInstitutionCorrectionRuleDefinitions() {
  return {
    schoolName: { labelKey: 'institutionCorrection.fields.schoolName', required: true, maxLength: 80 },
    provinceCode: { labelKey: 'institutionCorrection.fields.province', required: false },
    cityCode: { labelKey: 'institutionCorrection.fields.city', required: false },
    countyCode: { labelKey: 'institutionCorrection.fields.county', required: false },
    schoolAddress: { labelKey: 'institutionCorrection.fields.schoolAddress', required: false, maxLength: 200 },
    contactInformation: { labelKey: 'institutionCorrection.fields.contactInformation', required: false, maxLength: 120 },
    headmasterName: { labelKey: 'institutionCorrection.fields.headmasterName', required: false, maxLength: 80 },
    correctionContent: { labelKey: 'institutionCorrection.fields.correctionContent', required: false, maxLength: 4000 }
  };
}

function getLocalizedInstitutionCorrectionRules(t) {
  const definitions = getInstitutionCorrectionRuleDefinitions();

  return Object.fromEntries(
    Object.entries(definitions).map(([field, definition]) => [
      field,
      {
        ...definition,
        label: t(definition.labelKey)
      }
    ])
  );
}

module.exports = {
  getInstitutionCorrectionRuleDefinitions,
  getLocalizedInstitutionCorrectionRules
};
