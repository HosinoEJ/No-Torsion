(() => {
  // 省市县选项不直接整包内联到页面，而是按需请求，减轻首屏 HTML 体积。
  const areaSelectorData = window.AREA_SELECTOR_DATA || { provinces: [] };
  const i18n = window.I18N;
  const formI18n = window.FORM_UI_TEXT || i18n.form || { fields: {}, placeholders: {} };
  const provinceSelect = document.getElementById('provinceSelect');
  const citySelect = document.getElementById('citySelect');
  const countySelect = document.getElementById('countySelect');
  let cityRequestId = 0;
  let countyRequestId = 0;

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

  async function requestAreaOptions(queryKey, queryValue) {
    const requestUrl = new URL('/api/area-options', window.location.origin);
    requestUrl.searchParams.set(queryKey, queryValue);
    // 当前界面语言也一并传给后端，城市/县区名称可按访问语言即时本地化。
    requestUrl.searchParams.set('lang', window.APP_LANG || '');

    const response = await window.fetch(requestUrl.toString(), {
      headers: {
        Accept: 'application/json'
      }
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error((payload && payload.error) || 'Failed to load area options');
    }

    return Array.isArray(payload.options) ? payload.options : [];
  }

  async function updateCityOptions(provinceCode) {
    const currentRequestId = ++cityRequestId;

    citySelect.disabled = true;
    renderOptions(citySelect, [], provinceCode ? i18n.common.loading : formI18n.placeholders.city);
    await updateCountyOptions('');

    if (!provinceCode) {
      return;
    }

    try {
      const cityOptions = await requestAreaOptions('provinceCode', provinceCode);
      // 用户快速切换省份时，只保留最后一次请求结果，避免旧响应覆盖新选择。
      if (currentRequestId !== cityRequestId) {
        return;
      }

      citySelect.disabled = cityOptions.length === 0;
      renderOptions(
        citySelect,
        cityOptions,
        cityOptions.length === 0 ? formI18n.placeholders.city : formI18n.fields.city
      );
    } catch (_error) {
      if (currentRequestId !== cityRequestId) {
        return;
      }

      citySelect.disabled = true;
      renderOptions(citySelect, [], formI18n.placeholders.city);
    }
  }

  async function updateCountyOptions(cityCode) {
    if (!countySelect) {
      return;
    }

    const currentRequestId = ++countyRequestId;

    if (!cityCode) {
      countySelect.disabled = true;
      renderOptions(countySelect, [], formI18n.placeholders.countyInitial);
      return;
    }

    countySelect.disabled = true;
    renderOptions(countySelect, [], i18n.common.loading);

    try {
      const countyOptions = await requestAreaOptions('cityCode', cityCode);
      // 县区请求同样做“最后一次生效”，避免异步返回顺序打乱界面状态。
      if (currentRequestId !== countyRequestId) {
        return;
      }

      countySelect.disabled = countyOptions.length === 0;
      renderOptions(
        countySelect,
        countyOptions,
        countyOptions.length === 0 ? formI18n.placeholders.countyUnavailable : formI18n.placeholders.county
      );
    } catch (_error) {
      if (currentRequestId !== countyRequestId) {
        return;
      }

      countySelect.disabled = true;
      renderOptions(countySelect, [], formI18n.placeholders.countyInitial);
    }
  }

  if (provinceSelect && citySelect) {
    renderOptions(provinceSelect, areaSelectorData.provinces || [], formI18n.placeholders.province);
    citySelect.disabled = true;
    if (countySelect) {
      countySelect.disabled = true;
      renderOptions(countySelect, [], formI18n.placeholders.countyInitial);
    }

    provinceSelect.addEventListener('change', () => {
      updateCityOptions(provinceSelect.value);
    });

    citySelect.addEventListener('change', () => {
      updateCountyOptions(citySelect.value);
    });
  }
})();
