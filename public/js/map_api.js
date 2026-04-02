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
const MAP_DATA_REFRESH_INTERVAL_SECONDS = 300;
const themeMediaQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

let mapTileLayer = null;
let provinceLayer = null;
const chartInstances = [];

function isDarkMode() {
    return Boolean(themeMediaQuery && themeMediaQuery.matches);
}

function addThemeChangeListener(listener) {
    if (!themeMediaQuery) {
        return;
    }

    if (typeof themeMediaQuery.addEventListener === 'function') {
        themeMediaQuery.addEventListener('change', listener);
        return;
    }

    if (typeof themeMediaQuery.addListener === 'function') {
        themeMediaQuery.addListener(listener);
    }
}

function getThemeColors() {
    return isDarkMode()
        ? {
            legend: '#d7e3f0',
            axis: '#a9bdd1',
            axisStrong: '#d7e3f0',
            grid: 'rgba(148, 163, 184, 0.22)',
            mapOutline: '#d6e4f0',
            error: '#e6eef7'
        }
        : {
            legend: '#30485f',
            axis: '#5a6d80',
            axisStrong: '#30485f',
            grid: 'rgba(112, 136, 163, 0.14)',
            mapOutline: 'white',
            error: '#2c3e50'
        };
}

function createBaseTileLayer(minZoom) {
    if (isDarkMode()) {
        return L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20,
            minZoom
        });
    }

    return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 20,
        minZoom
    });
}

function mountBaseTileLayer(targetMap, minZoom) {
    if (mapTileLayer) {
        targetMap.removeLayer(mapTileLayer);
    }

    mapTileLayer = createBaseTileLayer(minZoom);
    mapTileLayer.addTo(targetMap);
}

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

function getRecordAnchorId(index) {
    return `record-${index}`;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isValidTimestamp(value) {
    return Number.isFinite(value) && value > 0;
}

function getElapsedSeconds(lastSyncedTime) {
    if (!isValidTimestamp(lastSyncedTime)) {
        return null;
    }

    return Math.max(0, Math.floor((Date.now() - lastSyncedTime) / 1000));
}

function renderLastSyncedValue(lastSyncedElement, { elapsedSeconds, refreshInProgress, onRefresh }) {
    if (!lastSyncedElement) {
        return;
    }

    lastSyncedElement.replaceChildren();

    const valueElement = document.createElement('b');
    valueElement.textContent = elapsedSeconds === null
        ? i18n.common.loading
        : formatMessage(i18n.map.stats.secondsAgo, { seconds: elapsedSeconds });
    lastSyncedElement.appendChild(valueElement);

    if (elapsedSeconds === null || elapsedSeconds <= MAP_DATA_REFRESH_INTERVAL_SECONDS) {
        return;
    }

    lastSyncedElement.appendChild(document.createTextNode(', '));

    const refreshButton = document.createElement('button');
    refreshButton.type = 'button';
    refreshButton.className = 'map-refresh-button';
    refreshButton.textContent = refreshInProgress ? i18n.common.loading : i18n.map.stats.refresh;
    refreshButton.disabled = refreshInProgress;
    refreshButton.addEventListener('click', onRefresh);
    lastSyncedElement.appendChild(refreshButton);
}

function showMapDataError(message) {
    const safeMessage = escapeHtml(message || i18n.map.list.loadFailed);
    const lastSyncedElement = document.getElementById('lastSynced');
    const avgAgeElement = document.getElementById('avgAge');
    const mapElement = document.getElementById('map');
    const { error: errorColor } = getThemeColors();

    if (lastSyncedElement) {
        lastSyncedElement.textContent = safeMessage;
    }

    if (avgAgeElement) {
        avgAgeElement.textContent = safeMessage;
    }

    if (mapElement) {
        mapElement.innerHTML = `<p style="padding: 1rem; text-align: center; color: ${errorColor};">${safeMessage}</p>`;
    }
}

function createPieChartOptions() {
    const themeColors = getThemeColors();

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
                    color: themeColors.legend,
                    font: {
                        size: 11
                    }
                }
            }
        }
    };
}

function createProvincePieChartOptions() {
    const themeColors = getThemeColors();

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
                    color: themeColors.legend,
                    font: {
                        size: 10
                    }
                }
            }
        }
    };
}

