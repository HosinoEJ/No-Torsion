const express = require('express');
const path = require('path');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs')
require('dotenv').config();
const app = express();
app.use(cors());

const debugMod = process.env.DEBUG_MOD || 'false';
const title = process.env.TITLE;

let apiUrl = '/api/map-data';
if (debugMod == 'true') apiUrl = 'https://nct.hosinoneko.me/api/map-data'

// 設置 EJS
app.set('views', path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, '../public')));
app.set('view engine', 'ejs');

// 解析表單數據（必須）
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 首頁：渲染表單
app.get('/', (req, res) => {
  res.render('index', {
    t:req.t,
    title: `主頁|${title}`,
    apiUrl
  });
});

// 表單頁：填寫數據
app.get('/form', (req, res) => {
  res.render('form', {
    t:req.t,
    title:`填寫表單|${title}`,
    apiUrl
  });
});

app.get('/map', (req,res) => {
    res.render('map', {
        t:req.t,
        title:`地圖|${title}`,
        apiUrl
    })
})

app.get('/aboutus', (req,res) => {
    let friendsData = { friends: [] };
    try {
        const jsonPath = path.join(__dirname,'..', 'friends.json');
        const rawData = fs.readFileSync(jsonPath, 'utf8');
        friendsData = JSON.parse(rawData);
    } catch (err) {
        console.error("讀取友鏈出錯：", err);
    }
    res.render('about',{
        t:req.t,
        title:`關於我們|${title}`,
        friends: friendsData.friends,
        apiUrl
    })
})
app.get('/debug', (req,res) =>{
    res.render('debug', {
        t:req.t,
        apiUrl
    })
})


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
    params.append('entry.500021634', body.identity || '受害者本人')

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

      //const googleFormUrl = 'https://docs.google.com/forms/d/e/1FAIpQLScggjQgYutXQrjQDrutyxL0eLaFMktTMRKsFWPffQGavUFspA/formResponse';
      const formId = process.env.FORM_ID || '1FAIpQLScggjQgYutXQrjQDrutyxL0eLaFMktTMRKsFWPffQGavUFspA';
      const googleFormUrl = `https://docs.google.com/forms/d/e/${formId}/formResponse`

      await axios.post(googleFormUrl, params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      res.render('submit');
  } catch (error) {
      console.error('Submission Error:', error.response ? error.response.data : error.message);
      res.status(500).send('提交失敗，原因：數據格式不符 (請檢查性別或日期是否填寫正確)');
  }
});



let cachedData = null;
let lastFetchTime = 0;

app.get('/api/map-data', async (req, res) => {
    const now = Date.now();
    
    // 檢查快取（快取現在應該存整個物件，包含 stats 和 data）
    if (cachedData && (now - lastFetchTime < 300000)) {
        return res.json(cachedData);
    }
    try {
        const googleAppsScriptUrl = process.env.GOOGLE_SCRIPT_URL;
        const response = await axios.get(googleAppsScriptUrl);
        
        let rawData = response.data.data;
        let statistics = response.data.statistics; // 從 GAS 拿到統計資訊

        // --- 防護機制 ---
        if (!Array.isArray(rawData)) {
            if (typeof rawData === 'string') {
                try { rawData = JSON.parse(rawData); } catch (e) {
                    return res.status(500).json({ error: "數據解析失敗" });
                }
            } else {
                return res.status(500).json({ error: "預期收到陣列但得到其他類型" });
            }
        }

        // 資料清洗
        const cleanData = rawData.filter(item => item && (item.lat || item['緯度'])).map(item => {
            return {
                name: item['學校名稱'] || "未填寫名稱",
                addr: item['學校地址'] || "無地址",
                province: item['省份'] || "",
                prov: item['區、縣'] || "",
                else: item['其他'] || "",
                lat: parseFloat(item.lat || item['緯度']), 
                lng: parseFloat(item.lng || item['經度']),
                experience: item['請問您在那裏都經歷了什麼？'],
                HMaster: item['校長名字'] || "",
                scandal: item['學校的醜聞'] || "",
                contact: item['學校的聯繫方式'] || "",
                inputType: item['請問您是什麽身份？'] || ""
            };
        });

        // --- 組合最終結果 ---
        const finalResponse = {
            avg_age:response.data.avg_age,
            last_synced: now,
            statistics: statistics,
            data: cleanData
        };

        cachedData = finalResponse; // 存入快取 (存整包)
        lastFetchTime = now;
        
        res.json(finalResponse);

    } catch (error) {
        if (cachedData) return res.json(cachedData);
        console.error("API Error:", error.message);
        res.status(500).json({ error: "無法取得地圖數據" });
    }
});





module.exports = app;

// 本地開發監聽（Vercel 部署時會自動忽略這部分，但在本地測試很有用）
const app_port = 3000;
app.listen(app_port, () => {
    if (debugMod == true) console.warn(`警告！你現在在調試模式`,debugMod)
    console.log(`Server is running at http://localhost:${app_port}`);
});