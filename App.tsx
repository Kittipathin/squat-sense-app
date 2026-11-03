import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Alert,
  Animated,
  AppState,
  BackHandler,
  Easing,
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import Svg, { Circle } from 'react-native-svg';
import {
  Play,
  Pause,
  Square,
  Activity,
  ArrowLeft,
  Smartphone,
  PersonStanding,
  ChevronsDown,
  Volume2,
  VolumeX,
  Clock,
  Target,
  Lightbulb,
  RotateCcw,
  House,
} from 'lucide-react-native';

import { ThemeProvider, colors, radius, shadows, sizes, spacing, typography, type StatusTone } from './src/theme';
import {
  AppHeader,
  AppText as Text,
  GlowBackground,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
  StatusChip,
} from './src/components/ui';

type RepState = 'STANDING' | 'DESCENDING' | 'BOTTOM' | 'ASCENDING';
type Difficulty = 'BEGINNER' | 'PRO';
type Screen = 'HOME' | 'CALIBRATION' | 'WORKOUT' | 'SUMMARY';
type RepResult = 'good' | 'shallow' | 'fast' | 'wobble';
type SensorStatus = 'CHECKING' | 'READY' | 'UNAVAILABLE';
type Lang = 'th' | 'en';

interface WorkoutStats {
  totalReps: number;
  goodReps: number;
  shallowReps: number;
  fastReps: number;
  wobbleReps: number;
}

interface SessionSummary {
  stats: WorkoutStats;
  durationMs: number;
  difficulty: Difficulty;
}

const EMPTY_STATS: WorkoutStats = {
  totalReps: 0,
  goodReps: 0,
  shallowReps: 0,
  fastReps: 0,
  wobbleReps: 0,
};

const RESULT_TONE: Record<RepResult, StatusTone> = {
  good: 'success',
  shallow: 'error',
  fast: 'warning',
  wobble: 'warning',
};

const TONE_COLOR: Record<StatusTone, string> = {
  neutral: colors.primary,
  success: colors.success,
  warning: colors.warning,
  error: colors.error,
};

