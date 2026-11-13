import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  useColorScheme,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { TapPayProvider, useTapPay } from './src/context/TapPayContext';
import {
  TabNavigationContext,
  TabRouteName,
  TabRouteParams,
} from './src/context/TabNavigationContext';
import {
  ThemeContext,
  resolveThemeColors,
  getGlassStyle,
} from './src/theme/colors';
import { AmbientGlassBackground } from './src/components/GlassUI';
import { HomeScreen } from './src/screens/HomeScreen';
import { TapHubScreen } from './src/screens/TapHubScreen';
import { ActivityScreen } from './src/screens/ActivityScreen';
import { BanksScreen } from './src/screens/BanksScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ContactlessWavesSvg } from './src/components/BankCardView';
import { triggerHaptic } from './src/utils/format';

function AppShell() {
  const systemScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const {
    isHydrated,
    themePreference,
    setThemePreference,
    nfcSettings,
  } = useTapPay();

  const [activeTab, setActiveTab] = useState<TabRouteName>('Home');
  const [tapParams, setTapParams] = useState<TabRouteParams>({ mode: 'pay' });

  const navigate = useCallback(
    (tab: TabRouteName, params?: { mode?: 'pay' | 'receive' }) => {
      triggerHaptic('light', nfcSettings.hapticsEnabled);
      if (params?.mode) {
        setTapParams({ mode: params.mode, ts: Date.now() });
      }
      setActiveTab(tab);
    },
    [nfcSettings.hapticsEnabled]
  );

  const colors = useMemo(
    () => resolveThemeColors(themePreference, systemScheme),
    [themePreference, systemScheme]
  );

  const themeContextValue = useMemo(
    () => ({
      colors,
      themePreference,
      setThemePreference,
    }),
    [colors, themePreference, setThemePreference]
  );

  const navContextValue = useMemo(
    () => ({
      activeTab,
      tapParams,
      navigate,
    }),
    [activeTab, tapParams, navigate]
  );

  if (!isHydrated) {
    return (
      <View
        style={[styles.loadingWrap, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingLabel, { color: colors.textSecondary }]}>
          TapPay Wallet • Securing Banking Session...
        </Text>
      </View>
    );
  }

  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 10);

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <TabNavigationContext.Provider value={navContextValue}>
        <StatusBar style={colors.isDark ? 'light' : 'dark'} />
        <View style={[styles.rootShell, { backgroundColor: colors.background }]}>
          {/* Single clean ambient background canvas underneath the glass */}
          <AmbientGlassBackground />

          {/* Strictly ONE active screen mounted at a time — never stacked */}
          <View key={activeTab} style={styles.activeSceneWrap}>
            {activeTab === 'Home' ? (
              <HomeScreen />
            ) : activeTab === 'Activity' ? (
              <ActivityScreen />
            ) : activeTab === 'Tap' ? (
              <TapHubScreen />
            ) : activeTab === 'Banks' ? (
              <BanksScreen />
            ) : (
              <ProfileScreen />
            )}
          </View>

          {/* Dedicated Non-Overlapping Frosted Glass Bottom Navigation Dock */}
          <View
            style={[
              styles.bottomDock,
              getGlassStyle(colors.isDark, 24),
              {
                backgroundColor: colors.glassSheet,
                borderTopColor: colors.glassHighlight,
                paddingBottom: bottomPad,
              },
            ]}
          >
            {Platform.OS !== 'web' && (
              <BlurView
                pointerEvents="none"
                intensity={60}
                tint={colors.isDark ? 'dark' : 'light'}
                style={StyleSheet.absoluteFill}
              />
            )}

            <BottomNavItem
              label="Home"
              icon={activeTab === 'Home' ? 'home' : 'home-outline'}
              focused={activeTab === 'Home'}
              activeColor={colors.primary}
              inactiveColor={colors.textMuted}
              onPress={() => navigate('Home')}
            />

            <BottomNavItem
              label="Cards"
              icon={activeTab === 'Banks' ? 'card' : 'card-outline'}
              focused={activeTab === 'Banks'}
              activeColor={colors.primary}
              inactiveColor={colors.textMuted}
              onPress={() => navigate('Banks')}
            />

            {/* Center Raised NFC Tap Button */}
            <Pressable
              onPress={() => {
                triggerHaptic('medium', nfcSettings.hapticsEnabled);
                setActiveTab('Tap');
              }}
              style={styles.centerTapOuter}
            >
              <View
                style={[
                  styles.centerTapCircle,
                  {
                    backgroundColor:
                      activeTab === 'Tap' ? colors.primaryDark : colors.primary,
                    shadowColor: colors.primary,
                    borderColor: colors.glassHighlight,
                  },
                ]}
              >
                <ContactlessWavesSvg size={25} color="#FFFFFF" />
              </View>
              <Text
                style={[
                  styles.centerTapLabel,
                  {
                    color:
                      activeTab === 'Tap' ? colors.primary : colors.textMuted,
                  },
                ]}
              >
                Tap Pay
              </Text>
            </Pressable>

            <BottomNavItem
              label="Statements"
              icon={
                activeTab === 'Activity'
                  ? 'document-text'
                  : 'document-text-outline'
              }
              focused={activeTab === 'Activity'}
              activeColor={colors.primary}
              inactiveColor={colors.textMuted}
              onPress={() => navigate('Activity')}
            />

            <BottomNavItem
              label="More"
              icon={activeTab === 'Profile' ? 'person' : 'person-outline'}
              focused={activeTab === 'Profile'}
              activeColor={colors.primary}
              inactiveColor={colors.textMuted}
              onPress={() => navigate('Profile')}
            />
          </View>
        </View>
      </TabNavigationContext.Provider>
    </ThemeContext.Provider>
  );
}

function BottomNavItem({
  label,
  icon,
  focused,
  activeColor,
  inactiveColor,
  onPress,
}: {
  label: string;
  icon: string;
  focused: boolean;
  activeColor: string;
  inactiveColor: string;
  onPress: () => void;
}) {
  const color = focused ? activeColor : inactiveColor;
  return (
    <Pressable onPress={onPress} style={styles.navItemBtn}>
      <Ionicons name={icon as any} size={22} color={color} />
      <Text style={[styles.navItemLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <TapPayProvider>
        <AppShell />
      </TapPayProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootShell: {
    flex: 1,
    position: 'relative',
  },
  activeSceneWrap: {
    flex: 1,
    overflow: 'hidden',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  bottomDock: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 8,
    position: 'relative',
  },
  navItemBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 2,
  },
  navItemLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  centerTapOuter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
  },
  centerTapCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  centerTapLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    marginTop: 3,
  },
});
