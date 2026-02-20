const express = require('express');
const path = require('path');
const axios = require('axios');
const app = express();

// 設置 EJS
app.set('views', path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, '../public')));
app.set('view engine', 'ejs');

// 解析表單數據（必須）
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 首頁：渲染表單
app.get('/', (req, res) => {
  res.render('index');
});

// 表單頁：填寫數據
app.get('/form', (req, res) => {
  res.render('form');
});

// 處理表單提交
app.post('/submit', async (req, res) => {
  try {
      const body = req.body;
      const params = new URLSearchParams();

      // 1. 年齡
      params.append('entry.842223433', body.age || '');

      // 2. 性別邏輯修復 (核心問題所在)
      // 判斷是否為預設選項。如果不是 男/女，則走 Google Form 的 "其他" 提交邏輯
      const standardSex = ["男", "女"];
      let finalSex = body.sex; 
      if (body.sex === '__other_option__') {
          finalSex = body.sex_other;
      }

      if (standardSex.includes(finalSex)) {
          // 如果是標準選項，直接發送
          params.append('entry.1422578992', finalSex);
      } else {
          // 如果是 MtF, FtM 或其他自定義內容，模擬 Google 的 "其他" 選項提交方式
          params.append('entry.1422578992', '__other_option__');
          params.append('entry.1422578992.other_option_response', finalSex || '');
      }

      // 3. 基礎資訊
      params.append('entry.1766160152', body.province || '');
      params.append('entry.402227428', body.city || '');
      params.append('entry.5034928', body.school_name || '');
      params.append('entry.1390240202', body.school_address || '');

      // 4. 日期邏輯修復 (避免空日期導致 400 錯誤)
      if (body.date_start) params.append('entry.1344969670', body.date_start);
      if (body.date_end) params.append('entry.129670533', body.date_end);

      // 5. 其他文本信息
      params.append('entry.578287646', body.experience || '');
      params.append('entry.1533497153', body.headmaster_name || '');
      params.append('entry.883193772', body.contact_information || '');
      params.append('entry.1400127416', body.scandal || '');
      params.append('entry.2022959936', body.other || '');

      const googleFormUrl = 'https://docs.google.com/forms/d/e/1FAIpQLScggjQgYutXQrjQDrutyxL0eLaFMktTMRKsFWPffQGavUFspA/formResponse';

      await axios.post(googleFormUrl, params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      res.render('submit');
  } catch (error) {
      console.error('Submission Error:', error.response ? error.response.data : error.message);
      res.status(500).send('提交失敗，原因：數據格式不符 (請檢查性別或日期是否填寫正確)');
  }
});

module.exports = app;

// 本地開發監聽（Vercel 部署時會自動忽略這部分，但在本地測試很有用）
if (process.env.NODE_ENV !== 'production') {
    const app_port = 3000;
    app.listen(app_port, () => {
        console.log(`Server is running at http://localhost:${app_port}`);
    });
}