// ---------------------------------------------------------------------
// Localization (UI only). The detector keeps producing its original English
// feedback/speech keys; they are translated at display / speech time.
// ---------------------------------------------------------------------
const STR = {
  en: {
    subtitle: 'Biomechanics Motion Coach',
    sensorsReady: '● SENSORS READY',
    sensorUnavailable: '● SENSOR UNAVAILABLE',
    checkingSensors: 'CHECKING SENSORS…',
    depthDifficulty: 'DEPTH DIFFICULTY',
    BEGINNER: 'BEGINNER',
    PRO: 'PRO',
    diffDetail: (deg: number) => `Thigh ≤ ${deg}° from horizontal`,
    lastSession: 'LAST SESSION',
    validRepsShort: 'Valid reps',
    accuracyShort: 'Accuracy',
    duration: 'Duration',
    howItWorks: 'HOW IT WORKS',
    how1: 'Put your phone in your front trouser pocket, screen facing out.',
    how2: 'Stand upright and stay still for the countdown.',
    how3: 'Squat. Listen and feel for feedback — no need to look at the screen.',
    startCoach: 'START COACH',
    unavailableNote: 'This device does not report an accelerometer and gyroscope.',
    getIntoPosition: 'Get into position',
    frontPocket: 'Front trouser pocket',
    pocketDetail: 'Screen facing out · top of the phone pointing toward your hip',
    step1: 'Place the phone in your front trouser pocket as shown above.',
    step2: 'Stand upright with your feet shoulder-width apart.',
    step3: 'Tap the button, then stay still during the 3-second countdown.',
    targetLine: (d: string, deg: number) => `${d} · depth target: thigh ≤ ${deg}° from horizontal`,
    imReady: "I'M READY",
    live: 'LIVE',
    paused: 'PAUSED',
    validReps: 'VALID REPS',
    STANDING: 'STANDING',
    DESCENDING: 'DESCENDING',
    BOTTOM: 'BOTTOM POSITION',
    ASCENDING: 'ASCENDING',
    angleLine: (a: string, deg: number) => `Thigh angle ${a} · target ≤ ${deg}°`,
    attemptsHint: 'Each attempt will appear here',
    pause: 'PAUSE',
    resume: 'RESUME',
    end: 'END',
    endTitle: 'End workout?',
    endMsg: 'Your results will be shown on the summary screen.',
    keepGoing: 'Keep going',
    endWorkout: 'End workout',
    workoutComplete: 'Workout complete',
    formAccuracy: 'FORM ACCURACY',
    validOf: (g: number, t: number) => `${g} of ${t} recorded attempts were valid`,
    gridValid: 'Valid reps',
    gridIncorrect: 'Incorrect',
    gridTotal: 'Total attempts',
    formAnalysis: 'FORM ANALYSIS',
    errShallow: 'Too shallow',
    errFast: 'Too fast',
    errWobble: 'Unstable (wobble)',
    mostCommon: '  · most common',
    nextTime: 'NEXT TIME',
    tipNone:
      'No attempts were detected. Check that the phone is in your front pocket, screen out, and squat until your thigh is close to horizontal.',
    tipShallow: 'Squat deeper — bring your thigh closer to horizontal before standing up.',
    tipFast: 'Lower yourself more slowly and with control instead of dropping into the squat.',
    tipWobble: 'Keep the movement steady — the phone detected a lot of rotation during some reps.',
    tipPerfect: 'Every recorded attempt met the depth target with controlled speed. Keep it up!',
    home: 'HOME',
    tryAgain: 'TRY AGAIN',
    getReady: 'GET READY',
    standStill: 'Stand upright and stay still',
    cancel: 'CANCEL',
  },
  th: {
    subtitle: 'โค้ชท่าสควอตอัจฉริยะ',
    sensorsReady: '● เซนเซอร์พร้อมใช้งาน',
    sensorUnavailable: '● ไม่พบเซนเซอร์',
    checkingSensors: 'กำลังตรวจสอบเซนเซอร์…',
    depthDifficulty: 'ระดับความลึก',
    BEGINNER: 'มือใหม่',
    PRO: 'โปร',
    diffDetail: (deg: number) => `ต้นขาเอียง ≤ ${deg}° จากแนวราบ`,
    lastSession: 'ครั้งล่าสุด',
    validRepsShort: 'ครั้งที่ถูกต้อง',
    accuracyShort: 'ความแม่นยำ',
    duration: 'เวลา',
    howItWorks: 'วิธีใช้งาน',
    how1: 'ใส่โทรศัพท์ในกระเป๋ากางเกงด้านหน้า หันหน้าจอออก',
    how2: 'ยืนตรงและอยู่นิ่ง ๆ ระหว่างนับถอยหลัง',
    how3: 'เริ่มสควอต ฟังเสียงและรับรู้การสั่นได้เลย ไม่ต้องมองจอ',
    startCoach: 'เริ่มฝึก',
    unavailableNote: 'อุปกรณ์นี้ไม่มีเซนเซอร์วัดความเร่งหรือไจโรสโคป',
    getIntoPosition: 'เตรียมพร้อม',
    frontPocket: 'กระเป๋ากางเกงด้านหน้า',
    pocketDetail: 'หันหน้าจอออก · หัวโทรศัพท์ชี้ขึ้นไปทางสะโพก',
    step1: 'ใส่โทรศัพท์ในกระเป๋ากางเกงด้านหน้าตามภาพด้านบน',
    step2: 'ยืนตรง แยกเท้ากว้างประมาณช่วงไหล่',
    step3: 'กดปุ่มด้านล่าง แล้วยืนนิ่งระหว่างนับถอยหลัง 3 วินาที',
    targetLine: (d: string, deg: number) => `${d} · เป้าหมาย: ต้นขาเอียง ≤ ${deg}° จากแนวราบ`,
    imReady: 'พร้อมแล้ว',
    live: 'กำลังฝึก',
    paused: 'หยุดชั่วคราว',
    validReps: 'ครั้งที่ถูกต้อง',
    STANDING: 'ยืนตรง',
    DESCENDING: 'กำลังย่อลง',
    BOTTOM: 'ถึงจุดต่ำสุด',
    ASCENDING: 'กำลังลุกขึ้น',
    angleLine: (a: string, deg: number) => `มุมต้นขา ${a} · เป้าหมาย ≤ ${deg}°`,
    attemptsHint: 'ผลของแต่ละครั้งจะแสดงที่นี่',
    pause: 'พัก',
    resume: 'ทำต่อ',
    end: 'จบ',
    endTitle: 'จบการฝึกไหม?',
    endMsg: 'ผลการฝึกจะแสดงในหน้าสรุป',
    keepGoing: 'ฝึกต่อ',
    endWorkout: 'จบการฝึก',
    workoutComplete: 'ฝึกเสร็จแล้ว!',
    formAccuracy: 'ความแม่นยำของท่า',
    validOf: (g: number, t: number) => `ถูกต้อง ${g} จาก ${t} ครั้ง`,
    gridValid: 'ถูกต้อง',
    gridIncorrect: 'ไม่ถูกต้อง',
    gridTotal: 'ทั้งหมด',
    formAnalysis: 'วิเคราะห์ท่าทาง',
    errShallow: 'ย่อไม่ลึกพอ',
    errFast: 'เร็วเกินไป',
    errWobble: 'ไม่มั่นคง (โยก)',
    mostCommon: '  · พบบ่อยที่สุด',
    nextTime: 'ครั้งหน้าลองแบบนี้',
    tipNone:
      'ไม่พบการสควอต ตรวจสอบว่าใส่โทรศัพท์ในกระเป๋ากางเกงด้านหน้า หันจอออก และย่อตัวจนต้นขาเกือบขนานพื้น',
    tipShallow: 'ย่อให้ลึกขึ้น ให้ต้นขาเกือบขนานพื้นก่อนลุกขึ้น',
    tipFast: 'ย่อตัวลงช้า ๆ อย่างควบคุม อย่าทิ้งตัวลงเร็ว',
    tipWobble: 'ทรงตัวให้นิ่ง ระบบตรวจพบการโยกของโทรศัพท์ในบางครั้ง',
    tipPerfect: 'ทุกครั้งลึกถึงเป้าหมายและควบคุมความเร็วได้ดี เยี่ยมมาก!',
    home: 'หน้าหลัก',
    tryAgain: 'ฝึกอีกครั้ง',
    getReady: 'เตรียมตัว',
    standStill: 'ยืนตรงและอยู่นิ่ง ๆ',
    cancel: 'ยกเลิก',
  },
};

type Strings = (typeof STR)['en'];

// Detector / flow feedback keys (English) → Thai display text
const FEEDBACK_TH: Record<string, string> = {
  'Ready to start': 'พร้อมเริ่ม',
  'Stand upright and begin': 'ยืนตรง แล้วเริ่มสควอตได้เลย',
  'Workout paused': 'หยุดชั่วคราว',
  'Workout finished': 'จบการฝึก',
  'Paused — app left the foreground': 'หยุดชั่วคราว เพราะออกจากแอป',
  'Going down...': 'กำลังย่อลง...',
  'Good depth! Push up': 'ลึกพอแล้ว! ดันตัวขึ้น',
  'Too shallow!': 'ย่อไม่ลึกพอ!',
  'Driving up...': 'กำลังลุกขึ้น...',
  'Control your speed': 'ช้าลงอีกนิด',
  'Keep knees stable': 'ทรงตัวให้นิ่ง',
  'Perfect rep!': 'เยี่ยม! ท่าถูกต้อง',
};

// Spoken cues (English keys used by the detector) → Thai speech. Numbers are read by Thai TTS directly.
const SPEECH_TH: Record<string, string> = {
  Three: 'สาม',
  Two: 'สอง',
  One: 'หนึ่ง',
  'Start workout': 'เริ่มได้เลย',
  'Too shallow': 'ย่อให้ลึกกว่านี้',
  'Too fast': 'ช้าลงหน่อย',
  'Knee wobble': 'ทรงตัวให้นิ่ง',
};

