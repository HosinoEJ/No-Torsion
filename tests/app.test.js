const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const express = require('express');

const projectRoot = path.resolve(__dirname, '..');

function clearProjectModules() {
  Object.keys(require.cache).forEach((modulePath) => {
    if (modulePath.startsWith(projectRoot)) {
      delete require.cache[modulePath];
    }
  });
}

function loadApp(envOverrides = {}) {
  const effectiveEnvOverrides = {
    MAINTENANCE_MODE: 'false',
    MAINTENANCE_NOTICE: '',
    MAP_DATA_NODE_TRANSPORT_OVERRIDES: 'false',
    FORM_ID: 'test-form-id',
    ...envOverrides
  };

  const originalValues = Object.fromEntries(
    Object.keys(effectiveEnvOverrides).map((key) => [key, process.env[key]])
  );

  Object.entries(effectiveEnvOverrides).forEach(([key, value]) => {
    process.env[key] = value;
  });

  clearProjectModules();
  const app = require(path.join(projectRoot, 'app/server'));

  Object.entries(originalValues).forEach(([key, value]) => {
    if (typeof value === 'undefined') {
      delete process.env[key];
      return;
    }

    process.env[key] = value;
  });

  return app;
}

function loadAppWithPatchedFormService(envOverrides = {}, patchFormService) {
  const effectiveEnvOverrides = {
    MAINTENANCE_MODE: 'false',
    MAINTENANCE_NOTICE: '',
    MAP_DATA_NODE_TRANSPORT_OVERRIDES: 'false',
    FORM_ID: 'test-form-id',
    ...envOverrides
  };

  const originalValues = Object.fromEntries(
    Object.keys(effectiveEnvOverrides).map((key) => [key, process.env[key]])
  );

  Object.entries(effectiveEnvOverrides).forEach(([key, value]) => {
    process.env[key] = value;
  });

  clearProjectModules();
  const formService = require(path.join(projectRoot, 'app/services/formService'));
  const restorePatch = typeof patchFormService === 'function'
    ? patchFormService(formService)
    : null;
  const app = require(path.join(projectRoot, 'app/server'));

  Object.entries(originalValues).forEach(([key, value]) => {
    if (typeof value === 'undefined') {
      delete process.env[key];
      return;
    }

    process.env[key] = value;
  });

  return {
    app,
    restore() {
      if (typeof restorePatch === 'function') {
        restorePatch();
      }
    }
  };
}

function withEnvOverrides(envOverrides, callback) {
  const originalValues = Object.fromEntries(
    Object.keys(envOverrides).map((key) => [key, process.env[key]])
  );

  Object.entries(envOverrides).forEach(([key, value]) => {
    process.env[key] = value;
  });

  try {
    return callback();
  } finally {
    Object.entries(originalValues).forEach(([key, value]) => {
      if (typeof value === 'undefined') {
        delete process.env[key];
        return;
      }

      process.env[key] = value;
    });
  }
}

function getNoProxyEnv() {
  return {
    HTTP_PROXY: '',
    HTTPS_PROXY: '',
    ALL_PROXY: '',
    http_proxy: '',
    https_proxy: '',
    all_proxy: ''
  };
}

function getGoogleTranslationTestEnv(overrides = {}) {
  return {
    GOOGLE_CLOUD_TRANSLATION_API_KEY: 'test-google-cloud-api-key',
    TRANSLATION_PROVIDER_TIMEOUT_MS: '10000',
    ...overrides
  };
}

async function withMockedDate(isoString, callback) {
  const RealDate = Date;
  const fixedTimestamp = RealDate.parse(isoString);

  class MockDate extends RealDate {
    constructor(...args) {
      super(args.length === 0 ? fixedTimestamp : args[0], ...args.slice(1));
    }

    static now() {
      return fixedTimestamp;
    }

    static parse(value) {
      return RealDate.parse(value);
    }

    static UTC(...args) {
      return RealDate.UTC(...args);
    }
  }

  global.Date = MockDate;

  try {
    return await callback();
  } finally {
    global.Date = RealDate;
  }
}

function requestPath(app, requestPath) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      const request = http.request({
        hostname: '127.0.0.1',
        port,
        method: 'GET',
        path: requestPath
      }, (response) => {
        let body = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          server.close(() => {
            resolve({
              body,
              headers: response.headers,
              statusCode: response.statusCode
            });
          });
        });
      });

      request.on('error', (error) => {
        server.close(() => reject(error));
      });

      request.end();
    });
  });
}

function requestApp(app, { path: requestPath, method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      const request = http.request({
        hostname: '127.0.0.1',
        port,
        method,
        path: requestPath,
        headers
      }, (response) => {
        let responseBody = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          responseBody += chunk;
        });
        response.on('end', () => {
          server.close(() => {
            resolve({
              body: responseBody,
              headers: response.headers,
              statusCode: response.statusCode
            });
          });
        });
      });

      request.on('error', (error) => {
        server.close(() => reject(error));
      });

      if (typeof body === 'string') {
        request.write(body);
      }

      request.end();
    });
  });
}

function installTranslationFetchStub(prefix = 'EN:') {
  const originalFetch = global.fetch;

  global.fetch = async (input, init = {}) => {
    const requestUrl = input instanceof URL
      ? input
      : new URL(typeof input === 'string' ? input : input.url);
    const requestBody = typeof init.body === 'string' && init.body
      ? JSON.parse(init.body)
      : {};
    const sourceTexts = Array.isArray(requestBody.q)
      ? requestBody.q
      : Array.isArray(requestBody.text)
        ? requestBody.text
        : requestBody.q
          ? [requestBody.q]
          : [];

    if (requestUrl.hostname === 'translation.googleapis.com') {
      return {
        ok: true,
        async json() {
          return {
            data: {
              translations: sourceTexts.map((sourceText) => ({
                translatedText: `${prefix}${sourceText}`
              }))
            }
          };
        }
      };
    }

    return {
      ok: true,
      async json() {
        return {
          data: {
            translations: sourceTexts.map((sourceText) => ({
              translatedText: `${prefix}${sourceText}`
            }))
          }
        };
      }
    };
  };

  return () => {
    global.fetch = originalFetch;
  };
}

function createFakeNode(tagName, textContent = '') {
  return {
    tagName,
    textContent,
    children: [],
    disabled: false,
    type: '',
    className: '',
    listeners: new Map(),
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    replaceChildren(...children) {
      this.children = [...children];
    },
    addEventListener(eventName, listener) {
      this.listeners.set(eventName, listener);
    }
  };
}

function createFakeDocument() {
  return {
    createElement(tagName) {
      return createFakeNode(tagName);
    },
    createTextNode(textContent) {
      return createFakeNode('#text', textContent);
    }
  };
}

function collectNodeText(node) {
  return [node.textContent, ...node.children.map((child) => collectNodeText(child))].join('');
}

function responseBodyMatch(body, pattern) {
  const match = String(body || '').match(pattern);
  assert.ok(match, `Expected response body to match ${pattern}`);
  return match;
}

function countMatches(body, pattern) {
  return (String(body || '').match(pattern) || []).length;
}

function buildValidSubmissionBody(overrides = {}) {
  const basePayload = {
    identity: '受害者本人',
    birth_year: '2008',
    sex: '男性',
    sex_other_type: '',
    sex_other: '',
    provinceCode: '110000',
    cityCode: '110101',
    countyCode: '',
    school_name: '测试机构',
    school_address: '北京市东城区测试路 1 号',
    date_start: '2024-01-01',
    date_end: '',
    experience: '',
    headmaster_name: '',
    contact_information: 'test@example.com',
    scandal: '',
    other: '',
    website: '',
    form_token: ''
  };

  return new URLSearchParams({
    ...basePayload,
    ...overrides
  }).toString();
}

test('root page renders successfully', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const response = await requestPath(app, '/');

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /NO CONVERSION THERAPY/i);
  assert.match(response.body, /window\.API_URL = "/);
  assert.match(response.body, /\/js\/map_data_store\.js/);
  assert.match(response.body, /\/js\/map_preload\.js/);
});

test('maintenance mode serves a 503 maintenance page for HTML requests', async () => {
  const app = loadApp({
    DEBUG_MOD: 'false',
    MAINTENANCE_MODE: 'true',
    MAINTENANCE_NOTICE: '站点资料正在同步，请稍后再试。',
    MAINTENANCE_RETRY_AFTER_SECONDS: '900'
  });
  const response = await requestPath(app, '/');

  assert.equal(response.statusCode, 503);
  assert.equal(response.headers['retry-after'], '900');
  assert.equal(response.headers['x-robots-tag'], 'noindex, nofollow, noarchive, nosnippet');
  assert.match(response.headers['cache-control'], /no-store/);
  assert.match(response.body, /网站正在维护中/);
  assert.match(response.body, /站点资料正在同步，请稍后再试。/);
  assert.match(response.body, /data-language-switcher/);
  assert.match(response.body, /\/js\/language_switcher\.js/);
  assert.match(response.body, /backdrop-filter: blur\(28px\)/);
  assert.match(response.body, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(response.body, /Suggested retry/);
  assert.doesNotMatch(response.body, /503 Service Unavailable/);
  assert.doesNotMatch(response.body, /The server is returning a standard 503 response/);
});

test('maintenance page translates MAINTENANCE_NOTICE for english mode when the translation service is configured', async () => {
  const restoreFetch = installTranslationFetchStub();

  try {
    const app = loadApp({
      DEBUG_MOD: 'false',
      MAINTENANCE_MODE: 'true',
      MAINTENANCE_NOTICE: '站点正在更新资料，请稍后再试。',
      ...getGoogleTranslationTestEnv()
    });
    const response = await requestPath(app, '/?lang=en');

    assert.equal(response.statusCode, 503);
    assert.match(response.body, /EN:站点正在更新资料，请稍后再试。/);
  } finally {
    restoreFetch();
    clearProjectModules();
  }
});

test('maintenance mode keeps static assets reachable for the maintenance page', async () => {
  const app = loadApp({
    DEBUG_MOD: 'false',
    MAINTENANCE_MODE: 'true'
  });
  const response = await requestPath(app, '/favicon.svg');

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'], /image\/svg\+xml/);
});

test('bundled static middleware serves large css files without truncation', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-static-'));
  const cssDirectory = path.join(tempRoot, 'css');
  const cssPayload = `/* middleware truncation regression */\n${'a'.repeat(70 * 1024)}`;

  try {
    fs.mkdirSync(cssDirectory, { recursive: true });
    fs.writeFileSync(path.join(cssDirectory, 'main.css'), cssPayload, 'utf8');

    clearProjectModules();
    const { createBundledStaticMiddleware } = require(path.join(projectRoot, 'app/middleware/bundledStatic'));
    const app = express();

    app.use(createBundledStaticMiddleware({ rootDirectory: tempRoot }));
    app.use((_req, res) => {
      res.status(404).send('not found');
    });

    const response = await requestApp(app, { path: '/css/main.css' });

    assert.equal(response.statusCode, 200);
    assert.match(response.headers['content-type'], /text\/css/);
    assert.equal(response.body.length, cssPayload.length);
    assert.equal(response.body, cssPayload);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('bundled static middleware does not serve files outside its root', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-static-'));
  const outsideFilePath = path.join(tempRoot, '..', 'nct-static-outside.txt');

  try {
    fs.writeFileSync(outsideFilePath, 'outside bundle root', 'utf8');

    clearProjectModules();
    const { createBundledStaticMiddleware } = require(path.join(projectRoot, 'app/middleware/bundledStatic'));
    const app = express();

    app.use(createBundledStaticMiddleware({ rootDirectory: tempRoot }));
    app.use((_req, res) => {
      res.status(404).send('not found');
    });

    const response = await requestApp(app, { path: '/../nct-static-outside.txt' });

    assert.equal(response.statusCode, 404);
    assert.equal(response.body, 'not found');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(outsideFilePath, { force: true });
  }
});

test('maintenance mode returns JSON errors for API requests', async () => {
  const app = loadApp({
    DEBUG_MOD: 'false',
    MAINTENANCE_MODE: 'true'
  });
  const response = await requestApp(app, {
    path: '/api/map-data?lang=en',
    headers: {
      Accept: 'application/json'
    }
  });

  assert.equal(response.statusCode, 503);
  assert.match(response.headers['content-type'], /application\/json/);
  assert.deepEqual(JSON.parse(response.body), {
    error: 'Site maintenance is in progress. Please try again later.'
  });
});

test('map page renders the record container and lazy-load sentinel', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const response = await requestPath(app, '/map');

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /id="data-container"/);
  assert.match(response.body, /id="data-container-sentinel"/);
  assert.match(response.body, /\/js\/map_record_stats\.js/);
  assert.match(response.body, /\/js\/map_record_detail\.js/);
  assert.match(response.body, /\/js\/map_province_utils\.js/);
  assert.match(response.body, /\/js\/map_backTop\.js/);
  assert.match(response.body, /\/js\/queryUpd\.js/);
  assert.match(response.body, /cdn\.jsdelivr\.net\/npm\/chart\.js/);
  assert.match(response.body, /sha256-p4NxAoJBhIIN\+hmNHrzRCf9tD\/miZyoHS5obTRR9BMY=/);
  assert.match(response.body, /sha256-20nQCchB9co0qIjJZRGuk2\/Z9VM\+kNiyxNV1lvTlZBo=/);
});

