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

test('zones: entered max wins; age gives the Tanaka estimate; nonsense is ignored', () => {
  assert.equal(H.zoneScale({ on: false, max: 180 }), null);
  assert.deepEqual(H.zoneScale({ on: true, max: 185, age: 40 }), { max: 185, rest: 0, estimated: false, age: 0 });
  assert.deepEqual(H.zoneScale({ on: true, max: '', age: 40 }), { max: 180, rest: 0, estimated: true, age: 40 });   // 208 - 28
  assert.equal(H.tanaka(30), 187);
  assert.equal(H.zoneScale({ on: true, max: 0, age: 0 }), null);
  assert.equal(H.zoneScale({ on: true, max: 40, age: 5 }), null);
  assert.equal(H.zoneScale({ on: true, max: 180, rest: 170 }).rest, 0, 'a resting rate too close to max is ignored');
  assert.equal(H.zoneScale({ on: true, max: 180, rest: 60 }).rest, 60);
});

test('zones: share of max, or of heart-rate reserve with a resting rate', () => {
  const s = H.zoneScale({ on: true, max: 180 });
  assert.equal(H.zoneOf(89, s).zone, 0);
  assert.equal(H.zoneOf(90, s).zone, 1);
  assert.equal(H.zoneOf(125, s).zone, 2);
  assert.equal(H.zoneOf(144, s).zone, 4);
  assert.equal(H.zoneOf(161, s).zone, 4);
  assert.equal(H.zoneOf(162, s).zone, 5);
  assert.equal(H.zoneOf(200, s).zone, 5);
  const k = H.zoneScale({ on: true, max: 180, rest: 60 });   // reserve 120: zone 1 from 120, zone 5 from 168
  assert.equal(H.zoneOf(119, k).zone, 0);
  assert.equal(H.zoneOf(120, k).zone, 1);
  assert.equal(H.zoneOf(168, k).zone, 5);
  assert.deepEqual(H.zoneBpm(k), [120, 132, 144, 156, 168, 180]);
  assert.deepEqual(H.zoneBpm(s), [90, 108, 126, 144, 162, 180]);
});

test('time in zones: each reading counts until the next; gaps and jumps back are left out', () => {
  const s = H.zoneScale({ on: true, max: 200 });
  const x = [];
  for (let t = 0; t < 60; t++) x.push({ t, bpm: t < 30 ? 150 : 185 });   // 30 s in zone 3, 30 s in zone 5 (last reading has no end)
  x.push({ t: 80, bpm: 170 });   // 21 s gap: not counted
  x.push({ t: 81, bpm: 170 });
  x.push({ t: 70, bpm: 150 });   // Back button: not counted
  assert.deepEqual(H.zoneTimes(x, s), [0, 0, 0, 30, 1, 29]);
  assert.deepEqual(H.zoneTimes([], s), [0, 0, 0, 0, 0, 0]);
});
