const express = require('express');
const fs = require('fs');
const path = require('path');
const { getAreaOptions } = require('../../config/areaSelector');
const { getLocalizedInstitutionCorrectionRules } = require('../../config/institutionCorrectionConfig');
const { getClientProvinceMetadata } = require('../../config/provinceMetadata');
const {
  getLocalizedFormRules,
  getLocalizedIdentityOptions,
  getLocalizedOtherSexTypeOptions,
  getLocalizedSexOptions
} = require('../../config/formConfig');
const { renderBlogArticleHtml, translateBlogListEntries } = require('../services/blogTranslationService');
const { loadFriends } = require('../services/friendsService');
const { issueFormProtectionToken } = require('../services/formProtectionService');
const { generateRobotsTxt } = require('../services/robotsService');
const { generateSitemapXml } = require('../services/sitemapService');
const { logAuditEvent } = require('../services/auditLogService');
const { paths } = require('../../config/fileConfig');
const {
  applySensitivePageHeaders,
  createRateLimiter,
  sensitiveRobotsPolicy
} = require('../../config/security');
const { buildGoogleFormPrefillUrl } = require('../services/formService');

function translateWithFallback(t, key, fallbackValue = '') {
  if (typeof t !== 'function') {
    return fallbackValue;
  }

  const translatedValue = t(key);
  return translatedValue && translatedValue !== key ? translatedValue : fallbackValue;
}

function localizeBlogLanguageLabel(value, t) {
  const normalizedValue = String(value || '').trim();
  const languageKeyByLabel = {
    English: 'blog.articleLanguages.en',
    'zh-CN': 'blog.articleLanguages.zhCN',
    'zh-TW': 'blog.articleLanguages.zhTW',
    '简体中文': 'blog.articleLanguages.zhCN',
    '簡體中文': 'blog.articleLanguages.zhCN',
    '正體中文': 'blog.articleLanguages.zhTW',
    '繁體中文': 'blog.articleLanguages.zhTW',
    '英文': 'blog.articleLanguages.en'
  };
  const languageKey = languageKeyByLabel[normalizedValue];

  if (!languageKey) {
    return normalizedValue;
  }

  return translateWithFallback(t, languageKey, normalizedValue);
}

function localizeBlogCreationDate(value, language) {
  const rawValue = String(value || '').trim();
  if (language !== 'en') {
    return rawValue;
  }

  const dateMatch = rawValue.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (!dateMatch) {
    return rawValue;
  }

  const [, year, month, day] = dateMatch;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

function localizeBlogTagMap(tagMap, t) {
  return Object.fromEntries(
    Object.entries(tagMap || {}).map(([id, label]) => [
      id,
      translateWithFallback(t, `blog.tags.${id}`, label)
    ])
  );
}

function resolveMarkdownPath(blogDirectory, articleId) {
  if (
    typeof articleId !== 'string'
    || articleId.includes('\0')
    || articleId.includes('/')
    || articleId.includes('\\')
  ) {
    return null;
  }

  const normalizedBlogDirectory = path.resolve(blogDirectory);
  const markdownPath = path.resolve(normalizedBlogDirectory, `${articleId}.md`);

  if (!markdownPath.startsWith(`${normalizedBlogDirectory}${path.sep}`)) {
    return null;
  }

  return markdownPath;
}

function buildDebugSubmitErrorPreviewUrl(googleFormUrl) {
  const samplePayload = new URLSearchParams({
    'entry.842223433': '11',
    'entry.1422578992': '男',
    'entry.1766160152': '福建',
    'entry.402227428': '區，縣',
    'entry.5034928': '學校',
    'entry.1390240202': '地址',
    'entry.1344969670': '2026-04-21',
    'entry.129670533': '2026-04-25',
    'entry.578287646': '經歷',
    'entry.1533497153': '校長',
    'entry.883193772': '聯繫方式',
    'entry.1400127416': '醜聞',
    'entry.2022959936': '其他',
    'entry.500021634': '受害者本人'
  }).toString();

  return buildGoogleFormPrefillUrl(googleFormUrl, samplePayload);
}

function redactGoogleFormUrlForDebug(googleFormUrl) {
  const normalizedUrl = String(googleFormUrl || '').trim();

  if (!normalizedUrl) {
    return '';
  }

  return normalizedUrl.replace(/\/d\/e\/([^/]+)\//, (_match, formId) => {
    const visiblePrefix = formId.slice(0, 4);
    const visibleSuffix = formId.slice(-4);
    return `/d/e/${visiblePrefix}...${visibleSuffix}/`;
  });
}

