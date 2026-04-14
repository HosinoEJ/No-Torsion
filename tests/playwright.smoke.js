const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('playwright');

const { paths } = require('../config/fileConfig');
const {
  clearProjectModules,
  loadApp,
  loadAppWithPatchedFormService,
  projectRoot,
  startServer
} = require('./helpers/appHarness');

const SCREENSHOT_DIR = path.join(projectRoot, 'test-results', 'playwright-smoke');
const MANIFEST_PATH = path.join(SCREENSHOT_DIR, 'manifest.json');
const VIEWPORT = { width: 1440, height: 1200 };
const NAVIGATION_TIMEOUT_MS = 30000;
const POST_SUBMIT_SETTLE_MS = 350;
const MOCK_MAP_PAYLOAD = {
  source: 'playwright-smoke',
  isSourceFallback: false,
  preferredSource: 'google-script',
  last_synced: 1775565960000,
  avg_age: 17.4,
  schoolNum: 2,
  statistics: [
    { province: '110000', count: 2 }
  ],
  statisticsForm: [
    { province: '110000', count: 1 },
    { province: '310000', count: 1 }
  ],
  data: [
    {
      name: 'Playwright 测试机构',
      province: '110000',
      prov: '东城区',
      county: '',
      addr: '北京市东城区测试路 1 号',
      experience: '这是用于页面冒烟截图的测试经历。',
      scandal: '这是用于页面冒烟截图的测试丑闻说明。',
      else: '这是用于页面冒烟截图的其他说明。',
      contact: 'smoke@example.com',
      HMaster: '测试负责人',
      inputType: '受害者本人',
      dateStart: '2024-01-01',
      dateEnd: '',
      lat: 39.9042,
      lng: 116.4074
    },
    {
      name: 'Playwright 第二测试机构',
      province: '310000',
      prov: '浦东新区',
      county: '',
      addr: '上海市浦东新区测试路 2 号',
      experience: '另一条记录用于校验列表与图表。',
      scandal: '',
      else: '',
      contact: 'second@example.com',
      HMaster: '第二测试负责人',
      inputType: '受害者的代理人',
      dateStart: '2024-02-01',
      dateEnd: '2024-03-01',
      lat: 31.2304,
      lng: 121.4737
    }
  ]
};

function ensureScreenshotDirectory() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function sanitizeFileName(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'page';
}

function getFirstBlogArticleRoute() {
  const articleFileName = fs.readdirSync(paths.blog)
    .filter((fileName) => fileName.endsWith('.md'))
    .sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'))[0];

  assert.ok(articleFileName, 'Expected at least one markdown article for smoke testing');
  return `/port/${encodeURIComponent(articleFileName.replace(/\.md$/i, ''))}`;
}

function buildScreenshotPath(fileName) {
  return path.join(SCREENSHOT_DIR, `${sanitizeFileName(fileName)}.png`);
}

async function createSmokeContext(browser, baseUrl) {
  const context = await browser.newContext({
    colorScheme: 'light',
    viewport: VIEWPORT
  });

  await context.route(`${baseUrl}/api/map-data**`, async (route) => {
    await route.fulfill({
      contentType: 'application/json; charset=utf-8',
      status: 200,
      body: JSON.stringify(MOCK_MAP_PAYLOAD)
    });
  });

  return context;
}

function attachPageDiagnostics(page, baseUrl) {
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];

  page.on('console', (message) => {
    if (message.type() !== 'error') {
      return;
    }

    const location = message.location();
    const sourceUrl = typeof location.url === 'string' ? location.url : '';
    if (sourceUrl && !sourceUrl.startsWith(baseUrl)) {
      return;
    }

    consoleErrors.push(message.text());
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error && error.stack ? error.stack : String(error));
  });

  page.on('requestfailed', (request) => {
    if (!request.url().startsWith(baseUrl)) {
      return;
    }

    requestFailures.push(`${request.method()} ${request.url()} :: ${request.failure() && request.failure().errorText}`);
  });

  return {
    assertClean(pageLabel) {
      assert.deepEqual(pageErrors, [], `${pageLabel} triggered uncaught page errors:\n${pageErrors.join('\n\n')}`);
      assert.deepEqual(consoleErrors, [], `${pageLabel} logged console.error messages:\n${consoleErrors.join('\n\n')}`);
      assert.deepEqual(requestFailures, [], `${pageLabel} had failed same-origin requests:\n${requestFailures.join('\n\n')}`);
    }
  };
}