const workoutTone = (lastResult: RepResult | null, repState: RepState): StatusTone =>
  lastResult ? RESULT_TONE[lastResult] : repState === 'BOTTOM' ? 'success' : 'neutral';

const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const calcAccuracy = (s: WorkoutStats) =>
  s.totalReps > 0 ? Math.round((s.goodReps / s.totalReps) * 100) : null;

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SquatSenseMain />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function SquatSenseMain() {
  const [screen, setScreen] = useState<Screen>('HOME');
  const [isActive, setIsActive] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('BEGINNER');
  const [currentAngle, setCurrentAngle] = useState<number>(90);
  const [repState, setRepState] = useState<RepState>('STANDING');
  const [feedback, setFeedback] = useState<string>('Ready to start');
  const [stats, setStats] = useState<WorkoutStats>(EMPTY_STATS);

  // UI-only state (does not affect detection)
  const [muted, setMuted] = useState<boolean>(false);
  const [lang, setLang] = useState<Lang>('th');
  const [sensorStatus, setSensorStatus] = useState<SensorStatus>('CHECKING');
  const [repResults, setRepResults] = useState<RepResult[]>([]);
  const [lastResult, setLastResult] = useState<RepResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [interrupted, setInterrupted] = useState<boolean>(false);
  const [lastSession, setLastSession] = useState<SessionSummary | null>(null);

  const stateRef = useRef<RepState>('STANDING');
  const difficultyRef = useRef<Difficulty>('BEGINNER');
  const minAngleInRepRef = useRef<number>(90);
  const repStartTimeRef = useRef<number>(0);
  const bottomTimeRef = useRef<number>(0);
  const maxWobbleRef = useRef<number>(0);
  const lastSpeakTimeRef = useRef<number>(0);

  const mutedRef = useRef<boolean>(false);
  const langRef = useRef<Lang>('th');
  const thaiVoiceRef = useRef<boolean>(false);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStatsRef = useRef<WorkoutStats>(EMPTY_STATS);
  const statsRef = useRef<WorkoutStats>(EMPTY_STATS);
  const activeSinceRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef<number>(0);

  const targetAngle = difficulty === 'BEGINNER' ? 35 : 25;
  const t: Strings = STR[lang];
  const tf = (key: string) => (lang === 'th' ? (FEEDBACK_TH[key] ?? key) : key);

  // Speak in Thai only when the device actually has a Thai voice; otherwise fall back to English.
  const speak = (text: string) => {
    if (mutedRef.current) return;
    const now = Date.now();
    if (now - lastSpeakTimeRef.current < 1100) return;
    lastSpeakTimeRef.current = now;
    Speech.stop();
    const useThai = langRef.current === 'th' && thaiVoiceRef.current;
    const spoken = useThai ? (SPEECH_TH[text] ?? text) : text;
    Speech.speak(spoken, { language: useThai ? 'th-TH' : 'en-US', rate: 1.0 });
  };

  const toggleMute = () => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (next) Speech.stop();
  };

  const toggleLang = () => {
    const next: Lang = langRef.current === 'th' ? 'en' : 'th';
    langRef.current = next;
    setLang(next);
  };

  // ---- Thai voice availability (retry once: Android TTS can report voices late) ----
  useEffect(() => {
    let cancelled = false;
    const check = () =>
      Speech.getAvailableVoicesAsync()
        .then((voices) => {
          if (cancelled) return;
          thaiVoiceRef.current = voices.some((v) => (v.language ?? '').toLowerCase().startsWith('th'));
        })
        .catch(() => {});
    check();
    const retry = setTimeout(check, 2000);
    return () => {
      cancelled = true;
      clearTimeout(retry);
    };
  }, []);

  // ---- Sensor availability (real check, no fake status) ----
  useEffect(() => {
    let cancelled = false;
    Promise.all([Accelerometer.isAvailableAsync(), Gyroscope.isAvailableAsync()])
      .then(([acc, gyro]) => {
        if (!cancelled) setSensorStatus(acc && gyro ? 'READY' : 'UNAVAILABLE');
      })
      .catch(() => {
        if (!cancelled) setSensorStatus('UNAVAILABLE');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDifficultyChange = (mode: Difficulty) => {
    if (isActive || countdown !== null) return;
    setDifficulty(mode);
    difficultyRef.current = mode;
  };

  // ---- Workout timing (UI only) ----
  const markActiveStart = () => {
    activeSinceRef.current = Date.now();
  };
  const markActiveStop = () => {
    if (activeSinceRef.current !== null) {
      accumulatedMsRef.current += Date.now() - activeSinceRef.current;
      activeSinceRef.current = null;
    }
    setElapsedMs(accumulatedMsRef.current);
  };

  useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => {
      const running = activeSinceRef.current !== null ? Date.now() - activeSinceRef.current : 0;
      setElapsedMs(accumulatedMsRef.current + running);
    }, 500);
    return () => clearInterval(timer);
  }, [isActive]);

  const startWorkout = async () => {
    try {
      await activateKeepAwakeAsync();
    } catch {
      // Keep-awake is a convenience; never block the workout on it.
    }
    setIsActive(true);
    setRepState('STANDING');
    stateRef.current = 'STANDING';
    minAngleInRepRef.current = 90;
    maxWobbleRef.current = 0;
    setFeedback('Stand upright and begin');
    speak('Start workout');
    markActiveStart();
    setHasStarted(true);
    setInterrupted(false);
  };

  const cancelCountdown = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
  };

  const handleStartCountdown = () => {
    if (countdown !== null || isActive) return;
    setCountdown(3);
    speak('Three');

    let current = 3;
    countdownTimerRef.current = setInterval(() => {
      current -= 1;
      if (current > 0) {
        setCountdown(current);
        if (current === 2) speak('Two');
        if (current === 1) speak('One');
      } else {
        cancelCountdown();
        setScreen('WORKOUT');
        startWorkout();
      }
    }, 1000);
  };

  useEffect(() => () => cancelCountdown(), []);

  const pauseWorkout = useCallback((reason?: string) => {
    deactivateKeepAwake();
    setIsActive(false);
    markActiveStop();
    setFeedback(reason ?? 'Workout paused');
  }, []);

  const resumeWorkout = () => {
    startWorkout();
  };

  const resetSession = () => {
    deactivateKeepAwake();
    cancelCountdown();
    setIsActive(false);
    setCurrentAngle(90);
    setRepState('STANDING');
    stateRef.current = 'STANDING';
    setFeedback('Ready to start');
    setStats(EMPTY_STATS);
    prevStatsRef.current = EMPTY_STATS;
    statsRef.current = EMPTY_STATS;
    setRepResults([]);
    setLastResult(null);
    accumulatedMsRef.current = 0;
    activeSinceRef.current = null;
    setElapsedMs(0);
    setHasStarted(false);
    setInterrupted(false);
  };

  const finishWorkout = () => {
    pauseWorkout('Workout finished');
    Speech.stop();
    setLastSession({ stats: statsRef.current, durationMs: accumulatedMsRef.current, difficulty });
    setScreen('SUMMARY');
  };

  const confirmFinish = () => {
    Alert.alert(t.endTitle, t.endMsg, [
      { text: t.keepGoing, style: 'cancel' },
      { text: t.endWorkout, style: 'destructive', onPress: finishWorkout },
    ]);
  };

  const goToCalibration = () => {
    resetSession();
    setScreen('CALIBRATION');
  };

  const goHome = () => {
    resetSession();
    setScreen('HOME');
  };

  // ---- Derive per-rep results from the existing detector's counters (adapter, no logic change) ----
  useEffect(() => {
    const prev = prevStatsRef.current;
    let result: RepResult | null = null;
    if (stats.goodReps > prev.goodReps) result = 'good';
    else if (stats.shallowReps > prev.shallowReps) result = 'shallow';
    else if (stats.fastReps > prev.fastReps) result = 'fast';
    else if (stats.wobbleReps > prev.wobbleReps) result = 'wobble';
    prevStatsRef.current = stats;
    statsRef.current = stats;
    if (result) {
      setRepResults((r) => [...r, result]);
      setLastResult(result);
    }
  }, [stats]);

  // Clear the colored result once a new rep starts.
  useEffect(() => {
    if (repState === 'DESCENDING') setLastResult(null);
  }, [repState]);

  // ---- Pause when the app goes to background during a workout ----
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active' && isActive) {
        pauseWorkout('Paused — app left the foreground');
        setInterrupted(true);
      }
    });
    return () => sub.remove();
  }, [isActive, pauseWorkout]);

  // ---- Android back button ----
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'WORKOUT') {
        confirmFinish();
        return true;
      }
      if (screen === 'CALIBRATION' || screen === 'SUMMARY') {
        goHome();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  });

  // ================== EXISTING DETECTOR (unchanged) ==================
  useEffect(() => {
    Accelerometer.setUpdateInterval(50);
    Gyroscope.setUpdateInterval(50);

    const accelSubscription = Accelerometer.addListener((accelData) => {
      if (!isActive) return;

      const { x, y, z } = accelData;
      const calculatedAngle = Math.round(
        Math.atan2(Math.abs(y), Math.sqrt(x * x + z * z)) * (180 / Math.PI)
      );

      setCurrentAngle(calculatedAngle);

      const now = Date.now();
      const currentState = stateRef.current;
      const currentTarget = difficultyRef.current === 'BEGINNER' ? 35 : 25;
      const shallowLimit = difficultyRef.current === 'BEGINNER' ? 42 : 30;

      if (currentState === 'STANDING') {
        if (calculatedAngle < 65) {
          stateRef.current = 'DESCENDING';
          setRepState('DESCENDING');
          repStartTimeRef.current = now;
          minAngleInRepRef.current = calculatedAngle;
          maxWobbleRef.current = 0;
          setFeedback('Going down...');
        }
      } else if (currentState === 'DESCENDING') {
        if (calculatedAngle < minAngleInRepRef.current) {
          minAngleInRepRef.current = calculatedAngle;
        }

        if (calculatedAngle <= currentTarget) {
          stateRef.current = 'BOTTOM';
          setRepState('BOTTOM');
          bottomTimeRef.current = now;
          setFeedback('Good depth! Push up');
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else if (
          calculatedAngle > minAngleInRepRef.current + 12 &&
          minAngleInRepRef.current > shallowLimit
        ) {
          stateRef.current = 'ASCENDING';
          setRepState('ASCENDING');
          setFeedback('Too shallow!');
          speak('Too shallow');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setStats((prev) => ({
            ...prev,
            totalReps: prev.totalReps + 1,
            shallowReps: prev.shallowReps + 1,
          }));
        }
      } else if (currentState === 'BOTTOM') {
        if (calculatedAngle > currentTarget + 10) {
          stateRef.current = 'ASCENDING';
          setRepState('ASCENDING');
          setFeedback('Driving up...');
        }
      } else if (currentState === 'ASCENDING') {
        if (calculatedAngle >= 70) {
          const repDuration =
            (bottomTimeRef.current - repStartTimeRef.current) / 1000;
          const isTooFast = repDuration > 0 && repDuration < 0.6;
          const isWobbling = maxWobbleRef.current > 2.5;

          if (minAngleInRepRef.current <= currentTarget + 3) {
            if (isTooFast) {
              setStats((prev) => ({
                ...prev,
                totalReps: prev.totalReps + 1,
                fastReps: prev.fastReps + 1,
              }));
              setFeedback('Control your speed');
              speak('Too fast');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } else if (isWobbling) {
              setStats((prev) => ({
                ...prev,
                totalReps: prev.totalReps + 1,
                wobbleReps: prev.wobbleReps + 1,
              }));
              setFeedback('Keep knees stable');
              speak('Knee wobble');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } else {
              setStats((prev) => {
                const updatedGood = prev.goodReps + 1;
                speak(String(updatedGood));
                return {
                  ...prev,
                  totalReps: prev.totalReps + 1,
                  goodReps: updatedGood,
                };
              });
              setFeedback('Perfect rep!');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }

          stateRef.current = 'STANDING';
          setRepState('STANDING');
          minAngleInRepRef.current = 90;
          maxWobbleRef.current = 0;
        }
      }
    });

    const gyroSubscription = Gyroscope.addListener((gyroData) => {
      if (!isActive) return;
      const { x, y, z } = gyroData;
      const wobbleSpeed = Math.sqrt(x * x + y * y + z * z);
      if (wobbleSpeed > maxWobbleRef.current) {
        maxWobbleRef.current = wobbleSpeed;
      }
    });

    return () => {
      accelSubscription.remove();
      gyroSubscription.remove();
    };
  }, [isActive]);
  // ================ END EXISTING DETECTOR ================

  const headerActions = (
    <View style={styles.headerActions}>
      <TouchableOpacity
        onPress={toggleLang}
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel={lang === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
      >
        <Text variant="caption" weight="bold" language="en">{lang === 'th' ? 'EN' : 'TH'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={toggleMute}
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Turn voice coaching on' : 'Turn voice coaching off'}
      >
        {muted ? (
          <VolumeX color={colors.textSecondary} size={sizes.icon} />
        ) : (
          <Volume2 color={colors.text} size={sizes.icon} />
        )}
      </TouchableOpacity>
    </View>
  );

  const tone = workoutTone(lastResult, repState);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <GlowBackground tint={screen === 'WORKOUT' && isActive && tone !== 'neutral' ? TONE_COLOR[tone] : null} />

      {screen === 'HOME' && (
        <HomeScreen
          t={t}
          thai={lang === 'th'}
          difficulty={difficulty}
          onDifficulty={handleDifficultyChange}
          sensorStatus={sensorStatus}
          lastSession={lastSession}
          onStart={goToCalibration}
          headerAction={headerActions}
        />
      )}

      {screen === 'CALIBRATION' && (
        <CalibrationScreen
          t={t}
          difficulty={difficulty}
          targetAngle={targetAngle}
          onBack={goHome}
          onReady={handleStartCountdown}
          counting={countdown !== null}
        />
      )}

      {screen === 'WORKOUT' && (
        <WorkoutScreen
          t={t}
          thai={lang === 'th'}
          stats={stats}
          angle={currentAngle}
          targetAngle={targetAngle}
          repState={repState}
          feedback={tf(interrupted ? 'Paused — app left the foreground' : feedback)}
          tone={tone}
          repResults={repResults}
          isActive={isActive}
          hasStarted={hasStarted}
          elapsedMs={elapsedMs}
          onPause={() => pauseWorkout()}
          onResume={resumeWorkout}
          onFinish={confirmFinish}
          headerAction={headerActions}
        />
      )}

      {screen === 'SUMMARY' && lastSession && (
        <SummaryScreen
          t={t}
          thai={lang === 'th'}
          session={lastSession}
          repResults={repResults}
          onTryAgain={goToCalibration}
          onHome={goHome}
        />
      )}

      {countdown !== null && (
        <View style={styles.countdownOverlay}>
          <Text style={[styles.countdownSub, lang === 'th' && styles.noTracking]}>{t.getReady}</Text>
          <Text style={styles.countdownNum}>{countdown}</Text>
          <Text style={styles.countdownDesc}>{t.standStill}</Text>
          <SecondaryButton label={t.cancel} onPress={cancelCountdown} style={styles.countdownCancel} />
        </View>
      )}
    </SafeAreaView>
  );
}

// =====================================================================
// HOME
// =====================================================================
function HomeScreen({
  t,
  thai,
  difficulty,
  onDifficulty,
  sensorStatus,
  lastSession,
  onStart,
  headerAction,
}: {
  t: Strings;
  thai: boolean;
  difficulty: Difficulty;
  onDifficulty: (d: Difficulty) => void;
  sensorStatus: SensorStatus;
  lastSession: SessionSummary | null;
  onStart: () => void;
  headerAction: React.ReactNode;
}) {
  const sensorChip =
    sensorStatus === 'READY'
      ? { label: t.sensorsReady, tone: 'success' as StatusTone }
      : sensorStatus === 'UNAVAILABLE'
        ? { label: t.sensorUnavailable, tone: 'error' as StatusTone }
        : { label: t.checkingSensors, tone: 'neutral' as StatusTone };

  const lastAccuracy = lastSession ? calcAccuracy(lastSession.stats) : null;
  const track = thai ? styles.noTracking : null;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <AppHeader
          title="SquatSense"
          subtitle={t.subtitle}
          icon={<Activity color={colors.primary} size={sizes.headerIcon} />}
          settingsAction={headerAction}
          style={styles.header}
        />

        <StatusChip label={sensorChip.label} tone={sensorChip.tone} style={styles.sensorChip} />

        <Text style={[styles.sectionLabel, track]}>{t.depthDifficulty}</Text>
        <View style={styles.difficultyRow}>
          <DifficultyOption
            title={t.BEGINNER}
            detail={t.diffDetail(35)}
            selected={difficulty === 'BEGINNER'}
            onPress={() => onDifficulty('BEGINNER')}
            thai={thai}
          />
          <DifficultyOption
            title={t.PRO}
            detail={t.diffDetail(25)}
            selected={difficulty === 'PRO'}
            onPress={() => onDifficulty('PRO')}
            thai={thai}
          />
        </View>

        {lastSession ? (
          <SectionCard title={t.lastSession} style={styles.homeCard}>
            <View style={styles.lastRow}>
              <MiniStat value={String(lastSession.stats.goodReps)} label={t.validRepsShort} />
              <MiniStat value={lastAccuracy === null ? '--' : `${lastAccuracy}%`} label={t.accuracyShort} />
              <MiniStat value={formatDuration(lastSession.durationMs)} label={t.duration} />
            </View>
          </SectionCard>
        ) : (
          <SectionCard title={t.howItWorks} style={styles.homeCard}>
            <HowStep icon={<Smartphone color={colors.primary} size={20} />} text={t.how1} />
            <HowStep icon={<PersonStanding color={colors.primary} size={20} />} text={t.how2} />
            <HowStep icon={<ChevronsDown color={colors.primary} size={20} />} text={t.how3} />
          </SectionCard>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <PrimaryButton
          label={t.startCoach}
          icon={<Play color={colors.text} size={sizes.icon} fill={colors.text} />}
          onPress={onStart}
          disabled={sensorStatus === 'UNAVAILABLE'}
          style={styles.bigButton}
        />
        {sensorStatus === 'UNAVAILABLE' && <Text style={styles.unavailableNote}>{t.unavailableNote}</Text>}
      </View>
    </View>
  );
}

function DifficultyOption({
  title,
  detail,
  selected,
  onPress,
  thai,
}: {
  title: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
  thai: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.diffOption, selected && styles.diffOptionActive]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={[styles.radio, selected && styles.radioActive]}>
        {selected && <View style={styles.radioDot} />}
      </View>
      <Text weight="bold" style={[styles.diffTitle, thai && styles.noTracking]}>{title}</Text>
      <Text variant="caption" style={styles.diffDetail}>{detail}</Text>
    </TouchableOpacity>
  );
}

function HowStep({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={styles.howStep}>
      <View style={styles.howIcon}>{icon}</View>
      <Text variant="small" style={styles.howText}>{text}</Text>
    </View>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.miniStat}>
      <Text variant="heading" weight="bold" style={styles.tabular}>{value}</Text>
      <Text variant="caption" style={styles.mutedText}>{label}</Text>
    </View>
  );
}

// =====================================================================
// CALIBRATION / PREPARATION
// =====================================================================
function CalibrationScreen({
  t,
  difficulty,
  targetAngle,
  onBack,
  onReady,
  counting,
}: {
  t: Strings;
  difficulty: Difficulty;
  targetAngle: number;
  onBack: () => void;
  onReady: () => void;
  counting: boolean;
}) {
  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back to home">
          <ArrowLeft color={colors.text} size={sizes.icon} />
        </TouchableOpacity>
        <Text weight="bold" style={styles.topBarTitle}>{t.getIntoPosition}</Text>
        <View style={styles.iconSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.phoneIllustration}>
          <View style={styles.phoneCircle}>
            <Smartphone color={colors.primary} size={64} strokeWidth={1.5} />
          </View>
          <Text variant="heading" weight="bold" style={styles.centerText}>{t.frontPocket}</Text>
          <Text variant="small" style={[styles.mutedText, styles.centerText]}>{t.pocketDetail}</Text>
        </View>

        <SectionCard style={styles.homeCard}>
          <NumberedStep n={1} text={t.step1} />
          <NumberedStep n={2} text={t.step2} />
          <NumberedStep n={3} text={t.step3} />
        </SectionCard>

        <View style={styles.targetRow}>
          <Target color={colors.textSecondary} size={16} />
          <Text variant="small" style={[styles.mutedText, styles.flexShrink]}>
            {t.targetLine(t[difficulty], targetAngle)}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <PrimaryButton label={t.imReady} onPress={onReady} disabled={counting} style={styles.bigButton} />
      </View>
    </View>
  );
}

