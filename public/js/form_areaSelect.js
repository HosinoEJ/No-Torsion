(() => {
  const areaSelectorData = window.AREA_SELECTOR_DATA || { provinces: [], citiesByProvinceCode: {}, countiesByCityCode: {} };
  const i18n = window.I18N;
  const provinceSelect = document.getElementById('provinceSelect');
  const citySelect = document.getElementById('citySelect');
  const countySelect = document.getElementById('countySelect');

  function renderOptions(select, options, placeholder) {
    select.innerHTML = '';

    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder;
    placeholderOption.selected = true;
    select.appendChild(placeholderOption);

    options.forEach((option) => {
      const element = document.createElement('option');
      element.value = option.code;
      element.textContent = option.name;
      select.appendChild(element);
    });
  }

  function updateCityOptions(provinceCode) {
    const cityOptions = areaSelectorData.citiesByProvinceCode[provinceCode] || [];
    citySelect.disabled = cityOptions.length === 0;
    renderOptions(
      citySelect,
      cityOptions,
      cityOptions.length === 0 ? i18n.form.placeholders.city : i18n.form.fields.city
    );
    updateCountyOptions('');
  }

  function updateCountyOptions(cityCode) {
    if (!countySelect) {
      return;
    }

    const countyOptions = areaSelectorData.countiesByCityCode[cityCode] || [];
    countySelect.disabled = countyOptions.length === 0;
    renderOptions(
      countySelect,
      countyOptions,
      countyOptions.length === 0 ? i18n.form.placeholders.countyUnavailable : i18n.form.placeholders.county
    );
  }

  if (provinceSelect && citySelect) {
    renderOptions(provinceSelect, areaSelectorData.provinces || [], i18n.form.placeholders.province);
    citySelect.disabled = true;
    if (countySelect) {
      countySelect.disabled = true;
      renderOptions(countySelect, [], i18n.form.placeholders.countyInitial);
    }

    provinceSelect.addEventListener('change', () => {
      updateCityOptions(provinceSelect.value);
    });

    citySelect.addEventListener('change', () => {
      updateCountyOptions(citySelect.value);
    });
  }
})();
