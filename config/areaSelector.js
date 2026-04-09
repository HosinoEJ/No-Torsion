const chinaAreaData = require('china-area-data');
const { getProvinceCodeLabels } = require('./i18n');
const { getLegacyProvinceNamesByCode } = require('./provinceMetadata');

// china-area-data 提供的是标准行政区名称，这里维护旧表单沿用的省份展示名映射。
const legacyProvinceNameByCode = getLegacyProvinceNamesByCode();

function toOption([code, name]) {
  return { code, name };
}

// 直辖市在标准数据里会出现“市辖区 / 县”这种中间层，前端城市选择时需要下钻一层。
function shouldFlattenToDistricts(entries) {
  return entries.length > 0 && entries.every(([, name]) => name === '市辖区' || name === '县');
}

// 顶层省份选项。
function getProvinceOptions() {
  return Object.entries(chinaAreaData['86'] || {}).map(toOption);
}

// 省份下的第二级选项。普通省份返回地级市，直辖市会直接返回区县。
function getCityOptionsForProvince(provinceCode) {
  const cityEntries = Object.entries(chinaAreaData[provinceCode] || {});

  if (cityEntries.length === 0) {
    return [];
  }

  if (shouldFlattenToDistricts(cityEntries)) {
    return cityEntries.flatMap(([cityCode]) => Object.entries(chinaAreaData[cityCode] || {}).map(toOption));
  }

  return cityEntries.map(toOption);
}

// 第三级县区选项，过滤掉“市辖区 / 县”这种占位节点。
function getCountyOptionsForCity(cityCode) {
  return Object.entries(chinaAreaData[cityCode] || {})
    .filter(([, name]) => name !== '市辖区' && name !== '县')
    .map(toOption);
}

const provinceOptions = getProvinceOptions();
const cityOptionsByProvinceCode = Object.fromEntries(
  provinceOptions.map((province) => [province.code, getCityOptionsForProvince(province.code)])
);
const countiesByCityCode = Object.fromEntries(
  Object.values(cityOptionsByProvinceCode)
    .flat()
    .map((city) => [city.code, getCountyOptionsForCity(city.code)])
);

function getAreaOptions(language) {
  const provinceLabels = getProvinceCodeLabels(language);
  return {
    provinces: provinceOptions.map((province) => ({
      code: province.code,
      name: provinceLabels[province.code] || province.name
    })),
    citiesByProvinceCode: cityOptionsByProvinceCode,
    countiesByCityCode
  };
}

// 用于后端校验“省份 code + 城市 code”是否合法匹配。
function validateProvinceAndCity(provinceCode, cityCode) {
  const province = provinceOptions.find((item) => item.code === provinceCode);

  if (!province) {
    return null;
  }

  const city = (cityOptionsByProvinceCode[provinceCode] || []).find((item) => item.code === cityCode);

  if (!city) {
    return null;
  }

  return {
    provinceCode: province.code,
    provinceName: province.name,
    legacyProvinceName: legacyProvinceNameByCode[province.code] || province.name,
    cityCode: city.code,
    cityName: city.name
  };
}

// 县区是可选项，只有用户真的选了才校验它是否属于当前城市。
function validateCountyForCity(cityCode, countyCode) {
  if (!countyCode) {
    return null;
  }

  const county = (countiesByCityCode[cityCode] || []).find((item) => item.code === countyCode);
  if (!county) {
    return null;
  }

  return {
    countyCode: county.code,
    countyName: county.name
  };
}

module.exports = {
  provinceOptions,
  cityOptionsByProvinceCode,
  countiesByCityCode,
  getAreaOptions,
  validateProvinceAndCity,
  validateCountyForCity
};
