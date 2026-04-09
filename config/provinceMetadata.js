const defaultLanguage = 'zh-CN';
const supportedLanguages = ['zh-CN', 'zh-TW', 'en'];

const provinceMetadataByCode = Object.freeze({
  '110000': {
    legacyName: '北京',
    shortLabels: { 'zh-CN': '北京', 'zh-TW': '北京', en: 'Beijing' },
    fullLabels: { 'zh-CN': '北京市', 'zh-TW': '北京市', en: 'Beijing Municipality' },
    areaSquareKilometers: 16410.54
  },
  '120000': {
    legacyName: '天津',
    shortLabels: { 'zh-CN': '天津', 'zh-TW': '天津', en: 'Tianjin' },
    fullLabels: { 'zh-CN': '天津市', 'zh-TW': '天津市', en: 'Tianjin Municipality' },
    areaSquareKilometers: 11966.45
  },
  '130000': {
    legacyName: '河北',
    shortLabels: { 'zh-CN': '河北', 'zh-TW': '河北', en: 'Hebei' },
    fullLabels: { 'zh-CN': '河北省', 'zh-TW': '河北省', en: 'Hebei Province' },
    areaSquareKilometers: 188800
  },
  '140000': {
    legacyName: '山西',
    shortLabels: { 'zh-CN': '山西', 'zh-TW': '山西', en: 'Shanxi' },
    fullLabels: { 'zh-CN': '山西省', 'zh-TW': '山西省', en: 'Shanxi Province' },
    areaSquareKilometers: 156700
  },
  '150000': {
    legacyName: '內蒙古',
    shortLabels: { 'zh-CN': '内蒙古', 'zh-TW': '內蒙古', en: 'Inner Mongolia' },
    fullLabels: { 'zh-CN': '内蒙古自治区', 'zh-TW': '內蒙古自治區', en: 'Inner Mongolia Autonomous Region' },
    areaSquareKilometers: 1183000
  },
  '210000': {
    legacyName: '遼寧',
    shortLabels: { 'zh-CN': '辽宁', 'zh-TW': '遼寧', en: 'Liaoning' },
    fullLabels: { 'zh-CN': '辽宁省', 'zh-TW': '遼寧省', en: 'Liaoning Province' },
    areaSquareKilometers: 148000
  },
  '220000': {
    legacyName: '吉林',
    shortLabels: { 'zh-CN': '吉林', 'zh-TW': '吉林', en: 'Jilin' },
    fullLabels: { 'zh-CN': '吉林省', 'zh-TW': '吉林省', en: 'Jilin Province' },
    areaSquareKilometers: 187400
  },
  '230000': {
    legacyName: '黑龍江',
    shortLabels: { 'zh-CN': '黑龙江', 'zh-TW': '黑龍江', en: 'Heilongjiang' },
    fullLabels: { 'zh-CN': '黑龙江省', 'zh-TW': '黑龍江省', en: 'Heilongjiang Province' },
    areaSquareKilometers: 473000
  },
  '310000': {
    legacyName: '上海',
    shortLabels: { 'zh-CN': '上海', 'zh-TW': '上海', en: 'Shanghai' },
    fullLabels: { 'zh-CN': '上海市', 'zh-TW': '上海市', en: 'Shanghai Municipality' },
    areaSquareKilometers: 6340.5
  },
  '320000': {
    legacyName: '江蘇',
    shortLabels: { 'zh-CN': '江苏', 'zh-TW': '江蘇', en: 'Jiangsu' },
    fullLabels: { 'zh-CN': '江苏省', 'zh-TW': '江蘇省', en: 'Jiangsu Province' },
    areaSquareKilometers: 107200
  },
  '330000': {
    legacyName: '浙江',
    shortLabels: { 'zh-CN': '浙江', 'zh-TW': '浙江', en: 'Zhejiang' },
    fullLabels: { 'zh-CN': '浙江省', 'zh-TW': '浙江省', en: 'Zhejiang Province' },
    areaSquareKilometers: 105500
  },
  '340000': {
    legacyName: '安徽',
    shortLabels: { 'zh-CN': '安徽', 'zh-TW': '安徽', en: 'Anhui' },
    fullLabels: { 'zh-CN': '安徽省', 'zh-TW': '安徽省', en: 'Anhui Province' },
    areaSquareKilometers: 140100
  },
  '350000': {
    legacyName: '福建',
    shortLabels: { 'zh-CN': '福建', 'zh-TW': '福建', en: 'Fujian' },
    fullLabels: { 'zh-CN': '福建省', 'zh-TW': '福建省', en: 'Fujian Province' },
    areaSquareKilometers: 124000
  },
  '360000': {
    legacyName: '江西',
    shortLabels: { 'zh-CN': '江西', 'zh-TW': '江西', en: 'Jiangxi' },
    fullLabels: { 'zh-CN': '江西省', 'zh-TW': '江西省', en: 'Jiangxi Province' },
    areaSquareKilometers: 166900
  },
  '370000': {
    legacyName: '山東',
    shortLabels: { 'zh-CN': '山东', 'zh-TW': '山東', en: 'Shandong' },
    fullLabels: { 'zh-CN': '山东省', 'zh-TW': '山東省', en: 'Shandong Province' },
    areaSquareKilometers: 157900
  },
  '410000': {
    legacyName: '河南',
    shortLabels: { 'zh-CN': '河南', 'zh-TW': '河南', en: 'Henan' },
    fullLabels: { 'zh-CN': '河南省', 'zh-TW': '河南省', en: 'Henan Province' },
    areaSquareKilometers: 167000
  },
  '420000': {
    legacyName: '湖北',
    shortLabels: { 'zh-CN': '湖北', 'zh-TW': '湖北', en: 'Hubei' },
    fullLabels: { 'zh-CN': '湖北省', 'zh-TW': '湖北省', en: 'Hubei Province' },
    areaSquareKilometers: 185900
  },
  '430000': {
    legacyName: '湖南',
    shortLabels: { 'zh-CN': '湖南', 'zh-TW': '湖南', en: 'Hunan' },
    fullLabels: { 'zh-CN': '湖南省', 'zh-TW': '湖南省', en: 'Hunan Province' },
    areaSquareKilometers: 211800
  },
  '440000': {
    legacyName: '廣東',
    shortLabels: { 'zh-CN': '广东', 'zh-TW': '廣東', en: 'Guangdong' },
    fullLabels: { 'zh-CN': '广东省', 'zh-TW': '廣東省', en: 'Guangdong Province' },
    areaSquareKilometers: 179800
  },
  '450000': {
    legacyName: '廣西',
    shortLabels: { 'zh-CN': '广西', 'zh-TW': '廣西', en: 'Guangxi' },
    fullLabels: { 'zh-CN': '广西壮族自治区', 'zh-TW': '廣西壯族自治區', en: 'Guangxi Zhuang Autonomous Region' },
    areaSquareKilometers: 237600
  },
  '460000': {
    legacyName: '海南',
    shortLabels: { 'zh-CN': '海南', 'zh-TW': '海南', en: 'Hainan' },
    fullLabels: { 'zh-CN': '海南省', 'zh-TW': '海南省', en: 'Hainan Province' },
    areaSquareKilometers: 35400
  },
  '500000': {
    legacyName: '重慶',
    shortLabels: { 'zh-CN': '重庆', 'zh-TW': '重慶', en: 'Chongqing' },
    fullLabels: { 'zh-CN': '重庆市', 'zh-TW': '重慶市', en: 'Chongqing Municipality' },
    areaSquareKilometers: 82402
  },
  '510000': {
    legacyName: '四川',
    shortLabels: { 'zh-CN': '四川', 'zh-TW': '四川', en: 'Sichuan' },
    fullLabels: { 'zh-CN': '四川省', 'zh-TW': '四川省', en: 'Sichuan Province' },
    areaSquareKilometers: 486000
  },
  '520000': {
    legacyName: '貴州',
    shortLabels: { 'zh-CN': '贵州', 'zh-TW': '貴州', en: 'Guizhou' },
    fullLabels: { 'zh-CN': '贵州省', 'zh-TW': '貴州省', en: 'Guizhou Province' },
    areaSquareKilometers: 176200
  },
  '530000': {
    legacyName: '雲南',
    shortLabels: { 'zh-CN': '云南', 'zh-TW': '雲南', en: 'Yunnan' },
    fullLabels: { 'zh-CN': '云南省', 'zh-TW': '雲南省', en: 'Yunnan Province' },
    areaSquareKilometers: 394000
  },
  '540000': {
    legacyName: '西藏',
    shortLabels: { 'zh-CN': '西藏', 'zh-TW': '西藏', en: 'Tibet' },
    fullLabels: { 'zh-CN': '西藏自治区', 'zh-TW': '西藏自治區', en: 'Tibet Autonomous Region' },
    areaSquareKilometers: 1228400
  },
  '610000': {
    legacyName: '陝西',
    shortLabels: { 'zh-CN': '陕西', 'zh-TW': '陝西', en: 'Shaanxi' },
    fullLabels: { 'zh-CN': '陕西省', 'zh-TW': '陝西省', en: 'Shaanxi Province' },
    areaSquareKilometers: 205800
  },
  '620000': {
    legacyName: '甘肅',
    shortLabels: { 'zh-CN': '甘肃', 'zh-TW': '甘肅', en: 'Gansu' },
    fullLabels: { 'zh-CN': '甘肃省', 'zh-TW': '甘肅省', en: 'Gansu Province' },
    areaSquareKilometers: 425800
  },
  '630000': {
    legacyName: '青海',
    shortLabels: { 'zh-CN': '青海', 'zh-TW': '青海', en: 'Qinghai' },
    fullLabels: { 'zh-CN': '青海省', 'zh-TW': '青海省', en: 'Qinghai Province' },
    areaSquareKilometers: 722300
  },
  '640000': {
    legacyName: '寧夏',
    shortLabels: { 'zh-CN': '宁夏', 'zh-TW': '寧夏', en: 'Ningxia' },
    fullLabels: { 'zh-CN': '宁夏回族自治区', 'zh-TW': '寧夏回族自治區', en: 'Ningxia Hui Autonomous Region' },
    areaSquareKilometers: 66400
  },
  '650000': {
    legacyName: '新疆',
    shortLabels: { 'zh-CN': '新疆', 'zh-TW': '新疆', en: 'Xinjiang' },
    fullLabels: { 'zh-CN': '新疆维吾尔自治区', 'zh-TW': '新疆維吾爾自治區', en: 'Xinjiang Uyghur Autonomous Region' },
    areaSquareKilometers: 1664900
  },
  '710000': {
    legacyName: '臺灣',
    shortLabels: { 'zh-CN': '台湾', 'zh-TW': '臺灣', en: 'Taiwan' },
    fullLabels: { 'zh-CN': '台湾省', 'zh-TW': '臺灣', en: 'Taiwan' },
    areaSquareKilometers: 36000
  },
  '810000': {
    legacyName: '香港',
    shortLabels: { 'zh-CN': '香港', 'zh-TW': '香港', en: 'Hong Kong' },
    fullLabels: { 'zh-CN': '香港特别行政区', 'zh-TW': '香港特別行政區', en: 'Hong Kong Special Administrative Region' },
    areaSquareKilometers: 1113.76
  },
  '820000': {
    legacyName: '澳門',
    shortLabels: { 'zh-CN': '澳门', 'zh-TW': '澳門', en: 'Macau' },
    fullLabels: { 'zh-CN': '澳门特别行政区', 'zh-TW': '澳門特別行政區', en: 'Macau Special Administrative Region' },
    areaSquareKilometers: 32.9
  }
});

