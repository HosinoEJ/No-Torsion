(() => {
function getColor(d) {
    return d > 200 ? '#800026' :
           d > 100  ? '#BD0026' :
           d > 70  ? '#E31A1C' :
           d > 50  ? '#FC4E2A' :
           d > 20   ? '#FD8D3C' :
           d > 10   ? '#FEB24C' :
           d > 5   ? '#FED976' :
                      '#FFEDA0';
}

const i18n = window.I18N;

function normalizeSearchText(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function formatMessage(template, values) {
    return Object.entries(values).reduce((result, [key, value]) => {
        return result.replaceAll(`{${key}}`, value);
    }, template);
}

function getSearchTokens(searchText) {
    return String(searchText || '')
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .map((token) => normalizeSearchText(token))
        .filter(Boolean);
}

function matchesInputType(item, expectedInputType) {
    if (!expectedInputType) return true;
    if (expectedInputType === '批量数据') return !item.inputType;
    return item.inputType === expectedInputType;
}

function matchesSearch(item, searchText) {
    const searchTokens = getSearchTokens(searchText);
    if (searchTokens.length === 0) return true;

    const searchableFields = [
        item.name,
        item.experience,
        item.HMaster,
        item.province,
        getProvinceDisplay(item.province),
        item.prov,
        item.addr,
        item.scandal,
        item.contact,
        item.else,
        item.inputType,
        getInputTypeDisplay(item.inputType)
    ];

    const searchableText = searchableFields.map((field) => normalizeSearchText(field)).join(' ');
    return searchTokens.every((token) => searchableText.includes(token));
}

function getInputTypeDisplay(value) {
    if (!value || value === '批量数据') {
        return i18n.data.inputTypes.bulk;
    }

    if (value === '受害者本人') {
        return i18n.data.inputTypes.self;
    }

    if (value === '受害者的代理人') {
        return i18n.data.inputTypes.agent;
    }

    return value;
}

function getProvinceDisplay(value) {
    return i18n.data.provinceNames[value] || value || '';
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showMapDataError(message) {
    const safeMessage = escapeHtml(message || i18n.map.list.loadFailed);
    const lastSyncedElement = document.getElementById('lastSynced');
    const avgAgeElement = document.getElementById('avgAge');
    const mapElement = document.getElementById('map');

    if (lastSyncedElement) {
        lastSyncedElement.textContent = safeMessage;
    }

    if (avgAgeElement) {
        avgAgeElement.textContent = safeMessage;
    }

    if (mapElement) {
        mapElement.innerHTML = `<p style="padding: 1rem; text-align: center;">${safeMessage}</p>`;
    }
}

function createPieChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
            padding: {
                top: 8,
                right: 8,
                bottom: 8,
                left: 8
            }
        },
        radius: '78%',
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    boxWidth: 12,
                    boxHeight: 12,
                    padding: 12,
                    usePointStyle: true,
                    pointStyle: 'rectRounded',
                    font: {
                        size: 11
                    }
                }
            }
        }
    };
}

function createProvincePieChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
            padding: {
                top: 4,
                right: 4,
                bottom: 4,
                left: 4
            }
        },
        radius: '90%',
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    boxWidth: 10,
                    boxHeight: 10,
                    padding: 10,
                    usePointStyle: true,
                    pointStyle: 'rectRounded',
                    font: {
                        size: 10
                    }
                }
            }
        }
    };
}

function createBarChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        layout: {
            padding: {
                top: 8,
                right: 12,
                bottom: 8,
                left: 8
            }
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                callbacks: {
                    label(context) {
                        return `${context.label}: ${context.parsed.x}`;
                    }
                }
            }
        },
        scales: {
            x: {
                beginAtZero: true,
                ticks: {
                    precision: 0,
                    color: '#5a6d80'
                },
                grid: {
                    color: 'rgba(112, 136, 163, 0.14)'
                },
                border: {
                    display: false
                }
            },
            y: {
                ticks: {
                    color: '#30485f',
                    font: {
                        size: 12
                    }
                },
                grid: {
                    display: false
                },
                border: {
                    display: false
                }
            }
        }
    };
}

//const categories = []; // 存放省份名
//const selfData = [];   // 存放本人填写数
//const agentData = [];  // 存放代理人填写数

