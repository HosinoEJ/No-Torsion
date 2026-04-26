import {
  memo,
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState
} from 'react';
import L from 'leaflet';
import {
  AGENT_IDENTITY,
  buildLocalizedFormConfig,
  buildLocalizedInstitutionCorrectionRules,
  CUSTOM_AGENT_RELATIONSHIP_OPTION,
  CUSTOM_EXIT_METHOD_OPTION,
  CUSTOM_LEGAL_AID_OPTION,
  CUSTOM_OTHER_SEX_OPTION,
  CUSTOM_PARENT_MOTIVATION_OPTION,
  CUSTOM_VIOLENCE_CATEGORY_OPTION,
  OTHER_SEX_OPTION,
  SELF_IDENTITY
} from './formRuntimeConfig';
import {
  loadAreaSelectorPayload,
  loadBlogArticlePayload,
  loadBlogIndexPayload
} from './staticContent';
import {
  buildNoTorsionBackendConfig,
  hasConfiguredNoTorsionBackend
} from './noTorsionBackend.mjs';

const REACT_PORTAL_ENHANCED_FORM_VARIANT = 'react_portal_enhanced';
const BLOG_TRANSLATION_REQUEST_BATCH_SIZE = 6;
const EASTER_EGG_CLICK_TARGET = 6;
const EASTER_EGG_CLICK_WINDOW_MS = 2400;
const EASTER_EGG_TRIGGER_EVENT = 'nct:easter-egg-activate';
const EASTER_EGG_IMAGE_SRC = 'https://avatars.githubusercontent.com/u/177436503?v=4';
const EASTER_EGG_MIDI_SRC = '/media/easter-eggs/EasterEgg.mid';
const SCHOOL_MARKER_SCALE = 0.75;
const SCHOOL_MARKER_DEFAULT_OPACITY = 0.75;
const SCHOOL_MARKER_MAX_OPACITY = 1.0;
const SCHOOL_MARKER_SHADOW_URL = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
const SCHOOL_MARKER_DEFAULT_COLOR = '#36a2eb';
const SCHOOL_MARKER_REPORT_MIN_COLOR = '#fca5a5';
const SCHOOL_MARKER_REPORT_MAX_COLOR = '#ff0000';
const PROVINCE_DENSITY_FILL_OPACITY = 0.75;
const TILE_ERROR_THRESHOLD = 6;
const BASE_TILE_PROVIDERS = {
  dark: [
    {
      name: 'carto-dark',
      options: {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd'
      },
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    },
    {
      name: 'carto-light',
      options: {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd'
      },
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
    },
    {
      name: 'osm-standard',
      options: {
        attribution: '© OpenStreetMap'
      },
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    }
  ],
  light: [
    {
      name: 'osm-standard',
      options: {
        attribution: '© OpenStreetMap'
      },
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    },
    {
      name: 'carto-light',
      options: {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd'
      },
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
    }
  ]
};

const MAP_FILTER_OPTIONS = [
  { value: '', key: ['map', 'tags', 'all'], fallback: 'All' },
  { value: SELF_IDENTITY, key: ['map', 'tags', 'self'], fallback: 'Self' },
  { value: AGENT_IDENTITY, key: ['map', 'tags', 'agent'], fallback: 'Agent' },
  { value: '批量数据', key: ['map', 'tags', 'bulk'], fallback: 'Bulk' }
];
const RECORD_TRANSLATION_FIELD_CONFIGS = [
  {
    fieldKey: 'experience',
    originalLabel: '受害者经历',
    sourceKey: 'experience',
    titlePath: ['form', 'fields', 'experience'],
    titleFallback: 'Experience'
  },
  {
    fieldKey: 'scandal',
    originalLabel: '学校丑闻',
    sourceKey: 'scandal',
    titlePath: ['form', 'fields', 'scandal'],
    titleFallback: 'Scandal'
  },
  {
    fieldKey: 'other',
    originalLabel: '其他',
    sourceKey: 'else',
    titlePath: ['form', 'fields', 'other'],
    titleFallback: 'Other'
  }
];

let sharedMapPayload = null;
let sharedMapRequest = null;
let sharedProvinceGeoJson = null;
let sharedProvinceGeoJsonRequest = null;
const schoolMarkerIconCache = new Map();
const midiSequenceCache = new Map();
const translationMemoryCache = new Map();
let activeMidiPlayback = null;

function readPath(source, path, fallback = '') {
  let cursor = source;

  for (const segment of path) {
    if (!cursor || typeof cursor !== 'object') {
      return fallback;
    }

    cursor = cursor[segment];
  }

  return cursor == null ? fallback : cursor;
}

function formatMessage(template, values = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => (
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : `{${key}}`
  ));
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toHexChannel(value) {
  return Math.round(value).toString(16).padStart(2, '0');
}

function interpolateHexColor(startColor, endColor, ratio) {
  const normalizedRatio = Math.min(1, Math.max(0, Number(ratio) || 0));
  const startChannels = [
    parseInt(startColor.slice(1, 3), 16),
    parseInt(startColor.slice(3, 5), 16),
    parseInt(startColor.slice(5, 7), 16)
  ];
  const endChannels = [
    parseInt(endColor.slice(1, 3), 16),
    parseInt(endColor.slice(3, 5), 16),
    parseInt(endColor.slice(5, 7), 16)
  ];

  return `#${startChannels.map((startChannel, index) => (
    toHexChannel(startChannel + ((endChannels[index] - startChannel) * normalizedRatio))
  )).join('')}`;
}

function getProvinceDensityColor(density, maxDensity) {
  if (!(density > 0) || !(maxDensity > 0)) {
    return 'transparent';
  }

  return interpolateHexColor('#fed976', '#800026', density / maxDensity);
}

function scaleMarkerDimension(value) {
  return Math.round(value * SCHOOL_MARKER_SCALE);
}

function createSchoolMarkerSvgDataUrl(fillColor) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
      <path
        d="M12.5 0C5.596 0 0 5.596 0 12.5C0 20.774 12.5 41 12.5 41C12.5 41 25 20.774 25 12.5C25 5.596 19.404 0 12.5 0Z"
        fill="${fillColor}"
        stroke="rgba(255,255,255,0.95)"
        stroke-width="1.5"
      />
      <circle cx="12.5" cy="12.5" r="4.5" fill="rgba(255,255,255,0.92)" />
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createSchoolMarkerIcon(fillColor) {
  return L.icon({
    className: 'school-marker-icon',
    iconAnchor: [scaleMarkerDimension(12), scaleMarkerDimension(41)],
    iconSize: [scaleMarkerDimension(25), scaleMarkerDimension(41)],
    iconUrl: createSchoolMarkerSvgDataUrl(fillColor),
    popupAnchor: [scaleMarkerDimension(1), scaleMarkerDimension(-34)],
    shadowAnchor: [scaleMarkerDimension(13), scaleMarkerDimension(41)],
    shadowSize: [scaleMarkerDimension(41), scaleMarkerDimension(41)],
    shadowUrl: SCHOOL_MARKER_SHADOW_URL,
    tooltipAnchor: [scaleMarkerDimension(16), scaleMarkerDimension(-28)]
  });
}

function getSchoolMarkerIcon(fillColor) {
  if (!schoolMarkerIconCache.has(fillColor)) {
    schoolMarkerIconCache.set(fillColor, createSchoolMarkerIcon(fillColor));
  }

  return schoolMarkerIconCache.get(fillColor);
}

function getSchoolMarkerReportCount(schoolReportStats) {
  return Number(schoolReportStats && schoolReportStats.selfCount || 0)
    + Number(schoolReportStats && schoolReportStats.agentCount || 0);
}

function getSchoolMarkerReportRatio(schoolReportStats, maxReportedMarkerCount) {
  const reportedMarkerCount = getSchoolMarkerReportCount(schoolReportStats);
  return reportedMarkerCount > 0 && maxReportedMarkerCount > 0
    ? Math.min(1, reportedMarkerCount / maxReportedMarkerCount)
    : 0;
}

function getSchoolMarkerColor(schoolReportStats, maxReportedMarkerCount) {
  const reportRatio = getSchoolMarkerReportRatio(schoolReportStats, maxReportedMarkerCount);

  if (!(reportRatio > 0)) {
    return SCHOOL_MARKER_DEFAULT_COLOR;
  }

  return interpolateHexColor(
    SCHOOL_MARKER_REPORT_MIN_COLOR,
    SCHOOL_MARKER_REPORT_MAX_COLOR,
    reportRatio
  );
}

function getSchoolMarkerOpacity(schoolReportStats, maxReportedMarkerCount) {
  const reportRatio = getSchoolMarkerReportRatio(schoolReportStats, maxReportedMarkerCount);
  return SCHOOL_MARKER_DEFAULT_OPACITY
    + ((SCHOOL_MARKER_MAX_OPACITY - SCHOOL_MARKER_DEFAULT_OPACITY) * reportRatio);
}

function getPreferredMapThemeKey() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function addColorSchemeListener(listener) {
  if (typeof window.matchMedia !== 'function') {
    return () => {};
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }

  if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(listener);
    return () => mediaQuery.removeListener(listener);
  }

  return () => {};
}

function getMapThemeColors() {
  return getPreferredMapThemeKey() === 'dark'
    ? {
      error: '#e6eef7',
      mapOutline: '#d6e4f0'
    }
    : {
      error: '#2c3e50',
      mapOutline: '#ffffff'
    };
}

function setMapTileFallbackState(mapElement, isUnavailable) {
  if (!mapElement) {
    return;
  }

  mapElement.classList.toggle('map--tiles-unavailable', Boolean(isUnavailable));
}

function getBaseTileProviders(minZoom) {
  const themeKey = getPreferredMapThemeKey();
  return BASE_TILE_PROVIDERS[themeKey].map((provider) => ({
    ...provider,
    options: {
      ...provider.options,
      maxZoom: 20,
      minZoom
    }
  }));
}

function mountMapTileLayer({
  map,
  mapElement,
  minZoom,
  providerIndexRef,
  tileLayerRef
}) {
  const providers = getBaseTileProviders(minZoom);
  const safeProviderIndex = Math.min(providerIndexRef.current, Math.max(providers.length - 1, 0));
  const activeProvider = providers[safeProviderIndex];

  if (!activeProvider) {
    return;
  }

  providerIndexRef.current = safeProviderIndex;

  if (tileLayerRef.current) {
    tileLayerRef.current.off();
    map.removeLayer(tileLayerRef.current);
  }

  setMapTileFallbackState(mapElement, false);

  const nextTileLayer = L.tileLayer(activeProvider.url, activeProvider.options);
  let hasLoadedAnyTile = false;
  let tileErrorCount = 0;
  let fallbackHandled = false;

  nextTileLayer.on('tileload', () => {
    hasLoadedAnyTile = true;
    tileErrorCount = 0;
    setMapTileFallbackState(mapElement, false);
  });

  nextTileLayer.on('tileerror', () => {
    if (hasLoadedAnyTile || fallbackHandled) {
      return;
    }

    tileErrorCount += 1;
    if (tileErrorCount < TILE_ERROR_THRESHOLD) {
      return;
    }

    fallbackHandled = true;
    const nextProviderIndex = safeProviderIndex + 1;

    if (nextProviderIndex >= providers.length) {
      setMapTileFallbackState(mapElement, true);
      return;
    }

    providerIndexRef.current = nextProviderIndex;
    mountMapTileLayer({
      map,
      mapElement,
      minZoom,
      providerIndexRef,
      tileLayerRef
    });
  });

  nextTileLayer.addTo(map);
  tileLayerRef.current = nextTileLayer;
}

function getBootstrapAssetVersion() {
  return readPath(window, ['__NCT_BOOTSTRAP__', 'assetVersion'], '');
}

async function loadProvinceGeoJson() {
  if (sharedProvinceGeoJson) {
    return sharedProvinceGeoJson;
  }

  if (sharedProvinceGeoJsonRequest) {
    return sharedProvinceGeoJsonRequest;
  }

  const assetVersion = getBootstrapAssetVersion();
  const provinceGeoJsonUrl = assetVersion
    ? `/cn.json?v=${encodeURIComponent(assetVersion)}`
    : '/cn.json';

  sharedProvinceGeoJsonRequest = window.fetch(provinceGeoJsonUrl, {
    headers: {
      Accept: 'application/json'
    }
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load province layer: ${response.status}`);
      }

      const payload = await response.json();
      sharedProvinceGeoJson = payload;
      return payload;
    })
    .finally(() => {
      sharedProvinceGeoJsonRequest = null;
    });

  return sharedProvinceGeoJsonRequest;
}

function buildProvinceDensityMap(provinceStatistics) {
  const densityMap = new Map();

  (Array.isArray(provinceStatistics) ? provinceStatistics : []).forEach((entry) => {
    const provinceCode = String(
      entry && (
        entry.provinceCode
        || entry.province
        || (entry.summaryRecord && (entry.summaryRecord.provinceCode || entry.summaryRecord.province))
      ) || ''
    ).trim();
    const count = Number(entry && entry.count);
    const hasExplicitCount = Boolean(entry) && Object.prototype.hasOwnProperty.call(entry, 'count');
    const increment = hasExplicitCount ? count : 1;

    if (!provinceCode || !(increment > 0)) {
      return;
    }

    densityMap.set(provinceCode, (densityMap.get(provinceCode) || 0) + increment);
  });

  return densityMap;
}

function buildProvinceCodeLookup(provinceGeoJson) {
  const provinceCodeLookup = new Map();

  (Array.isArray(provinceGeoJson && provinceGeoJson.features) ? provinceGeoJson.features : []).forEach((feature) => {
    const properties = feature && feature.properties || {};
    const provinceCode = String(properties.code || '').trim();

    if (!provinceCode) {
      return;
    }

    [
      provinceCode,
      properties.name,
      properties.fullname,
      properties.pinyin,
      properties.filename,
      properties['name_zh-CN'],
      properties['name_zh-TW'],
      properties.name_en,
      properties['fullname_zh-CN'],
      properties['fullname_zh-TW'],
      properties.fullname_en
    ]
      .map((value) => normalizeText(value))
      .filter(Boolean)
      .forEach((normalizedValue) => {
        provinceCodeLookup.set(normalizedValue, provinceCode);
      });
  });

  return provinceCodeLookup;
}

function resolveProvinceCode(value, provinceCodeLookup) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  if (/^\d{6}$/.test(normalizedValue)) {
    return normalizedValue;
  }

  if (provinceCodeLookup && provinceCodeLookup.has(normalizedValue)) {
    return provinceCodeLookup.get(normalizedValue);
  }

  return '';
}

function getProvinceCodeFromFeature(feature) {
  return String(feature && feature.properties && feature.properties.code || '').trim();
}

function getProvinceLabelLatLng(feature, layer) {
  const center = feature && feature.properties && feature.properties.center;
  if (Array.isArray(center) && center.length >= 2) {
    return L.latLng(Number(center[1]), Number(center[0]));
  }

  return layer.getBounds().getCenter();
}

function getFeatureProvinceLabel(feature, lang) {
  const properties = feature && feature.properties || {};
  return (
    properties[`fullname_${lang}`]
    || properties[`name_${lang}`]
    || properties.fullname
    || properties.name
    || ''
  );
}

function bindProvinceLabel(feature, layer, lang) {
  const provinceName = getFeatureProvinceLabel(feature, lang);

  if (!provinceName) {
    return;
  }

  const labelLatLng = getProvinceLabelLatLng(feature, layer);
  layer.bindTooltip(escapeHtml(provinceName), {
    className: 'map-province-label',
    direction: 'center',
    interactive: false,
    opacity: 1,
    permanent: true
  });
  layer.openTooltip(labelLatLng);
}

function getMarkerPopupWidthOptions(map) {
  const mapWidth = Math.max(0, Math.floor(map.getSize().x || 0));
  const viewportWidth = Math.max(0, Math.floor(window.innerWidth || 0));
  const horizontalViewportPadding = viewportWidth > 0 && viewportWidth <= 650 ? 24 : 56;
  const minPopupWidth = 180;
  const desiredWidth = Math.floor(mapWidth * 0.46);
  const maxSafeWidth = Math.max(minPopupWidth, viewportWidth - horizontalViewportPadding);
  const popupWidth = Math.max(minPopupWidth, Math.min(desiredWidth, maxSafeWidth));

  return {
    maxWidth: popupWidth,
    minWidth: popupWidth
  };
}

function createGroupedMarkerPopup(group, i18n, lang, query) {
  const record = group && (group.summaryRecord || (Array.isArray(group.pages) ? group.pages[0] : null)) || {};
  const regionSummary = getRecordRegionSummary(i18n, record);
  const counts = {
    agent: Array.isArray(group && group.pages) ? group.pages.filter((page) => page.inputType === AGENT_IDENTITY).length : 0,
    self: Array.isArray(group && group.pages) ? group.pages.filter((page) => page.inputType === SELF_IDENTITY).length : 0
  };

  return `
    <div class="leaflet-popup-card">
      <div class="leaflet-popup-card__header">
        <strong>${escapeHtml(record.name || '')}</strong>
        ${regionSummary ? `<p>${escapeHtml(regionSummary)}</p>` : ''}
      </div>
      <div class="leaflet-popup-card__counts">
        <span>${escapeHtml(readPath(i18n, ['map', 'list', 'reportCounts', 'self'], 'Self'))} ${counts.self}</span>
        <span>${escapeHtml(readPath(i18n, ['map', 'list', 'reportCounts', 'agent'], 'Agent'))} ${counts.agent}</span>
      </div>
      <div class="leaflet-popup-card__meta">
        ${record.addr ? `<p>${escapeHtml(record.addr)}</p>` : ''}
        ${record.contact ? `<p>${escapeHtml(record.contact)}</p>` : ''}
      </div>
      <a class="leaflet-popup-card__link" href="${escapeHtml(buildRecordHref(record, { lang, query }))}">
        ${escapeHtml(readPath(i18n, ['map', 'list', 'viewDetails'], 'Open detail'))}
      </a>
    </div>
  `;
}

function readVarInt(bytes, initialOffset) {
  let offset = initialOffset;
  let value = 0;

  while (offset < bytes.length) {
    const currentByte = bytes[offset];
    value = (value << 7) | (currentByte & 0x7f);
    offset += 1;

    if ((currentByte & 0x80) === 0) {
      break;
    }
  }

  return {
    nextOffset: offset,
    value
  };
}

function buildTempoTimeline(tempoEvents, ticksPerQuarter) {
  const events = Array.isArray(tempoEvents) && tempoEvents.length > 0
    ? [...tempoEvents].sort((left, right) => left.tick - right.tick)
    : [{ microsecondsPerQuarter: 500000, tick: 0 }];

  let elapsedSeconds = 0;

  return events.map((event, index) => {
    if (index > 0) {
      const previousEvent = events[index - 1];
      elapsedSeconds += (
        (event.tick - previousEvent.tick)
        * previousEvent.microsecondsPerQuarter
      ) / (ticksPerQuarter * 1000000);
    }

    return {
      ...event,
      secondsAtTick: elapsedSeconds
    };
  });
}

function tickToSeconds(tick, tempoTimeline, ticksPerQuarter) {
  const effectiveTimeline = Array.isArray(tempoTimeline) && tempoTimeline.length > 0
    ? tempoTimeline
    : [{ microsecondsPerQuarter: 500000, secondsAtTick: 0, tick: 0 }];

  let currentTempo = effectiveTimeline[0];

  for (let index = 1; index < effectiveTimeline.length; index += 1) {
    if (tick < effectiveTimeline[index].tick) {
      break;
    }

    currentTempo = effectiveTimeline[index];
  }

  return currentTempo.secondsAtTick + (
    (tick - currentTempo.tick)
    * currentTempo.microsecondsPerQuarter
  ) / (ticksPerQuarter * 1000000);
}

function parseMidiBuffer(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const bytes = new Uint8Array(arrayBuffer);
  let offset = 0;

  function readChunkId() {
    const identifier = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );
    offset += 4;
    return identifier;
  }

  function readChunkLength() {
    const length = view.getUint32(offset);
    offset += 4;
    return length;
  }

  if (readChunkId() !== 'MThd') {
    throw new Error('Unsupported MIDI header.');
  }

  const headerLength = readChunkLength();
  const format = view.getUint16(offset);
  const trackCount = view.getUint16(offset + 2);
  const division = view.getUint16(offset + 4);
  offset += headerLength;

  if (format > 1) {
    throw new Error('Only MIDI format 0 and 1 are supported.');
  }

  const allNotes = [];
  const allTempoEvents = [{ microsecondsPerQuarter: 500000, tick: 0 }];

  for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
    if (readChunkId() !== 'MTrk') {
      throw new Error('Invalid MIDI track.');
    }

    const trackLength = readChunkLength();
    const trackEndOffset = offset + trackLength;
    let trackTick = 0;
    let runningStatus = null;
    const activeNotes = new Map();

    while (offset < trackEndOffset) {
      const delta = readVarInt(bytes, offset);
      offset = delta.nextOffset;
      trackTick += delta.value;

      let statusByte = bytes[offset];

      if (statusByte < 0x80 && runningStatus != null) {
        statusByte = runningStatus;
      } else {
        offset += 1;
        runningStatus = statusByte;
      }

      if (statusByte === 0xff) {
        const metaType = bytes[offset];
        offset += 1;
        const metaLength = readVarInt(bytes, offset);
        offset = metaLength.nextOffset;

        if (metaType === 0x51 && metaLength.value === 3) {
          const microsecondsPerQuarter = (
            (bytes[offset] << 16)
            | (bytes[offset + 1] << 8)
            | bytes[offset + 2]
          );
          allTempoEvents.push({
            microsecondsPerQuarter,
            tick: trackTick
          });
        }

        offset += metaLength.value;
        runningStatus = null;
        continue;
      }

      if (statusByte === 0xf0 || statusByte === 0xf7) {
        const sysExLength = readVarInt(bytes, offset);
        offset = sysExLength.nextOffset + sysExLength.value;
        runningStatus = null;
        continue;
      }

      const eventType = statusByte & 0xf0;
      const channel = statusByte & 0x0f;

      if (eventType === 0x80 || eventType === 0x90) {
        const noteNumber = bytes[offset];
        const velocity = bytes[offset + 1];
        offset += 2;

        const noteKey = `${channel}:${noteNumber}`;

        if (eventType === 0x90 && velocity > 0) {
          activeNotes.set(noteKey, {
            noteNumber,
            startTick: trackTick,
            velocity
          });
        } else if (activeNotes.has(noteKey)) {
          const startedNote = activeNotes.get(noteKey);
          allNotes.push({
            channel,
            durationTick: Math.max(trackTick - startedNote.startTick, 1),
            noteNumber,
            startTick: startedNote.startTick,
            velocity: startedNote.velocity
          });
          activeNotes.delete(noteKey);
        }

        continue;
      }

      offset += eventType === 0xc0 || eventType === 0xd0 ? 1 : 2;
    }
  }

  const tempoTimeline = buildTempoTimeline(allTempoEvents, division);
  const notes = allNotes
    .filter((note) => note.channel !== 9)
    .map((note) => ({
      durationSeconds: Math.max(
        tickToSeconds(note.startTick + note.durationTick, tempoTimeline, division)
        - tickToSeconds(note.startTick, tempoTimeline, division),
        0.05
      ),
      frequency: 440 * (2 ** ((note.noteNumber - 69) / 12)),
      startSeconds: tickToSeconds(note.startTick, tempoTimeline, division),
      velocity: note.velocity / 127
    }))
    .sort((left, right) => left.startSeconds - right.startSeconds);

  return {
    durationSeconds: notes.reduce((longestDuration, note) => (
      Math.max(longestDuration, note.startSeconds + note.durationSeconds)
    ), 0),
    notes
  };
}

async function loadMidiSequence(url) {
  if (midiSequenceCache.has(url)) {
    return midiSequenceCache.get(url);
  }

  const sequencePromise = fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load MIDI asset: ${response.status}`);
      }

      return response.arrayBuffer();
    })
    .then((arrayBuffer) => parseMidiBuffer(arrayBuffer));

  midiSequenceCache.set(url, sequencePromise);
  return sequencePromise;
}

