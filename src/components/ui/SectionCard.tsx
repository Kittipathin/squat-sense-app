import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, radius, shadows, spacing, type FontLanguage } from '../../theme';
import { AppText } from './AppText';

export interface SectionCardProps extends ViewProps {
  title?: string;
  language?: FontLanguage;
}

export function SectionCard({ title, language, children, style, ...props }: SectionCardProps) {
  return (
    <View {...props} style={[styles.card, style]}>
      {title ? <AppText language={language} variant="caption" weight="bold" accessibilityRole="header" style={styles.title}>{title}</AppText> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glass,
    borderColor: colors.glassBorder,
    borderTopColor: colors.glassHighlight,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.xl,
    boxShadow: shadows.float,
  },
  title: { color: colors.textSecondary, marginBottom: spacing.md },
});
