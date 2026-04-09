#!/usr/bin/env node

const {
  createRandomSecret,
  decryptProtectedValue,
  encryptProtectedValue
} = require('../config/protectedConfig');

const PURPOSES = new Map([
  ['form-id', 'FORM_ID_ENCRYPTED'],
  ['google-script-url', 'GOOGLE_SCRIPT_URL_ENCRYPTED']
]);

function printUsage() {
  console.log(`Usage:
  node scripts/secure-config.js generate-secret
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

function main() {
  const [command, ...restArgs] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h') {
    printUsage();
    return;
  }

  if (command === 'generate-secret') {
    console.log(createRandomSecret());
    return;
  }

  const options = parseArgs(restArgs);
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

try {
  main();
} catch (error) {
  console.error(error.message);
  printUsage();
  process.exitCode = 1;
}
