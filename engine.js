/* Rounds: timer engine. Turns a timer's settings into a list of segments and a list of beeps.
   No DOM here, so it can be tested on its own. */
'use strict';

const KIND_LABEL = { ready: 'Get ready', warm: 'Warm-up', work: 'Work', rest: 'Rest', setrest: 'Set break', cool: 'Cool-down' };
const LEAD_IN = 3;   // "get ready" seconds after pressing Start

const clampInt = (v, lo, hi, d) => { v = Math.round(+v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };

/* settings -> safe settings. A round is either the simple work/rest pair or a list of steps (custom patterns such as
   10-20-30 or a pyramid); "fartlek" generates random surges. */
const cleanSteps = st => (Array.isArray(st) ? st : []).slice(0, 30).map(x => ({ k: x && x.k === 'rest' ? 'rest' : 'work', d: clampInt(x && x.d, 1, 3600, 30), n: String((x && x.n) || '').trim().slice(0, 30) }));
function normalize(t) {
  t = t || {};
  const out = {
    id: String(t.id || ''), name: String(t.name || 'My timer').slice(0, 40),
    warm: clampInt(t.warm, 0, 3600, 0), work: clampInt(t.work, 1, 3600, 30), rest: clampInt(t.rest, 0, 3600, 0),
    rounds: clampInt(t.rounds, 1, 99, 1), sets: clampInt(t.sets, 1, 20, 1), setRest: clampInt(t.setRest, 0, 3600, 0),
    cool: clampInt(t.cool, 0, 3600, 0),
    names: Array.isArray(t.names) ? t.names.map(s => String(s).trim().slice(0, 30)).filter(Boolean).slice(0, 99) : []
  };
  const st = cleanSteps(t.steps); if (st.some(x => x.k === 'work')) out.steps = st;
  if (t.fartlek && typeof t.fartlek === 'object') out.fartlek = { total: clampInt(t.fartlek.total, 120, 7200, 1200), surgeMin: clampInt(t.fartlek.surgeMin, 5, 600, 15), surgeMax: clampInt(t.fartlek.surgeMax, 5, 600, 60) };
  if (out.fartlek && out.fartlek.surgeMax < out.fartlek.surgeMin) out.fartlek.surgeMax = out.fartlek.surgeMin;
  return out;
}
/* the steps of one round */
function roundSteps(t) {
  if (t.steps) return t.steps;
  return t.rest ? [{ k: 'work', d: t.work, n: '' }, { k: 'rest', d: t.rest, n: '' }] : [{ k: 'work', d: t.work, n: '' }];
}
/* fartlek: random surges with easy running between them (easy 1-3 x the surge), seeded so a run can be repeated */
function fartlekSteps(f, seed) {
  let s = (seed >>> 0) || 1; const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let q = s; q = Math.imul(q ^ (q >>> 15), q | 1); q ^= q + Math.imul(q ^ (q >>> 7), q | 61); return ((q ^ (q >>> 14)) >>> 0) / 4294967296; };
  const out = []; let at = 0;
  while (at < f.total) {
    const surge = Math.round((f.surgeMin + rnd() * (f.surgeMax - f.surgeMin)) / 5) * 5 || 5;
    const easy = Math.max(20, Math.round(surge * (1 + 2 * rnd()) / 5) * 5);
    const e = Math.min(easy, f.total - at); if (e > 0) { out.push({ k: 'rest', d: e, n: 'Easy' }); at += e; }
    const w = Math.min(surge, f.total - at); if (w > 0) { out.push({ k: 'work', d: w, n: 'Surge' }); at += w; }
  }
  if (out.length && out[out.length - 1].k === 'work' && out[out.length - 1].d < 5) out.pop();
  return out;
}

