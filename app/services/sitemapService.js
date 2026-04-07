const fs = require('fs');
const { isWorkersRuntime } = require('../../config/runtimeConfig');

function createUrlEntry({ changefreq, lastmod, loc, priority }) {
  return {
    changefreq,
    lastmod,
    loc,
    priority
  };
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeSiteUrl(siteUrl) {
  return String(siteUrl || '').trim().replace(/\/+$/, '');
}

function createAbsoluteUrl(siteUrl, pathname) {
  return new URL(pathname, `${normalizeSiteUrl(siteUrl)}/`).toString();
}

function getIsoDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function parseBlogCreationDate(value) {
  const rawValue = String(value || '').trim();

  if (!rawValue) {
    return null;
  }

  const zhDateMatch = rawValue.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (zhDateMatch) {
    const [, year, month, day] = zhDateMatch;
    return getIsoDate(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }

  return getIsoDate(rawValue);
}

function resolveArticleLastModified(markdownPath, article) {
  if (!isWorkersRuntime()) {
    try {
      const stat = fs.statSync(markdownPath);
      const lastModified = getIsoDate(stat.mtime);

      if (lastModified && stat.mtimeMs > 0) {
        return lastModified;
      }
    } catch (error) {
      // 回退到文章元数据里的创建时间。
    }
  }

  return parseBlogCreationDate(article && article.CreationDate);
}

function getStaticSitemapEntries(siteUrl) {
  return [
    createUrlEntry({
      changefreq: 'daily',
      loc: createAbsoluteUrl(siteUrl, '/'),
      priority: '1.0'
    }),
    createUrlEntry({
      changefreq: 'hourly',
      loc: createAbsoluteUrl(siteUrl, '/map'),
      priority: '0.9'
    }),
    createUrlEntry({
      changefreq: 'weekly',
      loc: createAbsoluteUrl(siteUrl, '/aboutus'),
      priority: '0.6'
    }),
    createUrlEntry({
      changefreq: 'monthly',
      loc: createAbsoluteUrl(siteUrl, '/privacy'),
      priority: '0.4'
    }),
    createUrlEntry({
      changefreq: 'weekly',
      loc: createAbsoluteUrl(siteUrl, '/blog'),
      priority: '0.8'
    })
  ];
}

function getBlogSitemapEntries({ blogDataPath, blogDirectory, siteUrl }) {
  let savedBlogData = { Data: [] };

  try {
    savedBlogData = JSON.parse(fs.readFileSync(blogDataPath, 'utf-8'));
  } catch (error) {
    return [];
  }

  return (Array.isArray(savedBlogData.Data) ? savedBlogData.Data : [])
    .filter((article) => article && typeof article.filename === 'string' && article.filename.trim())
    .map((article) => {
      const trimmedFilename = article.filename.trim();
      const markdownPath = `${blogDirectory}/${trimmedFilename}.md`;
      const lastmod = resolveArticleLastModified(markdownPath, article);

      return createUrlEntry({
        changefreq: 'monthly',
        lastmod,
        loc: createAbsoluteUrl(siteUrl, `/port/${trimmedFilename}`),
        priority: '0.7'
      });
    });
}

function renderSitemapXml(entries) {
  const body = entries
    .map((entry) => {
      const lines = [
        '  <url>',
        `    <loc>${escapeXml(entry.loc)}</loc>`
      ];

      if (entry.lastmod) {
        lines.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
      }

      if (entry.changefreq) {
        lines.push(`    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`);
      }

      if (entry.priority) {
        lines.push(`    <priority>${escapeXml(entry.priority)}</priority>`);
      }

      lines.push('  </url>');
      return lines.join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    '</urlset>'
  ].join('\n');
}

function generateSitemapXml({ blogDataPath, blogDirectory, siteUrl }) {
  const entries = [
    ...getStaticSitemapEntries(siteUrl),
    ...getBlogSitemapEntries({ blogDataPath, blogDirectory, siteUrl })
  ];

  return renderSitemapXml(entries);
}

module.exports = {
  createAbsoluteUrl,
  generateSitemapXml,
  getBlogSitemapEntries,
  getStaticSitemapEntries,
  normalizeSiteUrl,
  renderSitemapXml
};
