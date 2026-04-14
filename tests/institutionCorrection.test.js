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

function loadAppWithPatchedInstitutionCorrectionService(envOverrides = {}, patchers) {
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
  const formService = require(path.join(projectRoot, 'app/services/formService'));
  const restoreCallbacks = [];

  if (typeof patchers === 'function') {
    const restorePatch = patchers(institutionCorrectionService);
    if (typeof restorePatch === 'function') {
      restoreCallbacks.push(restorePatch);
    }
  } else if (patchers && typeof patchers === 'object') {
    if (typeof patchers.institutionCorrectionService === 'function') {
      const restoreInstitutionCorrectionPatch = patchers.institutionCorrectionService(institutionCorrectionService);
      if (typeof restoreInstitutionCorrectionPatch === 'function') {
        restoreCallbacks.push(restoreInstitutionCorrectionPatch);
      }
    }

    if (typeof patchers.formService === 'function') {
      const restoreFormServicePatch = patchers.formService(formService);
      if (typeof restoreFormServicePatch === 'function') {
        restoreCallbacks.push(restoreFormServicePatch);
      }
    }
  }

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
      restoreCallbacks.reverse().forEach((restorePatch) => restorePatch());
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

test('map page includes institution correction CTA in map record cards', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const response = await requestPath(app, '/map');

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /机构信息补充\/修正/);
  assert.match(response.body, /data-record-summary-correction-link="true"/);
  assert.match(response.body, /correctionSearchParams\.set\('school_name', schoolName\)/);

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
  assert.equal(response.headers['x-robots-tag'], undefined);
  assert.match(response.headers['cache-control'], /no-store/);
  assert.doesNotMatch(response.body, /<meta name="robots"/i);

  clearProjectModules();
});

test('institution correction page pre-fills school name from the map record card link', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const response = await requestPath(app, '/map/correction?lang=zh-CN&school_name=%E6%99%A8%E6%98%9F%E6%88%90%E9%95%BF%E4%B8%AD%E5%BF%83');

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /<input[^>]+name="school_name"[^>]+value="晨星成长中心"[^>]*required/);

  clearProjectModules();
});

test('correction alias renders the same page and uses the alias submit path', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const response = await requestPath(app, '/correction?lang=zh-CN&school_name=%E5%90%AF%E6%98%8E%E5%AD%A6%E9%99%A2');

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /机构信息补充 \/ 修正/);
  assert.match(response.body, /action="\/correction\/submit"/);
  assert.match(response.body, /<input[^>]+name="school_name"[^>]+value="启明学院"[^>]*required/);

  clearProjectModules();
});

