/* Rounds: optional live heart rate from any Bluetooth strap or watch that sends the standard Heart Rate signal
   (Polar, Garmin HRM-Dual/Pro, Wahoo TICKR, Coospo and most others). Works where the browser has Web Bluetooth:
   Chrome or Chromium on Android and desktop, and Bluefy on iPhone and iPad. Readings stay in memory on this device:
   nothing is saved or sent anywhere. */
(function (root) {
  'use strict';
  // Heart Rate Measurement (0x2A37): flags byte; bit 0 set = 16-bit value, else 8-bit
  function parseHR(view) {
    if (!view || view.byteLength < 2) return 0;
    const flags = view.getUint8(0);
    const bpm = flags & 1 ? (view.byteLength >= 3 ? view.getUint16(1, true) : 0) : view.getUint8(1);
    return bpm >= 25 && bpm <= 250 ? bpm : 0;
  }
  // average and peak of the readings taken during work (peak = highest 5-second average, so one glitch can't set it)
  function hrStats(samples) {
    const s = samples.filter(x => x.work && x.bpm);
    if (s.length < 3) return null;
    const avg = Math.round(s.reduce((a, x) => a + x.bpm, 0) / s.length);
    let peak = 0;
    for (let i = 0, j = 0, sum = 0; i < s.length; i++) {
      sum += s[i].bpm;
      while (s[i].t - s[j].t > 5) sum -= s[j++].bpm;
      if (i - j >= 2) peak = Math.max(peak, sum / (i - j + 1));
    }
    return { avg, peak: Math.max(avg, Math.round(peak)) };
  }
  const api = { parseHR, hrStats };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }

  const HR = root.HR = Object.assign(api, { supported: !!(root.navigator && navigator.bluetooth), bpm: 0, last: 0, device: null, state: 'off', onchange: null });
  const set = st => { HR.state = st; HR.onchange && HR.onchange(); };
  const onValue = e => { const b = parseHR(e.target.value); if (b) { HR.bpm = b; HR.last = performance.now(); HR.onchange && HR.onchange(); } };
  async function attach(dev) {
    set('connecting');
    const gatt = await dev.gatt.connect();
    const ch = await (await gatt.getPrimaryService('heart_rate')).getCharacteristic('heart_rate_measurement');
    ch.addEventListener('characteristicvaluechanged', onValue);
    await ch.startNotifications();
    set('on');
  }
  let tries = 0;
  async function reconnect() {   // straps drop out briefly when you move away or sweat breaks contact; keep trying quietly
    if (!HR.device || HR.state === 'off') return;
    set('lost');
    for (tries = 0; tries < 6 && HR.device && HR.state !== 'off'; tries++) {
      await new Promise(r => setTimeout(r, 1500 + tries * 1500));
      if (!HR.device || HR.state === 'off') return;
      try { await attach(HR.device); return; } catch (e) {}
    }
    if (HR.device && HR.state !== 'off' && HR.state !== 'on') set('lost');
  }
  HR.connect = async function () {
    if (!HR.supported) throw new Error('unsupported');
    const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
    if (HR.device && HR.device !== dev) HR.disconnect();
    HR.device = dev; HR.bpm = 0;
    dev.addEventListener('gattserverdisconnected', reconnect);
    try { await attach(dev); } catch (e) { HR.device = null; set('off'); throw e; }
  };
  HR.disconnect = function () {
    const d = HR.device; HR.device = null; HR.bpm = 0; set('off');
    if (d) { d.removeEventListener('gattserverdisconnected', reconnect); try { d.gatt.disconnect(); } catch (e) {} }
  };
  HR.fresh = () => HR.state === 'on' && HR.bpm && performance.now() - HR.last < 5000;
})(typeof window !== 'undefined' ? window : globalThis);
