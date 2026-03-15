const express = require('express');
const path = require('path');
const axios = require('axios');
require('dotenv').config();
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

    // --- 1. 基礎資訊 (必填項) ---
    params.append('entry.842223433', body.age || '');
    params.append('entry.1766160152', body.province || '');
    params.append('entry.402227428', body.city || '');
    params.append('entry.5034928', body.school_name || '');

    // --- 2. 性別邏輯 (極度安全模式) ---
    // 先嘗試最簡單的直接發送，如果還是報錯，請在 Google Form 裡把性別改為「簡答題」
    let finalSex = body.sex;
    if (body.sex === '__other_option__') {
        finalSex = body.sex_other;
    }
    params.append('entry.1422578992', finalSex || '');

    // --- 3. 學校地址與經歷 ---
    params.append('entry.1390240202', body.school_address || '');
    params.append('entry.578287646', body.experience || ''); // 經歷描述

    // --- 4. 日期處理 (報錯核心) ---
    // 只有當日期真的有值時才 append，否則完全忽略這兩個 key
    if (body.date_start && body.date_start.trim() !== "") {
        params.append('entry.1344969670', body.date_start);
    }
    if (body.date_end && body.date_end.trim() !== "") {
        params.append('entry.129670533', body.date_end);
    }

    // --- 5. 曝光資訊 ---
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


app.get('/map', (req,res) => {
    res.render('map', {
        t:req.t
    })
})


app.get('/api/map-data', async (req, res) => {
    try {
        const googleAppsScriptUrl = process.env.GOOGLE_SCRIPT_URL;
        const response = await axios.get(googleAppsScriptUrl);
        
        let rawData = response.data;

        // --- 防護機制：檢查數據是否為陣列 ---
        if (!Array.isArray(rawData)) {
            console.error("收到的數據不是陣列:", rawData);
            // 如果 GAS 回傳的是字串，嘗試解析它
            if (typeof rawData === 'string') {
                try {
                    rawData = JSON.parse(rawData);
                } catch (e) {
                    return res.status(500).json({ error: "數據解析失敗", raw: rawData });
                }
            } else {
                return res.status(500).json({ error: "預期收到陣列但得到其他類型", received: typeof rawData });
            }
        }

        const cleanData = rawData.filter(item => item && item.lat && item.lng).map(item => ({
            name: item['學校名稱'] || "未填寫名稱",
            addr: item['學校地址'] || "無地址",
            prov: item['省份'] || "",
            city: item['區、縣'] || "",
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lng),
            scandal: item['學校的醜聞'] || item['其他'] || "無詳細資訊",
            contact: item['學校的聯繫方式'] || ""
        }));

        res.json(cleanData);
    } catch (error) {
        console.error("API Error:", error.message);
        res.status(500).json({ error: error.message });
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