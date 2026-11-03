import { Children, isValidElement, type ReactNode } from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';
import { colors, typography, useThemeFontsReady, type FontLanguage, type FontWeight, type TextVariant } from '../../theme';

export interface AppTextProps extends TextProps {
  language?: FontLanguage;
  weight?: FontWeight;
  variant?: TextVariant;
}

function containsThai(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (typeof child === 'string') return /[\u0E00-\u0E7F]/.test(child);
    return isValidElement<{ children?: ReactNode }>(child) && containsThai(child.props.children);
  });
}

export function AppText({ children, style, language, weight, variant = 'body', ...props }: AppTextProps) {
  const fontsReady = useThemeFontsReady();
  const flattenedStyle = StyleSheet.flatten(style);
  const requestedWeight = flattenedStyle?.fontWeight;
  const numericWeight = requestedWeight === 'bold' ? 700 : Number(requestedWeight) || 400;
  const face = weight ?? (numericWeight >= 700 ? 'bold' : numericWeight >= 600 ? 'semibold' : numericWeight >= 500 ? 'medium' : 'regular');
  const script = language ?? (containsThai(children) ? 'th' : 'en');

  return (
    <Text
      {...props}
      style={[
        {
          color: colors.text,
          fontSize: typography.fontSize[variant],
          lineHeight: flattenedStyle?.fontSize
            ? Math.ceil(flattenedStyle.fontSize * 1.4)
            : typography.lineHeight[variant],
        },
        style,
        // Static font faces need normal weight on Android; otherwise synthetic bold can replace the face.
        { fontFamily: fontsReady ? typography.fontFamily[script][face] : undefined, fontWeight: fontsReady ? 'normal' : typography.weight[face] },
      ]}
    >
      {children}
    </Text>
  );
}
