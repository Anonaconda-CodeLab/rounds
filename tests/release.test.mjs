// Copyright (C) 2026 Anonaconda Code Lab · SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const r = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('web app, Android package and Android build all carry the same version', () => {
  const v = JSON.parse(r('package.json')).version, [a, b, c] = v.split('.').map(Number), re = v.replace(/\./g, '\\.');
  assert.ok(r('app.js').includes(`const VERSION = '${v}';`), 'app.js');
  assert.ok(r('sw.js').includes(`'rounds-${v}'`), 'sw.js cache');
  assert.equal(JSON.parse(r('mobile/package.json')).version, v, 'mobile/package.json');
  const g = r('mobile/android/app/build.gradle');
  assert.match(g, new RegExp(`versionName "${re}"`), 'versionName');
  assert.match(g, new RegExp(`versionCode ${a * 10000 + b * 100 + c}\\b`), 'versionCode');
  assert.match(r('CHANGELOG.md'), new RegExp(`^## ${re}$`, 'm'), 'CHANGELOG entry');
});

test('the build fills in the Android download page', () => {
  execFileSync(process.execPath, [new URL('../build.mjs', import.meta.url).pathname]);
  const v = JSON.parse(r('package.json')).version, page = r('dist/android.html');
  assert.ok(!/\{\{[A-Z_]+\}\}/.test(page), 'all placeholders filled');
  assert.ok(page.includes(`Rounds-${v}.apk`) && page.includes(`data-latest="${v}"`));
  assert.match(page, /([0-9A-F]{2}:){31}[0-9A-F]{2}/, 'certificate fingerprint');
  assert.ok(page.includes('https://github.com/Anonaconda-CodeLab/rounds/releases/latest'));
  assert.ok(!/<script>|<style>|style="/.test(page), 'no inline script or style (the site allows only its own files)');
});
