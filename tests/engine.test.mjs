// Copyright (C) 2026 Anonaconda Code Lab · SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const E = createRequire(import.meta.url)('../engine.js');
const kinds = segs => segs.map(g => g.kind + (g.round ? g.round : '')).join(' ');

test('Tabata: lead-in, 8 rounds, no rest after the last round, 4 min + 3 s', () => {
  const s = E.compile({ work: 20, rest: 10, rounds: 8 });
  assert.equal(s.length, 1 + 8 + 7);
  assert.equal(s[0].kind, 'ready'); assert.equal(s[s.length - 1].kind, 'work');
  assert.equal(E.totalDuration(s), 3 + 8 * 20 + 7 * 10);
});

test('sets: set break replaces the rest between sets; warm-up and cool-down', () => {
  const s = E.compile({ warm: 60, work: 40, rest: 20, rounds: 2, sets: 2, setRest: 90, cool: 30 });
  assert.equal(kinds(s), 'ready warm work1 rest1 work2 setrest2 work1 rest1 work2 cool');
  const s2 = E.compile({ work: 40, rest: 20, rounds: 2, sets: 2, setRest: 0 });
  assert.equal(kinds(s2), 'ready work1 rest1 work2 rest2 work1 rest1 work2');
});

test('beeps: 3-2-1 one per second into and out of every work round, go and stop', () => {
  const s = E.compile({ work: 20, rest: 10, rounds: 2 });   // ready 0-3, work 3-23, rest 23-33, work 33-53
  const b = E.beepPlan(s).map(x => x.type + '@' + x.t);
  assert.deepEqual(b, ['count@0', 'count@1', 'count@2', 'go@3', 'count@20', 'count@21', 'count@22', 'stop@23',
    'count@30', 'count@31', 'count@32', 'go@33', 'count@50', 'count@51', 'count@52', 'done@53']);
});

test('EMOM (no rest): one countdown per minute, no duplicate beeps', () => {
  const b = E.beepPlan(E.compile({ work: 60, rest: 0, rounds: 3 }));
  const at = t => b.filter(x => Math.abs(x.t - t) < 1e-9).map(x => x.type);
  assert.deepEqual(at(63), ['go']); assert.deepEqual(at(60), ['count']); assert.equal(b.filter(x => x.type === 'go').length, 3);
});

test('short rest (2 s): only the beeps that fit in it', () => {
  const b = E.beepPlan(E.compile({ work: 10, rest: 2, rounds: 2 }));   // work 3-13, rest 13-15, work 15-25
  const rest = b.filter(x => x.t > 13 && x.t < 15).map(x => x.t);
  assert.deepEqual(rest, [13, 14].filter(t => t > 13));
});

test('locate, time formatting and parsing', () => {
  const s = E.compile({ work: 20, rest: 10, rounds: 2 });
  const p = E.locate(s, 10); assert.equal(p.seg.kind, 'work'); assert.equal(p.left, 13); assert.equal(E.locate(s, 99).done, true);
  assert.equal(E.fmtTime(65), '1:05'); assert.equal(E.fmtTime(3725), '1:02:05');
  assert.equal(E.parseTime('1:30'), 90); assert.equal(E.parseTime('45'), 45); assert.equal(E.parseTime('2m'), 120); assert.ok(Number.isNaN(E.parseTime('abc')));
  assert.equal(E.summary({ work: 20, rest: 10, rounds: 8 }), '8 × 0:20 / 0:10');
});

test('bad input is clamped, presets are valid', () => {
  const n = E.normalize({ work: -5, rounds: 1e6, rest: 'x' });
  assert.equal(n.work, 1); assert.equal(n.rounds, 99); assert.equal(n.rest, 0);
  for (const p of E.PRESETS) assert.ok(E.totalDuration(E.compile(p)) > 60, p.name);
});

test('custom steps: 10-20-30 blocks, set break, nothing dropped after the last sprint', () => {
  const p = E.PRESETS.find(x => x.id === 'p-102030'), s = E.compile(p);
  assert.equal(s.filter(g => g.kind === 'work').length, 30);
  assert.equal(s.filter(g => g.kind === 'setrest').length, 2);
  assert.equal(E.totalDuration(s) - E.LEAD_IN, 300 + 3 * 300 + 2 * 120);
  const b = E.beepPlan(s), steady = s.find(g => g.label === 'Steady'), sprint = s.find(g => g.label === 'Sprint!');
  assert.ok(b.some(x => x.type === 'go' && x.t === steady.start), 'go into steady');
  assert.ok(b.some(x => x.type === 'go' && x.t === sprint.start), 'go into sprint');
  assert.ok(b.some(x => x.type === 'stop' && x.t === sprint.start + 10), 'stop after sprint');
});

test('pyramid: one round of 5 efforts, trailing rest dropped; efforts numbered', () => {
  const s = E.compile(E.PRESETS.find(x => x.id === 'p-pyramid'));
  const w = s.filter(g => g.kind === 'work');
  assert.deepEqual(w.map(g => g.dur), [60, 120, 180, 120, 60]);
  assert.equal(w[2].n, 3); assert.equal(w[2].nw, 5);
  assert.equal(s[s.length - 1].kind, 'cool');
});

test('fartlek: random but repeatable for a seed, fills the time, surges within limits', () => {
  const f = { fartlek: { total: 1200, surgeMin: 15, surgeMax: 60 } };
  const a = E.compile(f, 7), b = E.compile(f, 7), c = E.compile(f, 8);
  assert.deepEqual(a.map(g => g.dur), b.map(g => g.dur));
  assert.notDeepEqual(a.map(g => g.dur), c.map(g => g.dur));
  assert.equal(E.totalDuration(a) - E.LEAD_IN, 1200);
  for (const g of a.filter(g => g.kind === 'work').slice(0, -1)) assert.ok(g.dur >= 15 && g.dur <= 60, String(g.dur));
});

test('Gibala One-Minute Workout lasts 10 minutes with 1 minute of sprinting', () => {
  const s = E.compile(E.PRESETS.find(x => x.id === 'p-oneminute'));
  assert.equal(E.totalDuration(s) - E.LEAD_IN, 600);
  assert.equal(s.filter(g => g.kind === 'work').reduce((a, g) => a + g.dur, 0), 60);
});

test('every preset has an explanation and at least one goal', () => {
  for (const p of E.PRESETS) { assert.ok(p.info && p.info.what && p.info.why && p.info.src, p.name); assert.ok(p.goals && p.goals.length, p.name); }
});

test('hardest-first ranking covers every preset exactly once', () => {
  const ids = E.PRESETS.map(t => t.id).sort();
  assert.deepEqual([...E.HARDEST].sort(), ids);
  assert.equal(E.HARDEST[0], 'p-tabata');
});
