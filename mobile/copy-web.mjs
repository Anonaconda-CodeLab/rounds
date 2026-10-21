// Copies the web app's own files (Rounds has no build step) into mobile/www for Capacitor.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), out = join(root, 'mobile', 'www');
const FILES = ['index.html', 'style.css', 'native.js', 'engine.js', 'hr.js', 'app.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png', 'fonts'];
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
for (const f of FILES) cpSync(join(root, f), join(out, f), { recursive: true });
console.log('Rounds web app -> ' + out);