test('map record page renders the standalone submission detail shell', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const response = await requestPath(app, '/map/record/test-record-token?lang=en&search=test');

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /id="mapRecordBackLink"/);
  assert.match(response.body, /id="mapRecordTitle"/);
  assert.match(response.body, /id="mapRecordDetailTableBody"/);
  assert.match(response.body, /\/js\/map_record_page\.js/);
  assert.match(response.body, /recordSlug:\s*"test-record-token"/);
  assert.match(response.body, /Back to Map List/);
});

test('shared head pages render a single html and head root', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const articleId = encodeURIComponent('關於心種子教育違法辦學的控告');
  const routes = ['/aboutus', '/blog', '/map', '/map/record/test-record-token', `/port/${articleId}`];

  for (const route of routes) {
    const response = await requestPath(app, route);

    assert.equal(response.statusCode, 200);
    assert.equal(countMatches(response.body, /<html\b/gi), 1, `${route} should render one <html>`);
    assert.equal(countMatches(response.body, /<head\b/gi), 1, `${route} should render one <head>`);
    assert.equal(countMatches(response.body, /<body\b/gi), 1, `${route} should render one <body>`);
  }
});

test('map page ignores ASSET_VERSION=0 and falls back to a real cache-busting version', async () => {
  await withMockedDate('2026-04-07T12:45:00.000Z', async () => {
    const app = loadApp({
      DEBUG_MOD: 'false',
      ASSET_VERSION: '0'
    });
    const response = await requestPath(app, '/map');

    assert.equal(response.statusCode, 200);
    assert.doesNotMatch(response.body, /window\.ASSET_VERSION = "0"/);
    assert.match(response.body, /window\.ASSET_VERSION = "1775565900000"/);
    assert.match(response.body, /\/js\/map_api\.js\?v=1775565900000/);
    assert.match(response.body, /\/js\/map_province_utils\.js\?v=1775565900000/);
  });
});

test('map page ignores app locals assetVersion=0 and rewrites it before rendering', async () => {
  await withMockedDate('2026-04-07T12:46:00.000Z', async () => {
    const app = loadApp({ DEBUG_MOD: 'false' });
    app.locals.assetVersion = '0';

    const response = await requestPath(app, '/map');

    assert.equal(response.statusCode, 200);
    assert.doesNotMatch(response.body, /window\.ASSET_VERSION = "0"/);
    assert.match(response.body, /window\.ASSET_VERSION = "1775565960000"/);
    assert.match(response.body, /\/js\/map_api\.js\?v=1775565960000/);
    assert.match(response.body, /\/js\/map_province_utils\.js\?v=1775565960000/);
  });
});

test('cn.json endpoint returns the complete GeoJSON payload', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const response = await requestPath(app, '/cn.json');
  const expectedPayload = fs.readFileSync(path.join(projectRoot, 'public/cn.json'), 'utf8');

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'], /application\/json/);
  assert.equal(response.body.length, expectedPayload.length);
  assert.equal(response.body, expectedPayload);
  assert.equal(JSON.parse(response.body).type, 'FeatureCollection');
});

test('map page keeps an OSM-compatible referrer policy for tile requests', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const response = await requestPath(app, '/map');

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['referrer-policy'], 'strict-origin-when-cross-origin');
});

test('vercel config preserves an OSM-compatible referrer policy at the edge', () => {
  const vercelConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, 'vercel.json'), 'utf8'));
  const referrerHeader = (Array.isArray(vercelConfig.headers) ? vercelConfig.headers : [])
    .flatMap((headerRule) => Array.isArray(headerRule.headers) ? headerRule.headers : [])
    .find((header) => String(header && header.key || '').toLowerCase() === 'referrer-policy');

  assert.ok(referrerHeader);
  assert.equal(referrerHeader.value, 'strict-origin-when-cross-origin');
});

test('map frontend keeps a renderer and layout fallback for province overlays', () => {
  const mapScript = fs.readFileSync(path.join(projectRoot, 'public/js/map_api.js'), 'utf8');
  const mainStylesheet = fs.readFileSync(path.join(projectRoot, 'public/css/main.css'), 'utf8');

  assert.match(mapScript, /preferCanvas:\s*true/);
  assert.match(mapScript, /provinceFillPane/);
  assert.match(mapScript, /schoolMarkerPane/);
  assert.match(mapScript, /schoolTooltipPane/);
  assert.match(mapScript, /shadowPane:\s*'schoolShadowPane'/);
  assert.match(mapScript, /pane:\s*'schoolTooltipPane'/);
  assert.match(mapScript, /const SCHOOL_MARKER_SCALE = 0\.75/);
  assert.match(mapScript, /const SCHOOL_MARKER_DEFAULT_OPACITY = 0\.75/);
  assert.match(mapScript, /const SCHOOL_MARKER_MAX_OPACITY = 1/);
  assert.match(mapScript, /buildSchoolReportStats/);
  assert.match(mapScript, /function getSchoolMarkerReportCount/);
  assert.match(mapScript, /function getSchoolMarkerReportRatio/);
  assert.match(mapScript, /SCHOOL_MARKER_DEFAULT_COLOR = '#36a2eb'/);
  assert.match(mapScript, /interpolateHexColor\(\s*SCHOOL_MARKER_REPORT_MIN_COLOR,\s*SCHOOL_MARKER_REPORT_MAX_COLOR,\s*reportRatio\s*\)/);
  assert.match(mapScript, /icon:\s*getSchoolMarkerIcon\(schoolMarkerColor\)/);
  assert.match(mapScript, /opacity:\s*getSchoolMarkerOpacity\(schoolReportStats, maxReportedMarkerCount\)/);
  assert.match(mapScript, /const densityRatio = density \/ maxDensity/);
  assert.match(mapScript, /interpolateHexColor\('#FED976', '#800026', densityRatio\)/);
  assert.match(mapScript, /getProvinceFillOpacity/);
  assert.match(mapScript, /scheduleMapLayoutRefresh/);
  assert.match(mapScript, /map\.invalidateSize\(\{ pan: false, animate: false \}\)/);
  assert.match(mainStylesheet, /#map \.leaflet-pane > svg,\s*#map \.leaflet-pane > canvas/);
});

test('form page includes school name and address autocomplete hooks', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const response = await requestPath(app, '/form');

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /隐私说明：本问卷中填写的出生年份、性别等个人基本信息将被严格保密/);
  assert.match(response.body, /个人基本信息/);
  assert.match(response.body, /相关经历/);
  assert.match(response.body, /机构曝光信息/);
  assert.match(response.body, /出生年份/);
  assert.match(response.body, /受害者出生年份/);
  assert.match(response.body, /受害者性别/);
  assert.match(response.body, /受害人经历/);
  assert.match(response.body, /name="birth_year"/);
  assert.doesNotMatch(response.body, /name="birth_month"/);
  assert.doesNotMatch(response.body, /name="birth_day"/);
  assert.match(response.body, /机构名称/);
  assert.match(response.body, /机构所在省份/);
  assert.match(response.body, /机构所在城市 \/ 区县/);
  assert.match(response.body, /机构所在县区/);
  assert.match(response.body, /机构地址/);
  assert.match(response.body, /id="openMapButton"/);
  assert.match(response.body, /点击可直接在地图上选点/);
  assert.match(response.body, /id="getCurrentLocationButton"/);
  assert.match(response.body, /获取当前位置/);
  assert.match(response.body, /id="locationStatus"/);
  assert.match(response.body, /机构联系方式/);
  assert.match(response.body, /丑闻及暴力行为详细描述/);
  assert.match(response.body, /首次被送入日期/);
  assert.match(response.body, /假如有多次被送入经历，可在经历描述中说明情况/);
  assert.match(response.body, /个人在校经历描述/);
  assert.match(response.body, /若描述别人经历请在“其他补充”中填写/);
  assert.match(response.body, /其它性别认同/);
  assert.doesNotMatch(response.body, /注：选择性别认同/);
  assert.match(response.body, /name="sex_other_type" value="MtF"/);
  assert.match(response.body, /MtF/);
  assert.match(response.body, /name="sex_other_type" value="FtM"/);
  assert.match(response.body, /FtM/);
  assert.match(response.body, /name="sex_other_type" value="X"/);
  assert.match(response.body, />X</);
  assert.match(response.body, /name="sex_other_type" value="Queer"/);
  assert.match(response.body, /Queer/);
  assert.match(response.body, /id="otherSexCustomRadio"/);
  assert.match(response.body, /placeholder="其它性别认同或补充说明"/);
  assert.doesNotMatch(response.body, /id="otherSexTypeSelect"/);
  assert.doesNotMatch(response.body, /学校名称/);
  assert.match(response.body, /机构曝光信息[\s\S]*?机构名称[\s\S]*?机构所在省份/);
  assert.match(response.body, /机构地址[\s\S]*?机构联系方式[\s\S]*?负责人\/校长姓名/);
  assert.match(response.body, /id="school_results_list"/);
  assert.match(response.body, /id="address_results_list"/);
  assert.match(response.body, /name="website"/);
  assert.match(response.body, /name="form_token"/);
  assert.match(response.body, /\/js\/map_data_store\.js/);
  assert.match(response.body, /\/js\/form_api\.js/);
  assert.doesNotMatch(response.body, /cdn\.jsdelivr\.net\/npm\/chart\.js/);
  assert.doesNotMatch(response.body, /unpkg\.com\/leaflet@1\.9\.4\/dist\/leaflet\.js/);
  assert.doesNotMatch(response.body, /\/js\/map_backTop\.js/);
  assert.doesNotMatch(response.body, /\/js\/queryUpd\.js/);
});

test('form page recomputes birth year options for long-lived runtimes', async () => {
  let app;

  await withMockedDate('2025-12-31T23:30:00Z', async () => {
    app = loadApp({ DEBUG_MOD: 'false' });
    const response = await requestPath(app, '/form');

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /<option value="2025">2025<\/option>/);
    assert.doesNotMatch(response.body, /<option value="2026">2026<\/option>/);
  });

  await withMockedDate('2026-01-01T00:30:00Z', async () => {
    const response = await requestPath(app, '/form');

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /<option value="2026">2026<\/option>/);
  });

  clearProjectModules();
});

test('form page disables indexing and caching because it issues sensitive submission tokens', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const response = await requestPath(app, '/form');

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['x-robots-tag'], 'noindex, nofollow, noarchive, nosnippet');
  assert.equal(response.headers['surrogate-control'], 'no-store');
  assert.match(response.headers['cache-control'], /private/);
  assert.match(response.headers['cache-control'], /no-store/);
  assert.match(response.body, /<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">/);
});

test('area options API localizes city options for the current language', async () => {
  const restoreFetch = installTranslationFetchStub();

  try {
    const app = loadApp({
      DEBUG_MOD: 'false',
      ...getGoogleTranslationTestEnv()
    });
    const response = await requestPath(app, '/api/area-options?provinceCode=110000&lang=en');
    const payload = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.ok(Array.isArray(payload.options));
    assert.equal(payload.options[0].code, '110101');
    assert.match(payload.options[0].name, /^EN:/);
  } finally {
    restoreFetch();
    clearProjectModules();
  }
});

test('area options API returns local city options directly in zh-CN mode', async () => {
  const originalFetch = global.fetch;
  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    throw new Error('zh-CN area options should not trigger translation fetch');
  };

  try {
    const app = loadApp({ DEBUG_MOD: 'false' });
    const response = await requestPath(app, '/api/area-options?provinceCode=110000&lang=zh-CN');
    const payload = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.ok(Array.isArray(payload.options));
    assert.equal(payload.options[0].code, '110101');
    assert.equal(payload.options[0].name, '东城区');
    assert.equal(fetchCalled, false);
  } finally {
    global.fetch = originalFetch;
    clearProjectModules();
  }
});

