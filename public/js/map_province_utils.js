(function attachMapProvinceUtils(globalObject, factory) {
    const exports = factory(globalObject);

    if (typeof module === 'object' && module.exports) {
        module.exports = exports;
    }

    globalObject.MapProvinceUtils = exports;
})(typeof globalThis !== 'undefined' ? globalThis : this, (globalObject) => {
    const provinceMetadataByCode = normalizeProvinceMetadata(getInitialProvinceMetadataSource(globalObject));
    const provinceCodes = new Set(Object.keys(provinceMetadataByCode));
    const provinceCodeByAlias = buildProvinceCodeByAliasMap();

    function getInitialProvinceMetadataSource(scope) {
        if (scope && scope.PROVINCE_METADATA && typeof scope.PROVINCE_METADATA === 'object') {
            return scope.PROVINCE_METADATA;
        }

        if (typeof module === 'object' && module.exports && typeof require === 'function') {
            try {
                const { getClientProvinceMetadata } = require('../../config/provinceMetadata');
                return getClientProvinceMetadata();
            } catch (_error) {
                return {};
            }
        }

        return {};
    }

    function normalizeProvinceMetadata(source) {
        if (!source || typeof source !== 'object') {
            return {};
        }

        return Object.fromEntries(
            Object.entries(source).map(([code, metadata]) => [
                code,
                {
                    legacyName: String(metadata.legacyName || ''),
                    shortLabels: metadata.shortLabels || {},
                    fullLabels: metadata.fullLabels || {},
                    areaSquareKilometers: Number(metadata.areaSquareKilometers) || 0
                }
            ])
        );
    }

    function normalizeLanguage(language) {
        return language === 'zh-TW' || language === 'en' ? language : 'zh-CN';
    }

    function normalizeProvinceAlias(value) {
        return String(value || '')
            .trim()
            .replace(/\s+/g, '')
            .replace(/[（(][^）)]*[）)]/g, '')
            .replace(
                /(维吾尔自治区|維吾爾自治區|壮族自治区|壯族自治區|回族自治区|回族自治區|特别行政区|特別行政區|自治区|自治區|省|市|province|municipality|autonomousregion|specialadministrativeregion)$/giu,
                ''
            )
            .toLowerCase();
    }

    function getProvinceAliases(provinceCode) {
        const metadata = provinceMetadataByCode[provinceCode] || {};
        const aliases = new Set([
            provinceCode,
            metadata.legacyName,
            ...Object.values(metadata.shortLabels || {}),
            ...Object.values(metadata.fullLabels || {})
        ]);

        if (provinceCode === '710000') {
            aliases.add('臺灣（ROC）');
        }

        return [...aliases].filter(Boolean);
    }

    function buildProvinceCodeByAliasMap() {
        const aliasMap = new Map();

        provinceCodes.forEach((provinceCode) => {
            getProvinceAliases(provinceCode).forEach((alias) => {
                const normalizedAlias = normalizeProvinceAlias(alias);
                if (normalizedAlias) {
                    aliasMap.set(normalizedAlias, provinceCode);
                }
            });
        });

        return aliasMap;
    }

    function resolveProvinceCode(value) {
        const normalizedAlias = normalizeProvinceAlias(value);
        return provinceCodeByAlias.get(normalizedAlias) || '';
    }

    function getProvinceCodeFromFeature(feature) {
        const properties = feature && feature.properties ? feature.properties : {};
        const candidates = [
            properties.code,
            properties.filename,
            properties.province,
            properties.name,
            properties.fullname,
            properties['name_zh-CN'],
            properties['name_zh-TW'],
            properties.name_en,
            properties['fullname_zh-CN'],
            properties['fullname_zh-TW'],
            properties.fullname_en
        ];

        for (const candidate of candidates) {
            const provinceCode = resolveProvinceCode(candidate);
            if (provinceCode) {
                return provinceCode;
            }
        }

        return '';
    }

    function getProvinceCodeFromItem(item) {
        const candidates = [
            item && item.provinceCode,
            item && item.code,
            item && item.province,
            item && item.name,
            item && item.fullname,
            item && item['name_zh-CN'],
            item && item['name_zh-TW'],
            item && item.name_en,
            item && item['fullname_zh-CN'],
            item && item['fullname_zh-TW'],
            item && item.fullname_en
        ];

        for (const candidate of candidates) {
            const provinceCode = resolveProvinceCode(candidate);
            if (provinceCode) {
                return provinceCode;
            }
        }

        return '';
    }

    function getProvinceCountIncrement(item) {
        const numericCount = Number(item && item.count);
        return Number.isFinite(numericCount) ? numericCount : 1;
    }

    function getProvinceMetadata(value) {
        const provinceCode = resolveProvinceCode(value);
        return provinceCode ? provinceMetadataByCode[provinceCode] || null : null;
    }

    function getProvinceDisplayName(value, language) {
        const metadata = getProvinceMetadata(value);

        if (!metadata) {
            return '';
        }

        const resolvedLanguage = normalizeLanguage(language);

        if (resolvedLanguage === 'zh-CN') {
            return metadata.fullLabels['zh-CN'] || metadata.shortLabels['zh-CN'] || '';
        }

        return metadata.shortLabels[resolvedLanguage]
            || metadata.fullLabels[resolvedLanguage]
            || metadata.shortLabels['zh-CN']
            || '';
    }

    function getFeatureProvinceDisplayName(feature, language) {
        const properties = feature && feature.properties ? feature.properties : {};
        const resolvedLanguage = normalizeLanguage(language);
        const localizedNameKey = resolvedLanguage === 'en'
            ? 'name_en'
            : `name_${resolvedLanguage}`;

        return properties[localizedNameKey]
            || getProvinceDisplayName(getProvinceCodeFromFeature(feature), resolvedLanguage)
            || properties.name
            || properties.fullname
            || '';
    }

    function getProvinceAreaSquareKilometers(value) {
        const metadata = getProvinceMetadata(value);
        return Number(metadata && metadata.areaSquareKilometers) || 0;
    }

    function buildProvinceCountMap(items) {
        const countMap = new Map();

        (Array.isArray(items) ? items : []).forEach((item) => {
            const provinceCode = getProvinceCodeFromItem(item);
            if (!provinceCode) {
                return;
            }

            countMap.set(provinceCode, (countMap.get(provinceCode) || 0) + getProvinceCountIncrement(item));
        });

        return countMap;
    }

    function buildProvinceDensityMap(items) {
        const densityMap = new Map();

        buildProvinceCountMap(items).forEach((count, provinceCode) => {
            const areaSquareKilometers = getProvinceAreaSquareKilometers(provinceCode);
            densityMap.set(
                provinceCode,
                areaSquareKilometers > 0 ? count / areaSquareKilometers : 0
            );
        });

        return densityMap;
    }

    return {
        buildProvinceCountMap,
        buildProvinceDensityMap,
        getFeatureProvinceDisplayName,
        getProvinceAreaSquareKilometers,
        getProvinceCodeFromFeature,
        getProvinceDisplayName,
        normalizeProvinceAlias,
        resolveProvinceCode
    };
});
