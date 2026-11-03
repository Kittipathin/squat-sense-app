import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, radius, spacing, statusColors, type FontLanguage, type StatusTone } from '../../theme';
import { AppText } from './AppText';

export interface StatusChipProps extends ViewProps {
  label: string;
  tone?: StatusTone;
  language?: FontLanguage;
}

export function StatusChip({ label, tone = 'neutral', language, style, ...props }: StatusChipProps) {
  return (
    <View {...props} style={[styles.chip, style]}>
      <AppText language={language} variant="caption" weight="semibold" style={{ color: statusColors[tone] }}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'center', backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
});
