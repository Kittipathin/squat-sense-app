export const colors = {
  background: '#080D1B',
  card: '#151F32',
  surface: '#1C2940',
  primary: '#0799DB',
  success: '#22C58B',
  warning: '#F5A623',
  error: '#FF5555',
  text: '#FFFFFF',
  textSecondary: '#8C9AB4',
  backdrop: 'rgba(8, 13, 27, 0.8)',
  overlay: 'rgba(8, 13, 27, 0.95)',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  screenBottom: 40,
} as const;

export const radius = { xs: 6, sm: 12, md: 16, lg: 20, pill: 999 } as const;
export const opacity = { pressed: 0.75, disabled: 0.45 } as const;
export const sizes = { touchTarget: 48, icon: 20, statIcon: 24, headerIcon: 26 } as const;

export const typography = {
  fontFamily: {
    en: {
      regular: 'Inter_400Regular',
      medium: 'Inter_500Medium',
      semibold: 'Inter_600SemiBold',
      bold: 'Inter_700Bold',
    },
    th: {
      regular: 'IBMPlexSansThai_400Regular',
      medium: 'IBMPlexSansThai_500Medium',
      semibold: 'IBMPlexSansThai_600SemiBold',
      bold: 'IBMPlexSansThai_700Bold',
    },
  },
  fontSize: { caption: 12, small: 14, body: 16, heading: 20, title: 26, stat: 34, display: 58, countdown: 110 },
  lineHeight: { caption: 18, small: 22, body: 24, heading: 28, title: 36, stat: 46, display: 76, countdown: 144 },
  letterSpacing: { normal: 0, label: 0.8, wide: 1.2, countdown: 3 },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
} as const;

export type FontLanguage = keyof typeof typography.fontFamily;
export type FontWeight = keyof typeof typography.weight;
export type TextVariant = keyof typeof typography.fontSize;
export type StatusTone = 'neutral' | 'success' | 'warning' | 'error';

// Status colors describe form feedback only. Neutral UI uses the single primary accent.
export const statusColors = {
  neutral: colors.textSecondary,
  success: colors.success,
  warning: colors.warning,
  error: colors.error,
} satisfies Record<StatusTone, string>;

export const theme = { colors, spacing, radius, typography, opacity, sizes, statusColors } as const;
