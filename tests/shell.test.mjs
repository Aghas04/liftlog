import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');

test('the offline cache lists every script, and every import exists', () => {
  const sw = read('sw.js');
  const js = readdirSync(new URL('js/', root)).filter(f => f.endsWith('.js'));
  for (const f of js) assert.ok(sw.includes(`'js/${f}'`), `sw.js FILES is missing js/${f}`);
  for (const f of js) {
    for (const [, dep] of read(`js/${f}`).matchAll(/from '\.\/([\w.-]+)'/g)) {
      assert.ok(existsSync(new URL(`js/${dep}`, root)), `${f} imports missing ${dep}`);
    }
  }
});
