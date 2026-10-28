# Changelog

## 1.4.0
- **Heart-rate zones** (optional, in Settings): enter your max heart rate, or your age to estimate it
  (208 − 0.7 × age), and optionally your resting heart rate to base the zones on heart-rate reserve. While a strap is
  connected, a ring of five coloured zones around the timer shows which zone you're in, and the finish screen shows
  your time in each zone. Stored only on this device, and included in *Save timers to file*.
- New thank-you line at the bottom of the start screen.
- Android releases are built in three steps, so the signing key and the permission to publish are each used in one
  place only, and the APK is checked for no internet permission before it is published. Branch builds made by hand
  are published as the "android-preview" test build.

## 1.3.1
- Links open in the same tab, and the page's security policy now blocks all connections (the offline helper
  still fetches newer copies of the app's own files).
- Timer names and heart rate are marked so a browser's Translate button leaves them out (translation sends the
  page's text to an online service). New Privacy section in the manual.
- **New home:** the website moved to Cloudflare Pages, with stricter security headers: no other site can show
  the app inside its own page, and browsers always use HTTPS.
- Shorter thank-you line at the bottom of the start screen.

## 1.3.0
- First public release, with the **Android app** alongside the web app. Download, install guide and checksums:
  https://rounds.anonacondacodelab.com/android.html
- Android app: the timer, beeps and spoken cues keep going with the screen off; no internet permission at all;
  **Check for updates** in Settings; links open in your browser or mail app.
- **Skip warm-up** button during a warm-up.
- The pause button shows ▶ while paused (it stayed ⏸).
- Spoken cues wait until the long go/stop beep has finished, so short words like “Rest” aren’t drowned out.
- Beeps stay in step with the timer: they allow for the phone's audio delay and are re-timed if the clocks drift apart.
- Android app: spoken cues use the media volume at full level, like the beeps (they were much quieter).
- **About Rounds** in Settings: version, licence, contact address (hello@anonacondacodelab.com), source code and manual.
- Source code published at https://github.com/Anonaconda-CodeLab/rounds. Releases are built from tagged source by GitHub
  Actions, with the APK's SHA-256 checksum and the signing certificate's fingerprint in every release.

## 1.2.4
- Android app: Back closes a preset's About sheet. User manual on the studio site.

## 1.2.3
- **Save timers to file** and **Import timers** in Settings: your timers, favourites and settings in one file.

## 1.2.2
- Timer controls and messages stay clear of Android's navigation bar.

## 1.2.1 and earlier
- 16 presets sorted by goal or hardest first, each explained with its source; your own timers with sets, custom steps
  and exercise names; full-screen colour, spoken cues, vibration, halfway beep; optional heart rate; favourites.
