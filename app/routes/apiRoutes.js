const express = require('express');
const cors = require('cors');
const { createRateLimiter } = require('../../config/security');
const {
  getLocalizedCityOptionsForProvince,
  getLocalizedCountyOptionsForCity
} = require('../services/areaOptionsService');
const { logAuditEvent } = require('../services/auditLogService');
const { getMapData } = require('../services/mapDataService');
const { translateDetailItems } = require('../services/textTranslationService');

// API 路由只负责把 service 层返回的数据转成 HTTP 响应。
function createApiRoutes({
  googleScriptUrl,
  mapDataForceIpv4,
  mapReadRateLimitMax,
  publicMapDataUrl,
  rateLimitRedisUrl
}) {
  const router = express.Router();
  const publicMapDataCors = cors({
    origin: '*',
    methods: ['GET'],
    maxAge: 86400,
    optionsSuccessStatus: 204
  });
  const mapReadRateLimiter = createRateLimiter({
    windowMs: 5 * 60 * 1000,
    max: mapReadRateLimitMax,
    redisUrl: rateLimitRedisUrl,
    storePrefix: 'map-read-rate-limit:',
    getMessage(req) {
      return req.t('server.tooManyRequests');
    },
    onLimit(req, status, message) {
      logAuditEvent(req, 'map_read_rate_limited', { status, message });
    },
    sendLimitResponse(_req, res, statusCode, message) {
      return res.status(statusCode).json({ error: message });
    }
  });
  const refreshRateLimiter = createRateLimiter({
    windowMs: 5 * 60 * 1000,
    max: 3,
    redisUrl: rateLimitRedisUrl,
    storePrefix: 'map-refresh-rate-limit:',
    skip(req) {
      return !shouldForceRefresh(req);
    },
    getMessage(req) {
      return req.t('server.tooManyRequests');
    },
    sendLimitResponse(_req, res, statusCode, message) {
      return res.status(statusCode).json({ error: message });
    }
  });
  const translateRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 80,
    redisUrl: rateLimitRedisUrl,
    storePrefix: 'translate-rate-limit:',
    getMessage(req) {
      return req.t('server.tooManyRequests');
    },
    sendLimitResponse(_req, res, statusCode, message) {
      return res.status(statusCode).json({ error: message });
    }
  });

  function shouldForceRefresh(req) {
    const value = req.query.refresh;
    return value === '1' || value === 'true';
  }

  // 对外公开的地图数据接口。
  router.options('/api/map-data', publicMapDataCors);

  router.get('/api/area-options', async (req, res) => {
    try {
      const provinceCode = typeof req.query.provinceCode === 'string' ? req.query.provinceCode.trim() : '';
      const cityCode = typeof req.query.cityCode === 'string' ? req.query.cityCode.trim() : '';

      if (cityCode) {
        return res.json({
          options: await getLocalizedCountyOptionsForCity(cityCode, req.lang)
        });
      }

      if (provinceCode) {
        return res.json({
          options: await getLocalizedCityOptionsForProvince(provinceCode, req.lang)
        });
      }

      return res.json({ options: [] });
    } catch (error) {
      console.error('Area options API Error:', error.message);
      return res.status(500).json({ error: req.t('server.areaOptionsUnavailable') });
    }
  });

  router.get('/api/map-data', publicMapDataCors, mapReadRateLimiter, refreshRateLimiter, async (req, res) => {
    try {
      const mapData = await getMapData({
        forceRefresh: shouldForceRefresh(req),
        googleScriptUrl,
        mapDataForceIpv4,
        publicMapDataUrl
      });
      return res.json(mapData);
    } catch (error) {
      console.error('API Error:', error.message);
      return res.status(500).json({ error: req.t('server.mapDataUnavailable') });
    }
  });

  router.post('/api/translate-text', translateRateLimiter, async (req, res) => {
    try {
      const items = Array.isArray(req.body.items) ? req.body.items : [];
      const targetLanguage = req.body.targetLanguage;

      const validItems = items
        .map((item) => ({
          fieldKey: typeof item.fieldKey === 'string' ? item.fieldKey : '',
          text: typeof item.text === 'string' ? item.text.trim() : ''
        }))
        .filter((item) => item.fieldKey && item.text)
        .slice(0, 6);

      if (validItems.length === 0) {
        return res.json({ translations: [] });
      }

      const translations = await translateDetailItems({
        items: validItems,
        targetLanguage
      });

      return res.json({ translations });
    } catch (error) {
      console.error('Translation API Error:', error.message);
      return res.status(500).json({ error: req.t('map.list.translationUnavailable') });
    }
  });

  return router;
}

module.exports = createApiRoutes;
