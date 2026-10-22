// Copyright (C) 2026 Anonaconda Code Lab · SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const H = createRequire(import.meta.url)('../hr.js');
const dv = bytes => new DataView(Uint8Array.from(bytes).buffer);

test('heart-rate packets: 8-bit and 16-bit values, junk ignored', () => {
  assert.equal(H.parseHR(dv([0x00, 142])), 142);
  assert.equal(H.parseHR(dv([0x16, 98, 0x20, 0x03])), 98);       // 8-bit with RR intervals after it
  assert.equal(H.parseHR(dv([0x01, 0xB4, 0x00])), 180);          // 16-bit
  assert.equal(H.parseHR(dv([0x00, 0])), 0);                     // strap not on skin
  assert.equal(H.parseHR(dv([0x00])), 0);
});

test('finish-screen stats use work rounds only; one spike does not set the peak', () => {
  const s = [];
  for (let t = 0; t < 60; t++) s.push({ t, bpm: 150, work: t % 30 < 20 });
  s[10].bpm = 230;   // a single glitch
  for (const x of s) if (!x.work) x.bpm = 120;
  const r = H.hrStats(s);
  assert.equal(r.avg, Math.round((150 * 39 + 230) / 40));
  assert.ok(r.peak < 170, 'peak ' + r.peak);
  assert.equal(H.hrStats([{ t: 0, bpm: 140, work: true }]), null);
});
