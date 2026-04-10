#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const {
  createRandomSecret,
  decryptProtectedValue,
  encryptProtectedValue
} = require('../config/protectedConfig');

// 这个脚本是“配置搬运工具”：
// 把明文 FORM_ID / GOOGLE_SCRIPT_URL 转成可放进普通变量栏位的密文值。
const PURPOSES = new Map([
  ['form-id', 'FORM_ID_ENCRYPTED'],
  ['google-script-url', 'GOOGLE_SCRIPT_URL_ENCRYPTED']
]);

function printUsage() {
  console.log(`Usage:
  node scripts/secure-config.js generate-secret
  node scripts/secure-config.js bootstrap --form-id <FORM_ID> --google-script-url <GOOGLE_SCRIPT_URL> [--secret <FORM_PROTECTION_SECRET>]
  node scripts/secure-config.js bootstrap-env [--env-file <path>] [--secret <FORM_PROTECTION_SECRET>]
  node scripts/secure-config.js encrypt --purpose <form-id|google-script-url> --secret <FORM_PROTECTION_SECRET> --value <plaintext>
  node scripts/secure-config.js decrypt --purpose <form-id|google-script-url> --secret <FORM_PROTECTION_SECRET> --value <ciphertext>
`);
}

function parseArgs(argv) {
  const result = Object.create(null);

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      throw new Error(`無法識別的參數：${token}`);
    }

    const key = token.slice(2);
    const nextValue = argv[index + 1];

    if (!nextValue || nextValue.startsWith('--')) {
      throw new Error(`參數 ${token} 缺少值`);
    }

    result[key] = nextValue;
    index += 1;
  }

  return result;
}

function ensurePurpose(value) {
  const normalizedValue = String(value || '').trim();

  if (!PURPOSES.has(normalizedValue)) {
    throw new Error(`不支持的 purpose：${normalizedValue || '(empty)'}`);
  }

  return normalizedValue;
}

function ensureRequiredText(value, label) {
  const normalizedValue = String(value || '').trim();

  if (!normalizedValue) {
    throw new Error(`${label} 不能為空`);
  }

  return normalizedValue;
}

function readTrimmedText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveEnvFilePath(envFile) {
  const normalizedPath = readTrimmedText(envFile);
  return normalizedPath ? path.resolve(process.cwd(), normalizedPath) : path.resolve(process.cwd(), '.env');
}

function loadEnvSource(envFile) {
  const resolvedPath = resolveEnvFilePath(envFile);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`找不到環境變數檔案：${resolvedPath}`);
  }

  const fileContent = fs.readFileSync(resolvedPath, 'utf8');
  const parsedEnv = dotenv.parse(fileContent);

  return {
    content: fileContent,
    envFilePath: resolvedPath,
    values: parsedEnv
  };
}

function buildBootstrapConfig({ formId, googleScriptUrl, secret }) {
  const normalizedFormId = String(formId || '').trim();
  const normalizedGoogleScriptUrl = String(googleScriptUrl || '').trim();

  if (!normalizedFormId && !normalizedGoogleScriptUrl) {
    throw new Error('bootstrap 至少需要提供 --form-id 或 --google-script-url');
  }

  const resolvedSecret = ensureRequiredText(secret || createRandomSecret(), 'secret');
  const result = {
    formProtectionSecret: resolvedSecret
  };

  if (normalizedFormId) {
    result.formIdEncrypted = encryptProtectedValue(normalizedFormId, resolvedSecret, 'form-id');
  }

  if (normalizedGoogleScriptUrl) {
    result.googleScriptUrlEncrypted = encryptProtectedValue(
      normalizedGoogleScriptUrl,
      resolvedSecret,
      'google-script-url'
    );
  }

  return result;
}

function buildBootstrapConfigFromEnvSource({ envSource, secret }) {
  const values = envSource && envSource.values ? envSource.values : process.env;

  // bootstrap-env 适合给已经存在的 .env / .dev.vars 做“一键迁移”。
  return buildBootstrapConfig({
    formId: readTrimmedText(values.FORM_ID),
    googleScriptUrl: readTrimmedText(values.GOOGLE_SCRIPT_URL),
    secret: readTrimmedText(secret) || readTrimmedText(values.FORM_PROTECTION_SECRET)
  });
}

function printBootstrapConfig(config, options = {}) {
  const sourceLabel = readTrimmedText(options.sourceLabel);

  if (sourceLabel) {
    console.log(`# Generated from ${sourceLabel}`);
  }

  // 输出格式刻意做成“可直接复制回 env / Secret 面板”的样子，
  // 但维护时仍要注意：这些值本身属于敏感信息，不应直接提交进仓库。
  console.log('# Copy the following values into your Secrets or env file');
  console.log(`FORM_PROTECTION_SECRET="${config.formProtectionSecret}"`);

  if (config.formIdEncrypted) {
    console.log(`FORM_ID_ENCRYPTED="${config.formIdEncrypted}"`);
  }

  if (config.googleScriptUrlEncrypted) {
    console.log(`GOOGLE_SCRIPT_URL_ENCRYPTED="${config.googleScriptUrlEncrypted}"`);
  }

  console.log('# After switching to encrypted values, clear the plain-text variables');

  if (config.formIdEncrypted) {
    console.log('FORM_ID=""');
  }

  if (config.googleScriptUrlEncrypted) {
    console.log('GOOGLE_SCRIPT_URL=""');
  }
}

