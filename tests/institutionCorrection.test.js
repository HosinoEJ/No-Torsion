const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  clearProjectModules,
  loadApp,
  projectRoot,
  requestPath,
  startServer
} = require('./helpers/appHarness');

function loadAppWithPatchedInstitutionCorrectionService(envOverrides = {}, patchInstitutionCorrectionService) {
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
  const institutionCorrectionService = require(path.join(projectRoot, 'app/services/institutionCorrectionService'));
  const restorePatch = typeof patchInstitutionCorrectionService === 'function'
    ? patchInstitutionCorrectionService(institutionCorrectionService)
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

function issueInstitutionCorrectionToken(issuedAt = Date.now() - 5000) {
  const { formProtectionSecret } = require(path.join(projectRoot, 'config/appConfig'));
  const { issueFormProtectionToken } = require(path.join(projectRoot, 'app/services/formProtectionService'));

  return issueFormProtectionToken({
    secret: formProtectionSecret,
    issuedAt
  });
}

async function postUrlEncodedForm(app, requestPathname, fields) {
  const { baseUrl, close } = await startServer(app);

  try {
    return await fetch(`${baseUrl}${requestPathname}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(fields)
    });
  } finally {
    await close();
  }
}

test('map page includes institution correction CTA in the API card', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const response = await requestPath(app, '/map');

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /机构信息补充\/修正/);
  assert.match(response.body, /href="\/map\/correction\?lang=zh-CN"/);

  clearProjectModules();
});

test('institution correction page renders a dedicated form and keeps only school name required', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const response = await requestPath(app, '/map/correction');

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /机构信息补充 \/ 修正/);
  assert.match(response.body, /补充修正内容/);
  assert.match(response.body, /id="openMapButton"/);
  assert.match(response.body, /id="getCurrentLocationButton"/);
  assert.match(response.body, /id="locationStatus"/);
  assert.match(response.body, /<input[^>]+name="school_name"[^>]*required/);
  assert.doesNotMatch(response.body, /<select[^>]+name="provinceCode"[^>]*required/);
  assert.doesNotMatch(response.body, /<select[^>]+name="cityCode"[^>]*required/);
  assert.doesNotMatch(response.body, /<input[^>]+name="contact_information"[^>]*required/);
  assert.equal(response.headers['x-robots-tag'], 'noindex, nofollow, noarchive, nosnippet');
  assert.match(response.headers['cache-control'], /no-store/);

  clearProjectModules();
});

test('robots.txt blocks institution correction pages from indexing', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const response = await requestPath(app, '/robots.txt');

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /^Disallow: \/map\/correction$/m);

  clearProjectModules();
});

test('institution correction submit accepts school name only and renders success page', async () => {
  const capturedValues = [];
  const { app, restore } = loadAppWithPatchedInstitutionCorrectionService(
    {
      DEBUG_MOD: 'false',
      FORM_PROTECTION_MIN_FILL_MS: '1'
    },
    (institutionCorrectionService) => {
      const originalSave = institutionCorrectionService.saveInstitutionCorrectionSubmission;

      institutionCorrectionService.saveInstitutionCorrectionSubmission = async ({ values }) => {
        capturedValues.push(values);
        return {
          bindingName: 'DB',
          submissionId: 'test-submission-id'
        };
      };

      return () => {
        institutionCorrectionService.saveInstitutionCorrectionSubmission = originalSave;
      };
    }
  );

  try {
    const response = await postUrlEncodedForm(app, '/map/correction/submit', {
      website: '',
      form_token: issueInstitutionCorrectionToken(),
      school_name: '晨星成长中心'
    });
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(body, /补充 \/ 修正请求已收到/);
    assert.equal(capturedValues.length, 1);
    assert.equal(capturedValues[0].schoolName, '晨星成长中心');
    assert.equal(capturedValues[0].province, '');
    assert.equal(capturedValues[0].city, '');
    assert.equal(capturedValues[0].county, '');
    assert.equal(capturedValues[0].schoolAddress, '');
    assert.equal(capturedValues[0].contactInformation, '');
    assert.equal(capturedValues[0].headmasterName, '');
    assert.equal(capturedValues[0].correctionContent, '');
  } finally {
    restore();
    clearProjectModules();
  }
});

test('institution correction submit returns 503 when D1 storage is unavailable', async () => {
  const app = loadApp({
    DEBUG_MOD: 'false',
    FORM_PROTECTION_MIN_FILL_MS: '1'
  });
  const response = await postUrlEncodedForm(app, '/map/correction/submit', {
    website: '',
    form_token: issueInstitutionCorrectionToken(),
    school_name: '北辰培训学校'
  });
  const body = await response.text();

  assert.equal(response.status, 503);
  assert.match(body, /机构信息补充 \/ 修正功能暂时不可用/);

  clearProjectModules();
});

test('institution correction storage initializes schema and writes to a D1 binding', async () => {
  clearProjectModules();

  const runtimeContext = require(path.join(projectRoot, 'app/services/runtimeContext'));
  const {
    saveInstitutionCorrectionSubmission,
    validateInstitutionCorrectionSubmission
  } = require(path.join(projectRoot, 'app/services/institutionCorrectionService'));
  const { translate } = require(path.join(projectRoot, 'config/i18n'));

  const calls = [];
  const fakeDb = {
    async exec(sql) {
      calls.push({ type: 'exec', sql });
      return { count: 0 };
    },
    prepare(sql) {
      calls.push({ type: 'prepare', sql });

      return {
        bind(...params) {
          calls.push({ type: 'bind', params });

          return {
            async run() {
              calls.push({ type: 'run' });
              return { success: true };
            }
          };
        }
      };
    }
  };

  const { errors, values } = validateInstitutionCorrectionSubmission({
    school_name: '启明学院',
    provinceCode: '110000',
    cityCode: '110101',
    school_address: '北京市东城区示例路 10 号',
    contact_information: '010-12345678',
    headmaster_name: '李老师',
    correction_content: '请补充最新地址与联系电话。'
  }, (key, variables) => translate('zh-CN', key, variables));

  assert.deepEqual(errors, []);

  await runtimeContext.runWithRuntimeContext({ env: { DB: fakeDb } }, async () => {
    const result = await saveInstitutionCorrectionSubmission({
      req: {
        lang: 'zh-CN',
        originalUrl: '/map/correction/submit',
        path: '/map/correction/submit',
        headers: {
          'user-agent': 'node-test'
        },
        get(name) {
          return this.headers[String(name || '').toLowerCase()] || '';
        },
        ip: '203.0.113.8'
      },
      values
    });

    assert.equal(result.bindingName, 'DB');
    assert.match(result.submissionId, /^[0-9a-f-]{36}$/i);
  });

  assert.match(calls[0].sql, /CREATE TABLE IF NOT EXISTS institution_correction_submissions/);
  const bindCall = calls.find((entry) => entry.type === 'bind');
  assert.ok(bindCall);
  assert.equal(bindCall.params[1], '启明学院');
  assert.equal(bindCall.params[3], '北京市');
  assert.equal(bindCall.params[5], '东城区');
  assert.equal(bindCall.params[8], '北京市东城区示例路 10 号');
  assert.equal(bindCall.params[9], '010-12345678');
  assert.equal(bindCall.params[10], '李老师');
  assert.equal(bindCall.params[11], '请补充最新地址与联系电话。');
  assert.equal(bindCall.params[12], 'pending');
  assert.equal(bindCall.params[13], 'zh-CN');
  assert.equal(bindCall.params[14], '/map/correction/submit');
  assert.match(bindCall.params[15], /^[0-9a-f]{64}$/i);
  assert.equal(bindCall.params[16], 'node-test');

  clearProjectModules();
});