test('sitemap.xml lists static pages and blog articles', async () => {
  const app = loadApp({
    DEBUG_MOD: 'false',
    SITE_URL: 'https://example.com'
  });
  const response = await requestPath(app, '/sitemap.xml');

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'], /application\/xml/);
  assert.match(response.body, /<loc>https:\/\/example\.com\/<\/loc>/);
  assert.match(response.body, /<loc>https:\/\/example\.com\/map<\/loc>/);
  assert.match(response.body, /<loc>https:\/\/example\.com\/privacy<\/loc>/);
  assert.match(response.body, /<loc>https:\/\/example\.com\/blog<\/loc>/);
  assert.match(response.body, /https:\/\/example\.com\/port\/%E9%97%9C%E6%96%BC%E5%BF%83%E7%A8%AE%E5%AD%90%E6%95%99%E8%82%B2%E9%81%95%E6%B3%95%E8%BE%A6%E5%AD%B8%E7%9A%84%E6%8E%A7%E5%91%8A/);
  assert.doesNotMatch(response.body, /\/debug<\/loc>/);
  assert.doesNotMatch(response.body, /<loc>https:\/\/example\.com\/form<\/loc>/);
});

test('robots.txt exposes sitemap and blocks non-indexable routes', async () => {
  const app = loadApp({
    DEBUG_MOD: 'false',
    SITE_URL: 'https://example.com'
  });
  const response = await requestPath(app, '/robots.txt');

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'], /text\/plain/);
  assert.match(response.body, /^User-agent: \*$/m);
  assert.match(response.body, /^Allow: \/$/m);
  assert.match(response.body, /^Disallow: \/api\/$/m);
  assert.match(response.body, /^Disallow: \/form$/m);
  assert.match(response.body, /^Disallow: \/submit$/m);
  assert.match(response.body, /^Disallow: \/debug$/m);
  assert.match(response.body, /^Crawl-delay: 5$/m);
  assert.match(response.body, /^Sitemap: https:\/\/example\.com\/sitemap\.xml$/m);
});

test('public content stays indexable while repeated page crawling is rate limited', async () => {
  const app = loadApp({
    DEBUG_MOD: 'false',
    PAGE_READ_RATE_LIMIT_MAX: '1'
  });
  const firstResponse = await requestPath(app, '/blog');
  const secondResponse = await requestPath(app, '/blog');

  assert.equal(firstResponse.statusCode, 200);
  assert.doesNotMatch(firstResponse.body, /<meta name="robots" content="noindex/i);
  assert.equal(secondResponse.statusCode, 429);
});

test('debug page is hidden when debug mode is disabled', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const response = await requestPath(app, '/debug');

  assert.equal(response.statusCode, 404);
});

test('debug page renders when debug mode is enabled', async () => {
  const app = loadApp({ DEBUG_MOD: 'true' });
  const response = await requestPath(app, '/debug');

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /调试|Debug/);
  assert.match(response.body, /href="\/debug\/submit-error"/);
  assert.match(response.body, /站点配置|Site Configuration/);
});

test('debug page respects explicit language selection', async () => {
  const app = loadApp({ DEBUG_MOD: 'true' });
  const englishResponse = await requestPath(app, '/debug?lang=en');
  const traditionalChineseResponse = await requestPath(app, '/debug?lang=zh-TW');

  assert.equal(englishResponse.statusCode, 200);
  assert.match(englishResponse.body, /<html lang="en">/);
  assert.match(englishResponse.body, /Back to Home/);
  assert.match(englishResponse.body, /Site Configuration/);
  assert.match(englishResponse.body, /Open submission error preview/);
  assert.match(String(englishResponse.headers['set-cookie']), /lang=en/);

  assert.equal(traditionalChineseResponse.statusCode, 200);
  assert.match(traditionalChineseResponse.body, /<html lang="zh-TW">/);
  assert.match(traditionalChineseResponse.body, /返回首頁/);
  assert.match(traditionalChineseResponse.body, /站點配置/);
  assert.match(traditionalChineseResponse.body, /查看提交失敗頁預覽/);
  assert.match(String(traditionalChineseResponse.headers['set-cookie']), /lang=zh-TW/);
});

test('debug page redacts sensitive Google integration URLs', async () => {
  const app = loadApp({
    DEBUG_MOD: 'true',
    FORM_ID: '1FAIpQLSabcdefghijklmnopqrstuvwxyz123456',
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/abcdefghijklmnopqrstuvwxyz1234567890/exec?foo=bar'
  });
  const response = await requestPath(app, '/debug');

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /docs\.google\.com\/forms\/d\/e\/1FAI\.\.\.3456\/formResponse/);
  assert.match(response.body, /script\.google\.com\/macros\/s\/abcd\.\.\.7890\/exec/);
});

test('standalone submit error preview is hidden when debug mode is disabled', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const response = await requestPath(app, '/debug/submit-error');

  assert.equal(response.statusCode, 404);
});

test('standalone submit error preview renders a prefilled Google Form link when debug mode is enabled', async () => {
  const app = loadApp({ DEBUG_MOD: 'true' });
  const response = await requestPath(app, '/debug/submit-error');

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /viewform\?usp=pp_url&amp;entry\.842223433=11/);
  assert.match(response.body, /entry\.1422578992=%E7%94%B7/);
  assert.match(response.body, /打开 Google Form 页面可能需要网络代理|opening the Google Form page may require a network proxy/);
});

test('standalone submit error preview respects explicit language selection', async () => {
  const app = loadApp({ DEBUG_MOD: 'true' });
  const englishResponse = await requestPath(app, '/debug/submit-error?lang=en');
  const traditionalChineseResponse = await requestPath(app, '/debug/submit-error?lang=zh-TW');

  assert.equal(englishResponse.statusCode, 200);
  assert.match(englishResponse.body, /<html lang="en">/);
  assert.match(englishResponse.body, /Submission Failed/);
  assert.match(englishResponse.body, /Open Google Form to Continue/);
  assert.match(englishResponse.body, /opening the Google Form page may require a network proxy/);
  assert.match(String(englishResponse.headers['set-cookie']), /lang=en/);

  assert.equal(traditionalChineseResponse.statusCode, 200);
  assert.match(traditionalChineseResponse.body, /<html lang="zh-TW">/);
  assert.match(traditionalChineseResponse.body, /提交失敗/);
  assert.match(traditionalChineseResponse.body, /打開 Google Form 繼續提交/);
  assert.match(traditionalChineseResponse.body, /打開 Google Form 頁面可能需要網路代理/);
  assert.match(String(traditionalChineseResponse.headers['set-cookie']), /lang=zh-TW/);
});

test('about page renders localized friend descriptions in english mode', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const response = await requestPath(app, '/aboutus?lang=en');

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /Founder, planning\/execution, and community building/);
  assert.match(response.body, /Community outreach and source material support/);
  assert.match(response.body, /Domain contributor/);
});

test('privacy page documents the language cookie, form-disclosure flow, and footer exposes the link', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const rootResponse = await requestPath(app, '/');
  const privacyResponse = await requestPath(app, '/privacy?lang=en');

  assert.equal(rootResponse.statusCode, 200);
  assert.match(rootResponse.body, /href="\/privacy"/);

  assert.equal(privacyResponse.statusCode, 200);
  assert.match(privacyResponse.body, /Privacy &amp; Cookie Notice|Privacy & Cookie Notice/);
  assert.match(privacyResponse.body, /Form Submission And Public Display/);
  assert.match(privacyResponse.body, /Third-Party Services/);
  assert.match(privacyResponse.body, /Retention And Removal/);
  assert.match(privacyResponse.body, /Public Data/);
  assert.match(privacyResponse.body, /href="https:\/\/docs\.google\.com\/spreadsheets\/d\/12GSD0Hzi0P6q3B9V4-DT9SOQghL8zV2A-7FsWFYhFxk"/);
  assert.match(privacyResponse.body, /<code>lang<\/code>/);
  assert.match(privacyResponse.body, /2592000/);
  assert.match(privacyResponse.body, /SameSite=Lax/);
  assert.match(String(privacyResponse.headers['set-cookie']), /Max-Age=2592000/);
});

test('translation service normalizes spaces around apostrophes in english text', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    async json() {
      return {
        data: {
          translations: [{ translatedText: 'A cute little medicine girl ’ s website' }]
        }
      };
    }
  });

  try {
    await withEnvOverrides(getGoogleTranslationTestEnv(), async () => {
      clearProjectModules();
      const { translateDetailItems } = require(path.join(projectRoot, 'app/services/textTranslationService'));
      const [result] = await translateDetailItems({
        items: [{ fieldKey: '0', text: '一隻可愛的小藥娘的網站' }],
        targetLanguage: 'en'
      });

      assert.equal(result.translatedText, "A cute little medicine girl's website");
    });
  } finally {
    global.fetch = originalFetch;
    clearProjectModules();
  }
});

test('translation service uses Google Cloud Translation when configured', async () => {
  const originalFetch = global.fetch;
  const requests = [];

  global.fetch = async (input, init = {}) => {
    const requestUrl = input instanceof URL
      ? input
      : new URL(typeof input === 'string' ? input : input.url);

    requests.push({
      body: typeof init.body === 'string' ? JSON.parse(init.body) : null,
      headers: init.headers || {},
      url: requestUrl
    });

    return {
      ok: true,
      async json() {
        return {
          data: {
            translations: [{ translatedText: 'EN:原文內容' }]
          }
        };
      }
    };
  };

  try {
    await withEnvOverrides(getGoogleTranslationTestEnv(), async () => {
      clearProjectModules();
      const { translateDetailItems } = require(path.join(projectRoot, 'app/services/textTranslationService'));
      const [result] = await translateDetailItems({
        items: [{ fieldKey: '0', text: '原文內容' }],
        targetLanguage: 'en'
      });

      assert.equal(result.translatedText, 'EN:原文內容');
      assert.equal(requests.length, 1);
      assert.equal(requests[0].url.hostname, 'translation.googleapis.com');
      assert.equal(requests[0].url.pathname, '/language/translate/v2');
      assert.equal(requests[0].headers['x-goog-api-key'], 'test-google-cloud-api-key');
      assert.equal(requests[0].body.target, 'en');
      assert.equal(requests[0].body.format, 'text');
      assert.deepEqual(requests[0].body.q, ['原文內容']);
    });
  } finally {
    global.fetch = originalFetch;
    clearProjectModules();
  }
});

test('rate-limit messages are localized in all supported languages', () => {
  clearProjectModules();
  const { translate } = require(path.join(projectRoot, 'config/i18n'));

  assert.equal(translate('zh-CN', 'server.tooManyRequests'), '请求过于频繁，请稍后再试。');
  assert.equal(translate('zh-TW', 'server.tooManyRequests'), '請求過於頻繁，請稍後再試。');
  assert.equal(translate('en', 'server.tooManyRequests'), 'Too many requests. Please try again later.');
});

test('translation service retries transient fetch failures without relying on child processes', async () => {
  const originalFetch = global.fetch;
  let fetchCount = 0;

  global.fetch = async () => {
    fetchCount += 1;

    if (fetchCount === 1) {
      throw new Error('temporary network failure');
    }

    return {
      ok: true,
      async json() {
        return {
          data: {
            translations: [{ translatedText: 'Recovered translation' }]
          }
        };
      }
    };
  };

  try {
    await withEnvOverrides(getGoogleTranslationTestEnv(), async () => {
      clearProjectModules();
      const { translateDetailItems } = require(path.join(projectRoot, 'app/services/textTranslationService'));
      const [result] = await translateDetailItems({
        items: [{ fieldKey: '0', text: '原文' }],
        targetLanguage: 'en'
      });

      assert.equal(fetchCount, 2);
      assert.equal(result.translatedText, 'Recovered translation');
    });
  } finally {
    global.fetch = originalFetch;
    clearProjectModules();
  }
});

