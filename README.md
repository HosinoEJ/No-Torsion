# NO CONVERSION THERAPY

## N·C·T project

[![Status](https://img.shields.io/badge/Status-Active-brightgreen)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-blue.svg)]()

**我們致力於記錄、曝光並抵制所有形式的「扭轉治療」機構。** 每一份真實的聲音，都是終結傷害的力量。你的簽名與參與，將幫助更多人避開深淵。

---

## 我爲什麼要這麼做？

1. **信息對稱**：打破非法人格糾正機構的信息壟斷。
2. **證據固定**：為受害者提供一個經歷記錄平台。
3. **地圖瀏覽**：讓所有人看到那些溝槽的物件在國内的覆蓋程度
4. **法律推動**：wc這個好像有點難，但是我們在做了！！！！

## 表單收集

如果你曾是受害者或知情者，請通過我們的網站匿名提交詳細信息。我們會根據您的表單匯總出一個地圖：
 **[填寫表單](https://NCT.hosinoneko.me/form)**

原表單LINK:[Google From](https://forms.gle/eHwkmNCZtmZhLjzh7)

*我承諾我不會以任何理由收集您的個人資訊*

---

## 開發與貢獻

若出現國家級的域名封鎖，各位可以自行部署。

本專案基於 **Node.js + Express + EJS** 構建，並部署於 Vercel。

### 環境要求
- Node.js 18.x 

### 快速開始

Build command
```bash
npm install
```

環境變數：
```bash
TITLE="NO CONVERSION THERAPY"
```

*一般就填NO CONVERSION THERAPY就可以了，除非...你幹嘛（*

若想在本地開發
```bash
git clone https://github.com/HosinoEJ/No-Torsion.git
cd No-Torsion
npm install
```
最後就可以啓動了：
```bash
npm start
```
警告：在本地運行時，發送表單功能可能會受到GFW的影響。

### API部署：

如果你想在你的網站顯示網站地圖，或者用來分析數據，可以使用我們的api，這在一定程度上可以促進去中心化。

api：
```
https://no-torsion.vercel.app/api/map-data
```

api會回傳一個get類型的JSON，以下是案例：

```JSON
{
    "avg_age": 17,
    "last_synced": 1774925078387,
    "statistics": [
        {
            "province": "河南",
            "count": 12
        },
        {
            "province": "湖北",
            "count": 66
        },
        {
            "province": "福建",
            "count": 3
        }
    ],
    "data": [
        {
            "name": "學校名稱",
            "addr": "學校地址",
            "province": "省份",
            "prov": "區、縣",
            "else": "其他補充内容",
            "lat": 36.62728,
            "lng": 118.58882,
            "experience": "經歷描述",
            "HMaster": "負責人/校長姓名",
            "scandal": "已知醜聞",
            "contact": "學校聯繫方式"
        }
    ]
}
```

其中，lat和lng是經緯度。

### API案例：機構地圖

本網站其實已經是一個案例了：https://NCT.hosinoneko.me/map

當然我也鼓勵大家去自己製作：

我們在這裏使用的是[LEAFLETJS](https://leafletjs.com)這個項目實現的在綫地圖查看，html程式碼在此處：

```HTML
<!DOCTYPE html>
<html>
<head>
    <title>机构综合地图</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
        #map { height: 80vh; width: 100%; border-radius: 8px; }
        .custom-popup b { color: #e63946; }
    </style>
</head>
<body>
    <h1>机构综合地图</h1>
    <div id="map"></div>
    <p><a href="/">返回首页</a></p>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        const map = L.map('map').setView([36.06, 120.38], 6); // 預設視角

        // 選用簡潔的底圖風格
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

        const apiLabels = 'https://no-torsion.vercel.app/api/map-data';

        fetch(apiLabels)
            .then(res => res.json())
            .then(data => {
                data.forEach(item => {
                    const marker = L.marker([item.lat, item.lng]).addTo(map);

                    // 1. 鼠標指到圖標：顯示標題 (Tooltip)
                    marker.bindTooltip(`<strong>${item.name}</strong>`, { 
                        sticky: true, 
                        direction: 'top' 
                    });

                    // 2. 點擊：顯示所有詳細資訊 (Popup)
                    const popupContent = `
                        <div class="custom-popup">
                            <b>${item.name}</b><br>
                            <small>${item.prov}</small>
                            <p>${item.HMaster}</p><hr>
                            <p>${item.experience}</p>
                            <p>${item.scandal}</p>
                            <p>${item.else}</p>
                            <address>${item.addr}</address>
                        </div>
                    `;
                    marker.bindPopup(popupContent);
                });
            });
    </script>
</body>
</html>
```

你也可以將資訊全部列出來：

```HTML
<script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
<div id="data-container">
    <h3>所有數據</h3>
</div>
<script>
    async function loadData() {
        try {
            // 2. 獲取數據
            const response = await axios.get('https://no-torsion.vercel.app/api/map-data');//API
            
            const rawData = response.data;

            const container = document.getElementById('data-container');

            // 3. 循環
            rawData.forEach(item => {
                const card = document.createElement('div');
                card.className = 'card';

                let scandalHtml = item.scandal ? `<div class="scandal">⚠️ ${item.scandal}</div>` : '';

                card.innerHTML = `
                    <div class="div" style="width: 100%">
                        <h2>${item.name}</h2>
                        <p><strong>負責人：</strong>${item.HMaster}</p>
                        <p><strong>省份：</strong>${item.province}</p>
                        <p><strong>鄉、鎮：</strong>${item.prov}</p>
                        <p><strong>地址：</strong>${item.addr}</p>
                        <hr>
                        ${scandalHtml}
                        <div class="contact"><strong>聯繫方式：</strong>\n${item.contact}</div>
                    </div>
                `;

                container.appendChild(card);
            });
        } catch (error) {
            console.error('獲取數據失敗:', error);
            document.getElementById('data-container').innerHTML = '<p>數據加載失敗</p>';
        }
    }

    // 執行函數
    loadData();
</script>
```

就這樣沒啦！你完全不需要搞什麽複雜的伺服器編寫，只需要你寫一個html頁面，上傳到github pages就可以了！