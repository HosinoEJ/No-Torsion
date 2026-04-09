const crypto = require('crypto');

const PROTECTED_VALUE_PREFIX = 'enc:v1';
const KEY_LENGTH_BYTES = 32;
const AES_GCM_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const DERIVATION_SALT = 'no-torsion:protected-config';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function ensureBaseSecret(baseSecret) {
  const normalizedBaseSecret = normalizeText(baseSecret);

  if (!normalizedBaseSecret) {
    throw new Error('缺少保護配置所需的基礎 secret');
  }

  return normalizedBaseSecret;
}

function deriveKey(baseSecret, purpose) {
  return crypto.hkdfSync(
    'sha256',
    Buffer.from(ensureBaseSecret(baseSecret), 'utf8'),
    Buffer.from(DERIVATION_SALT, 'utf8'),
    Buffer.from(String(purpose || 'default'), 'utf8'),
    KEY_LENGTH_BYTES
  );
}

function isProtectedValue(value) {
  return String(value || '').startsWith(`${PROTECTED_VALUE_PREFIX}:`);
}

function encodeBase64Url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function decodeBase64Url(value) {
  return Buffer.from(String(value || ''), 'base64url');
}

function createRandomSecret(byteLength = KEY_LENGTH_BYTES) {
  const normalizedLength = Number.isInteger(byteLength) && byteLength > 0
    ? byteLength
    : KEY_LENGTH_BYTES;

  return crypto.randomBytes(normalizedLength).toString('hex');
}

function encryptProtectedValue(value, baseSecret, purpose) {
  const plaintext = normalizeText(value);
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const key = deriveKey(baseSecret, purpose);
  const cipher = crypto.createCipheriv(AES_GCM_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return [
    PROTECTED_VALUE_PREFIX,
    encodeBase64Url(iv),
    encodeBase64Url(ciphertext),
    encodeBase64Url(authTag)
  ].join(':');
}

function decryptProtectedValue(value, baseSecret, purpose) {
  const normalizedValue = normalizeText(value);
  const parts = normalizedValue.split(':');

  if (parts.length !== 5 || parts[0] !== 'enc' || parts[1] !== 'v1') {
    throw new Error('受保護配置格式無效');
  }

  const iv = decodeBase64Url(parts[2]);
  const ciphertext = decodeBase64Url(parts[3]);
  const authTag = decodeBase64Url(parts[4]);

  if (iv.length !== IV_LENGTH_BYTES || authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new Error('受保護配置格式無效');
  }

  const key = deriveKey(baseSecret, purpose);
  const decipher = crypto.createDecipheriv(AES_GCM_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return plaintext.toString('utf8').trim();
}

module.exports = {
  PROTECTED_VALUE_PREFIX,
  createRandomSecret,
  decryptProtectedValue,
  deriveKey,
  encryptProtectedValue,
  isProtectedValue,
  normalizeText
};