test('translation service throws when the upstream translation request keeps failing', async () => {
  const originalFetch = global.fetch;
  const originalWarn = console.warn;
  const warningMessages = [];

  global.fetch = async () => {
    throw new Error('fetch failed');
  };
  console.warn = (...args) => {
    warningMessages.push(args.join(' '));
  };

  try {
    await withEnvOverrides(getGoogleTranslationTestEnv(), async () => {
      clearProjectModules();
      const { translateDetailItems } = require(path.join(projectRoot, 'app/services/textTranslationService'));
      await assert.rejects(
        translateDetailItems({
          items: [{ fieldKey: '0', text: '原文內容' }],
          targetLanguage: 'en'
        }),
        /fetch failed/
      );

      assert.equal(warningMessages.length, 1);
      assert.match(warningMessages[0], /未返回翻譯結果/);
    });
  } finally {
    global.fetch = originalFetch;
    console.warn = originalWarn;
    clearProjectModules();
  }
});

test('translation service skips repeated upstream requests during the cooldown window after repeated failures', async () => {
  const originalFetch = global.fetch;
  const originalWarn = console.warn;
  const warningMessages = [];
  let fetchCount = 0;

  global.fetch = async () => {
    fetchCount += 1;

    const aggregateError = new AggregateError([
      Object.assign(new Error('connect ETIMEDOUT 142.250.66.74:443'), { code: 'ETIMEDOUT' }),
      Object.assign(new Error('connect ENETUNREACH 2404:6800:4012:9::200a:443'), { code: 'ENETUNREACH' })
    ], 'fetch failed');

    throw Object.assign(new TypeError('fetch failed'), { cause: aggregateError });
  };
  console.warn = (...args) => {
    warningMessages.push(args.join(' '));
  };

  try {
    await withEnvOverrides(getGoogleTranslationTestEnv(), async () => {
      clearProjectModules();
      const {
        getTranslationFailureCooldownMs,
        resetTranslationCache,
        translateDetailItems
      } = require(path.join(projectRoot, 'app/services/textTranslationService'));

      resetTranslationCache();

      await assert.rejects(
        translateDetailItems({
          items: [{ fieldKey: '0', text: '第一段原文' }],
          targetLanguage: 'en'
        }),
        /fetch failed/
      );
      await assert.rejects(
        translateDetailItems({
          items: [{ fieldKey: '1', text: '第二段原文' }],
          targetLanguage: 'en'
        }),
        /翻譯服務連線冷卻中/
      );

      assert.equal(fetchCount, 2);
      assert.ok(getTranslationFailureCooldownMs() > 0);
      assert.equal(warningMessages.length, 2);
    });
  } finally {
    global.fetch = originalFetch;
    console.warn = originalWarn;
    clearProjectModules();
  }
});

test('blog route blocks directory traversal attempts', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const response = await requestPath(app, '/port/..%2FREADME');

  assert.equal(response.statusCode, 404);
  assert.doesNotMatch(response.body, /NO CONVERSION THERAPY/i);
});

test('markdown rendering escapes raw HTML and strips dangerous links', () => {
  clearProjectModules();
  const { renderMarkdown } = require(path.join(projectRoot, 'app/services/markedService'));
  const html = renderMarkdown('<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n[good](https://example.com?a=1&b=2)');

  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html, /href="javascript:/i);
  assert.match(html, /rel="noopener noreferrer"/);
});

test('blog translation service adds translated titles in english mode', async () => {
  clearProjectModules();
  const { translateBlogListEntries } = require(path.join(projectRoot, 'app/services/blogTranslationService'));

  const translatedEntries = await translateBlogListEntries(
    [
      { title: '文章甲' },
      { title: '文章甲' },
      { title: '' }
    ],
    {
      targetLanguage: 'en',
      translateBatch: async (texts) => texts.map((text) => `EN:${text}`)
    }
  );

  assert.equal(translatedEntries[0].translatedTitle, 'EN:文章甲');
  assert.equal(translatedEntries[1].translatedTitle, 'EN:文章甲');
  assert.equal(translatedEntries[2].translatedTitle, '');
});

test('blog translation service renders bilingual article content in english mode', async () => {
  clearProjectModules();
  const { renderBlogArticleHtml } = require(path.join(projectRoot, 'app/services/blogTranslationService'));

  const html = await renderBlogArticleHtml('# 标题\n\n第一段\n\n1. 条目一', {
    targetLanguage: 'en'
  });

  assert.match(html, /blog-bilingual-block--heading/);
  assert.match(html, /<h1>标题<\/h1>/);
  assert.match(html, /data-blog-translation-source="标题"/);
  assert.match(html, /data-blog-translation-source="第一段"/);
  assert.match(html, /blog-bilingual-list/);
  assert.match(html, /data-blog-translation-source="条目一"/);
  assert.match(html, /hidden/);
});

test('blog translation service renders plain article content outside english mode', async () => {
  clearProjectModules();
  const { renderBlogArticleHtml } = require(path.join(projectRoot, 'app/services/blogTranslationService'));
  const html = await renderBlogArticleHtml('# 标题', {
    targetLanguage: 'zh-TW'
  });

  assert.match(html, /<h1>标题<\/h1>/);
  assert.doesNotMatch(html, /data-blog-translation-source=/);
});

test('blog list shows translated titles when english language is selected', async () => {
  const restoreFetch = installTranslationFetchStub();

  try {
    const app = loadApp({
      DEBUG_MOD: 'false',
      ...getGoogleTranslationTestEnv()
    });
    const response = await requestPath(app, '/blog?lang=en');
    const originalTitle = '關於心種子教育違法辦學的控告';
    const translatedTitle = `EN:${originalTitle}`;

    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes(originalTitle));
    assert.ok(response.body.includes(translatedTitle));
    assert.ok(response.body.indexOf(originalTitle) < response.body.indexOf(translatedTitle));
    assert.ok(response.body.includes('Traditional Chinese'));
    assert.ok(response.body.includes('March 13, 2026'));
    assert.ok(response.body.includes('#Law'));
  } finally {
    restoreFetch();
    clearProjectModules();
  }
});

test('blog article shows bilingual content when english language is selected', async () => {
  const restoreFetch = installTranslationFetchStub();

  try {
    const app = loadApp({
      DEBUG_MOD: 'false',
      ...getGoogleTranslationTestEnv()
    });
    const articleId = encodeURIComponent('關於心種子教育違法辦學的控告');
    const response = await requestPath(app, `/port/${articleId}?lang=en`);
    const originalHeading = '关于山东心种子教育咨询有限公司非法限制人身自由及身心摧残的维权通告';
    const originalParagraph = '本人于114年10月3日至115年2月11日期间，被强制关押于山东心种子教育咨询有限公司（统一社会信用代码：91370781MA3DKU6R4Q）。在长达131天的关押中，相关机构采取限制人身自由、封闭式管理及各种心理压迫手段，导致本人精神遭受严重摧残。';

    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes(originalHeading));
    assert.ok(response.body.includes(originalParagraph));
    assert.ok(response.body.includes('data-blog-translation-source='));
    assert.ok(response.body.includes('/js/blog_article_translation.js'));
    assert.ok(!response.body.includes(`EN:${originalHeading}`));
  } finally {
    restoreFetch();
    clearProjectModules();
  }
});

test('blog article page no longer hardcodes a 70 percent card width', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const articleId = encodeURIComponent('關於心種子教育違法辦學的控告');
  const response = await requestPath(app, `/port/${articleId}`);

  assert.equal(response.statusCode, 200);
  assert.doesNotMatch(response.body, /style="width:\s*70%;?"/);
});

test('map data service preserves valid upstream sync timestamps', () => {
  clearProjectModules();
  const { resolveLastSyncedTimestamp } = require(path.join(projectRoot, 'app/services/mapDataService'));

  assert.equal(resolveLastSyncedTimestamp('1774925078387', 123), 1774925078387);
  assert.equal(resolveLastSyncedTimestamp(undefined, 123), 123);
  assert.equal(resolveLastSyncedTimestamp('-1', 123), 123);
});

test('map data service normalizes simplified and traditional province names to one canonical label', () => {
  clearProjectModules();
  const { normalizeProvinceNameToLegacy } = require(path.join(projectRoot, 'app/services/mapDataService'));

  assert.equal(normalizeProvinceNameToLegacy('重庆'), '重慶');
  assert.equal(normalizeProvinceNameToLegacy('重慶'), '重慶');
  assert.equal(normalizeProvinceNameToLegacy('广东'), '廣東');
});

test('map data service preserves public detail fields needed by map record pagination', () => {
  clearProjectModules();
  const { buildNormalizedMapResponse } = require(path.join(projectRoot, 'app/services/mapDataService'));

  const payload = buildNormalizedMapResponse({
    avg_age: 18,
    last_synced: 1774925078387,
    schoolNum: 1,
    formNum: 2,
    statistics: [],
    statisticsForm: [],
    data: [
      {
        學校名稱: '启明学校',
        省份: '北京市',
        緯度: 39.9,
        經度: 116.4,
        '机构所在城市 / 区县': '北京市',
        '机构所在县区': '东城区',
        '首次被送入日期': '2024-01-02',
        離開日期: '2024-02-03',
        '请问您是作为什么身份来填写本表单？': '受害者本人',
        机构联系方式: 'test@example.com'
      }
    ]
  }, Date.now(), 'google-script');

  assert.equal(payload.data[0].city, '北京市');
  assert.equal(payload.data[0].county, '东城区');
  assert.equal(payload.data[0].dateStart, '2024-01-02');
  assert.equal(payload.data[0].dateEnd, '2024-02-03');
  assert.equal(payload.data[0].inputType, '受害者本人');
  assert.equal(payload.data[0].contact, 'test@example.com');
});

test('runtime config resolves bundle paths in workers mode', () => {
  withEnvOverrides({ RUNTIME_TARGET: 'workers' }, () => {
    clearProjectModules();
    const { isWorkersRuntime, resolveProjectPath } = require(path.join(projectRoot, 'config/runtimeConfig'));

    assert.equal(isWorkersRuntime(), true);
    assert.equal(resolveProjectPath('views/index.ejs'), '/bundle/views/index.ejs');
    assert.equal(resolveProjectPath('blog\\article.md'), '/bundle/blog/article.md');
  });

  clearProjectModules();
});

test('sitemap service falls back to article metadata timestamps in workers mode', () => {
  withEnvOverrides({ RUNTIME_TARGET: 'workers' }, () => {
    clearProjectModules();
    const { getBlogSitemapEntries } = require(path.join(projectRoot, 'app/services/sitemapService'));
    const entries = getBlogSitemapEntries({
      blogDataPath: path.join(projectRoot, 'data.json'),
      blogDirectory: path.join(projectRoot, 'blog'),
      siteUrl: 'https://example.com'
    });

    const lastmodByLoc = new Map(entries.map((entry) => [entry.loc, entry.lastmod]));

    assert.equal(
      lastmodByLoc.get('https://example.com/port/%E9%97%9C%E6%96%BC%E5%BF%83%E7%A8%AE%E5%AD%90%E6%95%99%E8%82%B2%E9%81%95%E6%B3%95%E8%BE%A6%E5%AD%B8%E7%9A%84%E6%8E%A7%E5%91%8A'),
      '2026-03-13T00:00:00.000Z'
    );
    assert.equal(
      lastmodByLoc.get('https://example.com/port/%E9%80%83%E8%B7%91%E6%8C%87%E5%8D%97'),
      '2026-03-13T00:00:00.000Z'
    );
    assert.equal(
      lastmodByLoc.get('https://example.com/port/NCT%E5%9B%BE%E6%A0%87%E8%AE%BE%E8%AE%A1%E5%A4%A7%E8%B5%9B'),
      '2026-04-03T00:00:00.000Z'
    );
  });

  clearProjectModules();
});

