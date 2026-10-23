/* Rounds: screens, storage, sound. Everything stays on this device.
   Copyright (C) 2026 Anonaconda Code Lab · SPDX-License-Identifier: GPL-3.0-or-later */
'use strict';
const VERSION = '1.3.0';
const $ = s => document.querySelector(s);
const E = window.Engine;

/* ---------- storage (localStorage; the app works without it) ---------- */
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem('rounds.' + k)); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('rounds.' + k, JSON.stringify(v)); } catch (e) {} }
};
let mine = store.get('timers', []).map(E.normalize).filter(t => t.id);
const settings = Object.assign({ voice: false, vibrate: true, half: false }, store.get('settings', {}));
const saveMine = () => store.set('timers', mine);
let favs = new Set(store.get('favs', []));
const saveFavs = () => store.set('favs', [...favs]);

let toastT;
function toast(msg, ms = 3000) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, ms); }
function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  document.body.dataset.screen = id; window.scrollTo(0, 0);
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- home ---------- */
const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5l13 7.5-13 7.5z"/></svg>';
function card(t, preset, rank) {
  const total = E.fmtTime(E.totalDuration(E.compile(t)) - E.LEAD_IN);
  const fav = favs.has(t.id);
  return `<li class="card"><div class="info"><h3>${rank ? `<span class="rank" title="Difficulty rank, 1 = hardest">#${rank}</span>` : ''}${esc(t.name)}<button class="star${fav ? ' on' : ''}" data-fav="${esc(t.id)}" aria-pressed="${fav}" aria-label="${fav ? 'Remove from' : 'Add to'} favourites">${fav ? '★' : '☆'}</button></h3>
    <div class="meta"><b>${esc(E.summary(t))}</b> · ${total}</div>${preset && t.blurb ? `<div class="blurb">${esc(t.blurb)}</div>` : ''}
    <div class="links">${preset && t.info ? `<button class="link" data-about="${esc(t.id)}">About</button>` : ''}<button class="link" data-edit="${esc(t.id)}">${preset ? 'Customise' : 'Edit'}</button></div></div>
    <button class="play" data-start="${esc(t.id)}" aria-label="Start ${esc(t.name)}">${PLAY}</button></li>`;
}
function renderHome() {
  const all = [...mine.map(t => [t, false]), ...E.PRESETS.map(t => [t, true])];
  favs = new Set([...favs].filter(id => all.some(([t]) => t.id === id)));   // forget favourites that were deleted
  const fv = [...favs].map(id => all.find(([t]) => t.id === id)).filter(Boolean);
  $('#favHead').hidden = !fv.length;
  $('#favList').innerHTML = fv.map(([t, p]) => card(t, p)).join('');
  const myRest = mine.filter(t => !favs.has(t.id));
  $('#mineHead').hidden = !myRest.length;
  $('#mineList').innerHTML = myRest.map(t => card(t, false)).join('');
  const pr = E.PRESETS.filter(t => !favs.has(t.id) && (!goal || (t.goals || []).includes(goal)));
  $('#goalChips').innerHTML = [['', 'All']].concat(E.GOALS).map(([k, l]) => `<button data-goal="${k}" aria-pressed="${goal === k}">${esc(l)}</button>`).join('');
  $('#presetHead').hidden = !E.PRESETS.some(t => !favs.has(t.id));
  const rk = id => E.HARDEST.indexOf(id) + 1 || 99;
  if (hard) pr.sort((a, b) => rk(a.id) - rk(b.id));
  $('#btnHard').setAttribute('aria-pressed', hard); $('#hardNote').hidden = !hard;
  $('#presetList').innerHTML = pr.map(t => card(t, true, hard ? rk(t.id) : 0)).join('');
}
let goal = store.get('goal', ''), hard = !!store.get('hard', false);
$('#btnHard').onclick = () => { hard = !hard; store.set('hard', hard); renderHome(); };
const findTimer = id => mine.find(t => t.id === id) || E.PRESETS.find(t => t.id === id);
document.addEventListener('click', e => {
  const s = e.target.closest('[data-start]'), ed = e.target.closest('[data-edit]'), fv = e.target.closest('[data-fav]'), ab = e.target.closest('[data-about]'), gl = e.target.closest('[data-goal]');
  if (gl) { goal = gl.dataset.goal; store.set('goal', goal); renderHome(); }
  else if (ab) openAbout(findTimer(ab.dataset.about));
  else if (fv) { const id = fv.dataset.fav; if (favs.has(id)) favs.delete(id); else favs.add(id); saveFavs(); renderHome(); toast(favs.has(id) ? 'Added to favourites.' : 'Removed from favourites.', 1800); }
  else if (s) { const t = findTimer(s.dataset.start); if (t) startRun(t); }
  else if (ed) { const t = findTimer(ed.dataset.edit); if (t) openEditor(t, !t.id.startsWith('u-')); }
});

/* ---------- about sheet ---------- */
let aboutT = null;
function openAbout(t) {
  if (!t || !t.info) return; aboutT = t;
  $('#shTitle').textContent = t.name;
  $('#shSum').textContent = E.summary(t) + ' · ' + E.fmtTime(E.totalDuration(E.compile(t)) - E.LEAD_IN);
  $('#shWhat').textContent = t.info.what; $('#shHow').textContent = t.info.how; $('#shWhy').textContent = t.info.why;
  $('#shNote').textContent = t.info.note || ''; $('#shNote').hidden = !t.info.note;
  $('#shSrc').textContent = 'Source: ' + t.info.src;
  $('#sheet').hidden = false; $('#btnShClose').focus();
}
const closeAbout = () => { $('#sheet').hidden = true; };
$('#btnShClose').onclick = closeAbout;
$('#sheet').onclick = e => { if (e.target.id === 'sheet') closeAbout(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeAbout(); });
$('#btnShStart').onclick = () => { closeAbout(); startRun(aboutT); };
$('#btnShEdit').onclick = () => { closeAbout(); openEditor(aboutT, true); };

/* ---------- editor ---------- */
let editing = null, editIsCopy = false;
const STEP = v => v < 60 ? 5 : v < 300 ? 15 : 30;
function stepper(el) {
  const kind = el.dataset.kind, min = +(el.dataset.min || 0), max = +(el.dataset.max || 3600);
  el.innerHTML = `<button type="button" aria-label="Less">−</button><input inputmode="${kind === 'time' ? 'text' : 'numeric'}" aria-label="${el.dataset.label || (el.closest('.field') ? el.closest('.field').querySelector('span').textContent : 'Time')}"><button type="button" aria-label="More">+</button>`;
  const inp = el.querySelector('input'), [dec, inc] = el.querySelectorAll('button');
  const get = () => +(el.dataset.val || 0);
  const set = v => { v = Math.max(min, Math.min(max, Math.round(v))); el.dataset.val = v; inp.value = kind === 'time' ? E.fmtTime(v) : String(v); updateTotal(); };
  dec.onclick = () => set(kind === 'time' ? get() - STEP(get() - 1) : get() - 1);
  inc.onclick = () => set(kind === 'time' ? get() + STEP(get()) : get() + 1);
  inp.onchange = () => { const v = kind === 'time' ? E.parseTime(inp.value) : parseInt(inp.value, 10); if (Number.isFinite(v)) set(v); else set(get()); };
  inp.onfocus = () => inp.select();
  el._set = set;
}
document.querySelectorAll('.stepper[data-key]').forEach(stepper);
const steppers = () => [...document.querySelectorAll('.stepper[data-key]')];
let mode = 'simple';   // simple work/rest, custom steps, or fartlek
function setMode(m) { mode = m; $('#modeSimple').hidden = m !== 'simple'; $('#modeSteps').hidden = m !== 'steps'; $('#modeFartlek').hidden = m !== 'fartlek'; $('#repeatGrid').hidden = m === 'fartlek'; updateTotal(); }
function stepRow(st) {
  const li = document.createElement('li');
  li.innerHTML = `<button type="button" class="kind"></button><div class="stepper" data-kind="time" data-min="1" data-label="Step length"></div><input class="nm" maxlength="30" placeholder="Name (optional)"><button type="button" class="del" aria-label="Remove step">×</button>`;
  const kb = li.querySelector('.kind'), setKind = k => { li.dataset.k = k; kb.textContent = k === 'work' ? 'Work' : 'Rest'; kb.classList.toggle('rest', k === 'rest'); updateTotal(); };
  kb.onclick = () => setKind(li.dataset.k === 'work' ? 'rest' : 'work');
  li.querySelector('.del').onclick = () => { if ($('#stepList').children.length > 1) { li.remove(); updateTotal(); } };
  const nm = li.querySelector('.nm'); nm.value = st.n || ''; nm.oninput = updateTotal;
  const sp = li.querySelector('.stepper'); stepper(sp); sp._set(st.d);
  setKind(st.k); return li;
}
function setSteps(steps) { const ol = $('#stepList'); ol.innerHTML = ''; for (const st of steps) ol.appendChild(stepRow(st)); }
const readSteps = () => [...$('#stepList').children].map(li => ({ k: li.dataset.k, d: +(li.querySelector('.stepper').dataset.val || 0), n: li.querySelector('.nm').value }));
$('#btnAddStep').onclick = () => { const last = readSteps().pop(); $('#stepList').appendChild(stepRow({ k: last && last.k === 'work' ? 'rest' : 'work', d: last ? last.d : 30 })); updateTotal(); };
$('#btnToSteps').onclick = () => { const t = formTimer(); setSteps(E.roundSteps(Object.assign({}, t, { steps: null }))); setMode('steps'); };
$('#btnToSimple').onclick = () => { const w = readSteps().find(x => x.k === 'work'), r = readSteps().find(x => x.k === 'rest'); if (w) steppers().find(el => el.dataset.key === 'work')._set(w.d); steppers().find(el => el.dataset.key === 'rest')._set(r ? r.d : 0); setMode('simple'); };
function formTimer() {
  const t = { id: editing && !editIsCopy ? editing.id : '', name: $('#fName').value.trim() || 'My timer', names: $('#fNames').value.split('\n') };
  for (const el of steppers()) t[el.dataset.key] = +(el.dataset.val || 0);
  if (mode === 'steps') t.steps = readSteps();
  if (mode === 'fartlek') t.fartlek = { total: t.fTotal, surgeMin: t.fMin, surgeMax: t.fMax };
  return E.normalize(t);
}
function updateTotal() {
  if (!$('#fName')) return;
  const t = formTimer();
  $('#fTotal').textContent = E.fmtTime(E.totalDuration(E.compile(t)) - E.LEAD_IN);
  $('#fSummary').textContent = '· ' + E.summary(t);
  $('#setRestField').hidden = t.sets < 2;
}
function openEditor(t, asCopy) {
  editing = t; editIsCopy = !!asCopy;
  const base = E.normalize(t || { name: '', work: 30, rest: 15, rounds: 8, sets: 1 });
  $('#editTitle').textContent = !t ? 'New timer' : asCopy ? 'Customise' : 'Edit timer';
  $('#fName').value = t ? (asCopy ? base.name + ' (mine)' : base.name) : '';
  $('#fNames').value = base.names.join('\n');
  const f = base.fartlek || { total: 1200, surgeMin: 15, surgeMax: 60 };
  Object.assign(base, { fTotal: f.total, fMin: f.surgeMin, fMax: f.surgeMax });
  for (const el of steppers()) el._set(base[el.dataset.key]);
  if (base.steps) setSteps(base.steps);
  setMode(base.fartlek ? 'fartlek' : base.steps ? 'steps' : 'simple');
  $('#btnDelete').hidden = !t || asCopy;
  updateTotal(); show('edit');
}
$('#fNames').oninput = updateTotal;
$('#btnNew').onclick = () => openEditor(null, false);
$('#btnEditBack').onclick = () => { renderHome(); show('home'); };
function saveForm() {
  const t = formTimer();
  if (!t.id) { t.id = 'u-' + Date.now().toString(36); mine.unshift(t); } else { const i = mine.findIndex(x => x.id === t.id); if (i >= 0) mine[i] = t; else mine.unshift(t); }
  saveMine(); editing = t; editIsCopy = false; $('#btnDelete').hidden = false; $('#editTitle').textContent = 'Edit timer';
  return t;
}
$('#btnSave').onclick = () => { saveForm(); toast('Saved.'); renderHome(); show('home'); };
$('#btnEditStart').onclick = () => startRun(formTimer());
$('#btnDelete').onclick = function () {
  if (!this.dataset.arm) { this.dataset.arm = 1; this.textContent = 'Tap again to delete'; setTimeout(() => { delete this.dataset.arm; this.textContent = 'Delete'; }, 3000); return; }
  mine = mine.filter(x => x.id !== editing.id); saveMine(); favs.delete(editing.id); saveFavs(); delete this.dataset.arm; this.textContent = 'Delete'; renderHome(); show('home'); toast('Deleted.');
};

/* ---------- settings ---------- */
const bindSwitch = (id, key) => { const el = $(id); el.checked = !!settings[key]; el.onchange = () => { settings[key] = el.checked; store.set('settings', settings); }; };
bindSwitch('#sVoice', 'voice'); bindSwitch('#sVibrate', 'vibrate'); bindSwitch('#sHalf', 'half');
$('#btnSettings').onclick = () => show('settings');
$('#btnSetBack').onclick = () => show('home');
$('#btnTest').onclick = () => { const a = audio(); if (!a) return; const t0 = a.currentTime + 0.1; ['count', 'count', 'count', 'go'].forEach((k, i) => beepAt(k, t0 + i)); setTimeout(() => { const t1 = a.currentTime + 0.1; ['count', 'count', 'count', 'stop'].forEach((k, i) => beepAt(k, t1 + i)); }, 5200); toast('Into work: 3-2-1-go. Then out of work: 3-2-1-stop.', 9000); };

/* ---------- backup: your timers, favourites and settings in one file ---------- */
function saveFile(name, text) {
  if (NATIVE) { AppNative.saveFile(name, text, 'application/json').then(r => { if (r.saved) toast('Saved.'); }).catch(e => toast('Could not save the file: ' + (e && e.message || e), 5000)); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
$('#btnSaveTimers').onclick = () => {
  if (!mine.length && !favs.size) { toast('You have no timers of your own yet.'); return; }
  const d = new Date(), p = n => String(n).padStart(2, '0');
  const data = { app: 'Rounds', kind: 'timers', version: VERSION, saved: d.toISOString(), timers: mine, favs: [...favs], settings, goal, hard };
  saveFile(`Rounds-timers-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`, JSON.stringify(data, null, 1));
};
$('#btnLoadTimers').onclick = () => $('#timersIn').click();
$('#timersIn').onchange = async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
  let data; try { data = JSON.parse(await f.text()); } catch (err) { toast('That file couldn’t be read.', 4000); return; }
  if (!data || data.app !== 'Rounds' || !Array.isArray(data.timers)) { toast('That isn’t a Rounds timers file.', 4000); return; }
  const incoming = data.timers.slice(0, 500).map(E.normalize).filter(t => t.id && !E.PRESETS.some(p => p.id === t.id));
  let added = 0, updated = 0;
  for (const t of incoming) { const i = mine.findIndex(x => x.id === t.id); if (i >= 0) { mine[i] = t; updated++; } else { mine.push(t); added++; } }
  saveMine();
  const ids = new Set([...mine.map(t => t.id), ...E.PRESETS.map(t => t.id)]);
  if (Array.isArray(data.favs)) { for (const id of data.favs) if (ids.has(id)) favs.add(id); saveFavs(); }
  if (data.settings && typeof data.settings === 'object') {
    for (const k of ['voice', 'vibrate', 'half']) if (typeof data.settings[k] === 'boolean') settings[k] = data.settings[k];
    store.set('settings', settings); $('#sVoice').checked = settings.voice; $('#sVibrate').checked = settings.vibrate; $('#sHalf').checked = settings.half;
  }
  renderHome();
  toast(added || updated ? `Imported ${added + updated} timer${added + updated === 1 ? '' : 's'}${updated ? ` (${updated} replaced)` : ''}.` : 'No timers in that file.', 4000);
};

/* ---------- sound: loud square-wave beeps through a limiter ---------- */
let AC = null, bus = null, scheduled = [];
function audio() {
  try {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      const comp = AC.createDynamicsCompressor(); comp.threshold.value = -18; comp.knee.value = 0; comp.ratio.value = 20; comp.attack.value = 0.001; comp.release.value = 0.05;
      const g = AC.createGain(); g.gain.value = 1.75; comp.connect(g); g.connect(AC.destination); bus = comp;
    }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  } catch (e) { return null; }
}
const TONES = { count: [[1600, 0.14]], go: [[2400, 0.7]], stop: [[1100, 0.7]], half: [[1600, 0.1]], done: [[1600, 0.22, 0], [2000, 0.22, 0.28], [2400, 0.6, 0.56]] };
function beepAt(type, when) {
  const a = AC; if (!a || !bus) return;
  for (const [f, d, off = 0] of TONES[type]) {
    const o = a.createOscillator(), g = a.createGain(), t = when + off;
    o.type = 'square'; o.frequency.value = f; o.connect(g); g.connect(bus);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.008); g.gain.setValueAtTime(0.9, t + d - 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.start(t); o.stop(t + d + 0.03); scheduled.push({ o, t });
  }
}
/* all beeps (pause, stop, seek), or only those that haven't started yet (resync, so a beep that is playing isn't cut off) */
function cancelBeeps(futureOnly) {
  const now = AC ? AC.currentTime : 0, keep = [];
  for (const x of scheduled) { if (futureOnly && x.t <= now + 0.01) { keep.push(x); continue; } try { x.o.stop(); x.o.disconnect(); } catch (e) {} }
  scheduled = keep;
}

/* ---------- run ---------- */
const R = { hr: [], t: null, segs: [], beeps: [], t0: 0, paused: false, pauseAt: 0, idx: -1, done: false, raf: 0, iv: 0 };
const now = () => performance.now() / 1000;
const curT = () => R.paused ? R.pauseAt : now() - R.t0;
/* All remaining beeps go to the audio clock, so they stay on time even if the screen is busy. They are scheduled earlier
   by the device's output latency (often 0.1 to 0.3 s on Android), so you hear them when the timer shows the change. */
const audioLag = a => Math.min(0.5, Math.max(0, (a.outputLatency || 0) + (a.baseLatency || 0)));
function schedule(resync) {
  cancelBeeps(resync); const a = audio(); if (!a) return;
  const t = curT(), off = a.currentTime - t, lag = audioLag(a);
  R.audioOff = off;
  // a fresh start includes the beep at 0; a resync skips beeps that are already playing
  for (const b of R.beeps) if (b.t > t + (resync ? 0.03 : -0.06)) beepAt(b.type, Math.max(a.currentTime + 0.01, off + b.t - lag));
}
/* the audio clock and the screen's clock can drift apart (or the audio can start late); if they do, reschedule */
function checkDrift() {
  if (!AC || R.paused || R.done || R.audioOff == null || AC.state !== 'running') return;
  // the audio clock moves in small steps, so only a drift seen twice in a row and over 0.1 s counts
  const drift = Math.abs(AC.currentTime - curT() - R.audioOff);
  R.driftSeen = drift > 0.1 ? (R.driftSeen || 0) + 1 : 0;
  if (R.driftSeen >= 2) { R.driftSeen = 0; schedule(true); }
}
function halfBeeps(segs) {
  if (!settings.half) return [];
  return segs.filter(g => g.kind === 'work' && g.dur >= 120).map(g => ({ t: g.start + g.dur / 2, type: 'half' }));
}
let wakeLock = null;
async function keepAwake() { if (NATIVE) { AppNative.keepScreenOn(true); AppNative.active(true, 'Workout running'); return; } try { if (navigator.wakeLock && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => wakeLock = null); } } catch (e) {} }
function letSleep() { if (NATIVE) { AppNative.keepScreenOn(false); AppNative.active(false); return; } try { wakeLock && wakeLock.release(); } catch (e) {} wakeLock = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && document.body.dataset.screen === 'run' && !R.done) { keepAwake(); render(); } });

function speak(text) {
  if (!settings.voice) return;
  if (NATIVE) { AppNative.speak(text); return; }   // Android's WebView has no speechSynthesis; the phone's own voice is used
  if (!('speechSynthesis' in window)) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1.05; u.volume = 1; speechSynthesis.speak(u); } catch (e) {}
}
function vibrate(p) { if (settings.vibrate && NATIVE) { AppNative.vibrate(p); return; } if (settings.vibrate && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} }

function startRun(t) {
  R.t = E.normalize(t); R.segs = E.compile(R.t, Date.now()); R.beeps = E.beepPlan(R.segs).concat(halfBeeps(R.segs));
  R.t0 = now(); R.paused = false; R.idx = -1; R.done = false; R.hr = []; $('#fHR').hidden = true; drawHR();
  $('#rName').textContent = R.t.name; $('#finish').hidden = true; setPaused(false); disarmEnd();
  document.body.dataset.phase = 'ready'; show('run');
  audio(); schedule(); keepAwake(); speak('Get ready');
  cancelAnimationFrame(R.raf); clearInterval(R.iv);
  const loop = () => { render(); if (!R.done) R.raf = requestAnimationFrame(loop); };
  R.raf = requestAnimationFrame(loop); R.iv = setInterval(render, 250);   // the interval keeps going when frames stop
}
function phaseWords(g) {
  const lab = E.KIND_LABEL[g.kind];
  if (g.kind !== 'work') return g.label || lab;
  return (g.label ? g.label + '. ' : 'Work. ') + (g.rounds > 1 ? `Round ${g.round} of ${g.rounds}` : '');
}
function render() {
  if (document.body.dataset.screen !== 'run' || R.done) return;
  const t = curT(), total = E.totalDuration(R.segs), L = E.locate(R.segs, t), g = L.seg;
  if (t >= total) return finish();
  checkDrift();
  if (L.i !== R.idx) {
    const first = R.idx < 0; R.idx = L.i;
    document.body.dataset.phase = g.kind;
    $('#rPhase').textContent = E.KIND_LABEL[g.kind];
    $('#rLabel').textContent = g.label || '';
    const inRound = g.kind === 'work' || g.kind === 'rest' || g.kind === 'setrest';
    $('#rRound').textContent = !inRound ? '' : g.rounds > 1 || g.sets > 1 ? `Round ${g.round} / ${g.rounds}${g.sets > 1 ? ` · Set ${g.set} / ${g.sets}` : ''}`
      : g.kind === 'work' && g.nw > 1 ? `Effort ${g.n} / ${g.nw}` : '';
    const nx = R.segs[L.i + 1];
    $('#rNext').textContent = nx ? `Next: ${nx.label || E.KIND_LABEL[nx.kind]} ${E.fmtTime(nx.dur)}` : 'Last one';
    $('#rStatus').textContent = phaseWords(g);
    $('#btnSkipWarm').hidden = g.kind !== 'warm';
    if (!first && !R.paused) { speak(phaseWords(g)); vibrate(g.kind === 'work' ? [350] : [150, 90, 150]); }
  }
  const left = Math.ceil(L.left - 1e-6);
  $('#rTime').textContent = E.fmtTime(left);
  // the ring empties clockwise from 12 o'clock; the dot leads it like a clock hand (the dial is drawn rotated so 0 is at the top)
  $('#rArc').style.strokeDasharray = (1000 * (1 - L.frac)).toFixed(1) + ' 1000';
  $('#rArc').style.strokeDashoffset = (-1000 * L.frac).toFixed(1);
  const a = 2 * Math.PI * L.frac;
  $('#rDot').setAttribute('cx', (100 + 88 * Math.cos(a)).toFixed(2));
  $('#rDot').setAttribute('cy', (100 + 88 * Math.sin(a)).toFixed(2));
  $('#rTotal').textContent = E.fmtTime(total - t);
  $('#rBar').style.width = (100 * Math.min(1, t / total)).toFixed(2) + '%';
}
function finish() {
  R.done = true; cancelAnimationFrame(R.raf); clearInterval(R.iv); letSleep();
  document.body.dataset.phase = 'done';
  const work = R.segs.filter(g => g.kind === 'work');
  $('#fDone').textContent = `${work.length} work round${work.length === 1 ? '' : 's'} · ${E.fmtTime(E.totalDuration(R.segs) - E.LEAD_IN)} in total`;
  const hs = window.HR ? HR.hrStats(R.hr) : null;
  $('#fHR').hidden = !hs; if (hs) $('#fHR').textContent = `♥ Work rounds: ${hs.avg} bpm average · ${hs.peak} peak`;
  $('#finish').hidden = false; speak('Finished. Well done.'); vibrate([200, 100, 200, 100, 400]);
}
function setPaused(p) {
  $('#icPause').hidden = p; $('#icPlay').hidden = !p; $('#btnPause').setAttribute('aria-label', p ? 'Resume' : 'Pause');
}
function seek(t) {   // jump to time t (seconds from Start)
  t = Math.max(0, Math.min(t, E.totalDuration(R.segs) - 0.05));
  if (R.paused) R.pauseAt = t; else R.t0 = now() - t;
  R.idx = -2; if (!R.paused) schedule(); render();
}
$('#btnPause').onclick = () => {
  if (R.done) return;
  if (!R.paused) { R.pauseAt = curT(); R.paused = true; cancelBeeps(); try { speechSynthesis.cancel(); } catch (e) {} letSleep(); }
  else { R.t0 = now() - R.pauseAt; R.paused = false; schedule(); keepAwake(); }
  setPaused(R.paused); render();
};
$('#btnSkipWarm').onclick = () => { const L = E.locate(R.segs, curT()); if (L.seg && L.seg.kind === 'warm') seek(L.seg.start + L.seg.dur); };
$('#btnNext').onclick = () => { const L = E.locate(R.segs, curT()); const nx = R.segs[L.i + 1]; if (nx) seek(nx.start); else finish(); };
$('#btnPrev').onclick = () => { const t = curT(), L = E.locate(R.segs, t); seek(t - L.seg.start > 2 || L.i === 0 ? L.seg.start : R.segs[L.i - 1].start); };
function disarmEnd() { const b = $('#btnEnd'); b.classList.remove('armed'); b.textContent = 'End'; delete b.dataset.arm; }
$('#btnEnd').onclick = function () {
  if (!this.dataset.arm && !R.done) { this.dataset.arm = 1; this.classList.add('armed'); this.textContent = 'Tap to end'; setTimeout(disarmEnd, 3000); return; }
  stopRun();
};
function stopRun() { R.done = true; cancelAnimationFrame(R.raf); clearInterval(R.iv); cancelBeeps(); letSleep(); try { speechSynthesis.cancel(); } catch (e) {} delete document.body.dataset.phase; renderHome(); show('home'); }
$('#btnAgain').onclick = () => startRun(R.t);
$('#btnHome').onclick = stopRun;
document.addEventListener('keydown', e => { if (document.body.dataset.screen === 'run' && e.code === 'Space') { e.preventDefault(); $('#btnPause').click(); } });

/* ---------- heart rate (optional) ---------- */
function drawHR() {
  const b = $('#btnHR'); if (!window.HR || !HR.supported) return;
  b.hidden = false;
  const st = HR.state === 'on' && !HR.fresh() ? 'lost' : HR.state;
  const h = $('#btnHRHome'); h.hidden = false; h.dataset.st = st;
  $('#hrHomeVal').textContent = st === 'off' ? 'Connect' : st === 'connecting' ? '…' : HR.bpm && st === 'on' ? HR.bpm : '–';
  if (HR.bpm) h.style.setProperty('--beat', (60 / HR.bpm).toFixed(2) + 's');
  h.setAttribute('aria-label', st === 'off' ? 'Connect a heart-rate strap' : `Heart rate ${HR.bpm || 'not available'}. Tap twice to disconnect`);
  b.dataset.st = st;
  $('#hrVal').textContent = st === 'off' ? '+' : HR.bpm && st !== 'connecting' ? HR.bpm : '–';
  $('#hrSub').textContent = st === 'off' ? 'HR' : st === 'connecting' ? '…' : 'BPM';
  if (HR.bpm) b.style.setProperty('--beat', (60 / HR.bpm).toFixed(2) + 's');
  b.setAttribute('aria-label', st === 'off' ? 'Connect a heart-rate strap' : `Heart rate ${HR.bpm || 'not available'}. Tap to disconnect`);
}
if (window.HR) {
  HR.onchange = () => {
    drawHR();
    if (HR.fresh() && document.body.dataset.screen === 'run' && !R.done && !R.paused) {
      const t = curT(), L = E.locate(R.segs, t);
      R.hr.push({ t, bpm: HR.bpm, work: L.seg && L.seg.kind === 'work' });
    }
  };
  setInterval(() => { if (HR.state !== 'off') drawHR(); }, 2000);   // greys out if readings stop
}
$('#btnHR').onclick = $('#btnHRHome').onclick = async () => {
  if (HR.state !== 'off') { if (confirmHR()) HR.disconnect(); return; }
  try { await HR.connect(); toast('Heart rate connected'); }
  catch (e) { drawHR(); if (e && e.name !== 'NotFoundError') toast('Could not connect. Check the strap is on and not connected to another app.', 5000); }
};
let hrArm = 0;
function confirmHR() { const n = Date.now(); if (n - hrArm < 3000) { hrArm = 0; return true; } hrArm = n; toast('Tap ♥ again to disconnect'); return false; }

/* ---------- start ---------- */
$('#ver').textContent = VERSION; $('#aboutVer').textContent = VERSION;
$('#btnUpdates').href = 'https://rounds.anonacondacodelab.com/android.html?v=' + VERSION;   // the page says whether a newer version exists
renderHome(); drawHR();
/* Android Back button: back inside the app; on the home screen or during a timer the app moves to the background */
window.appBack = () => {
  const scr = document.body.dataset.screen || 'home';
  if (!$('#sheet').hidden) { closeAbout(); return true; }   // a preset's About sheet closes first
  if (scr === 'home' || scr === 'run' && !R.done) return false;
  const btn = { edit: '#btnEditBack', settings: '#btnSetBack', run: '#btnHome' }[scr];
  if (btn) $(btn).click(); else show('home');
  return true;
};
if ('serviceWorker' in navigator && !NATIVE && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
