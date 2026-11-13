import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ContactlessWavesSvg } from './BankCardView';
import { useAppTheme } from '../theme/colors';

export type NfcStage =
  | 'idle'
  | 'scanning'
  | 'authenticating'
  | 'settling'
  | 'approved';

interface NfcRadarAnimationProps {
  stage: NfcStage;
  mode: 'pay' | 'receive';
  size?: number;
}

export function NfcRadarAnimation({
  stage,
  mode,
  size = 180,
}: NfcRadarAnimationProps) {
  const { colors } = useAppTheme();

  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ring3 = useSharedValue(0);
  const coreScale = useSharedValue(1);

  const isActive =
    stage === 'scanning' ||
    stage === 'authenticating' ||
    stage === 'settling' ||
    stage === 'idle';

  const duration =
    stage === 'authenticating' || stage === 'settling' ? 1100 : 2100;

  useEffect(() => {
    if (stage === 'approved') {
      cancelAnimation(ring1);
      cancelAnimation(ring2);
      cancelAnimation(ring3);
      ring1.value = 0;
      ring2.value = 0;
      ring3.value = 0;
      coreScale.value = withTiming(1.08, { duration: 260 });
      return;
    }

    if (isActive) {
      ring1.value = 0;
      ring2.value = 0;
      ring3.value = 0;

      ring1.value = withRepeat(
        withTiming(1, { duration, easing: Easing.out(Easing.cubic) }),
        -1,
        false
      );
      ring2.value = withDelay(
        Math.round(duration / 3),
        withRepeat(
          withTiming(1, { duration, easing: Easing.out(Easing.cubic) }),
          -1,
          false
        )
      );
      ring3.value = withDelay(
        Math.round((duration * 2) / 3),
        withRepeat(
          withTiming(1, { duration, easing: Easing.out(Easing.cubic) }),
          -1,
          false
        )
      );
      coreScale.value = withRepeat(
        withTiming(1.05, {
          duration: 950,
          easing: Easing.inOut(Easing.quad),
        }),
        -1,
        true
      );
    }
  }, [stage, duration, isActive, ring1, ring2, ring3, coreScale]);

  const accent =
    stage === 'approved'
      ? '#10B981'
      : mode === 'receive'
      ? colors.info
      : colors.primary;

  const r1Style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.55 + ring1.value * 0.65 }],
    opacity: (1 - ring1.value) * 0.55,
  }));

  const r2Style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.55 + ring2.value * 0.65 }],
    opacity: (1 - ring2.value) * 0.45,
  }));

  const r3Style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.55 + ring3.value * 0.65 }],
    opacity: (1 - ring3.value) * 0.35,
  }));

  const coreAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: coreScale.value }],
  }));

  const coreDiameter = Math.round(size * 0.5);

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.pulseRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: accent,
            backgroundColor: `${accent}18`,
          },
          r1Style,
        ]}
      />
      <Animated.View
        style={[
          styles.pulseRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: accent,
            backgroundColor: `${accent}14`,
          },
          r2Style,
        ]}
      />
      <Animated.View
        style={[
          styles.pulseRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: accent,
            backgroundColor: `${accent}10`,
          },
          r3Style,
        ]}
      />

      <Animated.View
        style={[
          styles.coreCircle,
          {
            width: coreDiameter,
            height: coreDiameter,
            borderRadius: coreDiameter / 2,
            backgroundColor: accent,
            shadowColor: accent,
          },
          coreAnimStyle,
        ]}
      >
        {stage === 'approved' ? (
          <Ionicons name="checkmark-sharp" size={40} color="#FFFFFF" />
        ) : stage === 'authenticating' || stage === 'settling' ? (
          <Ionicons name="shield-checkmark" size={34} color="#FFFFFF" />
        ) : (
          <ContactlessWavesSvg size={38} color="#FFFFFF" />
        )}
        <Text style={styles.freqLabel}>
          {stage === 'approved' ? 'SETTLED' : '13.56 MHz'}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  coreCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
    elevation: 8,
  },
  freqLabel: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 9.5,
    fontWeight: '800',
    marginTop: 3,
    letterSpacing: 0.7,
  },
});