async function disableAnimations(page) {
  await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation: none !important;
        transition: none !important;
        scroll-behavior: auto !important;
        caret-color: transparent !important;
      }
    `
  });
}

async function capturePageScreenshot({
  baseUrl,
  browser,
  expectStatus = 200,
  fileName,
  pathName,
  ready,
  manifestEntries
}) {
  const context = await createSmokeContext(browser, baseUrl);
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, baseUrl);

  try {
    const response = await page.goto(`${baseUrl}${pathName}`, {
      timeout: NAVIGATION_TIMEOUT_MS,
      waitUntil: 'domcontentloaded'
    });

    assert.ok(response, `Expected navigation response for ${pathName}`);
    assert.equal(response.status(), expectStatus, `Expected ${pathName} to return HTTP ${expectStatus}`);

    if (typeof ready === 'function') {
      await ready(page);
    }

    await disableAnimations(page);
    await page.waitForTimeout(POST_SUBMIT_SETTLE_MS);

    const screenshotPath = buildScreenshotPath(fileName);
    await page.screenshot({
      fullPage: true,
      path: screenshotPath
    });

    diagnostics.assertClean(pathName);
    manifestEntries.push({
      page: pathName,
      screenshot: path.relative(projectRoot, screenshotPath),
      status: response.status()
    });
  } finally {
    await context.close();
  }
}

async function fillRequiredFormFields(page) {
  await page.selectOption('#identitySelect', '受害者本人');
  await page.selectOption('#birthYearSelect', '2008');
  await page.selectOption('#sexSelect', '男性');
  await page.fill('#date_start', '2024-01-01');
  await page.fill('#school_input', 'Playwright 测试机构');
  await page.selectOption('#provinceSelect', '110000');
  await page.waitForFunction(() => {
    const citySelect = document.getElementById('citySelect');
    return citySelect && !citySelect.disabled && citySelect.options.length > 1;
  }, null, {
    timeout: NAVIGATION_TIMEOUT_MS
  });
  await page.selectOption('#citySelect', '110101');
  await page.fill('#addr', '北京市东城区测试路 1 号');
  await page.fill('#contactInformationInput', 'playwright-smoke@example.com');
}

async function captureFormFlowScreenshots({
  baseUrl,
  browser,
  expectedPreviewSelector,
  fileName,
  manifestEntries,
  confirmAfterPreview = false
}) {
  const context = await createSmokeContext(browser, baseUrl);
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page, baseUrl);

  try {
    const response = await page.goto(`${baseUrl}/form`, {
      timeout: NAVIGATION_TIMEOUT_MS,
      waitUntil: 'domcontentloaded'
    });

    assert.ok(response, 'Expected form navigation response');
    assert.equal(response.status(), 200);

    await page.waitForSelector('#mainForm', { timeout: NAVIGATION_TIMEOUT_MS });
    await page.waitForFunction(() => document.querySelectorAll('#provinceSelect option').length > 1, null, {
      timeout: NAVIGATION_TIMEOUT_MS
    });
    await fillRequiredFormFields(page);
    await page.locator('button[type="submit"]').click();
    await page.waitForSelector(expectedPreviewSelector, { timeout: NAVIGATION_TIMEOUT_MS });
    await disableAnimations(page);
    await page.waitForTimeout(POST_SUBMIT_SETTLE_MS);

    const previewScreenshotPath = buildScreenshotPath(fileName);
    await page.screenshot({
      fullPage: true,
      path: previewScreenshotPath
    });
    manifestEntries.push({
      page: confirmAfterPreview ? '/submit-confirm' : '/submit-preview',
      screenshot: path.relative(projectRoot, previewScreenshotPath),
      status: 200
    });

    if (confirmAfterPreview) {
      await page.locator('#confirmSubmitButton').click();
      await page.waitForSelector('.submit-page', { timeout: NAVIGATION_TIMEOUT_MS });
      await disableAnimations(page);
      await page.waitForTimeout(POST_SUBMIT_SETTLE_MS);

      const successScreenshotPath = buildScreenshotPath('submit-success');
      await page.screenshot({
        fullPage: true,
        path: successScreenshotPath
      });
      manifestEntries.push({
        page: '/submit',
        screenshot: path.relative(projectRoot, successScreenshotPath),
        status: 200
      });
    }

    diagnostics.assertClean(confirmAfterPreview ? '/submit-confirm-flow' : '/submit-preview-flow');
  } finally {
    await context.close();
  }
}

async function withStartedApp(options, callback) {
  const {
    envOverrides = {},
    patchFormService = null
  } = options || {};

  const loaded = patchFormService
    ? loadAppWithPatchedFormService(envOverrides, patchFormService)
    : { app: loadApp(envOverrides), restore: () => {} };
  const runningServer = await startServer(loaded.app);

  try {
    return await callback(runningServer.baseUrl);
  } finally {
    await runningServer.close();
    loaded.restore();
    clearProjectModules();
  }
}

test('playwright smoke screenshots cover page routes and submission flows', async (t) => {
  ensureScreenshotDirectory();

  let browser;

  try {
    browser = await chromium.launch({
      headless: true
    });
  } catch (error) {
    const extraHint = String(error && error.message || '').includes('libglib-2.0.so.0')
      ? '\n检测到当前 Linux 环境缺少 Chromium 运行库，请先补齐系统依赖，或在支持 Playwright 依赖的容器/CI 镜像里执行。'
      : '';
    throw new Error(
      `Playwright Chromium 启动失败，请先运行 \`npm run playwright:install\`。${extraHint}\n原始错误: ${error.message}`
    );
  }

  const manifestEntries = [];

  try {
    await t.test('public routes render and capture screenshots', async () => {
      await withStartedApp({
        envOverrides: {
          DEBUG_MOD: 'false'
        }
      }, async (baseUrl) => {
        const articleRoute = getFirstBlogArticleRoute();

        await capturePageScreenshot({
          baseUrl,
          browser,
          fileName: 'home',
          pathName: '/',
          ready: async (page) => {
            await page.waitForSelector('.hero', { timeout: NAVIGATION_TIMEOUT_MS });
          },
          manifestEntries
        });

        await capturePageScreenshot({
          baseUrl,
          browser,
          fileName: 'form',
          pathName: '/form',
          ready: async (page) => {
            await page.waitForSelector('#mainForm', { timeout: NAVIGATION_TIMEOUT_MS });
            await page.waitForFunction(() => document.querySelectorAll('#provinceSelect option').length > 1, null, {
              timeout: NAVIGATION_TIMEOUT_MS
            });
          },
          manifestEntries
        });

        await capturePageScreenshot({
          baseUrl,
          browser,
          fileName: 'map',
          pathName: '/map',
          ready: async (page) => {
            await page.waitForSelector('#map', { timeout: NAVIGATION_TIMEOUT_MS });
            await page.waitForFunction(() => {
              const container = document.getElementById('data-container');
              return container && container.children.length > 0;
            }, null, {
              timeout: NAVIGATION_TIMEOUT_MS
            });
          },
          manifestEntries
        });

        await capturePageScreenshot({
          baseUrl,
          browser,
          fileName: 'about',
          pathName: '/aboutus',
          ready: async (page) => {
            await page.waitForSelector('.friend-card', { timeout: NAVIGATION_TIMEOUT_MS });
          },
          manifestEntries
        });

        await capturePageScreenshot({
          baseUrl,
          browser,
          fileName: 'privacy',
          pathName: '/privacy',
          ready: async (page) => {
            await page.waitForSelector('.privacy-section', { timeout: NAVIGATION_TIMEOUT_MS });
          },
          manifestEntries
        });

        await capturePageScreenshot({
          baseUrl,
          browser,
          fileName: 'blog-list',
          pathName: '/blog',
          ready: async (page) => {
            await page.waitForSelector('.blog-list', { timeout: NAVIGATION_TIMEOUT_MS });
          },
          manifestEntries
        });

        await capturePageScreenshot({
          baseUrl,
          browser,
          fileName: 'blog-article',
          pathName: articleRoute,
          ready: async (page) => {
            await page.waitForSelector('.blog-article .port', { timeout: NAVIGATION_TIMEOUT_MS });
          },
          manifestEntries
        });
      });
    });

    await t.test('debug routes render and capture screenshots', async () => {
      await withStartedApp({
        envOverrides: {
          DEBUG_MOD: 'true'
        }
      }, async (baseUrl) => {
        await capturePageScreenshot({
          baseUrl,
          browser,
          fileName: 'debug',
          pathName: '/debug',
          ready: async (page) => {
            await page.waitForSelector('.debug-card', { timeout: NAVIGATION_TIMEOUT_MS });
          },
          manifestEntries
        });

        await capturePageScreenshot({
          baseUrl,
          browser,
          fileName: 'submit-error',
          pathName: '/debug/submit-error',
          ready: async (page) => {
            await page.waitForSelector('.submit-error-card', { timeout: NAVIGATION_TIMEOUT_MS });
          },
          manifestEntries
        });

        await capturePageScreenshot({
          baseUrl,
          browser,
          fileName: 'submit-preview-debug',
          pathName: '/debug/submit-preview',
          ready: async (page) => {
            await page.waitForSelector('.preview-container', { timeout: NAVIGATION_TIMEOUT_MS });
          },
          manifestEntries
        });

        await capturePageScreenshot({
          baseUrl,
          browser,
          fileName: 'submit-confirm-debug',
          pathName: '/debug/submit-confirm',
          ready: async (page) => {
            await page.waitForSelector('.confirm-container', { timeout: NAVIGATION_TIMEOUT_MS });
          },
          manifestEntries
        });

        await capturePageScreenshot({
          baseUrl,
          browser,
          fileName: 'correction-submit-success-debug',
          pathName: '/debug/correction-submit-success',
          ready: async (page) => {
            await page.waitForSelector('.submit-page .hero', { timeout: NAVIGATION_TIMEOUT_MS });
          },
          manifestEntries
        });

        await capturePageScreenshot({
          baseUrl,
          browser,
          fileName: 'correction-submit-error-debug',
          pathName: '/debug/correction-submit-error',
          ready: async (page) => {
            await page.waitForSelector('.submit-error-card', { timeout: NAVIGATION_TIMEOUT_MS });
          },
          manifestEntries
        });
      });
    });

    await t.test('maintenance route renders and captures screenshot', async () => {
      await withStartedApp({
        envOverrides: {
          DEBUG_MOD: 'false',
          MAINTENANCE_MODE: 'true',
          MAINTENANCE_NOTICE: '站点正在执行 Playwright 冒烟巡检。'
        }
      }, async (baseUrl) => {
        await capturePageScreenshot({
          baseUrl,
          browser,
          expectStatus: 503,
          fileName: 'maintenance',
          pathName: '/',
          ready: async (page) => {
            await page.waitForSelector('.glass-card', { timeout: NAVIGATION_TIMEOUT_MS });
          },
          manifestEntries
        });
      });
    });

    await t.test('dry-run form preview renders and captures screenshot', async () => {
      await withStartedApp({
        envOverrides: {
          DEBUG_MOD: 'false',
          FORM_DRY_RUN: 'true',
          FORM_PROTECTION_MIN_FILL_MS: '1'
        }
      }, async (baseUrl) => {
        await captureFormFlowScreenshots({
          baseUrl,
          browser,
          expectedPreviewSelector: '.preview-container',
          fileName: 'submit-preview',
          manifestEntries
        });
      });
    });

    await t.test('confirmation and success flow render and capture screenshots', async () => {
      await withStartedApp({
        envOverrides: {
          DEBUG_MOD: 'false',
          FORM_DRY_RUN: 'false',
          FORM_PROTECTION_MIN_FILL_MS: '1'
        },
        patchFormService(formService) {
          const originalSubmitToGoogleForm = formService.submitToGoogleForm;
          formService.submitToGoogleForm = async () => {};

          return () => {
            formService.submitToGoogleForm = originalSubmitToGoogleForm;
          };
        }
      }, async (baseUrl) => {
        await captureFormFlowScreenshots({
          baseUrl,
          browser,
          expectedPreviewSelector: '.confirm-container',
          fileName: 'submit-confirm',
          manifestEntries,
          confirmAfterPreview: true
        });
      });
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifestEntries, null, 2), 'utf8');
  assert.ok(manifestEntries.length >= 12, 'Expected smoke suite to capture screenshots for all target pages');
});
