import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Alert,
  AppState,
  BackHandler,
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

import { ThemeProvider, colors, radius, sizes, spacing, typography, type StatusTone } from './src/theme';
import {
  AppHeader,
  AppText as Text,
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

const STATE_LABEL: Record<RepState, string> = {
  STANDING: 'STANDING',
  DESCENDING: 'DESCENDING',
  BOTTOM: 'BOTTOM POSITION',
  ASCENDING: 'ASCENDING',
};

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
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStatsRef = useRef<WorkoutStats>(EMPTY_STATS);
  const statsRef = useRef<WorkoutStats>(EMPTY_STATS);
  const activeSinceRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef<number>(0);

  const targetAngle = difficulty === 'BEGINNER' ? 35 : 25;

  const speak = (text: string) => {
    if (mutedRef.current) return;
    const now = Date.now();
    if (now - lastSpeakTimeRef.current < 1100) return;
    lastSpeakTimeRef.current = now;
    Speech.stop();
    Speech.speak(text, { language: 'en-US', rate: 1.0 });
  };

  const toggleMute = () => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (next) Speech.stop();
  };

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
    const t = setInterval(() => {
      const running = activeSinceRef.current !== null ? Date.now() - activeSinceRef.current : 0;
      setElapsedMs(accumulatedMsRef.current + running);
    }, 500);
    return () => clearInterval(t);
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
    Alert.alert('End workout?', 'Your results will be shown on the summary screen.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'End workout', style: 'destructive', onPress: finishWorkout },
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

  const muteButton = (
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
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {screen === 'HOME' && (
        <HomeScreen
          difficulty={difficulty}
          onDifficulty={handleDifficultyChange}
          sensorStatus={sensorStatus}
          lastSession={lastSession}
          onStart={goToCalibration}
          headerAction={muteButton}
        />
      )}

      {screen === 'CALIBRATION' && (
        <CalibrationScreen
          difficulty={difficulty}
          targetAngle={targetAngle}
          onBack={goHome}
          onReady={handleStartCountdown}
          counting={countdown !== null}
        />
      )}

      {screen === 'WORKOUT' && (
        <WorkoutScreen
          stats={stats}
          angle={currentAngle}
          targetAngle={targetAngle}
          repState={repState}
          feedback={feedback}
          lastResult={lastResult}
          repResults={repResults}
          isActive={isActive}
          hasStarted={hasStarted}
          interrupted={interrupted}
          elapsedMs={elapsedMs}
          onPause={() => pauseWorkout()}
          onResume={resumeWorkout}
          onFinish={confirmFinish}
          headerAction={muteButton}
        />
      )}

      {screen === 'SUMMARY' && lastSession && (
        <SummaryScreen
          session={lastSession}
          repResults={repResults}
          onTryAgain={goToCalibration}
          onHome={goHome}
        />
      )}

      {countdown !== null && (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownSub}>GET READY</Text>
          <Text style={styles.countdownNum}>{countdown}</Text>
          <Text style={styles.countdownDesc}>Stand upright and stay still</Text>
          <SecondaryButton label="CANCEL" onPress={cancelCountdown} style={styles.countdownCancel} />
        </View>
      )}
    </SafeAreaView>
  );
}

