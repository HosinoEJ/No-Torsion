const express = require('express');
const fs = require('fs');
const path = require('path');
const { getAreaOptions } = require('../../config/areaSelector');
const { getLocalizedFormRules, getLocalizedIdentityOptions, getLocalizedSexOptions } = require('../../config/formConfig');
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

// 页面路由只负责渲染模板，不承载表单提交或 API 逻辑。
function createPageRoutes({
  apiUrl,
  debugMod,
  formProtectionSecret,
  pageReadRateLimitMax,
  rateLimitRedisUrl,
  siteUrl,
  title
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
      pageRobots: sensitiveRobotsPolicy,
      sexOptions: getLocalizedSexOptions(t)
    });
  });

  // 地圖頁：展示汇总后的机构数据。
  router.get('/map', pageReadLimiter, (req, res) => {
    res.render('map', {
      title: req.t('pageTitles.map', { title }),
      apiUrl,
      QTag: req.query.inputType || ''
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
      debugMode: debugMod,
      title: req.t('pageTitles.debug', { title })
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
      QTag,//現在的query
      AllTags: localizedTags,//所有tag的數據
      apiUrl,
      title: req.t('pageTitles.blog', { title })
    })
  })

  router.get('/port/:id', pageReadLimiter, async (req, res) => {
    const mdName = req.params.id;
    const mdPath = resolveMarkdownPath(paths.blog, mdName);
    
    if (!mdPath || !fs.existsSync(mdPath)) {
      return res.status(404).send(req.t('blog.articleNotFound'));
    }
    
    const content = fs.readFileSync(mdPath, 'utf-8');
    const [language, time, ...titleArr] = mdName.split('.');
    const title_B = mdName;
    const rawHtml = await renderBlogArticleHtml(content, {
      targetLanguage: req.lang
    });
    
    const report = {
      language, 
      time, 
      title,
      html: rawHtml
    };
    
    res.render('blogs', {
      apiUrl,
      reports: [report],
      title: req.t('pageTitles.article', {
        articleTitle: title_B,
        title
      })
    });
  });

  return router;
}

module.exports = createPageRoutes;
