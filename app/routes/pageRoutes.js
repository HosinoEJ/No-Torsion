const express = require('express');
const fs = require('fs');
const path = require('path');
const marked = require('marked');
const { getAreaOptions } = require('../../config/areaSelector');
const { getLocalizedFormRules, getLocalizedIdentityOptions, getLocalizedSexOptions } = require('../../config/formConfig');
const { loadFriends } = require('../services/friendsService');
const { paths } = require('../../config/fileConfig');
// 页面路由只负责渲染模板，不承载表单提交或 API 逻辑。
function createPageRoutes({ apiUrl, title }) {
  const router = express.Router();

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
  router.get('/aboutus', (req, res) => {
    res.render('about', {
      title: req.t('pageTitles.about', { title }),
      friends: loadFriends(req.t),
      apiUrl
    });
  });

  // 預留的調試頁面入口。
  router.get('/debug', (req, res) => {
    res.render('debug', {
      apiUrl
    });
  });

  router.get('/blog', (req,res) => {
    const SavedTags = JSON.parse(fs.readFileSync(paths.blogData, 'utf-8'));
    
    const QTag = req.query.tag;//現在頁面的query tag是什麽
    let filteredPort = SavedTags.Data;//篩選的數據

    const AllTags = SavedTags.TagList;

    if(QTag) filteredPort = SavedTags.Data.filter(p => p.tagid && p.tagid.includes(QTag));//篩選SavedTags裏面的tagid是Tag的

    res.render('blog', {
      SavedTags:filteredPort,//數據（已篩選）
      QTag,//現在的query
      AllTags,//所有tag的數據
      apiUrl,
      title: req.t('pageTitles.blog', { title })
    })
  })

  router.get('/port/:id', (req, res) => {
    const mdName = req.params.id;
    const protDir = paths.blog;
    const mdPath = path.join(protDir, `${mdName}.md`);
    
    if (!fs.existsSync(mdPath)) {
      return res.status(404).send(req.t('blog.articleNotFound'));
    }
    
    const content = fs.readFileSync(mdPath, 'utf-8');
    const [language, time, ...titleArr] = mdName.split('.');
    const title_B = mdName;
    const rawHtml = marked.parse(content);
    
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
