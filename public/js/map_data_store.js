(() => {
    const CACHE_TTL_MS = 300000;
    const CACHE_PREFIX = 'map-data-cache:';
    const inMemoryRequests = new Map();

    function getCacheKey(apiUrl) {
        return `${CACHE_PREFIX}${apiUrl}`;
    }

    function isValidMapPayload(payload) {
        return Boolean(
            payload
            && Array.isArray(payload.data)
            && Array.isArray(payload.statistics)
            && typeof payload.avg_age === 'number'
        );
    }

    function readCache(apiUrl) {
        try {
            const rawValue = window.sessionStorage.getItem(getCacheKey(apiUrl));
            if (!rawValue) {
                return null;
            }

            const parsedValue = JSON.parse(rawValue);
            if (!parsedValue || !isValidMapPayload(parsedValue.payload)) {
                return null;
            }

            if (Date.now() - parsedValue.savedAt > CACHE_TTL_MS) {
                return null;
            }

            return parsedValue.payload;
        } catch (error) {
            console.warn('读取地图缓存失败:', error);
            return null;
        }
    }

    function writeCache(apiUrl, payload) {
        try {
            window.sessionStorage.setItem(getCacheKey(apiUrl), JSON.stringify({
                savedAt: Date.now(),
                payload
            }));
        } catch (error) {
            console.warn('写入地图缓存失败:', error);
        }
    }

    async function fetchMapPayload(apiUrl) {
        const response = await window.fetch(apiUrl);
        const payload = await response.json();

        if (!response.ok || !isValidMapPayload(payload)) {
            throw new Error((payload && payload.error) || '數據加載失敗');
        }

        writeCache(apiUrl, payload);
        return payload;
    }

    window.getSharedMapData = async function getSharedMapData() {
        const apiUrl = window.API_URL;
        const cachedPayload = readCache(apiUrl);

        if (cachedPayload) {
            return cachedPayload;
        }

        if (inMemoryRequests.has(apiUrl)) {
            return inMemoryRequests.get(apiUrl);
        }

        const request = fetchMapPayload(apiUrl)
            .finally(() => {
                inMemoryRequests.delete(apiUrl);
            });

        inMemoryRequests.set(apiUrl, request);
        return request;
    };
})();
