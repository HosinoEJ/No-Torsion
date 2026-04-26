const assert = require('node:assert/strict');
const test = require('node:test');

test('disables form access and runtime translation when no backend is configured', async () => {
  const {
    buildNoTorsionBackendConfig,
    hasConfiguredNoTorsionBackend
  } = await import('../frontend/src/noTorsionBackend.mjs');

  assert.equal(hasConfiguredNoTorsionBackend({ formPageUrl: '' }), false);
  assert.deepEqual(
    buildNoTorsionBackendConfig({
      currentOrigin: 'https://no-torsion.example.com',
      formPageUrl: '',
      lang: 'en'
    }),
    {
      articleTranslationEnabled: false,
      backendFormHref: '',
      formEnabled: false,
      formHref: '',
      recordTranslationEnabled: false,
      translateApiUrl: ''
    }
  );
});

test('builds the backend form and translation endpoints from the configured nct-api-sql-sub form URL', async () => {
  const {
    buildNoTorsionBackendConfig,
    hasConfiguredNoTorsionBackend
  } = await import('../frontend/src/noTorsionBackend.mjs');

  const config = buildNoTorsionBackendConfig({
    currentOrigin: 'https://no-torsion.example.com',
    formPageUrl: 'https://sub.example.com/form',
    lang: 'en'
  });

  assert.equal(hasConfiguredNoTorsionBackend({ formPageUrl: 'https://sub.example.com/form' }), true);
  assert.deepEqual(config, {
    articleTranslationEnabled: true,
    backendFormHref: 'https://sub.example.com/form?lang=en',
    formEnabled: true,
    formHref: '/form?lang=en',
    recordTranslationEnabled: true,
    translateApiUrl: 'https://sub.example.com/api/no-torsion/translate-text'
  });
});

test('keeps the form enabled for zh-CN while leaving runtime translation disabled', async () => {
  const { buildNoTorsionBackendConfig } = await import('../frontend/src/noTorsionBackend.mjs');

  assert.deepEqual(
    buildNoTorsionBackendConfig({
      currentOrigin: 'https://no-torsion.example.com',
      formPageUrl: '/form',
      lang: 'zh-CN'
    }),
    {
      articleTranslationEnabled: false,
      backendFormHref: 'https://no-torsion.example.com/form?lang=zh-CN',
      formEnabled: true,
      formHref: '/form?lang=zh-CN',
      recordTranslationEnabled: false,
      translateApiUrl: 'https://no-torsion.example.com/api/no-torsion/translate-text'
    }
  );
});