test('map timer renders elapsed seconds and adds refresh control after the refresh interval', () => {
  clearProjectModules();
  const { getElapsedSeconds, renderLastSyncedValue } = require(path.join(projectRoot, 'public/js/map_time_utils'));
  const documentRef = createFakeDocument();
  const lastSyncedElement = createFakeNode('span');
  let refreshTriggered = false;

  renderLastSyncedValue(lastSyncedElement, {
    elapsedSeconds: getElapsedSeconds(1000, 43000),
    refreshInProgress: false,
    onRefresh() {
      refreshTriggered = true;
    },
    i18n: {
      common: {
        loading: '加载中...'
      },
      map: {
        stats: {
          secondsAgo: '{seconds} 秒前',
          refresh: '刷新'
        }
      }
    },
    refreshIntervalSeconds: 300,
    documentRef
  });

  assert.equal(collectNodeText(lastSyncedElement), '42 秒前');
  assert.equal(lastSyncedElement.children.length, 1);

  renderLastSyncedValue(lastSyncedElement, {
    elapsedSeconds: getElapsedSeconds(1000, 306000),
    refreshInProgress: false,
    onRefresh() {
      refreshTriggered = true;
    },
    i18n: {
      common: {
        loading: '加载中...'
      },
      map: {
        stats: {
          secondsAgo: '{seconds} 秒前',
          refresh: '刷新'
        }
      }
    },
    refreshIntervalSeconds: 300,
    documentRef
  });

  assert.equal(collectNodeText(lastSyncedElement), '305 秒前, 刷新');
  assert.equal(lastSyncedElement.children.length, 3);

  const refreshButton = lastSyncedElement.children[2];
  assert.equal(refreshButton.tagName, 'button');
  assert.equal(refreshButton.disabled, false);

  refreshButton.listeners.get('click')();
  assert.equal(refreshTriggered, true);
});

test('map record stats count self and agent reports per school', () => {
  clearProjectModules();
  const {
    buildSchoolReportStats,
    getSchoolReportStats,
    groupSchoolRecords
  } = require(path.join(projectRoot, 'public/js/map_record_stats'));

  const statsBySchool = buildSchoolReportStats([
    { name: '启明学校', province: '山东', addr: '地址 A', inputType: '受害者本人' },
    { name: '启明学校', province: '山东', addr: '地址 B', inputType: '受害者本人' },
    { name: '启明学校', province: '山东', addr: '地址 A', inputType: '受害者的代理人' },
    { name: '晨光学校', province: '北京', addr: '地址 C', inputType: '受害者的代理人' },
    { name: '晨光学校', province: '北京', addr: '地址 C', inputType: '' }
  ]);

  assert.deepEqual(
    getSchoolReportStats(statsBySchool, { name: '启明学校', province: '山东', addr: '其他地址' }),
    { selfCount: 2, agentCount: 1 }
  );
  assert.deepEqual(
    getSchoolReportStats(statsBySchool, { name: '晨光学校', province: '北京', addr: '地址 C' }),
    { selfCount: 0, agentCount: 1 }
  );

  const groupedRecords = groupSchoolRecords([
    { name: '启明学校', province: '山东', addr: '地址 A', experience: '经历 1', scandal: '', else: '', HMaster: '甲', prov: '青岛', contact: '1', inputType: '受害者本人', dateStart: '2024-01-01' },
    { name: '启明学校', province: '山东', addr: '地址 A', experience: '经历 1', scandal: '', else: '', HMaster: '甲', prov: '青岛', contact: '1', inputType: '受害者本人', dateStart: '2024-01-01' },
    { name: '启明学校', province: '山东', addr: '地址 A', experience: '经历 1', scandal: '', else: '', HMaster: '甲', prov: '青岛', contact: '1', inputType: '受害者的代理人', dateStart: '2024-01-01' },
    { name: '启明学校', province: '山东', addr: '地址 A', experience: '经历 1', scandal: '', else: '', HMaster: '甲', prov: '青岛', contact: '1', inputType: '受害者本人', dateStart: '2024-02-01' }
  ]);

  assert.equal(groupedRecords.length, 1);
  assert.equal(groupedRecords[0].pages.length, 4);
});

test('map record detail helper omits empty fields in confirmation-style detail rows', () => {
  clearProjectModules();
  const { getRecordConfirmationFields } = require(path.join(projectRoot, 'public/js/map_record_detail'));
  const { getMessages } = require(path.join(projectRoot, 'config/i18n'));

  const fields = getRecordConfirmationFields({
    inputType: '受害者本人',
    name: '启明学校',
    province: '山东',
    city: '青岛市',
    county: '',
    dateStart: '2024-01-01',
    dateEnd: '',
    addr: '',
    contact: 'test@example.com',
    HMaster: '',
    experience: '',
    scandal: '存在体罚',
    else: ''
  }, {
    i18n: getMessages('zh-CN'),
    getProvinceDisplay(value) {
      return value;
    },
    getInputTypeDisplay(value) {
      return value;
    }
  });

  assert.deepEqual(fields.map((field) => field.key), [
    'identity',
    'dateStart',
    'schoolName',
    'province',
    'city',
    'contactInformation',
    'scandal'
  ]);
});