async function playMidiSequence(url) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  const sequence = await loadMidiSequence(url);

  if (activeMidiPlayback && typeof activeMidiPlayback.stop === 'function') {
    activeMidiPlayback.stop();
  }

  const audioContext = new AudioContextClass();
  await audioContext.resume();

  const startTime = audioContext.currentTime + 0.04;
  const activeNodes = [];
  let stopped = false;

  sequence.notes.forEach((note) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const noteStart = startTime + note.startSeconds;
    const noteEnd = noteStart + note.durationSeconds;
    const peakGain = Math.min(0.16, 0.03 + (note.velocity * 0.08));

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(note.frequency, noteStart);

    gainNode.gain.setValueAtTime(0.0001, noteStart);
    gainNode.gain.linearRampToValueAtTime(peakGain, noteStart + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, noteEnd + 0.06);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.08);

    activeNodes.push(oscillator, gainNode);
  });

  const playbackController = {
    stop() {
      if (stopped) {
        return;
      }

      stopped = true;
      activeNodes.forEach((node) => {
        if (typeof node.disconnect === 'function') {
          try {
            node.disconnect();
          } catch (_error) {
            // Ignore nodes that are already disconnected.
          }
        }
      });

      void audioContext.close();
    }
  };
  activeMidiPlayback = playbackController;

  window.setTimeout(() => {
    if (activeMidiPlayback === playbackController) {
      activeMidiPlayback.stop();
      activeMidiPlayback = null;
    }
  }, Math.ceil((sequence.durationSeconds + 0.25) * 1000));
}

function appendLangToUrl(href, lang) {
  const url = new URL(href, window.location.origin);
  url.searchParams.set('lang', lang);
  return `${url.pathname}${url.search}${url.hash}`;
}

function appendLangToHref(href, lang) {
  const url = new URL(href, window.location.origin);
  url.searchParams.set('lang', lang);

  return url.origin === window.location.origin
    ? `${url.pathname}${url.search}${url.hash}`
    : url.toString();
}

function getLinkNavigationProps(href) {
  if (!href) {
    return {};
  }

  const url = new URL(href, window.location.origin);

  return url.origin === window.location.origin
    ? {}
    : {
        rel: 'noreferrer',
        target: '_blank'
      };
}

function resolveFrontendDeploymentMode(bootstrap) {
  return hasConfiguredNoTorsionBackend({
    formPageUrl: bootstrap && bootstrap.formPageUrl ? bootstrap.formPageUrl : ''
  })
    ? 'hono'
    : 'api-only';
}

function resolveFrontendFormHref(bootstrap) {
  return getNoTorsionBackendConfig(bootstrap).formHref;
}

function getNoTorsionBackendConfig(bootstrap) {
  return buildNoTorsionBackendConfig({
    currentOrigin: window.location.origin,
    formPageUrl: bootstrap && bootstrap.formPageUrl ? bootstrap.formPageUrl : '',
    lang: bootstrap && bootstrap.lang ? bootstrap.lang : 'zh-CN'
  });
}

function getTranslationCacheKey(targetLanguage, text) {
  return `${targetLanguage}::${text}`;
}

function readTranslationCache(targetLanguage, text) {
  const cacheKey = getTranslationCacheKey(targetLanguage, text);

  if (translationMemoryCache.has(cacheKey)) {
    return translationMemoryCache.get(cacheKey);
  }

  try {
    const cachedValue = window.sessionStorage.getItem(cacheKey);

    if (cachedValue) {
      translationMemoryCache.set(cacheKey, cachedValue);
      return cachedValue;
    }
  } catch (_error) {
    // Ignore storage failures and fall back to uncached requests.
  }

  return '';
}

function writeTranslationCache(targetLanguage, text, translatedText) {
  if (!translatedText) {
    return;
  }

  const cacheKey = getTranslationCacheKey(targetLanguage, text);
  translationMemoryCache.set(cacheKey, translatedText);

  try {
    window.sessionStorage.setItem(cacheKey, translatedText);
  } catch (_error) {
    // Ignore storage failures and keep the translated content in memory for this page load.
  }
}

async function requestNoTorsionTranslations({ items, targetLanguage, translateApiUrl }) {
  if (!translateApiUrl) {
    return [];
  }

  const response = await window.fetch(translateApiUrl, {
    body: JSON.stringify({
      items,
      targetLanguage
    }),
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload && payload.error ? payload.error : 'Translation unavailable');
  }

  return Array.isArray(payload.translations) ? payload.translations : [];
}

function updatePathWithLang(currentPath, lang) {
  const url = new URL(currentPath || '/', window.location.origin);
  url.searchParams.set('lang', lang);
  return `${url.pathname}${url.search}${url.hash}`;
}

function readCurrentUrl() {
  return new URL(window.location.href);
}

function getSearchParamValue(searchParams, key) {
  const value = searchParams.get(key);
  return value == null ? '' : value;
}

function resolveInitialPortalSection(pathname) {
  if (pathname === '/blog') {
    return 'blog';
  }

  return 'map';
}

function resolveCorrectionFormAction(pathname) {
  return pathname.startsWith('/correction')
    ? '/correction/submit'
    : '/map/correction/submit';
}

function resolveFrontendRoute(currentPath) {
  // The static shell only resolves routes backed by generated content or explicit frontend-only flows.
  const url = new URL(currentPath || window.location.href, window.location.origin);
  const pathname = url.pathname || '/';
  const query = {
    inputType: getSearchParamValue(url.searchParams, 'inputType'),
    schoolName: getSearchParamValue(url.searchParams, 'school_name'),
    search: getSearchParamValue(url.searchParams, 'search'),
    tag: getSearchParamValue(url.searchParams, 'tag')
  };

  if (pathname === '/' || pathname === '/map' || pathname === '/blog') {
    return {
      pathname,
      query,
      routeType: pathname === '/' ? 'home' : 'portal'
    };
  }

  if (pathname === '/form') {
    return {
      pathname,
      query,
      routeType: 'form-entry'
    };
  }

  if (pathname === '/privacy') {
    return {
      pathname,
      query,
      routeType: 'privacy'
    };
  }

  if (pathname.startsWith('/map/record/')) {
    return {
      pathname,
      query,
      recordSlug: decodeURIComponent(pathname.slice('/map/record/'.length)),
      routeType: 'record'
    };
  }

  if (pathname.startsWith('/port/')) {
    return {
      articleId: decodeURIComponent(pathname.slice('/port/'.length)),
      pathname,
      query,
      routeType: 'article'
    };
  }

  return {
    pathname,
    query,
    routeType: 'not-found'
  };
}

function replaceCurrentUrl(nextPath) {
  window.history.replaceState({}, '', nextPath);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function formatAbsoluteDate(value, lang) {
  if (!value) {
    return '';
  }

  if (typeof value === 'number') {
    if (value < 100000000000) {
      return `v${value}`;
    }

    return new Intl.DateTimeFormat(lang, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  }

  return String(value);
}

function formatRelativeTimestamp(timestamp, lang) {
  const numericTimestamp = Number(timestamp);
  if (
    !Number.isFinite(numericTimestamp)
    || numericTimestamp <= 0
    || numericTimestamp < 100000000000
  ) {
    return '';
  }

  const diffMs = numericTimestamp - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const relativeFormatter = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });

  if (Math.abs(diffMinutes) < 60) {
    return relativeFormatter.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return relativeFormatter.format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffHours / 24);
  return relativeFormatter.format(diffDays, 'day');
}

function getProvinceLabel(i18n, value) {
  return readPath(i18n, ['data', 'provinceNames', value], value || '');
}

function getInputTypeLabel(i18n, value) {
  if (!value) {
    return readPath(i18n, ['data', 'inputTypes', 'bulk'], 'Bulk');
  }

  if (value === SELF_IDENTITY) {
    return readPath(i18n, ['data', 'inputTypes', 'self'], value);
  }

  if (value === AGENT_IDENTITY) {
    return readPath(i18n, ['data', 'inputTypes', 'agent'], value);
  }

  if (value === '批量数据') {
    return readPath(i18n, ['data', 'inputTypes', 'bulk'], value);
  }

  return value;
}

function getRecordRegionSummary(i18n, record) {
  return [
    getProvinceLabel(i18n, record && record.province),
    record && (record.city || record.prov),
    record && record.county
  ]
    .filter(Boolean)
    .join(' / ');
}

function getSchoolStatsKey(record) {
  const normalizedName = normalizeText(record && record.name);
  const normalizedProvince = normalizeText(record && record.province);
  const normalizedAddress = normalizeText(record && record.addr);

  if (normalizedName && normalizedProvince) {
    return `${normalizedName}::${normalizedProvince}`;
  }

  if (normalizedName) {
    return normalizedName;
  }

  if (normalizedProvince || normalizedAddress) {
    return `${normalizedProvince}::${normalizedAddress}`;
  }

  return '';
}

function buildSchoolReportStats(records) {
  const statsBySchool = new Map();

  (Array.isArray(records) ? records : []).forEach((record) => {
    const schoolKey = getSchoolStatsKey(record);
    if (!schoolKey) {
      return;
    }

    if (!statsBySchool.has(schoolKey)) {
      statsBySchool.set(schoolKey, {
        selfCount: 0,
        agentCount: 0
      });
    }

    const target = statsBySchool.get(schoolKey);

    if (record && record.inputType === SELF_IDENTITY) {
      target.selfCount += 1;
    } else if (record && record.inputType === AGENT_IDENTITY) {
      target.agentCount += 1;
    }
  });

  return statsBySchool;
}

function groupSchoolRecords(records) {
  const groupedRecords = [];
  const groupsByKey = new Map();

  (Array.isArray(records) ? records : []).forEach((record, index) => {
    const schoolKey = getSchoolStatsKey(record) || `unknown-${index}`;
    let group = groupsByKey.get(schoolKey);

    if (!group) {
      group = {
        schoolKey,
        summaryRecord: record,
        pages: []
      };
      groupsByKey.set(schoolKey, group);
      groupedRecords.push(group);
    }

    group.pages.push(record);
  });

  return groupedRecords;
}

function getRecordPageKey(record) {
  return [
    record && record.inputType,
    record && record.name,
    record && record.province,
    record && (record.city || record.prov),
    record && record.county,
    record && record.dateStart,
    record && record.dateEnd,
    record && record.addr,
    record && record.HMaster,
    record && record.contact,
    record && record.experience,
    record && record.scandal,
    record && record.else
  ]
    .map((value) => normalizeText(value))
    .join('::');
}

function hashRecordKey(detailKey) {
  let primaryHash = 5381;
  let secondaryHash = 52711;

  for (const character of String(detailKey || '')) {
    const codePoint = character.codePointAt(0) || 0;
    primaryHash = ((primaryHash << 5) + primaryHash) ^ codePoint;
    secondaryHash = ((secondaryHash << 5) + secondaryHash) ^ (codePoint * 97);
  }

  return `${(primaryHash >>> 0).toString(16).padStart(8, '0')}${(secondaryHash >>> 0).toString(16).padStart(8, '0')}`;
}

function getRecordToken(record) {
  return hashRecordKey(getRecordPageKey(record));
}

function buildRecordHref(record, { lang, query = {} } = {}) {
  const url = new URL(`/map/record/${encodeURIComponent(getRecordToken(record))}`, window.location.origin);

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value != null && `${value}` !== '') {
      url.searchParams.set(key, value);
    }
  });

  url.searchParams.set('lang', lang);
  return `${url.pathname}${url.search}`;
}

function getRecordDateSummary(i18n, record) {
  const startDate = String(record && record.dateStart || '').trim();
  const endDate = String(record && record.dateEnd || '').trim();

  if (startDate && endDate) {
    return `${startDate} -> ${endDate}`;
  }

  if (startDate) {
    return startDate;
  }

  if (endDate) {
    return endDate;
  }

  return readPath(i18n, ['map', 'list', 'dateUnknown'], 'Date unavailable');
}

function findRecordLocation(groups, routeToken) {
  const normalizedRouteToken = String(routeToken || '').trim();

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex];
    const pages = Array.isArray(group && group.pages) ? group.pages : [];

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      const record = pages[pageIndex];
      if (getRecordToken(record) === normalizedRouteToken) {
        return {
          group,
          groupIndex,
          pageIndex,
          record
        };
      }
    }
  }

  return null;
}

function readMapCache(apiUrl) {
  try {
    const cacheKey = `react-map-cache:${apiUrl}`;
    const rawValue = window.sessionStorage.getItem(cacheKey);

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    if (!parsed || !parsed.payload || !Array.isArray(parsed.payload.data)) {
      return null;
    }

    if (Date.now() - Number(parsed.savedAt || 0) > 5 * 60 * 1000) {
      return null;
    }

    return parsed.payload;
  } catch (_error) {
    return null;
  }
}

function writeMapCache(apiUrl, payload) {
  try {
    const cacheKey = `react-map-cache:${apiUrl}`;
    window.sessionStorage.setItem(cacheKey, JSON.stringify({
      payload,
      savedAt: Date.now()
    }));
  } catch (_error) {
    // Ignore cache failures.
  }
}

async function fetchSharedMapData(apiUrl) {
  if (sharedMapPayload) {
    return sharedMapPayload;
  }

  const cachedPayload = readMapCache(apiUrl);
  if (cachedPayload) {
    sharedMapPayload = cachedPayload;
    return cachedPayload;
  }

  if (sharedMapRequest) {
    return sharedMapRequest;
  }

  sharedMapRequest = window.fetch(apiUrl, {
    headers: {
      Accept: 'application/json'
    }
  })
    .then(async (response) => {
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload && payload.error ? payload.error : 'Map data unavailable');
      }

      sharedMapPayload = payload;
      writeMapCache(apiUrl, payload);
      return payload;
    })
    .finally(() => {
      sharedMapRequest = null;
    });

  return sharedMapRequest;
}

function getStaticAreaOptions(areaSelectorPayload, lang) {
  const payload = areaSelectorPayload && typeof areaSelectorPayload === 'object'
    ? areaSelectorPayload
    : {};

  return {
    citiesByProvinceCode: payload.citiesByProvinceCode && typeof payload.citiesByProvinceCode === 'object'
      ? payload.citiesByProvinceCode
      : {},
    countiesByCityCode: payload.countiesByCityCode && typeof payload.countiesByCityCode === 'object'
      ? payload.countiesByCityCode
      : {},
    provinces: Array.isArray(payload.provincesByLanguage && payload.provincesByLanguage[lang])
      ? payload.provincesByLanguage[lang]
      : (Array.isArray(payload.provincesByLanguage && payload.provincesByLanguage['zh-CN'])
        ? payload.provincesByLanguage['zh-CN']
        : [])
  };
}

function localizeBlogLanguageLabel(value, i18n) {
  const normalizedValue = String(value || '').trim();
  const languageLabelByValue = {
    English: readPath(i18n, ['blog', 'articleLanguages', 'en'], 'English'),
    en: readPath(i18n, ['blog', 'articleLanguages', 'en'], 'English'),
    'zh-CN': readPath(i18n, ['blog', 'articleLanguages', 'zhCN'], 'Simplified Chinese'),
    'zh-TW': readPath(i18n, ['blog', 'articleLanguages', 'zhTW'], 'Traditional Chinese'),
    '简体中文': readPath(i18n, ['blog', 'articleLanguages', 'zhCN'], 'Simplified Chinese'),
    '簡體中文': readPath(i18n, ['blog', 'articleLanguages', 'zhCN'], 'Simplified Chinese'),
    '繁體中文': readPath(i18n, ['blog', 'articleLanguages', 'zhTW'], 'Traditional Chinese'),
    '正體中文': readPath(i18n, ['blog', 'articleLanguages', 'zhTW'], 'Traditional Chinese'),
    '英文': readPath(i18n, ['blog', 'articleLanguages', 'en'], 'English')
  };

  return languageLabelByValue[normalizedValue] || normalizedValue;
}

function localizeBlogCreationDate(value, lang) {
  const rawValue = String(value || '').trim();

  if (lang !== 'en') {
    return rawValue;
  }

  const dateMatch = rawValue.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (!dateMatch) {
    return rawValue;
  }

  const [, year, month, day] = dateMatch;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric'
  }).format(date);
}

function buildAutocompleteRecords(records) {
  const deduped = new Map();

  (Array.isArray(records) ? records : []).forEach((item) => {
    const name = String(item && item.name || '').trim();
    const addr = String(item && item.addr || '').trim();

    if (!name && !addr) {
      return;
    }

    const normalizedName = normalizeText(name);
    const normalizedAddr = normalizeText(addr);
    const key = `${normalizedName}::${normalizedAddr}`;

    if (!deduped.has(key)) {
      deduped.set(key, {
        addr,
        name,
        normalizedAddr,
        normalizedName
      });
    }
  });

  return [...deduped.values()];
}

