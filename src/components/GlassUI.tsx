import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useAppTheme, getGlassStyle } from '../theme/colors';

/**
 * Seamless Feather-Edged Ambient Background Layer rendered underneath all glass surfaces.
 * Uses true SVG RadialGradients (zero hard circle edges) so frosted glass cards
 * and the floating glass bottom tab bar refract smooth atmospheric color depth.
 */
export function AmbientGlassBackground() {
  const { colors } = useAppTheme();

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: colors.background, overflow: 'hidden' },
      ]}
    >
      <LinearGradient
        colors={
          colors.isDark
            ? ['#050B14', '#091526', '#06111D']
            : ['#E6F0FA', '#EFF5FB', '#E6F4EE']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="glowEmerald" cx="85%" cy="12%" rx="58%" ry="38%">
            <Stop
              offset="0%"
              stopColor="#10B981"
              stopOpacity={colors.isDark ? '0.26' : '0.22'}
            />
            <Stop
              offset="55%"
              stopColor="#10B981"
              stopOpacity={colors.isDark ? '0.08' : '0.07'}
            />
            <Stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </RadialGradient>

          <RadialGradient id="glowCyan" cx="12%" cy="48%" rx="55%" ry="36%">
            <Stop
              offset="0%"
              stopColor="#0EA5E9"
              stopOpacity={colors.isDark ? '0.20' : '0.17'}
            />
            <Stop
              offset="55%"
              stopColor="#0EA5E9"
              stopOpacity={colors.isDark ? '0.06' : '0.05'}
            />
            <Stop offset="100%" stopColor="#0EA5E9" stopOpacity="0" />
          </RadialGradient>

          <RadialGradient id="glowBottom" cx="65%" cy="92%" rx="65%" ry="34%">
            <Stop
              offset="0%"
              stopColor={colors.isDark ? '#10B981' : '#059669'}
              stopOpacity={colors.isDark ? '0.22' : '0.16'}
            />
            <Stop
              offset="50%"
              stopColor="#F59E0B"
              stopOpacity={colors.isDark ? '0.07' : '0.07'}
            />
            <Stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowEmerald)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowCyan)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowBottom)" />
      </Svg>
    </View>
  );
}

/**
 * Single-pass Frosted Liquid Glass Panel (optical BlurView on native,
 * clean CSS backdrop-filter on Web without double-tinted backing layers).
 */
export function GlassPanel({
  children,
  style,
  intensity = 42,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
}) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.panelOuter,
        {
          backgroundColor: colors.surface,
          borderColor: colors.glassHighlight,
        },
        getGlassStyle(colors.isDark, 22),
        style,
      ]}
    >
      {Platform.OS !== 'web' && (
        <BlurView
          pointerEvents="none"
          intensity={intensity}
          tint={colors.isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      )}
      <LinearGradient
        pointerEvents="none"
        colors={
          colors.isDark
            ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.0)']
            : ['rgba(255,255,255,0.48)', 'rgba(255,255,255,0.04)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

/**
 * Diagonal Specular Glass Sheen overlay for Bank Cards & Wallet Cards
 */
export function CardGlassSheen() {
  return (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(255,255,255,0.22)',
          'rgba(255,255,255,0.03)',
          'rgba(255,255,255,0.0)',
          'rgba(255,255,255,0.09)',
        ]}
        locations={[0, 0.32, 0.68, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.innerGlassRim} />
    </>
  );
}

/**
 * Frosted Blur Modal Backdrop
 */
export function GlassModalBackdrop({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.backdropBase,
        { backgroundColor: colors.overlay },
        Platform.OS === 'web' &&
          ({
            backdropFilter: 'blur(14px) saturate(160%)',
            WebkitBackdropFilter: 'blur(14px) saturate(160%)',
          } as any),
        style,
      ]}
    >
      {Platform.OS !== 'web' && (
        <BlurView
          pointerEvents="none"
          intensity={34}
          tint={colors.isDark ? 'dark' : 'default'}
          style={StyleSheet.absoluteFill}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panelOuter: {
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  innerGlassRim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  backdropBase: {
    flex: 1,
    position: 'relative',
  },
});
