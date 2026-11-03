# SquatSense agent guide

## Project summary and current architecture

SquatSense (tagline: **Biomechanics Motion Coach**) is a portrait Expo / React Native mobile app that estimates thigh inclination from the phone accelerometer and classifies squat attempts using that angle, descent time, and gyroscope magnitude. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

Inspection baseline: 2026-11-03, source commit `fc74d33`. The inspection changed this document only; findings below are not authorization to fix app code.

- Language: TypeScript / TSX, strict mode, extending `expo/tsconfig.base`.
- Framework: Expo `~57.0.27`, React `19.2.3`, React Native `0.86.3`.
- Package manager: npm (`package-lock.json`; no Bun lockfile at inspection).
- Entry: `index.ts` registers `App` using `registerRootComponent`.
- `App.tsx`: `App` supplies `SafeAreaProvider`; `SquatSenseMain` owns all UI, workout state, sensor listeners, speech/haptics, and styles. There are no separate sensor hooks/services or screen modules.
- Current UI: one scrollable dashboard containing difficulty selection, angle gauge, rep state/feedback, valid reps, accuracy, diagnostics, and start/stop/reset controls; a countdown overlay; a React Native summary `Modal`.
- Current navigation: local conditional rendering and modal visibility only. Expo Router is not installed and `src/app/` does not exist. The routing rules below apply to future navigation work; do not describe them as already implemented.
- State: local `useState` for UI and counters; `useRef` for the state machine, selected difficulty, minimum angle, timestamps, peak angular speed, and speech throttle. Functional updates increment stats. No global store, persistence, backend, or history.
- `app.json`: portrait, light system appearance despite dark app styles, iPad support enabled. No checked-in native projects or `eas.json`.
- `assets/`: app icons; `image/ExUI1.png`: UI reference image, not imported into the app.

### Dependencies

| Package | Declared version | Current purpose |
| --- | --- | --- |
| `expo-sensors` | `~57.0.3` | Accelerometer and gyroscope listeners |
| `expo-haptics` | `~57.0.3` | Depth and rep-result feedback |
| `expo-speech` | `~57.0.3` | English spoken countdown/coaching/counts |
| `expo-keep-awake` | `~57.0.2` | Keep screen awake during workout |
| `expo-status-bar` | `~57.0.1` | Installed; current UI uses React Native `StatusBar` instead |
| `react-native-safe-area-context` | `~5.7.0` | Safe-area provider and view |
| `lucide-react-native` | `^1.55.0` | Icons |
| `react-native-svg` | `15.15.4` | SVG support for icons |
| `typescript`, `@types/react` | `~6.0.3`, `~19.2.2` | Type checking |
| `eslint`, `eslint-config-expo` | `^9.0.0`, `~57.0.2` | Flat-config linting via `eslint.config.js` |

## Global rules

- Never alter sensor or rep-detection logic unless the task explicitly says so. This includes thresholds, timing, filtering, angle convention, calibration, and diagnostic classification. Findings and TODOs are not permission to change that logic.
- Never show fake sensor data, fake status, or fabricated stats. Accuracy must show `"--"` before any rep. Unknown or unavailable measurements must not appear as measured values. The current implementation violates this rule; see the inspection findings.
- Create a new git branch for each task and commit in small logical steps. Preserve unrelated user changes and stage only files belonging to the task.
- State clearly which checks were static/build-only, emulator checks, offline synthetic checks, or tested on a real device. A successful bundle or emulator screen does not validate physical squat detection.
- Run lint and typecheck before declaring a task done; report failures accurately. Do not silently fix unrelated failures during an inspection-only task.

## Product assumptions and target flow

- Phone placement assumption: <<< แก้ตรงนี้: e.g., strapped to the front of the right thigh, screen facing out >>>
  - **TODO:** Confirm actual mounting position, phone orientation, and attachment stability.
  - Existing countdown instruction at `App.tsx:449` says `Put phone in front pocket & stand upright`. This differs from the proposed strapped-right-thigh example. The code does not select a leg or check screen direction. Its angle interpretation requires the phone's long/y axis to follow the thigh; a loose pocket can move independently.
- UI language: <<< แก้ตรงนี้: Thai / English >>>
  - **TODO:** Choose the product language. Current labels are English and `speak` explicitly uses `en-US`; there is no localization system.
- Target flow: **HOME → CALIBRATION → WORKOUT → SUMMARY**.
  - Current flow: dashboard → 3-second countdown → workout on the same dashboard → summary modal on stop only if `totalReps > 0`. Calibration and separate routed screens are not implemented.

