# SquatSense — Biomechanics Motion Coach

A mobile app that coaches squat form in real time using only the phone's built-in **accelerometer** and **gyroscope**. Put the phone in your front trouser pocket, squat, and the app counts valid reps, detects common form errors, and gives voice, vibration, and on-screen feedback.

## Authors

| Name | Student ID |
| --- | --- |
| Kittipath Inarree | 6802041510279 |
| Pongsakorn Srisakat | 6802041510066 |

## Features

- **Home:** live sensor availability check, Beginner / Pro depth difficulty, last-session summary
- **Preparation:** phone placement guide and a cancellable 3-2-1 countdown
- **Workout:** large valid-rep counter inside a depth ring that fills as you squat, movement state, live feedback, per-rep result dots, timer, pause / resume, end with confirmation
- **Summary:** form accuracy, valid / incorrect / total reps, duration, error breakdown (too shallow, too fast, unstable), and improvement tips based on the recorded workout
- **Feedback without looking at the screen:** voice coaching and haptic vibration
- **Thai / English** interface with Thai voice when the device supports it
- Glassmorphism dark UI with animated ambient light

## How it works

1. The accelerometer measures gravity to estimate the **thigh angle** (90° = standing, 0° = thigh horizontal).
2. A state machine tracks each rep: **Standing → Descending → Bottom → Ascending**.
3. A rep is **valid** when the thigh reaches the target depth (Beginner ≤ 35°, Pro ≤ 25°).
4. Form errors:
   - **Too shallow:** the user stands back up before reaching the target depth
   - **Too fast:** the descent to target depth takes less than 0.6 s
   - **Unstable:** the gyroscope detects rotation faster than 2.5 rad/s during the rep

## Tech stack

Expo SDK 57 · React Native · TypeScript · expo-sensors · expo-haptics · expo-speech · expo-keep-awake · react-native-svg

## Run the project

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** (SDK 57) or press `a` to open on a connected Android device.

Build an installable Android APK with EAS:

```bash
npx eas-cli@latest build -p android --profile preview
```
