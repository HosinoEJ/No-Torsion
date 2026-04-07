const express = require('express');
const ejs = require('ejs');
const fs = require('fs');
const nodePath = require('path');
const helmet = require('helmet');
const {
  apiUrl,
  debugMod,
  formDryRun,
  formProtectionMaxAgeMs,
  formProtectionMinFillMs,
  formProtectionSecret,
  googleFormUrl,
  googleScriptUrl,
  mapReadRateLimitMax,
  pageReadRateLimitMax,
  publicMapDataUrl,
  rateLimitRedisUrl,
  siteUrl,
  submitRateLimitMax,
  title,
  trustProxy
} = require('../config/appConfig');
const { paths } = require('../config/fileConfig');
const { helmetConfig, requestBodyLimits } = require('../config/security');
const { createI18nMiddleware } = require('./middleware/i18n');
const createApiRoutes = require('./routes/apiRoutes');
const createFormRoutes = require('./routes/formRoutes');
const createPageRoutes = require('./routes/pageRoutes');

function collectEjsTemplatePaths(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = nodePath.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectEjsTemplatePaths(absolutePath);
    }

    return absolutePath.endsWith('.ejs') ? [absolutePath] : [];
  });
}

function primeEjsTemplateCache(viewsDirectory) {
  const templatePaths = collectEjsTemplatePaths(viewsDirectory);

  for (const templatePath of templatePaths) {
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const compiledTemplate = ejs.compile(templateSource, {
      cache: true,
      filename: templatePath,
      views: [viewsDirectory]
    });

    ejs.cache.set(templatePath, compiledTemplate);
  }
}

// 统一装配 Express 应用：中间件、模板引擎和路由都从这里接入。
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', trustProxy);
app.use(helmet(helmetConfig));
app.use(createI18nMiddleware());

// 模板与静态资源根目录。
app.set('views', paths.views);
app.use(express.static(paths.public));
app.engine('ejs', (filePath, data, callback) => ejs.renderFile(filePath, data, {
  cache: true,
  views: [paths.views]
}, callback));
app.enable('view cache');
app.set('view engine', 'ejs');
primeEjsTemplateCache(paths.views);

// 限制请求体大小，避免超大 payload 直接打进业务逻辑。
app.use(express.urlencoded({ extended: true, limit: requestBodyLimits.urlencoded }));
app.use(express.json({ limit: requestBodyLimits.json }));

// 页面、表单、API 三类路由分开挂载，便于后续继续扩展。
app.use(createPageRoutes({
  apiUrl,
  debugMod,
  formProtectionSecret,
  pageReadRateLimitMax,
  rateLimitRedisUrl,
  siteUrl,
  title
}));
app.use(createFormRoutes({
  formDryRun,
  formProtectionMaxAgeMs,
  formProtectionMinFillMs,
  formProtectionSecret,
  googleFormUrl,
  rateLimitRedisUrl,
  submitRateLimitMax,
  title
}));
app.use(createApiRoutes({
  googleScriptUrl,
  mapReadRateLimitMax,
  publicMapDataUrl,
  rateLimitRedisUrl
}));

module.exports = app;
