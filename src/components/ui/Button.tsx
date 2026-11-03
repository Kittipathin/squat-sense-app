import type { ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View, type TouchableOpacityProps } from 'react-native';
import { colors, opacity, radius, shadows, sizes, spacing, type FontLanguage } from '../../theme';
import { AppText } from './AppText';

export type ButtonProps = Omit<TouchableOpacityProps, 'children'> & { language?: FontLanguage } & (
  | { label: string; icon?: ReactNode }
  | { label?: never; icon: ReactNode; accessibilityLabel: string }
);

export function Button({ label, icon, language, style, disabled, accessibilityState, variant, ...props }: ButtonProps & { variant: 'primary' | 'secondary' }) {
  return (
    <TouchableOpacity
      activeOpacity={opacity.pressed}
      accessibilityRole="button"
      {...props}
      disabled={disabled}
      accessibilityState={{ ...accessibilityState, disabled: Boolean(disabled) }}
      style={[styles.base, variant === 'primary' ? styles.primary : styles.secondary, !label && styles.iconOnly, style, disabled && styles.disabled]}
    >
      {icon ? <View accessible={false} importantForAccessibility="no-hide-descendants">{icon}</View> : null}
      {label ? <AppText language={language} weight="bold" style={styles.label}>{label}</AppText> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: sizes.touchTarget, minWidth: sizes.touchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.lg, paddingHorizontal: spacing.xl, borderRadius: radius.lg },
  primary: { backgroundColor: colors.primary, boxShadow: shadows.primaryGlow },
  secondary: { backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder, borderTopColor: colors.glassHighlight },
  iconOnly: { paddingHorizontal: spacing.lg },
  label: { flexShrink: 1, textAlign: 'center' },
  disabled: { opacity: opacity.disabled },
});