function NumberedStep({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.howStep}>
      <View style={styles.stepNumber}>
        <Text variant="caption" weight="bold">{n}</Text>
      </View>
      <Text variant="small" style={styles.howText}>{text}</Text>
    </View>
  );
}

// =====================================================================
// WORKOUT
// =====================================================================
const RING_SIZE = 260;
const RING_STROKE = 14;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;

/** Depth ring: fills as the thigh approaches the target angle; full ring = target depth. */
function DepthRing({ progress, reached, children }: { progress: number; reached: boolean; children: React.ReactNode }) {
  const p = Math.min(1, Math.max(0, progress));
  return (
    <View style={styles.ringWrap}>
      <View style={styles.ringSvg}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R}
            stroke={colors.glassStrong}
            strokeWidth={RING_STROKE}
            fill="none"
          />
          {p > 0 ? (
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_R}
              stroke={reached ? colors.success : colors.primary}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={`${RING_C} ${RING_C}`}
              strokeDashoffset={RING_C * (1 - p)}
              fill="none"
            />
          ) : null}
        </Svg>
      </View>
      <View style={styles.ringInner}>{children}</View>
    </View>
  );
}

function WorkoutScreen({
  t,
  thai,
  stats,
  angle,
  targetAngle,
  repState,
  feedback,
  tone,
  repResults,
  isActive,
  hasStarted,
  elapsedMs,
  onPause,
  onResume,
  onFinish,
  headerAction,
}: {
  t: Strings;
  thai: boolean;
  stats: WorkoutStats;
  angle: number;
  targetAngle: number;
  repState: RepState;
  feedback: string;
  tone: StatusTone;
  repResults: RepResult[];
  isActive: boolean;
  hasStarted: boolean;
  elapsedMs: number;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  headerAction: React.ReactNode;
}) {
  const toneColor = isActive ? TONE_COLOR[tone] : colors.textSecondary;
  const depthProgress = hasStarted ? (90 - angle) / (90 - targetAngle) : 0;
  const reachedDepth = hasStarted && angle <= targetAngle;

  // ---- Valid-rep celebration: bounce + green flash ----
  const scale = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const prevGood = useRef(stats.goodReps);

  useEffect(() => {
    if (stats.goodReps > prevGood.current) {
      scale.setValue(1);
      flash.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.22, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(flash, { toValue: 1, duration: 120, useNativeDriver: true }),
          Animated.timing(flash, { toValue: 0, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
      ]).start();
    }
    prevGood.current = stats.goodReps;
  }, [stats.goodReps, scale, flash]);

  const track = thai ? styles.noTracking : null;

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.timerPill}>
          <Clock color={colors.textSecondary} size={14} />
          <Text variant="small" weight="semibold" style={styles.tabular}>{formatDuration(elapsedMs)}</Text>
        </View>
        <View style={styles.liveRow}>
          {isActive ? <View style={styles.liveDot} /> : null}
          <Text variant="caption" weight="bold" style={[styles.mutedLabel, track]}>
            {isActive ? t.live : t.paused}
          </Text>
        </View>
        {headerAction}
      </View>

      <View style={styles.workoutBody}>
        <View style={styles.ringArea}>
          <Animated.View pointerEvents="none" style={[styles.flashGlow, { opacity: flash }]} />
          <DepthRing progress={depthProgress} reached={reachedDepth}>
            <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
              <Text style={[styles.repNumber, styles.repGlow]}>{stats.goodReps}</Text>
              <Text variant="caption" weight="bold" style={[styles.mutedLabel, track]}>{t.validReps}</Text>
            </Animated.View>
          </DepthRing>
        </View>

        <StatusChip label={isActive ? t[repState] : t.paused} tone={isActive ? tone : 'neutral'} />

        <Text variant="heading" weight="bold" style={[styles.feedback, { color: isActive ? (tone === 'neutral' ? colors.text : toneColor) : colors.textSecondary }]}>
          {feedback}
        </Text>

        <Text variant="caption" style={[styles.mutedText, styles.centerText]}>
          {t.angleLine(hasStarted ? `${angle}°` : '--', targetAngle)}
        </Text>

        <View style={styles.dotsRow} accessibilityLabel={`${repResults.length} attempts recorded`}>
          {repResults.length === 0 ? (
            <Text variant="caption" style={styles.mutedText}>{t.attemptsHint}</Text>
          ) : (
            repResults.map((r, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: TONE_COLOR[RESULT_TONE[r]] }]} />
            ))
          )}
        </View>
      </View>

      <View style={[styles.bottomBar, styles.workoutActions]}>
        {isActive ? (
          <SecondaryButton
            label={t.pause}
            icon={<Pause color={colors.text} size={sizes.icon} />}
            onPress={onPause}
            style={styles.flex1}
          />
        ) : (
          <PrimaryButton
            label={t.resume}
            icon={<Play color={colors.text} size={sizes.icon} fill={colors.text} />}
            onPress={onResume}
            style={styles.flex1}
          />
        )}
        <SecondaryButton
          label={t.end}
          icon={<Square color={colors.error} size={sizes.icon} fill={colors.error} />}
          onPress={onFinish}
          style={styles.flex1}
        />
      </View>
    </View>
  );
}

