import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, spacing, type FontLanguage } from '../../theme';
import { AppText } from './AppText';
import { SectionCard } from './SectionCard';

export interface StatCardProps extends ViewProps {
  label: string;
  value: string | number | null;
  icon?: ReactNode;
  language?: FontLanguage;
}

export function StatCard({ label, value, icon, language, style, ...props }: StatCardProps) {
  const displayValue = value === null ? '--' : String(value);
  return (
    <SectionCard accessible accessibilityLabel={`${label}: ${displayValue}`} {...props} style={[styles.card, style]}>
      {icon ? <View accessible={false} importantForAccessibility="no-hide-descendants">{icon}</View> : null}
      <AppText language={language} variant="stat" weight="bold" style={styles.value}>{displayValue}</AppText>
      <AppText language={language} variant="caption" weight="semibold" style={styles.label}>{label}</AppText>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', minWidth: 0 },
  value: { marginVertical: spacing.xs, fontVariant: ['tabular-nums'] },
  label: { color: colors.textSecondary, textAlign: 'center' },
});
