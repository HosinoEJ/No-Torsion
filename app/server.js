const app = require('./app');
const { appPort, apiUrl, debugMod, googleScriptUrl } = require('../config/appConfig');

// server.js 只负责启动 HTTP 服务，业务装配在 app/app.js 里。
module.exports = app;

if (require.main === module) {
  app.listen(appPort, () => {
    if (debugMod === 'true') {
      console.warn('警告！你現在在調試模式', debugMod, 'api获取位置：', apiUrl);
    }
    if (!googleScriptUrl) {
      console.warn('警告！未設置 GOOGLE_SCRIPT_URL，地圖頁將直接使用公開 API：', apiUrl);
    }
    console.log(`Server is running at http://localhost:${appPort}`);
  });
}
