const { marked } = require('marked');

const blockedProtocols = ['javascript:', 'vbscript:', 'data:'];

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url) {
  const rawValue = String(url || '').trim();

  if (!rawValue) {
    return null;
  }

  try {
    const normalizedProtocol = decodeURIComponent(rawValue)
      .replace(/[^\w:]/g, '')
      .toLowerCase();

    if (blockedProtocols.some((protocol) => normalizedProtocol.startsWith(protocol))) {
      return null;
    }
  } catch (error) {
    return null;
  }

  try {
    return encodeURI(rawValue).replace(/%25/g, '%');
  } catch (error) {
    return null;
  }
}

const safeRenderer = new marked.Renderer();

function getMarkedOptions() {
  return {
    gfm: true,
    headerIds: false,
    mangle: false,
    renderer: safeRenderer
  };
}

safeRenderer.html = function renderHtml(html) {
  return escapeHtml(html);
};

safeRenderer.link = function renderLink(href, title, text) {
  const safeHref = sanitizeUrl(href);

  if (!safeHref) {
    return text;
  }

  let output = `<a href="${escapeHtml(safeHref)}"`;

  if (title) {
    output += ` title="${escapeHtml(title)}"`;
  }

  output += ' rel="noopener noreferrer">';
  output += text;
  output += '</a>';

  return output;
};

safeRenderer.image = function renderImage(href, title, text) {
  const safeHref = sanitizeUrl(href);

  if (!safeHref) {
    return escapeHtml(text || '');
  }

  let output = `<img src="${escapeHtml(safeHref)}" alt="${escapeHtml(text || '')}"`;

  if (title) {
    output += ` title="${escapeHtml(title)}"`;
  }

  output += '>';
  return output;
};

function renderMarkdown(content) {
  return marked.parse(String(content || ''), getMarkedOptions());
}

function lexMarkdown(content) {
  return marked.lexer(String(content || ''), getMarkedOptions());
}

function renderMarkdownTokens(tokens) {
  return marked.parser(Array.isArray(tokens) ? tokens : [], getMarkedOptions());
}

module.exports = {
  escapeHtml,
  lexMarkdown,
  renderMarkdown,
  renderMarkdownTokens
};