## Design system (target specification)

| Token | Value |
| --- | --- |
| Background | `#080D1B` |
| Card | `#151F32` |
| Surface | `#1C2940` |
| Primary | `#0799DB` |
| Success | `#22C58B` |
| Warning | `#F5A623` |
| Error | `#FF5555` |
| Text | `#FFFFFF` |
| Secondary text | `#8C9AB4` |

- Fonts: **Inter** for English, **IBM Plex Sans Thai** for Thai.
- Card radius: **16–20px** (use the equivalent React Native logical units).
- One primary accent only; green/orange/red are reserved for form status.
- Current UI has inline/hardcoded styles, different colors (including purple wobble and orange decorative accents), and some 24-unit card radii. Neither requested font is loaded or bundled. Treat this section as the target, not a claim of implementation.

## Sensor logic map

Line references below are from the inspection baseline; use function names if lines move.

| Location in `App.tsx` | Responsibility |
| --- | --- |
| `31`, `34`, `50` | `RepState`, `WorkoutStats`, and `SquatSenseMain` |
| `51–74` | UI state, mutable detector refs, displayed target angle |
| `76` | `speak`: 1,100 ms throttle; stop previous speech; speak `en-US` at rate 1.0 |
| `84` | `handleDifficultyChange`: update state/ref; blocked while active/counting down |
| `90` | `handleStartCountdown`: local 1,000 ms interval, countdown from 3 |
| `110` | `startWorkout`: await keep-awake, activate, reset detector to standing; retain stats |
| `121` | `handleStop`: deactivate keep-awake, pause; show summary if attempts exist |
| `131` | `handleReset`: clear stats/UI, set angle to 90 and state to standing |
| `149–271` | `useEffect([isActive])`: subscribe both sensors at requested 50 ms intervals (~20 Hz); remove listeners in cleanup |
| `153–256` | Accelerometer callback: calculate angle, transition state, classify/count attempts |
| `258–265` | Gyroscope callback: update peak magnitude of all three angular velocity axes |
| `273`, `278` | Accuracy and `getPerformanceGrade` |

### Sampling, filtering, and calibration

