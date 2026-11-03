import { createContext, useContext, useEffect, type PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import { fontAssets } from './fonts';
import { colors } from './tokens';

const FontsReadyContext = createContext(false);
export const useThemeFontsReady = () => useContext(FontsReadyContext);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [loaded, error] = useFonts(fontAssets);

  useEffect(() => {
    if (error) console.warn('SquatSense fonts could not load; using system fonts.', error);
  }, [error]);

  if (!loaded && !error) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Loading SquatSense" />
      </View>
    );
  }

  // A font error must not trap the user on the loading view.
  return <FontsReadyContext.Provider value={loaded}>{children}</FontsReadyContext.Provider>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
});