function redactGoogleScriptUrlForDebug(googleScriptUrl) {
  const normalizedUrl = String(googleScriptUrl || '').trim();

  if (!normalizedUrl) {
    return '';
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    const redactedPathname = parsedUrl.pathname.replace(/\/s\/([^/]+)\/exec/i, (_match, deploymentId) => {
      const visiblePrefix = deploymentId.slice(0, 4);
      const visibleSuffix = deploymentId.slice(-4);
      return `/s/${visiblePrefix}...${visibleSuffix}/exec`;
    });

    return `${parsedUrl.origin}${redactedPathname}`;
  } catch (_error) {
    return normalizedUrl.replace(/\/s\/([^/]+)\/exec/i, (_match, deploymentId) => {
      const visiblePrefix = deploymentId.slice(0, 4);
      const visibleSuffix = deploymentId.slice(-4);
      return `/s/${visiblePrefix}...${visibleSuffix}/exec`;
    });
  }
}

function redactRedisUrlForDebug(redisUrl) {
  const normalizedUrl = String(redisUrl || '').trim();

  if (!normalizedUrl) {
    return '';
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    const host = parsedUrl.hostname || '';
    const port = parsedUrl.port ? `:${parsedUrl.port}` : '';
    const pathname = parsedUrl.pathname || '';
    return `${parsedUrl.protocol}//${host}${port}${pathname}`;
  } catch (_error) {
    return normalizedUrl.replace(/\/\/[^@/]+@/, '//');
  }
}

