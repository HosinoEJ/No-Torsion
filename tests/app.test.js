const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');

function clearProjectModules() {
  Object.keys(require.cache).forEach((modulePath) => {
    if (modulePath.startsWith(projectRoot)) {
      delete require.cache[modulePath];
    }
  });
}

function loadApp(envOverrides = {}) {
  const originalValues = Object.fromEntries(
    Object.keys(envOverrides).map((key) => [key, process.env[key]])
  );

  Object.entries(envOverrides).forEach(([key, value]) => {
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

function getGoogleTranslationTestEnv(overrides = {}) {
  return {
    GOOGLE_CLOUD_TRANSLATION_API_KEY: 'test-google-cloud-api-key',
    TRANSLATION_PROVIDER_TIMEOUT_MS: '10000',
    ...overrides
  };
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

function buildValidSubmissionBody(overrides = {}) {
  const basePayload = {
    identity: '受害者本人',
    birth_year: '2008',
    birth_month: '5',
    birth_day: '20',
    sex: '男',
    sex_other: '',
    provinceCode: '110000',
    cityCode: '110101',
    countyCode: '',
    school_name: '测试学校',
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

test('map page renders the record container and lazy-load sentinel', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const response = await requestPath(app, '/map');

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /id="data-container"/);
  assert.match(response.body, /id="data-container-sentinel"/);
  assert.match(response.body, /\/js\/map_record_stats\.js/);
  assert.match(response.body, /\/js\/map_backTop\.js/);
  assert.match(response.body, /\/js\/queryUpd\.js/);
  assert.match(response.body, /cdn\.jsdelivr\.net\/npm\/chart\.js/);
  assert.match(response.body, /sha256-p4NxAoJBhIIN\+hmNHrzRCf9tD\/miZyoHS5obTRR9BMY=/);
  assert.match(response.body, /sha256-20nQCchB9co0qIjJZRGuk2\/Z9VM\+kNiyxNV1lvTlZBo=/);
});

test('map page keeps an OSM-compatible referrer policy for tile requests', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const response = await requestPath(app, '/map');

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['referrer-policy'], 'strict-origin-when-cross-origin');
});

test('form page includes school name and address autocomplete hooks', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const response = await requestPath(app, '/form');

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /出生年月日/);
  assert.match(response.body, /name="birth_year"/);
  assert.match(response.body, /name="birth_month"/);
  assert.match(response.body, /name="birth_day"/);
  assert.match(response.body, /机构所在省份/);
  assert.match(response.body, /机构所在城市 \/ 区县/);
  assert.match(response.body, /机构所在县区（可选）/);
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
});

test('about page renders localized friend descriptions in english mode', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const response = await requestPath(app, '/aboutus?lang=en');

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /Founder, planning\/execution, and community building/);
  assert.match(response.body, /Community outreach and source material support/);
  assert.match(response.body, /Domain contributor/);
});

test('privacy page documents the language cookie and footer exposes the link', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const rootResponse = await requestPath(app, '/');
  const privacyResponse = await requestPath(app, '/privacy?lang=en');

  assert.equal(rootResponse.statusCode, 200);
  assert.match(rootResponse.body, /href="\/privacy"/);

  assert.equal(privacyResponse.statusCode, 200);
  assert.match(privacyResponse.body, /Privacy &amp; Cookie Notice|Privacy & Cookie Notice/);
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

    assert.equal(entries.length, 2);
    assert.equal(entries[0].lastmod, '2026-03-13T00:00:00.000Z');
    assert.equal(entries[1].lastmod, '2026-04-03T00:00:00.000Z');
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
    { name: '启明学校', province: '山东', addr: '地址 A', experience: '经历 1', scandal: '', else: '', HMaster: '甲', prov: '青岛', contact: '1' },
    { name: '启明学校', province: '山东', addr: '地址 A', experience: '经历 1', scandal: '', else: '', HMaster: '甲', prov: '青岛', contact: '1' },
    { name: '启明学校', province: '山东', addr: '地址 A', experience: '经历 2', scandal: '', else: '', HMaster: '甲', prov: '青岛', contact: '1' }
  ]);

  assert.equal(groupedRecords.length, 1);
  assert.equal(groupedRecords[0].pages.length, 2);
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
  assert.match(response.body, /测试学校/);
  assert.match(response.body, /entry\.842223433_year/);
  assert.match(response.body, /entry\.842223433_month/);
  assert.match(response.body, /entry\.842223433_day/);
  assert.match(response.body, />2008</);
  assert.match(response.body, />5</);
  assert.match(response.body, />20</);
  assert.doesNotMatch(response.body, /entry\.842223433<\/code>/);
  clearProjectModules();
});

test('submit route rejects invalid birth date combinations', async () => {
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
      birth_year: '2024',
      birth_month: '2',
      birth_day: '31',
      form_token: issueFormProtectionToken({
        secret: 'test-form-protection-secret',
        issuedAt: Date.now() - 5000
      })
    })
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body, /有效的出生年月日/);
  clearProjectModules();
});

test('submitToGoogleForm stops at redirect responses instead of following them', async () => {
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

test('map data service can bypass in-memory cache on force refresh', async () => {
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

test('map data service merges province statistics that differ only by script', async () => {
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

test('map data service accepts lowercase schoolNum from upstream payloads', async () => {
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

test('public map API keeps CORS enabled while translate API stays same-origin only', async () => {
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

test('public map API throttles repeated read scraping without disabling cross-origin reads', async () => {
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
