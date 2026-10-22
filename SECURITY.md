# Security and privacy

## Design
- **No outside connections.** The site's Content Security Policy (`_headers`, also in `index.html`) only allows the app's
  own files (`default-src 'none'`, scripts, styles, fonts and connections from the same site only), so it cannot send
  anything elsewhere, even if malicious code were injected. There are no external scripts, analytics or trackers. The only
  outbound links (source code, manual, Ko-fi, email) open in a new, isolated tab (`rel="noopener noreferrer"`).
- **Local storage only.** Timers, favourites and settings are stored in the browser's localStorage on the user's own
  device. Nothing is uploaded. Data leaves the device only when the user saves a timers file.
- **Untrusted input.** Imported timer files are validated (types, ranges, lengths) and all text is HTML-escaped before
  display.
- **Heart rate (optional).** Only devices offering the standard heart-rate service are requested. Readings stay in memory
  for the finish screen; they are never saved or sent.

## Android app
- **No internet permission.** It is removed in the manifest, and every build fails if it reappears. The app cannot
  connect to anything but a heart-rate strap. Links (source code, Ko-fi, email, Check for updates) open in your browser or mail
  app, outside the app.
- **Permissions:** Bluetooth for the optional heart-rate strap (Nearby devices; location only on Android 11 and older, where
  Bluetooth scanning requires it), notifications and a foreground service (so the timer, beeps and spoken cues continue with the screen off), wake lock
  and vibration.
- **Signed releases.** Official APKs are signed with the studio's one key, shared by all Anonaconda Code Lab apps. Its
  SHA-256 certificate fingerprint is published on the [Android page](https://rounds.anonacondacodelab.com/android.html) and in every release, and the
  release build fails if an APK is signed with any other key. Each release also lists the APK's SHA-256 checksum.

## Known limitations
- Data at rest is not encrypted; anyone with access to the unlocked device and browser profile (or the app) can read your
  timers.
- Bluetooth Low Energy traffic from a heart-rate strap is not encrypted by the device.

## Reporting a vulnerability
Please report security issues privately using GitHub's **Security → Report a vulnerability** (private vulnerability
reporting) on this repository rather than opening a public issue, or email hello@anonacondacodelab.com. Include steps
to reproduce and the affected version.
