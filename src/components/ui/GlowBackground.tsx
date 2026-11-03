import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../../theme';

export interface GlowBackgroundProps {
  /** Optional status color for a large glow behind the content (e.g. form feedback). */
  tint?: string | null;
}

/**
 * Soft ambient light behind glass cards. Smooth radial gradients look the same as a
 * blurred backdrop, so translucent cards read as frosted glass without a native blur
 * view (which behaves inconsistently on Android / Expo Go).
 */
export function GlowBackground({ tint }: GlowBackgroundProps) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="glowTop" cx="15%" cy="8%" r="70%">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.45} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="glowBottom" cx="95%" cy="85%" r="75%">
            <Stop offset="0" stopColor={colors.ambient} stopOpacity={0.4} />
            <Stop offset="1" stopColor={colors.ambient} stopOpacity={0} />
          </RadialGradient>
          {tint ? (
            <RadialGradient id="glowTint" cx="50%" cy="38%" r="65%">
              <Stop offset="0" stopColor={tint} stopOpacity={0.4} />
              <Stop offset="1" stopColor={tint} stopOpacity={0} />
            </RadialGradient>
          ) : null}
        </Defs>
        <Rect width="100%" height="100%" fill={colors.background} />
        <Rect width="100%" height="100%" fill="url(#glowTop)" />
        <Rect width="100%" height="100%" fill="url(#glowBottom)" />
        {tint ? <Rect width="100%" height="100%" fill="url(#glowTint)" /> : null}
      </Svg>
    </View>
  );
}
