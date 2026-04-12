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
  formProtectionSecretConfigured,
  googleFormUrl,
  googleScriptUrl,
  isWorkersRuntime,
  maintenanceMode,
  maintenanceNotice,
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
} = require('../config/appConfig');
const { paths } = require('../config/fileConfig');
const { helmetConfig, requestBodyLimits } = require('../config/security');
const { createBundledStaticMiddleware } = require('./middleware/bundledStatic');
const { createI18nMiddleware } = require('./middleware/i18n');
const { createMaintenanceMiddleware } = require('./middleware/maintenance');
const createApiRoutes = require('./routes/apiRoutes');
const createFormRoutes = require('./routes/formRoutes');
const createInstitutionCorrectionRoutes = require('./routes/institutionCorrectionRoutes');
const createPageRoutes = require('./routes/pageRoutes');
const configuredAssetVersion = String(process.env.ASSET_VERSION || '').trim();
const assetVersion = configuredAssetVersion && configuredAssetVersion !== '0'
  ? configuredAssetVersion
  : String(Date.now());
// GeoJSON 在 Node / Workers 两侧都会频繁读取，启动时预读可以避免每次请求重复走磁盘。
const chinaGeoJsonPayload = fs.readFileSync(nodePath.join(paths.public, 'cn.json'), 'utf8');

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

  // EJS 模板在启动阶段预编译并写入缓存，减轻首个请求的模板解析开销。
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
app.locals.assetVersion = assetVersion;
app.set('trust proxy', trustProxy);
app.use(helmet(helmetConfig));
app.use(createI18nMiddleware());

// 模板与静态资源根目录。
app.set('views', paths.views);
app.get('/cn.json', (_req, res) => {
  // Workers 里的 express.static 在大文件上偶发 64 KiB 截断，
  // 这里直接返回完整字符串，确保地图 GeoJSON 始终可解析。
  res
    .type('application/json')
    .set('Cache-Control', 'public, max-age=0')
    .send(chinaGeoJsonPayload);
});
if (isWorkersRuntime) {
  // Workers 运行时改为直接从 bundle 读取静态文件，
  // 避免 express.static 在大资源上出现 64 KiB 截断。
  app.use(createBundledStaticMiddleware({ rootDirectory: paths.public }));
} else {
  app.use(express.static(paths.public));
}
app.use(createMaintenanceMiddleware({
  maintenanceMode,
  maintenanceNotice,
  maintenanceRetryAfterSeconds,
  title
}));
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
  translationProviderConfigured,
  translationProviderTimeoutMs,
  trustProxy,
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
app.use(createInstitutionCorrectionRoutes({
  formProtectionMaxAgeMs,
  formProtectionMinFillMs,
  formProtectionSecret,
  rateLimitRedisUrl,
  submitRateLimitMax,
  title
}));
app.use(createApiRoutes({
  googleScriptUrl,
  mapDataNodeTransportOverrides,
  mapDataUpstreamTimeoutMs,
  mapReadRateLimitMax,
  publicMapDataUrl,
  rateLimitRedisUrl
}));

module.exports = app;
