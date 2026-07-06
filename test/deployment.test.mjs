import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = new URL('..', import.meta.url).pathname;

test('Cloudflare Pages publishes the compiled Vite output', () => {
  const configPath = join(root, 'wrangler.jsonc');

  assert.equal(
    existsSync(configPath),
    true,
    'wrangler.jsonc must pin the Cloudflare Pages output directory',
  );

  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  assert.equal(config.name, 'forgetting-engine');
  assert.equal(config.pages_build_output_dir, './dist');
  assert.match(config.compatibility_date, /^\d{4}-\d{2}-\d{2}$/);
});

test('the production HTML loads bundled JavaScript instead of TypeScript source', () => {
  const htmlPath = join(root, 'dist', 'index.html');

  assert.equal(existsSync(htmlPath), true, 'run npm run build before deployment verification');

  const html = readFileSync(htmlPath, 'utf8');
  assert.doesNotMatch(html, /\/src\/main\.ts/);

  const scriptSrc = html.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
  assert.ok(scriptSrc, 'production HTML must contain a bundled JavaScript entry');
  assert.equal(existsSync(join(root, 'dist', scriptSrc.replace(/^\//, ''))), true);
});