/* settings -> segments [{ kind, dur, round, rounds, set, sets, label }] */
function compile(t, seed) {
  t = normalize(t);
  const steps = t.fartlek ? fartlekSteps(t.fartlek, seed || 1) : roundSteps(t), rounds = t.fartlek ? 1 : t.rounds, sets = t.fartlek ? 1 : t.sets;
  const segs = [], add = (kind, dur, extra) => { if (dur > 0) segs.push(Object.assign({ kind, dur, round: 0, rounds, set: 0, sets, label: '' }, extra)); };
  let lastWork = steps.length - 1; while (lastWork > 0 && steps[lastWork].k !== 'work') lastWork--;
  const multi = steps.filter(x => x.k === 'work').length > 1;
  add('ready', LEAD_IN);
  add('warm', t.warm);
  let wi = 0;
  for (let s = 1; s <= sets; s++) {
    for (let r = 1; r <= rounds; r++) {
      const lastRound = r === rounds, lastSet = s === sets;
      steps.forEach((st, j) => {
        if (st.k === 'work') {
          const label = st.n || (t.names.length ? t.names[wi % t.names.length] : '');
          add('work', st.d, { round: t.fartlek ? 0 : r, set: s, label, step: multi && !t.fartlek ? j : undefined }); wi++;
        } else if (!(lastRound && j > lastWork)) add('rest', st.d, { round: t.fartlek ? 0 : r, set: s, label: st.n });
      });
      if (lastRound && !lastSet) {
        if (t.setRest > 0) add('setrest', t.setRest, { round: r, set: s });
        else steps.slice(lastWork + 1).forEach(st => add('rest', st.d, { round: r, set: s, label: st.n }));
      }
    }
  }
  add('cool', t.cool);
  let at = 0; for (const g of segs) { g.start = at; at += g.dur; }
  const works = segs.filter(g => g.kind === 'work'); works.forEach((g, i) => { g.n = i + 1; g.nw = works.length; });
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

/* one-line summary, e.g. "8 × 0:20 / 0:10", "3 sets × 5 × 0:40 / 0:20", "5 × (0:30 / 0:20 / 0:10)" */
function summary(t) {
  const n = normalize(t);
  if (n.fartlek) return `${Math.round(n.fartlek.total / 60)} min of random ${n.fartlek.surgeMin}–${n.fartlek.surgeMax} s surges`;
  if (n.steps) {
    const w = n.steps.filter(x => x.k === 'work');
    if (n.steps.length > 4) return `${w.length * n.rounds * n.sets} efforts · ${fmtTime(w.reduce((a, x) => a + x.d, 0) * n.rounds * n.sets)} of work`;
    const p = n.steps.map(x => fmtTime(x.d)).join(' / ');
    return (n.sets > 1 ? `${n.sets} sets × ` : '') + (n.rounds > 1 ? `${n.rounds} × (${p})` : p);
  }
  const wr = n.rest ? `${fmtTime(n.work)} / ${fmtTime(n.rest)}` : fmtTime(n.work);
  if (n.rounds === 1 && n.sets === 1) return wr;
  return (n.sets > 1 ? `${n.sets} sets × ` : '') + `${n.rounds} × ${wr}`;
}

/* goals for the "what are you training for?" filter */
const GOALS = [['time', 'Short on time'], ['heart', 'Heart & endurance'], ['fitness', 'Fitness & VO₂max'], ['speed', 'Speed & power'], ['circuit', 'Circuits & strength']];
const ALLOUT = 'All-out sprints are very demanding. If you are new to hard exercise or have a heart condition, check with a doctor first, and build up gradually.';
const PRESETS = [
  { id: 'p-tabata', name: 'Tabata', blurb: '20 s all-out, 10 s rest, 8 rounds', goals: ['time', 'fitness'], warm: 0, work: 20, rest: 10, rounds: 8,
    info: { what: 'Eight 20-second bursts at maximum effort, each followed by 10 seconds of rest: 4 minutes in total.',
      how: 'Use a whole-body movement you can push flat out: cycling, rowing, burpees, jump squats. Warm up well first; the original study used a bike at well above maximal aerobic power.',
      why: 'Trains both the aerobic and anaerobic energy systems in very little time. True Tabata is brutally hard: if you can comfortably finish all 8 rounds, the effort was not all-out.',
      src: 'Tabata et al., Medicine & Science in Sports & Exercise, 1996.', note: ALLOUT } },
  { id: 'p-oneminute', name: 'One-Minute Workout', blurb: 'Gibala: 3 × 20 s all-out in 10 minutes', goals: ['time', 'fitness'], warm: 120, steps: [{ k: 'work', d: 20, n: 'All-out' }, { k: 'rest', d: 120, n: 'Easy' }], rounds: 3, cool: 180,
    info: { what: 'Ten minutes, with one minute of hard work: three 20-second all-out sprints, separated by 2 minutes of easy pedalling or jogging, plus a 2-minute warm-up and 3-minute cool-down.',
      how: 'Best on a bike. Sprint as hard as you can for the full 20 seconds; keep moving gently in between.',
      why: 'In McMaster University\'s 12-week study, this matched 45 minutes of moderate cycling for gains in aerobic fitness and insulin sensitivity, for a fifth of the time.',
      src: 'Gillen, Gibala et al., PLOS ONE, 2016 (Martin Gibala\'s lab, McMaster University).', note: ALLOUT } },
  { id: 'p-gibala10', name: 'Gibala 10 × 1', blurb: '10 × 1 min hard, 1 min easy', goals: ['fitness', 'heart'], warm: 180, work: 60, rest: 60, rounds: 10, cool: 120,
    info: { what: 'Ten 1-minute efforts at about 90 % of your maximum heart rate, each followed by 1 minute easy, with a 3-minute warm-up and 2-minute cool-down (24 minutes).',
      how: 'Hard but not all-out: you should be able to hold the same pace on every repeat. Works on a bike, treadmill, rower or running.',
      why: 'Gibala\'s "practical" HIIT model. Two weeks of it raised the muscles\' capacity to burn fuel aerobically about as much as much longer endurance training, and it is far more tolerable than all-out sprints.',
      src: 'Little, Gibala et al., Journal of Physiology, 2010 (McMaster University).' } },
  { id: 'p-gibalasit', name: 'Gibala sprint intervals', blurb: '4 × 30 s all-out, 4 min easy', goals: ['speed', 'fitness'], warm: 180, steps: [{ k: 'work', d: 30, n: 'All-out' }, { k: 'rest', d: 240, n: 'Easy' }], rounds: 4, cool: 180,
    info: { what: 'The original McMaster sprint protocol: 30-second all-out sprints ("Wingate" efforts) with 4 minutes of easy recovery. Start with 4 and build up to 6 over a few weeks.',
      how: 'On a bike against a heavy resistance, or uphill running. Go flat out from the first second; the long recovery is part of the method, so keep it easy.',
      why: 'Two weeks of this (about 2–3 minutes of actual sprinting per session) produced endurance adaptations similar to hours of steady training. Also builds peak power.',
      src: 'Gibala et al., Journal of Physiology, 2006; Burgomaster et al., Journal of Applied Physiology, 2005.', note: ALLOUT } },
  { id: 'p-little', name: 'Little method', blurb: '60 s hard, 75 s easy, 12 rounds', goals: ['fitness', 'heart'], warm: 0, work: 60, rest: 75, rounds: 12,
    info: { what: 'Twelve 60-second efforts at about 95 % of your maximal aerobic effort, each followed by 75 seconds of low-intensity recovery (about 26 minutes).',
      how: 'Hard, controlled efforts you can repeat. Keep the recovery genuinely easy. Add your own warm-up and cool-down with Customise.',
      why: 'A slightly longer-recovery variant of the 10 × 1 model from Jonathan Little\'s work with Gibala: a sustainable way to rack up high-intensity minutes.',
      src: 'Based on Little, Gibala et al., Journal of Physiology, 2010.' } },
  { id: 'p-102030', name: '10-20-30', blurb: '30 s slow, 20 s steady, 10 s sprint; 3 blocks', goals: ['speed', 'heart'], warm: 300,
    steps: [{ k: 'rest', d: 30, n: 'Slow' }, { k: 'work', d: 20, n: 'Steady' }, { k: 'work', d: 10, n: 'Sprint!' }], rounds: 5, sets: 3, setRest: 120,
    info: { what: 'Each minute: 30 seconds slow, 20 seconds at moderate pace, 10 seconds near-maximal sprint. Five minutes make a block; rest 2 minutes between blocks; do 3 to 5 blocks.',
      how: 'Designed for running (works on a bike too). The beeps count you into the steady and sprint parts and out of the sprint.',
      why: 'In the University of Copenhagen study, recreational runners improved their 5 km time and blood pressure on about half their usual training volume.',
      src: 'Gunnarsson & Bangsbo, Journal of Applied Physiology, 2012.' } },
  { id: 'p-4x4', name: '4 × 4 Norwegian', blurb: '4 min hard, 3 min easy, with warm-up and cool-down', goals: ['heart', 'fitness'], warm: 600, work: 240, rest: 180, rounds: 4, cool: 300,
    info: { what: 'Four 4-minute intervals at 85–95 % of maximum heart rate, with 3 minutes of active recovery (about 70 %) between them, plus warm-up and cool-down.',
      how: 'Running uphill, cycling or rowing. Heart rate takes a minute or two to climb, so the end of each interval is where you reach 90 %+.',
      why: 'One of the best-studied ways to raise VO₂max, used from elite sport to cardiac rehabilitation at the Norwegian University of Science and Technology (NTNU).',
      src: 'Helgerud et al., Medicine & Science in Sports & Exercise, 2007; Wisløff et al., Circulation, 2007.' } },
  { id: 'p-tempo', name: 'Tempo intervals', blurb: '3 × 5 min at threshold, 5 min easy', goals: ['heart', 'speed'], warm: 600, work: 300, rest: 300, rounds: 3, cool: 300,
    info: { what: 'Sustained efforts at your threshold ("comfortably hard": you could speak a few words, not a sentence), with equal easy recovery.',
      how: 'If you have an LTHR from Lead One ECG, aim for about 95–100 % of it. Shorter rests make it harder; longer repeats make it closer to a race.',
      why: 'Raises the pace or power you can hold for 20–60 minutes, the core of endurance performance.',
      src: 'Classic endurance training practice (for example Jack Daniels\' "cruise intervals").' } },
  { id: 'p-pyramid', name: 'Pyramid 1-2-3-2-1', blurb: 'Work 1, 2, 3, 2, 1 min with equal rest', goals: ['fitness'], warm: 300, rounds: 1, cool: 300,
    steps: [{ k: 'work', d: 60, n: '1 minute' }, { k: 'rest', d: 60 }, { k: 'work', d: 120, n: '2 minutes' }, { k: 'rest', d: 120 }, { k: 'work', d: 180, n: '3 minutes' }, { k: 'rest', d: 180 },
      { k: 'work', d: 120, n: '2 minutes' }, { k: 'rest', d: 120 }, { k: 'work', d: 60, n: '1 minute' }],
    info: { what: 'Intervals that step up from 1 to 3 minutes and back down, each followed by an equal rest.',
      how: 'Pace each step for its length: the 1-minute efforts fastest, the 3-minute one steadiest. Keep the second half as fast as the first.',
      why: 'Mixes speed and sustained effort in one session and keeps a long workout mentally engaging.',
      src: 'Common coaching format.' } },
  { id: 'p-fartlek', name: 'Fartlek', blurb: '20 min of random surges', goals: ['heart', 'speed'], warm: 300, cool: 300, fartlek: { total: 1200, surgeMin: 15, surgeMax: 60 },
    info: { what: '"Speed play" in Swedish. Instead of landmarks, Rounds calls surges at random: 15 to 60 seconds hard, with easy running in between. Every run is different.',
      how: 'Run or ride by feel: surges hard but controlled, easy parts truly easy. You hear the 3-2-1 before each surge, but you never know how long the next gap will be.',
      why: 'Builds the ability to change pace and recover on the move, as in races and field sports, with less monotony than fixed intervals.',
      src: 'Developed by Swedish coach Gösta Holmér in the 1930s.' } },
  { id: 'p-3030', name: '30 / 30', blurb: '30 s on, 30 s off, 10 rounds', goals: ['fitness', 'heart'], warm: 0, work: 30, rest: 30, rounds: 10,
    info: { what: '30 seconds fast, 30 seconds easy, repeated.',
      how: 'Run the fast parts at roughly your 3 km race pace and jog the easy parts. Build from 10 up to 20 or more repeats.',
      why: 'Lets you spend a long time close to your maximal aerobic speed, which drives VO₂max up.',
      src: 'Billat et al., European Journal of Applied Physiology, 2000.' } },
  { id: 'p-emom10', name: 'EMOM 10', blurb: 'Every minute on the minute, 10 minutes', goals: ['circuit', 'time'], warm: 0, work: 60, rest: 0, rounds: 10,
    info: { what: 'Every Minute On the Minute: at the start of each minute, do a set number of reps (for example 5 thrusters). Whatever is left of the minute is your rest.',
      how: 'Pick a number of reps you can finish in about 30–40 seconds. Add exercise names with Customise to alternate movements.',
      why: 'A simple way to keep a steady work-to-rest rhythm for strength or skill work without a coach.',
      src: 'Common CrossFit and strength-conditioning format.' } },
  { id: 'p-amrap15', name: 'AMRAP 15', blurb: 'As many rounds as possible in 15 minutes', goals: ['circuit'], warm: 0, work: 900, rest: 0, rounds: 1,
    info: { what: 'As Many Rounds As Possible: repeat a circuit of exercises, at your own pace, until the 15 minutes are up. Count your rounds.',
      how: 'Choose 3–5 exercises and reps (for example 10 push-ups, 15 squats, 20 sit-ups). Rest whenever you need to; the clock keeps running.',
      why: 'Self-paced and easy to compare: next time, try to beat your round count.',
      src: 'Common CrossFit format.' } },
  { id: 'p-hiit4020', name: 'HIIT 40 / 20', blurb: '5 exercises × 3 sets, 1 min between sets', goals: ['circuit', 'fitness'], warm: 0, work: 40, rest: 20, rounds: 5, sets: 3, setRest: 60,
    names: ['Squats', 'Push-ups', 'Lunges', 'Mountain climbers', 'Burpees'],
    info: { what: 'Five exercises, 40 seconds each with 20 seconds to change over, three times through with a minute between sets.',
      how: 'Swap in your own exercises with Customise; the names are shown and (if you turn on spoken cues) announced each round.',
      why: 'A full-body circuit that combines strength and conditioning in 16 minutes.',
      src: 'Common circuit-training format.' } },
  { id: 'p-boxing', name: 'Boxing rounds', blurb: '3 min rounds, 1 min rest, 12 rounds', goals: ['circuit', 'heart'], warm: 0, work: 180, rest: 60, rounds: 12,
    info: { what: 'The professional boxing round: 3 minutes on, 1 minute off. Twelve rounds is a full professional bout.',
      how: 'Bag work, pads, shadow boxing or skipping. Fewer rounds with Customise for a shorter session.',
      why: 'Builds the repeated high-output endurance that combat sports need.',
      src: 'Professional boxing rules.' } },
  { id: 'p-plank', name: 'Core 45 / 15', blurb: '45 s hold, 15 s switch, 8 rounds', goals: ['circuit', 'time'], warm: 0, work: 45, rest: 15, rounds: 8,
    names: ['Plank', 'Side plank (left)', 'Side plank (right)', 'Dead bug', 'Hollow hold', 'Bird dog', 'Glute bridge', 'Plank'],
    info: { what: 'Eight 45-second core holds with 15 seconds to switch.',
      how: 'The default exercises are shown each round; change them with Customise.',
      why: 'A short daily core routine.', src: 'Common format.' } }
];

// presets ranked hardest to easiest by overall demand: how hard the efforts are, how little rest they get, and how much
// there is in total. All-out sprint work ranks above steady hard work; self-paced sessions sit lower.
const HARDEST = ['p-tabata', 'p-gibalasit', 'p-4x4', 'p-hiit4020', 'p-boxing', 'p-little', 'p-gibala10', 'p-102030', 'p-3030',
  'p-tempo', 'p-amrap15', 'p-pyramid', 'p-oneminute', 'p-emom10', 'p-fartlek', 'p-plank'];
const Engine = { HARDEST, KIND_LABEL, LEAD_IN, GOALS, normalize, compile, roundSteps, fartlekSteps, totalDuration, beepPlan, locate, fmtTime, parseTime, summary, PRESETS };
if (typeof module !== 'undefined' && module.exports) module.exports = Engine; else globalThis.Engine = Engine;