// =====================================================================
// SUMMARY
// =====================================================================
function SummaryScreen({
  t,
  thai,
  session,
  repResults,
  onTryAgain,
  onHome,
}: {
  t: Strings;
  thai: boolean;
  session: SessionSummary;
  repResults: RepResult[];
  onTryAgain: () => void;
  onHome: () => void;
}) {
  const { stats } = session;
  const accuracy = calcAccuracy(stats);
  const incorrect = stats.totalReps - stats.goodReps;
  const track = thai ? styles.noTracking : null;

  const errors = [
    { key: 'shallow', label: t.errShallow, count: stats.shallowReps, color: colors.error },
    { key: 'fast', label: t.errFast, count: stats.fastReps, color: colors.warning },
    { key: 'wobble', label: t.errWobble, count: stats.wobbleReps, color: colors.warning },
  ];
  const topError = [...errors].sort((a, b) => b.count - a.count)[0];
  const hasErrors = topError.count > 0;

  const tips: string[] = [];
  if (stats.totalReps === 0) {
    tips.push(t.tipNone);
  } else {
    if (stats.shallowReps > 0) tips.push(t.tipShallow);
    if (stats.fastReps > 0) tips.push(t.tipFast);
    if (stats.wobbleReps > 0) tips.push(t.tipWobble);
    if (tips.length === 0) tips.push(t.tipPerfect);
  }

  const accColor =
    accuracy === null ? colors.textSecondary : accuracy >= 80 ? colors.success : accuracy >= 50 ? colors.warning : colors.error;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text variant="title" weight="bold" style={styles.centerText}>{t.workoutComplete}</Text>
        <Text variant="small" style={[styles.mutedText, styles.centerText, styles.summarySub]}>
          {t[session.difficulty]} · {formatDuration(session.durationMs)}
        </Text>

        <SectionCard style={styles.accuracyCard}>
          <Text variant="caption" weight="bold" style={[styles.mutedLabel, track]}>{t.formAccuracy}</Text>
          <Text style={[styles.accuracyValue, { color: accColor }]}>{accuracy === null ? '--' : `${accuracy}%`}</Text>
          <View style={styles.accuracyTrack}>
            <View style={[styles.accuracyFill, { width: `${accuracy ?? 0}%`, backgroundColor: accColor }]} />
          </View>
          <Text variant="caption" style={styles.mutedText}>{t.validOf(stats.goodReps, stats.totalReps)}</Text>
        </SectionCard>

        <View style={styles.statGrid}>
          <GridStat value={String(stats.goodReps)} label={t.gridValid} color={colors.success} />
          <GridStat value={String(incorrect)} label={t.gridIncorrect} color={incorrect > 0 ? colors.error : colors.text} />
          <GridStat value={String(stats.totalReps)} label={t.gridTotal} />
          <GridStat value={formatDuration(session.durationMs)} label={t.duration} />
        </View>

        <SectionCard title={t.formAnalysis} style={styles.homeCard}>
          {errors.map((e) => (
            <View key={e.key} style={styles.errorRow}>
              <View style={[styles.errorDot, { backgroundColor: e.color }]} />
              <Text variant="small" style={styles.flex1}>
                {e.label}
                {hasErrors && e.key === topError.key ? t.mostCommon : ''}
              </Text>
              <Text variant="body" weight="bold" style={[styles.tabular, { color: e.count > 0 ? e.color : colors.textSecondary }]}>
                {e.count}
              </Text>
            </View>
          ))}
          {repResults.length > 0 && (
            <View style={[styles.dotsRow, styles.summaryDots]}>
              {repResults.map((r, i) => (
                <View key={i} style={[styles.dot, { backgroundColor: TONE_COLOR[RESULT_TONE[r]] }]} />
              ))}
            </View>
          )}
        </SectionCard>

        <SectionCard style={styles.homeCard}>
          <View style={styles.tipHeader}>
            <Lightbulb color={colors.primary} size={18} />
            <Text variant="caption" weight="bold" style={[styles.mutedLabel, track]}>{t.nextTime}</Text>
          </View>
          {tips.map((tip, i) => (
            <Text key={i} variant="small" style={styles.tipText}>• {tip}</Text>
          ))}
        </SectionCard>
      </ScrollView>

      <View style={[styles.bottomBar, styles.workoutActions]}>
        <SecondaryButton
          label={t.home}
          icon={<House color={colors.text} size={sizes.icon} />}
          onPress={onHome}
          style={styles.flex1}
        />
        <PrimaryButton
          label={t.tryAgain}
          icon={<RotateCcw color={colors.text} size={sizes.icon} />}
          onPress={onTryAgain}
          style={styles.flex1}
        />
      </View>
    </View>
  );
}

