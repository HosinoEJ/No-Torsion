(() => {
function getColor(d) {
    return d > 300 ? '#800026' :
           d > 200  ? '#BD0026' :
           d > 100  ? '#E31A1C' :
           d > 50  ? '#FC4E2A' :
           d > 20   ? '#FD8D3C' :
           d > 10   ? '#FEB24C' :
           d > 5   ? '#FED976' :
                      '#FFEDA0';
}

const i18n = window.I18N;
const MAP_DATA_REFRESH_INTERVAL_SECONDS = 300;
const { getElapsedSeconds, renderLastSyncedValue } = window.MapTimeUtils;
const { getSchoolStatsKey, groupSchoolRecords } = window.MapRecordStats;
const {
    buildProvinceCountMap,
    getProvinceCodeFromFeature
} = window.MapProvinceUtils || {};
const themeMediaQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

let mapTileLayer = null;
let provinceLayer = null;
let provinceFillLayer = null;
const chartInstances = [];
const TILE_ERROR_THRESHOLD = 6;
const BASE_TILE_PROVIDERS = {
    dark: [
        {
            name: 'carto-dark',
            url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            options: {
                attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
                subdomains: 'abcd'
            }
        },
        {
            name: 'carto-light',
            url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            options: {
                attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
                subdomains: 'abcd'
            }
        },
        {
            name: 'osm-standard',
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            options: {
                attribution: '© OpenStreetMap'
            }
        }
    ],
    light: [
        {
            name: 'osm-standard',
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            options: {
                attribution: '© OpenStreetMap'
            }
        },
        {
            name: 'carto-light',
            url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            options: {
                attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
                subdomains: 'abcd'
            }
        }
    ]
};
let mapTileProviderIndex = 0;

// 底图、边框和图表主题都跟随系统深色模式一起切换。
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

// 统一管理地图和图表的配色，避免多个组件各自判断深浅色模式。
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

function setMapTileFallbackState(isUnavailable) {
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        return;
    }

    mapElement.classList.toggle('map--tiles-unavailable', Boolean(isUnavailable));
}

// 深浅色主题使用不同底图源，但对外保持同一个挂载接口。
function getBaseTileProviders(minZoom) {
    const themeKey = isDarkMode() ? 'dark' : 'light';

    return BASE_TILE_PROVIDERS[themeKey].map((provider) => ({
        ...provider,
        options: {
            ...provider.options,
            maxZoom: 20,
            minZoom
        }
    }));
}

function createBaseTileLayer(minZoom) {
    const providers = getBaseTileProviders(minZoom);
    const activeProvider = providers[Math.min(mapTileProviderIndex, providers.length - 1)];

    return L.tileLayer(activeProvider.url, activeProvider.options);
}

function registerBaseTileLayerEvents(targetMap, minZoom) {
    const providers = getBaseTileProviders(minZoom);
    const activeProvider = providers[mapTileProviderIndex];
    let hasLoadedAnyTile = false;
    let tileErrorCount = 0;
    let fallbackHandled = false;

    mapTileLayer.on('tileload', () => {
        hasLoadedAnyTile = true;
        tileErrorCount = 0;
        setMapTileFallbackState(false);
    });

    mapTileLayer.on('tileerror', () => {
        if (hasLoadedAnyTile || fallbackHandled) {
            return;
        }

        tileErrorCount += 1;
        if (tileErrorCount < TILE_ERROR_THRESHOLD) {
            return;
        }

        fallbackHandled = true;
        const nextProviderIndex = mapTileProviderIndex + 1;

        if (nextProviderIndex >= providers.length) {
            setMapTileFallbackState(true);
            console.warn(`地图底图加载失败，所有备用瓦片源都不可用。当前主题起始源：${activeProvider.name}`);
            return;
        }

        mapTileProviderIndex = nextProviderIndex;
        console.warn(`地图底图加载失败，切换到备用瓦片源：${providers[nextProviderIndex].name}`);
        mountBaseTileLayer(targetMap, minZoom, { preserveProviderIndex: true });
    });
}

function mountBaseTileLayer(targetMap, minZoom, { preserveProviderIndex = false } = {}) {
    if (!preserveProviderIndex) {
        mapTileProviderIndex = 0;
    }

    if (mapTileLayer) {
        mapTileLayer.off();
        targetMap.removeLayer(mapTileLayer);
    }

    setMapTileFallbackState(false);
    mapTileLayer = createBaseTileLayer(minZoom);
    registerBaseTileLayerEvents(targetMap, minZoom);
    mapTileLayer.addTo(targetMap);
}

// 搜索时同样忽略大小写和空白，兼容姓名、地址、地区的混合检索。
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

// inputType 为空时视为历史批量数据，这样能兼容旧数据结构。
function matchesInputType(item, expectedInputType) {
    if (!expectedInputType) return true;
    if (expectedInputType === '批量数据') return !item.inputType;
    return item.inputType === expectedInputType;
}

// 搜索词会在多字段聚合后的字符串里逐个匹配，支持组合搜索。
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

function getProvinceLabelLatLng(feature, layer) {
    const center = feature?.properties?.center;
    if (Array.isArray(center) && center.length >= 2) {
        return L.latLng(center[1], center[0]);
    }

    return layer.getBounds().getCenter();
}

function bindProvinceLabel(feature, layer) {
    const provinceName = feature?.properties?.name || feature?.properties?.province || '';
    if (!provinceName) {
        return;
    }

    const labelLatLng = getProvinceLabelLatLng(feature, layer);
    layer.bindTooltip(escapeHtml(provinceName), {
        permanent: true,
        direction: 'center',
        className: 'map-province-label',
        interactive: false,
        opacity: 1
    });
    layer.openTooltip(labelLatLng);
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

function showMapDataError(message) {
    const safeMessage = escapeHtml(message || i18n.map.list.loadFailed);
    const lastSyncedElement = document.getElementById('lastSynced');
    const avgAgeElement = document.getElementById('avgAge');
    const schoolNumElement = document.getElementById('schoolNum');
    const mapElement = document.getElementById('map');
    const { error: errorColor } = getThemeColors();

    if (lastSyncedElement) {
        lastSyncedElement.textContent = safeMessage;
    }

    if (avgAgeElement) {
        avgAgeElement.textContent = safeMessage;
    }

    if(schoolNumElement) {
        schoolNumElement.textContent = safeMessage;
    }

    if (mapElement) {
        mapElement.innerHTML = `<p style="padding: 1rem; text-align: center; color: ${errorColor};">${safeMessage}</p>`;
    }
}

// 各类图表都通过工厂函数生成配置，这样主题切换时更容易统一更新。
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

const map = L.map('map', {
    // Workers 部署里省级 GeoJSON 偶发出现 SVG 路径存在但不可见的情况，
    // 这里优先使用 Canvas 渲染，并继续保留后面的尺寸重算兜底。
    preferCanvas: true
}).setView([37.5, 109], 4); // 預設視角
const provinceLayerRenderer = L.canvas({ padding: 0.5 });
const CNprov = window.ASSET_VERSION
    ? `/cn.json?v=${encodeURIComponent(window.ASSET_VERSION)}`
    : '/cn.json';
let pendingMapLayoutRefreshId = 0;

function ensureProvincePanes() {
    if (!map.getPane('provinceFillPane')) {
        map.createPane('provinceFillPane');
    }

    if (!map.getPane('provinceBorderPane')) {
        map.createPane('provinceBorderPane');
    }

    map.getPane('provinceFillPane').style.zIndex = '625';
    map.getPane('provinceFillPane').style.pointerEvents = 'none';
    map.getPane('provinceBorderPane').style.zIndex = '640';
    map.getPane('provinceBorderPane').style.pointerEvents = 'none';
}

function getProvinceFillOpacity(count) {
    if (count > 100) return 0.42;
    if (count > 50) return 0.34;
    if (count > 10) return 0.28;
    if (count > 0) return 0.18;
    return 0.1;
}

function scheduleMapLayoutRefresh(delayMs = 0) {
    window.clearTimeout(pendingMapLayoutRefreshId);
    pendingMapLayoutRefreshId = window.setTimeout(() => {
        map.invalidateSize({ pan: false, animate: false });

        if (provinceFillLayer && typeof provinceFillLayer.bringToFront === 'function') {
            provinceFillLayer.bringToFront();
        }

        if (provinceLayer && typeof provinceLayer.bringToFront === 'function') {
            provinceLayer.bringToFront();
        }
    }, delayMs);
}

ensureProvincePanes();
mountBaseTileLayer(map, 4);
map.whenReady(() => {
    scheduleMapLayoutRefresh();
});

window.addEventListener('load', () => {
    scheduleMapLayoutRefresh(64);
}, { once: true });

window.addEventListener('pageshow', () => {
    scheduleMapLayoutRefresh(64);
});

window.addEventListener('resize', () => {
    scheduleMapLayoutRefresh(120);
});

addThemeChangeListener(() => {
    mountBaseTileLayer(map, 4);

    if (provinceLayer) {
        provinceLayer.setStyle({
            color: getThemeColors().mapOutline
        });
    }

    syncExistingChartTheme();
    scheduleMapLayoutRefresh(32);
});

let provList = Array.from({ length: 40 }, () => Array(2).fill());
window.getSharedMapData()
    .then(jsonResponse => {
        const data = jsonResponse.data;
        const provinceCountSource = Array.isArray(jsonResponse.statistics) && jsonResponse.statistics.length > 0
            ? jsonResponse.statistics
            : data;
        const provinceCountMap = typeof buildProvinceCountMap === 'function'
            ? buildProvinceCountMap(provinceCountSource)
            : new Map();

        
        
        fetch(CNprov)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`地图图层返回 ${response.status}`);
                }

                return response.json();
            })
            .then(dataP => {
                provinceFillLayer = L.geoJSON(dataP, {
                    pane: 'provinceFillPane',
                    renderer: provinceLayerRenderer,
                    interactive: false,
                    style: function(feature) {
                        const provinceCode = typeof getProvinceCodeFromFeature === 'function'
                            ? getProvinceCodeFromFeature(feature)
                            : '';
                        const count = provinceCountMap.get(provinceCode) || 0;

                        return {
                            fillColor: getColor(count),
                            weight: 0,
                            opacity: 0,
                            color: 'transparent',
                            fillOpacity: getProvinceFillOpacity(count)
                        };
                    }
                }).addTo(map);

                provinceLayer = L.geoJSON(dataP, {
                    pane: 'provinceBorderPane',
                    renderer: provinceLayerRenderer,
                    interactive: false,
                    style: function(feature) {
                        return {
                            weight: 2,
                            opacity: 1,
                            color: getThemeColors().mapOutline,
                            dashArray: '3',
                            fillOpacity: 0
                        };
                    },
                    onEachFeature: function(feature, layer) {
                        bindProvinceLabel(feature, layer);
                    }
                }).addTo(map);

                if (typeof provinceFillLayer.bringToFront === 'function') {
                    provinceFillLayer.bringToFront();
                }

                if (typeof provinceLayer.bringToFront === 'function') {
                    provinceLayer.bringToFront();
                }

                const provinceBounds = provinceLayer.getBounds();
                if (provinceBounds && typeof provinceBounds.isValid === 'function' && provinceBounds.isValid()) {
                    map.fitBounds(provinceBounds.pad(0.03), {
                        animate: false,
                        maxZoom: 4
                    });
                }

                scheduleMapLayoutRefresh(32);
                //addMarkers(data);
            })
            .catch(err => console.error('加载地图数据失败:', err));

        const statistics = jsonResponse.statistics
        const provinceChart = new Chart(document.getElementById('prov'), {//帶批處理的各省數據，這個可以表示所有的分佈數據
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

        const statisticsForm = jsonResponse.statisticsForm;
        const provinceChartForm = new Chart(document.getElementById('provForm'), {//提交的表單的各省數據
            type: 'pie',
            data: {
                labels: statisticsForm.map(item => getProvinceDisplay(item.province)),
                datasets:[{
                    data: statisticsForm.map(item => item.count),
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
        chartInstances.push(provinceChartForm);

        const lastSyncedElement = document.getElementById('lastSynced');
        let lastSyncedTime = Number(jsonResponse.last_synced);
        let refreshInProgress = false;

        async function forceRefreshMapData() {
            if (refreshInProgress) {
                return;
            }

            // 防止用户连续点击刷新导致重复请求和重复 reload。
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

        // “上次同步时间”显示每秒重绘一次，并根据状态切换成刷新按钮。
        function timeUpdate() {
            const elapsed = getElapsedSeconds(lastSyncedTime);
            renderLastSyncedValue(lastSyncedElement, {
                elapsedSeconds: elapsed,
                refreshInProgress,
                onRefresh: forceRefreshMapData,
                i18n,
                refreshIntervalSeconds: MAP_DATA_REFRESH_INTERVAL_SECONDS
            });
        }

        setInterval(timeUpdate, 1000);
        timeUpdate();
        
        document.getElementById('avgAge').textContent = formatMessage(i18n.map.stats.ageValue, {
            age: jsonResponse.avg_age.toFixed(2)
        });
        document.getElementById('schoolNum').textContent = jsonResponse.schoolNum;
    

        let count_num0 = 0;
        let count_num1 = 0;
        data.forEach(item => {
            if(item.inputType == '受害者本人') count_num0++;
            if(item.inputType == '受害者的代理人')count_num1++;
        })
        const updatedFormChart = new Chart(document.getElementById('updatedForm'), {
        type: 'bar',
            data: {
                labels: [
                    i18n.map.tags.self,
                    i18n.map.tags.agent
                ],
                datasets: [{
                    label: i18n.map.stats.submittedForms,
                    data: [count_num0, count_num1],
                    backgroundColor: ['#ff6384','#36a2eb'],
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
        // 地图 marker 和列表详情共用同一份筛选结果，保证锚点能一一对应。
        const filteredData = data.filter((item) => matchesInputType(item, inputType) && matchesSearch(item, inputSearch));
        const groupedFilteredData = groupSchoolRecords(filteredData);
        const groupIndexBySchoolKey = new Map(
            groupedFilteredData.map((group, index) => [group.schoolKey, index])
        );

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
            const schoolKey = getSchoolStatsKey(item);
            const targetGroupIndex = groupIndexBySchoolKey.has(schoolKey)
                ? groupIndexBySchoolKey.get(schoolKey)
                : index;

            popupContent.className = 'custom-popup';
            nameElement.textContent = item.name || '';
            regionElement.textContent = item.prov || '';
            headmasterElement.textContent = item.HMaster || '';
            addressElement.textContent = item.addr || '';
            detailLink.href = `#${getRecordAnchorId(targetGroupIndex)}`;
            detailLink.textContent = i18n.map.list.viewDetails;

            popupContent.appendChild(nameElement);
            popupContent.appendChild(document.createElement('br'));
            popupContent.appendChild(regionElement);
            popupContent.appendChild(headmasterElement);
            popupContent.appendChild(dividerElement);
            popupContent.appendChild(addressElement);
            // 点击弹窗可直接跳到列表中的聚合学校卡片，而不是原始数据行。
            popupContent.appendChild(detailLink);

            marker.bindPopup(popupContent);
        });
    })
    .catch(error => {
        console.error('地图数据加载失败:', error);
        showMapDataError(i18n.map.list.loadFailed);
    });
})();
