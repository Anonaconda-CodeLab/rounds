/* Copyright (C) 2026 Anonaconda Code Lab · SPDX-License-Identifier: GPL-3.0-or-later
   Android download page: when opened from the app's "Check for updates" (android.html?v=1.2.3), says whether a newer version exists. */
(function () {
  var latest = document.documentElement.getAttribute('data-latest'), m = /[?&]v=(\d+\.\d+\.\d+)\b/.exec(location.search), el = document.getElementById('status');
  if (!m) return;
  var a = m[1].split('.').map(Number), b = latest.split('.').map(Number), cmp = 0;
  for (var i = 0; i < 3 && !cmp; i++) cmp = a[i] - b[i];
  el.hidden = false;
  if (cmp >= 0) { el.className = 'banner ok'; el.textContent = 'You have the latest version (' + m[1] + ').'; }
  else { el.className = 'banner new'; el.textContent = 'Version ' + latest + ' is available. You have ' + m[1] + '. Download it below; it installs over your current version and keeps your timers.'; }
})();