function getAutocompleteSuggestions(records, keyword, field) {
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) {
    return [];
  }

  function getScore(record) {
    const primary = field === 'address' ? record.normalizedAddr : record.normalizedName;
    const secondary = field === 'address' ? record.normalizedName : record.normalizedAddr;
    const combined = `${record.normalizedName} ${record.normalizedAddr}`.trim();

    if (primary.startsWith(normalizedKeyword)) return 0;
    if (primary.includes(normalizedKeyword)) return 1;
    if (secondary.startsWith(normalizedKeyword)) return 2;
    if (secondary.includes(normalizedKeyword)) return 3;
    if (combined.includes(normalizedKeyword)) return 4;

    return Number.POSITIVE_INFINITY;
  }

  return records
    .map((record) => ({ record, score: getScore(record) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => left.score - right.score)
    .slice(0, 8)
    .map((entry) => entry.record);
}

function useMapPayload(apiUrl) {
  const [payload, setPayload] = useState(sharedMapPayload);
  const [loading, setLoading] = useState(!sharedMapPayload);
  const [error, setError] = useState('');

  useEffect(() => {
    let disposed = false;

    setLoading(!sharedMapPayload);
    fetchSharedMapData(apiUrl)
      .then((nextPayload) => {
        if (disposed) {
          return;
        }

        setPayload(nextPayload);
        setError('');
        setLoading(false);
      })
      .catch((nextError) => {
        if (disposed) {
          return;
        }

        setError(nextError.message || 'Map data unavailable');
        setLoading(false);
      });

    return () => {
      disposed = true;
    };
  }, [apiUrl]);

  return {
    error,
    loading,
    payload
  };
}

function useAreaSelectorPayload(lang) {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let disposed = false;

    setLoading(true);
    loadAreaSelectorPayload()
      .then((nextPayload) => {
        if (!disposed) {
          setPayload(nextPayload);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!disposed) {
          setPayload(null);
          setLoading(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  return {
    ...getStaticAreaOptions(payload, lang),
    loading
  };
}

function useAreaSelector({ lang }) {
  const areaSelectorPayload = useAreaSelectorPayload(lang);
  const [provinceCode, setProvinceCode] = useState('');
  const [cityCode, setCityCode] = useState('');
  const [countyCode, setCountyCode] = useState('');
  const [cityOptions, setCityOptions] = useState([]);
  const [countyOptions, setCountyOptions] = useState([]);
  const [loadingCityOptions, setLoadingCityOptions] = useState(false);
  const [loadingCountyOptions, setLoadingCountyOptions] = useState(false);

  useEffect(() => {
    if (!provinceCode) {
      setCityOptions([]);
      setCountyOptions([]);
      setCityCode('');
      setCountyCode('');
      return;
    }

    setLoadingCityOptions(true);
    const nextCityOptions = Array.isArray(areaSelectorPayload.citiesByProvinceCode[provinceCode])
      ? areaSelectorPayload.citiesByProvinceCode[provinceCode]
      : [];

    setCityOptions(nextCityOptions);
    setCityCode('');
    setCountyCode('');
    setCountyOptions([]);
    setLoadingCityOptions(false);
  }, [areaSelectorPayload.citiesByProvinceCode, provinceCode]);

  useEffect(() => {
    if (!cityCode) {
      setCountyOptions([]);
      setCountyCode('');
      return;
    }

    setLoadingCountyOptions(true);
    const nextCountyOptions = Array.isArray(areaSelectorPayload.countiesByCityCode[cityCode])
      ? areaSelectorPayload.countiesByCityCode[cityCode]
      : [];

    setCountyOptions(nextCountyOptions);
    setCountyCode('');
    setLoadingCountyOptions(false);
  }, [areaSelectorPayload.countiesByCityCode, cityCode]);

  return {
    cityCode,
    cityOptions,
    countyCode,
    countyOptions,
    initialProvinces: areaSelectorPayload.provinces,
    loadingInitialOptions: areaSelectorPayload.loading,
    loadingCityOptions,
    loadingCountyOptions,
    provinceCode,
    setCityCode,
    setCountyCode,
    setProvinceCode
  };
}

function useAutocompleteRecords(apiUrl) {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    let disposed = false;

    fetchSharedMapData(apiUrl)
      .then((payload) => {
        if (!disposed) {
          setRecords(buildAutocompleteRecords(payload && payload.data));
        }
      })
      .catch(() => {
        if (!disposed) {
          setRecords([]);
        }
      });

    return () => {
      disposed = true;
    };
  }, [apiUrl]);

  return records;
}

function useFrontendRuntime(scope) {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let disposed = false;
    // This still expects a same-origin compatibility backend; static-only deployments will surface an unavailable state here.
    const requestUrl = new URL('/api/frontend-runtime', window.location.origin);

    requestUrl.searchParams.set('scope', scope);

    setLoading(true);
    window.fetch(requestUrl.toString(), {
      headers: {
        Accept: 'application/json'
      }
    })
      .then(async (response) => {
        const nextPayload = await response.json();

        if (!response.ok) {
          throw new Error(nextPayload && nextPayload.error ? nextPayload.error : 'Frontend runtime unavailable');
        }

        if (!disposed) {
          setPayload(nextPayload);
          setError('');
          setLoading(false);
        }
      })
      .catch((nextError) => {
        if (!disposed) {
          setPayload(null);
          setError(nextError.message || 'Frontend runtime unavailable');
          setLoading(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, [scope]);

  return {
    error,
    loading,
    payload
  };
}

function useBlogIndex(i18n, lang) {
  const [payload, setPayload] = useState({ entries: [], tags: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let disposed = false;

    setLoading(true);
    loadBlogIndexPayload()
      .then((nextPayload) => {
        if (disposed) {
          return;
        }

        const tags = Object.fromEntries(
          Object.entries(nextPayload && nextPayload.tags || {}).map(([tagId, tagLabel]) => ([
            tagId,
            readPath(i18n, ['blog', 'tags', tagId], tagLabel)
          ]))
        );
        const entries = Array.isArray(nextPayload && nextPayload.entries)
          ? nextPayload.entries.map((entry) => ({
            ...entry,
            localizedCreationDate: localizeBlogCreationDate(entry.CreationDate, lang),
            localizedLanguage: localizeBlogLanguageLabel(entry.Language, i18n)
          }))
          : [];

        setPayload({
          entries,
          tags
        });
        setError('');
        setLoading(false);
      })
      .catch((nextError) => {
        if (!disposed) {
          setPayload({ entries: [], tags: {} });
          setError(nextError.message || 'Blog content unavailable');
          setLoading(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, [i18n, lang]);

  return {
    error,
    loading,
    payload
  };
}

function useBlogArticle(articleId) {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let disposed = false;

    if (!articleId) {
      setPayload(null);
      setError('Missing article id');
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    loadBlogArticlePayload(articleId)
      .then((nextPayload) => {
        if (!disposed) {
          setPayload(nextPayload);
          setError('');
          setLoading(false);
        }
      })
      .catch((nextError) => {
        if (!disposed) {
          setPayload(null);
          setError(nextError.message || 'Article unavailable');
          setLoading(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, [articleId]);

  return {
    error,
    loading,
    payload
  };
}

function LanguageSwitcher({ currentPath, lang, options }) {
  return (
    <div className="language-switcher-pill" aria-label="Language">
      {options.map((option) => (
        <button
          key={option.code}
          className={`language-switcher-pill__button${option.code === lang ? ' is-active' : ''}`}
          onClick={() => {
            window.location.href = updatePathWithLang(currentPath, option.code);
          }}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SiteHeader({ bootstrap, easterEggActive }) {
  const { currentPath, i18n, lang, languageOptions } = bootstrap;
  const backendConfig = getNoTorsionBackendConfig(bootstrap);
  const links = [
    {
      active: currentPath.startsWith('/map'),
      href: appendLangToUrl('/map', lang),
      label: readPath(i18n, ['index', 'viewMap'], 'Map')
    },
    backendConfig.formEnabled
      ? {
          active: currentPath.startsWith('/form'),
          href: backendConfig.formHref,
          label: readPath(i18n, ['index', 'fillForm'], 'Form'),
          navigationProps: getLinkNavigationProps(backendConfig.formHref)
        }
      : null,
    {
      active: currentPath.startsWith('/blog'),
      href: appendLangToUrl('/blog', lang),
      label: readPath(i18n, ['index', 'blogLibrary'], 'Blog')
    },
    {
      active: currentPath.startsWith('/privacy'),
      href: appendLangToUrl('/privacy', lang),
      label: readPath(i18n, ['navigation', 'privacy'], 'Privacy')
    }
  ].filter(Boolean);

  return (
    <header className="site-header">
      <div className="site-header__glass">
        <a className="brand-lockup" href={appendLangToUrl('/', lang)}>
          <span className={`brand-lockup__mark${easterEggActive ? ' is-easter-egg' : ''}`}>
            {easterEggActive
              ? <img alt="Easter egg avatar" src={EASTER_EGG_IMAGE_SRC} />
              : 'NCT'}
          </span>
          <span className="brand-lockup__text">
            <strong>{readPath(i18n, ['common', 'siteName'], 'NO CONVERSION THERAPY')}</strong>
            <small>Liquid glass edition</small>
          </span>
        </a>

        <nav className="site-nav" aria-label="Primary">
          {links.map((link) => (
            <a
              key={link.href}
              className={link.active ? 'is-active' : ''}
              href={link.href}
              {...(link.navigationProps || {})}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <LanguageSwitcher currentPath={currentPath} lang={lang} options={languageOptions} />
      </div>
    </header>
  );
}

function SiteFooter({ bootstrap }) {
  const { i18n, lang } = bootstrap;

  return (
    <footer className="site-footer-react">
      <div className="site-footer-react__glass">
        <p>{readPath(i18n, ['common', 'footerBy'], '© 2026 N·C·T Project.')}</p>
        <div className="site-footer-react__links">
          <a href={appendLangToUrl('/map', lang)}>{readPath(i18n, ['map', 'title'], 'Map')}</a>
          <a href={appendLangToUrl('/blog', lang)}>{readPath(i18n, ['blog', 'title'], 'Blog')}</a>
          <a href={appendLangToUrl('/privacy', lang)}>{readPath(i18n, ['navigation', 'privacy'], 'Privacy')}</a>
        </div>
      </div>
    </footer>
  );
}

function PageChrome({ bootstrap, children }) {
  const [easterEggActive, setEasterEggActive] = useState(false);

  useEffect(() => {
    function handleEasterEggActivation() {
      setEasterEggActive(true);
      void playMidiSequence(EASTER_EGG_MIDI_SRC).catch(() => {
        // Ignore media playback failures so the rest of the page keeps working.
      });
    }

    window.addEventListener(EASTER_EGG_TRIGGER_EVENT, handleEasterEggActivation);
    return () => {
      window.removeEventListener(EASTER_EGG_TRIGGER_EVENT, handleEasterEggActivation);
    };
  }, []);

  return (
    <div className="page-shell">
      <div className="page-shell__aurora page-shell__aurora--one" />
      <div className="page-shell__aurora page-shell__aurora--two" />
      <div className="page-shell__grid" />
      <SiteHeader bootstrap={bootstrap} easterEggActive={easterEggActive} />
      <main className="page-shell__content">{children}</main>
      <SiteFooter bootstrap={bootstrap} />
    </div>
  );
}

function HeroBlock({ eyebrow, title, description, children, onTitleClick, titleClassName = '' }) {
  return (
    <section className="hero-block">
      <div className="hero-block__glass">
        {eyebrow ? <p className="hero-block__eyebrow">{eyebrow}</p> : null}
        <h1
          className={`${titleClassName}${onTitleClick ? ' is-clickable' : ''}`.trim()}
          onClick={onTitleClick}
        >
          {title}
        </h1>
        {description ? <p className="hero-block__description">{description}</p> : null}
        {children}
      </div>
    </section>
  );
}

function getFormAccessModeCopy(lang, formEnabled) {
  if (formEnabled) {
    if (lang === 'en') {
      return {
        body: 'Form submission is handled by the Hono backend and displayed on this page.',
        ctaLabel: 'Go to form',
        secondary: 'Validation, confirmation, and the final delivery step all happen on the backend page.'
      };
    }

    if (lang === 'zh-TW') {
      return {
        body: '表單提交流程由 Hono 後端處理，並已嵌入目前頁面。',
        ctaLabel: '前往表單',
        secondary: '校驗、確認與最終投遞都會在後端頁面完成。'
      };
    }

    return {
      body: '表单提交流程由 Hono 后端处理，并已嵌入当前页面。',
      ctaLabel: '前往表单',
      secondary: '校验、确认与最终投递都会在后端页面完成。'
    };
  }

  if (lang === 'en') {
    return {
      body: 'This deployment is running in api-only mode. It only connects to the public JSON dataset for browsing the map, records, and blog.',
      ctaLabel: '',
      secondary: 'Form submission is intentionally unavailable here. Use the hono-backed deployment if you need the reporting workflow.'
    };
  }

  if (lang === 'zh-TW') {
    return {
      body: '當前部署運行在 api-only 模式，只接入公開 JSON 數據，用於瀏覽地圖、記錄與文庫。',
      ctaLabel: '',
      secondary: '這個模式不包含表單提交流程。如需填寫，請使用接入 Hono 後端的部署。'
    };
  }

  return {
    body: '当前部署运行在 api-only 模式，只接入公开 JSON 数据，用于浏览地图、记录与文库。',
    ctaLabel: '',
    secondary: '这个模式不包含表单提交流程。如需填写，请使用接入 Hono 后端的部署。'
  };
}

function FormAccessSection({ bootstrap }) {
  const { i18n, lang } = bootstrap;
  const backendConfig = getNoTorsionBackendConfig(bootstrap);
  const formEnabled = backendConfig.formEnabled;
  const accessCopy = getFormAccessModeCopy(lang, Boolean(formEnabled));
  const formHref = backendConfig.formHref;
  const formLinkProps = getLinkNavigationProps(formHref);

  return (
    <div className="section-stack">
      <HeroBlock
        description={readPath(i18n, ['form', 'subtitle'], '')}
        eyebrow="Form Gateway"
        title={readPath(i18n, ['form', 'standalone', 'title'], readPath(i18n, ['form', 'title'], 'Form'))}
      />

      <section className="glass-panel">
        <div className="section-heading">
          <h2>{readPath(i18n, ['index', 'fillForm'], 'Form')}</h2>
        </div>

        <p>{accessCopy.body}</p>
        <p>{accessCopy.secondary}</p>
        <p className="field-note">{readPath(i18n, ['form', 'standalone', 'safetyNotice'], '')}</p>
        {readPath(i18n, ['form', 'standalone', 'footerMeta'], '')
          ? <p className="field-note">{readPath(i18n, ['form', 'standalone', 'footerMeta'], '')}</p>
          : null}

        <div className="panel-actions">
          {formEnabled ? (
            <a className="glass-button glass-button--primary" href={formHref} {...formLinkProps}>
              {accessCopy.ctaLabel}
            </a>
          ) : null}
          <a className="glass-button" href={appendLangToUrl('/map', lang)}>
            {readPath(i18n, ['index', 'viewMap'], 'Map')}
          </a>
          <a className="glass-button" href={appendLangToUrl('/blog', lang)}>
            {readPath(i18n, ['index', 'blogLibrary'], 'Blog')}
          </a>
        </div>
      </section>
    </div>
  );
}

function HomePage({ bootstrap }) {
  const { i18n, lang } = bootstrap;
  const clickTimestampsRef = useRef([]);
  const backendConfig = getNoTorsionBackendConfig(bootstrap);
  const formHref = backendConfig.formHref;
  const formEnabled = backendConfig.formEnabled;
  const formLinkProps = getLinkNavigationProps(formHref);
  const showcaseCards = [
    {
      description: readPath(i18n, ['map', 'note'], 'A public view of institutions and records.'),
      href: appendLangToUrl('/map', lang),
      label: readPath(i18n, ['map', 'sections', 'map'], 'Open map'),
      title: readPath(i18n, ['map', 'title'], 'Map')
    },
    formEnabled
      ? {
          description: readPath(i18n, ['form', 'subtitle'], 'Documenting harm helps make resistance visible.'),
          href: formHref,
          label: readPath(i18n, ['index', 'fillForm'], 'Open form'),
          navigationProps: formLinkProps,
          title: readPath(i18n, ['form', 'title'], 'Form')
        }
      : null,
    {
      description: readPath(i18n, ['blog', 'subtitle'], 'A library of memory, evidence, and guidance.'),
      href: appendLangToUrl('/blog', lang),
      label: readPath(i18n, ['index', 'blogLibrary'], 'Open blog'),
      title: readPath(i18n, ['blog', 'title'], 'Blog')
    }
  ].filter(Boolean);

  function handleTitleClick() {
    const currentTimestamp = Date.now();
    const recentClicks = clickTimestampsRef.current.filter((timestamp) => (
      currentTimestamp - timestamp <= EASTER_EGG_CLICK_WINDOW_MS
    ));

    recentClicks.push(currentTimestamp);
    clickTimestampsRef.current = recentClicks;

    if (recentClicks.length >= EASTER_EGG_CLICK_TARGET) {
      clickTimestampsRef.current = [];
      window.dispatchEvent(new Event(EASTER_EGG_TRIGGER_EVENT));
    }
  }

  return (
    <PageChrome bootstrap={bootstrap}>
      <HeroBlock
        description={readPath(i18n, ['index', 'tagline'], '')}
        eyebrow="Victims Union"
        onTitleClick={handleTitleClick}
        title={readPath(i18n, ['common', 'siteName'], 'NO CONVERSION THERAPY')}
        titleClassName="hero-block__title--home"
      >
        <div className="hero-actions">
          {formEnabled ? (
            <a className="glass-button glass-button--primary" href={formHref} {...formLinkProps}>
              {readPath(i18n, ['index', 'fillForm'], 'Form')}
            </a>
          ) : null}
          <a className="glass-button" href={appendLangToUrl('/map', lang)}>
            {readPath(i18n, ['index', 'viewMap'], 'Map')}
          </a>
          <a className="glass-button" href={appendLangToUrl('/blog', lang)}>
            {readPath(i18n, ['index', 'blogLibrary'], 'Blog')}
          </a>
        </div>
      </HeroBlock>

      <section className="showcase-grid">
        {showcaseCards.map((card, index) => (
          <article className="glass-card" key={card.href}>
            <span className="glass-card__badge">{String(index + 1).padStart(2, '0')}</span>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
            <a href={card.href} {...(card.navigationProps || {})}>{card.label}</a>
          </article>
        ))}
      </section>
    </PageChrome>
  );
}

function PortalTabs({ activeSection, i18n, lang, onNavigate }) {
  const compactLabels = {
    blog: lang === 'zh-TW' ? '文庫' : lang === 'zh-CN' ? '文库' : 'Blog',
    map: lang === 'zh-TW' ? '地圖' : lang === 'zh-CN' ? '地图' : 'Map'
  };
  const tabs = [
    { id: 'map', href: '/map', label: compactLabels.map },
    { id: 'blog', href: '/blog', label: compactLabels.blog }
  ];

  return (
    <nav className="portal-tabs" aria-label="Portal sections">
      {tabs.map((tab) => (
        <a
          key={tab.id}
          className={`portal-tabs__item${activeSection === tab.id ? ' is-active' : ''}`}
          href={appendLangToUrl(tab.href, lang)}
          onClick={(event) => {
            event.preventDefault();
            onNavigate(tab.id, tab.href);
          }}
        >
          {tab.label}
        </a>
      ))}
    </nav>
  );
}

function StatChip({ label, value, hint }) {
  const normalizedValue = value == null ? '' : String(value);
  const isCompactValue = normalizedValue.length > 12;

  return (
    <article className="stat-chip">
      <p className="stat-chip__label">{label}</p>
      <strong className={`stat-chip__value${isCompactValue ? ' is-compact' : ''}`}>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}

function LeafletOverviewMap({
  allRecords,
  groups,
  i18n,
  lang,
  onSelectSchool,
  query,
  selectedSchoolKey
}) {
  const mapElementRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerLayerRef = useRef(null);
  const mapTileLayerRef = useRef(null);
  const mapTileProviderIndexRef = useRef(0);
  const provinceLayerRef = useRef(null);
  const provinceFillLayerRef = useRef(null);
  const provinceBorderRendererRef = useRef(null);
  const provinceFillRendererRef = useRef(null);
  const markerAppearanceBySchoolKeyRef = useRef(new Map());
  const markersBySchoolKeyRef = useRef(new Map());

  useEffect(() => {
    if (!mapElementRef.current || mapInstanceRef.current) {
      return undefined;
    }

    const map = L.map(mapElementRef.current, {
      preferCanvas: true,
      zoomControl: false
    }).setView([37.5, 109], 4);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    if (!map.getPane('provinceFillPane')) {
      map.createPane('provinceFillPane');
    }

    if (!map.getPane('provinceBorderPane')) {
      map.createPane('provinceBorderPane');
    }

    if (!map.getPane('schoolMarkerPane')) {
      map.createPane('schoolMarkerPane');
    }

    if (!map.getPane('schoolTooltipPane')) {
      map.createPane('schoolTooltipPane');
    }

    map.getPane('provinceFillPane').style.zIndex = '625';
    map.getPane('provinceFillPane').style.pointerEvents = 'none';
    map.getPane('provinceBorderPane').style.zIndex = '640';
    map.getPane('provinceBorderPane').style.pointerEvents = 'none';
    map.getPane('schoolMarkerPane').style.zIndex = '675';
    map.getPane('schoolTooltipPane').style.zIndex = '800';
    map.getPane('schoolTooltipPane').style.pointerEvents = 'none';

    provinceFillRendererRef.current = L.canvas({
      padding: 0.5,
      pane: 'provinceFillPane'
    });
    provinceBorderRendererRef.current = L.svg({
      pane: 'provinceBorderPane'
    });

    mountMapTileLayer({
      map,
      mapElement: mapElementRef.current,
      minZoom: 4,
      providerIndexRef: mapTileProviderIndexRef,
      tileLayerRef: mapTileLayerRef
    });

    mapInstanceRef.current = map;
    markerLayerRef.current = L.layerGroup().addTo(map);

    requestAnimationFrame(() => {
      map.invalidateSize();
    });

    const removeColorSchemeListener = addColorSchemeListener(() => {
      if (!mapInstanceRef.current) {
        return;
      }

      mapTileProviderIndexRef.current = 0;
      mountMapTileLayer({
        map,
        mapElement: mapElementRef.current,
        minZoom: 4,
        providerIndexRef: mapTileProviderIndexRef,
        tileLayerRef: mapTileLayerRef
      });

      if (provinceLayerRef.current) {
        provinceLayerRef.current.setStyle({
          color: getMapThemeColors().mapOutline
        });
      }
    });

    return () => {
      removeColorSchemeListener();
      map.remove();
      mapInstanceRef.current = null;
      markerLayerRef.current = null;
      mapTileLayerRef.current = null;
      provinceLayerRef.current = null;
      provinceFillLayerRef.current = null;
      provinceBorderRendererRef.current = null;
      provinceFillRendererRef.current = null;
      markerAppearanceBySchoolKeyRef.current = new Map();
      markersBySchoolKeyRef.current = new Map();
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const markerLayer = markerLayerRef.current;

    if (!map || !markerLayer) {
      return undefined;
    }

    markerLayer.clearLayers();
    markerAppearanceBySchoolKeyRef.current = new Map();
    markersBySchoolKeyRef.current = new Map();

    const schoolReportStatsBySchool = buildSchoolReportStats(allRecords);
    const maxReportedMarkerCount = Math.max(0, ...Array.from(schoolReportStatsBySchool.values()).map((stats) => (
      getSchoolMarkerReportCount(stats)
    )));

    groups.forEach((group) => {
      const record = group && group.summaryRecord;
      const lat = Number(record && record.lat);
      const lng = Number(record && record.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }

      const schoolReportStats = schoolReportStatsBySchool.get(group.schoolKey) || { agentCount: 0, selfCount: 0 };
      const schoolMarkerColor = getSchoolMarkerColor(schoolReportStats, maxReportedMarkerCount);
      const schoolMarkerOpacity = getSchoolMarkerOpacity(schoolReportStats, maxReportedMarkerCount);
      const marker = L.marker([lat, lng], {
        icon: getSchoolMarkerIcon(schoolMarkerColor),
        opacity: schoolMarkerOpacity,
        pane: 'schoolMarkerPane'
      });

      marker.bindTooltip(`<strong>${escapeHtml(record.name || '')}</strong>`, {
        direction: 'top',
        pane: 'schoolTooltipPane',
        sticky: true
      });
      marker.bindPopup(
        createGroupedMarkerPopup(group, i18n, lang, query),
        getMarkerPopupWidthOptions(map)
      );
      marker.on('click', () => {
        onSelectSchool(group.schoolKey);
      });

      marker.addTo(markerLayer);
      markerAppearanceBySchoolKeyRef.current.set(group.schoolKey, {
        color: schoolMarkerColor,
        opacity: schoolMarkerOpacity
      });
      markersBySchoolKeyRef.current.set(group.schoolKey, marker);
    });

    let disposed = false;

    loadProvinceGeoJson()
      .then((provinceGeoJson) => {
        if (disposed || !mapInstanceRef.current) {
          return;
        }

        if (provinceFillLayerRef.current) {
          map.removeLayer(provinceFillLayerRef.current);
          provinceFillLayerRef.current = null;
        }

        if (provinceLayerRef.current) {
          map.removeLayer(provinceLayerRef.current);
          provinceLayerRef.current = null;
        }

        const provinceCodeLookup = buildProvinceCodeLookup(provinceGeoJson);
        const provinceDensityMap = buildProvinceDensityMap(
          groups.map((group) => ({
            ...group,
            provinceCode: resolveProvinceCode(
              group && group.summaryRecord && (
                group.summaryRecord.provinceCode
                || group.summaryRecord.province
                || group.summaryRecord.prov
              ),
              provinceCodeLookup
            )
          }))
        );
        const maxProvinceDensity = Math.max(0, ...provinceDensityMap.values(), 0);

        provinceFillLayerRef.current = L.geoJSON(provinceGeoJson, {
          interactive: false,
          renderer: provinceFillRendererRef.current,
          style(feature) {
            const provinceCode = getProvinceCodeFromFeature(feature);
            const density = provinceDensityMap.get(provinceCode) || 0;

            return {
              color: 'transparent',
              fillColor: getProvinceDensityColor(density, maxProvinceDensity),
              fillOpacity: density > 0 ? PROVINCE_DENSITY_FILL_OPACITY : 0,
              opacity: 0,
              weight: 0
            };
          }
        }).addTo(map);

        provinceLayerRef.current = L.geoJSON(provinceGeoJson, {
          interactive: false,
          onEachFeature(feature, layer) {
            bindProvinceLabel(feature, layer, lang);
          },
          renderer: provinceBorderRendererRef.current,
          style() {
            return {
              color: getMapThemeColors().mapOutline,
              dashArray: '3',
              fillOpacity: 0,
              opacity: 1,
              weight: 2
            };
          }
        }).addTo(map);

        if (typeof provinceFillLayerRef.current.bringToFront === 'function') {
          provinceFillLayerRef.current.bringToFront();
        }

        if (typeof provinceLayerRef.current.bringToFront === 'function') {
          provinceLayerRef.current.bringToFront();
        }

        const provinceBounds = provinceLayerRef.current.getBounds();
        if (provinceBounds && typeof provinceBounds.isValid === 'function' && provinceBounds.isValid()) {
          map.fitBounds(provinceBounds.pad(0.03), {
            animate: false,
            maxZoom: 4
          });
        }

        requestAnimationFrame(() => {
          map.invalidateSize();
        });
      })
      .catch(() => {
        requestAnimationFrame(() => {
          map.invalidateSize();
        });
      });

    return () => {
      disposed = true;
    };
  }, [allRecords, groups, i18n, lang, onSelectSchool, query]);

  useEffect(() => {
    markersBySchoolKeyRef.current.forEach((marker, schoolKey) => {
      const appearance = markerAppearanceBySchoolKeyRef.current.get(schoolKey) || {};
      const isSelected = Boolean(selectedSchoolKey) && schoolKey === selectedSchoolKey;

      marker.setIcon(getSchoolMarkerIcon(isSelected ? '#1f6fff' : appearance.color || SCHOOL_MARKER_DEFAULT_COLOR));
      marker.setOpacity(isSelected ? 1 : (
        Number.isFinite(appearance.opacity) ? appearance.opacity : SCHOOL_MARKER_DEFAULT_OPACITY
      ));
      marker.setZIndexOffset(isSelected ? 1200 : 0);
    });

    const marker = markersBySchoolKeyRef.current.get(selectedSchoolKey);

    if (marker && typeof marker.openPopup === 'function') {
      marker.openPopup();
    }
  }, [selectedSchoolKey]);

  return <div className="map-surface" ref={mapElementRef} />;
}

function MapRecordEntryDetails({
  i18n,
  lang,
  query,
  record,
  translateApiUrl,
  translationEnabled
}) {
  const [translationRequested, setTranslationRequested] = useState(false);
  const { sections, translationState } = useRecordTranslations({
    i18n,
    lang,
    record,
    shouldLoad: translationRequested,
    translateApiUrl,
    translationEnabled
  });

  return (
    <details
      className="map-record-entry"
      onToggle={(event) => {
        if (event.currentTarget.open) {
          setTranslationRequested(true);
        }
      }}
    >
      <summary>
        <span>{getInputTypeLabel(i18n, record.inputType)}</span>
        <strong>{getRecordDateSummary(i18n, record)}</strong>
      </summary>
      <div className="map-record-entry__body">
        <TranslatedRecordSections
          headingTag="h4"
          i18n={i18n}
          originalClassName="map-record-entry__section"
          sections={sections}
          textClassName="map-record-entry__translation-text"
          translationClassName="map-record-entry__section map-record-entry__section--translation"
          translationEnabled={translationEnabled}
          translationState={translationState}
        />
        <a className="inline-link" href={buildRecordHref(record, { lang, query })}>
          {readPath(i18n, ['map', 'list', 'viewDetails'], 'Open detail')}
        </a>
      </div>
    </details>
  );
}

function MapRecordCard({
  group,
  i18n,
  lang,
  query,
  selected,
  onSelect,
  translateApiUrl,
  translationEnabled
}) {
  const summaryRecord = group.summaryRecord || {};
  const counts = {
    self: group.pages.filter((page) => page.inputType === SELF_IDENTITY).length,
    agent: group.pages.filter((page) => page.inputType === AGENT_IDENTITY).length
  };

  return (
    <article
      className={`map-record-card${selected ? ' is-selected' : ''}`}
      id={`school-${group.schoolKey}`}
      onMouseEnter={() => onSelect(group.schoolKey)}
    >
      <div className="map-record-card__header">
        <div>
          <h3>{summaryRecord.name || readPath(i18n, ['map', 'record', 'eyebrow'], 'Institution')}</h3>
          <p>{getRecordRegionSummary(i18n, summaryRecord)}</p>
        </div>
        <div className="map-record-card__counts">
          <span>{readPath(i18n, ['map', 'list', 'reportCounts', 'self'], 'Self')} {counts.self}</span>
          <span>{readPath(i18n, ['map', 'list', 'reportCounts', 'agent'], 'Agent')} {counts.agent}</span>
        </div>
      </div>

      {summaryRecord.addr ? <p className="map-record-card__line">{summaryRecord.addr}</p> : null}
      {summaryRecord.contact ? <p className="map-record-card__line">{summaryRecord.contact}</p> : null}

      <div className="map-record-card__entries">
        {group.pages.map((record, index) => (
          <MapRecordEntryDetails
            i18n={i18n}
            key={`${group.schoolKey}-${index}`}
            lang={lang}
            query={query}
            record={record}
            translateApiUrl={translateApiUrl}
            translationEnabled={translationEnabled}
          />
        ))}
      </div>
    </article>
  );
}

function MapSection({ apiUrl, i18n, initialQuery, lang, translateApiUrl, translationEnabled }) {
  const { error, loading, payload } = useMapPayload(apiUrl);
  const [selectedSchoolKey, setSelectedSchoolKey] = useState('');
  const [inputType, setInputType] = useState(initialQuery.inputType || '');
  const [search, setSearch] = useState(initialQuery.search || '');
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setInputType(initialQuery.inputType || '');
    setSearch(initialQuery.search || '');
  }, [initialQuery.inputType, initialQuery.search]);

  const rawRecords = payload && Array.isArray(payload.data) ? payload.data : [];
  const filteredRecords = rawRecords.filter((record) => {
    const matchesInputType = !inputType
      ? true
      : (
        inputType === '批量数据'
          ? !record.inputType
          : record.inputType === inputType
      );

    const normalizedQuery = normalizeText(deferredSearch);
    const searchableFields = [
      record.name,
      record.addr,
      record.experience,
      record.scandal,
      record.contact,
      record.else,
      record.province,
      record.city,
      record.county
    ]
      .map((value) => normalizeText(value))
      .join(' ');

    const matchesSearch = !normalizedQuery || searchableFields.includes(normalizedQuery);
    return matchesInputType && matchesSearch;
  });
  const groupedRecords = groupSchoolRecords(filteredRecords);
  const provinceStats = [...buildProvinceDensityMap(groupedRecords).entries()]
    .map(([province, count]) => ({
      province,
      count
    }))
    .sort((left, right) => Number(right && right.count || 0) - Number(left && left.count || 0))
    .slice(0, 6);

  useEffect(() => {
    if (!selectedSchoolKey && groupedRecords.length > 0) {
      setSelectedSchoolKey(groupedRecords[0].schoolKey);
    }
  }, [groupedRecords, selectedSchoolKey]);

  return (
    <div className="section-stack">
      <HeroBlock
        description={readPath(i18n, ['map', 'note'], '')}
        eyebrow="Map / Liquid Glass"
        title={readPath(i18n, ['map', 'title'], 'Map')}
      >
        <div className="stat-grid">
          <StatChip
            hint={formatRelativeTimestamp(payload && payload.last_synced, lang)}
            label={readPath(i18n, ['map', 'stats', 'lastSynced'], 'Last synced')}
            value={loading ? readPath(i18n, ['common', 'loading'], 'Loading') : formatAbsoluteDate(payload && payload.last_synced, lang)}
          />
          <StatChip
            label={readPath(i18n, ['map', 'stats', 'schoolNum'], 'Schools')}
            value={loading ? '...' : Number(payload && payload.schoolNum || groupedRecords.length)}
          />
          <StatChip
            label={readPath(i18n, ['map', 'stats', 'submittedForms'], 'Submissions')}
            value={loading ? '...' : Number(payload && payload.formNum || rawRecords.length)}
          />
          <StatChip
            label={readPath(i18n, ['map', 'stats', 'averageAge'], 'Average age')}
            value={loading ? '...' : Number(payload && payload.avg_age || 0)}
          />
        </div>
      </HeroBlock>

      <section className="glass-panel">
        <div className="section-heading">
          <h2>{readPath(i18n, ['map', 'sections', 'tags'], 'Filters')}</h2>
        </div>
        <div className="chip-row chip-row--filters">
          {MAP_FILTER_OPTIONS.map((option) => (
            <button
              key={option.value || 'all'}
              className={`filter-chip${inputType === option.value ? ' is-active' : ''}`}
              onClick={() => setInputType(option.value)}
              type="button"
            >
              {readPath(i18n, option.key, option.fallback)}
            </button>
          ))}
        </div>
        <label className="field">
          <span>{readPath(i18n, ['map', 'list', 'searchPlaceholder'], 'Search')}</span>
          <input
            onChange={(event) => {
              startTransition(() => {
                setSearch(event.target.value);
              });
            }}
            placeholder={readPath(i18n, ['map', 'list', 'searchPlaceholder'], 'Search institutions, places, or details')}
            type="text"
            value={search}
          />
        </label>
      </section>

      <section className="glass-panel">
        <div className="section-heading">
          <h2>{readPath(i18n, ['map', 'sections', 'map'], 'Map')}</h2>
          <p>{error || `${groupedRecords.length} visible institutions`}</p>
        </div>
        <LeafletOverviewMap
          allRecords={rawRecords}
          groups={groupedRecords}
          i18n={i18n}
          lang={lang}
          onSelectSchool={setSelectedSchoolKey}
          query={{
            inputType,
            search
          }}
          selectedSchoolKey={selectedSchoolKey}
        />
      </section>

      <section className="glass-panel">
        <div className="section-heading">
          <h2>{readPath(i18n, ['map', 'stats', 'provinceStats'], 'Province distribution')}</h2>
        </div>
        <div className="ranking-grid">
          {provinceStats.map((item) => (
            <article className="ranking-card" key={item.province}>
              <strong>{getProvinceLabel(i18n, item.province)}</strong>
              <span>{Number(item.count || 0)}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="glass-panel">
        <div className="section-heading">
          <h2>{readPath(i18n, ['map', 'api', 'summary'], 'API')}</h2>
        </div>
        <p>{readPath(i18n, ['map', 'api', 'privacy'], '')}</p>
        <p>{readPath(i18n, ['map', 'api', 'implementationBody'], '')}</p>
        <div className="panel-actions">
          <a className="glass-button" href={apiUrl} rel="noreferrer" target="_blank">
            {readPath(i18n, ['map', 'api', 'link'], 'Open API')}
          </a>
        </div>
      </section>

      <section className="glass-panel">
        <div className="section-heading">
          <h2>{readPath(i18n, ['map', 'sections', 'allData'], 'All data')}</h2>
          <p>{loading ? readPath(i18n, ['common', 'loading'], 'Loading') : `${groupedRecords.length} institutions`}</p>
        </div>
        <div className="records-list">
          {groupedRecords.map((group) => (
            <MapRecordCard
              group={group}
              i18n={i18n}
              key={group.schoolKey}
              lang={lang}
              onSelect={setSelectedSchoolKey}
              query={{
                inputType,
                search
              }}
              selected={group.schoolKey === selectedSchoolKey}
              translateApiUrl={translateApiUrl}
              translationEnabled={translationEnabled}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function SuggestionList({ suggestions, onSelect }) {
  if (!suggestions.length) {
    return null;
  }

  return (
    <div className="suggestion-list">
      {suggestions.map((suggestion) => (
        <button
          className="suggestion-list__item"
          key={`${suggestion.name}-${suggestion.addr}`}
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(suggestion);
          }}
          type="button"
        >
          <strong>{suggestion.name || suggestion.addr}</strong>
          {suggestion.addr ? <small>{suggestion.addr}</small> : null}
        </button>
      ))}
    </div>
  );
}

const CoordinatePicker = memo(function CoordinatePicker({ visible, onPick }) {
  const mapElementRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const mapTileLayerRef = useRef(null);
  const mapTileProviderIndexRef = useRef(0);
  const handlePick = useEffectEvent(onPick);

  useEffect(() => {
    if (!visible || !mapElementRef.current || mapInstanceRef.current) {
      return undefined;
    }

    const map = L.map(mapElementRef.current).setView([37.5, 109], 3);

    mountMapTileLayer({
      map,
      mapElement: mapElementRef.current,
      minZoom: 3,
      providerIndexRef: mapTileProviderIndexRef,
      tileLayerRef: mapTileLayerRef
    });

    const removeColorSchemeListener = addColorSchemeListener(() => {
      if (!mapInstanceRef.current) {
        return;
      }

      mapTileProviderIndexRef.current = 0;
      mountMapTileLayer({
        map,
        mapElement: mapElementRef.current,
        minZoom: 3,
        providerIndexRef: mapTileProviderIndexRef,
        tileLayerRef: mapTileLayerRef
      });
    });

    map.on('click', (event) => {
      const { lat, lng } = event.latlng;

      if (markerRef.current) {
        map.removeLayer(markerRef.current);
      }

      markerRef.current = L.circleMarker([lat, lng], {
        className: 'picker-selected-point',
        color: '#1f6fff',
        fillColor: '#5cb6ff',
        fillOpacity: 0.95,
        radius: 8,
        weight: 3
      }).addTo(map);
      markerRef.current.bindPopup(`${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`).openPopup();
      map.setView([lat, lng], Math.max(map.getZoom(), 15), {
        animate: true
      });

      handlePick(lat, lng);
    });

    mapInstanceRef.current = map;
    requestAnimationFrame(() => {
      map.invalidateSize();
    });

    return () => {
      removeColorSchemeListener();
      map.remove();
      mapInstanceRef.current = null;
      mapTileLayerRef.current = null;
      markerRef.current = null;
    };
  }, [visible]);

  if (!visible) {
    return null;
  }

  return <div className="picker-map" ref={mapElementRef} />;
}, (previousProps, nextProps) => previousProps.visible === nextProps.visible);

function CheckboxChoiceGrid({
  customInputName,
  customInputPlaceholder,
  customInputRef,
  customInputValue,
  customValue,
  name,
  onCustomInputChange,
  onToggle,
  options,
  selectedValues
}) {
  return (
    <div className="choice-grid">
      {options.map((option) => {
        const checked = selectedValues.includes(option.value);
        const isCustomOption = option.value === customValue;

        return (
          <label className={`choice-card${checked ? ' is-selected' : ''}${isCustomOption ? ' choice-card--custom' : ''}`} key={option.value}>
            <span className="choice-card__toggle">
              <input
                checked={checked}
                name={name}
                onChange={(event) => onToggle(option.value, event.target.checked)}
                type="checkbox"
                value={option.value}
              />
              <span>{option.label}</span>
            </span>
            {isCustomOption ? (
              <input
                disabled={!checked}
                name={customInputName}
                onChange={(event) => onCustomInputChange(event.target.value)}
                placeholder={customInputPlaceholder}
                ref={customInputRef}
                type="text"
                value={customInputValue}
              />
            ) : null}
          </label>
        );
      })}
    </div>
  );
}

function MainReportForm({ apiUrl, formConfig, i18n, lang }) {
  const autocompleteRecords = useAutocompleteRecords(apiUrl);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [schoolSuggestions, setSchoolSuggestions] = useState([]);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [values, setValues] = useState({
    abuser_info: '',
    agent_relationship: '',
    agent_relationship_other: '',
    birth_year: '',
    cityCode: '',
    contact_information: '',
    countyCode: '',
    date_end: '',
    date_start: '',
    exit_method: '',
    exit_method_other: '',
    experience: '',
    headmaster_name: '',
    identity: formConfig.identityOptions[0] ? formConfig.identityOptions[0].value : SELF_IDENTITY,
    legal_aid_other: '',
    legal_aid_status: '',
    other: '',
    parent_motivation_other: '',
    parent_motivations: [],
    pre_institution_city_code: '',
    pre_institution_province_code: '',
    provinceCode: '',
    scandal: '',
    school_address: '',
    school_name: '',
    sex: '',
    sex_other: '',
    sex_other_type: '',
    violence_categories: [],
    violence_category_other: ''
  });

  const areaSelector = useAreaSelector({ lang });
  const preInstitutionAreaSelector = useAreaSelector({ lang });
  const otherSexInputRef = useRef(null);
  const agentRelationshipOtherInputRef = useRef(null);
  const parentMotivationOtherInputRef = useRef(null);
  const exitMethodOtherInputRef = useRef(null);
  const legalAidOtherInputRef = useRef(null);
  const violenceCategoryOtherInputRef = useRef(null);
  const handleCoordinatePick = useEffectEvent((lat, lng) => {
    applyCoordinates(lat, lng);
  });
  const formMessages = i18n.form || {};
  const isAgentMode = values.identity === AGENT_IDENTITY;
  const hasCustomParentMotivation = values.parent_motivations.includes(CUSTOM_PARENT_MOTIVATION_OPTION);
  const hasCustomViolenceCategory = values.violence_categories.includes(CUSTOM_VIOLENCE_CATEGORY_OPTION);
  const showExitMethod = Boolean(values.date_end);
  const submitDisabled = isSubmitting || !formConfig.formProtectionToken;

  useEffect(() => {
    areaSelector.setProvinceCode(values.provinceCode);
  }, [values.provinceCode]);

  useEffect(() => {
    areaSelector.setCityCode(values.cityCode);
  }, [values.cityCode]);

  useEffect(() => {
    preInstitutionAreaSelector.setProvinceCode(values.pre_institution_province_code);
  }, [values.pre_institution_province_code]);

  useEffect(() => {
    preInstitutionAreaSelector.setCityCode(values.pre_institution_city_code);
  }, [values.pre_institution_city_code]);

  useEffect(() => {
    setSchoolSuggestions(getAutocompleteSuggestions(autocompleteRecords, values.school_name, 'school'));
  }, [autocompleteRecords, values.school_name]);

  useEffect(() => {
    setAddressSuggestions(getAutocompleteSuggestions(autocompleteRecords, values.school_address, 'address'));
  }, [autocompleteRecords, values.school_address]);

  useEffect(() => {
    if (values.sex !== OTHER_SEX_OPTION) {
      setValues((current) => ({
        ...current,
        sex_other: '',
        sex_other_type: ''
      }));
    }
  }, [values.sex]);

  useEffect(() => {
    if (!isAgentMode && (values.agent_relationship || values.agent_relationship_other)) {
      setValues((current) => ({
        ...current,
        agent_relationship: '',
        agent_relationship_other: ''
      }));
    }
  }, [isAgentMode, values.agent_relationship, values.agent_relationship_other]);

  useEffect(() => {
    if (values.agent_relationship !== CUSTOM_AGENT_RELATIONSHIP_OPTION && values.agent_relationship_other) {
      setValues((current) => ({
        ...current,
        agent_relationship_other: ''
      }));
    }
  }, [values.agent_relationship, values.agent_relationship_other]);

  useEffect(() => {
    if (!values.pre_institution_province_code && values.pre_institution_city_code) {
      setValues((current) => ({
        ...current,
        pre_institution_city_code: ''
      }));
    }
  }, [values.pre_institution_city_code, values.pre_institution_province_code]);

  useEffect(() => {
    if (!hasCustomParentMotivation && values.parent_motivation_other) {
      setValues((current) => ({
        ...current,
        parent_motivation_other: ''
      }));
    }
  }, [hasCustomParentMotivation, values.parent_motivation_other]);

  useEffect(() => {
    if (!showExitMethod && (values.exit_method || values.exit_method_other)) {
      setValues((current) => ({
        ...current,
        exit_method: '',
        exit_method_other: ''
      }));
    }
  }, [showExitMethod, values.exit_method, values.exit_method_other]);

  useEffect(() => {
    if (values.exit_method !== CUSTOM_EXIT_METHOD_OPTION && values.exit_method_other) {
      setValues((current) => ({
        ...current,
        exit_method_other: ''
      }));
    }
  }, [values.exit_method, values.exit_method_other]);

  useEffect(() => {
    if (values.legal_aid_status !== CUSTOM_LEGAL_AID_OPTION && values.legal_aid_other) {
      setValues((current) => ({
        ...current,
        legal_aid_other: ''
      }));
    }
  }, [values.legal_aid_other, values.legal_aid_status]);

  useEffect(() => {
    if (!hasCustomViolenceCategory && values.violence_category_other) {
      setValues((current) => ({
        ...current,
        violence_category_other: ''
      }));
    }
  }, [hasCustomViolenceCategory, values.violence_category_other]);

  function updateValue(key, nextValue) {
    setValues((current) => ({
      ...current,
      [key]: nextValue
    }));
  }

  function toggleChoiceValue(key, optionValue, checked) {
    setValues((current) => {
      const currentValues = Array.isArray(current[key]) ? current[key] : [];
      const nextValues = checked
        ? [...currentValues.filter((value) => value !== optionValue), optionValue]
        : currentValues.filter((value) => value !== optionValue);

      return {
        ...current,
        [key]: nextValues
      };
    });
  }

  function applyCoordinates(latitude, longitude) {
    const lat = Number(latitude).toFixed(6);
    const lng = Number(longitude).toFixed(6);

    updateValue('school_address', `latlng${lat},${lng}`);
    setLocationStatus(formatMessage(readPath(formMessages, ['location', 'filled'], 'Current location captured: {lat}, {lng}'), {
      lat,
      lng
    }));
  }

  function showValidationMessage(message, inputRef) {
    window.alert(message);

    if (inputRef && inputRef.current) {
      inputRef.current.focus();
    }
  }

  function handleSubmit(event) {
    const form = event.currentTarget;

    if (values.sex === OTHER_SEX_OPTION && !values.sex_other_type) {
      event.preventDefault();
      showValidationMessage(
        readPath(formMessages, ['validation', 'specifyOtherSex'], 'Please choose an option'),
        otherSexInputRef
      );
      return;
    }

    if (values.sex === OTHER_SEX_OPTION && values.sex_other_type === CUSTOM_OTHER_SEX_OPTION && !values.sex_other.trim()) {
      event.preventDefault();
      showValidationMessage(
        readPath(formMessages, ['validation', 'fillOtherSex'], 'Please enter the custom value'),
        otherSexInputRef
      );
      return;
    }

    if (
      isAgentMode
      && values.agent_relationship === CUSTOM_AGENT_RELATIONSHIP_OPTION
      && !values.agent_relationship_other.trim()
    ) {
      event.preventDefault();
      showValidationMessage(
        readPath(formMessages, ['validation', 'fillAgentRelationshipOther'], 'Please describe the relationship'),
        agentRelationshipOtherInputRef
      );
      return;
    }

    if (values.parent_motivations.length === 0) {
      event.preventDefault();
      showValidationMessage(
        readPath(formMessages, ['validation', 'fillParentMotivations'], 'Please choose at least one reason')
      );
      return;
    }

    if (hasCustomParentMotivation && !values.parent_motivation_other.trim()) {
      event.preventDefault();
      showValidationMessage(
        readPath(formMessages, ['validation', 'fillParentMotivationOther'], 'Please enter the other reason'),
        parentMotivationOtherInputRef
      );
      return;
    }

    if (hasCustomViolenceCategory && !values.violence_category_other.trim()) {
      event.preventDefault();
      showValidationMessage(
        readPath(formMessages, ['validation', 'fillViolenceCategoryOther'], 'Please describe the other violent behavior'),
        violenceCategoryOtherInputRef
      );
      return;
    }

    if (
      showExitMethod
      && values.exit_method === CUSTOM_EXIT_METHOD_OPTION
      && !values.exit_method_other.trim()
    ) {
      event.preventDefault();
      showValidationMessage(
        readPath(formMessages, ['validation', 'fillExitMethodOther'], 'Please describe the other departure method'),
        exitMethodOtherInputRef
      );
      return;
    }

    if (
      values.legal_aid_status === CUSTOM_LEGAL_AID_OPTION
      && !values.legal_aid_other.trim()
    ) {
      event.preventDefault();
      showValidationMessage(
        readPath(formMessages, ['validation', 'fillLegalAidOther'], 'Please enter the additional note'),
        legalAidOtherInputRef
      );
      return;
    }

    if (values.date_start && values.date_end && values.date_end < values.date_start) {
      event.preventDefault();
      window.alert(readPath(formMessages, ['validation', 'endDateBeforeStart'], 'End date cannot be earlier than the start date.'));
      return;
    }

    if (!form.checkValidity()) {
      event.preventDefault();
      form.reportValidity();
      return;
    }

    setIsSubmitting(true);
  }

  return (
    <form action="/submit" className="report-form" method="POST" onSubmit={handleSubmit}>
      <div className="form-honeypot" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input autoComplete="off" id="website" name="website" spellCheck="false" tabIndex="-1" type="text" />
      </div>
      <input name="form_token" type="hidden" value={formConfig.formProtectionToken} />
      <input name="form_variant" type="hidden" value={REACT_PORTAL_ENHANCED_FORM_VARIANT} />

      <p className="form-privacy-note">
        <span>{readPath(formMessages, ['privacyNotice'], '')}</span>
        {readPath(formMessages, ['standalone', 'safetyNotice'], '') ? (
          <strong>{readPath(formMessages, ['standalone', 'safetyNotice'], '')}</strong>
        ) : null}
      </p>
      {!formConfig.formProtectionToken ? (
        <p className="field-note">{readPath(i18n, ['common', 'loading'], 'Loading')}</p>
      ) : null}

      <div className="form-grid">
        <label className="field">
          <span>{readPath(formMessages, ['fields', 'identity'], 'Identity')}</span>
          <select name="identity" onChange={(event) => updateValue('identity', event.target.value)} required value={values.identity}>
            {formConfig.identityOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        {isAgentMode ? (
          <div className="field">
            <span>{readPath(formMessages, ['fields', 'agentRelationship'], 'Relationship to the survivor')}</span>
            <select
              name="agent_relationship"
              onChange={(event) => updateValue('agent_relationship', event.target.value)}
              value={values.agent_relationship}
            >
              <option value="">{readPath(formMessages, ['placeholders', 'agentRelationship'], 'Select the relationship')}</option>
              {(formConfig.agentRelationshipOptions || []).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {values.agent_relationship === CUSTOM_AGENT_RELATIONSHIP_OPTION ? (
              <input
                maxLength={formConfig.formRules.agentRelationship.maxLength}
                name="agent_relationship_other"
                onChange={(event) => updateValue('agent_relationship_other', event.target.value)}
                placeholder={readPath(formMessages, ['placeholders', 'agentRelationshipOther'], 'Other: describe the relationship')}
                ref={agentRelationshipOtherInputRef}
                type="text"
                value={values.agent_relationship_other}
              />
            ) : null}
          </div>
        ) : null}

        <label className="field">
          <span>{isAgentMode ? readPath(formMessages, ['fields', 'victimBirthYear'], 'Victim birth year') : readPath(formMessages, ['fields', 'birthYear'], 'Birth year')}</span>
          <select name="birth_year" onChange={(event) => updateValue('birth_year', event.target.value)} required value={values.birth_year}>
            <option value="">{readPath(formMessages, ['placeholders', 'birthYear'], 'Choose a year')}</option>
            {Array.from({
              length: formConfig.formRules.birthYear.max - formConfig.formRules.birthYear.min + 1
            }, (_, index) => formConfig.formRules.birthYear.max - index).map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{isAgentMode ? readPath(formMessages, ['fields', 'victimSex'], 'Victim sex') : readPath(formMessages, ['fields', 'sex'], 'Sex')}</span>
          <select name="sex" onChange={(event) => updateValue('sex', event.target.value)} required value={values.sex}>
            <option value="">{readPath(formMessages, ['sexOptions', 'placeholder'], 'Choose')}</option>
            {formConfig.sexOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        {values.sex === OTHER_SEX_OPTION ? (
          <div className="field field--full">
            <span>{readPath(formMessages, ['hints', 'otherSex'], 'Choose an option or enter a custom value')}</span>
            <div className="choice-row">
              {formConfig.otherSexTypeOptions.map((option) => (
                <label className="choice-pill" key={option.value}>
                  <input
                    checked={values.sex_other_type === option.value}
                    name="sex_other_type"
                    onChange={(event) => updateValue('sex_other_type', event.target.value)}
                    type="radio"
                    value={option.value}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
              <label className="choice-pill choice-pill--input">
                <input
                  checked={values.sex_other_type === CUSTOM_OTHER_SEX_OPTION}
                  name="sex_other_type"
                  onChange={(event) => updateValue('sex_other_type', event.target.value)}
                  type="radio"
                  value={CUSTOM_OTHER_SEX_OPTION}
                />
                <input
                  maxLength={formConfig.formRules.sexOther.maxLength}
                  name="sex_other"
                  onChange={(event) => {
                    if (otherSexInputRef.current) {
                      otherSexInputRef.current.setCustomValidity('');
                    }
                    updateValue('sex_other', event.target.value);
                    updateValue('sex_other_type', CUSTOM_OTHER_SEX_OPTION);
                  }}
                  placeholder={readPath(formMessages, ['placeholders', 'otherSex'], 'Other')}
                  ref={otherSexInputRef}
                  type="text"
                  value={values.sex_other}
                />
              </label>
            </div>
          </div>
        ) : null}

        <label className="field">
          <span>{readPath(formMessages, ['fields', 'dateStart'], 'Start date')}</span>
          <input name="date_start" onChange={(event) => updateValue('date_start', event.target.value)} required type="date" value={values.date_start} />
          <p className="field-note">{readPath(formMessages, ['hints', 'dateStart'], '')}</p>
        </label>

        <label className="field">
          <span>{readPath(formMessages, ['fields', 'dateEnd'], 'End date')}</span>
          <input name="date_end" onChange={(event) => updateValue('date_end', event.target.value)} type="date" value={values.date_end} />
          <p className="field-note">{readPath(formMessages, ['hints', 'dateEnd'], '')}</p>
        </label>

        <label className="field">
          <span>{readPath(formMessages, ['fields', 'preInstitutionProvinceCode'], 'Province before entering the institution')}</span>
          <select
            name="pre_institution_province_code"
            onChange={(event) => {
              updateValue('pre_institution_province_code', event.target.value);
              updateValue('pre_institution_city_code', '');
            }}
            value={values.pre_institution_province_code}
          >
            <option value="">{readPath(formMessages, ['placeholders', 'preInstitutionProvinceCode'], 'Optional: select the province before entering the institution')}</option>
            {preInstitutionAreaSelector.initialProvinces.map((province) => (
              <option key={province.code} value={province.code}>{province.name}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{readPath(formMessages, ['fields', 'preInstitutionCityCode'], 'City before entering the institution')}</span>
          <select
            disabled={!values.pre_institution_province_code}
            name="pre_institution_city_code"
            onChange={(event) => updateValue('pre_institution_city_code', event.target.value)}
            value={values.pre_institution_city_code}
          >
            <option value="">
              {preInstitutionAreaSelector.loadingCityOptions
                ? readPath(i18n, ['common', 'loading'], 'Loading')
                : readPath(formMessages, ['placeholders', 'preInstitutionCityCode'], 'Optional: select the city before entering the institution')}
            </option>
            {preInstitutionAreaSelector.cityOptions.map((city) => (
              <option key={city.code} value={city.code}>{city.name}</option>
            ))}
          </select>
        </label>

        <div className="field field--full">
          <span>{readPath(formMessages, ['fields', 'parentMotivations'], 'Why did the parent(s) choose the institution?')}</span>
          <CheckboxChoiceGrid
            customInputName="parent_motivation_other"
            customInputPlaceholder={readPath(formMessages, ['placeholders', 'parentMotivationOther'], 'Other reason: describe the reason')}
            customInputRef={parentMotivationOtherInputRef}
            customInputValue={values.parent_motivation_other}
            customValue={CUSTOM_PARENT_MOTIVATION_OPTION}
            name="parent_motivations"
            onCustomInputChange={(nextValue) => updateValue('parent_motivation_other', nextValue)}
            onToggle={(optionValue, checked) => toggleChoiceValue('parent_motivations', optionValue, checked)}
            options={formConfig.parentMotivationOptions || []}
            selectedValues={values.parent_motivations}
          />
        </div>

        {showExitMethod ? (
          <div className="field field--full">
            <span>{readPath(formMessages, ['fields', 'exitMethod'], 'How did the survivor leave the institution?')}</span>
            <select
              name="exit_method"
              onChange={(event) => updateValue('exit_method', event.target.value)}
              value={values.exit_method}
            >
              <option value="">{readPath(formMessages, ['placeholders', 'exitMethod'], 'Optional: select how the survivor left the institution')}</option>
              {(formConfig.exitMethodOptions || []).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {values.exit_method === CUSTOM_EXIT_METHOD_OPTION ? (
              <input
                maxLength={formConfig.formRules.exitMethodOther.maxLength}
                name="exit_method_other"
                onChange={(event) => updateValue('exit_method_other', event.target.value)}
                placeholder={readPath(formMessages, ['placeholders', 'exitMethodOther'], 'Other method: describe how they left')}
                ref={exitMethodOtherInputRef}
                type="text"
                value={values.exit_method_other}
              />
            ) : null}
          </div>
        ) : null}

        <label className="field field--full">
          <span>{readPath(formMessages, ['fields', 'experience'], 'Experience')}</span>
          <textarea
            maxLength={formConfig.formRules.experience.maxLength}
            name="experience"
            onChange={(event) => updateValue('experience', event.target.value)}
            placeholder={readPath(formMessages, ['placeholders', 'experience'], 'Describe what happened')}
            rows="5"
            value={values.experience}
          />
          <p className="field-note">{readPath(formMessages, ['hints', 'experience'], '')}</p>
        </label>

        <div className="field field--full">
          <span>{readPath(formMessages, ['fields', 'legalAidStatus'], 'Was this experience reported or taken to legal aid?')}</span>
          <select
            name="legal_aid_status"
            onChange={(event) => updateValue('legal_aid_status', event.target.value)}
            value={values.legal_aid_status}
          >
            <option value="">{readPath(formMessages, ['placeholders', 'legalAidStatus'], 'Optional: select the current situation')}</option>
            {(formConfig.legalAidOptions || []).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {values.legal_aid_status === CUSTOM_LEGAL_AID_OPTION ? (
            <input
              maxLength={formConfig.formRules.legalAidOther.maxLength}
              name="legal_aid_other"
              onChange={(event) => updateValue('legal_aid_other', event.target.value)}
              placeholder={readPath(formMessages, ['placeholders', 'legalAidOther'], 'Other: add a short note')}
              ref={legalAidOtherInputRef}
              type="text"
              value={values.legal_aid_other}
            />
          ) : null}
        </div>

        <div className="field field--full">
          <span>{readPath(formMessages, ['fields', 'schoolName'], 'Institution')}</span>
          <input
            maxLength={formConfig.formRules.schoolName.maxLength}
            name="school_name"
            onChange={(event) => updateValue('school_name', event.target.value)}
            placeholder={readPath(formMessages, ['placeholders', 'schoolName'], 'Institution name')}
            required
            type="text"
            value={values.school_name}
          />
          <SuggestionList
            onSelect={(suggestion) => {
              updateValue('school_name', suggestion.name);
              updateValue('school_address', suggestion.addr);
              setSchoolSuggestions([]);
            }}
            suggestions={schoolSuggestions}
          />
        </div>

        <label className="field">
          <span>{readPath(formMessages, ['fields', 'province'], 'Province')}</span>
          <select
            name="provinceCode"
            onChange={(event) => {
              updateValue('provinceCode', event.target.value);
              updateValue('cityCode', '');
              updateValue('countyCode', '');
            }}
            required
            value={values.provinceCode}
          >
            <option value="">{readPath(formMessages, ['placeholders', 'province'], 'Select province')}</option>
            {areaSelector.initialProvinces.map((province) => (
              <option key={province.code} value={province.code}>{province.name}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{readPath(formMessages, ['fields', 'city'], 'City')}</span>
          <select
            disabled={!values.provinceCode}
            name="cityCode"
            onChange={(event) => {
              updateValue('cityCode', event.target.value);
              updateValue('countyCode', '');
            }}
            required
            value={values.cityCode}
          >
            <option value="">
              {areaSelector.loadingCityOptions
                ? readPath(i18n, ['common', 'loading'], 'Loading')
                : readPath(formMessages, ['placeholders', 'city'], 'Select city')}
            </option>
            {areaSelector.cityOptions.map((city) => (
              <option key={city.code} value={city.code}>{city.name}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{readPath(formMessages, ['fields', 'county'], 'County')}</span>
          <select
            disabled={!values.cityCode}
            name="countyCode"
            onChange={(event) => updateValue('countyCode', event.target.value)}
            value={values.countyCode}
          >
            <option value="">
              {areaSelector.loadingCountyOptions
                ? readPath(i18n, ['common', 'loading'], 'Loading')
                : readPath(formMessages, ['placeholders', 'countyInitial'], 'Optional')}
            </option>
            {areaSelector.countyOptions.map((county) => (
              <option key={county.code} value={county.code}>{county.name}</option>
            ))}
          </select>
        </label>

        <div className="field field--full">
          <span>{readPath(formMessages, ['fields', 'schoolAddress'], 'Address')}</span>
          <input
            maxLength={formConfig.formRules.schoolAddress.maxLength}
            name="school_address"
            onChange={(event) => updateValue('school_address', event.target.value)}
            placeholder={readPath(formMessages, ['placeholders', 'schoolAddress'], 'Address')}
            type="text"
            value={values.school_address}
          />
          <SuggestionList
            onSelect={(suggestion) => {
              updateValue('school_name', suggestion.name);
              updateValue('school_address', suggestion.addr);
              setAddressSuggestions([]);
            }}
            suggestions={addressSuggestions}
          />
          <div className="inline-actions">
            <button className="glass-button glass-button--small" onClick={() => setShowMapPicker((current) => !current)} type="button">
              {readPath(formMessages, ['buttons', 'openMap'], 'Open map')}
            </button>
            <button
              className="glass-button glass-button--small"
              onClick={async () => {
                try {
                  const position = await new Promise((resolve, reject) => {
                    if (!navigator.geolocation) {
                      reject(new Error('unsupported'));
                      return;
                    }

                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                      enableHighAccuracy: true,
                      maximumAge: 30000,
                      timeout: 15000
                    });
                  });

                  applyCoordinates(position.coords.latitude, position.coords.longitude);
                } catch (error) {
                  setLocationStatus(readPath(formMessages, ['location', 'failed'], error.message || 'Location unavailable'));
                }
              }}
              type="button"
            >
              {readPath(formMessages, ['buttons', 'getCurrentLocation'], 'Use current location')}
            </button>
          </div>
          {locationStatus ? <p className="field-note">{locationStatus}</p> : null}
          <CoordinatePicker
            onPick={handleCoordinatePick}
            visible={showMapPicker}
          />
        </div>

        <label className="field">
          <span>{readPath(formMessages, ['fields', 'headmasterName'], 'Headmaster')}</span>
          <input
            maxLength={formConfig.formRules.headmasterName.maxLength}
            name="headmaster_name"
            onChange={(event) => updateValue('headmaster_name', event.target.value)}
            placeholder={readPath(formMessages, ['placeholders', 'headmasterName'], 'Headmaster')}
            type="text"
            value={values.headmaster_name}
          />
        </label>

        <label className="field">
          <span>{readPath(formMessages, ['fields', 'contactInformation'], 'Contact')}</span>
          <input
            maxLength={formConfig.formRules.contactInformation.maxLength}
            name="contact_information"
            onChange={(event) => updateValue('contact_information', event.target.value)}
            placeholder={readPath(formMessages, ['placeholders', 'contactInformation'], 'Contact information')}
            required
            type="text"
            value={values.contact_information}
          />
        </label>

        <label className="field field--full">
          <span>{readPath(formMessages, ['fields', 'abuserInfo'], 'Known information and description of abusers / drill instructors')}</span>
          <textarea
            maxLength={formConfig.formRules.abuserInfo.maxLength}
            name="abuser_info"
            onChange={(event) => updateValue('abuser_info', event.target.value)}
            placeholder={readPath(formMessages, ['placeholders', 'abuserInfo'], 'You can add names, contact details, violent acts, and other known information.')}
            rows="3"
            value={values.abuser_info}
          />
        </label>

        <div className="field field--full">
          <span>{readPath(formMessages, ['fields', 'violenceCategories'], 'Institution scandals and violent behavior')}</span>
          <CheckboxChoiceGrid
            customInputName="violence_category_other"
            customInputPlaceholder={readPath(formMessages, ['placeholders', 'violenceCategoryOther'], 'Other violent behavior: describe it briefly')}
            customInputRef={violenceCategoryOtherInputRef}
            customInputValue={values.violence_category_other}
            customValue={CUSTOM_VIOLENCE_CATEGORY_OPTION}
            name="violence_categories"
            onCustomInputChange={(nextValue) => updateValue('violence_category_other', nextValue)}
            onToggle={(optionValue, checked) => toggleChoiceValue('violence_categories', optionValue, checked)}
            options={formConfig.violenceCategoryOptions || []}
            selectedValues={values.violence_categories}
          />
        </div>

        <label className="field field--full">
          <span>{readPath(formMessages, ['fields', 'scandal'], 'Scandal')}</span>
          <textarea
            maxLength={formConfig.formRules.scandal.maxLength}
            name="scandal"
            onChange={(event) => updateValue('scandal', event.target.value)}
            placeholder={readPath(formMessages, ['placeholders', 'scandal'], 'Details')}
            rows="4"
            value={values.scandal}
          />
        </label>

        <label className="field field--full">
          <span>{readPath(formMessages, ['fields', 'other'], 'Other')}</span>
          <textarea
            maxLength={formConfig.formRules.other.maxLength}
            name="other"
            onChange={(event) => updateValue('other', event.target.value)}
            placeholder={readPath(formMessages, ['placeholders', 'other'], 'Other notes')}
            rows="3"
            value={values.other}
          />
        </label>
      </div>

      <button className="glass-submit" disabled={submitDisabled} type="submit">
        {isSubmitting
          ? readPath(formMessages, ['buttons', 'submitting'], 'Submitting...')
          : !formConfig.formProtectionToken
            ? readPath(i18n, ['common', 'loading'], 'Loading')
          : readPath(formMessages, ['buttons', 'submit'], 'Submit')}
      </button>
    </form>
  );
}

function BlogSection({
  activeTag,
  blogEntries,
  blogError,
  blogLoading,
  blogTags,
  i18n,
  lang,
  onTagChange
}) {
  const filteredEntries = activeTag
    ? blogEntries.filter((entry) => Array.isArray(entry.tagid) && entry.tagid.includes(activeTag))
    : blogEntries;

  return (
    <div className="section-stack">
      <HeroBlock
        description={readPath(i18n, ['blog', 'subtitle'], '')}
        eyebrow="Blog / Liquid Glass"
        title={readPath(i18n, ['blog', 'title'], 'Blog')}
      />

      <section className="glass-panel">
        <div className="chip-row">
          <button className={`filter-chip${activeTag === '' ? ' is-active' : ''}`} onClick={() => onTagChange('')} type="button">
            {readPath(i18n, ['blog', 'all'], 'All')}
          </button>
          {Object.entries(blogTags).map(([tagId, tagLabel]) => (
            <button
              className={`filter-chip${activeTag === tagId ? ' is-active' : ''}`}
              key={tagId}
              onClick={() => onTagChange(tagId)}
              type="button"
            >
              #{tagLabel}
            </button>
          ))}
        </div>
      </section>

      <section className="blog-grid">
        {blogLoading ? (
          <article className="glass-card">
            <h2>{readPath(i18n, ['common', 'loading'], 'Loading')}</h2>
          </article>
        ) : blogError ? (
          <article className="glass-card">
            <h2>{readPath(i18n, ['blog', 'title'], 'Blog')}</h2>
            <p>{blogError}</p>
          </article>
        ) : filteredEntries.length === 0 ? (
          <article className="glass-card">
            <h2>{readPath(i18n, ['blog', 'empty'], 'No articles yet')}</h2>
          </article>
        ) : filteredEntries.map((entry) => (
          <article className="blog-card" key={`${entry.filename}-${entry.CreationDate}`}>
            <a href={appendLangToUrl(`/port/${encodeURIComponent(entry.filename)}`, lang)}>
              <div className="blog-card__meta">
                {entry.author ? (
                  <span>{readPath(i18n, ['blog', 'author'], 'Author: ')}{entry.author}</span>
                ) : null}
                <span>{readPath(i18n, ['blog', 'creationDate'], 'Date: ')}{entry.localizedCreationDate || entry.CreationDate}</span>
                <span>{readPath(i18n, ['blog', 'language'], 'Language: ')}{entry.localizedLanguage || entry.Language}</span>
              </div>
              <h3>{entry.title}</h3>
              {entry.translatedTitle ? <p className="blog-card__translation">{entry.translatedTitle}</p> : null}
              <div className="chip-row chip-row--compact">
                {Array.isArray(entry.tagid) && entry.tagid.length > 0
                  ? entry.tagid.map((tagId) => (
                    <span className="inline-tag" key={tagId}>#{blogTags[tagId] || tagId}</span>
                  ))
                  : <span className="inline-tag">{readPath(i18n, ['blog', 'noTag'], '#No tag')}</span>}
              </div>
            </a>
          </article>
        ))}
      </section>
    </div>
  );
}

function PortalPage({ bootstrap }) {
  const { apiUrl, currentPath, i18n, lang } = bootstrap;
  const route = resolveFrontendRoute(currentPath);
  const backendConfig = getNoTorsionBackendConfig(bootstrap);
  const blog = useBlogIndex(i18n, lang);
  const [activeSection, setActiveSection] = useState(resolveInitialPortalSection(route.pathname));
  const [activeTag, setActiveTag] = useState(route.query.tag || '');
  const mapSectionRef = useRef(null);
  const blogSectionRef = useRef(null);

  const sectionRefs = {
    blog: blogSectionRef,
    map: mapSectionRef
  };

  useEffect(() => {
    let cancelled = false;
    const initialSection = resolveInitialPortalSection(route.pathname);

    async function scrollToInitialSection() {
      const targetRef = sectionRefs[initialSection];

      if (document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch (_error) {
          // Ignore font loading failures and keep the initial section navigation working.
        }
      }

      if (!cancelled && targetRef && targetRef.current) {
        targetRef.current.scrollIntoView({
          behavior: 'auto',
          block: 'start'
        });
      }
    }

    const timer = window.setTimeout(() => {
      void scrollToInitialSection();
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [route.pathname]);

  useEffect(() => {
    setActiveSection(resolveInitialPortalSection(route.pathname));
    setActiveTag(route.query.tag || '');
  }, [route.pathname, route.query.tag]);

  useEffect(() => {
    const sections = Object.entries(sectionRefs)
      .map(([sectionId, ref]) => ({
        element: ref.current,
        sectionId
      }))
      .filter((entry) => entry.element);

    const observer = new IntersectionObserver((entries) => {
      const visibleEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

      if (visibleEntry && visibleEntry.target.dataset.sectionId) {
        setActiveSection(visibleEntry.target.dataset.sectionId);
      }
    }, {
      rootMargin: '-15% 0px -55% 0px',
      threshold: [0.2, 0.4, 0.6]
    });

    sections.forEach((section) => {
      observer.observe(section.element);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  function navigateToSection(sectionId, href) {
    setActiveSection(sectionId);
    replaceCurrentUrl(appendLangToUrl(href, lang));

    const targetRef = sectionRefs[sectionId];
    if (targetRef && targetRef.current) {
      targetRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }

  function navigateToBlogTag(tagId) {
    const nextUrl = new URL('/blog', window.location.origin);

    if (tagId) {
      nextUrl.searchParams.set('tag', tagId);
    }

    nextUrl.searchParams.set('lang', lang);
    setActiveTag(tagId);
    replaceCurrentUrl(`${nextUrl.pathname}${nextUrl.search}`);
  }

  return (
    <PageChrome bootstrap={bootstrap}>
      <HeroBlock
        description={readPath(i18n, ['index', 'tagline'], '')}
        eyebrow="Stacked Portal"
        title={backendConfig.formEnabled ? 'Map / Blog / Form' : 'Map / Blog'}
      >
        {backendConfig.formEnabled ? (
          <div className="hero-actions">
            <a
              className="glass-button glass-button--primary"
              href={backendConfig.formHref}
              {...getLinkNavigationProps(backendConfig.formHref)}
            >
              {readPath(i18n, ['index', 'fillForm'], 'Form')}
            </a>
          </div>
        ) : null}
      </HeroBlock>

      <PortalTabs activeSection={activeSection} i18n={i18n} lang={lang} onNavigate={navigateToSection} />

      <section className="portal-section" data-section-id="map" ref={mapSectionRef}>
        <MapSection
          apiUrl={apiUrl}
          i18n={i18n}
          initialQuery={route.query}
          lang={lang}
          translateApiUrl={backendConfig.translateApiUrl}
          translationEnabled={backendConfig.recordTranslationEnabled}
        />
      </section>

      <section className="portal-section" data-section-id="blog" ref={blogSectionRef}>
        <BlogSection
          activeTag={activeTag}
          blogEntries={blog.payload.entries}
          blogError={blog.error}
          blogLoading={blog.loading}
          blogTags={blog.payload.tags}
          i18n={i18n}
          lang={lang}
          onTagChange={navigateToBlogTag}
        />
      </section>
    </PageChrome>
  );
}

function CorrectionPage({ bootstrap }) {
  const { apiUrl, currentPath, i18n, lang } = bootstrap;
  const route = resolveFrontendRoute(currentPath);
  const correctionRules = buildLocalizedInstitutionCorrectionRules(i18n);
  const correctionRuntime = useFrontendRuntime('correction');
  const autocompleteRecords = useAutocompleteRecords(apiUrl);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [schoolSuggestions, setSchoolSuggestions] = useState([]);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [values, setValues] = useState({
    cityCode: '',
    contact_information: '',
    correction_content: '',
    countyCode: '',
    headmaster_name: '',
    provinceCode: '',
    school_address: '',
    school_name: route.query.schoolName || ''
  });
  const areaSelector = useAreaSelector({ lang });
  const correctionMessages = i18n.institutionCorrection || {};
  const correctionFormAction = resolveCorrectionFormAction(route.pathname);
  const correctionToken = readPath(correctionRuntime, ['payload', 'formProtectionToken'], '');
  const submitDisabled = isSubmitting || !correctionToken;
  const handleCoordinatePick = useEffectEvent((lat, lng) => {
    applyCoordinates(lat, lng);
  });

  useEffect(() => {
    areaSelector.setProvinceCode(values.provinceCode);
  }, [values.provinceCode]);

  useEffect(() => {
    areaSelector.setCityCode(values.cityCode);
  }, [values.cityCode]);

  useEffect(() => {
    setSchoolSuggestions(getAutocompleteSuggestions(autocompleteRecords, values.school_name, 'school'));
  }, [autocompleteRecords, values.school_name]);

  useEffect(() => {
    setAddressSuggestions(getAutocompleteSuggestions(autocompleteRecords, values.school_address, 'address'));
  }, [autocompleteRecords, values.school_address]);

  function updateValue(key, nextValue) {
    setValues((current) => ({
      ...current,
      [key]: nextValue
    }));
  }

  function applyCoordinates(latitude, longitude) {
    const lat = Number(latitude).toFixed(6);
    const lng = Number(longitude).toFixed(6);

    updateValue('school_address', `latlng${lat},${lng}`);
    setLocationStatus(formatMessage(readPath(correctionMessages, ['location', 'filled'], 'Current location captured: {lat}, {lng}'), {
      lat,
      lng
    }));
  }

  return (
    <PageChrome bootstrap={bootstrap}>
      <HeroBlock
        description={readPath(correctionMessages, ['subtitle'], '')}
        eyebrow="Correction"
        title={readPath(correctionMessages, ['title'], 'Institution correction')}
      >
        <div className="panel-actions">
          <a className="glass-button" href={appendLangToUrl('/map', lang)}>
            {readPath(correctionMessages, ['backToMap'], 'Back to map')}
          </a>
        </div>
      </HeroBlock>

      <section className="glass-panel">
        <form
          action={correctionFormAction}
          className="report-form"
          method="POST"
          onSubmit={(event) => {
            if (!event.currentTarget.checkValidity()) {
              event.preventDefault();
              event.currentTarget.reportValidity();
              return;
            }

            setIsSubmitting(true);
          }}
        >
          <div className="form-honeypot" aria-hidden="true">
            <label htmlFor="website-correction">Website</label>
            <input autoComplete="off" id="website-correction" name="website" spellCheck="false" tabIndex="-1" type="text" />
          </div>
          <input name="form_token" type="hidden" value={correctionToken} />

          <p className="form-privacy-note">{readPath(correctionMessages, ['privacyNotice'], '')}</p>
          {!correctionToken ? (
            <p className="field-note">{readPath(i18n, ['common', 'loading'], 'Loading')}</p>
          ) : null}

          <div className="form-grid">
            <div className="field field--full">
              <span>{readPath(correctionMessages, ['fields', 'schoolName'], 'Institution')}</span>
              <input
                maxLength={correctionRules.schoolName.maxLength}
                name="school_name"
                onChange={(event) => updateValue('school_name', event.target.value)}
                placeholder={readPath(correctionMessages, ['placeholders', 'schoolName'], 'Institution name')}
                required
                type="text"
                value={values.school_name}
              />
              <SuggestionList
                onSelect={(suggestion) => {
                  updateValue('school_name', suggestion.name);
                  updateValue('school_address', suggestion.addr);
                  setSchoolSuggestions([]);
                }}
                suggestions={schoolSuggestions}
              />
            </div>

            <label className="field">
              <span>{readPath(correctionMessages, ['fields', 'province'], 'Province')}</span>
              <select
                name="provinceCode"
                onChange={(event) => {
                  updateValue('provinceCode', event.target.value);
                  updateValue('cityCode', '');
                  updateValue('countyCode', '');
                }}
                value={values.provinceCode}
              >
                <option value="">{readPath(correctionMessages, ['placeholders', 'province'], 'Optional')}</option>
                {areaSelector.initialProvinces.map((province) => (
                  <option key={province.code} value={province.code}>{province.name}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>{readPath(correctionMessages, ['fields', 'city'], 'City')}</span>
              <select
                disabled={!values.provinceCode}
                name="cityCode"
                onChange={(event) => {
                  updateValue('cityCode', event.target.value);
                  updateValue('countyCode', '');
                }}
                value={values.cityCode}
              >
                <option value="">{readPath(correctionMessages, ['placeholders', 'city'], 'Optional')}</option>
                {areaSelector.cityOptions.map((city) => (
                  <option key={city.code} value={city.code}>{city.name}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>{readPath(correctionMessages, ['fields', 'county'], 'County')}</span>
              <select
                disabled={!values.cityCode}
                name="countyCode"
                onChange={(event) => updateValue('countyCode', event.target.value)}
                value={values.countyCode}
              >
                <option value="">{readPath(correctionMessages, ['placeholders', 'countyInitial'], 'Optional')}</option>
                {areaSelector.countyOptions.map((county) => (
                  <option key={county.code} value={county.code}>{county.name}</option>
                ))}
              </select>
            </label>

            <div className="field field--full">
              <span>{readPath(correctionMessages, ['fields', 'schoolAddress'], 'Address')}</span>
              <input
                maxLength={correctionRules.schoolAddress.maxLength}
                name="school_address"
                onChange={(event) => updateValue('school_address', event.target.value)}
                placeholder={readPath(correctionMessages, ['placeholders', 'schoolAddress'], 'Address')}
                type="text"
                value={values.school_address}
              />
              <SuggestionList
                onSelect={(suggestion) => {
                  updateValue('school_name', suggestion.name);
                  updateValue('school_address', suggestion.addr);
                  setAddressSuggestions([]);
                }}
                suggestions={addressSuggestions}
              />
              <div className="inline-actions">
                <button className="glass-button glass-button--small" onClick={() => setShowMapPicker((current) => !current)} type="button">
                  {readPath(correctionMessages, ['buttons', 'openMap'], 'Open map')}
                </button>
                <button
                  className="glass-button glass-button--small"
                  onClick={async () => {
                    try {
                      const position = await new Promise((resolve, reject) => {
                        if (!navigator.geolocation) {
                          reject(new Error('unsupported'));
                          return;
                        }

                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                          enableHighAccuracy: true,
                          maximumAge: 30000,
                          timeout: 15000
                        });
                      });

                      applyCoordinates(position.coords.latitude, position.coords.longitude);
                    } catch (error) {
                      setLocationStatus(readPath(correctionMessages, ['location', 'failed'], error.message || 'Location unavailable'));
                    }
                  }}
                  type="button"
                >
                  {readPath(correctionMessages, ['buttons', 'getCurrentLocation'], 'Use current location')}
                </button>
              </div>
              {locationStatus ? <p className="field-note">{locationStatus}</p> : null}
              <CoordinatePicker
                onPick={handleCoordinatePick}
                visible={showMapPicker}
              />
            </div>

            <label className="field">
              <span>{readPath(correctionMessages, ['fields', 'contactInformation'], 'Contact')}</span>
              <input
                maxLength={correctionRules.contactInformation.maxLength}
                name="contact_information"
                onChange={(event) => updateValue('contact_information', event.target.value)}
                placeholder={readPath(correctionMessages, ['placeholders', 'contactInformation'], 'Contact')}
                type="text"
                value={values.contact_information}
              />
            </label>

            <label className="field">
              <span>{readPath(correctionMessages, ['fields', 'headmasterName'], 'Headmaster')}</span>
              <input
                maxLength={correctionRules.headmasterName.maxLength}
                name="headmaster_name"
                onChange={(event) => updateValue('headmaster_name', event.target.value)}
                placeholder={readPath(correctionMessages, ['placeholders', 'headmasterName'], 'Headmaster')}
                type="text"
                value={values.headmaster_name}
              />
            </label>

            <label className="field field--full">
              <span>{readPath(correctionMessages, ['fields', 'correctionContent'], 'Correction')}</span>
              <textarea
                maxLength={correctionRules.correctionContent.maxLength}
                name="correction_content"
                onChange={(event) => updateValue('correction_content', event.target.value)}
                placeholder={readPath(correctionMessages, ['placeholders', 'correctionContent'], 'Correction content')}
                rows="6"
                value={values.correction_content}
              />
            </label>
          </div>

          <button className="glass-submit" disabled={submitDisabled} type="submit">
            {isSubmitting
              ? readPath(correctionMessages, ['buttons', 'submitting'], 'Submitting...')
              : !correctionToken
                ? readPath(i18n, ['common', 'loading'], 'Loading')
              : readPath(correctionMessages, ['buttons', 'submit'], 'Submit')}
          </button>
        </form>
      </section>
    </PageChrome>
  );
}

function AboutPage({ bootstrap }) {
  const { i18n, pageProps } = bootstrap;

  return (
    <PageChrome bootstrap={bootstrap}>
      <HeroBlock
        description={readPath(i18n, ['index', 'tagline'], '')}
        eyebrow="About"
        title={readPath(i18n, ['about', 'title'], 'About')}
      />

      <section className="glass-panel prose-grid">
        <div className="glass-copy">
          <p>{readPath(i18n, ['about', 'ownership'], '')}</p>
          <p>{readPath(i18n, ['about', 'origin'], '')}</p>
          <p>{readPath(i18n, ['about', 'thanks'], '')}</p>
        </div>
      </section>

      <section className="friends-grid-react">
        {pageProps.friends.map((friend) => (
          <article className="friend-card-react" key={friend.url}>
            <a href={friend.url} rel="noreferrer" target="_blank">
              <div className="friend-card-react__avatar-wrap" style={{ '--friend-accent': friend.color }}>
                <img alt={friend.name} src={friend.avatar} />
              </div>
              <h3>{friend.name}</h3>
              {friend.desc ? <p>{friend.desc}</p> : null}
              {friend.signature ? <small>{friend.signature}</small> : null}
            </a>
          </article>
        ))}
      </section>
    </PageChrome>
  );
}

function DebugCard({ item }) {
  return (
    <article className={`glass-card debug-card-react${item.wide ? ' is-wide' : ''}`}>
      <p className="glass-card__badge">{item.label}</p>
      {item.badgeTone ? (
        <span className={`debug-badge-react debug-badge-react--${item.badgeTone}`}>{item.value}</span>
      ) : (
        <code className={`debug-value-react${item.multiline ? ' is-multiline' : ''}`}>{item.value}</code>
      )}
      {item.hint ? <p>{item.hint}</p> : null}
    </article>
  );
}

function DebugPage({ bootstrap }) {
  const { i18n, lang, pageProps } = bootstrap;
  const debugSections = Array.isArray(pageProps.debugSections) ? pageProps.debugSections : [];
  const debugTools = Array.isArray(pageProps.debugTools) ? pageProps.debugTools : [];

  return (
    <PageChrome bootstrap={bootstrap}>
      <HeroBlock
        description={readPath(i18n, ['debug', 'intro'], '')}
        eyebrow="Debug / Liquid Glass"
        title={readPath(i18n, ['debug', 'title'], 'Debug')}
      >
        <div className="hero-actions">
          <a className="glass-button glass-button--primary" href={appendLangToUrl('/', lang)}>
            {readPath(i18n, ['navigation', 'home'], 'Home')}
          </a>
          <a className="glass-button" href={appendLangToUrl('/map', lang)}>
            {readPath(i18n, ['map', 'title'], 'Map')}
          </a>
        </div>
      </HeroBlock>

      {debugSections.map((section) => (
        <section className="glass-panel" key={section.title}>
          <div className="section-heading">
            <h2>{section.title}</h2>
          </div>
          <div className="debug-grid-react">
            {(Array.isArray(section.items) ? section.items : []).map((item) => (
              <DebugCard item={item} key={`${section.title}-${item.label}`} />
            ))}
          </div>
        </section>
      ))}

      <section className="glass-panel">
        <div className="section-heading">
          <h2>{readPath(i18n, ['debug', 'sections', 'tools'], 'Debug tools')}</h2>
        </div>
        <div className="debug-tool-grid">
          {debugTools.map((tool) => (
            <article className="glass-card debug-tool-card" key={tool.href}>
              <span className="glass-card__badge">{tool.label}</span>
              <a className="glass-button glass-button--small" href={appendLangToUrl(tool.href, lang)}>
                {tool.label}
              </a>
              <code className="debug-value-react is-multiline">{tool.href}</code>
            </article>
          ))}
        </div>
      </section>
    </PageChrome>
  );
}

function PrivacyPage({ bootstrap }) {
  const { i18n } = bootstrap;
  const privacy = i18n.privacy || {};

  return (
    <PageChrome bootstrap={bootstrap}>
      <HeroBlock
        description={privacy.intro}
        eyebrow={readPath(i18n, ['navigation', 'privacy'], 'Privacy')}
        title={privacy.title || readPath(i18n, ['navigation', 'privacy'], 'Privacy')}
      />

      <section className="showcase-grid">
        <article className="glass-card">
          <h2>{privacy.sections && privacy.sections.summary}</h2>
          <p>{privacy.summary}</p>
        </article>
        <article className="glass-card">
          <h2>{privacy.sections && privacy.sections.formSubmission}</h2>
          <p>{privacy.formLead}</p>
        </article>
        <article className="glass-card">
          <h2>{privacy.sections && privacy.sections.contact}</h2>
          <p>{privacy.contactBody}</p>
        </article>
      </section>

      {[
        ['summary', privacy.overviewItems],
        ['formSubmission', privacy.formItems],
        ['thirdParty', privacy.thirdPartyItems],
        ['retention', privacy.retentionItems],
        ['security', privacy.securityItems],
        ['manage', privacy.manageItems]
      ].map(([key, items]) => (
        <section className="glass-panel" key={key}>
          <div className="section-heading">
            <h2>{privacy.sections && privacy.sections[key]}</h2>
          </div>
          <div className="bullet-list">
            {(Array.isArray(items) ? items : []).map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </section>
      ))}
    </PageChrome>
  );
}

function DataTable({ columns, rows }) {
  return (
    <div className="table-shell">
      <table className="glass-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`row-${index}`}>
              {columns.map((column) => (
                <td key={column.key}>{row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubmissionDiagnosticsCard({ diagnostics, i18n }) {
  if (!diagnostics || !diagnostics.attemptedTargets) {
    return null;
  }

  return (
    <article className="glass-card diagnostics-card">
      <h2>{readPath(i18n, ['submitStatus', 'title'], 'Submission status')}</h2>
      <p><strong>{readPath(i18n, ['submitStatus', 'mode'], 'Mode')}</strong> {diagnostics.attemptedTargets.map((target) => target.label).join(' / ')}</p>
      <p><strong>{readPath(i18n, ['submitStatus', 'successfulTargets'], 'Successful')}</strong> {diagnostics.successfulTargets.length > 0 ? diagnostics.successfulTargets.map((target) => target.label).join(' / ') : readPath(i18n, ['submitStatus', 'none'], 'None')}</p>
      <p><strong>{readPath(i18n, ['submitStatus', 'failedTargets'], 'Failed')}</strong> {diagnostics.failedTargets.length > 0 ? diagnostics.failedTargets.map((target) => target.label).join(' / ') : readPath(i18n, ['submitStatus', 'none'], 'None')}</p>
      {diagnostics.failedTargets.length > 0 ? (
        <div className="bullet-list">
          {diagnostics.failedTargets.map((target) => (
            <p key={target.id}><strong>{target.label}</strong> {readPath(i18n, ['submitStatus', 'error'], 'Error: ')}{target.error}</p>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function SubmitSuccessPage({ bootstrap }) {
  const { i18n, pageProps, lang } = bootstrap;

  return (
    <PageChrome bootstrap={bootstrap}>
      <HeroBlock
        description={readPath(i18n, ['submitSuccess', 'message'], '')}
        eyebrow="Submission"
        title={readPath(i18n, ['submitSuccess', 'title'], 'Submitted')}
      >
        <div className="hero-actions">
          <a className="glass-button glass-button--primary" href={appendLangToUrl('/', lang)}>
            {readPath(i18n, ['submitSuccess', 'backHome'], 'Back home')}
          </a>
          <a className="glass-button" href="https://github.com/HosinoEJ/No-Torsion">
            {readPath(i18n, ['submitSuccess', 'petition'], 'Project')}
          </a>
        </div>
      </HeroBlock>
      <SubmissionDiagnosticsCard diagnostics={pageProps.submissionDiagnostics} i18n={i18n} />
    </PageChrome>
  );
}

function SubmitPreviewPage({ bootstrap }) {
  const { i18n, pageProps, lang } = bootstrap;

  return (
    <PageChrome bootstrap={bootstrap}>
      <HeroBlock
        description={readPath(i18n, ['submitPreview', 'intro'], '')}
        eyebrow="Submission Preview"
        title={readPath(i18n, ['submitPreview', 'title'], 'Preview')}
      />

      <section className="glass-panel">
        <p><strong>{readPath(i18n, ['submitPreview', 'targetUrl'], 'Target URL')}</strong> <code>{pageProps.googleFormUrl}</code></p>
        <DataTable
          columns={[
            { key: 'entryId', label: readPath(i18n, ['submitPreview', 'columns', 'entry'], 'Entry') },
            { key: 'label', label: readPath(i18n, ['submitPreview', 'columns', 'field'], 'Field') },
            { key: 'value', label: readPath(i18n, ['submitPreview', 'columns', 'value'], 'Value') }
          ]}
          rows={pageProps.fields || []}
        />
        <h2>{readPath(i18n, ['submitPreview', 'payload'], 'Payload')}</h2>
        <pre className="code-block">{pageProps.encodedPayload}</pre>
        <div className="panel-actions">
          <a className="glass-button" href={appendLangToUrl(pageProps.backFormUrl || '/form', lang)}>
            {readPath(i18n, ['submitPreview', 'backForm'], 'Back')}
          </a>
        </div>
      </section>
    </PageChrome>
  );
}

function SubmitConfirmPage({ bootstrap }) {
  const { i18n, pageProps, lang } = bootstrap;
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <PageChrome bootstrap={bootstrap}>
      <HeroBlock
        description={readPath(i18n, ['submitConfirm', 'intro'], '')}
        eyebrow="Submission Confirm"
        title={readPath(i18n, ['submitConfirm', 'title'], 'Confirm')}
      />

      <section className="glass-panel">
        <DataTable
          columns={[
            { key: 'label', label: readPath(i18n, ['submitConfirm', 'columns', 'field'], 'Field') },
            { key: 'value', label: readPath(i18n, ['submitConfirm', 'columns', 'value'], 'Value') }
          ]}
          rows={pageProps.fields || []}
        />

        <form
          action={pageProps.confirmAction || '/submit/confirm'}
          className="confirm-form"
          method="POST"
          onSubmit={() => {
            setIsSubmitting(true);
          }}
        >
          <input name="confirmation_token" type="hidden" value={pageProps.confirmationToken} />
          <textarea hidden name="confirmation_payload" readOnly value={pageProps.confirmationPayload} />
          <div className="panel-actions">
            <a className="glass-button" href={appendLangToUrl(pageProps.backFormUrl || '/form', lang)}>
              {readPath(i18n, ['submitConfirm', 'backForm'], 'Back')}
            </a>
            <button className="glass-submit glass-submit--inline" type="submit">
              {isSubmitting
                ? readPath(i18n, ['submitConfirm', 'confirming'], readPath(i18n, ['common', 'loading'], 'Loading'))
                : readPath(i18n, ['submitConfirm', 'confirm'], 'Confirm')}
            </button>
          </div>
        </form>
      </section>
    </PageChrome>
  );
}

function SubmitErrorPage({ bootstrap }) {
  const { i18n, pageProps, lang } = bootstrap;

  return (
    <PageChrome bootstrap={bootstrap}>
      <HeroBlock
        description={readPath(i18n, ['submitError', 'intro'], '')}
        eyebrow="Submission Error"
        title={readPath(i18n, ['submitError', 'title'], 'Submission failed')}
      />

      <section className="glass-panel">
        {pageProps.errorMessage ? <p>{pageProps.errorMessage}</p> : null}
        {pageProps.fallbackUrl ? (
          <>
            <div className="panel-actions">
              <a className="glass-button glass-button--primary" href={pageProps.fallbackUrl} rel="noreferrer" target="_blank">
                {readPath(i18n, ['submitError', 'openFallback'], 'Open fallback')}
              </a>
              <a className="glass-button" href={appendLangToUrl(pageProps.backFormUrl || '/form', lang)}>
                {readPath(i18n, ['submitError', 'backForm'], 'Back to form')}
              </a>
            </div>
            <pre className="code-block">{pageProps.fallbackUrl}</pre>
          </>
        ) : (
          <div className="panel-actions">
            <a className="glass-button" href={appendLangToUrl(pageProps.backFormUrl || '/form', lang)}>
              {readPath(i18n, ['submitError', 'backForm'], 'Back to form')}
            </a>
          </div>
        )}
      </section>

      <SubmissionDiagnosticsCard diagnostics={pageProps.submissionDiagnostics} i18n={i18n} />
    </PageChrome>
  );
}

function CorrectionSuccessPage({ bootstrap }) {
  const { i18n, lang, pageProps } = bootstrap;

  return (
    <PageChrome bootstrap={bootstrap}>
      <HeroBlock
        description={readPath(i18n, ['institutionCorrection', 'success', 'message'], '')}
        eyebrow="Correction Success"
        title={readPath(i18n, ['institutionCorrection', 'success', 'title'], 'Correction received')}
      >
        <div className="hero-actions">
          <a className="glass-button glass-button--primary" href={appendLangToUrl('/map', lang)}>
            {readPath(i18n, ['institutionCorrection', 'success', 'backToMap'], 'Back to map')}
          </a>
          <a className="glass-button" href={appendLangToUrl('/', lang)}>
            {readPath(i18n, ['submitSuccess', 'backHome'], 'Back home')}
          </a>
        </div>
      </HeroBlock>

      <SubmissionDiagnosticsCard diagnostics={pageProps.submissionDiagnostics} i18n={i18n} />
    </PageChrome>
  );
}

function CorrectionErrorPage({ bootstrap }) {
  const { i18n, lang, pageProps } = bootstrap;

  return (
    <PageChrome bootstrap={bootstrap}>
      <HeroBlock
        description={readPath(i18n, ['institutionCorrection', 'errorPage', 'intro'], '')}
        eyebrow="Correction Error"
        title={readPath(i18n, ['institutionCorrection', 'errorPage', 'title'], 'Correction failed')}
      />

      <section className="glass-panel">
        {pageProps.errorMessage ? <p>{pageProps.errorMessage}</p> : null}
        {pageProps.fallbackUrl ? (
          <>
            <div className="panel-actions">
              <a className="glass-button glass-button--primary" href={pageProps.fallbackUrl} rel="noreferrer" target="_blank">
                {readPath(i18n, ['institutionCorrection', 'errorPage', 'openFallback'], 'Open fallback')}
              </a>
              <a className="glass-button" href={appendLangToUrl(pageProps.backFormUrl || '/map/correction', lang)}>
                {readPath(i18n, ['institutionCorrection', 'errorPage', 'backToForm'], 'Back to form')}
              </a>
            </div>
            <pre className="code-block">{pageProps.fallbackUrl}</pre>
          </>
        ) : (
          <div className="panel-actions">
            <a className="glass-button" href={appendLangToUrl(pageProps.backFormUrl || '/map/correction', lang)}>
              {readPath(i18n, ['institutionCorrection', 'errorPage', 'backToForm'], 'Back to form')}
            </a>
          </div>
        )}
      </section>

      <SubmissionDiagnosticsCard diagnostics={pageProps.submissionDiagnostics} i18n={i18n} />
    </PageChrome>
  );
}

function FormEntryPage({ bootstrap }) {
  const { i18n, lang } = bootstrap;
  const backendConfig = getNoTorsionBackendConfig(bootstrap);
  const accessCopy = getFormAccessModeCopy(lang, backendConfig.formEnabled);

  return (
    <PageChrome bootstrap={bootstrap}>
      <HeroBlock
        description={accessCopy.body}
        eyebrow={readPath(i18n, ['form', 'title'], 'Form')}
        title={readPath(i18n, ['index', 'fillForm'], 'Form')}
      >
        <div className="panel-actions">
          <a className="glass-button" href={appendLangToUrl('/', lang)}>
            {readPath(i18n, ['navigation', 'home'], 'Home')}
          </a>
          {backendConfig.formEnabled ? (
            <a
              className="glass-button glass-button--primary"
              href="#form-embed"
            >
              {accessCopy.ctaLabel || readPath(i18n, ['index', 'fillForm'], 'Form')}
            </a>
          ) : null}
          <a className="glass-button" href={appendLangToUrl('/map', lang)}>
            {readPath(i18n, ['index', 'viewMap'], 'Map')}
          </a>
          <a className="glass-button" href={appendLangToUrl('/blog', lang)}>
            {readPath(i18n, ['index', 'blogLibrary'], 'Blog')}
          </a>
        </div>
      </HeroBlock>

      {backendConfig.formEnabled && backendConfig.backendFormHref ? (
        <section className="form-embed-shell" id="form-embed" aria-label={readPath(i18n, ['index', 'fillForm'], 'Form')}>
          <iframe
            allow="geolocation"
            className="form-embed-frame"
            src={backendConfig.backendFormHref}
            title={readPath(i18n, ['index', 'fillForm'], 'Form')}
          />
        </section>
      ) : (
        <FormAccessSection bootstrap={bootstrap} />
      )}
    </PageChrome>
  );
}

function buildRecordTranslationSections(i18n, record) {
  return RECORD_TRANSLATION_FIELD_CONFIGS
    .map((config) => ({
      ...config,
      sourceText: String(record && record[config.sourceKey] || '').trim(),
      translatedLabel: readPath(i18n, config.titlePath, config.titleFallback)
    }))
    .filter((section) => section.sourceText);
}

function useRecordTranslations({
  i18n,
  lang,
  record,
  shouldLoad = true,
  translateApiUrl,
  translationEnabled
}) {
  const sections = buildRecordTranslationSections(i18n, record);
  const [translationState, setTranslationState] = useState({
    status: 'idle',
    textsByField: {}
  });
  const requestKey = sections.map((section) => `${section.fieldKey}:${section.sourceText}`).join('\n');

  useEffect(() => {
    let cancelled = false;

    if (!translationEnabled || !translateApiUrl || sections.length === 0) {
      setTranslationState({
        status: 'idle',
        textsByField: {}
      });
      return () => {
        cancelled = true;
      };
    }

    if (!shouldLoad) {
      return () => {
        cancelled = true;
      };
    }

    const cachedTextsByField = Object.create(null);
    const pendingItems = [];

    sections.forEach((section) => {
      const cachedTranslation = readTranslationCache(lang, section.sourceText);

      if (cachedTranslation) {
        cachedTextsByField[section.fieldKey] = cachedTranslation;
      } else {
        pendingItems.push(section);
      }
    });

    if (pendingItems.length === 0) {
      setTranslationState({
        status: 'loaded',
        textsByField: cachedTextsByField
      });
      return () => {
        cancelled = true;
      };
    }

    setTranslationState({
      status: 'loading',
      textsByField: cachedTextsByField
    });

    void requestNoTorsionTranslations({
      items: pendingItems.map((section) => ({
        fieldKey: section.fieldKey,
        text: section.sourceText
      })),
      targetLanguage: lang,
      translateApiUrl
    })
      .then((translations) => {
        if (cancelled) {
          return;
        }

        const nextTextsByField = {
          ...cachedTextsByField
        };

        translations.forEach((entry) => {
          const translatedText = entry && typeof entry.translatedText === 'string'
            ? entry.translatedText.trim()
            : '';
          const matchedSection = pendingItems.find((section) => section.fieldKey === entry.fieldKey);

          if (!translatedText || !matchedSection) {
            return;
          }

          nextTextsByField[entry.fieldKey] = translatedText;
          writeTranslationCache(lang, matchedSection.sourceText, translatedText);
        });

        setTranslationState({
          status: 'loaded',
          textsByField: nextTextsByField
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setTranslationState({
          status: 'error',
          textsByField: cachedTextsByField
        });
      });

    return () => {
      cancelled = true;
    };
  }, [lang, requestKey, shouldLoad, translateApiUrl, translationEnabled]);

  return {
    sections,
    translationState
  };
}

function TranslatedRecordSections({
  headingTag = 'h2',
  i18n,
  originalClassName = 'prose-panel',
  sections,
  textClassName = 'translation-text',
  translationClassName = 'prose-panel prose-panel--translation',
  translationEnabled,
  translationState
}) {
  const HeadingTag = headingTag;

  if (sections.length === 0) {
    return null;
  }

  return sections.map((section) => {
    const translatedText = translationState.textsByField[section.fieldKey] || '';
    const translationStatusClass = translatedText
      ? 'is-ready'
      : (
        translationState.status === 'error' || translationState.status === 'loaded'
          ? 'is-unavailable'
          : 'is-loading'
      );
    const translationMessage = translatedText
      || (
        translationState.status === 'error' || translationState.status === 'loaded'
          ? readPath(i18n, ['map', 'list', 'translationUnavailable'], 'Translation unavailable')
          : readPath(i18n, ['map', 'list', 'translationLoading'], 'Translating...')
      );

    return (
      <div className="record-translation-stack" key={section.fieldKey}>
        <div className={originalClassName}>
          <HeadingTag>{translationEnabled ? section.originalLabel : section.translatedLabel}</HeadingTag>
          <p>{section.sourceText}</p>
        </div>
        {translationEnabled ? (
          <div className={`${translationClassName} ${translationStatusClass}`.trim()}>
            <HeadingTag>{section.translatedLabel}</HeadingTag>
            <p className={`${textClassName} ${translationStatusClass}`.trim()}>
              {translationMessage}
            </p>
          </div>
        ) : null}
      </div>
    );
  });
}

function RecordTranslationSections({ i18n, lang, record, translateApiUrl, translationEnabled }) {
  const { sections, translationState } = useRecordTranslations({
    i18n,
    lang,
    record,
    translateApiUrl,
    translationEnabled
  });

  return (
    <TranslatedRecordSections
      i18n={i18n}
      sections={sections}
      translationEnabled={translationEnabled}
      translationState={translationState}
    />
  );
}

function ArticlePage({ bootstrap }) {
  const { currentPath, i18n, lang } = bootstrap;
  const backendConfig = getNoTorsionBackendConfig(bootstrap);
  const route = resolveFrontendRoute(currentPath);
  const article = useBlogArticle(route.articleId);
  const articleShellRef = useRef(null);

  useEffect(() => {
    if (
      !backendConfig.articleTranslationEnabled
      || !backendConfig.translateApiUrl
      || !article.payload
      || !articleShellRef.current
    ) {
      return;
    }

    const translationNodes = Array.from(
      articleShellRef.current.querySelectorAll('[data-blog-translation-source]')
    );
    let cancelled = false;

    if (translationNodes.length === 0) {
      return;
    }

    function revealTranslation(node, translatedText) {
      if (!node || !translatedText || cancelled) {
        return;
      }

      node.textContent = translatedText;
      node.hidden = false;
      node.classList.add('is-visible');
      node.dataset.translationState = 'loaded';
    }

    function chunkEntries(entries, size) {
      const chunks = [];

      for (let index = 0; index < entries.length; index += size) {
        chunks.push(entries.slice(index, index + size));
      }

      return chunks;
    }

    async function hydrateTranslationNodes(nodes) {
      const pendingEntries = [];

      nodes.forEach((node, index) => {
        const sourceText = String(node.dataset.blogTranslationSource || '').trim();

        if (!sourceText) {
          return;
        }

        const cachedTranslation = readTranslationCache(lang, sourceText);

        if (cachedTranslation) {
          revealTranslation(node, cachedTranslation);
          return;
        }

        node.dataset.translationState = 'loading';
        pendingEntries.push({
          fieldKey: String(index),
          node,
          sourceText
        });
      });

      for (const entryChunk of chunkEntries(pendingEntries, BLOG_TRANSLATION_REQUEST_BATCH_SIZE)) {
        if (cancelled) {
          return;
        }

        try {
          const translations = await requestNoTorsionTranslations({
            items: entryChunk.map((entry) => ({
              fieldKey: entry.fieldKey,
              text: entry.sourceText
            })),
            targetLanguage: lang,
            translateApiUrl: backendConfig.translateApiUrl
          });
          const translatedTextByFieldKey = Object.create(null);

          translations.forEach((entry) => {
            if (!entry || typeof entry.fieldKey !== 'string') {
              return;
            }

            translatedTextByFieldKey[entry.fieldKey] = typeof entry.translatedText === 'string'
              ? entry.translatedText.trim()
              : '';
          });

          entryChunk.forEach(({ fieldKey, node, sourceText }) => {
            const translatedText = translatedTextByFieldKey[fieldKey] || '';

            if (!translatedText) {
              node.dataset.translationState = 'empty';
              return;
            }

            writeTranslationCache(lang, sourceText, translatedText);
            revealTranslation(node, translatedText);
          });
        } catch (_error) {
          entryChunk.forEach(({ node }) => {
            node.dataset.translationState = 'error';
          });
        }

        await new Promise((resolve) => {
          window.setTimeout(resolve, 0);
        });
      }
    }

    void hydrateTranslationNodes(translationNodes);

    return () => {
      cancelled = true;
    };
  }, [
    article.payload,
    backendConfig.articleTranslationEnabled,
    backendConfig.translateApiUrl,
    lang
  ]);

  if (article.loading) {
    return (
      <PageChrome bootstrap={bootstrap}>
        <HeroBlock
          description={readPath(i18n, ['blog', 'subtitle'], '')}
          eyebrow="Blog Article"
          title={readPath(i18n, ['common', 'loading'], 'Loading')}
        />
      </PageChrome>
    );
  }

  if (article.error || !article.payload) {
    return (
      <PageChrome bootstrap={bootstrap}>
        <HeroBlock
          description={article.error || readPath(i18n, ['blog', 'articleNotFound'], 'Article unavailable')}
          eyebrow="Blog Article"
          title={readPath(i18n, ['blog', 'title'], 'Article')}
        >
          <div className="panel-actions">
            <a className="glass-button" href={appendLangToUrl('/blog', lang)}>
              {readPath(i18n, ['navigation', 'allArticles'], 'All articles')}
            </a>
          </div>
        </HeroBlock>
      </PageChrome>
    );
  }

  return (
    <PageChrome bootstrap={bootstrap}>
      <HeroBlock
        description={readPath(i18n, ['blog', 'subtitle'], '')}
        eyebrow="Blog Article"
        title={article.payload.articleId || readPath(i18n, ['blog', 'title'], 'Article')}
      >
        <div className="panel-actions">
          <a className="glass-button" href={appendLangToUrl('/blog', lang)}>
            {readPath(i18n, ['navigation', 'allArticles'], 'All articles')}
          </a>
        </div>
      </HeroBlock>

      <section className="glass-panel blog-article-shell">
        <div
          dangerouslySetInnerHTML={{ __html: article.payload.articleHtml || '' }}
          ref={articleShellRef}
        />
      </section>
    </PageChrome>
  );
}

function RecordPage({ bootstrap }) {
  const { apiUrl, currentPath, i18n, lang, pageProps } = bootstrap;
  const backendConfig = getNoTorsionBackendConfig(bootstrap);
  const route = resolveFrontendRoute(currentPath);
  const { error, loading, payload } = useMapPayload(apiUrl);
  const recordSlug = pageProps.recordSlug || route.recordSlug || '';

  const groups = groupSchoolRecords(payload && payload.data || []);
  const location = findRecordLocation(groups, recordSlug);

  if (loading) {
    return (
      <PageChrome bootstrap={bootstrap}>
        <HeroBlock eyebrow="Record" title={readPath(i18n, ['common', 'loading'], 'Loading')} />
      </PageChrome>
    );
  }

  if (error || !location) {
    return (
      <PageChrome bootstrap={bootstrap}>
        <HeroBlock
          description={error || readPath(i18n, ['map', 'record', 'notFoundBody'], 'Record not found')}
          eyebrow="Record"
          title={readPath(i18n, ['map', 'record', 'notFoundTitle'], 'Record unavailable')}
        >
          <div className="panel-actions">
            <a className="glass-button" href={appendLangToUrl('/map', lang)}>
              {readPath(i18n, ['map', 'record', 'backToMap'], 'Back to map')}
            </a>
          </div>
        </HeroBlock>
      </PageChrome>
    );
  }

  const pages = location.group.pages || [];
  const previousRecord = location.pageIndex > 0 ? pages[location.pageIndex - 1] : null;
  const nextRecord = location.pageIndex < pages.length - 1 ? pages[location.pageIndex + 1] : null;
  const statsBySchool = buildSchoolReportStats(payload && payload.data || []);
  const schoolStats = statsBySchool.get(location.group.schoolKey) || { selfCount: 0, agentCount: 0 };
  const query = {
    inputType: pageProps.inputType || route.query.inputType || '',
    search: pageProps.search || route.query.search || ''
  };

  return (
    <PageChrome bootstrap={bootstrap}>
      <HeroBlock
        description={getRecordRegionSummary(i18n, location.record)}
        eyebrow={readPath(i18n, ['map', 'record', 'eyebrow'], 'Record')}
        title={location.record.name || readPath(i18n, ['map', 'record', 'eyebrow'], 'Record')}
      >
        <div className="chip-row chip-row--compact">
          <span className="inline-tag">{readPath(i18n, ['map', 'list', 'reportCounts', 'self'], 'Self')} {schoolStats.selfCount}</span>
          <span className="inline-tag">{readPath(i18n, ['map', 'list', 'reportCounts', 'agent'], 'Agent')} {schoolStats.agentCount}</span>
          <span className="inline-tag">{getInputTypeLabel(i18n, location.record.inputType)}</span>
        </div>
      </HeroBlock>

      <section className="glass-panel">
        <div className="detail-grid">
          {[
            [readPath(i18n, ['form', 'fields', 'dateStart'], 'Start date'), location.record.dateStart],
            [readPath(i18n, ['form', 'fields', 'dateEnd'], 'End date'), location.record.dateEnd],
            [readPath(i18n, ['form', 'fields', 'schoolAddress'], 'Address'), location.record.addr],
            [readPath(i18n, ['form', 'fields', 'contactInformation'], 'Contact'), location.record.contact],
            [readPath(i18n, ['form', 'fields', 'headmasterName'], 'Headmaster'), location.record.HMaster]
          ].filter((entry) => entry[1]).map(([label, value]) => (
            <article className="detail-card" key={label}>
              <small>{label}</small>
              <p>{value}</p>
            </article>
          ))}
        </div>

        <RecordTranslationSections
          i18n={i18n}
          lang={lang}
          record={location.record}
          translateApiUrl={backendConfig.translateApiUrl}
          translationEnabled={backendConfig.recordTranslationEnabled}
        />

        <div className="panel-actions">
          <a className="glass-button" href={appendLangToUrl(`/map${window.location.search || ''}`, lang)}>
            {readPath(i18n, ['map', 'record', 'backToMap'], 'Back to map')}
          </a>
          {previousRecord ? (
            <a className="glass-button" href={buildRecordHref(previousRecord, { lang, query })}>
              {readPath(i18n, ['map', 'list', 'pagination', 'previous'], 'Previous')}
            </a>
          ) : null}
          {nextRecord ? (
            <a className="glass-button" href={buildRecordHref(nextRecord, { lang, query })}>
              {readPath(i18n, ['map', 'list', 'pagination', 'next'], 'Next')}
            </a>
          ) : null}
        </div>
      </section>
    </PageChrome>
  );
}

function NotFoundPage({ bootstrap }) {
  return (
    <PageChrome bootstrap={bootstrap}>
      <HeroBlock
        description="This route is not configured in the frontend router."
        eyebrow="Frontend"
        title="Page unavailable"
      />
    </PageChrome>
  );
}

function resolveFrontendDocumentTitle(route, i18n, siteName) {
  const pageTitles = i18n && i18n.pageTitles ? i18n.pageTitles : {};
  const resolvedSiteName = siteName || readPath(i18n, ['common', 'siteName'], 'NO CONVERSION THERAPY');

  switch (route.routeType) {
    case 'article':
      return formatMessage(pageTitles.article || '{articleTitle}|{title}', {
        articleTitle: route.articleId || readPath(i18n, ['blog', 'title'], 'Article'),
        title: resolvedSiteName
      });
    case 'form-entry':
      return formatMessage(pageTitles.form || '{title}', {
        title: resolvedSiteName
      });
    case 'correction':
      return formatMessage(pageTitles.institutionCorrection || '{title}', {
        title: resolvedSiteName
      });
    case 'home':
      return formatMessage(pageTitles.home || '{title}', {
        title: resolvedSiteName
      });
    case 'portal':
      return formatMessage(
        route.pathname === '/blog'
          ? pageTitles.blog || '{title}'
          : route.pathname === '/form'
            ? pageTitles.form || '{title}'
            : pageTitles.map || '{title}',
        { title: resolvedSiteName }
      );
    case 'privacy':
      return formatMessage(pageTitles.privacy || '{title}', {
        title: resolvedSiteName
      });
    case 'record':
      return formatMessage(pageTitles.mapRecord || '{title}', {
        title: resolvedSiteName
      });
    default:
      return resolvedSiteName;
  }
}

export function App({ bootstrap }) {
  const [currentPath, setCurrentPath] = useState(
    bootstrap.currentPath || `${window.location.pathname}${window.location.search}${window.location.hash}`
  );

  useEffect(() => {
    function handleLocationChange() {
      setCurrentPath(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    }

    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  const normalizedBootstrap = {
    ...bootstrap,
    apiUrl: bootstrap.apiUrl || '',
    currentPath,
    deploymentMode: resolveFrontendDeploymentMode(bootstrap),
    formPageUrl: bootstrap.formPageUrl || '',
    i18n: bootstrap.i18n || {},
    lang: bootstrap.lang || 'zh-CN',
    languageOptions: Array.isArray(bootstrap.languageOptions) ? bootstrap.languageOptions : [],
    pageProps: bootstrap.pageProps || {},
    pageType: bootstrap.pageType || 'frontend-router'
  };

  const frontendRoute = resolveFrontendRoute(normalizedBootstrap.currentPath);

  useEffect(() => {
    if (normalizedBootstrap.pageType !== 'frontend-router') {
      return;
    }

    document.title = resolveFrontendDocumentTitle(
      frontendRoute,
      normalizedBootstrap.i18n,
      normalizedBootstrap.siteName
    );
  }, [frontendRoute, normalizedBootstrap.i18n, normalizedBootstrap.pageType, normalizedBootstrap.siteName]);

  const pageByType = {
    about: <AboutPage bootstrap={normalizedBootstrap} />,
    article: <ArticlePage bootstrap={normalizedBootstrap} />,
    correction: <CorrectionPage bootstrap={normalizedBootstrap} />,
    'correction-error': <CorrectionErrorPage bootstrap={normalizedBootstrap} />,
    'correction-success': <CorrectionSuccessPage bootstrap={normalizedBootstrap} />,
    debug: <DebugPage bootstrap={normalizedBootstrap} />,
    home: <HomePage bootstrap={normalizedBootstrap} />,
    portal: <PortalPage bootstrap={normalizedBootstrap} />,
    privacy: <PrivacyPage bootstrap={normalizedBootstrap} />,
    record: <RecordPage bootstrap={normalizedBootstrap} />,
    'submit-confirm': <SubmitConfirmPage bootstrap={normalizedBootstrap} />,
    'submit-error': <SubmitErrorPage bootstrap={normalizedBootstrap} />,
    'submit-preview': <SubmitPreviewPage bootstrap={normalizedBootstrap} />,
    'submit-success': <SubmitSuccessPage bootstrap={normalizedBootstrap} />
  };

  if (normalizedBootstrap.pageType === 'frontend-router') {
    const pageByRoute = {
      article: <ArticlePage bootstrap={normalizedBootstrap} />,
      'form-entry': <FormEntryPage bootstrap={normalizedBootstrap} />,
      home: <HomePage bootstrap={normalizedBootstrap} />,
      'not-found': <NotFoundPage bootstrap={normalizedBootstrap} />,
      portal: <PortalPage bootstrap={normalizedBootstrap} />,
      privacy: <PrivacyPage bootstrap={normalizedBootstrap} />,
      record: <RecordPage bootstrap={normalizedBootstrap} />
    };

    return pageByRoute[frontendRoute.routeType] || <NotFoundPage bootstrap={normalizedBootstrap} />;
  }

  return pageByType[normalizedBootstrap.pageType] || <NotFoundPage bootstrap={normalizedBootstrap} />;
}