function createBarChartOptions() {
    const themeColors = getThemeColors();

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
                    color: themeColors.axis
                },
                grid: {
                    color: themeColors.grid
                },
                border: {
                    display: false
                }
            },
            y: {
                ticks: {
                    color: themeColors.axisStrong,
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

function syncExistingChartTheme() {
    const themeColors = getThemeColors();

    chartInstances.forEach((chart) => {
        if (chart.options?.plugins?.legend?.labels) {
            chart.options.plugins.legend.labels.color = themeColors.legend;
        }

        if (chart.config.type === 'bar' && chart.options?.scales) {
            chart.options.scales.x.ticks.color = themeColors.axis;
            chart.options.scales.x.grid.color = themeColors.grid;
            chart.options.scales.y.ticks.color = themeColors.axisStrong;
        }

        chart.update('none');
    });
}

//const categories = []; // 存放省份名
//const selfData = [];   // 存放本人填写数
//const agentData = [];  // 存放代理人填写数

const map = L.map('map').setView([37.5, 109], 4); // 預設視角
const CNprov = '/cn.json'

mountBaseTileLayer(map, 4);

addThemeChangeListener(() => {
    mountBaseTileLayer(map, 4);

    if (provinceLayer) {
        provinceLayer.setStyle({
            color: getThemeColors().mapOutline
        });
    }

    syncExistingChartTheme();
});

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
                provinceLayer = L.geoJSON(dataP, {
                    style: function(feature) {
                        let name = feature.properties.name || feature.properties.province || "";
                        
                        const count = provinceMap[name] || 0;
                        return {
                            fillColor: getColor(count),
                            weight: 2,
                            opacity: 1,
                            color: getThemeColors().mapOutline,
                            dashArray: '3',
                            fillOpacity: 0.7
                        };
                    }
                }).addTo(map);
                //addMarkers(data);
            })
            .catch(err => console.error('加载地图数据失败:', err));

        const statistics = jsonResponse.statistics
        const provinceChart = new Chart(document.getElementById('prov'), {
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
        });
        chartInstances.push(provinceChart);

        const lastSyncedElement = document.getElementById('lastSynced');
        let lastSyncedTime = Number(jsonResponse.last_synced);
        let refreshInProgress = false;

        async function forceRefreshMapData() {
            if (refreshInProgress) {
                return;
            }

            refreshInProgress = true;
            timeUpdate();

            try {
                await window.getSharedMapData({ forceRefresh: true });
                window.location.reload();
            } catch (error) {
                console.error('地图数据刷新失败:', error);
                refreshInProgress = false;
                timeUpdate();
            }
        }

        function timeUpdate() {
            const elapsed = getElapsedSeconds(lastSyncedTime);
            renderLastSyncedValue(lastSyncedElement, {
                elapsedSeconds: elapsed,
                refreshInProgress,
                onRefresh: forceRefreshMapData
            });
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
        const updatedFormChart = new Chart(document.getElementById('updatedForm'), {
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
        chartInstances.push(updatedFormChart);
        
        
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        const inputType = urlParams.get('inputType');// 找筛选条件
        const inputSearch = (urlParams.get('search') || '').trim();
        const filteredData = data.filter((item) => matchesInputType(item, inputType) && matchesSearch(item, inputSearch));

        filteredData.forEach((item, index) => {
            const marker = L.marker([item.lat, item.lng]).addTo(map);

            // 1. 鼠標指到圖標：顯示標題 (Tooltip)
            marker.bindTooltip(`<strong>${escapeHtml(item.name)}</strong>`, {
                sticky: true, 
                direction: 'top' 
            });

            // 2. 點擊：顯示所有詳細資訊 (Popup)
            const popupContent = document.createElement('div');
            const nameElement = document.createElement('b');
            const regionElement = document.createElement('small');
            const headmasterElement = document.createElement('p');
            const dividerElement = document.createElement('hr');
            const addressElement = document.createElement('address');
            const detailLink = document.createElement('a');

            popupContent.className = 'custom-popup';
            nameElement.textContent = item.name || '';
            regionElement.textContent = item.prov || '';
            headmasterElement.textContent = item.HMaster || '';
            addressElement.textContent = item.addr || '';
            detailLink.href = `#${getRecordAnchorId(index)}`;
            detailLink.textContent = i18n.map.list.viewDetails;

            popupContent.appendChild(nameElement);
            popupContent.appendChild(document.createElement('br'));
            popupContent.appendChild(regionElement);
            popupContent.appendChild(headmasterElement);
            popupContent.appendChild(dividerElement);
            popupContent.appendChild(addressElement);
            popupContent.appendChild(detailLink);

            marker.bindPopup(popupContent);
        });
    })
    .catch(error => {
        console.error('地图数据加载失败:', error);
        showMapDataError(i18n.map.list.loadFailed);
    });
})();
