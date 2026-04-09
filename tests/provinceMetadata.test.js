const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const geojson = require('../public/cn.json');
const { getAreaOptions } = require('../config/areaSelector');
const { getProvinceCodeLabels } = require('../config/i18n');
const { getClientProvinceMetadata } = require('../config/provinceMetadata');

test('province labels follow the updated simplified, traditional, and English rules', () => {
  const simplifiedLabels = getProvinceCodeLabels('zh-CN');
  const traditionalLabels = getProvinceCodeLabels('zh-TW');
  const englishLabels = getProvinceCodeLabels('en');

  assert.equal(simplifiedLabels['110000'], '北京市');
  assert.equal(simplifiedLabels['130000'], '河北省');
  assert.equal(simplifiedLabels['150000'], '内蒙古自治区');
  assert.equal(simplifiedLabels['710000'], '台湾省');
  assert.equal(simplifiedLabels['810000'], '香港特别行政区');

  assert.equal(traditionalLabels['110000'], '北京');
  assert.equal(traditionalLabels['130000'], '河北');
  assert.equal(traditionalLabels['150000'], '內蒙古');
  assert.equal(traditionalLabels['710000'], '臺灣');
  assert.equal(traditionalLabels['820000'], '澳門');

  assert.equal(englishLabels['110000'], 'Beijing');
  assert.equal(englishLabels['150000'], 'Inner Mongolia');
  assert.equal(englishLabels['710000'], 'Taiwan');
  assert.equal(englishLabels['810000'], 'Hong Kong');
});

test('form area options reuse the localized province display labels', () => {
  const simplifiedProvinces = Object.fromEntries(
    getAreaOptions('zh-CN').provinces.map((province) => [province.code, province.name])
  );
  const traditionalProvinces = Object.fromEntries(
    getAreaOptions('zh-TW').provinces.map((province) => [province.code, province.name])
  );

  assert.equal(simplifiedProvinces['130000'], '河北省');
  assert.equal(simplifiedProvinces['150000'], '内蒙古自治区');
  assert.equal(simplifiedProvinces['710000'], '台湾省');

  assert.equal(traditionalProvinces['130000'], '河北');
  assert.equal(traditionalProvinces['150000'], '內蒙古');
  assert.equal(traditionalProvinces['710000'], '臺灣');
});

test('cn geojson exposes multilingual province names for map rendering', () => {
  const taiwan = geojson.features.find((feature) => feature.properties.code === '710000');
  const innerMongolia = geojson.features.find((feature) => feature.properties.code === '150000');
  const hongKong = geojson.features.find((feature) => feature.properties.code === '810000');

  assert.ok(taiwan);
  assert.ok(innerMongolia);
  assert.ok(hongKong);

  assert.equal(taiwan.properties['name_zh-CN'], '台湾省');
  assert.equal(taiwan.properties['name_zh-TW'], '臺灣');
  assert.equal(taiwan.properties.name_en, 'Taiwan');
  assert.equal(taiwan.properties['fullname_zh-TW'], '臺灣');

  assert.equal(innerMongolia.properties['name_zh-CN'], '内蒙古自治区');
  assert.equal(innerMongolia.properties['name_zh-TW'], '內蒙古');
  assert.equal(innerMongolia.properties.fullname_en, 'Inner Mongolia Autonomous Region');

  assert.equal(hongKong.properties['name_zh-CN'], '香港特别行政区');
  assert.equal(hongKong.properties['name_zh-TW'], '香港');
  assert.equal(hongKong.properties.fullname_en, 'Hong Kong Special Administrative Region');
});

test('map province utils resolve province aliases across languages and legacy names', () => {
  const modulePath = path.resolve(__dirname, '../public/js/map_province_utils.js');
  const previousMetadata = global.PROVINCE_METADATA;

  global.PROVINCE_METADATA = getClientProvinceMetadata();
  delete require.cache[modulePath];

  const provinceUtils = require(modulePath);

  try {
    assert.equal(provinceUtils.resolveProvinceCode('北京市'), '110000');
    assert.equal(provinceUtils.resolveProvinceCode('Inner Mongolia Autonomous Region'), '150000');
    assert.equal(provinceUtils.resolveProvinceCode('臺灣（ROC）'), '710000');
    assert.equal(
      provinceUtils.getFeatureProvinceDisplayName({ properties: { code: '810000' } }, 'en'),
      'Hong Kong'
    );
    assert.equal(
      provinceUtils.getFeatureProvinceDisplayName({ properties: { code: '150000' } }, 'zh-TW'),
      '內蒙古'
    );
  } finally {
    if (typeof previousMetadata === 'undefined') {
      delete global.PROVINCE_METADATA;
    } else {
      global.PROVINCE_METADATA = previousMetadata;
    }
    delete require.cache[modulePath];
  }
});
