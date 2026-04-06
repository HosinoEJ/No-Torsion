(() => {
    let currentMarker = null;
    let formMap = null;
    let formMapTileLayer = null;
    let leafletAssetsPromise = null;
    const i18n = window.I18N;
    const LEAFLET_CSS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    const LEAFLET_CSS_INTEGRITY = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    const LEAFLET_JS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    const LEAFLET_JS_INTEGRITY = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    const TILE_ERROR_THRESHOLD = 6;
    const FORM_MAP_TILE_PROVIDERS = {
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
    const openMapButton = document.getElementById('openMapButton');
    const themeMediaQuery = typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
    let formMapTileProviderIndex = 0;

    function isDarkMode() {
        return Boolean(themeMediaQuery && themeMediaQuery.matches);
    }

    function setFormMapTileFallbackState(isUnavailable) {
        const mapContainer = document.getElementById('map');
        if (!mapContainer) {
            return;
        }

        mapContainer.classList.toggle('map--tiles-unavailable', Boolean(isUnavailable));
    }

    function getFormMapTileProviders() {
        const themeKey = isDarkMode() ? 'dark' : 'light';

        return FORM_MAP_TILE_PROVIDERS[themeKey].map((provider) => ({
            ...provider,
            options: {
                ...provider.options,
                maxZoom: 20,
                minZoom: 3
            }
        }));
    }

    function createFormMapTileLayer() {
        const providers = getFormMapTileProviders();
        const activeProvider = providers[Math.min(formMapTileProviderIndex, providers.length - 1)];

        return L.tileLayer(activeProvider.url, activeProvider.options);
    }

    function registerFormMapTileEvents() {
        const providers = getFormMapTileProviders();
        const activeProvider = providers[formMapTileProviderIndex];
        let hasLoadedAnyTile = false;
        let tileErrorCount = 0;
        let fallbackHandled = false;

        formMapTileLayer.on('tileload', () => {
            hasLoadedAnyTile = true;
            tileErrorCount = 0;
            setFormMapTileFallbackState(false);
        });

        formMapTileLayer.on('tileerror', () => {
            if (hasLoadedAnyTile || fallbackHandled) {
                return;
            }

            tileErrorCount += 1;
            if (tileErrorCount < TILE_ERROR_THRESHOLD) {
                return;
            }

            fallbackHandled = true;
            const nextProviderIndex = formMapTileProviderIndex + 1;

            if (nextProviderIndex >= providers.length) {
                setFormMapTileFallbackState(true);
                console.warn(`选点地图底图加载失败，所有备用瓦片源都不可用。当前主题起始源：${activeProvider.name}`);
                return;
            }

            formMapTileProviderIndex = nextProviderIndex;
            console.warn(`选点地图底图加载失败，切换到备用瓦片源：${providers[nextProviderIndex].name}`);
            mountFormMapTileLayer({ preserveProviderIndex: true });
        });
    }

    function ensureLeafletCss() {
        if (document.querySelector('link[data-form-leaflet-css]')) {
            return;
        }

        const stylesheet = document.createElement('link');
        stylesheet.rel = 'stylesheet';
        stylesheet.href = LEAFLET_CSS_URL;
        stylesheet.integrity = LEAFLET_CSS_INTEGRITY;
        stylesheet.crossOrigin = 'anonymous';
        stylesheet.setAttribute('data-form-leaflet-css', 'true');
        document.head.appendChild(stylesheet);
    }

    function loadLeafletScript() {
        return new Promise((resolve, reject) => {
            const existingScript = document.querySelector('script[data-form-leaflet-script]');
            if (existingScript) {
                existingScript.addEventListener('load', resolve, { once: true });
                existingScript.addEventListener('error', reject, { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = LEAFLET_JS_URL;
            script.async = true;
            script.integrity = LEAFLET_JS_INTEGRITY;
            script.crossOrigin = 'anonymous';
            script.setAttribute('data-form-leaflet-script', 'true');
            script.addEventListener('load', resolve, { once: true });
            script.addEventListener('error', reject, { once: true });
            document.body.appendChild(script);
        });
    }

    async function ensureLeafletAssets() {
        if (typeof L !== 'undefined') {
            return;
        }

        if (!leafletAssetsPromise) {
            ensureLeafletCss();
            leafletAssetsPromise = loadLeafletScript()
                .catch((error) => {
                    leafletAssetsPromise = null;
                    throw error;
                });
        }

        await leafletAssetsPromise;
    }

    function mountFormMapTileLayer({ preserveProviderIndex = false } = {}) {
        if (!formMap) {
            return;
        }

        if (!preserveProviderIndex) {
            formMapTileProviderIndex = 0;
        }

        if (formMapTileLayer) {
            formMapTileLayer.off();
            formMap.removeLayer(formMapTileLayer);
        }

        setFormMapTileFallbackState(false);
        formMapTileLayer = createFormMapTileLayer();
        registerFormMapTileEvents();
        formMapTileLayer.addTo(formMap);
    }

    async function ensureFormMap() {
        if (formMap) {
            return formMap;
        }

        await ensureLeafletAssets();

        const mapContainer = document.getElementById('map');
        if (!mapContainer || typeof L === 'undefined') {
            return null;
        }

        formMap = L.map(mapContainer).setView([37.5, 109], 3);
        mountFormMapTileLayer();

        formMap.on('click', function(e) {
            const lat = e.latlng.lat.toFixed(6);
            const lng = e.latlng.lng.toFixed(6);

            if (currentMarker !== null) {
                formMap.removeLayer(currentMarker);
            }

            const addressInput = document.getElementById('addr');
            if (addressInput) {
                addressInput.value = `latlng${lat},${lng}`;
            }

            currentMarker = L.marker([lat, lng]).addTo(formMap)
                .bindPopup(
                    i18n.form.hints.selectedPoint
                        .replace('{lat}', lat)
                        .replace('{lng}', lng)
                )
                .openPopup();
        });

        return formMap;
    }

    window.openMap = async function openMap() {
        const mapContainer = document.getElementById('map');
        if (!mapContainer) {
            return;
        }

        const willShowMap = mapContainer.style.display !== 'block';
        mapContainer.style.display = willShowMap ? 'block' : 'none';

        if (!willShowMap) {
            return;
        }

        if (openMapButton) {
            openMapButton.disabled = true;
        }

        let mapInstance = null;

        try {
            mapInstance = await ensureFormMap();
        } finally {
            if (openMapButton) {
                openMapButton.disabled = false;
            }
        }

        if (!mapInstance) {
            return;
        }

        setTimeout(() => {
            mapInstance.invalidateSize();
        }, 100);
    };

    if (openMapButton) {
        openMapButton.addEventListener('click', window.openMap);
    }

    if (themeMediaQuery) {
        const handleThemeChange = () => {
            if (formMap) {
                mountFormMapTileLayer();
            }
        };

        if (typeof themeMediaQuery.addEventListener === 'function') {
            themeMediaQuery.addEventListener('change', handleThemeChange);
        } else if (typeof themeMediaQuery.addListener === 'function') {
            themeMediaQuery.addListener(handleThemeChange);
        }
    }
})();
