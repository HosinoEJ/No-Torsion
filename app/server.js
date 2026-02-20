const express = require('express');
const path = require('path');
const axios = require('axios');
const app = express();

// 設置 EJS
app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'ejs');

// 解析表單數據
app.use(express.urlencoded({ extended: true }));

// 首頁：渲染表單
app.get('/', (req, res) => {
  res.render('index');
});

// 處理表單提交
app.post('/submit', async (req, res) => {
  const { 
        age, sex, sex_other_option, province, city, school_name, school_address, 
        date_start, date_end, experience, headmaster_name, 
        contact_information, scandal, other 
    } = req.body;

  // Google Form 的 POST 地址（注意：最後是 formResponse）
  const googleFormUrl = 'https://docs.google.com/forms/d/e/1FAIpQLScggjQgYutXQrjQDrutyxL0eLaFMktTMRKsFWPffQGavUFspA/formResponse';

  // 處理性別邏輯：如果選了其他，則取 sex_other 的值
  let finalSex = data.sex;
  if (data.sex === '__other_option__') {
      finalSex = data.sex_other;
  }
  // 對應你的 entry ID
  const formData = new URLSearchParams();
  params.append('entry.842223433', data.age);
  params.append('entry.1422578992', finalSex); // 發送最終確定的性別
  params.append('entry.1766160152', data.province);
  params.append('entry.402227428', data.city);
  params.append('entry.5034928', data.school_name);
  params.append('entry.1390240202', data.school_address);
  params.append('entry.1344969670', data.date_start);
  params.append('entry.129670533', data.date_end);
  params.append('entry.578287646', data.experience);
  params.append('entry.1533497153', data.headmaster_name);
  params.append('entry.883193772', data.contact_information);
  params.append('entry.1400127416', data.scandal);
  params.append('entry.2022959936', data.other);

  try {
    await axios.post(googleFormUrl, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    res.send('提交成功！感謝您的參與。');
  } catch (error) {
    console.error(error);
    res.status(500).send('提交失敗，請稍後再試。');
  }
});

module.exports = app;


const app_port = 3000
app.listen(app_port , () => {console.log(`Server is start in port:${app_port}`)})