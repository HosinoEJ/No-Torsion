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
  const googleFormUrl = 'https://docs.google.com/forms/u/0/d/e/1UbMSMO2i58dUpVhSfHJCbVjxzIYQ9TepQY45ml3je5E/formResponse';

  // 對應你的 entry ID
  const formData = new URLSearchParams();
  formData.append('entry.842223433', age);
  formData.append('entry.1422578992', sex);
  formData.append('entry.1422578992.other_option_response', sex_other_option)
  formData.append('entry.1766160152', province);
  formData.append('entry.402227428', city);
  formData.append('entry.5034928', school_name);
  formData.append('entry.1390240202', school_address);
  formData.append('entry.1344969670', date_start);
  formData.append('entry.129670533', date_end);
  formData.append('entry.578287646', experience);
  formData.append('entry.1533497153', headmaster_name);
  formData.append('entry.883193772', contact_information);
  formData.append('entry.1400127416', scandal);
  formData.append('entry.2022959936', other)

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