const map = L.map('map').setView([37.5, 109], 4); // 預設視角
const CNprov = '/cn.json'

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    minZoom: 4
}).addTo(map);

let provList = Array.from({ length: 40 }, () => Array(2).fill());
window.getSharedMapData()
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
        new Chart(document.getElementById('prov'), {
            type: 'pie',
            data: {
                labels: statistics.map(item => getProvinceDisplay(item.province)),
                datasets:[{
                    data: statistics.map(item => item.count),
                    backgroundColor: [
                        '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff',
                        '#ff9f40', '#4ed5b0', '#f44336', '#8bc34a', '#2196f3',
                        '#e91e63', '#00bcd4', '#cddc39', '#ff5722', '#795548',
                        '#607d8b', '#8bc34a', '#b39ddb', '#ffab91', '#d1c4e9',
                        '#fff59d', '#ffe0b2', '#b2dfdb', '#cfd8dc', '#ffccbc',
                        '#f8bbd0', '#e1bee7', '#d1c4e9', '#c8e6c9', '#ffecb3',
                        '#fff9c4', '#f0f4c3', '#d7ccc8', '#f5f5f5', '#eeeeee'
                    ]
                }]
            },
            options: createProvincePieChartOptions()
        })

        const lastSyncedTime = jsonResponse.last_synced;
        function timeUpdate() {
            const elapsed = Math.floor((Date.now() - lastSyncedTime) / 1000);
            const refreshLink = elapsed > 300000 ? `, <a href="">${escapeHtml(i18n.map.stats.refresh)}</a>` : '';
            document.getElementById('lastSynced').innerHTML = `<b>${escapeHtml(formatMessage(i18n.map.stats.secondsAgo, { seconds: elapsed }))}</b>${refreshLink}`;
        }
        setInterval(timeUpdate, 1000);
        timeUpdate();
        
        document.getElementById('avgAge').textContent = formatMessage(i18n.map.stats.ageValue, {
            age: jsonResponse.avg_age.toFixed(2)
        });
    

        let count_num0 = 0;
        let count_num1 = 0;
        let count_num2 = 0;
        data.forEach(item => {
            if(item.inputType == '受害者本人') count_num0++;
            if(item.inputType == '受害者的代理人')count_num1++;
            if(!item.inputType)count_num2++;
        })
        new Chart(document.getElementById('updatedForm'), {
        type: 'bar',
            data: {
                labels: [
                    i18n.map.tags.self,
                    i18n.map.tags.agent,
                    i18n.map.tags.bulk
                ],
                datasets: [{
                    label: i18n.map.stats.submittedForms,
                    data: [count_num0, count_num1, count_num2],
                    backgroundColor: ['#ff6384','#36a2eb','#ffce56'],
                    borderRadius: 999,
                    borderSkipped: false,
                    barPercentage: 0.7,
                    categoryPercentage: 0.72
                }]
            },
            options: createBarChartOptions()
        });
        
        
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        const inputType = urlParams.get('inputType');// 找筛选条件
        const inputSearch = (urlParams.get('search') || '').trim();
        const filteredData = data.filter((item) => matchesInputType(item, inputType) && matchesSearch(item, inputSearch));

        filteredData.forEach(item => {
            const marker = L.marker([item.lat, item.lng]).addTo(map);

            // 1. 鼠標指到圖標：顯示標題 (Tooltip)
            marker.bindTooltip(`<strong>${escapeHtml(item.name)}</strong>`, {
                sticky: true, 
                direction: 'top' 
            });

            // 2. 點擊：顯示所有詳細資訊 (Popup)
            const popupContent = `
                <div class="custom-popup">
                    <b>${escapeHtml(item.name)}</b><br>
                    <small>${escapeHtml(item.prov)}</small>
                    <p>${escapeHtml(item.HMaster)}</p><hr>
                    <address>${escapeHtml(item.addr)}</address>
                    <a href="#${item.name}">${escapeHtml(i18n.map.list.viewDetails)}</a>
                </div>
            `;
            marker.bindPopup(popupContent);
        });
    })
    .catch(error => {
        console.error('地图数据加载失败:', error);
        showMapDataError(i18n.map.list.loadFailed);
    });
})();
