const crypto = require('crypto');
const { isWorkersRuntime } = require('./runtimeConfig');
const { decryptProtectedValue } = require('./protectedConfig');

if (!isWorkersRuntime()) {
  require('dotenv').config();
}

function resolveTrustProxy(value) {
  // Express 的 trust proxy 既支持布尔值，也支持 hop 数和自定义字符串。
  if (typeof value !== 'string') {
    return false;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (!normalizedValue || normalizedValue === 'false' || normalizedValue === 'off' || normalizedValue === 'no') {
    return false;
  }

  if (normalizedValue === 'true' || normalizedValue === 'on' || normalizedValue === 'yes') {
    return true;
  }

  if (/^\d+$/.test(normalizedValue)) {
    return Number.parseInt(normalizedValue, 10);
  }

  return value.trim();
}

function parsePositiveInteger(value, fallback) {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}

function readTrimmedEnvValue(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function parseBooleanEnv(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (!normalizedValue) {
    return fallback;
  }

  if (normalizedValue === 'true' || normalizedValue === '1' || normalizedValue === 'yes' || normalizedValue === 'on') {
    return true;
  }

  if (normalizedValue === 'false' || normalizedValue === '0' || normalizedValue === 'no' || normalizedValue === 'off') {
    return false;
  }

  return fallback;
}

function resolveSubmitTarget(value, fallback = 'both') {
  const normalizedValue = readTrimmedEnvValue(value).toLowerCase();

  if (normalizedValue === 'd1' || normalizedValue === 'both' || normalizedValue === 'google') {
    return normalizedValue;
  }

  return fallback;
}

function normalizeGoogleFormSubmitUrl(url) {
  const normalizedUrl = readTrimmedEnvValue(url);

  if (!normalizedUrl) {
    return '';
  }

  return normalizedUrl
    .replace(/\/viewform(?:\?.*)?$/i, '/formResponse')
    .replace(/\/formResponse(?:\?.*)?$/i, '/formResponse');
}

function extractGoogleFormIdFromUrl(url) {
  const normalizedUrl = readTrimmedEnvValue(url);

  if (!normalizedUrl) {
    return '';
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    const match = parsedUrl.pathname.match(/\/d\/e\/([^/]+)\/(?:viewform|formResponse)/i);
    return match ? match[1] : '';
  } catch (_error) {
    return '';
  }
}

function buildGoogleFormUrlsFromConfig({
  defaultFormId = '',
  defaultFormIdSuffix = '',
  formId,
  fullUrl
}) {
  const configuredUrl = readTrimmedEnvValue(fullUrl);

  if (configuredUrl) {
    const extractedFormId = extractGoogleFormIdFromUrl(configuredUrl);
    const submitUrl = normalizeGoogleFormSubmitUrl(configuredUrl);
    return {
      formId: extractedFormId,
      submitUrl,
      viewUrl: submitUrl ? submitUrl.replace(/\/formResponse(?:\?.*)?$/i, '/viewform') : ''
    };
  }

  let resolvedFormId = readTrimmedEnvValue(formId) || defaultFormId;

  if (!resolvedFormId) {
    return {
      formId: '',
      submitUrl: '',
      viewUrl: ''
    };
  }

  if (/^https?:\/\//i.test(resolvedFormId)) {
    return buildGoogleFormUrlsFromConfig({
      fullUrl: resolvedFormId
    });
  }

  if (
    defaultFormId
    && defaultFormIdSuffix
    && resolvedFormId === defaultFormId
    && !resolvedFormId.endsWith(defaultFormIdSuffix)
  ) {
    resolvedFormId = `${resolvedFormId}${defaultFormIdSuffix}`;
  }

  const submitUrl = `https://docs.google.com/forms/d/e/${resolvedFormId}/formResponse`;
  return {
    formId: resolvedFormId,
    submitUrl,
    viewUrl: submitUrl.replace(/\/formResponse(?:\?.*)?$/i, '/viewform')
  };
}

function resolveFormProtectionSecret({ explicitSecret, formId, siteUrl, title }) {
  if (typeof explicitSecret === 'string' && explicitSecret.trim()) {
    return explicitSecret.trim();
  }

  // 本地开发允许根据站点上下文派生一个稳定值，避免完全没法启动；
  // 但只要涉及密文配置，正式环境仍要求显式配置高强度随机 secret。
  return crypto
    .createHash('sha256')
    .update([formId, siteUrl, title || 'N·C·T'].join(':'))
    .digest('hex');
}

function resolveProtectedEnvValue({
  envName,
  encryptedEnvName,
  explicitSecret,
  purpose
}) {
  const plainValue = readTrimmedEnvValue(process.env[envName]);
  if (plainValue) {
    // 明文优先，便于应急排障时直接覆盖加密值。
    return plainValue;
  }

  const encryptedValue = readTrimmedEnvValue(process.env[encryptedEnvName]);
  if (!encryptedValue) {
    return '';
  }

  if (!(typeof explicitSecret === 'string' && explicitSecret.trim())) {
    throw new Error(`要解密 ${encryptedEnvName}，必須顯式配置 FORM_PROTECTION_SECRET。`);
  }

  try {
    return decryptProtectedValue(encryptedValue, explicitSecret, purpose);
  } catch (error) {
    throw new Error(`${encryptedEnvName} 解密失敗：${error.message}`);
  }
}

// 所有运行时环境变量统一从这里读，避免业务代码四处直接碰 process.env。
const debugMod = process.env.DEBUG_MOD || 'true';
const maintenanceMode = parseBooleanEnv(process.env.MAINTENANCE_MODE, false);
const maintenanceNotice = readTrimmedEnvValue(process.env.MAINTENANCE_NOTICE);
const maintenanceRetryAfterSeconds = parsePositiveInteger(process.env.MAINTENANCE_RETRY_AFTER_SECONDS, 1800);
const title = process.env.TITLE || 'N·C·T';
const formDryRun = parseBooleanEnv(process.env.FORM_DRY_RUN, true);
const formSubmitTarget = resolveSubmitTarget(process.env.FORM_SUBMIT_TARGET || process.env.FORM_SUBMISSION_TARGET, 'both');
const correctionSubmitTarget = resolveSubmitTarget(
  process.env.CORRECTION_SUBMIT_TARGET
  || process.env.CORRECTION_FORM_SUBMIT_TARGET
  || process.env.INSTITUTION_CORRECTION_SUBMIT_TARGET,
  'd1'
);
const pageReadRateLimitMax = parsePositiveInteger(process.env.PAGE_READ_RATE_LIMIT_MAX, 180);
const mapReadRateLimitMax = parsePositiveInteger(process.env.MAP_READ_RATE_LIMIT_MAX, 60);
const submitRateLimitMax = parsePositiveInteger(process.env.SUBMIT_RATE_LIMIT_MAX, 5);
const explicitFormProtectionSecret = readTrimmedEnvValue(process.env.FORM_PROTECTION_SECRET);
const formId = resolveProtectedEnvValue({
  envName: 'FORM_ID',
  encryptedEnvName: 'FORM_ID_ENCRYPTED',
  explicitSecret: explicitFormProtectionSecret,
  purpose: 'form-id'
});
const googleFormUrl = formId
  ? `https://docs.google.com/forms/d/e/${formId}/formResponse`
  : '';
const correctionGoogleFormConfig = buildGoogleFormUrlsFromConfig({
  defaultFormId: '1FAIpQLSfiXdpt8CgOGZQhvsJTc1koQbvXFo6eWfnigQ329r1',
  defaultFormIdSuffix: '-3DniNA',
  formId: readTrimmedEnvValue(
    process.env.CORRECTION_FORM_ID,
    process.env.CORRECTION_GOOGLE_FORM_ID,
    process.env.INSTITUTION_CORRECTION_FORM_ID
  ),
  fullUrl: readTrimmedEnvValue(
    process.env.CORRECTION_GOOGLE_FORM_URL,
    process.env.CORRECTION_FORM_URL,
    process.env.INSTITUTION_CORRECTION_GOOGLE_FORM_URL
  )
});
const correctionGoogleFormUrl = correctionGoogleFormConfig.submitUrl;
const correctionGoogleFormViewUrl = correctionGoogleFormConfig.viewUrl;
const googleScriptUrl = resolveProtectedEnvValue({
  envName: 'GOOGLE_SCRIPT_URL',
  encryptedEnvName: 'GOOGLE_SCRIPT_URL_ENCRYPTED',
  explicitSecret: explicitFormProtectionSecret,
  purpose: 'google-script-url'
});
const appPort = parsePositiveInteger(process.env.PORT, 3000);
// 公共地图回退源用于“私有 Apps Script 暂时不可达但页面仍需可用”的场景。
const publicMapDataUrl = process.env.PUBLIC_MAP_DATA_URL || 'https://nct.hosinoeiji.workers.dev/api/map-data';
const mapDataNodeTransportOverrides = parseBooleanEnv(process.env.MAP_DATA_NODE_TRANSPORT_OVERRIDES, false);
const mapDataUpstreamTimeoutMs = parsePositiveInteger(process.env.MAP_DATA_UPSTREAM_TIMEOUT_MS, 25000);
const siteUrl = String(process.env.SITE_URL || 'https://www.victimsunion.org/').replace(/\/+$/, '');
const apiUrl = '/api/map-data';
const trustProxy = resolveTrustProxy(process.env.TRUST_PROXY || '1');
const formProtectionMinFillMs = parsePositiveInteger(process.env.FORM_PROTECTION_MIN_FILL_MS, 3000);
const formProtectionMaxAgeMs = parsePositiveInteger(process.env.FORM_PROTECTION_MAX_AGE_MS, 24 * 60 * 60 * 1000);
const formProtectionSecretConfigured = Boolean(explicitFormProtectionSecret);
const formProtectionSecret = resolveFormProtectionSecret({
  explicitSecret: explicitFormProtectionSecret,
  formId,
  siteUrl,
  title
});
const rateLimitRedisUrl = String(process.env.RATE_LIMIT_REDIS_URL || process.env.REDIS_URL || '').trim();
const googleCloudTranslationApiKey = readTrimmedEnvValue(process.env.GOOGLE_CLOUD_TRANSLATION_API_KEY);
const translationProviderTimeoutMs = parsePositiveInteger(process.env.TRANSLATION_PROVIDER_TIMEOUT_MS, 10000);
const translationProviderConfigured = Boolean(googleCloudTranslationApiKey);

module.exports = {
  appPort,
  apiUrl,
  correctionGoogleFormUrl,
  correctionGoogleFormViewUrl,
  correctionSubmitTarget,
  debugMod,
  formDryRun,
  formSubmitTarget,
  formId,
  formProtectionMaxAgeMs,
  formProtectionMinFillMs,
  formProtectionSecret,
  formProtectionSecretConfigured,
  googleCloudTranslationApiKey,
  googleFormUrl,
  googleScriptUrl,
  maintenanceMode,
  maintenanceNotice,
  maintenanceRetryAfterSeconds,
  mapDataNodeTransportOverrides,
  mapDataUpstreamTimeoutMs,
  mapReadRateLimitMax,
  pageReadRateLimitMax,
  publicMapDataUrl,
  rateLimitRedisUrl,
  isWorkersRuntime: isWorkersRuntime(),
  siteUrl,
  submitRateLimitMax,
  translationProviderConfigured,
  translationProviderTimeoutMs,
  trustProxy,
  title
};
