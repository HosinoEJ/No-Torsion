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
    // 基礎信息
    params.append('entry.842223433', body.age || '');
    params.append('entry.1422578992', finalSex || '');
    params.append('entry.1766160152', body.province || '');
    params.append('entry.402227428', body.city || '');
    
    // 學校信息
    params.append('entry.50349280', body.school_name || ''); 
    params.append('entry.1390240202', body.school_address || '');

    // 您的經歷 - 日期如果為空，不要 append 該字段，或者確保格式正確
    if (body.date_start) params.append('entry.1344969670', body.date_start);
    if (body.date_end) params.append('entry.129670533', body.date_end);
    params.append('entry.578287646', body.experience || '');

    // 曝光資訊
    params.append('entry.1533497153', body.headmaster_name || '');
    params.append('entry.883193772', body.contact_information || '');
    params.append('entry.1400127416', body.scandal || '');
    params.append('entry.2022959936', body.other || '');



    // 5. 發送請求
    await axios.post(googleFormUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    res.render('submit');

  }
  // 修改 server.js 中的 catch 部分
  catch (error) {
      if (error.response) {
          console.error('Google Error Status:', error.response.status);
          console.error('Google Error Data:', error.response.data);
      } else {
          console.error('Error Message:', error.message);
      }
      res.status(500).send('提交失敗，原因：' + (error.response ? "數據格式不符" : "網絡錯誤"));
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