function buildDebugSections({
  apiUrl,
  assetVersion,
  debugMod,
  formDryRun,
  formProtectionMaxAgeMs,
  formProtectionMinFillMs,
  formProtectionSecretConfigured,
  googleFormUrl,
  googleScriptUrl,
  isWorkersRuntime,
  maintenanceMode,
  maintenanceRetryAfterSeconds,
  mapDataNodeTransportOverrides,
  mapDataUpstreamTimeoutMs,
  mapReadRateLimitMax,
  pageReadRateLimitMax,
  publicMapDataUrl,
  rateLimitRedisUrl,
  requestPath,
  siteUrl,
  submitRateLimitMax,
  t,
  title,
  translationProviderConfigured,
  translationProviderTimeoutMs,
  trustProxy
}) {
  const statusValue = {
    configured: t('debug.values.configured'),
    derived: t('debug.values.derived'),
    disabled: t('debug.values.disabled'),
    enabled: t('debug.values.enabled'),
    explicit: t('debug.values.explicit'),
    memoryOnly: t('debug.values.memoryOnly'),
    missing: t('debug.values.missing'),
    node: t('debug.values.node'),
    publicFallbackOnly: t('debug.values.publicFallbackOnly'),
    workers: t('debug.values.workers')
  };

  return [
    {
      title: t('debug.sections.request'),
      items: [
        { label: t('debug.labels.language'), value: requestPath.language },
        { label: t('debug.labels.requestPath'), value: requestPath.path, multiline: true },
        { label: t('debug.labels.runtime'), value: isWorkersRuntime ? statusValue.workers : statusValue.node },
        { label: t('debug.labels.assetVersion'), value: assetVersion || t('debug.values.unknown') }
      ]
    },
    {
      title: t('debug.sections.site'),
      items: [
        { label: t('debug.labels.siteTitle'), value: title },
        { label: t('debug.labels.siteUrl'), value: siteUrl, wide: true, multiline: true },
        { label: t('debug.labels.apiUrl'), value: apiUrl },
        { label: t('debug.labels.trustProxy'), value: String(trustProxy) },
        {
          label: t('debug.labels.debugMode'),
          value: debugMod === 'true' ? statusValue.enabled : statusValue.disabled,
          badgeTone: debugMod === 'true' ? 'positive' : 'neutral'
        },
        {
          label: t('debug.labels.formDryRun'),
          value: formDryRun ? statusValue.enabled : statusValue.disabled,
          badgeTone: formDryRun ? 'positive' : 'neutral'
        },
        {
          label: t('debug.labels.maintenanceMode'),
          value: maintenanceMode ? statusValue.enabled : statusValue.disabled,
          badgeTone: maintenanceMode ? 'caution' : 'neutral',
          hint: t('debug.values.seconds', { count: maintenanceRetryAfterSeconds })
        },
        {
          label: t('debug.labels.mapNodeTransport'),
          value: mapDataNodeTransportOverrides ? statusValue.enabled : statusValue.disabled,
          badgeTone: mapDataNodeTransportOverrides ? 'positive' : 'neutral'
        }
      ]
    },
    {
      title: t('debug.sections.integrations'),
      items: [
        {
          label: t('debug.labels.googleForm'),
          value: googleFormUrl ? statusValue.configured : statusValue.missing,
          badgeTone: googleFormUrl ? 'positive' : 'caution',
          hint: redactGoogleFormUrlForDebug(googleFormUrl)
        },
        {
          label: t('debug.labels.googleScript'),
          value: googleScriptUrl ? statusValue.configured : statusValue.publicFallbackOnly,
          badgeTone: googleScriptUrl ? 'positive' : 'caution',
          hint: googleScriptUrl ? redactGoogleScriptUrlForDebug(googleScriptUrl) : ''
        },
        {
          label: t('debug.labels.publicMapDataUrl'),
          value: publicMapDataUrl,
          wide: true,
          multiline: true
        },
        {
          label: t('debug.labels.translationProvider'),
          value: translationProviderConfigured ? statusValue.configured : statusValue.missing,
          badgeTone: translationProviderConfigured ? 'positive' : 'caution',
          hint: t('debug.values.milliseconds', { count: translationProviderTimeoutMs })
        },
        {
          label: t('debug.labels.redisRateLimit'),
          value: rateLimitRedisUrl ? statusValue.configured : statusValue.memoryOnly,
          badgeTone: rateLimitRedisUrl ? 'positive' : 'caution',
          hint: redactRedisUrlForDebug(rateLimitRedisUrl)
        },
        {
          label: t('debug.labels.formProtectionSecret'),
          value: formProtectionSecretConfigured ? statusValue.explicit : statusValue.derived,
          badgeTone: formProtectionSecretConfigured ? 'positive' : 'caution'
        }
      ]
    },
    {
      title: t('debug.sections.limits'),
      items: [
        {
          label: t('debug.labels.pageReadLimit'),
          value: t('debug.values.limitWindow', { count: pageReadRateLimitMax, minutes: 5 })
        },
        {
          label: t('debug.labels.mapReadLimit'),
          value: t('debug.values.limitWindow', { count: mapReadRateLimitMax, minutes: 5 })
        },
        {
          label: t('debug.labels.submitRateLimit'),
          value: t('debug.values.limitWindow', { count: submitRateLimitMax, minutes: 15 })
        },
        {
          label: t('debug.labels.mapUpstreamTimeout'),
          value: t('debug.values.milliseconds', { count: mapDataUpstreamTimeoutMs })
        },
        {
          label: t('debug.labels.translationTimeout'),
          value: t('debug.values.milliseconds', { count: translationProviderTimeoutMs })
        },
        {
          label: t('debug.labels.minFillMs'),
          value: t('debug.values.milliseconds', { count: formProtectionMinFillMs })
        },
        {
          label: t('debug.labels.maxAgeMs'),
          value: t('debug.values.milliseconds', { count: formProtectionMaxAgeMs })
        }
      ]
    }
  ];
}

