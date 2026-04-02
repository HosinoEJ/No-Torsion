const express = require('express');
const { getMapData } = require('../services/mapDataService');
const { translateDetailItems } = require('../services/textTranslationService');

// API 路由只负责把 service 层返回的数据转成 HTTP 响应。
function createApiRoutes({ googleScriptUrl, publicMapDataUrl }) {
  const router = express.Router();

  function shouldForceRefresh(req) {
    const value = req.query.refresh;
    return value === '1' || value === 'true';
  }

  // 对外公开的地图数据接口。
  router.get('/api/map-data', async (req, res) => {
    try {
      const mapData = await getMapData({
        forceRefresh: shouldForceRefresh(req),
        googleScriptUrl,
        publicMapDataUrl
      });
      return res.json(mapData);
    } catch (error) {
      console.error('API Error:', error.message);
      return res.status(500).json({ error: req.t('server.mapDataUnavailable') });
    }
  });

  router.post('/api/translate-text', async (req, res) => {
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
