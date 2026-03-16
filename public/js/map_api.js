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

// 選用簡潔的底圖風格
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);


const apiUrl = 'https://no-torsion.vercel.app/api/map-data'


let provList = Array.from({ length: 40 }, () => Array(2).fill());
fetch(apiUrl)
    .then(res => res.json())
    .then(data => {

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
                addMarkers(data);
            })
            .catch(err => console.error('加载地图数据失败:', err));

        const distText = Object.entries(provinceMap)
            .map(([name, count]) => `<strong>${name}</strong>: ${count}`)
            .join(', ');
        document.getElementById('province-dist').innerHTML = distText;
        
        document.getElementById('total-count').innerText = data.length;
        

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