- Both listeners are installed even while inactive; callbacks immediately return when `!isActive`. Changing active state removes and recreates them. This is not idle sensor shutdown.
- There is **no filtering**: no low-pass/moving average, outlier rejection, gravity separation, complementary/Kalman fusion, or gyro integration. Rounding to whole degrees is the only angle quantization.
- There is **no calibration**: no reference pose sample, axis remapping, offset, bias correction, placement verification, or stability check. Countdown is preparation only; reset assigns constants rather than measuring a baseline.
- No availability check, permission flow, missing/stale-sample handling, or `AppState` lifecycle handling. Sample `timestamp` is ignored; timing uses `Date.now()` at callback execution.
- Accelerometer values use g units; gyroscope values use rad/s. See the versioned [Accelerometer](https://docs.expo.dev/versions/v57.0.0/sdk/accelerometer/) and [Gyroscope](https://docs.expo.dev/versions/v57.0.0/sdk/gyroscope/) docs. Both installed sensor type definitions also specify these units.

### Exact angle convention

```text
angleDeg = round(atan2(abs(ay), sqrt(ax*ax + az*az)) * 180 / PI)
```

For finite, nonzero accelerometer samples, this is the unsigned inclination of the device y axis relative to the plane perpendicular to the measured acceleration vector, in the range **0–90 degrees**. When stationary and gravity dominates:

- **90°**: device y/long axis is vertical, parallel or antiparallel to gravity. With that axis aligned along the thigh, this corresponds to an upright/vertical thigh.
- **0°**: device y/long axis is horizontal, perpendicular to gravity. With the assumed mounting, this corresponds to a horizontal thigh.
- Smaller values mean deeper descent toward horizontal, not greater knee flexion. This is not a measured knee-joint angle.
- `abs(y)` and squared x/z discard direction. The calculation cannot distinguish upside-down mounting, forward/backward tilt signs, or above-versus-below-horizontal thigh positions. Linear movement acceleration can corrupt the gravity-based interpretation.
- There is no invalid/zero-vector guard. In JavaScript, the all-zero vector produces 0° here, although that is not evidence of a horizontal thigh.

### Thresholds and state machine

All angle comparisons use the **rounded integer angle**, not the original float.

| Rule | BEGINNER | PRO |
| --- | --- | --- |
| Displayed target and transition into `BOTTOM` | `angle <= 35°` | `angle <= 25°` |
| Shallow limit (strict comparison on minimum) | `minimum > 42°` | `minimum > 30°` |
| Start descending from `STANDING` | `angle < 65°` | `angle < 65°` |
| Shallow reversal while `DESCENDING` | `angle > minimum + 12°` AND minimum above shallow limit | Same |
| Leave `BOTTOM` for `ASCENDING` | `angle > 45°` | `angle > 35°` |
| Finish `ASCENDING` / rearm standing | `angle >= 70°` | `angle >= 70°` |
| Final depth gate before fast/wobble/good classification | `minimum <= 38°` | `minimum <= 28°` |

1. `STANDING`: below 65°, enter `DESCENDING`, record start time and minimum angle, reset peak gyro magnitude.
2. `DESCENDING`: update minimum. At or below target, enter `BOTTOM`, record bottom time, give light haptic feedback. Otherwise, on a reversal greater than 12° with minimum strictly above the shallow limit, enter `ASCENDING` and immediately increment `totalReps` and `shallowReps`.
3. `BOTTOM`: above target + 10°, enter `ASCENDING`. Minimum angle is no longer updated in this state.
4. `ASCENDING`: at 70° or above, classify if minimum <= target + 3°, then rearm `STANDING` and reset minimum/peak. The +3° gate does not provide a separate route into `BOTTOM`; it does not rescue an attempt that never reached the target. An already-counted shallow attempt fails this gate and is not counted twice.

Diagnostics for an attempt that reached depth:

- `repDuration = (bottomTime - repStartTime) / 1000`: time from first sample below 65° to first target-depth sample, **not full rep time** or the entire descent from 90°.
- Too fast: `0 < repDuration < 0.6` seconds. Exactly 0.6 s is not fast; zero/negative time is also not flagged.
- Wobble: `max(sqrt(gx*gx + gy*gy + gz*gz)) > 2.5 rad/s`; equality is not flagged. This captures any phone rotation axis, not specifically lateral knee motion. Peak is reset at descent start and at completion, then accumulated from gyro callbacks.
- Exclusive priority: **too fast → wobble → good**. One qualifying rep increments total and exactly one category. Concurrent speed and wobble faults produce only a fast count. Shallow attempts are classified earlier and receive neither speed nor wobble classification.
- Accuracy: rounded `goodReps / totalReps * 100`; currently defaults to **100%** with zero attempts (known violation of the required `"--"` empty state).
- Grades: no attempts → `N/A`; accuracy >=85 → A, >=70 → B, >=50 → C, otherwise `Needs Work`. This is a share of accepted attempts, not validated biomechanical measurement accuracy.

## Inspection findings and verification

### Implemented behavior and evidence

- Start/countdown, difficulty locking, live angle display, state transitions, diagnostic counters, stop/reset, conditional summary, speech and haptic calls, and subscription cleanup exist in source.
- Earlier in this conversation, Android Metro bundling succeeded and the Pixel 10 emulator displayed the SquatSense dashboard / START COACH. This confirms an emulator launch only; it does not confirm sensors, coaching accuracy, physical placement, or iOS behavior.
- During this inspection, the actual accelerometer callback was extracted into an in-memory Node sandbox with mocked setters/clock/haptics. Synthetic inputs were never sent to the app or shown as real measurements. A normal beginner depth cycle produced one good rep. These checks are offline logic checks, not device validation or a persistent test suite.

### Confirmed defects and code-level risks (not fixed)

1. **Missed-depth state lock:** minima 36–42° (BEGINNER) or 26–30° (PRO) hit neither target nor strict shallow condition. Returning to 90° leaves `DESCENDING` active, with no attempt counted or timestamp reset. Offline replays at 37° and 28° confirmed this. Subsequent motion can be merged into the old attempt.
2. **Misleading initial values:** accuracy displays 100% before any attempts; angle 90° and `STANDING` are initial/reset constants, not sensor evidence. While inactive the angle is frozen, and stopping mid-rep can leave the previous motion state visible.
3. **Typecheck failure / overlay positioning:** `App.tsx:779` spreads `StyleSheet.absoluteFillObject`, which is absent from the installed React Native runtime export and types. TypeScript reports TS2551; the countdown overlay lacks the intended absolute-fill positioning.
4. **Unvalidated motion interpretation:** raw acceleration is treated as orientation, with no calibration/filtering. All-axis gyro speed can flag normal squat rotation or pocket movement as “Knee wobble.” Missing gyroscope samples leave peak at zero, which can permit a good classification without stability evidence.
5. **Shallow count before completion:** an offline 90 → 60 → 55 → 68° replay incremented shallow/total at 68° while still `ASCENDING`; standing completion is not required to count that attempt.
6. **Speech/countdown timing:** 1,000 ms countdown ticks conflict with the 1,100 ms speech throttle, so normal timing can suppress “Two” and “Start workout.” The interval is local, is not cancelled by reset, and has no unmount cleanup. Reset/cancellation can therefore be followed by the old timer starting a workout.
7. **Session boundaries:** start retains previous counters, even after stop/summary; “new workout” versus resume is undefined. Stopping with zero counted attempts skips summary. An incomplete rep is not finalized on stop.
8. **Lifecycle/error handling:** no sensor availability or stale-data fallback; callbacks remain subscribed while idle; no background pause policy; awaited keep-awake activation has no catch and can prevent start. Keep-awake and speech lack unmount cleanup. Speech inside a functional stats updater is a side effect that React may replay.
9. **UI/platform risks:** unused `width` at `App.tsx:29` causes a lint warning; icon-only controls lack explicit accessibility labels. Summary is not scrollable, so small screens/large text need testing. App appearance config says light while UI is dark. Web script exists but `react-dom` / `react-native-web` are not declared and web has not been verified.

### Incomplete work and TODOs

- **TODO — product decisions:** resolve the exact phone placement and UI language placeholders above. The current front-pocket instruction conflicts with the proposed strap example.
- **TODO — flow:** implement HOME → CALIBRATION → WORKOUT → SUMMARY when requested; there is currently no calibration or routed navigation.
- **TODO — design:** implement the specified palette, font loading, card radii, status-only colors, and honest empty states in a separately authorized UI task.
- **TODO — sensor reliability:** obtain explicit authorization before fixing state-lock thresholds, calibration/filtering, diagnostic semantics, timestamp handling, or sample validation; validate on physical phones with the agreed mounting.
- **TODO — verification/release:** establish automated regression tests, device validation protocol, and EAS build profiles/configuration when requested. No test runner, test script, or test files currently exist. Workout history/persistence is absent.
- **TODO — existing defects:** address the overlay API, countdown cancellation/speech timing, lifecycle handling, and session semantics in appropriately scoped follow-up tasks.

### Checks performed for this inspection

- `npx tsc --noEmit`: **failed**, TS2551 at `App.tsx:779`.
- `npx expo lint`: **passed with one warning**, unused `width` at `App.tsx:29`.
- In-memory callback checks: normal beginner rep, BEGINNER/PRO state-lock cases, early shallow count, and fast-over-wobble precedence reproduced. No app sensor inputs or stats were modified.
- No native Android/iOS build or fresh bundle/export was run for this inspection. No physical-device testing was performed; actual squat accuracy remains unverified.

## Build, run, and test commands

Use the repo root. npm is current; use `bunx` instead of `npx` if a future task introduces a Bun lockfile.

| Command | Purpose / prerequisites |
| --- | --- |
| `npm ci` | Install the locked project dependencies |
| `npm start` / `npx expo start` | Start Expo Metro |
| `npm run android` | Start Expo and open Android device/emulator |
| `npm run ios` | Start Expo and open iOS simulator; requires macOS for simulator |
| `npm run web` | Existing web script; web setup/runtime is not verified |
| `npx expo start --host lan` | Start Metro with network binding; worked with ADB reverse in this Windows session |
| `npm run lint` / `npx expo lint` | ESLint static check |
| `npx tsc --noEmit` | TypeScript static check; currently fails as recorded above |
| `npx expo-doctor` | Diagnose Expo configuration and dependency compatibility |
| `npx expo install --check` | Check SDK dependency compatibility |
| `npx expo export --platform android` | Optional JS/assets bundle check, not a native APK build or sensor test |
| `npx eas-cli@latest build --platform android --profile development` | Cloud development build after configuring EAS/project identifiers/profile; not configured yet |

There is no `npm test` or `npm run build` script. Do not report lint/typecheck as tests of squat detection. `expo install --fix` changes dependencies; use only for an authorized compatibility repair, not a read-only inspection.

Windows emulator workflow observed in this session: SDK under `%LOCALAPPDATA%\Android\Sdk`, AVD `Pixel_10`. Wait for `adb shell getprop sys.boot_completed` to return `1`, then `adb reverse tcp:8081 tcp:8081` and open `exp://127.0.0.1:8081` in Expo Go. A cold boot (`emulator -avd Pixel_10 -no-snapshot-load`) resolved the prior unauthorized connection. Do not disable ADB authentication or wipe emulator data as a default fix.

## Existing Expo development guardrails

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
