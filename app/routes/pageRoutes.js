const express = require('express');
const fs = require('fs');
const path = require('path');
const { getAreaOptions } = require('../../config/areaSelector');
const { getLocalizedFormRules, getLocalizedIdentityOptions, getLocalizedSexOptions } = require('../../config/formConfig');
const { renderBlogArticleHtml, translateBlogListEntries } = require('../services/blogTranslationService');
const { loadFriends } = require('../services/friendsService');
const { generateRobotsTxt } = require('../services/robotsService');
const { generateSitemapXml } = require('../services/sitemapService');
const { paths } = require('../../config/fileConfig');

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
function createPageRoutes({ apiUrl, debugMod, siteUrl, title }) {
  const router = express.Router();

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
  router.get('/', (req, res) => {
    res.render('index', {
      title: req.t('pageTitles.home', { title }),
      apiUrl
    });
  });

  // 表單頁：把地区联动数据和前端校验规则一并下发到模板。
  router.get('/form', (req, res) => {
    const t = req.t;
    res.render('form', {
      title: t('pageTitles.form', { title }),
      apiUrl,
      areaOptions: getAreaOptions(req.lang),
      formRules: getLocalizedFormRules(t),
      identityOptions: getLocalizedIdentityOptions(t),
      sexOptions: getLocalizedSexOptions(t)
    });
  });

  // 地圖頁：展示汇总后的机构数据。
  router.get('/map', (req, res) => {
    res.render('map', {
      title: req.t('pageTitles.map', { title }),
      apiUrl,
      QTag: req.query.inputType || ''
    });
  });

  // 關於頁：这里额外读取 friends.json 作为友链数据源。
  router.get('/aboutus', async (req, res) => {
    res.render('about', {
      title: req.t('pageTitles.about', { title }),
      friends: await loadFriends({
        language: req.lang,
        t: req.t
      }),
      apiUrl
    });
  });

  // 預留的調試頁面入口。
  router.get('/debug', (req, res) => {
    if (debugMod !== 'true') {
      return res.status(404).send('Not Found');
    }

    res.render('debug', {
      apiUrl,
      debugMode: debugMod,
      title: `Debug|${title || req.t('common.siteName')}`
    });
  });

  router.get('/blog', async (req,res) => {
    const SavedTags = JSON.parse(fs.readFileSync(paths.blogData, 'utf-8'));
    
    const QTag = req.query.tag;//現在頁面的query tag是什麽
    let filteredPort = SavedTags.Data;//篩選的數據

    const AllTags = SavedTags.TagList;

    if(QTag) filteredPort = SavedTags.Data.filter(p => p.tagid && p.tagid.includes(QTag));//篩選SavedTags裏面的tagid是Tag的

    const localizedEntries = await translateBlogListEntries(filteredPort, {
      targetLanguage: req.lang
    });

    res.render('blog', {
      SavedTags:localizedEntries,//數據（已篩選）
      QTag,//現在的query
      AllTags,//所有tag的數據
      apiUrl,
      title: req.t('pageTitles.blog', { title })
    })
  })

  router.get('/port/:id', async (req, res) => {
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