test('map record detail helpers build stable route urls and locate grouped submissions', () => {
  clearProjectModules();
  const {
    buildRecordDetailRouteUrl,
    findGroupedRecordLocationByRouteToken,
    getRecordDetailRouteToken
  } = require(path.join(projectRoot, 'public/js/map_record_detail'));
  const { groupSchoolRecords } = require(path.join(projectRoot, 'public/js/map_record_stats'));

  const records = [
    {
      name: '启明学校',
      province: '山东',
      addr: '地址 A',
      city: '青岛',
      county: '市南区',
      inputType: '受害者本人',
      dateStart: '2024-01-01',
      experience: '经历一'
    },
    {
      name: '启明学校',
      province: '山东',
      addr: '地址 A',
      city: '青岛',
      county: '市南区',
      inputType: '受害者的代理人',
      dateStart: '2024-02-01',
      experience: '经历二'
    }
  ];
  const groups = groupSchoolRecords(records);
  const firstToken = getRecordDetailRouteToken(records[0]);
  const secondToken = getRecordDetailRouteToken(records[1]);
  const detailUrl = buildRecordDetailRouteUrl(records[1], {
    queryEntries: new URLSearchParams('lang=en&search=qiming'),
    returnTo: 'record-3'
  });
  const location = findGroupedRecordLocationByRouteToken(groups, secondToken);

  assert.notEqual(firstToken, secondToken);
  assert.match(detailUrl, /^\/map\/record\//);
  assert.match(detailUrl, /lang=en/);
  assert.match(detailUrl, /search=qiming/);
  assert.match(detailUrl, /returnTo=record-3/);
  assert.equal(location.groupIndex, 0);
  assert.equal(location.pageIndex, 1);
  assert.equal(location.record.experience, '经历二');
});

test('map province utils normalize workers GeoJSON names and province aliases to stable codes', () => {
  clearProjectModules();
  const {
    buildProvinceCountMap,
    buildProvinceDensityMap,
    getProvinceAreaSquareKilometers,
    getProvinceCodeFromFeature,
    resolveProvinceCode
  } = require(path.join(projectRoot, 'public/js/map_province_utils'));

  assert.equal(resolveProvinceCode('內蒙古自治區'), '150000');
  assert.equal(resolveProvinceCode('澳门特别行政区'), '820000');
  assert.equal(resolveProvinceCode('臺灣（ROC）'), '710000');
  assert.equal(resolveProvinceCode('新疆维吾尔自治区'), '650000');
  assert.equal(getProvinceAreaSquareKilometers('北京'), 16410.54);
  assert.equal(getProvinceAreaSquareKilometers('香港'), 1113.76);
  assert.equal(getProvinceAreaSquareKilometers('不存在的省份'), 0);

  assert.equal(getProvinceCodeFromFeature({
    properties: {
      code: '820000',
      name: '澳门'
    }
  }), '820000');
  assert.equal(getProvinceCodeFromFeature({
    properties: {
      name: '臺灣（ROC）',
      fullname: '台湾'
    }
  }), '710000');

  assert.deepEqual(
    [...buildProvinceCountMap([
      { province: '內蒙古自治區', count: 2 },
      { province: '内蒙古', count: 3 },
      { province: '臺灣（ROC）', count: 4 },
      { province: '澳门特别行政区' }
    ]).entries()],
    [
      ['150000', 5],
      ['710000', 4],
      ['820000', 1]
    ]
  );

  const densityMap = buildProvinceDensityMap([
    { province: '北京', count: 4 },
    { province: '北京市', count: 1 },
    { province: '內蒙古自治區', count: 6 },
    { province: '不存在的省份', count: 100 }
  ]);

  assert.ok(Math.abs((densityMap.get('110000') || 0) - (5 / 16410.54)) < 1e-12);
  assert.ok(Math.abs((densityMap.get('150000') || 0) - (6 / 1183000)) < 1e-12);
  assert.equal(densityMap.has('不存在的省份'), false);
});

test('form protection tokens reject honeypot, tampering, and overly fast submissions', () => {
  clearProjectModules();
  const {
    issueFormProtectionToken,
    validateFormProtection
  } = require(path.join(projectRoot, 'app/services/formProtectionService'));
  const issuedAt = 1_700_000_000_000;
  const token = issueFormProtectionToken({
    secret: 'test-form-protection-secret',
    issuedAt
  });

  assert.equal(validateFormProtection({
    token,
    secret: 'test-form-protection-secret',
    now: issuedAt + 3500,
    minFillMs: 3000,
    maxAgeMs: 10000
  }).ok, true);

  assert.equal(validateFormProtection({
    token,
    honeypotValue: 'https://spam.example',
    secret: 'test-form-protection-secret',
    now: issuedAt + 3500
  }).reason, 'honeypot_filled');

  assert.equal(validateFormProtection({
    token,
    secret: 'test-form-protection-secret',
    now: issuedAt + 1500,
    minFillMs: 3000
  }).reason, 'submitted_too_quickly');

  assert.equal(validateFormProtection({
    token: `${token.slice(0, -1)}${token.endsWith('0') ? '1' : '0'}`,
    secret: 'test-form-protection-secret',
    now: issuedAt + 3500
  }).reason, 'invalid_token');
});

test('form autocomplete records are deduplicated and searchable by both school name and address', () => {
  clearProjectModules();
  const { buildAutocompleteRecords, getAutocompleteSuggestions } = require(path.join(projectRoot, 'public/js/form_api'));

  const records = buildAutocompleteRecords([
    { name: '青岛启明学校', addr: '山东省青岛市市南区香港中路 1 号' },
    { name: '青岛启明学校', addr: '山东省青岛市市南区香港中路 1 号' },
    { name: '济南晨光学校', addr: '山东省济南市历下区泉城路 8 号' }
  ]);

  assert.equal(records.length, 2);
  assert.deepEqual(
    getAutocompleteSuggestions(records, '启明', 'name').map((record) => record.name),
    ['青岛启明学校']
  );
  assert.deepEqual(
    getAutocompleteSuggestions(records, '泉城路', 'address').map((record) => record.addr),
    ['山东省济南市历下区泉城路 8 号']
  );
});

test('submit route rejects honeypot submissions with a generic protection error', async () => {
  clearProjectModules();
  const { issueFormProtectionToken } = require(path.join(projectRoot, 'app/services/formProtectionService'));
  const app = loadApp({
    DEBUG_MOD: 'false',
    FORM_DRY_RUN: 'true',
    FORM_PROTECTION_SECRET: 'test-form-protection-secret'
  });
  const response = await requestApp(app, {
    path: '/submit',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: buildValidSubmissionBody({
      website: 'https://spam.example',
      form_token: issueFormProtectionToken({
        secret: 'test-form-protection-secret',
        issuedAt: Date.now() - 5000
      })
    })
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body, /提交已失效或异常/);
  clearProjectModules();
});

test('submit route rejects submissions that arrive too quickly', async () => {
  clearProjectModules();
  const { issueFormProtectionToken } = require(path.join(projectRoot, 'app/services/formProtectionService'));
  const app = loadApp({
    DEBUG_MOD: 'false',
    FORM_DRY_RUN: 'true',
    FORM_PROTECTION_SECRET: 'test-form-protection-secret',
    FORM_PROTECTION_MIN_FILL_MS: '3000'
  });
  const response = await requestApp(app, {
    path: '/submit',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: buildValidSubmissionBody({
      form_token: issueFormProtectionToken({
        secret: 'test-form-protection-secret',
        issuedAt: Date.now() - 500
      })
    })
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body, /提交已失效或异常/);
  clearProjectModules();
});

test('submit route still accepts a valid protected form in dry run mode', async () => {
  clearProjectModules();
  const { issueFormProtectionToken } = require(path.join(projectRoot, 'app/services/formProtectionService'));
  const expectedAge = new Date().getUTCFullYear() - 2008;
  const app = loadApp({
    DEBUG_MOD: 'false',
    FORM_DRY_RUN: 'true',
    FORM_PROTECTION_SECRET: 'test-form-protection-secret',
    FORM_PROTECTION_MIN_FILL_MS: '3000'
  });
  const response = await requestApp(app, {
    path: '/submit',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: buildValidSubmissionBody({
      form_token: issueFormProtectionToken({
        secret: 'test-form-protection-secret',
        issuedAt: Date.now() - 5000
      })
    })
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['x-robots-tag'], 'noindex, nofollow, noarchive, nosnippet');
  assert.equal(response.headers['surrogate-control'], 'no-store');
  assert.match(response.headers['cache-control'], /no-store/);
  assert.match(response.body, /<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">/);
  assert.match(response.body, /entry\.5034928/);
  assert.match(response.body, /测试机构/);
  assert.match(response.body, new RegExp(`entry\\.842223433</code></td>\\s*<td>出生年份</td>\\s*<td>${expectedAge}</td>`));
  assert.match(response.body, /entry\.1422578992<\/code><\/td>\s*<td>性别<\/td>\s*<td>男<\/td>/);
  assert.doesNotMatch(response.body, /entry\.842223433_year/);
  assert.doesNotMatch(response.body, /entry\.842223433_month/);
  assert.doesNotMatch(response.body, /entry\.842223433_day/);
  clearProjectModules();
});

test('submit route accepts agent submissions with MtF selected for other gender identity in dry run mode', async () => {
  clearProjectModules();
  const { issueFormProtectionToken } = require(path.join(projectRoot, 'app/services/formProtectionService'));
  const expectedAge = new Date().getUTCFullYear() - 2008;
  const app = loadApp({
    DEBUG_MOD: 'false',
    FORM_DRY_RUN: 'true',
    FORM_PROTECTION_SECRET: 'test-form-protection-secret',
    FORM_PROTECTION_MIN_FILL_MS: '3000'
  });
  const response = await requestApp(app, {
    path: '/submit',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: buildValidSubmissionBody({
      identity: '受害者的代理人',
      birth_year: '2008',
      sex: '__other_option__',
      sex_other_type: 'MtF',
      form_token: issueFormProtectionToken({
        secret: 'test-form-protection-secret',
        issuedAt: Date.now() - 5000
      })
    })
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, new RegExp(`entry\\.842223433</code></td>\\s*<td>受害者出生年份</td>\\s*<td>${expectedAge}</td>`));
  assert.match(response.body, /entry\.1422578992<\/code><\/td>\s*<td>受害者性别<\/td>\s*<td>MtF<\/td>/);
  clearProjectModules();
});

test('submit route accepts custom other gender identity text in dry run mode', async () => {
  clearProjectModules();
  const { issueFormProtectionToken } = require(path.join(projectRoot, 'app/services/formProtectionService'));
  const app = loadApp({
    DEBUG_MOD: 'false',
    FORM_DRY_RUN: 'true',
    FORM_PROTECTION_SECRET: 'test-form-protection-secret',
    FORM_PROTECTION_MIN_FILL_MS: '3000'
  });
  const response = await requestApp(app, {
    path: '/submit',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: buildValidSubmissionBody({
      sex: '__other_option__',
      sex_other_type: '__custom_other_sex__',
      sex_other: '非二元',
      form_token: issueFormProtectionToken({
        secret: 'test-form-protection-secret',
        issuedAt: Date.now() - 5000
      })
    })
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /entry\.1422578992<\/code><\/td>\s*<td>性别<\/td>\s*<td>__other_option__<\/td>/);
  assert.match(response.body, /entry\.1422578992\.other_option_response<\/code><\/td>\s*<td>性别<\/td>\s*<td>非二元<\/td>/);
  clearProjectModules();
});

test('submit route accepts Queer selected for other gender identity in dry run mode', async () => {
  clearProjectModules();
  const { issueFormProtectionToken } = require(path.join(projectRoot, 'app/services/formProtectionService'));
  const app = loadApp({
    DEBUG_MOD: 'false',
    FORM_DRY_RUN: 'true',
    FORM_PROTECTION_SECRET: 'test-form-protection-secret',
    FORM_PROTECTION_MIN_FILL_MS: '3000'
  });
  const response = await requestApp(app, {
    path: '/submit',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: buildValidSubmissionBody({
      sex: '__other_option__',
      sex_other_type: 'Queer',
      form_token: issueFormProtectionToken({
        secret: 'test-form-protection-secret',
        issuedAt: Date.now() - 5000
      })
    })
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /entry\.1422578992<\/code><\/td>\s*<td>性别<\/td>\s*<td>__other_option__<\/td>/);
  assert.match(response.body, /entry\.1422578992\.other_option_response<\/code><\/td>\s*<td>性别<\/td>\s*<td>Queer<\/td>/);
  clearProjectModules();
});

test('submit route renders a confirmation page before sending to Google Form in normal mode', { concurrency: false }, async () => {
  clearProjectModules();
  let submitCallCount = 0;

  try {
    const { issueFormProtectionToken } = require(path.join(projectRoot, 'app/services/formProtectionService'));
    const { app, restore } = loadAppWithPatchedFormService({
      DEBUG_MOD: 'false',
      FORM_DRY_RUN: 'false',
      FORM_PROTECTION_SECRET: 'test-form-protection-secret',
      FORM_PROTECTION_MIN_FILL_MS: '3000'
    }, (formService) => {
      const originalSubmitToGoogleForm = formService.submitToGoogleForm;
      formService.submitToGoogleForm = async () => {
        submitCallCount += 1;
      };

      return () => {
        formService.submitToGoogleForm = originalSubmitToGoogleForm;
      };
    });
    const response = await requestApp(app, {
      path: '/submit',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: buildValidSubmissionBody({
        form_token: issueFormProtectionToken({
          secret: 'test-form-protection-secret',
          issuedAt: Date.now() - 5000
        })
      })
    });

    assert.equal(response.statusCode, 200);
    assert.equal(submitCallCount, 0);
    assert.equal(response.headers['x-robots-tag'], 'noindex, nofollow, noarchive, nosnippet');
    assert.match(response.body, /提交确认/);
    assert.match(response.body, /这一步还没有发送到 Google Form/);
    assert.match(response.body, /name="confirmation_token"/);
    assert.match(response.body, /<textarea name="confirmation_payload" hidden>/);
    assert.match(response.body, /确认并提交/);
    assert.doesNotMatch(response.body, /<strong>\s*目标网址：\s*<\/strong>/);
    assert.doesNotMatch(response.body, /<th>\s*Google Form Entry\s*<\/th>/);
    assert.doesNotMatch(response.body, /<td><code>entry\./);
    assert.match(
      response.body,
      /请问您是作为什么身份来填写本表单？[\s\S]*?出生年份[\s\S]*?性别[\s\S]*?首次被送入日期[\s\S]*?离开日期[\s\S]*?个人在校经历描述[\s\S]*?机构名称[\s\S]*?机构所在省份[\s\S]*?机构所在城市 \/ 区县[\s\S]*?机构所在县区[\s\S]*?机构地址[\s\S]*?机构联系方式[\s\S]*?负责人\/校长姓名[\s\S]*?丑闻及暴力行为详细描述[\s\S]*?其他补充/
    );
    restore();
  } finally {
    clearProjectModules();
  }
});

test('submit confirm route sends the reviewed payload to Google Form in normal mode', { concurrency: false }, async () => {
  clearProjectModules();
  const capturedCalls = [];

  try {
    const { issueFormProtectionToken } = require(path.join(projectRoot, 'app/services/formProtectionService'));
    const { app, restore } = loadAppWithPatchedFormService({
      DEBUG_MOD: 'false',
      FORM_DRY_RUN: 'false',
      FORM_PROTECTION_SECRET: 'test-form-protection-secret',
      FORM_PROTECTION_MIN_FILL_MS: '3000'
    }, (formService) => {
      const originalSubmitToGoogleForm = formService.submitToGoogleForm;
      formService.submitToGoogleForm = async (...args) => {
        capturedCalls.push(args);
      };

      return () => {
        formService.submitToGoogleForm = originalSubmitToGoogleForm;
      };
    });
    const reviewResponse = await requestApp(app, {
      path: '/submit',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: buildValidSubmissionBody({
        form_token: issueFormProtectionToken({
          secret: 'test-form-protection-secret',
          issuedAt: Date.now() - 5000
        })
      })
    });

    const confirmationTokenMatch = responseBodyMatch(reviewResponse.body, /name="confirmation_token" value="([^"]+)"/);
    const confirmationPayloadMatch = responseBodyMatch(reviewResponse.body, /<textarea name="confirmation_payload" hidden>([^<]*)<\/textarea>/);
    const confirmResponse = await requestApp(app, {
      path: '/submit/confirm',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        confirmation_token: confirmationTokenMatch[1],
        confirmation_payload: confirmationPayloadMatch[1]
      }).toString()
    });

    assert.equal(confirmResponse.statusCode, 200);
    assert.equal(capturedCalls.length, 1);
    assert.match(capturedCalls[0][0], /https:\/\/docs\.google\.com\/forms\/d\/e\//);
    assert.match(capturedCalls[0][1], /entry\.5034928=/);
    assert.match(decodeURIComponent(capturedCalls[0][1]), /测试机构/);
    assert.match(confirmResponse.body, /提交成功/);
    restore();
  } finally {
    clearProjectModules();
  }
});

test('submit confirm route renders a prefilled Google Form fallback link when upstream submission fails', { concurrency: false }, async () => {
  clearProjectModules();

  try {
    const { issueFormProtectionToken } = require(path.join(projectRoot, 'app/services/formProtectionService'));
    const { app, restore } = loadAppWithPatchedFormService({
      DEBUG_MOD: 'false',
      FORM_DRY_RUN: 'false',
      FORM_PROTECTION_SECRET: 'test-form-protection-secret',
      FORM_PROTECTION_MIN_FILL_MS: '3000'
    }, (formService) => {
      const originalSubmitToGoogleForm = formService.submitToGoogleForm;
      formService.submitToGoogleForm = async () => {
        throw new Error('google form unavailable');
      };

      return () => {
        formService.submitToGoogleForm = originalSubmitToGoogleForm;
      };
    });
    const reviewResponse = await requestApp(app, {
      path: '/submit',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: buildValidSubmissionBody({
        form_token: issueFormProtectionToken({
          secret: 'test-form-protection-secret',
          issuedAt: Date.now() - 5000
        })
      })
    });

    const confirmationTokenMatch = responseBodyMatch(reviewResponse.body, /name="confirmation_token" value="([^"]+)"/);
    const confirmationPayloadMatch = responseBodyMatch(reviewResponse.body, /<textarea name="confirmation_payload" hidden>([^<]*)<\/textarea>/);
    const confirmResponse = await requestApp(app, {
      path: '/submit/confirm',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        confirmation_token: confirmationTokenMatch[1],
        confirmation_payload: confirmationPayloadMatch[1]
      }).toString()
    });

    assert.equal(confirmResponse.statusCode, 500);
    assert.match(confirmResponse.body, /打开 Google Form 继续提交|Open Google Form to Continue/);
    assert.match(confirmResponse.body, /打开 Google Form 页面可能需要网络代理|opening the Google Form page may require a network proxy/);
    assert.match(confirmResponse.body, /viewform\?usp=pp_url&amp;entry\.842223433=/);
    assert.match(confirmResponse.body, /entry\.5034928=%E6%B5%8B%E8%AF%95%E6%9C%BA%E6%9E%84/);
    assert.match(confirmResponse.body, /entry\.500021634=%E5%8F%97%E5%AE%B3%E8%80%85%E6%9C%AC%E4%BA%BA/);
    restore();
  } finally {
    clearProjectModules();
  }
});

test('submit confirm route rejects tampered confirmation payloads', async () => {
  clearProjectModules();
  const { issueFormProtectionToken } = require(path.join(projectRoot, 'app/services/formProtectionService'));
  const app = loadApp({
    DEBUG_MOD: 'false',
    FORM_DRY_RUN: 'false',
    FORM_PROTECTION_SECRET: 'test-form-protection-secret',
    FORM_PROTECTION_MIN_FILL_MS: '3000'
  });
  const reviewResponse = await requestApp(app, {
    path: '/submit',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: buildValidSubmissionBody({
      form_token: issueFormProtectionToken({
        secret: 'test-form-protection-secret',
        issuedAt: Date.now() - 5000
      })
    })
  });

  const confirmationTokenMatch = responseBodyMatch(reviewResponse.body, /name="confirmation_token" value="([^"]+)"/);
  const confirmationPayloadMatch = responseBodyMatch(reviewResponse.body, /<textarea name="confirmation_payload" hidden>([^<]*)<\/textarea>/);
  const confirmResponse = await requestApp(app, {
    path: '/submit/confirm',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      confirmation_token: confirmationTokenMatch[1],
      confirmation_payload: `${confirmationPayloadMatch[1]}tampered`
    }).toString()
  });

  assert.equal(confirmResponse.statusCode, 400);
  assert.match(confirmResponse.body, /提交已失效或异常/);
  clearProjectModules();
});

