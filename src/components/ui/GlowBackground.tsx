import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colors } from '../../theme';

export interface GlowBackgroundProps {
  /** Optional status color for a large glow behind the content (e.g. form feedback). */
  tint?: string | null;
}

interface BlobProps {
  id: string;
  color: string;
  size: number;
  left: number;
  top: number;
  opacity: number;
  /** Drift distance in px (x, y) and loop duration in ms. 0 duration = static. */
  dx?: number;
  dy?: number;
  duration?: number;
  animate: boolean;
}

/** One soft light: a radial gradient that fades to transparent, slowly drifting. */
function GlowBlob({ id, color, size, left, top, opacity, dx = 0, dy = 0, duration = 0, animate }: BlobProps) {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate || !duration) {
      drift.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, duration, drift]);

  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [0, dx] });
  const translateY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, dy] });
  const scale = drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <Animated.View
      style={[styles.blob, { width: size, height: size, left, top, transform: [{ translateX }, { translateY }, { scale }] }]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="0.45" stopColor={color} stopOpacity={opacity * 0.45} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/**
 * Soft ambient light behind glass cards. Smooth radial gradients look the same as a
 * blurred backdrop, so translucent cards read as frosted glass without a native blur
 * view (which behaves inconsistently on Android / Expo Go). The lights drift slowly
 * unless the user has "Reduce motion" turned on.
 */
export function GlowBackground({ tint }: GlowBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const animate = !reduceMotion;
  const big = Math.max(width, height) * 0.95;

  return (
    <View style={styles.root} pointerEvents="none">
      <GlowBlob
        id="glowBlue"
        color={colors.primary}
        size={big}
        left={-big * 0.45}
        top={-big * 0.45}
        opacity={0.5}
        dx={width * 0.25}
        dy={height * 0.12}
        duration={9000}
        animate={animate}
      />
      <GlowBlob
        id="glowViolet"
        color={colors.ambient}
        size={big}
        left={width - big * 0.5}
        top={height - big * 0.55}
        opacity={0.45}
        dx={-width * 0.3}
        dy={-height * 0.1}
        duration={12000}
        animate={animate}
      />
      {tint ? (
        <GlowBlob
          id="glowTint"
          color={tint}
          size={width * 1.3}
          left={-width * 0.15}
          top={height * 0.38 - width * 0.65}
          opacity={0.45}
          animate={false}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: colors.background, overflow: 'hidden' },
  blob: { position: 'absolute' },
});
