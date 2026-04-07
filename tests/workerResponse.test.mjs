import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { rebuildResponseWithHeaders } from '../app/services/workerResponse.mjs';

test('rebuildResponseWithHeaders preserves large response bodies while mutating headers', async () => {
  const originalBody = 'x'.repeat(300000);
  const response = new Response(originalBody, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });

  const rebuilt = await rebuildResponseWithHeaders(response, {
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });

  assert.equal(await rebuilt.text(), originalBody);
  assert.equal(rebuilt.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.equal(rebuilt.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
});

test('rebuildResponseWithHeaders keeps bodyless responses bodyless', async () => {
  const response = new Response(null, {
    status: 204
  });

  const rebuilt = await rebuildResponseWithHeaders(response, {
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });

  assert.equal(rebuilt.status, 204);
  assert.equal(await rebuilt.text(), '');
  assert.equal(rebuilt.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
});

test('worker entry serves cn.json directly from the bundle for workers runtime', () => {
  const workerScript = fs.readFileSync(path.resolve('worker.mjs'), 'utf8');

  assert.match(workerScript, /requestUrl\.pathname === '\/cn\.json'/);
  assert.match(workerScript, /readFileSync\(CHINA_GEOJSON_PATH, 'utf8'\)/);
  assert.match(workerScript, /JSON\.stringify\(JSON\.parse\(source\)\)/);
  assert.doesNotMatch(workerScript, /Content-Encoding': 'gzip'/);
});