test('submit route rejects invalid birth year values', async () => {
  clearProjectModules();
  const { issueFormProtectionToken } = require(path.join(projectRoot, 'app/services/formProtectionService'));
  const app = loadApp({
    DEBUG_MOD: 'false',
    FORM_DRY_RUN: 'true',
    FORM_PROTECTION_SECRET: 'test-form-protection-secret',
    FORM_PROTECTION_MIN_FILL_MS: '3000'
  });
  const response = await requestApp(app, {
    path: '/submit',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: buildValidSubmissionBody({
      birth_year: '1899',
      form_token: issueFormProtectionToken({
        secret: 'test-form-protection-secret',
        issuedAt: Date.now() - 5000
      })
    })
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body, /有效的出生年份/);
  clearProjectModules();
});

test('submit route rejects invalid victim birth year values for agent submissions', async () => {
  clearProjectModules();
  const { issueFormProtectionToken } = require(path.join(projectRoot, 'app/services/formProtectionService'));
  const app = loadApp({
    DEBUG_MOD: 'false',
    FORM_DRY_RUN: 'true',
    FORM_PROTECTION_SECRET: 'test-form-protection-secret',
    FORM_PROTECTION_MIN_FILL_MS: '3000'
  });
  const response = await requestApp(app, {
    path: '/submit',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: buildValidSubmissionBody({
      identity: '受害者的代理人',
      birth_year: '121',
      form_token: issueFormProtectionToken({
        secret: 'test-form-protection-secret',
        issuedAt: Date.now() - 5000
      })
    })
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body, /有效的受害者出生年份/);
  clearProjectModules();
});

test('submitToGoogleForm stops at redirect responses instead of following them', { concurrency: false }, async () => {
  await withEnvOverrides(getNoProxyEnv(), async () => {
    clearProjectModules();
    const axios = require('axios');
    const originalPost = axios.post;
    const capturedCalls = [];

    axios.post = async (...args) => {
      capturedCalls.push(args);
      return { status: 302 };
    };

    try {
      const { submitToGoogleForm } = require(path.join(projectRoot, 'app/services/formService'));
      await submitToGoogleForm('https://docs.google.com/forms/d/e/test/formResponse', 'entry.1=value');

      assert.equal(capturedCalls.length, 1);
      assert.equal(capturedCalls[0][2].maxRedirects, 0);
      assert.equal(capturedCalls[0][2].validateStatus(302), true);
      assert.equal(capturedCalls[0][2].validateStatus(400), false);
    } finally {
      axios.post = originalPost;
      clearProjectModules();
    }
  });
});

test('submitToGoogleForm uses ProxyAgent when proxy env is configured', { concurrency: false }, async () => {
  await withEnvOverrides({
    ...getNoProxyEnv(),
    HTTP_PROXY: 'http://proxy.example:8080',
    HTTPS_PROXY: 'http://proxy.example:8080',
    ALL_PROXY: 'socks5://proxy.example:1080',
    http_proxy: 'http://proxy.example:8080',
    https_proxy: 'http://proxy.example:8080',
    all_proxy: 'socks5://proxy.example:1080'
  }, async () => {
    clearProjectModules();
    const axios = require('axios');
    const proxyAgentModulePath = require.resolve('proxy-agent');
    const originalProxyAgentModule = require.cache[proxyAgentModulePath];
    const originalPost = axios.post;
    const capturedCalls = [];

    class FakeProxyAgent {}

    require.cache[proxyAgentModulePath] = {
      id: proxyAgentModulePath,
      filename: proxyAgentModulePath,
      loaded: true,
      exports: {
        ProxyAgent: FakeProxyAgent
      }
    };

    axios.post = async (...args) => {
      capturedCalls.push(args);
      return { status: 200 };
    };

    try {
      const { submitToGoogleForm } = require(path.join(projectRoot, 'app/services/formService'));
      await submitToGoogleForm('https://docs.google.com/forms/d/e/test/formResponse', 'entry.1=value');

      assert.equal(capturedCalls.length, 1);
      assert.equal(capturedCalls[0][2].proxy, false);
      assert.ok(capturedCalls[0][2].httpAgent instanceof FakeProxyAgent);
      assert.ok(capturedCalls[0][2].httpsAgent instanceof FakeProxyAgent);
    } finally {
      axios.post = originalPost;
      if (originalProxyAgentModule) {
        require.cache[proxyAgentModulePath] = originalProxyAgentModule;
      } else {
        delete require.cache[proxyAgentModulePath];
      }
      clearProjectModules();
    }
  });
});

test('map data service can bypass in-memory cache on force refresh', async () => {
  await withEnvOverrides(getNoProxyEnv(), async () => {
    clearProjectModules();
    const mapDataService = require(path.join(projectRoot, 'app/services/mapDataService'));
    const originalFetch = global.fetch;
    let fetchCount = 0;

    mapDataService.resetMapDataCache();
    global.fetch = async () => {
      fetchCount += 1;

      return {
        ok: true,
        async json() {
          return {
            avg_age: 18,
            last_synced: 1000 + fetchCount,
            statistics: [],
            data: []
          };
        }
      };
    };

    try {
      await mapDataService.getMapData({ publicMapDataUrl: 'https://example.com/api/map-data' });
      await mapDataService.getMapData({ publicMapDataUrl: 'https://example.com/api/map-data' });
      await mapDataService.getMapData({ forceRefresh: true, publicMapDataUrl: 'https://example.com/api/map-data' });
    } finally {
      global.fetch = originalFetch;
      mapDataService.resetMapDataCache();
    }

    assert.equal(fetchCount, 2);
  });
});

test('map data service temporarily serves public fallback data and upgrades to GOOGLE_SCRIPT_URL when it succeeds later', async () => {
  await withEnvOverrides(getNoProxyEnv(), async () => {
    clearProjectModules();
    const mapDataService = require(path.join(projectRoot, 'app/services/mapDataService'));
    const originalFetch = global.fetch;

    mapDataService.resetMapDataCache();
    global.fetch = async (url) => {
      if (url === 'https://private.example/map-data') {
        await new Promise((resolve) => setTimeout(resolve, 40));

        return {
          ok: true,
          async json() {
            return {
              avg_age: 21,
              last_synced: 2000,
              schoolNum: 9,
              formNum: 5,
              statistics: [],
              statisticsForm: [],
              data: [
                { province: '北京', lat: 39.9, lng: 116.4 }
              ]
            };
          }
        };
      }

      if (url === 'https://public.example/map-data') {
        await new Promise((resolve) => setTimeout(resolve, 5));

        return {
          ok: true,
          async json() {
            return {
              avg_age: 18,
              last_synced: 1000,
              schoolNum: 3,
              formNum: 2,
              statistics: [],
              statisticsForm: [],
              data: [
                { province: '上海', lat: 31.2, lng: 121.5 }
              ]
            };
          }
        };
      }

      throw new Error(`unexpected url: ${url}`);
    };

    try {
      const initialResult = await mapDataService.getMapData({
        googleScriptUrl: 'https://private.example/map-data',
        publicMapDataUrl: 'https://public.example/map-data'
      });

      assert.equal(initialResult.source, 'public-map-data');
      assert.equal(initialResult.isSourceFallback, true);
      assert.equal(initialResult.schoolNum, 3);

      await new Promise((resolve) => setTimeout(resolve, 80));

      const upgradedResult = await mapDataService.getMapData({
        googleScriptUrl: 'https://private.example/map-data',
        publicMapDataUrl: 'https://public.example/map-data'
      });

      assert.equal(upgradedResult.source, 'google-script');
      assert.equal(upgradedResult.isSourceFallback, false);
      assert.equal(upgradedResult.schoolNum, 9);
    } finally {
      global.fetch = originalFetch;
      mapDataService.resetMapDataCache();
    }
  });
});

test('map data service merges province statistics that differ only by script', async () => {
  await withEnvOverrides(getNoProxyEnv(), async () => {
    clearProjectModules();
    const mapDataService = require(path.join(projectRoot, 'app/services/mapDataService'));
    const originalFetch = global.fetch;

    mapDataService.resetMapDataCache();
    global.fetch = async () => ({
      ok: true,
      async json() {
        return {
          avg_age: 18,
          last_synced: 1000,
          SchoolNum: 133,
          formNum: 4,
          statistics: [
            { province: '重庆', count: 120 },
            { province: '重慶', count: 2 }
          ],
          statisticsForm: [
            { province: '重庆', count: 1 },
            { province: '重慶', count: 3 }
          ],
          data: [
            { province: '重庆', lat: 29.5, lng: 106.5 },
            { province: '重慶', lat: 29.6, lng: 106.6 }
          ]
        };
      }
    });

    try {
      const result = await mapDataService.getMapData({ publicMapDataUrl: 'https://example.com/api/map-data' });

      assert.deepEqual(result.statistics, [
        { province: '重慶', count: 122 }
      ]);
      assert.deepEqual(result.statisticsForm, [
        { province: '重慶', count: 4 }
      ]);
      assert.deepEqual(result.data.map((item) => item.province), ['重慶', '重慶']);
    } finally {
      global.fetch = originalFetch;
      mapDataService.resetMapDataCache();
    }
  });
});

test('map data service accepts lowercase schoolNum from upstream payloads', async () => {
  await withEnvOverrides(getNoProxyEnv(), async () => {
    clearProjectModules();
    const mapDataService = require(path.join(projectRoot, 'app/services/mapDataService'));
    const originalFetch = global.fetch;

    mapDataService.resetMapDataCache();
    global.fetch = async () => ({
      ok: true,
      async json() {
        return {
          avg_age: 18,
          last_synced: 1000,
          schoolNum: 497,
          formNum: 18,
          statistics: [],
          statisticsForm: [],
          data: [
            { province: '北京', lat: 39.9, lng: 116.4 }
          ]
        };
      }
    });

    try {
      const result = await mapDataService.getMapData({ publicMapDataUrl: 'https://example.com/api/map-data' });

      assert.equal(result.schoolNum, 497);
      assert.equal(result.formNum, 18);
    } finally {
      global.fetch = originalFetch;
      mapDataService.resetMapDataCache();
    }
  });
});

test('map data service uses proxy agent when MAP_DATA_NODE_TRANSPORT_OVERRIDES is enabled and proxy env is configured', async () => {
  await withEnvOverrides({
    ...getNoProxyEnv(),
    HTTPS_PROXY: 'http://proxy.example:1080'
  }, async () => {
    clearProjectModules();
    const axios = require('axios');
    const proxyAgentModulePath = require.resolve('proxy-agent');
    const originalProxyAgentModule = require.cache[proxyAgentModulePath];
    class FakeProxyAgent {}
    require.cache[proxyAgentModulePath] = {
      id: proxyAgentModulePath,
      filename: proxyAgentModulePath,
      loaded: true,
      exports: {
        ProxyAgent: FakeProxyAgent
      }
    };
    const mapDataService = require(path.join(projectRoot, 'app/services/mapDataService'));
    const originalGet = axios.get;
    const originalFetch = global.fetch;
    const axiosCalls = [];

    mapDataService.resetMapDataCache();
    axios.get = async (_url, config = {}) => {
      axiosCalls.push(config);

      return {
        status: 200,
        data: {
          avg_age: 18,
          last_synced: 1000,
          schoolNum: 2,
          formNum: 1,
          statistics: [],
          statisticsForm: [],
          data: []
        }
      };
    };
    global.fetch = async () => {
      throw new Error('fetch should not be called when proxy request succeeds');
    };

    try {
      const result = await mapDataService.getMapData({
        publicMapDataUrl: 'https://example.com/api/map-data',
        mapDataNodeTransportOverrides: true,
        upstreamTimeoutMs: 23456
      });

      assert.equal(result.schoolNum, 2);
      assert.equal(axiosCalls.length, 1);
      assert.equal(axiosCalls[0].proxy, false);
      assert.equal(axiosCalls[0].timeout, 23456);
      assert.ok(axiosCalls[0].httpAgent instanceof FakeProxyAgent);
      assert.ok(axiosCalls[0].httpsAgent instanceof FakeProxyAgent);
    } finally {
      axios.get = originalGet;
      global.fetch = originalFetch;
      mapDataService.resetMapDataCache();

      if (originalProxyAgentModule) {
        require.cache[proxyAgentModulePath] = originalProxyAgentModule;
      } else {
        delete require.cache[proxyAgentModulePath];
      }
    }
  });
});

test('map data service ignores proxy env when MAP_DATA_NODE_TRANSPORT_OVERRIDES is disabled', async () => {
  await withEnvOverrides({
    ...getNoProxyEnv(),
    HTTPS_PROXY: 'http://proxy.example:1080'
  }, async () => {
    clearProjectModules();
    const axios = require('axios');
    const mapDataService = require(path.join(projectRoot, 'app/services/mapDataService'));
    const originalGet = axios.get;
    const originalFetch = global.fetch;
    let fetchCount = 0;
    let axiosCount = 0;

    mapDataService.resetMapDataCache();
    global.fetch = async () => {
      fetchCount += 1;

      return {
        ok: true,
        async json() {
          return {
            avg_age: 18,
            last_synced: 1000,
            schoolNum: 2,
            formNum: 1,
            statistics: [],
            statisticsForm: [],
            data: []
          };
        }
      };
    };
    axios.get = async () => {
      axiosCount += 1;
      throw new Error('axios should not be called when MAP_DATA_NODE_TRANSPORT_OVERRIDES is disabled');
    };

    try {
      const result = await mapDataService.getMapData({
        publicMapDataUrl: 'https://example.com/api/map-data',
        upstreamTimeoutMs: 23456
      });

      assert.equal(result.schoolNum, 2);
      assert.equal(fetchCount, 1);
      assert.equal(axiosCount, 0);
    } finally {
      axios.get = originalGet;
      global.fetch = originalFetch;
      mapDataService.resetMapDataCache();
    }
  });
});

test('map data service uses direct IPv4 requests when MAP_DATA_NODE_TRANSPORT_OVERRIDES is enabled', async () => {
  await withEnvOverrides(getNoProxyEnv(), async () => {
    clearProjectModules();
    const axios = require('axios');
    const mapDataService = require(path.join(projectRoot, 'app/services/mapDataService'));
    const originalGet = axios.get;
    const originalFetch = global.fetch;
    const axiosCalls = [];

    mapDataService.resetMapDataCache();
    global.fetch = async () => {
      throw new Error('fetch should not be called when MAP_DATA_NODE_TRANSPORT_OVERRIDES is enabled');
    };
    axios.get = async (_url, config = {}) => {
      axiosCalls.push(config);

      return {
        status: 200,
        data: {
          avg_age: 18,
          last_synced: 1000,
          schoolNum: 3,
          formNum: 2,
          statistics: [],
          statisticsForm: [],
          data: []
        }
      };
    };

    try {
      const result = await mapDataService.getMapData({
        publicMapDataUrl: 'https://example.com/api/map-data',
        mapDataNodeTransportOverrides: true,
        upstreamTimeoutMs: 23456
      });

      assert.equal(result.schoolNum, 3);
      assert.equal(axiosCalls.length, 1);
      assert.equal(axiosCalls[0].proxy, false);
      assert.equal(axiosCalls[0].timeout, 23456);
      assert.equal(axiosCalls[0].httpAgent.options.family, 4);
      assert.equal(axiosCalls[0].httpsAgent.options.family, 4);
    } finally {
      axios.get = originalGet;
      global.fetch = originalFetch;
      mapDataService.resetMapDataCache();
    }
  });
});

test('map data service forwards the configured upstream timeout to fetch requests', async () => {
  await withEnvOverrides({
    ...getNoProxyEnv(),
    RUNTIME_TARGET: 'workers'
  }, async () => {
    clearProjectModules();
    const mapDataService = require(path.join(projectRoot, 'app/services/mapDataService'));
    const originalFetch = global.fetch;
    const originalAbortSignalTimeout = AbortSignal.timeout;
    let capturedTimeoutMs = null;

    mapDataService.resetMapDataCache();
    AbortSignal.timeout = (timeoutMs) => {
      capturedTimeoutMs = timeoutMs;
      return {
        aborted: false,
        addEventListener() {},
        removeEventListener() {}
      };
    };
    global.fetch = async () => ({
      ok: true,
      async json() {
        return {
          avg_age: 18,
          last_synced: 1000,
          schoolNum: 3,
          formNum: 2,
          statistics: [],
          statisticsForm: [],
          data: []
        };
      }
    });

    try {
      const result = await mapDataService.getMapData({
        publicMapDataUrl: 'https://example.com/api/map-data',
        upstreamTimeoutMs: 23456
      });

      assert.equal(result.schoolNum, 3);
      assert.equal(capturedTimeoutMs, 23456);
    } finally {
      AbortSignal.timeout = originalAbortSignalTimeout;
      global.fetch = originalFetch;
      mapDataService.resetMapDataCache();
    }
  });
});

test('map data service retries with fetch and skips Node-only transport fallbacks in workers runtime', async () => {
  await withEnvOverrides({
    ...getNoProxyEnv(),
    RUNTIME_TARGET: 'workers'
  }, async () => {
    clearProjectModules();
    const axios = require('axios');
    const mapDataService = require(path.join(projectRoot, 'app/services/mapDataService'));
    const originalGet = axios.get;
    const originalFetch = global.fetch;
    let fetchCount = 0;
    let axiosCount = 0;

    mapDataService.resetMapDataCache();
    global.fetch = async () => {
      fetchCount += 1;

      if (fetchCount === 1) {
        const error = new TypeError('fetch failed');
        error.cause = {
          name: 'TimeoutError',
          code: 23,
          message: 'The operation was aborted due to timeout'
        };
        throw error;
      }

      return {
        ok: true,
        async json() {
          return {
            avg_age: 18,
            last_synced: 1000,
            schoolNum: 4,
            formNum: 2,
            statistics: [],
            statisticsForm: [],
            data: []
          };
        }
      };
    };
    axios.get = async () => {
      axiosCount += 1;
      throw new Error('axios fallback should not be used in workers runtime');
    };

    try {
      const result = await mapDataService.getMapData({ publicMapDataUrl: 'https://example.com/api/map-data' });

      assert.equal(result.schoolNum, 4);
      assert.equal(fetchCount, 2);
      assert.equal(axiosCount, 0);
    } finally {
      axios.get = originalGet;
      global.fetch = originalFetch;
      mapDataService.resetMapDataCache();
    }
  });
});

test('public map API keeps CORS enabled while translate API stays same-origin only', async () => {
  await withEnvOverrides(getNoProxyEnv(), async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      async json() {
        return {
          avg_age: 18,
          last_synced: 1000,
          statistics: [],
          data: []
        };
      }
    });

    try {
      const app = loadApp({ DEBUG_MOD: 'false' });
      const mapResponse = await requestApp(app, {
        path: '/api/map-data',
        headers: {
          Origin: 'https://evil.example'
        }
      });
      const translateResponse = await requestApp(app, {
        path: '/api/translate-text',
        method: 'POST',
        headers: {
          Origin: 'https://evil.example',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: [],
          targetLanguage: 'en'
        })
      });

      assert.equal(mapResponse.statusCode, 200);
      assert.equal(mapResponse.headers['access-control-allow-origin'], '*');
      assert.equal(translateResponse.statusCode, 200);
      assert.equal(translateResponse.headers['access-control-allow-origin'], undefined);
    } finally {
      global.fetch = originalFetch;
      clearProjectModules();
    }
  });
});

