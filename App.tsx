import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Modal,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import {
  Play,
  Square,
  RotateCcw,
  Activity,
  CheckCircle2,
  Flame,
  Award,
  X,
  Sliders,
} from 'lucide-react-native';

import { ThemeProvider, colors, radius, sizes, spacing, typography } from './src/theme';
import {
  AppHeader,
  AppText as Text,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
  StatCard,
  StatusChip,
} from './src/components/ui';

type RepState = 'STANDING' | 'DESCENDING' | 'BOTTOM' | 'ASCENDING';
type Difficulty = 'BEGINNER' | 'PRO';

interface WorkoutStats {
  totalReps: number;
  goodReps: number;
  shallowReps: number;
  fastReps: number;
  wobbleReps: number;
}

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
  const [isActive, setIsActive] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('BEGINNER');
  const [currentAngle, setCurrentAngle] = useState<number>(90);
  const [repState, setRepState] = useState<RepState>('STANDING');
  const [feedback, setFeedback] = useState<string>('Ready to start');
  const [showSummary, setShowSummary] = useState<boolean>(false);
  const [stats, setStats] = useState<WorkoutStats>({
    totalReps: 0,
    goodReps: 0,
    shallowReps: 0,
    fastReps: 0,
    wobbleReps: 0,
  });

  const stateRef = useRef<RepState>('STANDING');
  const difficultyRef = useRef<Difficulty>('BEGINNER');
  const minAngleInRepRef = useRef<number>(90);
  const repStartTimeRef = useRef<number>(0);
  const bottomTimeRef = useRef<number>(0);
  const maxWobbleRef = useRef<number>(0);
  const lastSpeakTimeRef = useRef<number>(0);

  const targetAngle = difficulty === 'BEGINNER' ? 35 : 25;

  const speak = (text: string) => {
    const now = Date.now();
    if (now - lastSpeakTimeRef.current < 1100) return;
    lastSpeakTimeRef.current = now;
    Speech.stop();
    Speech.speak(text, { language: 'en-US', rate: 1.0 });
  };

  const handleDifficultyChange = (mode: Difficulty) => {
    if (isActive || countdown !== null) return;
    setDifficulty(mode);
    difficultyRef.current = mode;
  };

  const handleStartCountdown = () => {
    if (countdown !== null || isActive) return;
    setCountdown(3);
    speak('Three');

    let current = 3;
    const timer = setInterval(() => {
      current -= 1;
      if (current > 0) {
        setCountdown(current);
        if (current === 2) speak('Two');
        if (current === 1) speak('One');
      } else {
        clearInterval(timer);
        setCountdown(null);
        startWorkout();
      }
    }, 1000);
  };

  const startWorkout = async () => {
    await activateKeepAwakeAsync();
    setIsActive(true);
    setRepState('STANDING');
    stateRef.current = 'STANDING';
    minAngleInRepRef.current = 90;
    maxWobbleRef.current = 0;
    setFeedback('Stand upright and begin');
    speak('Start workout');
  };

  const handleStop = () => {
    deactivateKeepAwake();
    setIsActive(false);
    setFeedback('Workout paused');
    speak('Workout paused');
    if (stats.totalReps > 0) {
      setShowSummary(true);
    }
  };

  const handleReset = () => {
    deactivateKeepAwake();
    setIsActive(false);
    setCountdown(null);
    setShowSummary(false);
    setCurrentAngle(90);
    setRepState('STANDING');
    stateRef.current = 'STANDING';
    setFeedback('Ready to start');
    setStats({
      totalReps: 0,
      goodReps: 0,
      shallowReps: 0,
      fastReps: 0,
      wobbleReps: 0,
    });
  };

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

  const accuracy =
    stats.totalReps > 0
      ? Math.round((stats.goodReps / stats.totalReps) * 100)
      : 100;

  const getPerformanceGrade = () => {
    if (stats.totalReps === 0) return { grade: 'N/A', color: colors.textSecondary };
    if (accuracy >= 85) return { grade: 'Grade A', color: colors.success };
    if (accuracy >= 70) return { grade: 'Grade B', color: colors.primary };
    if (accuracy >= 50) return { grade: 'Grade C', color: colors.warning };
    return { grade: 'Needs Work', color: colors.error };
  };

  const performance = getPerformanceGrade();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={styles.container}>
        <AppHeader
          title="SquatSense"
          subtitle="Biomechanics Motion Coach"
          icon={<Activity color={colors.primary} size={sizes.headerIcon} />}
          style={styles.header}
        />

        <SectionCard style={styles.difficultyContainer}>
          <View style={styles.difficultyLabelRow}>
            <Sliders color={colors.textSecondary} size={14} />
            <Text style={styles.difficultyLabel}>DEPTH DIFFICULTY</Text>
          </View>
          <View style={styles.difficultyButtonGroup}>
            <TouchableOpacity
              style={[
                styles.difficultyBtn,
                difficulty === 'BEGINNER' && styles.difficultyBtnActive,
              ]}
              onPress={() => handleDifficultyChange('BEGINNER')}
              disabled={isActive || countdown !== null}
              accessibilityRole="button"
              accessibilityState={{ selected: difficulty === 'BEGINNER', disabled: isActive || countdown !== null }}
            >
              <Text
                style={[
                  styles.difficultyBtnText,
                  difficulty === 'BEGINNER' && styles.difficultyBtnTextActive,
                ]}
              >
                BEGINNER (≤ 35°)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.difficultyBtn,
                difficulty === 'PRO' && styles.difficultyBtnActive,
              ]}
              onPress={() => handleDifficultyChange('PRO')}
              disabled={isActive || countdown !== null}
              accessibilityRole="button"
              accessibilityState={{ selected: difficulty === 'PRO', disabled: isActive || countdown !== null }}
            >
              <Text
                style={[
                  styles.difficultyBtnText,
                  difficulty === 'PRO' && styles.difficultyBtnTextActive,
                ]}
              >
                PRO (≤ 25°)
              </Text>
            </TouchableOpacity>
          </View>
        </SectionCard>

        <SectionCard style={styles.gaugeCard}>
          <Text style={styles.gaugeLabel}>THIGH ANGLE</Text>
          <View style={styles.angleDisplay}>
            <Text style={styles.angleValue}>{currentAngle}°</Text>
            <Text style={styles.angleTarget}>Target: ≤ {targetAngle}°</Text>
          </View>

          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${Math.min(
                    100,
                    Math.max(
                      0,
                      ((90 - currentAngle) / (90 - targetAngle)) * 100
                    )
                  )}%`,
                  backgroundColor:
                    currentAngle <= targetAngle ? colors.success : colors.primary,
                },
              ]}
            />
          </View>

          <StatusChip label={repState} style={styles.statusBadge} />

          <Text style={styles.feedbackText}>{feedback}</Text>
        </SectionCard>

        <View style={styles.counterGrid}>
          <StatCard
            label="VALID REPS"
            value={stats.goodReps}
            icon={<Flame color={colors.primary} size={sizes.statIcon} />}
            style={styles.counterCard}
          />
          <StatCard
            label="ACCURACY"
            value={stats.totalReps > 0 ? `${accuracy}%` : null}
            icon={<CheckCircle2 color={colors.primary} size={sizes.statIcon} />}
            style={styles.counterCard}
          />
        </View>

        <SectionCard style={styles.breakdownCard}>
          <Text style={styles.breakdownTitle}>FORM DIAGNOSTICS</Text>
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownValue}>{stats.totalReps}</Text>
              <Text style={styles.breakdownLabel}>Total</Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={[styles.breakdownValue, { color: colors.error }]}>
                {stats.shallowReps}
              </Text>
              <Text style={styles.breakdownLabel}>Shallow</Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={[styles.breakdownValue, { color: colors.warning }]}>
                {stats.fastReps}
              </Text>
              <Text style={styles.breakdownLabel}>Too Fast</Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={[styles.breakdownValue, { color: colors.warning }]}>
                {stats.wobbleReps}
              </Text>
              <Text style={styles.breakdownLabel}>Wobble</Text>
            </View>
          </View>
        </SectionCard>

        <View style={styles.actionRow}>
          {!isActive ? (
            <PrimaryButton
              style={styles.startBtn}
              onPress={handleStartCountdown}
              disabled={countdown !== null}
              icon={<Play color={colors.text} size={sizes.icon} fill={colors.text} />}
              label={countdown !== null ? `STARTING IN ${countdown}...` : 'START COACH'}
            />
          ) : (
            <SecondaryButton
              style={styles.stopBtn}
              onPress={handleStop}
              icon={<Square color={colors.text} size={sizes.icon} fill={colors.text} />}
              label="STOP / FINISH"
            />
          )}

          <SecondaryButton
            onPress={handleReset}
            icon={<RotateCcw color={colors.textSecondary} size={sizes.icon} />}
            accessibilityLabel="Reset workout"
          />
        </View>
      </ScrollView>

      {countdown !== null && (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownSub}>GET READY</Text>
          <Text style={styles.countdownNum}>{countdown}</Text>
          <Text style={styles.countdownDesc}>
            Put phone in front pocket & stand upright
          </Text>
        </View>
      )}

      <Modal
        visible={showSummary}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSummary(false)}
      >
        <View style={styles.modalBackdrop}>
          <SectionCard style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Award color={performance.color} size={28} />
                <Text style={styles.modalTitle}>Workout Summary</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSummary(false)}
                style={styles.closeBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Close summary"
              >
                <X color={colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.gradeContainer,
                { borderColor: performance.color },
              ]}
            >
              <Text style={[styles.gradeText, { color: performance.color }]}>
                {performance.grade}
              </Text>
              <Text style={styles.gradeSub}>
                Form Accuracy: {accuracy}%
              </Text>
            </View>

            <View style={styles.modalStatsGrid}>
              <View style={styles.modalStatBox}>
                <Text style={styles.modalStatNumber}>{stats.goodReps}</Text>
                <Text style={styles.modalStatTitle}>Valid Reps</Text>
              </View>
              <View style={styles.modalStatBox}>
                <Text style={styles.modalStatNumber}>{stats.totalReps}</Text>
                <Text style={styles.modalStatTitle}>Total Attempts</Text>
              </View>
            </View>

            <View style={styles.modalDiagnosticCard}>
              <Text style={styles.modalDiagnosticHeader}>
                Diagnostic Breakdown
              </Text>
              <View style={styles.diagnosticRow}>
                <Text style={styles.diagnosticKey}>Shallow Depth (No rep):</Text>
                <Text style={[styles.diagnosticVal, { color: colors.error }]}>
                  {stats.shallowReps}
                </Text>
              </View>
              <View style={styles.diagnosticRow}>
                <Text style={styles.diagnosticKey}>Descending Too Fast:</Text>
                <Text style={[styles.diagnosticVal, { color: colors.warning }]}>
                  {stats.fastReps}
                </Text>
              </View>
              <View style={styles.diagnosticRow}>
                <Text style={styles.diagnosticKey}>Knee Wobble / Imbalance:</Text>
                <Text style={[styles.diagnosticVal, { color: colors.warning }]}>
                  {stats.wobbleReps}
                </Text>
              </View>
            </View>

            <PrimaryButton
              onPress={() => setShowSummary(false)}
              label="CLOSE SUMMARY"
            />
          </SectionCard>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.screenBottom,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  difficultyContainer: {
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  difficultyLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  difficultyLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.caption,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.letterSpacing.label,
  },
  difficultyButtonGroup: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  difficultyBtn: {
    flex: 1,
    minHeight: sizes.touchTarget,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.surface,
  },
  difficultyBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  difficultyBtnText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.caption,
    fontWeight: typography.weight.bold,
  },
  difficultyBtnTextActive: {
    color: colors.text,
    fontWeight: typography.weight.bold,
  },
  gaugeCard: {
    padding: spacing.xxl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  gaugeLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.caption,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.letterSpacing.wide,
  },
  angleDisplay: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  angleValue: {
    fontSize: typography.fontSize.display,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  angleTarget: {
    fontSize: typography.fontSize.small,
    color: colors.textSecondary,
    fontWeight: typography.weight.semibold,
    marginTop: -spacing.xs,
  },
  barTrack: {
    width: '100%',
    height: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.xs,
    overflow: 'hidden',
    marginVertical: spacing.lg,
  },
  barFill: {
    height: '100%',
    borderRadius: radius.xs,
  },
  statusBadge: {
    marginBottom: spacing.md,
  },
  feedbackText: {
    color: colors.text,
    fontSize: typography.fontSize.body,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
  },
  counterGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  counterCard: {
    flex: 1,
  },
  breakdownCard: {
    marginBottom: spacing.xl,
  },
  breakdownTitle: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.caption,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.letterSpacing.label,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  breakdownItem: {
    alignItems: 'center',
  },
  breakdownValue: {
    fontSize: typography.fontSize.heading,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  breakdownLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.caption,
    marginTop: spacing.xxs,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  startBtn: {
    flex: 1,
  },
  stopBtn: {
    flex: 1,
  },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    padding: spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  modalTitle: {
    flexShrink: 1,
    fontSize: typography.fontSize.heading,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  closeBtn: {
    minWidth: sizes.touchTarget,
    minHeight: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
  },
  gradeContainer: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1.5,
    marginBottom: spacing.lg,
  },
  gradeText: {
    fontSize: typography.fontSize.title,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.letterSpacing.label,
  },
  gradeSub: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.small,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.xs,
  },
  modalStatsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  modalStatBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surface,
  },
  modalStatNumber: {
    fontSize: typography.fontSize.heading,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  modalStatTitle: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.caption,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.xxs,
  },
  modalDiagnosticCard: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.surface,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  modalDiagnosticHeader: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.caption,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.letterSpacing.label,
    marginBottom: spacing.xs,
  },
  diagnosticRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  diagnosticKey: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.small,
  },
  diagnosticVal: {
    fontSize: typography.fontSize.small,
    fontWeight: typography.weight.bold,
  },
});
