const assert = require('node:assert/strict');
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

function withEnvOverrides(envOverrides, callback) {
  const originalValues = Object.fromEntries(
    Object.keys(envOverrides).map((key) => [key, process.env[key]])
  );

  Object.entries(envOverrides).forEach(([key, value]) => {
    if (typeof value === 'undefined') {
      delete process.env[key];
      return;
    }

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

function loadAppConfig(envOverrides = {}) {
  return withEnvOverrides(envOverrides, () => {
    clearProjectModules();
    return require(path.join(projectRoot, 'config/appConfig'));
  });
}

test('protected config values round-trip with purpose-scoped encryption', () => {
  clearProjectModules();
  const {
    createRandomSecret,
    decryptProtectedValue,
    encryptProtectedValue
  } = require(path.join(projectRoot, 'config/protectedConfig'));

  const secret = createRandomSecret();
  const encryptedFormId = encryptProtectedValue('form-123', secret, 'form-id');
  const encryptedScriptUrl = encryptProtectedValue('https://script.example/run', secret, 'google-script-url');

  assert.notEqual(encryptedFormId, 'form-123');
  assert.notEqual(encryptedScriptUrl, 'https://script.example/run');
  assert.equal(decryptProtectedValue(encryptedFormId, secret, 'form-id'), 'form-123');
  assert.equal(
    decryptProtectedValue(encryptedScriptUrl, secret, 'google-script-url'),
    'https://script.example/run'
  );
  assert.throws(
    () => decryptProtectedValue(encryptedFormId, secret, 'google-script-url'),
    /unable to authenticate data|Unsupported state or unable to authenticate data/
  );
});

test('app config resolves encrypted FORM_ID and GOOGLE_SCRIPT_URL with explicit secret', () => {
  clearProjectModules();
  const {
    createRandomSecret,
    encryptProtectedValue
  } = require(path.join(projectRoot, 'config/protectedConfig'));

  const secret = createRandomSecret();
  const formId = 'encrypted-form-id';
  const googleScriptUrl = 'https://script.google.com/macros/s/example/exec';
  const config = loadAppConfig({
    FORM_PROTECTION_SECRET: secret,
    FORM_ID: '',
    FORM_ID_ENCRYPTED: encryptProtectedValue(formId, secret, 'form-id'),
    GOOGLE_SCRIPT_URL: '',
    GOOGLE_SCRIPT_URL_ENCRYPTED: encryptProtectedValue(googleScriptUrl, secret, 'google-script-url')
  });

  assert.equal(config.formId, formId);
  assert.equal(config.googleFormUrl, `https://docs.google.com/forms/d/e/${formId}/formResponse`);
  assert.equal(config.googleScriptUrl, googleScriptUrl);
});

test('app config rejects encrypted values when FORM_PROTECTION_SECRET is not explicitly configured', () => {
  clearProjectModules();
  const {
    createRandomSecret,
    encryptProtectedValue
  } = require(path.join(projectRoot, 'config/protectedConfig'));
  const secret = createRandomSecret();
  const encryptedFormId = encryptProtectedValue('form-123', secret, 'form-id');

  assert.throws(
    () => loadAppConfig({
      FORM_PROTECTION_SECRET: '',
      FORM_ID: '',
      FORM_ID_ENCRYPTED: encryptedFormId
    }),
    /必須顯式配置 FORM_PROTECTION_SECRET/
  );
});

test('app config no longer ships with a built-in default FORM_ID', () => {
  const config = loadAppConfig({
    FORM_PROTECTION_SECRET: '',
    FORM_ID: '',
    FORM_ID_ENCRYPTED: '',
    GOOGLE_SCRIPT_URL: '',
    GOOGLE_SCRIPT_URL_ENCRYPTED: ''
  });

  assert.equal(config.formId, '');
  assert.equal(config.googleFormUrl, '');
});