test('public map API throttles repeated read scraping without disabling cross-origin reads', async () => {
  await withEnvOverrides(getNoProxyEnv(), async () => {
    clearProjectModules();
    const originalFetch = global.fetch;
    const mapDataService = require(path.join(projectRoot, 'app/services/mapDataService'));

    mapDataService.resetMapDataCache();
    global.fetch = async () => ({
      ok: true,
      async json() {
        return {
          avg_age: 18,
          last_synced: 1000,
          statistics: [],
          data: []
        };
      }
    });

    try {
      const app = loadApp({
        DEBUG_MOD: 'false',
        MAP_READ_RATE_LIMIT_MAX: '1'
      });
      const firstResponse = await requestApp(app, {
        path: '/api/map-data',
        headers: {
          Origin: 'https://crawler.example'
        }
      });
      const secondResponse = await requestApp(app, {
        path: '/api/map-data',
        headers: {
          Origin: 'https://crawler.example'
        }
      });

      assert.equal(firstResponse.statusCode, 200);
      assert.equal(firstResponse.headers['access-control-allow-origin'], '*');
      assert.equal(secondResponse.statusCode, 429);
      assert.equal(secondResponse.headers['access-control-allow-origin'], '*');
    } finally {
      global.fetch = originalFetch;
      mapDataService.resetMapDataCache();
      clearProjectModules();
    }
  });
});

test('translate API returns 500 when upstream translation fails', async () => {
  const originalFetch = global.fetch;
  const originalWarn = console.warn;

  global.fetch = async () => {
    throw new Error('fetch failed');
  };
  console.warn = () => {};

  try {
    const app = loadApp({
      DEBUG_MOD: 'false',
      ...getGoogleTranslationTestEnv()
    });
    const response = await requestApp(app, {
      path: '/api/translate-text',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [{ fieldKey: 'experience', text: '原文內容' }],
        targetLanguage: 'en'
      })
    });

    assert.equal(response.statusCode, 500);
    assert.match(response.body, /翻译失败|翻譯失敗|Translation unavailable/);
  } finally {
    global.fetch = originalFetch;
    console.warn = originalWarn;
    clearProjectModules();
  }
});

test('map refresh requests are rate limited even when callers force refresh', async () => {
  await withEnvOverrides(getNoProxyEnv(), async () => {
    clearProjectModules();
    const originalFetch = global.fetch;
    const mapDataService = require(path.join(projectRoot, 'app/services/mapDataService'));
    let fetchCount = 0;

    mapDataService.resetMapDataCache();
    global.fetch = async () => {
      fetchCount += 1;

      return {
        ok: true,
        async json() {
          return {
            avg_age: 19,
            last_synced: 1000 + fetchCount,
            statistics: [],
            data: []
          };
        }
      };
    };

    try {
      const app = loadApp({ DEBUG_MOD: 'false' });
      const responses = [];

      for (let index = 0; index < 4; index += 1) {
        responses.push(await requestApp(app, {
          path: '/api/map-data?refresh=1'
        }));
      }

      assert.deepEqual(
        responses.map((response) => response.statusCode),
        [200, 200, 200, 429]
      );
      assert.equal(fetchCount, 1);
    } finally {
      global.fetch = originalFetch;
      mapDataService.resetMapDataCache();
      clearProjectModules();
    }
  });
});

test('translation service bounds in-memory cache growth', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (_input, init = {}) => {
    const requestBody = typeof init.body === 'string' && init.body
      ? JSON.parse(init.body)
      : {};
    const sourceTexts = Array.isArray(requestBody.q) ? requestBody.q : [];

    return {
      ok: true,
      async json() {
        return {
          data: {
            translations: sourceTexts.map((sourceText) => ({
              translatedText: `EN:${sourceText}`
            }))
          }
        };
      }
    };
  };

  try {
    await withEnvOverrides(getGoogleTranslationTestEnv(), async () => {
      clearProjectModules();
      const {
        getTranslationCacheSize,
        resetTranslationCache,
        translateDetailItems,
        translationCacheMaxEntries
      } = require(path.join(projectRoot, 'app/services/textTranslationService'));

      resetTranslationCache();

      for (let index = 0; index < translationCacheMaxEntries + 25; index += 1) {
        await translateDetailItems({
          items: [{
            fieldKey: '0',
            text: `样本文本-${index}`
          }],
          targetLanguage: 'en'
        });
      }

      assert.equal(getTranslationCacheSize(), translationCacheMaxEntries);
      resetTranslationCache();
    });
  } finally {
    global.fetch = originalFetch;
    clearProjectModules();
  }
});

test('audit log uses Express-resolved client IP instead of raw forwarded headers', () => {
  clearProjectModules();
  const { getClientIp } = require(path.join(projectRoot, 'app/services/auditLogService'));

  assert.equal(getClientIp({
    headers: {
      'x-forwarded-for': '203.0.113.66'
    },
    ip: '127.0.0.1',
    socket: {
      remoteAddress: '127.0.0.1'
    }
  }), '127.0.0.1');
});
