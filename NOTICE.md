# Notices

## Third-party components
The app uses two typefaces, each licensed under the SIL Open Font License 1.1:

| Font | Copyright | Licence file |
|---|---|---|
| Instrument Sans | The Instrument Sans Project Authors | [fonts/OFL-InstrumentSans.txt](fonts/OFL-InstrumentSans.txt) |
| IBM Plex Mono | IBM Corp. | [fonts/OFL-IBMPlexMono.txt](fonts/OFL-IBMPlexMono.txt) |

The **Android app** (built from `mobile/`) also includes:

| Component | Version | Licence |
|---|---|---|
| [Capacitor](https://capacitorjs.com) (`@capacitor/android`, `@capacitor/core`) | 8.5.3 | MIT |
| [@capacitor-community/bluetooth-le](https://github.com/capacitor-community/bluetooth-le) | 8.3.0 | MIT |
| AndroidX libraries (AppCompat, Core, CoordinatorLayout, Core SplashScreen, Activity, WebKit) | see `mobile/android/variables.gradle` | Apache-2.0 |
| Kotlin standard library | 2.2.20 | Apache-2.0 |
| Gradle wrapper (`mobile/android/gradle/wrapper`, build tool only) | | Apache-2.0 |

MIT and Apache-2.0 are compatible with the GNU GPL v3, under which the app as a whole is distributed. Their licence
texts travel with each package (`mobile/node_modules/*/LICENSE`, and the AndroidX and Kotlin artifacts).

No other third-party code is included.

## Trademarks
Device and brand names (Polar, Garmin, Wahoo, Coospo) are used only to describe compatibility. Rounds is independent and
not affiliated with any of them. The presets describe published training methods; their sources are named in the app.