function parseEnvAssignmentKey(line) {
  const match = String(line || '').match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
  return match ? match[1] : '';
}

function formatEnvAssignment(key, value) {
  return `${key}=${JSON.stringify(String(value))}`;
}

function updateEnvFileContent(fileContent, { removeKeys = [], setValues = {} } = {}) {
  const normalizedContent = typeof fileContent === 'string' ? fileContent : '';
  const newline = normalizedContent.includes('\r\n') ? '\r\n' : '\n';
  const lines = normalizedContent.split(/\r?\n/);
  const nextLines = [];
  const removeKeySet = new Set(removeKeys.map((key) => String(key)));
  const normalizedSetValues = Object.fromEntries(
    Object.entries(setValues).filter(([, value]) => typeof value === 'string' && value)
  );
  const updatedKeys = new Set();

  lines.forEach((line) => {
    const assignmentKey = parseEnvAssignmentKey(line);

    if (!assignmentKey) {
      nextLines.push(line);
      return;
    }

    if (removeKeySet.has(assignmentKey)) {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(normalizedSetValues, assignmentKey)) {
      if (updatedKeys.has(assignmentKey)) {
        return;
      }

      nextLines.push(formatEnvAssignment(assignmentKey, normalizedSetValues[assignmentKey]));
      updatedKeys.add(assignmentKey);
      return;
    }

    nextLines.push(line);
  });

  const missingKeys = Object.keys(normalizedSetValues).filter((key) => !updatedKeys.has(key));
  if (missingKeys.length > 0) {
    if (nextLines.length > 0 && nextLines[nextLines.length - 1] !== '') {
      nextLines.push('');
    }

    missingKeys.forEach((key) => {
      nextLines.push(formatEnvAssignment(key, normalizedSetValues[key]));
    });
  }

  while (nextLines.length > 1 && nextLines[nextLines.length - 1] === '' && nextLines[nextLines.length - 2] === '') {
    nextLines.pop();
  }

  return `${nextLines.join(newline)}${newline}`;
}

function writeBootstrapConfigToEnvSource({ config, envSource }) {
  if (!envSource || !envSource.envFilePath) {
    throw new Error('缺少 envSource.envFilePath，無法回寫環境變數檔案');
  }

  const setValues = {
    FORM_PROTECTION_SECRET: config.formProtectionSecret
  };
  const removeKeys = [];

  if (config.formIdEncrypted) {
    setValues.FORM_ID_ENCRYPTED = config.formIdEncrypted;
    removeKeys.push('FORM_ID');
  }

  if (config.googleScriptUrlEncrypted) {
    setValues.GOOGLE_SCRIPT_URL_ENCRYPTED = config.googleScriptUrlEncrypted;
    removeKeys.push('GOOGLE_SCRIPT_URL');
  }

  const originalContent = typeof envSource.content === 'string'
    ? envSource.content
    : fs.readFileSync(envSource.envFilePath, 'utf8');
  const nextContent = updateEnvFileContent(originalContent, {
    removeKeys,
    setValues
  });

  fs.writeFileSync(envSource.envFilePath, nextContent, 'utf8');

  return {
    envFilePath: envSource.envFilePath,
    removedKeys: removeKeys,
    updatedKeys: Object.keys(setValues)
  };
}

function main() {
  const [command, ...restArgs] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h') {
    printUsage();
    return;
  }

  if (command === 'generate-secret') {
    // generate-secret 适合先单独生成 secret，再交给密码管理器或云平台 Secret 面板保存。
    console.log(createRandomSecret());
    return;
  }

  const options = parseArgs(restArgs);

  if (command === 'bootstrap') {
    const config = buildBootstrapConfig({
      formId: options['form-id'],
      googleScriptUrl: options['google-script-url'],
      secret: options.secret
    });

    printBootstrapConfig(config);
    return;
  }

  if (command === 'bootstrap-env') {
    const envSource = loadEnvSource(options['env-file']);
    const config = buildBootstrapConfigFromEnvSource({
      envSource,
      secret: options.secret
    });
    const writeResult = writeBootstrapConfigToEnvSource({
      config,
      envSource
    });

    console.log(`# Updated ${writeResult.envFilePath}`);
    console.log(`# Wrote: ${writeResult.updatedKeys.join(', ')}`);

    if (writeResult.removedKeys.length > 0) {
      console.log(`# Removed plain-text keys: ${writeResult.removedKeys.join(', ')}`);
    }

    return;
  }

  const purpose = ensurePurpose(options.purpose);
  const secret = ensureRequiredText(options.secret, 'secret');
  const value = ensureRequiredText(options.value, 'value');

  if (command === 'encrypt') {
    const encryptedValue = encryptProtectedValue(value, secret, purpose);

    console.log(`# ${PURPOSES.get(purpose)}`);
    console.log(encryptedValue);
    return;
  }

  if (command === 'decrypt') {
    console.log(decryptProtectedValue(value, secret, purpose));
    return;
  }

  throw new Error(`不支持的命令：${command}`);
}

module.exports = {
  buildBootstrapConfig,
  buildBootstrapConfigFromEnvSource,
  loadEnvSource,
  main,
  parseArgs,
  parseEnvAssignmentKey,
  printBootstrapConfig,
  printUsage,
  updateEnvFileContent,
  writeBootstrapConfigToEnvSource
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    printUsage();
    process.exitCode = 1;
  }
}