// 页面路由只负责渲染模板，不承载表单提交或 API 逻辑。
function createPageRoutes({
  apiUrl,
  debugMod,
  formDryRun,
  formProtectionMaxAgeMs,
  formProtectionMinFillMs,
  formProtectionSecret,
  formProtectionSecretConfigured,
  googleFormUrl,
  googleScriptUrl,
  isWorkersRuntime,
  maintenanceMode,
  maintenanceRetryAfterSeconds,
  mapDataNodeTransportOverrides,
  mapDataUpstreamTimeoutMs,
  mapReadRateLimitMax,
  pageReadRateLimitMax,
  publicMapDataUrl,
  rateLimitRedisUrl,
  siteUrl,
  submitRateLimitMax,
  title,
  translationProviderConfigured,
  translationProviderTimeoutMs,
  trustProxy
}) {
  const router = express.Router();
  const pageReadLimiter = createRateLimiter({
    windowMs: 5 * 60 * 1000,
    max: pageReadRateLimitMax,
    redisUrl: rateLimitRedisUrl,
    storePrefix: 'page-read-rate-limit:',
    getMessage(req) {
      return req.t('server.tooManyRequests');
    },
    onLimit(req, status, message) {
      logAuditEvent(req, 'page_read_rate_limited', { status, message });
    }
  });

  router.get('/robots.txt', (_req, res) => {
    res
      .type('text/plain')
      .set('Cache-Control', 'public, max-age=300')
      .send(generateRobotsTxt(siteUrl));
  });

  router.get('/sitemap.xml', (_req, res) => {
    const xml = generateSitemapXml({
      blogDataPath: paths.blogData,
      blogDirectory: paths.blog,
      siteUrl
    });

    res
      .type('application/xml')
      .set('Cache-Control', 'public, max-age=300')
      .send(xml);
  });

  // 首頁：项目导航入口。
  router.get('/', pageReadLimiter, (req, res) => {
    res.render('index', {
      title: req.t('pageTitles.home', { title }),
      apiUrl
    });
  });

  // 表單頁：把地区联动数据和前端校验规则一并下发到模板。
  router.get('/form', pageReadLimiter, (req, res) => {
    const t = req.t;
    const { provinces } = getAreaOptions(req.lang);
    applySensitivePageHeaders(res);
    res.render('form', {
      title: t('pageTitles.form', { title }),
      apiUrl,
      areaOptions: { provinces },
      formProtectionToken: issueFormProtectionToken({ secret: formProtectionSecret }),
      formRules: getLocalizedFormRules(t),
      identityOptions: getLocalizedIdentityOptions(t),
      otherSexTypeOptions: getLocalizedOtherSexTypeOptions(t),
      pageRobots: sensitiveRobotsPolicy,
      sexOptions: getLocalizedSexOptions(t)
    });
  });

  router.get('/map/correction', pageReadLimiter, (req, res) => {
    const t = req.t;
    const { provinces } = getAreaOptions(req.lang);

    applySensitivePageHeaders(res);
    res.render('institution_correction', {
      title: t('pageTitles.institutionCorrection', { title }),
      apiUrl,
      areaOptions: { provinces },
      formProtectionToken: issueFormProtectionToken({ secret: formProtectionSecret }),
      institutionCorrectionRules: getLocalizedInstitutionCorrectionRules(t),
      pageRobots: sensitiveRobotsPolicy
    });
  });

  // 地圖頁：展示汇总后的机构数据。
  router.get('/map', pageReadLimiter, (req, res) => {
    res.render('map', {
      title: req.t('pageTitles.map', { title }),
      apiUrl,
      QTag: req.query.inputType || '',
      provinceMetadata: getClientProvinceMetadata()
    });
  });

  router.get('/map/record/:recordSlug', pageReadLimiter, (req, res) => {
    res.render('map_record', {
      title: req.t('pageTitles.mapRecord', { title }),
      apiUrl,
      recordSlug: req.params.recordSlug || ''
    });
  });

  // 關於頁：这里额外读取 friends.json 作为友链数据源。
  router.get('/aboutus', pageReadLimiter, async (req, res) => {
    const friendsData = await loadFriends({
      language: req.lang,
      t: req.t
    });
    res.render('about', {
      title: req.t('pageTitles.about', { title }),
      friends: friendsData,
      apiUrl
    });
  });

  router.get('/privacy', pageReadLimiter, (req, res) => {
    res.render('privacy', {
      title: req.t('pageTitles.privacy', { title }),
      apiUrl
    });
  });

  // 預留的調試頁面入口。
  router.get('/debug', pageReadLimiter, (req, res) => {
    if (debugMod !== 'true') {
      return res.status(404).send(req.t('common.notFound'));
    }

    res.render('debug', {
      apiUrl,
      debugSections: buildDebugSections({
        apiUrl,
        assetVersion: req.app.locals.assetVersion,
        debugMod,
        formDryRun,
        formProtectionMaxAgeMs,
        formProtectionMinFillMs,
        formProtectionSecretConfigured,
        googleFormUrl,
        googleScriptUrl,
        isWorkersRuntime,
        maintenanceMode,
        maintenanceRetryAfterSeconds,
        mapDataNodeTransportOverrides,
        mapDataUpstreamTimeoutMs,
        mapReadRateLimitMax,
        pageReadRateLimitMax,
        publicMapDataUrl,
        rateLimitRedisUrl,
        requestPath: {
          language: req.lang,
          path: req.originalUrl
        },
        siteUrl,
        submitRateLimitMax,
        t: req.t,
        title,
        translationProviderConfigured,
        translationProviderTimeoutMs,
        trustProxy
      }),
      debugMode: debugMod,
      submitErrorPreviewUrl: '/debug/submit-error',
      title: req.t('pageTitles.debug', { title })
    });
  });

  router.get('/debug/submit-error', pageReadLimiter, (req, res) => {
    if (debugMod !== 'true') {
      return res.status(404).send(req.t('common.notFound'));
    }

    applySensitivePageHeaders(res);
    res.render('submit_error', {
      fallbackUrl: buildDebugSubmitErrorPreviewUrl(googleFormUrl),
      pageRobots: sensitiveRobotsPolicy,
      title: req.t('pageTitles.submitError', { title })
    });
  });

  router.get('/blog', pageReadLimiter, async (req,res) => {
    const SavedTags = JSON.parse(fs.readFileSync(paths.blogData, 'utf-8'));
    
    const QTag = req.query.tag;//現在頁面的query tag是什麽
    let filteredPort = SavedTags.Data;//篩選的數據

    const AllTags = SavedTags.TagList;

    if(QTag) filteredPort = SavedTags.Data.filter(p => p.tagid && p.tagid.includes(QTag));//篩選SavedTags裏面的tagid是Tag的

    const localizedEntries = await translateBlogListEntries(filteredPort, {
      targetLanguage: req.lang
    });
    const localizedTags = localizeBlogTagMap(AllTags, req.t);
    const localizedEntriesWithMeta = localizedEntries.map((entry) => ({
      ...entry,
      localizedCreationDate: localizeBlogCreationDate(entry.CreationDate, req.lang),
      localizedLanguage: localizeBlogLanguageLabel(entry.Language, req.t)
    }));

    res.render('blog', {
      SavedTags: localizedEntriesWithMeta,//數據（已篩選）
      AllTags: localizedTags,//所有tag的數據
      apiUrl,
      title: req.t('pageTitles.blog', { title })
    })
  })

  router.get('/port/:id', pageReadLimiter, async (req, res) => {
    const mdName = req.params.id;
    // 文章详情必须限制在 blog 目录内读取，避免利用 id 做路径穿越。
    const mdPath = resolveMarkdownPath(paths.blog, mdName);
    
    if (!mdPath || !fs.existsSync(mdPath)) {
      return res.status(404).send(req.t('blog.articleNotFound'));
    }
    
    const content = fs.readFileSync(mdPath, 'utf-8');
    const rawHtml = await renderBlogArticleHtml(content, {
      targetLanguage: req.lang
    });
    
    res.render('blogs', {
      apiUrl,
      reports: [{ html: rawHtml }],
      title: req.t('pageTitles.article', {
        articleTitle: mdName,
        title
      })
    });
  });

  return router;
}

module.exports = createPageRoutes;
