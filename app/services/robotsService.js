const { createAbsoluteUrl } = require('./sitemapService');

function generateRobotsTxt(siteUrl) {
  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /submit',
    'Disallow: /debug',
    `Sitemap: ${createAbsoluteUrl(siteUrl, '/sitemap.xml')}`
  ];

  return `${lines.join('\n')}\n`;
}

module.exports = {
  generateRobotsTxt
};
