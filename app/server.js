const app = require('./app');
const {
  appPort,
  apiUrl,
  correctionGoogleFormUrl,
  correctionSubmitTarget,
  debugMod,
  formDryRun,
  formId,
  formSubmitTarget,
  formProtectionSecretConfigured,
  googleScriptUrl,
  maintenanceMode,
  rateLimitRedisUrl,
  translationProviderConfigured
} = require('../config/appConfig');

// server.js 只负责启动 HTTP 服务，业务装配在 app/app.js 里。
module.exports = app;

if (require.main === module) {
  app.listen(appPort, () => {
    // 这些启动日志同时也是最小化部署自检清单：
    // 线上一旦功能异常，先看这里通常就能快速定位是“配置缺失”还是“运行时行为异常”。
    if (debugMod === 'true') {
      console.warn('警告！你現在在調試模式', debugMod, 'api获取位置：', apiUrl);
    }
    if (maintenanceMode) {
      console.warn('警告！MAINTENANCE_MODE=true，所有動態請求都會返回 503 維護頁。');
    }
    if (!googleScriptUrl) {
      console.warn('警告！未設置 GOOGLE_SCRIPT_URL，地圖頁將直接使用公開 API：', apiUrl);
    }
    if ((formSubmitTarget === 'google' || formSubmitTarget === 'both') && !formId) {
      console.warn('警告！未設置 FORM_ID 或 FORM_ID_ENCRYPTED，表單最終提交將無法發送到 Google Form。');
    }
    if ((correctionSubmitTarget === 'google' || correctionSubmitTarget === 'both') && !correctionGoogleFormUrl) {
      console.warn('警告！未設置 CORRECTION_FORM_ID / CORRECTION_GOOGLE_FORM_URL，機構補充 / 修正表單將無法發送到 Google Form。');
    }
    if (!formProtectionSecretConfigured) {
      console.warn('警告！未設置 FORM_PROTECTION_SECRET，表單防刷 token 正使用自動生成的派生密鑰；如需解密 FORM_ID_ENCRYPTED / GOOGLE_SCRIPT_URL_ENCRYPTED，仍需顯式設置高強度隨機值。');
    }
    if (!formDryRun && (formSubmitTarget === 'google' || formSubmitTarget === 'both') && !formId) {
      console.warn('警告！FORM_DRY_RUN=false 但缺少 FORM_ID，正式提交一定會失敗。');
    }
    if (rateLimitRedisUrl) {
      console.log('已啟用 Redis 共享限流存储。');
    }
    if (!translationProviderConfigured) {
      console.warn('警告！未配置正式翻譯服務，翻譯 API 將返回失敗。');
    } else {
      console.log('已啟用正式翻譯服務：google-cloud');
    }
    console.log(`Server is running at http://localhost:${appPort}`);
  });
}
