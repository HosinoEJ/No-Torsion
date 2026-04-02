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

function requestPath(app, requestPath) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      const request = http.get({
        hostname: '127.0.0.1',
        port,
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
    });
  });
}

function installTranslationFetchStub(prefix = 'EN:') {
  const originalFetch = global.fetch;

  global.fetch = async (input) => {
    const requestUrl = input instanceof URL
      ? input
      : new URL(typeof input === 'string' ? input : input.url);
    const sourceText = requestUrl.searchParams.get('q') || '';

    return {
      ok: true,
      async json() {
        return [[[`${prefix}${sourceText}`, sourceText]]];
      }
    };
  };

  return () => {
    global.fetch = originalFetch;
  };
}

test('root page renders successfully', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const response = await requestPath(app, '/');

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /NO CONVERSION THERAPY/i);
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
  assert.match(response.body, /<loc>https:\/\/example\.com\/form<\/loc>/);
  assert.match(response.body, /<loc>https:\/\/example\.com\/map<\/loc>/);
  assert.match(response.body, /<loc>https:\/\/example\.com\/blog<\/loc>/);
  assert.match(response.body, /https:\/\/example\.com\/port\/%E9%97%9C%E6%96%BC%E5%BF%83%E7%A8%AE%E5%AD%90%E6%95%99%E8%82%B2%E9%81%95%E6%B3%95%E8%BE%A6%E5%AD%B8%E7%9A%84%E6%8E%A7%E5%91%8A/);
  assert.doesNotMatch(response.body, /\/debug<\/loc>/);
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
  assert.match(response.body, /^Disallow: \/submit$/m);
  assert.match(response.body, /^Disallow: \/debug$/m);
  assert.match(response.body, /^Sitemap: https:\/\/example\.com\/sitemap\.xml$/m);
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
  assert.match(response.body, /Debug/);
});

test('about page translates friend descriptions with google translation in english mode', async () => {
  const restoreFetch = installTranslationFetchStub();

  try {
    const app = loadApp({ DEBUG_MOD: 'false' });
    const response = await requestPath(app, '/aboutus?lang=en');

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /EN:一隻可愛的小藥娘的網站/);
    assert.match(response.body, /EN:一名独立调查人/);
    assert.match(response.body, /EN:一个不被喜欢的跨女/);
    assert.doesNotMatch(response.body, /<p class="friend-card__desc">The personal site of a very cute trans girl<\/p>/);
    assert.doesNotMatch(response.body, /<p class="friend-card__desc">An independent investigator<\/p>/);
  } finally {
    restoreFetch();
    clearProjectModules();
  }
});

test('translation service normalizes spaces around apostrophes in english text', async () => {
  clearProjectModules();
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    async json() {
      return [[["A cute little medicine girl ’ s website", "一隻可愛的小藥娘的網站"]]];
    }
  });

  try {
    const { translateDetailItems } = require(path.join(projectRoot, 'app/services/textTranslationService'));
    const [result] = await translateDetailItems({
      items: [{ fieldKey: '0', text: '一隻可愛的小藥娘的網站' }],
      targetLanguage: 'en'
    });

    assert.equal(result.translatedText, "A cute little medicine girl's website");
  } finally {
    global.fetch = originalFetch;
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
    const app = loadApp({ DEBUG_MOD: 'false' });
    const response = await requestPath(app, '/blog?lang=en');
    const originalTitle = '關於心種子教育違法辦學的控告';
    const translatedTitle = `EN:${originalTitle}`;

    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes(originalTitle));
    assert.ok(response.body.includes(translatedTitle));
    assert.ok(response.body.indexOf(originalTitle) < response.body.indexOf(translatedTitle));
  } finally {
    restoreFetch();
    clearProjectModules();
  }
});

test('blog article shows bilingual content when english language is selected', async () => {
  const restoreFetch = installTranslationFetchStub();

  try {
    const app = loadApp({ DEBUG_MOD: 'false' });
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
