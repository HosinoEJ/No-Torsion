const crypto = require('crypto');
const { isWorkersRuntime } = require('./runtimeConfig');

if (!isWorkersRuntime()) {
  require('dotenv').config();
}

function resolveTrustProxy(value) {
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

function resolveFormProtectionSecret({ explicitSecret, formId, siteUrl, title }) {
  if (typeof explicitSecret === 'string' && explicitSecret.trim()) {
    return explicitSecret.trim();
  }

  return crypto
    .createHash('sha256')
    .update([formId, siteUrl, title || 'N·C·T'].join(':'))
    .digest('hex');
}

// 所有运行时环境变量统一从这里读，避免业务代码四处直接碰 process.env。
const debugMod = process.env.DEBUG_MOD || 'true';
const maintenanceMode = parseBooleanEnv(process.env.MAINTENANCE_MODE, false);
const maintenanceNotice = readTrimmedEnvValue(process.env.MAINTENANCE_NOTICE);
const maintenanceRetryAfterSeconds = parsePositiveInteger(process.env.MAINTENANCE_RETRY_AFTER_SECONDS, 1800);
const title = process.env.TITLE || 'N·C·T';
const formDryRun = parseBooleanEnv(process.env.FORM_DRY_RUN, true);
const pageReadRateLimitMax = parsePositiveInteger(process.env.PAGE_READ_RATE_LIMIT_MAX, 180);
const mapReadRateLimitMax = parsePositiveInteger(process.env.MAP_READ_RATE_LIMIT_MAX, 60);
const submitRateLimitMax = parsePositiveInteger(process.env.SUBMIT_RATE_LIMIT_MAX, 5);
const formId = process.env.FORM_ID || '1FAIpQLScggjQgYutXQrjQDrutyxL0eLaFMktTMRKsFWPffQGavUFspA';
const googleFormUrl = `https://docs.google.com/forms/d/e/${formId}/formResponse`;
const googleScriptUrl = process.env.GOOGLE_SCRIPT_URL;
const appPort = parsePositiveInteger(process.env.PORT, 3000);
const publicMapDataUrl = process.env.PUBLIC_MAP_DATA_URL || 'https://nct.hosinoeiji.workers.dev/api/map-data';
const mapDataForceIpv4 = parseBooleanEnv(process.env.MAP_DATA_FORCE_IPV4, false);
const siteUrl = String(process.env.SITE_URL || 'https://www.victimsunion.org/').replace(/\/+$/, '');
const apiUrl = '/api/map-data';
const trustProxy = resolveTrustProxy(process.env.TRUST_PROXY || '1');
const formProtectionMinFillMs = parsePositiveInteger(process.env.FORM_PROTECTION_MIN_FILL_MS, 3000);
const formProtectionMaxAgeMs = parsePositiveInteger(process.env.FORM_PROTECTION_MAX_AGE_MS, 24 * 60 * 60 * 1000);
const formProtectionSecretConfigured = Boolean(process.env.FORM_PROTECTION_SECRET && process.env.FORM_PROTECTION_SECRET.trim());
const formProtectionSecret = resolveFormProtectionSecret({
  explicitSecret: process.env.FORM_PROTECTION_SECRET,
  formId,
  siteUrl,
  title
});
const rateLimitRedisUrl = String(process.env.RATE_LIMIT_REDIS_URL || process.env.REDIS_URL || '').trim();
const googleCloudTranslationApiKey = readTrimmedEnvValue(
  process.env.GOOGLE_CLOUD_TRANSLATION_API_KEY,
  process.env.GOOGLE_TRANSLATE_API_KEY
);
const translationProviderTimeoutMs = parsePositiveInteger(process.env.TRANSLATION_PROVIDER_TIMEOUT_MS, 10000);
const translationProviderConfigured = Boolean(googleCloudTranslationApiKey);

module.exports = {
  appPort,
  apiUrl,
  debugMod,
  formDryRun,
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
  mapDataForceIpv4,
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
