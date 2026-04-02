// 地图数据缓存放在 service 层，避免每次请求都直打 Apps Script。
let cachedData = null;
let lastFetchTime = 0;
const cacheDurationMs = 300000;

function resolveLastSyncedTimestamp(lastSynced, fallbackTimestamp) {
  const numericLastSynced = Number(lastSynced);
  return Number.isFinite(numericLastSynced) && numericLastSynced > 0 ? numericLastSynced : fallbackTimestamp;
}

function resolveMapDataSource({ googleScriptUrl, publicMapDataUrl }) {
  const dataSourceUrl = googleScriptUrl || publicMapDataUrl;

  if (!dataSourceUrl || dataSourceUrl === '/api/map-data') {
    throw new Error('未配置有效的地圖數據源');
  }

  return dataSourceUrl;
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
    .map((item) => ({
      name: item.name || item['學校名稱'] || '未填寫名稱',
      addr: item.addr || item['學校地址'] || '無地址',
      province: item.province || item['省份'] || '',
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
async function getMapData({ forceRefresh = false, googleScriptUrl, publicMapDataUrl }) {
  const now = Date.now();

  if (!forceRefresh && cachedData && now - lastFetchTime < cacheDurationMs) {
    return cachedData;
  }

  try {
    const dataSourceUrl = resolveMapDataSource({ googleScriptUrl, publicMapDataUrl });
    const response = await fetch(dataSourceUrl, {
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`地圖數據源返回 ${response.status}`);
    }

    const responseBody = await response.json();
    const rawData = normalizeRawData(responseBody.data);
    const avgAge = Number(responseBody.avg_age);
    const finalResponse = {
      avg_age: Number.isFinite(avgAge) ? avgAge : 0,
      last_synced: resolveLastSyncedTimestamp(responseBody.last_synced, now),
      statistics: Array.isArray(responseBody.statistics) ? responseBody.statistics : [],
      data: cleanMapData(rawData)
    };

    cachedData = finalResponse;
    lastFetchTime = now;

    return finalResponse;
  } catch (error) {
    if (cachedData) {
      return cachedData;
    }

    if (error instanceof SyntaxError) {
      throw new Error('數據解析失敗');
    }

    throw error;
  }
}

module.exports = {
  getMapData,
  resolveLastSyncedTimestamp,
  resetMapDataCache() {
    cachedData = null;
    lastFetchTime = 0;
  }
};
