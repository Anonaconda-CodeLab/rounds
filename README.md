# Rounds

**A loud, clear interval timer.** Pick a preset (Tabata, 4 × 4, EMOM, 30/30, HIIT 40/20, boxing rounds, core) or make
your own: warm-up, work, rest, rounds, sets with a break between them, cool-down, and optional exercise names.

- Three short beeps, one per second, count you **into** every work round, then a long high "go" beep; three more count you
  **out** of it, then a long low "stop" beep. Beeps are scheduled on the audio clock, so they stay on time.
- Full-screen colour for each phase, a big countdown inside a ring dial, spoken cues and vibration (optional).
- Optional live heart rate: tap ♥ beside the dial to connect any Bluetooth strap or watch that shares the standard heart
  rate signal (Polar, Garmin HRM-Dual/Pro, Wahoo TICKR, Coospo and most others). The finish screen shows your average and
  peak heart rate in the work rounds. Needs Web Bluetooth: Chrome or Chromium on Android or desktop, or Bluefy on iPhone
  and iPad; elsewhere the button simply doesn't appear. Readings are shown only, never saved or sent.
- Free and open source. No account, no ads, no tracking. Timers are stored on your device and never sent anywhere; the web
  app only fetches newer copies of its own files, and works offline once added to the home screen.

## Android app
Download the APK from the [latest release](https://github.com/Anonaconda-CodeLab/rounds/releases/latest). The
[install guide](https://rounds.anonacondacodelab.com/android.html) explains how to install it, check that it's the
official build (SHA-256 checksum and signing-certificate fingerprint) and keep it up to date, for example with Obtainium.
It isn't on Google Play: we support [Keep Android Open](https://keepandroidopen.org). How it's built, and how to build and
sign your own: [mobile/README.md](mobile/README.md).

## Manual and support
The user manual is at https://anonacondacodelab.com/rounds/manual/ (source: [docs/MANUAL.md](docs/MANUAL.md)).
Questions or problems: **hello@anonacondacodelab.com**. Security issues: see [SECURITY.md](SECURITY.md). Changes are
listed in [CHANGELOG.md](CHANGELOG.md).

## Development
Plain HTML, CSS and JavaScript. `engine.js` holds the timer logic and `hr.js` the heart-rate connection; both are tested with `npm test`.
`node build.mjs` copies the app's own files into `dist/`, which is what the website publishes (Cloudflare Pages runs the
build; `_headers` holds the HTTP headers) and what the
Android app in `mobile/` is made from.

© 2026 Anonaconda Code Lab. GNU General Public License v3.0 or later (see `LICENSE`). Fonts: Instrument Sans and IBM Plex
Mono, SIL Open Font License; the Android app's components (MIT and Apache-2.0) are listed in [NOTICE.md](NOTICE.md).