// =====================================================================
// HOME
// =====================================================================
function HomeScreen({
  difficulty,
  onDifficulty,
  sensorStatus,
  lastSession,
  onStart,
  headerAction,
}: {
  difficulty: Difficulty;
  onDifficulty: (d: Difficulty) => void;
  sensorStatus: SensorStatus;
  lastSession: SessionSummary | null;
  onStart: () => void;
  headerAction: React.ReactNode;
}) {
  const sensorChip =
    sensorStatus === 'READY'
      ? { label: '● SENSORS READY', tone: 'success' as StatusTone }
      : sensorStatus === 'UNAVAILABLE'
        ? { label: '● SENSOR UNAVAILABLE', tone: 'error' as StatusTone }
        : { label: 'CHECKING SENSORS…', tone: 'neutral' as StatusTone };

  const lastAccuracy = lastSession ? calcAccuracy(lastSession.stats) : null;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <AppHeader
          title="SquatSense"
          subtitle="Biomechanics Motion Coach"
          icon={<Activity color={colors.primary} size={sizes.headerIcon} />}
          settingsAction={headerAction}
          style={styles.header}
        />

        <StatusChip label={sensorChip.label} tone={sensorChip.tone} style={styles.sensorChip} />

        <Text style={styles.sectionLabel}>DEPTH DIFFICULTY</Text>
        <View style={styles.difficultyRow}>
          <DifficultyOption
            title="BEGINNER"
            detail="Thigh ≤ 35° from horizontal"
            selected={difficulty === 'BEGINNER'}
            onPress={() => onDifficulty('BEGINNER')}
          />
          <DifficultyOption
            title="PRO"
            detail="Thigh ≤ 25° from horizontal"
            selected={difficulty === 'PRO'}
            onPress={() => onDifficulty('PRO')}
          />
        </View>

        {lastSession ? (
          <SectionCard title="LAST SESSION" style={styles.homeCard}>
            <View style={styles.lastRow}>
              <MiniStat value={String(lastSession.stats.goodReps)} label="Valid reps" />
              <MiniStat value={lastAccuracy === null ? '--' : `${lastAccuracy}%`} label="Accuracy" />
              <MiniStat value={formatDuration(lastSession.durationMs)} label="Duration" />
            </View>
          </SectionCard>
        ) : (
          <SectionCard title="HOW IT WORKS" style={styles.homeCard}>
            <HowStep icon={<Smartphone color={colors.primary} size={20} />} text="Put your phone in your front trouser pocket, screen facing out." />
            <HowStep icon={<PersonStanding color={colors.primary} size={20} />} text="Stand upright and stay still for the countdown." />
            <HowStep icon={<ChevronsDown color={colors.primary} size={20} />} text="Squat. Listen and feel for feedback — no need to look at the screen." />
          </SectionCard>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <PrimaryButton
          label="START COACH"
          icon={<Play color={colors.text} size={sizes.icon} fill={colors.text} />}
          onPress={onStart}
          disabled={sensorStatus === 'UNAVAILABLE'}
          style={styles.bigButton}
        />
        {sensorStatus === 'UNAVAILABLE' && (
          <Text style={styles.unavailableNote}>
            This device does not report an accelerometer and gyroscope.
          </Text>
        )}
      </View>
    </View>
  );
}

function DifficultyOption({
  title,
  detail,
  selected,
  onPress,
}: {
  title: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
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
      <Text weight="bold" style={styles.diffTitle}>{title}</Text>
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
  difficulty,
  targetAngle,
  onBack,
  onReady,
  counting,
}: {
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
        <Text weight="bold" style={styles.topBarTitle}>Get into position</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.phoneIllustration}>
          <View style={styles.phoneCircle}>
            <Smartphone color={colors.primary} size={64} strokeWidth={1.5} />
          </View>
          <Text variant="heading" weight="bold" style={styles.centerText}>Front trouser pocket</Text>
          <Text variant="small" style={[styles.mutedText, styles.centerText]}>
            Screen facing out · top of the phone pointing toward your hip
          </Text>
        </View>

        <SectionCard style={styles.homeCard}>
          <NumberedStep n={1} text="Place the phone in your front trouser pocket as shown above." />
          <NumberedStep n={2} text="Stand upright with your feet shoulder-width apart." />
          <NumberedStep n={3} text="Tap the button, then stay still during the 3-second countdown." />
        </SectionCard>

        <View style={styles.targetRow}>
          <Target color={colors.textSecondary} size={16} />
          <Text variant="small" style={styles.mutedText}>
            {difficulty} · depth target: thigh ≤ {targetAngle}° from horizontal
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <PrimaryButton
          label="I'M READY"
          onPress={onReady}
          disabled={counting}
          style={styles.bigButton}
        />
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
function WorkoutScreen({
  stats,
  angle,
  targetAngle,
  repState,
  feedback,
  lastResult,
  repResults,
  isActive,
  hasStarted,
  interrupted,
  elapsedMs,
  onPause,
  onResume,
  onFinish,
  headerAction,
}: {
  stats: WorkoutStats;
  angle: number;
  targetAngle: number;
  repState: RepState;
  feedback: string;
  lastResult: RepResult | null;
  repResults: RepResult[];
  isActive: boolean;
  hasStarted: boolean;
  interrupted: boolean;
  elapsedMs: number;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  headerAction: React.ReactNode;
}) {
  const tone: StatusTone = lastResult
    ? RESULT_TONE[lastResult]
    : repState === 'BOTTOM'
      ? 'success'
      : 'neutral';
  const toneColor = isActive ? TONE_COLOR[tone] : colors.textSecondary;

  const depthPct = Math.min(100, Math.max(0, ((90 - angle) / (90 - targetAngle)) * 100));
  const reachedDepth = angle <= targetAngle;

  return (
    <View style={[styles.screen, styles.workoutScreen, { borderColor: toneColor }]}>
      <View style={styles.topBar}>
        <View style={styles.timerPill}>
          <Clock color={colors.textSecondary} size={14} />
          <Text variant="small" weight="semibold" style={styles.tabular}>{formatDuration(elapsedMs)}</Text>
        </View>
        <Text variant="caption" weight="bold" style={styles.mutedLabel}>
          {isActive ? 'LIVE' : 'PAUSED'}
        </Text>
        {headerAction}
      </View>

      <View style={styles.workoutBody}>
        <View style={styles.repBlock}>
          <Text style={styles.repNumber}>
            {stats.goodReps}
          </Text>
          <Text variant="small" weight="bold" style={styles.mutedLabel}>VALID REPS</Text>
        </View>

        <StatusChip label={isActive ? STATE_LABEL[repState] : 'PAUSED'} tone={isActive ? tone : 'neutral'} />

        <Text variant="heading" weight="bold" style={[styles.feedback, { color: isActive ? toneColor : colors.textSecondary }]}>
          {interrupted ? 'Paused — app left the foreground' : feedback}
        </Text>

        <SectionCard style={styles.depthCard}>
          <View style={styles.depthHeader}>
            <Text variant="caption" weight="bold" style={styles.mutedLabel}>DEPTH</Text>
            <Text variant="caption" style={styles.mutedText}>
              Thigh angle {hasStarted ? `${angle}°` : '--'} · target ≤ {targetAngle}°
            </Text>
          </View>
          <View style={styles.depthTrack}>
            <View
              style={[
                styles.depthFill,
                {
                  width: `${hasStarted ? depthPct : 0}%`,
                  backgroundColor: reachedDepth ? colors.success : colors.primary,
                },
              ]}
            />
            <View style={styles.depthTargetMarker} />
          </View>
          <View style={styles.depthLabels}>
            <Text variant="caption" style={styles.mutedText}>Standing</Text>
            <Text variant="caption" style={{ color: colors.success }}>Target</Text>
          </View>
        </SectionCard>

        <View style={styles.dotsRow} accessibilityLabel={`${repResults.length} attempts recorded`}>
          {repResults.length === 0 ? (
            <Text variant="caption" style={styles.mutedText}>Each attempt will appear here</Text>
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
            label="PAUSE"
            icon={<Pause color={colors.text} size={sizes.icon} />}
            onPress={onPause}
            style={styles.flex1}
          />
        ) : (
          <PrimaryButton
            label="RESUME"
            icon={<Play color={colors.text} size={sizes.icon} fill={colors.text} />}
            onPress={onResume}
            style={styles.flex1}
          />
        )}
        <SecondaryButton
          label="END"
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
  session,
  repResults,
  onTryAgain,
  onHome,
}: {
  session: SessionSummary;
  repResults: RepResult[];
  onTryAgain: () => void;
  onHome: () => void;
}) {
  const { stats } = session;
  const accuracy = calcAccuracy(stats);
  const incorrect = stats.totalReps - stats.goodReps;

  const errors = [
    { key: 'shallow', label: 'Too shallow', count: stats.shallowReps, color: colors.error },
    { key: 'fast', label: 'Too fast', count: stats.fastReps, color: colors.warning },
    { key: 'wobble', label: 'Unstable (wobble)', count: stats.wobbleReps, color: colors.warning },
  ];
  const topError = [...errors].sort((a, b) => b.count - a.count)[0];
  const hasErrors = topError.count > 0;

  const tips: string[] = [];
  if (stats.totalReps === 0) {
    tips.push('No attempts were detected. Check that the phone is in your front pocket, screen out, and squat until your thigh is close to horizontal.');
  } else {
    if (stats.shallowReps > 0) tips.push('Squat deeper — bring your thigh closer to horizontal before standing up.');
    if (stats.fastReps > 0) tips.push('Lower yourself more slowly and with control instead of dropping into the squat.');
    if (stats.wobbleReps > 0) tips.push('Keep the movement steady — the phone detected a lot of rotation during some reps.');
    if (tips.length === 0) tips.push('Every recorded attempt met the depth target with controlled speed. Keep it up!');
  }

  const accColor =
    accuracy === null ? colors.textSecondary : accuracy >= 80 ? colors.success : accuracy >= 50 ? colors.warning : colors.error;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text variant="title" weight="bold" style={styles.centerText}>Workout complete</Text>
        <Text variant="small" style={[styles.mutedText, styles.centerText, styles.summarySub]}>
          {session.difficulty} · {formatDuration(session.durationMs)}
        </Text>

        <SectionCard style={styles.accuracyCard}>
          <Text variant="caption" weight="bold" style={styles.mutedLabel}>FORM ACCURACY</Text>
          <Text style={[styles.accuracyValue, { color: accColor }]}>
            {accuracy === null ? '--' : `${accuracy}%`}
          </Text>
          <View style={styles.accuracyTrack}>
            <View style={[styles.accuracyFill, { width: `${accuracy ?? 0}%`, backgroundColor: accColor }]} />
          </View>
          <Text variant="caption" style={styles.mutedText}>
            {stats.goodReps} of {stats.totalReps} recorded attempts were valid
          </Text>
        </SectionCard>

        <View style={styles.statGrid}>
          <GridStat value={String(stats.goodReps)} label="Valid reps" color={colors.success} />
          <GridStat value={String(incorrect)} label="Incorrect" color={incorrect > 0 ? colors.error : colors.text} />
          <GridStat value={String(stats.totalReps)} label="Total attempts" />
          <GridStat value={formatDuration(session.durationMs)} label="Duration" />
        </View>

        <SectionCard title="FORM ANALYSIS" style={styles.homeCard}>
          {errors.map((e) => (
            <View key={e.key} style={styles.errorRow}>
              <View style={[styles.errorDot, { backgroundColor: e.color }]} />
              <Text variant="small" style={styles.flex1}>
                {e.label}
                {hasErrors && e.key === topError.key ? '  · most common' : ''}
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
            <Text variant="caption" weight="bold" style={styles.mutedLabel}>NEXT TIME</Text>
          </View>
          {tips.map((t, i) => (
            <Text key={i} variant="small" style={styles.tipText}>• {t}</Text>
          ))}
        </SectionCard>
      </ScrollView>

      <View style={[styles.bottomBar, styles.workoutActions]}>
        <SecondaryButton
          label="HOME"
          icon={<House color={colors.text} size={sizes.icon} />}
          onPress={onHome}
          style={styles.flex1}
        />
        <PrimaryButton
          label="TRY AGAIN"
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
  tabular: { fontVariant: ['tabular-nums'] },
  centerText: { textAlign: 'center' },
  mutedText: { color: colors.textSecondary },
  mutedLabel: { color: colors.textSecondary, letterSpacing: typography.letterSpacing.wide },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: { marginBottom: spacing.md },
  iconButton: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
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
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  diffOptionActive: { borderColor: colors.primary, backgroundColor: colors.surface },
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
    backgroundColor: colors.surface,
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
  },
  topBarTitle: { flex: 1, textAlign: 'center' },
  phoneIllustration: { alignItems: 'center', gap: spacing.sm, marginVertical: spacing.xxl },
  phoneCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.surface,
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
  workoutScreen: { borderWidth: 3, borderRadius: radius.lg, margin: spacing.xs },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: sizes.touchTarget - 8,
  },
  workoutBody: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.lg },
  repBlock: { alignItems: 'center' },
  repNumber: {
    fontSize: 140,
    lineHeight: 160,
    fontWeight: typography.weight.bold,
    fontVariant: ['tabular-nums'],
  },
  feedback: { textAlign: 'center', minHeight: 56 },
  depthCard: { gap: spacing.sm },
  depthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  depthTrack: {
    height: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  depthFill: { height: '100%', borderRadius: radius.pill },
  depthTargetMarker: {
    position: 'absolute',
    right: 0,
    width: 4,
    height: '100%',
    backgroundColor: colors.success,
  },
  depthLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  dotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 16,
  },
  dot: { width: 14, height: 14, borderRadius: 7 },
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
    backgroundColor: colors.surface,
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
