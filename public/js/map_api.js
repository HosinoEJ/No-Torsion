function getColor(d) {
    return d > 1000 ? '#800026' :
           d > 500  ? '#BD0026' :
           d > 200  ? '#E31A1C' :
           d > 100  ? '#FC4E2A' :
           d > 50   ? '#FD8D3C' :
           d > 20   ? '#FEB24C' :
           d > 10   ? '#FED976' :
                      '#FFEDA0';
}


const categories = []; // 存放省份名
const selfData = [];   // 存放本人填写数
const agentData = [];  // 存放代理人填写数

const map = L.map('map').setView([37.5, 109], 4); // 預設視角
const CNprov = '/cn.json'

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    minZoom: 4
}).addTo(map);


const apiUrl = window.API_URL


let provList = Array.from({ length: 40 }, () => Array(2).fill());
fetch(apiUrl)
    .then(res => res.json())
    .then(jsonResponse => {
        const data = jsonResponse.data;
        const provinceMap = {};

        data.forEach(item => {
            const prov = (item.province || "").replace(/(省|市|自治区|特别行政区)/g, "");
            provinceMap[prov] = (provinceMap[prov] || 0) + 1;
        });

        
        
        fetch(CNprov)
            .then(response => response.json())
            .then(dataP => {
                L.geoJSON(dataP, {
                    style: function(feature) {
                        let name = feature.properties.name || feature.properties.province || "";
                        
                        const count = provinceMap[name] || 0;
                        return {
                            fillColor: getColor(count),
                            weight: 2,
                            opacity: 1,
                            color: 'white',
                            dashArray: '3',
                            fillOpacity: 0.7
                        };
                    }
                }).addTo(map);
                //addMarkers(data);
            })
            .catch(err => console.error('加载地图数据失败:', err));

        const statistics = jsonResponse.statistics
            .map(item => `<strong>${item.province}</strong>: ${item.count}`)
            .join(', ');
        document.getElementById('province-dist').innerHTML = statistics;

        const lastSyncedTime = jsonResponse.last_synced;
        function timeUpdate() {
            const elapsed = Math.floor((Date.now() - lastSyncedTime) / 1000);
            let updButton = (elapsed > 300000) ? '，<button onclick="window.location.reload();">刷新</button>' : ''
            document.getElementById('lastSynced').innerHTML = elapsed + ` 秒前${updButton}`;
        }
        setInterval(timeUpdate, 1000);
        
        document.getElementById('avgAge').innerText = jsonResponse.avg_age.toFixed(2);
    

        let count_num0 = 0;
        let count_num1 = 0;
        let count_num2 = 0;
        data.forEach(item => {
            if(item.inputType == '受害者本人') count_num0++;
            if(item.inputType == '受害者的代理人')count_num1++;
            if(!item.inputType)count_num2++;
        })
        document.getElementById('total-count').innerHTML = 
        `<br>
        <text><b>数据量</b>${data.length}</text><br>
        <text><b>总提交量</b>${count_num0+count_num1}</text><br>
        <text><b>本人提交量</b>${count_num0}</text><br>
        <text><b>代理提交量</b>${count_num1}</text><br>
        <text><b>批量导入数据</b>${count_num2}</text>
        `;
        
        
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        const inputType = urlParams.get('inputType')//找筛选条件

        data.forEach(item => {
            
            if(item.inputType != inputType && inputType) {
                if(inputType == "批量数据" && item.inputType) return;
                else if(inputType !="批量数据") return
            }

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
                    <address>${item.addr}</address>
                    <a href="#${item.name}">查看详细信息</a>
                </div>
            `;
            marker.bindPopup(popupContent);
        });
    });