// Builds the published app: copies the app's own files into dist/. Netlify publishes only dist/ (see netlify.toml),
// and the Android app is made from the same folder, so tests, Android sources and notes never reach the website.
import { cpSync, rmSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url)), out = join(root, 'dist');
const FILES = ['index.html', 'style.css', 'native.js', 'engine.js', 'hr.js', 'app.js', 'sw.js', 'manifest.webmanifest',
  'icon.svg', 'icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png', 'fonts',
  '_headers', 'robots.txt', 'sitemap.xml'];
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
for (const f of FILES) cpSync(join(root, f), join(out, f), { recursive: true });
// every file the offline cache lists must be in the build
const sw = readFileSync(join(out, 'sw.js'), 'utf8'), list = sw.match(/const FILES = \[([^\]]*)\]/)[1].match(/'([^']+)'/g).map(s => s.slice(1, -1));
const missing = list.filter(f => f !== './' && !existsSync(join(out, f)));
if (missing.length) { console.error('Missing from dist/: ' + missing.join(', ')); process.exit(1); }
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
console.log(`Rounds ${version} -> ${out}`);
