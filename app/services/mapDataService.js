const axios = require('axios');
const http = require('http');
const https = require('https');
const { getProvinceCodeLabels } = require('../../config/i18n');
const { isWorkersRuntime } = require('../../config/runtimeConfig');

// 地图数据缓存放在 service 层，避免每次请求都直打 Apps Script。
let cachedData = null;
let lastFetchTime = 0;
let inFlightRequest = null;
let lastForceRefreshTime = 0;
const cacheDurationMs = 300000;
// 即使用户手动点刷新，也给上游 Apps Script 一个冷却时间，避免被连续击穿。
const forceRefreshCooldownMs = 30000;
const upstreamRequestTimeoutMs = 10000;
const simplifiedProvinceLabels = getProvinceCodeLabels('zh-CN');
const legacyProvinceLabels = getProvinceCodeLabels('zh-TW');
const provinceAliasToLegacyName = buildProvinceAliasToLegacyNameMap();
let ProxyAgentConstructor = null;
let cachedProxyAgent = null;
let cachedIpv4HttpAgent = null;
let cachedIpv4HttpsAgent = null;

function buildProvinceAliasToLegacyNameMap() {
  const aliasMap = new Map();

  Object.keys(legacyProvinceLabels).forEach((code) => {
    const legacyName = legacyProvinceLabels[code];
    const simplifiedName = simplifiedProvinceLabels[code];

    [legacyName, simplifiedName].filter(Boolean).forEach((alias) => {
      aliasMap.set(alias, legacyName);
    });
  });

  return aliasMap;
}

function normalizeProvinceNameToLegacy(provinceName) {
  const normalizedProvinceName = String(provinceName || '').trim();

  if (!normalizedProvinceName) {
    return '';
  }

  return provinceAliasToLegacyName.get(normalizedProvinceName) || normalizedProvinceName;
}

function normalizeProvinceStatistics(items) {
  const mergedStatistics = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    const province = normalizeProvinceNameToLegacy(item && item.province);
    const count = Number(item && item.count);

    if (!province) {
      return;
    }

    if (!mergedStatistics.has(province)) {
      mergedStatistics.set(province, {
        ...item,
        province,
        count: Number.isFinite(count) ? count : 0
      });
      return;
    }

    const existingItem = mergedStatistics.get(province);
    existingItem.count += Number.isFinite(count) ? count : 0;
  });

  return [...mergedStatistics.values()];
}

function resolveNumericValue(...candidates) {
  for (const value of candidates) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  return null;
}

// 远端没有提供 last_synced 时，用当前抓取时间兜底，保证前端总能显示相对时间。
function resolveLastSyncedTimestamp(lastSynced, fallbackTimestamp) {
  const numericLastSynced = Number(lastSynced);
  return Number.isFinite(numericLastSynced) && numericLastSynced > 0 ? numericLastSynced : fallbackTimestamp;
}

