const express = require('express');
const path = require('path');
const axios = require('axios');
const app = express();

// 設置 EJS
app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'ejs');

// 解析表單數據（必須）
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 首頁：渲染表單
app.get('/', (req, res) => {
  res.render('index');
});

// 處理表單提交
app.post('/submit', async (req, res) => {
  try {
    // 1. 這裡直接從 req.body 拿數據
    const body = req.body;

    // 2. Google Form 的 POST 地址
    const googleFormUrl = 'https://docs.google.com/forms/d/e/1FAIpQLScggjQgYutXQrjQDrutyxL0eLaFMktTMRKsFWPffQGavUFspA/formResponse';

    // 3. 處理性別邏輯（根據你前端的 name="sex" 和 name="sex_other"）
    let finalSex = body.sex;
    if (body.sex === '__other_option__') {
        finalSex = body.sex_other;
    }

    // 4. 構建參數 (統一使用 params)
    const params = new URLSearchParams();
    params.append('entry.842223433', body.age || '');
    params.append('entry.1422578992', finalSex || '');
    params.append('entry.1766160152', body.province || '');
    params.append('entry.402227428', body.city || '');
    params.append('entry.5034928', body.school_name || '');
    params.append('entry.1390240202', body.school_address || '');
    params.append('entry.1344969670', body.date_start || '');
    params.append('entry.129670533', body.date_end || '');
    params.append('entry.578287646', body.experience || '');
    params.append('entry.1533497153', body.headmaster_name || '');
    params.append('entry.883193772', body.contact_information || '');
    params.append('entry.1400127416', body.scandal || '');
    params.append('entry.2022959936', body.other || '');

    // 5. 發送請求
    await axios.post(googleFormUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    res.send('<h1>提交成功！感謝您的參與。</h1><a href="/">返回首頁</a>');

  } catch (error) {
    // 打印具體錯誤到 Vercel 日誌
    console.error('Google Form Submission Error:', error.response ? error.response.data : error.message);
    res.status(500).send('提交失敗，服務器錯誤。請檢查 Google 表單是否開啟了接受回覆。');
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