function GridStat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <SectionCard style={styles.gridStat}>
      <Text variant="title" weight="bold" style={[styles.tabular, color ? { color } : null]}>{value}</Text>
      <Text variant="caption" style={styles.mutedText}>{label}</Text>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1 },
  flex1: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  centerText: { textAlign: 'center' },
  mutedText: { color: colors.textSecondary },
  mutedLabel: { color: colors.textSecondary, letterSpacing: typography.letterSpacing.wide },
  // Thai combining marks must not be letter-spaced.
  noTracking: { letterSpacing: 0 },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: { marginBottom: spacing.md },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  iconButton: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  iconSpacer: { width: sizes.touchTarget, height: sizes.touchTarget },
  bottomBar: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  bigButton: { minHeight: 60 },

  // Home
  sensorChip: { alignSelf: 'flex-start', marginBottom: spacing.xxl },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.caption,
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing.sm,
  },
  difficultyRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  diffOption: {
    flex: 1,
    backgroundColor: colors.glass,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
    gap: spacing.xs,
    boxShadow: shadows.float,
  },
  diffOptionActive: { borderColor: colors.primary, backgroundColor: colors.primaryGlass },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  diffTitle: { letterSpacing: typography.letterSpacing.label },
  diffDetail: { color: colors.textSecondary },
  homeCard: { marginBottom: spacing.lg, gap: spacing.md },
  howStep: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  howIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howText: { flex: 1, color: colors.text },
  lastRow: { flexDirection: 'row', justifyContent: 'space-between' },
  miniStat: { alignItems: 'center', flex: 1 },
  unavailableNote: { color: colors.error, textAlign: 'center', marginTop: spacing.sm, fontSize: typography.fontSize.caption },

  // Calibration
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  topBarTitle: { flex: 1, textAlign: 'center' },
  phoneIllustration: { alignItems: 'center', gap: spacing.sm, marginVertical: spacing.xxl },
  phoneCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderTopColor: colors.glassHighlight,
    boxShadow: shadows.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },

  // Workout
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: sizes.touchTarget - 8,
  },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error },
  workoutBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl, gap: spacing.md },
  ringArea: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  flashGlow: {
    position: 'absolute',
    width: RING_SIZE - 40,
    height: RING_SIZE - 40,
    borderRadius: (RING_SIZE - 40) / 2,
    backgroundColor: 'rgba(34, 197, 139, 0.25)',
    boxShadow: '0px 0px 60px rgba(34, 197, 139, 0.9)',
  },
  ringWrap: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  ringSvg: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
  ringInner: {
    width: RING_SIZE - RING_STROKE * 2 - 16,
    height: RING_SIZE - RING_STROKE * 2 - 16,
    borderRadius: (RING_SIZE - RING_STROKE * 2 - 16) / 2,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderTopColor: colors.glassHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repGlow: { textShadowColor: 'rgba(255, 255, 255, 0.25)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 24 },
  repNumber: {
    fontSize: 96,
    lineHeight: 112,
    fontWeight: typography.weight.bold,
    fontVariant: ['tabular-nums'],
  },
  feedback: { textAlign: 'center', minHeight: 56 },
  dotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 16,
  },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.glassHighlight },
  workoutActions: { flexDirection: 'row', gap: spacing.md },

  // Summary
  summarySub: { marginTop: spacing.xs, marginBottom: spacing.xl },
  accuracyCard: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  accuracyValue: {
    fontSize: typography.fontSize.display,
    lineHeight: typography.lineHeight.display,
    fontWeight: typography.weight.bold,
    fontVariant: ['tabular-nums'],
  },
  accuracyTrack: {
    width: '100%',
    height: 10,
    backgroundColor: colors.glassStrong,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  accuracyFill: { height: '100%', borderRadius: radius.pill },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg },
  gridStat: { width: '47%', flexGrow: 1, alignItems: 'center', paddingVertical: spacing.lg },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  errorDot: { width: 10, height: 10, borderRadius: 5 },
  summaryDots: { justifyContent: 'flex-start', marginTop: spacing.sm },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tipText: { color: colors.text },

  // Countdown overlay
  countdownOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  countdownSub: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.body,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.letterSpacing.countdown,
    marginBottom: spacing.sm,
  },
  countdownNum: {
    color: colors.primary,
    fontSize: typography.fontSize.countdown,
    lineHeight: typography.lineHeight.countdown,
    fontWeight: typography.weight.bold,
  },
  countdownDesc: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.small,
    marginTop: spacing.lg,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
    paddingHorizontal: spacing.screenBottom,
  },
  countdownCancel: { marginTop: spacing.xxxl, minWidth: 160 },
});