// 优先使用服务端私有数据源；没有时再退回公开 map-data 接口。
function resolveMapDataSource({ googleScriptUrl, publicMapDataUrl }) {
  const dataSourceUrl = googleScriptUrl || publicMapDataUrl;

  if (!dataSourceUrl || dataSourceUrl === '/api/map-data') {
    throw new Error('未配置有效的地圖數據源');
  }

  return dataSourceUrl;
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

function getIpv4HttpAgent() {
  if (!cachedIpv4HttpAgent) {
    cachedIpv4HttpAgent = new http.Agent({ family: 4 });
  }

  return cachedIpv4HttpAgent;
}

function getIpv4HttpsAgent() {
  if (!cachedIpv4HttpsAgent) {
    cachedIpv4HttpsAgent = new https.Agent({ family: 4 });
  }

  return cachedIpv4HttpsAgent;
}

function createUpstreamStatusError(statusCode) {
  const error = new Error(`地圖數據源返回 ${statusCode}`);
  error.isUpstreamStatusError = true;
  error.statusCode = statusCode;
  return error;
}

function getRequestErrorDiagnostics(error) {
  const details = [];

  function collectDiagnostics(currentError) {
    if (!currentError || typeof currentError !== 'object') {
      return;
    }

    if (currentError.name) {
      details.push(`name=${currentError.name}`);
    }

    if (currentError.code) {
      details.push(`code=${currentError.code}`);
    }

    if (currentError.statusCode) {
      details.push(`status=${currentError.statusCode}`);
    }

    if (currentError.message) {
      details.push(`message=${currentError.message}`);
    }

    if (Array.isArray(currentError.errors)) {
      currentError.errors.forEach(collectDiagnostics);
    }

    if (currentError.cause && currentError.cause !== currentError) {
      collectDiagnostics(currentError.cause);
    }
  }

  collectDiagnostics(error);

  return [...new Set(details)].join(', ');
}

async function fetchJsonDirect(dataSourceUrl) {
  const response = await fetch(dataSourceUrl, {
    signal: AbortSignal.timeout(upstreamRequestTimeoutMs)
  });

  if (!response.ok) {
    throw createUpstreamStatusError(response.status);
  }

  return response.json();
}

async function fetchJsonWithAxios(dataSourceUrl, config) {
  const response = await axios.get(dataSourceUrl, {
    timeout: upstreamRequestTimeoutMs,
    responseType: 'json',
    validateStatus: () => true,
    ...config
  });

  if (response.status < 200 || response.status >= 300) {
    throw createUpstreamStatusError(response.status);
  }

  return response.data;
}

async function fetchJsonThroughProxy(dataSourceUrl) {
  const proxyAgent = getProxyAgent();

  return fetchJsonWithAxios(dataSourceUrl, {
    proxy: false,
    httpAgent: proxyAgent,
    httpsAgent: proxyAgent
  });
}

async function fetchJsonDirectIpv4(dataSourceUrl) {
  return fetchJsonWithAxios(dataSourceUrl, {
    proxy: false,
    httpAgent: getIpv4HttpAgent(),
    httpsAgent: getIpv4HttpsAgent()
  });
}

async function fetchMapPayloadFromSource(dataSourceUrl, { mapDataForceIpv4 = false } = {}) {
  const strategies = [];
  let lastError = null;
  const workersRuntime = isWorkersRuntime();
  const shouldUseDirectIpv4 = !workersRuntime && mapDataForceIpv4;

  if (!workersRuntime && hasProxyConfiguration()) {
    strategies.push({
      name: 'proxy-agent',
      request: () => fetchJsonThroughProxy(dataSourceUrl)
    });
  }

  if (shouldUseDirectIpv4) {
    strategies.push({
      name: 'direct-ipv4',
      request: () => fetchJsonDirectIpv4(dataSourceUrl)
    });
  } else {
    strategies.push({
      name: 'direct-fetch',
      request: () => fetchJsonDirect(dataSourceUrl)
    });
  }

  if (workersRuntime) {
    strategies.push({
      name: 'direct-fetch-retry',
      request: () => fetchJsonDirect(dataSourceUrl)
    });
  }

  const attemptDiagnostics = [];

  for (const strategy of strategies) {
    try {
      return await strategy.request();
    } catch (error) {
      lastError = error;

      if (error && error.isUpstreamStatusError) {
        throw error;
      }

      attemptDiagnostics.push(`${strategy.name}: ${getRequestErrorDiagnostics(error) || 'unknown error'}`);
    }
  }

  const finalError = new Error(`地圖數據源請求失敗：${attemptDiagnostics.join(' | ')}`);
  finalError.cause = lastError;
  throw finalError;
}

// Apps Script 可能返回数组，也可能返回 JSON 字符串，这里统一兜底。
function normalizeRawData(rawData) {
  if (Array.isArray(rawData)) {
    return rawData;
  }

  if (typeof rawData === 'string') {
    return JSON.parse(rawData);
  }

  throw new Error('預期收到陣列但得到其他類型');
}

// 对外 API 只暴露前端真正需要的字段，原始表格列不直接透出。
function cleanMapData(rawData) {
  return rawData
    .filter((item) => item && (item.lat || item['緯度']))
    // 同时兼容新字段名与历史中文列名，方便表结构渐进迁移。
    .map((item) => ({
      name: item.name || item['學校名稱'] || '未填寫名稱',
      addr: item.addr || item['學校地址'] || '無地址',
      province: normalizeProvinceNameToLegacy(item.province || item['省份'] || ''),
      prov: item.prov || item['區、縣'] || '',
      else: item.else || item['其他'] || '',
      lat: parseFloat(item.lat || item['緯度']),
      lng: parseFloat(item.lng || item['經度']),
      experience: item.experience || item['請問您在那裏都經歷了什麼？'] || '',
      HMaster: item.HMaster || item['校長名字'] || '',
      scandal: item.scandal || item['學校的醜聞'] || '',
      contact: item.contact || item['學校的聯繫方式'] || '',
      inputType: item.inputType || item['請問您是什麽身份？'] || ''
    }));
}

// 公开地图接口的主逻辑：读取远端数据、清洗、缓存、失败时尽量回退到缓存。
async function getMapData({ forceRefresh = false, googleScriptUrl, mapDataForceIpv4 = false, publicMapDataUrl }) {
  const now = Date.now();

  // 常规请求优先命中缓存，避免每次页面访问都走网络。
  if (!forceRefresh && cachedData && now - lastFetchTime < cacheDurationMs) {
    return cachedData;
  }

  // 强制刷新也受冷却保护，避免多个用户同时点刷新时频繁命中上游。
  if (forceRefresh && cachedData && now - lastForceRefreshTime < forceRefreshCooldownMs) {
    return cachedData;
  }

  // 并发请求复用同一个 Promise，避免同一时间发出多次相同抓取。
  if (inFlightRequest) {
    return cachedData && !forceRefresh ? cachedData : inFlightRequest;
  }

  if (forceRefresh) {
    lastForceRefreshTime = now;
  }

  const request = (async () => {
    try {
      const dataSourceUrl = resolveMapDataSource({ googleScriptUrl, publicMapDataUrl });
      const responseBody = await fetchMapPayloadFromSource(dataSourceUrl, {
        mapDataForceIpv4
      });
      const rawData = normalizeRawData(responseBody.data);
      const avgAge = resolveNumericValue(responseBody.avg_age);
      const schoolNum = resolveNumericValue(responseBody.schoolNum, responseBody.SchoolNum);
      const formNum = resolveNumericValue(responseBody.formNum, responseBody.FormNum);
      const finalResponse = {
        avg_age: Number.isFinite(avgAge) ? avgAge : 0,//受害者平均年齡
        schoolNum: Number.isFinite(schoolNum) ? schoolNum : 0,//學校數量
        formNum: Number.isFinite(formNum) ? formNum : 0,//表單數量
        last_synced: resolveLastSyncedTimestamp(responseBody.last_synced, now),//上一次更新時間
        statistics: normalizeProvinceStatistics(responseBody.statistics),//各省扭轉幾個數量
        statisticsForm: normalizeProvinceStatistics(responseBody.statisticsForm),//各省收到的表單數量
        data: cleanMapData(rawData)
      };

      cachedData = finalResponse;
      lastFetchTime = now;

      return finalResponse;
    } catch (error) {
      // 抓取失败但本地仍有旧缓存时，优先保服务可用而不是直接报错。
      if (cachedData) {
        return cachedData;
      }

      if (error instanceof SyntaxError) {
        throw new Error('數據解析失敗');
      }

      throw error;
    }
  })();

  inFlightRequest = request;

  try {
    return await request;
  } finally {
    if (inFlightRequest === request) {
      inFlightRequest = null;
    }
  }
}

module.exports = {
  getMapData,
  normalizeProvinceNameToLegacy,
  resolveLastSyncedTimestamp,
  resetMapDataCache() {
    cachedData = null;
    inFlightRequest = null;
    lastFetchTime = 0;
    lastForceRefreshTime = 0;
    cachedProxyAgent = null;
    cachedIpv4HttpAgent = null;
    cachedIpv4HttpsAgent = null;
  },
  getRequestErrorDiagnostics,
  hasProxyConfiguration,
  fetchMapPayloadFromSource
};
