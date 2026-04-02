const fs = require('fs');

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

function getStaticSitemapEntries(siteUrl) {
  return [
    createUrlEntry({
      changefreq: 'daily',
      loc: createAbsoluteUrl(siteUrl, '/'),
      priority: '1.0'
    }),
    createUrlEntry({
      changefreq: 'weekly',
      loc: createAbsoluteUrl(siteUrl, '/form'),
      priority: '0.9'
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
      let lastmod = null;

      try {
        lastmod = getIsoDate(fs.statSync(markdownPath).mtime);
      } catch (error) {
        lastmod = null;
      }

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
