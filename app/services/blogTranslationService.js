const { escapeHtml, lexMarkdown, renderMarkdownTokens } = require('./markedService');
const { translateDetailItems } = require('./textTranslationService');

async function defaultTranslateBatch(texts, targetLanguage) {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  const translations = await translateDetailItems({
    items: texts.map((text, index) => ({
      fieldKey: String(index),
      text
    })),
    targetLanguage
  });

  return translations.map((entry) => entry.translatedText || '');
}

function normalizeTranslationTarget(targetLanguage) {
  return targetLanguage === 'en' ? 'en' : null;
}

function extractPlainTextFromInlineTokens(tokens = []) {
  return tokens.map((token) => {
    if (!token) {
      return '';
    }

    switch (token.type) {
      case 'br':
        return '\n';
      case 'codespan':
      case 'escape':
      case 'text':
        return token.text || '';
      case 'del':
      case 'em':
      case 'link':
      case 'strong':
        return extractPlainTextFromInlineTokens(token.tokens || []);
      case 'image':
        return token.text || '';
      default:
        return token.text || '';
    }
  }).join('');
}

function extractPlainTextFromBlockTokens(tokens = []) {
  return tokens.map((token) => {
    if (!token) {
      return '';
    }

    switch (token.type) {
      case 'blockquote':
        return extractPlainTextFromBlockTokens(token.tokens || []);
      case 'code':
      case 'html':
        return '';
      case 'heading':
      case 'paragraph':
      case 'text':
        return extractPlainTextFromInlineTokens(token.tokens || []) || token.text || '';
      case 'list':
        return token.items
          .map((item) => extractPlainTextFromBlockTokens(item.tokens || []))
          .filter(Boolean)
          .join('\n');
      case 'space':
        return '';
      case 'table':
        return [
          ...(token.header || []).map((cell) => extractPlainTextFromInlineTokens(cell.tokens || [])),
          ...(token.rows || []).flat().map((cell) => extractPlainTextFromInlineTokens(cell.tokens || []))
        ]
          .filter(Boolean)
          .join('\n');
      default:
        return token.text || '';
    }
  }).filter(Boolean).join('\n');
}

function buildTranslationSlot(sourceText, className) {
  const normalizedText = String(sourceText || '').trim();

  if (!normalizedText) {
    return '';
  }

  return `<p class="${className} blog-bilingual-translation-slot" data-blog-translation-source="${escapeHtml(normalizedText)}" hidden></p>`;
}

async function translateTexts(texts, { targetLanguage, translateBatch = defaultTranslateBatch } = {}) {
  const normalizedTargetLanguage = normalizeTranslationTarget(targetLanguage);

  if (!normalizedTargetLanguage) {
    return texts.map(() => '');
  }

  const trimmedTexts = texts.map((text) => String(text || '').trim());
  const uniqueTexts = [...new Set(trimmedTexts.filter(Boolean))];

  if (uniqueTexts.length === 0) {
    return trimmedTexts.map(() => '');
  }

  let translatedUniqueTexts = [];

  try {
    translatedUniqueTexts = await translateBatch(uniqueTexts, normalizedTargetLanguage);
  } catch (error) {
    return trimmedTexts.map(() => '');
  }

  const translatedTextBySource = Object.create(null);

  uniqueTexts.forEach((text, index) => {
    translatedTextBySource[text] = translatedUniqueTexts[index] || '';
  });

  return trimmedTexts.map((text) => translatedTextBySource[text] || '');
}

function shouldHydrateArticleTranslations(targetLanguage) {
  return normalizeTranslationTarget(targetLanguage) === 'en';
}

function renderHeadingToken(token, shouldTranslate) {
  const originalHtml = renderMarkdownTokens([token]);
  const sourceText = extractPlainTextFromInlineTokens(token.tokens || []) || token.text || '';

  return [
    '<section class="blog-bilingual-block blog-bilingual-block--heading">',
    originalHtml,
    shouldTranslate
      ? buildTranslationSlot(
      sourceText,
      `blog-bilingual-heading__translation blog-bilingual-heading__translation--h${token.depth || 1}`
    )
      : '',
    '</section>'
  ].join('');
}

function renderParagraphLikeToken(token, shouldTranslate) {
  const originalHtml = renderMarkdownTokens([token]);
  const sourceText = extractPlainTextFromInlineTokens(token.tokens || []) || token.text || '';

  return [
    '<section class="blog-bilingual-block blog-bilingual-block--text">',
    originalHtml,
    shouldTranslate
      ? buildTranslationSlot(sourceText, 'blog-bilingual-block__translation')
      : '',
    '</section>'
  ].join('');
}

function renderListToken(token, shouldTranslate) {
  const tagName = token.ordered ? 'ol' : 'ul';
  const startAttribute = token.ordered && token.start ? ` start="${token.start}"` : '';

  const itemsHtml = token.items.map((item, index) => {
    const originalHtml = renderMarkdownTokens(item.tokens || []);
    const sourceText = extractPlainTextFromBlockTokens(item.tokens || []);

    return [
      '<li class="blog-bilingual-list__item">',
      `<div class="blog-bilingual-list__original">${originalHtml}</div>`,
      shouldTranslate
        ? buildTranslationSlot(sourceText, 'blog-bilingual-block__translation')
        : '',
      '</li>'
    ].join('');
  }).join('');

  return `<${tagName} class="blog-bilingual-list"${startAttribute}>${itemsHtml}</${tagName}>`;
}

function renderBlogArticleHtml(content, { targetLanguage } = {}) {
  const shouldTranslate = shouldHydrateArticleTranslations(targetLanguage);
  const tokens = lexMarkdown(content);

  if (!shouldTranslate) {
    return renderMarkdownTokens(tokens);
  }

  const htmlChunks = [];

  for (const token of tokens) {
    if (!token || token.type === 'space') {
      continue;
    }

    if (token.type === 'heading') {
      htmlChunks.push(renderHeadingToken(token, shouldTranslate));
      continue;
    }

    if (token.type === 'paragraph' || token.type === 'text') {
      htmlChunks.push(renderParagraphLikeToken(token, shouldTranslate));
      continue;
    }

    if (token.type === 'list') {
      htmlChunks.push(renderListToken(token, shouldTranslate));
      continue;
    }

    htmlChunks.push(renderMarkdownTokens([token]));
  }

  return htmlChunks.join('\n');
}

async function translateBlogListEntries(entries, { targetLanguage, translateBatch = defaultTranslateBatch } = {}) {
  const normalizedTargetLanguage = normalizeTranslationTarget(targetLanguage);

  if (!normalizedTargetLanguage) {
    return entries.map((entry) => ({
      ...entry,
      translatedTitle: ''
    }));
  }

  const translatedTitles = await translateTexts(
    entries.map((entry) => entry.title || ''),
    { targetLanguage: normalizedTargetLanguage, translateBatch }
  );

  return entries.map((entry, index) => ({
    ...entry,
    translatedTitle: translatedTitles[index] || ''
  }));
}

module.exports = {
  extractPlainTextFromBlockTokens,
  extractPlainTextFromInlineTokens,
  renderBlogArticleHtml,
  translateBlogListEntries
};
