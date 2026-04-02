const chinaAreaData = require('china-area-data');
const { getProvinceCodeLabels } = require('./i18n');

// china-area-data 提供的是标准行政区名称，这里维护旧表单沿用的省份展示名映射。
const legacyProvinceNameByCode = {
  '110000': '北京',
  '120000': '天津',
  '130000': '河北',
  '140000': '山西',
  '150000': '內蒙古',
  '210000': '遼寧',
  '220000': '吉林',
  '230000': '黑龍江',
  '310000': '上海',
  '320000': '江蘇',
  '330000': '浙江',
  '340000': '安徽',
  '350000': '福建',
  '360000': '江西',
  '370000': '山東',
  '410000': '河南',
  '420000': '湖北',
  '430000': '湖南',
  '440000': '廣東',
  '450000': '廣西',
  '460000': '海南',
  '500000': '重慶',
  '510000': '四川',
  '520000': '貴州',
  '530000': '雲南',
  '540000': '西藏',
  '610000': '陝西',
  '620000': '甘肅',
  '630000': '青海',
  '640000': '寧夏',
  '650000': '新疆',
  '710000': '臺灣',
  '810000': '香港',
  '820000': '澳門'
};

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
