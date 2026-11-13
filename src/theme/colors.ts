import React, { createContext, useContext } from 'react';
import { ColorSchemeName, Platform, ViewStyle } from 'react-native';
import { ThemePreference } from '../types';

export interface ThemeColors {
  isDark: boolean;
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  glassSheet: string;
  glassHighlight: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryDark: string;
  primarySoft: string;
  gold: string;
  goldSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  border: string;
  borderStrong: string;
  tabBar: string;
  cardShadow: string;
  overlay: string;
}

export const lightColors: ThemeColors = {
  isDark: false,
  background: '#E8F0F8',
  surface: 'rgba(255, 255, 255, 0.60)',
  surfaceElevated: 'rgba(255, 255, 255, 0.74)',
  surfaceMuted: 'rgba(241, 245, 249, 0.62)',
  glassSheet: 'rgba(255, 255, 255, 0.84)',
  glassHighlight: 'rgba(255, 255, 255, 0.88)',
  text: '#0B1320',
  textSecondary: '#475569',
  textMuted: '#64748B',
  primary: '#059669', // Protea Emerald
  primaryDark: '#047857',
  primarySoft: 'rgba(16, 185, 129, 0.16)',
  gold: '#D97706', // Witwatersrand Gold
  goldSoft: 'rgba(245, 158, 11, 0.16)',
  danger: '#DC2626',
  dangerSoft: 'rgba(239, 68, 68, 0.14)',
  info: '#0284C7',
  infoSoft: 'rgba(2, 132, 199, 0.14)',
  border: 'rgba(255, 255, 255, 0.72)',
  borderStrong: 'rgba(148, 163, 184, 0.38)',
  tabBar: 'rgba(255, 255, 255, 0.64)',
  cardShadow: '#0F172A',
  overlay: 'rgba(11, 19, 32, 0.42)',
};

export const darkColors: ThemeColors = {
  isDark: true,
  background: '#050B14',
  surface: 'rgba(15, 24, 42, 0.56)',
  surfaceElevated: 'rgba(21, 34, 58, 0.68)',
  surfaceMuted: 'rgba(28, 42, 68, 0.52)',
  glassSheet: 'rgba(12, 20, 36, 0.84)',
  glassHighlight: 'rgba(255, 255, 255, 0.16)',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  primary: '#10B981',
  primaryDark: '#059669',
  primarySoft: 'rgba(16, 185, 129, 0.18)',
  gold: '#F59E0B',
  goldSoft: 'rgba(245, 158, 11, 0.18)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.18)',
  info: '#38BDF8',
  infoSoft: 'rgba(56, 189, 248, 0.18)',
  border: 'rgba(255, 255, 255, 0.13)',
  borderStrong: 'rgba(148, 163, 184, 0.26)',
  tabBar: 'rgba(9, 16, 29, 0.66)',
  cardShadow: '#000000',
  overlay: 'rgba(3, 7, 15, 0.58)',
};

/**
 * Cross-platform frosted glass CSS + shadow style helper
 */
export function getGlassStyle(isDark: boolean, blurPx = 18): ViewStyle {
  const base: ViewStyle = {
    shadowColor: isDark ? '#000000' : '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDark ? 0.34 : 0.07,
    shadowRadius: 18,
    elevation: 4,
  };
  if (Platform.OS === 'web') {
    return {
      ...base,
      // @ts-expect-error web CSS backdrop-filter support
      backdropFilter: `blur(${blurPx}px) saturate(180%)`,
      WebkitBackdropFilter: `blur(${blurPx}px) saturate(180%)`,
    };
  }
  return base;
}

interface ThemeContextValue {
  colors: ThemeColors;
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  themePreference: 'system',
  setThemePreference: () => {},
});

export function useAppTheme() {
  return useContext(ThemeContext);
}

export function resolveThemeColors(
  preference: ThemePreference,
  systemScheme: ColorSchemeName
): ThemeColors {
  if (preference === 'dark') return darkColors;
  if (preference === 'light') return lightColors;
  return systemScheme === 'dark' ? darkColors : lightColors;
}