test('robots.txt allows institution correction pages to be crawled', async () => {
  const app = loadApp({ DEBUG_MOD: 'false' });
  const response = await requestPath(app, '/robots.txt');

  assert.equal(response.statusCode, 200);
  assert.doesNotMatch(response.body, /^Disallow: \/map\/correction$/m);

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

test('institution correction submit can send to the configured Google Form target', async () => {
  const googleCalls = [];
  const { app, restore } = loadAppWithPatchedInstitutionCorrectionService(
    {
      DEBUG_MOD: 'false',
      FORM_PROTECTION_MIN_FILL_MS: '1',
      CORRECTION_SUBMIT_TARGET: 'google'
    },
    {
      institutionCorrectionService(institutionCorrectionService) {
        const originalSave = institutionCorrectionService.saveInstitutionCorrectionSubmission;

        institutionCorrectionService.saveInstitutionCorrectionSubmission = async () => {
          throw new Error('D1 should not be called for google-only correction submissions.');
        };

        return () => {
          institutionCorrectionService.saveInstitutionCorrectionSubmission = originalSave;
        };
      },
      formService(formService) {
        const originalSubmitToGoogleForm = formService.submitToGoogleForm;

        formService.submitToGoogleForm = async (url, payload) => {
          googleCalls.push({ url, payload });
        };

        return () => {
          formService.submitToGoogleForm = originalSubmitToGoogleForm;
        };
      }
    }
  );

  try {
    const response = await postUrlEncodedForm(app, '/correction/submit', {
      website: '',
      form_token: issueInstitutionCorrectionToken(),
      school_name: '晨星成长中心',
      provinceCode: '110000',
      cityCode: '110101',
      correction_content: '请补充最新地址和联系方式。'
    });
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(body, /补充 \/ 修正请求已收到/);
    assert.equal(googleCalls.length, 1);
    assert.match(googleCalls[0].url, /1FAIpQLSfiXdpt8CgOGZQhvsJTc1koQbvXFo6eWfnigQ329r1-3DniNA\/formResponse$/);
    assert.match(googleCalls[0].payload, /entry\.270706445=%E6%99%A8%E6%98%9F%E6%88%90%E9%95%BF%E4%B8%AD%E5%BF%83/);
    assert.match(googleCalls[0].payload, /entry\.1237975400=%E5%8C%97%E4%BA%AC%E5%B8%82/);
    assert.match(googleCalls[0].payload, /entry\.1335981183=%E4%B8%9C%E5%9F%8E%E5%8C%BA/);
    assert.match(googleCalls[0].payload, /entry\.302336209=%E8%AF%B7%E8%A1%A5%E5%85%85%E6%9C%80%E6%96%B0%E5%9C%B0%E5%9D%80%E5%92%8C%E8%81%94%E7%B3%BB%E6%96%B9%E5%BC%8F%E3%80%82/);
  } finally {
    restore();
    clearProjectModules();
  }
});

test('institution correction submit renders a fallback page when Google Form submission fails', async () => {
  const { app, restore } = loadAppWithPatchedInstitutionCorrectionService(
    {
      DEBUG_MOD: 'false',
      FORM_PROTECTION_MIN_FILL_MS: '1',
      CORRECTION_SUBMIT_TARGET: 'google'
    },
    {
      formService(formService) {
        const originalSubmitToGoogleForm = formService.submitToGoogleForm;

        formService.submitToGoogleForm = async () => {
          throw new Error('Google correction submit is unavailable.');
        };

        return () => {
          formService.submitToGoogleForm = originalSubmitToGoogleForm;
        };
      }
    }
  );

  try {
    const response = await postUrlEncodedForm(app, '/map/correction/submit', {
      website: '',
      form_token: issueInstitutionCorrectionToken(),
      school_name: '启明学院',
      correction_content: '请修正机构地图坐标。'
    });
    const body = await response.text();

    assert.equal(response.status, 500);
    assert.match(body, /补充 \/ 修正提交失败/);
    assert.match(body, /Google Form 继续提交/);
    assert.match(body, /viewform\?usp=pp_url&amp;entry\.270706445=%E5%90%AF%E6%98%8E%E5%AD%A6%E9%99%A2/);
    assert.match(body, /entry\.302336209=%E8%AF%B7%E4%BF%AE%E6%AD%A3%E6%9C%BA%E6%9E%84%E5%9C%B0%E5%9B%BE%E5%9D%90%E6%A0%87%E3%80%82/);
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
  assert.match(body, /补充 \/ 修正提交失败/);
  assert.match(body, /机构信息补充 \/ 修正功能暂时不可用/);
  assert.match(body, /返回补充 \/ 修正表单/);

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

      if (/PRAGMA table_info/i.test(sql)) {
        return {
          async all() {
            return {
              results: [
                'id',
                'school_name',
                'province_code',
                'province_name',
                'city_code',
                'city_name',
                'county_code',
                'county_name',
                'school_address',
                'contact_information',
                'headmaster_name',
                'correction_content',
                'status',
                'lang',
                'source_path',
                'client_ip_hash',
                'user_agent',
                'created_at'
              ].map((name) => ({ name }))
            };
          }
        };
      }

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

test('institution correction storage backfills missing D1 columns before insert', async () => {
  clearProjectModules();

  const runtimeContext = require(path.join(projectRoot, 'app/services/runtimeContext'));
  const {
    saveInstitutionCorrectionSubmission,
    validateInstitutionCorrectionSubmission
  } = require(path.join(projectRoot, 'app/services/institutionCorrectionService'));
  const { translate } = require(path.join(projectRoot, 'config/i18n'));

  const columns = new Set([
    'id',
    'school_name',
    'province_code',
    'province_name'
  ]);
  const calls = [];
  const fakeDb = {
    async exec(sql) {
      calls.push({ type: 'exec', sql });

      const alterMatch = String(sql).match(/ADD COLUMN\s+([a-z_]+)/i);
      if (alterMatch) {
        columns.add(alterMatch[1]);
      }

      return { count: 0 };
    },
    prepare(sql) {
      calls.push({ type: 'prepare', sql });

      if (/PRAGMA table_info/i.test(sql)) {
        return {
          async all() {
            return {
              results: Array.from(columns).map((name) => ({ name }))
            };
          }
        };
      }

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
    school_name: '晨光学校'
  }, (key, variables) => translate('zh-CN', key, variables));

  assert.deepEqual(errors, []);

  await runtimeContext.runWithRuntimeContext({ env: { DB: fakeDb } }, async () => {
    await saveInstitutionCorrectionSubmission({
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
        ip: '203.0.113.9'
      },
      values
    });
  });

  assert.ok(calls.some((entry) => entry.type === 'prepare' && /PRAGMA table_info/i.test(entry.sql)));
  assert.ok(calls.some((entry) => entry.type === 'exec' && /ADD COLUMN city_code/i.test(entry.sql)));
  assert.ok(calls.some((entry) => entry.type === 'exec' && /ADD COLUMN created_at/i.test(entry.sql)));
  assert.ok(calls.some((entry) => entry.type === 'run'));

  clearProjectModules();
});

test('institution correction storage falls back to prepare().run() when D1 exec fails', async () => {
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
      throw new Error('exec is not supported in this runtime');
    },
    prepare(sql) {
      calls.push({ type: 'prepare', sql });

      if (/PRAGMA table_info/i.test(sql)) {
        return {
          async all() {
            return {
              results: [
                'id',
                'school_name',
                'province_code',
                'province_name',
                'city_code',
                'city_name',
                'county_code',
                'county_name',
                'school_address',
                'contact_information',
                'headmaster_name',
                'correction_content',
                'status',
                'lang',
                'source_path',
                'client_ip_hash',
                'user_agent',
                'created_at'
              ].map((name) => ({ name }))
            };
          }
        };
      }

      if (/CREATE TABLE/i.test(sql) || /ALTER TABLE/i.test(sql)) {
        return {
          async run() {
            calls.push({ type: 'schema-run', sql });
            return { success: true };
          }
        };
      }

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
    school_name: '回退测试机构'
  }, (key, variables) => translate('zh-CN', key, variables));

  assert.deepEqual(errors, []);

  await runtimeContext.runWithRuntimeContext({ env: { DB: fakeDb } }, async () => {
    await saveInstitutionCorrectionSubmission({
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
        ip: '203.0.113.12'
      },
      values
    });
  });

  assert.ok(calls.some((entry) => entry.type === 'exec' && /CREATE TABLE IF NOT EXISTS institution_correction_submissions/i.test(entry.sql)));
  assert.ok(calls.some((entry) => entry.type === 'schema-run' && /CREATE TABLE IF NOT EXISTS institution_correction_submissions/i.test(entry.sql)));
  assert.ok(calls.some((entry) => entry.type === 'run'));

  clearProjectModules();
});