function resolveLanguage(language) {
  return supportedLanguages.includes(language) ? language : defaultLanguage;
}

function getProvinceDisplayLabel(metadata, language) {
  const resolvedLanguage = resolveLanguage(language);

  if (resolvedLanguage === 'zh-CN') {
    return metadata.fullLabels['zh-CN'];
  }

  return metadata.shortLabels[resolvedLanguage] || metadata.shortLabels[defaultLanguage];
}

function buildLabelMap(selector) {
  return Object.fromEntries(
    Object.entries(provinceMetadataByCode).map(([code, metadata]) => [code, selector(metadata, code)])
  );
}

function getProvinceCodeLabels(language) {
  return buildLabelMap((metadata) => getProvinceDisplayLabel(metadata, language));
}

function getProvinceFullCodeLabels(language) {
  const resolvedLanguage = resolveLanguage(language);
  return buildLabelMap((metadata) => metadata.fullLabels[resolvedLanguage] || metadata.fullLabels[defaultLanguage]);
}

function getLegacyProvinceNamesByCode() {
  return buildLabelMap((metadata) => metadata.legacyName);
}

function getClientProvinceMetadata() {
  return provinceMetadataByCode;
}

module.exports = {
  defaultLanguage,
  getClientProvinceMetadata,
  getLegacyProvinceNamesByCode,
  getProvinceCodeLabels,
  getProvinceFullCodeLabels,
  provinceMetadataByCode,
  supportedLanguages
};
