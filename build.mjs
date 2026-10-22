// Copyright (C) 2026 Anonaconda Code Lab · SPDX-License-Identifier: GPL-3.0-or-later
// Builds the published app: copies the app's own files into dist/. Netlify publishes only dist/ (see netlify.toml),
// and the Android app is made from the same folder, so tests, Android sources and notes never reach the website.
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url)), out = join(root, 'dist');
// ---- project settings ----
const PROJECT = {
  name: 'Rounds', filePrefix: 'Rounds',
  appUrl: 'https://rounds.anonacondacodelab.com',
  repoUrl: 'https://github.com/Anonaconda-CodeLab/rounds',   // shown in Settings and on the Android page
  contact: 'hello@anonacondacodelab.com',
  // SHA-256 of the Android signing certificate (the studio key shared by all apps), published so people can check an APK
  certSha256: '4D:6C:EA:58:94:C0:D7:D8:E9:AB:74:BC:3A:1E:9C:A5:47:BD:40:A2:02:B6:70:99:AF:66:5B:29:7F:7A:8F:47'
};
const FILES = ['index.html', 'style.css', 'native.js', 'engine.js', 'hr.js', 'app.js', 'sw.js', 'manifest.webmanifest',
  'icon.svg', 'icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png', 'fonts',
  '_headers', 'robots.txt', 'sitemap.xml', 'android.css', 'android.js'];
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
for (const f of FILES) cpSync(join(root, f), join(out, f), { recursive: true });
// every file the offline cache lists must be in the build
const sw = readFileSync(join(out, 'sw.js'), 'utf8'), list = sw.match(/const FILES = \[([^\]]*)\]/)[1].match(/'([^']+)'/g).map(s => s.slice(1, -1));
const missing = list.filter(f => f !== './' && !existsSync(join(out, f)));
if (missing.length) { console.error('Missing from dist/: ' + missing.join(', ')); process.exit(1); }
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
// the Android download page (also the target of the app's Check for updates button: android.html?v=<installed version>)
const vals = { VERSION: version, REPO: PROJECT.repoUrl, CERT: PROJECT.certSha256, APP_NAME: PROJECT.name, APP_URL: PROJECT.appUrl, FILE_PREFIX: PROJECT.filePrefix,
  CONTACT_LINE: ` · Questions or problems: <a href="mailto:${PROJECT.contact}">${PROJECT.contact}</a>` };
const page = readFileSync(join(root, 'android.html'), 'utf8').replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => k in vals ? vals[k] : m);
if (/\{\{[A-Z_]+\}\}/.test(page)) { console.error('android.html: unfilled placeholder'); process.exit(1); }
writeFileSync(join(out, 'android.html'), page);
// the app's version must match package.json (Settings shows it and Check for updates sends it)
if (!readFileSync(join(root, 'app.js'), 'utf8').includes(`const VERSION = '${version}';`)) { console.error('app.js VERSION differs from package.json ' + version); process.exit(1); }
console.log(`Rounds ${version} -> ${out}`);
