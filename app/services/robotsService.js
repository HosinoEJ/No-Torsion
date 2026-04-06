const { createAbsoluteUrl } = require('./sitemapService');

function generateRobotsTxt(siteUrl) {
  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /form',
    'Disallow: /submit',
    'Disallow: /debug',
    'Crawl-delay: 5',
    `Sitemap: ${createAbsoluteUrl(siteUrl, '/sitemap.xml')}`
  ];

  return `${lines.join('\n')}\n`;
}

module.exports = {
  generateRobotsTxt
};
