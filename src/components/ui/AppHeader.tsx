import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, spacing, type FontLanguage } from '../../theme';
import { AppText } from './AppText';

export interface AppHeaderProps extends ViewProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  /** Supply an accessible action (for example SecondaryButton). No settings behavior is invented here. */
  settingsAction?: ReactNode;
  language?: FontLanguage;
}

export function AppHeader({ title, subtitle, icon, settingsAction, language, style, ...props }: AppHeaderProps) {
  return (
    <View {...props} style={[styles.header, style]}>
      <View style={[styles.copy, !settingsAction && styles.centered]}>
        <View style={styles.titleRow}>
          {icon ? <View accessible={false} importantForAccessibility="no-hide-descendants">{icon}</View> : null}
          <AppText language={language} variant="title" weight="bold" accessibilityRole="header" style={styles.title}>{title}</AppText>
        </View>
        {subtitle ? <AppText language={language} variant="small" style={styles.subtitle}>{subtitle}</AppText> : null}
      </View>
      {settingsAction ? <View style={styles.action}>{settingsAction}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1, minWidth: 0 },
  centered: { alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flexShrink: 1 },
  subtitle: { color: colors.textSecondary, marginTop: spacing.xxs },
  action: { flexShrink: 0 },
});
