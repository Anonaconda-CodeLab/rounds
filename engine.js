/* Rounds: timer engine. Turns a timer's settings into a list of segments and a list of beeps.
   No DOM here, so it can be tested on its own. */
'use strict';

const KIND_LABEL = { ready: 'Get ready', warm: 'Warm-up', work: 'Work', rest: 'Rest', setrest: 'Set break', cool: 'Cool-down' };
const LEAD_IN = 3;   // "get ready" seconds after pressing Start

const clampInt = (v, lo, hi, d) => { v = Math.round(+v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };

/* settings -> safe settings */
function normalize(t) {
  t = t || {};
  return {
    id: String(t.id || ''), name: String(t.name || 'My timer').slice(0, 40),
    warm: clampInt(t.warm, 0, 3600, 0), work: clampInt(t.work, 1, 3600, 30), rest: clampInt(t.rest, 0, 3600, 0),
    rounds: clampInt(t.rounds, 1, 99, 1), sets: clampInt(t.sets, 1, 20, 1), setRest: clampInt(t.setRest, 0, 3600, 0),
    cool: clampInt(t.cool, 0, 3600, 0),
    names: Array.isArray(t.names) ? t.names.map(s => String(s).trim().slice(0, 30)).filter(Boolean).slice(0, 99) : []
  };
}

/* settings -> segments [{ kind, dur, round, rounds, set, sets, label }] */
function compile(t) {
  t = normalize(t);
  const segs = [], add = (kind, dur, extra) => { if (dur > 0) segs.push(Object.assign({ kind, dur, round: 0, rounds: t.rounds, set: 0, sets: t.sets, label: '' }, extra)); };
  add('ready', LEAD_IN);
  add('warm', t.warm);
  for (let s = 1; s <= t.sets; s++) {
    for (let r = 1; r <= t.rounds; r++) {
      add('work', t.work, { round: r, set: s, label: t.names.length ? t.names[(r - 1) % t.names.length] : '' });
      const lastRound = r === t.rounds, lastSet = s === t.sets;
      if (!lastRound) add('rest', t.rest, { round: r, set: s });
      else if (!lastSet) { if (t.setRest > 0) add('setrest', t.setRest, { round: r, set: s }); else add('rest', t.rest, { round: r, set: s }); }
    }
  }
  add('cool', t.cool);
  let at = 0; for (const g of segs) { g.start = at; at += g.dur; }
  return segs;
}
const totalDuration = segs => segs.reduce((a, g) => a + g.dur, 0);

/* beeps: 3-2-1 (one per second) into every work round and out of every work round, a long high "go" when work starts,
   a long low "stop" when it ends, and a finish chord. Times are seconds from Start. */
function beepPlan(segs) {
  const out = [], seen = new Set();
  const put = (t, type) => { const k = type + '@' + t.toFixed(3); if (t < 0 || seen.has(k)) return; seen.add(k); out.push({ t, type }); };
  for (let i = 0; i < segs.length; i++) {
    const g = segs[i], next = segs[i + 1], end = g.start + g.dur;
    const intoWork = next && next.kind === 'work', outOfWork = g.kind === 'work';
    if (intoWork || outOfWork) {
      for (let k = 3; k >= 1; k--) if (end - k >= g.start - 1e-9 || g.kind === 'ready') put(end - k, 'count');
      if (intoWork) put(end, 'go'); else if (next) put(end, 'stop');
    }
  }
  put(totalDuration(segs), 'done');
  return out.sort((a, b) => a.t - b.t || (a.type === 'count' ? -1 : 1));
}

/* where are we at time t (seconds from Start)? */
function locate(segs, t) {
  let i = 0; while (i < segs.length - 1 && t >= segs[i].start + segs[i].dur) i++;
  const g = segs[i], left = Math.max(0, g.start + g.dur - t);
  return { i, seg: g, left, frac: g.dur ? Math.min(1, Math.max(0, (t - g.start) / g.dur)) : 1, done: t >= totalDuration(segs) };
}

function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
/* "1:30", "90", "1m30" -> seconds */
function parseTime(str) {
  str = String(str).trim(); if (!str) return NaN;
  let m = str.match(/^(\d+):(\d{1,2})$/); if (m) return +m[1] * 60 + +m[2];
  m = str.match(/^(?:(\d+)\s*m(?:in)?)?\s*(?:(\d+)\s*s(?:ec)?)?$/i); if (m && (m[1] || m[2])) return (+m[1] || 0) * 60 + (+m[2] || 0);
  return /^\d+$/.test(str) ? +str : NaN;
}

/* one-line summary, e.g. "8 × 0:20 / 0:10" or "3 sets × 5 × 0:40 / 0:20" */
function summary(t) {
  const n = normalize(t), wr = n.rest ? `${fmtTime(n.work)} / ${fmtTime(n.rest)}` : fmtTime(n.work);
  return (n.sets > 1 ? `${n.sets} sets × ` : '') + `${n.rounds} × ${wr}`;
}

const PRESETS = [
  { id: 'p-tabata', name: 'Tabata', blurb: '20 s all-out, 10 s rest, 8 rounds', warm: 0, work: 20, rest: 10, rounds: 8, sets: 1, setRest: 0, cool: 0 },
  { id: 'p-4x4', name: '4 × 4 Norwegian', blurb: '4 min hard, 3 min easy, with warm-up and cool-down', warm: 600, work: 240, rest: 180, rounds: 4, sets: 1, setRest: 0, cool: 300 },
  { id: 'p-emom10', name: 'EMOM 10', blurb: 'Every minute on the minute, 10 minutes', warm: 0, work: 60, rest: 0, rounds: 10, sets: 1, setRest: 0, cool: 0 },
  { id: 'p-3030', name: '30 / 30', blurb: '30 s on, 30 s off, 10 rounds', warm: 0, work: 30, rest: 30, rounds: 10, sets: 1, setRest: 0, cool: 0 },
  { id: 'p-hiit4020', name: 'HIIT 40 / 20', blurb: '5 exercises × 3 sets, 1 min between sets', warm: 0, work: 40, rest: 20, rounds: 5, sets: 3, setRest: 60, cool: 0 },
  { id: 'p-boxing', name: 'Boxing rounds', blurb: '3 min rounds, 1 min rest, 12 rounds', warm: 0, work: 180, rest: 60, rounds: 12, sets: 1, setRest: 0, cool: 0 },
  { id: 'p-plank', name: 'Core 45 / 15', blurb: '45 s hold, 15 s switch, 8 rounds', warm: 0, work: 45, rest: 15, rounds: 8, sets: 1, setRest: 0, cool: 0 }
];

const Engine = { KIND_LABEL, LEAD_IN, normalize, compile, totalDuration, beepPlan, locate, fmtTime, parseTime, summary, PRESETS };
if (typeof module !== 'undefined' && module.exports) module.exports = Engine; else globalThis.Engine = Engine;
