const { execFile } = require('child_process');
const { promisify } = require('util');

const translationCache = new Map();
const execFileAsync = promisify(execFile);

function normalizeTargetLanguage(targetLanguage) {
  if (targetLanguage === 'en' || targetLanguage === 'zh-TW') {
    return targetLanguage;
  }

  return null;
}

function getCacheKey(targetLanguage, text) {
  return `${targetLanguage}::${text}`;
}

function extractTranslatedText(responseBody) {
  if (!Array.isArray(responseBody) || !Array.isArray(responseBody[0])) {
    return '';
  }

  return responseBody[0]
    .map((part) => Array.isArray(part) ? part[0] || '' : '')
    .join('')
    .trim();
}

async function requestTranslationWithCurl(text, targetLanguage) {
  const { stdout } = await execFileAsync('curl', [
    '-sS',
    '--get',
    '--max-time', '10',
    'https://translate.googleapis.com/translate_a/single',
    '--data-urlencode', 'client=gtx',
    '--data-urlencode', 'sl=auto',
    '--data-urlencode', `tl=${targetLanguage}`,
    '--data-urlencode', 'dt=t',
    '--data-urlencode', `q=${text}`
  ]);

  return JSON.parse(stdout);
}

async function translateSingleText(text, targetLanguage) {
  const cacheKey = getCacheKey(targetLanguage, text);
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  const translateUrl = new URL('https://translate.googleapis.com/translate_a/single');
  translateUrl.searchParams.set('client', 'gtx');
  translateUrl.searchParams.set('sl', 'auto');
  translateUrl.searchParams.set('tl', targetLanguage);
  translateUrl.searchParams.set('dt', 't');
  translateUrl.searchParams.set('q', text);

  let responseBody;

  try {
    const response = await fetch(translateUrl, {
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`翻譯服務返回 ${response.status}`);
    }

    responseBody = await response.json();
  } catch (error) {
    responseBody = await requestTranslationWithCurl(text, targetLanguage);
  }

  const translatedText = extractTranslatedText(responseBody);

  if (!translatedText) {
    throw new Error('翻譯結果為空');
  }

  translationCache.set(cacheKey, translatedText);
  return translatedText;
}

async function translateDetailItems({ items, targetLanguage }) {
  const normalizedTargetLanguage = normalizeTargetLanguage(targetLanguage);

  if (!normalizedTargetLanguage) {
    return items.map((item) => ({
      ...item,
      translatedText: item.text
    }));
  }

  const uniqueTexts = [...new Set(items.map((item) => item.text).filter(Boolean))];
  const translatedTextBySource = Object.create(null);

  await Promise.all(uniqueTexts.map(async (text) => {
    translatedTextBySource[text] = await translateSingleText(text, normalizedTargetLanguage);
  }));

  return items.map((item) => ({
    ...item,
    translatedText: translatedTextBySource[item.text] || item.text
  }));
}

module.exports = {
  translateDetailItems
};
