import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
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

import { ThemeProvider } from './src/theme';

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
    if (stats.totalReps === 0) return { grade: 'N/A', color: '#94A3B8' };
    if (accuracy >= 85) return { grade: 'Grade A', color: '#10B981' };
    if (accuracy >= 70) return { grade: 'Grade B', color: '#38BDF8' };
    if (accuracy >= 50) return { grade: 'Grade C', color: '#F59E0B' };
    return { grade: 'Needs Work', color: '#EF4444' };
  };

  const performance = getPerformanceGrade();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Activity color="#38BDF8" size={26} />
            <Text style={styles.headerTitle}>SquatSense</Text>
          </View>
          <Text style={styles.headerSubtitle}>Biomechanics Motion Coach</Text>
        </View>

        <View style={styles.difficultyContainer}>
          <View style={styles.difficultyLabelRow}>
            <Sliders color="#64748B" size={14} />
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
        </View>

        <View style={styles.gaugeCard}>
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
                    currentAngle <= targetAngle ? '#10B981' : '#38BDF8',
                },
              ]}
            />
          </View>

          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{repState}</Text>
          </View>

          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>

        <View style={styles.counterGrid}>
          <View style={[styles.counterCard, styles.mainCounter]}>
            <Flame color="#F59E0B" size={24} />
            <Text style={styles.counterNumber}>{stats.goodReps}</Text>
            <Text style={styles.counterTitle}>VALID REPS</Text>
          </View>

          <View style={styles.counterCard}>
            <CheckCircle2 color="#10B981" size={24} />
            <Text style={styles.counterNumber}>{accuracy}%</Text>
            <Text style={styles.counterTitle}>ACCURACY</Text>
          </View>
        </View>

        <View style={styles.breakdownCard}>
          <Text style={styles.breakdownTitle}>FORM DIAGNOSTICS</Text>
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownValue}>{stats.totalReps}</Text>
              <Text style={styles.breakdownLabel}>Total</Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={[styles.breakdownValue, { color: '#EF4444' }]}>
                {stats.shallowReps}
              </Text>
              <Text style={styles.breakdownLabel}>Shallow</Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={[styles.breakdownValue, { color: '#F59E0B' }]}>
                {stats.fastReps}
              </Text>
              <Text style={styles.breakdownLabel}>Too Fast</Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={[styles.breakdownValue, { color: '#A855F7' }]}>
                {stats.wobbleReps}
              </Text>
              <Text style={styles.breakdownLabel}>Wobble</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          {!isActive ? (
            <TouchableOpacity
              style={styles.startBtn}
              onPress={handleStartCountdown}
              disabled={countdown !== null}
            >
              <Play color="#FFFFFF" size={20} fill="#FFFFFF" />
              <Text style={styles.btnText}>
                {countdown !== null ? `STARTING IN ${countdown}...` : 'START COACH'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
              <Square color="#FFFFFF" size={20} fill="#FFFFFF" />
              <Text style={styles.btnText}>STOP / FINISH</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
            <RotateCcw color="#94A3B8" size={20} />
          </TouchableOpacity>
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
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Award color={performance.color} size={28} />
                <Text style={styles.modalTitle}>Workout Summary</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSummary(false)}
                style={styles.closeBtn}
              >
                <X color="#94A3B8" size={20} />
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
                <Text style={[styles.diagnosticVal, { color: '#EF4444' }]}>
                  {stats.shallowReps}
                </Text>
              </View>
              <View style={styles.diagnosticRow}>
                <Text style={styles.diagnosticKey}>Descending Too Fast:</Text>
                <Text style={[styles.diagnosticVal, { color: '#F59E0B' }]}>
                  {stats.fastReps}
                </Text>
              </View>
              <View style={styles.diagnosticRow}>
                <Text style={styles.diagnosticKey}>Knee Wobble / Imbalance:</Text>
                <Text style={[styles.diagnosticVal, { color: '#A855F7' }]}>
                  {stats.wobbleReps}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={() => setShowSummary(false)}
            >
              <Text style={styles.modalDoneBtnText}>CLOSE SUMMARY</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  difficultyContainer: {
    backgroundColor: '#131B2E',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 16,
  },
  difficultyLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
  },
  difficultyLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  difficultyButtonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  difficultyBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#0B0F19',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  difficultyBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  difficultyBtnText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  difficultyBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  gaugeCard: {
    backgroundColor: '#131B2E',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 16,
  },
  gaugeLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  angleDisplay: {
    alignItems: 'center',
    marginVertical: 12,
  },
  angleValue: {
    fontSize: 58,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  angleTarget: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
    marginTop: -4,
  },
  barTrack: {
    width: '100%',
    height: 12,
    backgroundColor: '#1E293B',
    borderRadius: 6,
    overflow: 'hidden',
    marginVertical: 14,
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
  statusBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  statusBadgeText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  feedbackText: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  counterGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  counterCard: {
    flex: 1,
    backgroundColor: '#131B2E',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  mainCounter: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  counterNumber: {
    fontSize: 34,
    fontWeight: '800',
    color: '#F8FAFC',
    marginVertical: 4,
  },
  counterTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  breakdownCard: {
    backgroundColor: '#131B2E',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 20,
  },
  breakdownTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  breakdownLabel: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  startBtn: {
    flex: 1,
    backgroundColor: '#0284C7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 18,
    gap: 10,
  },
  stopBtn: {
    flex: 1,
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 18,
    gap: 10,
  },
  resetBtn: {
    backgroundColor: '#1E293B',
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(11, 15, 25, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  countdownSub: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 8,
  },
  countdownNum: {
    color: '#38BDF8',
    fontSize: 110,
    fontWeight: '900',
  },
  countdownDesc: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#131B2E',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  closeBtn: {
    padding: 4,
  },
  gradeContainer: {
    backgroundColor: '#0B0F19',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    marginBottom: 16,
  },
  gradeText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
  },
  gradeSub: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  modalStatsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  modalStatBox: {
    flex: 1,
    backgroundColor: '#0B0F19',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  modalStatNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  modalStatTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  modalDiagnosticCard: {
    backgroundColor: '#0B0F19',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 20,
    gap: 8,
  },
  modalDiagnosticHeader: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  diagnosticRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  diagnosticKey: {
    color: '#94A3B8',
    fontSize: 13,
  },
  diagnosticVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalDoneBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
