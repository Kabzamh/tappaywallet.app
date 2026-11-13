import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { GlassModalBackdrop } from './GlassUI';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppTheme, getGlassStyle } from '../theme/colors';
import { useTapPay } from '../context/TapPayContext';
import { formatZAR, triggerHaptic } from '../utils/format';

interface PinAuthModalProps {
  visible: boolean;
  title?: string;
  reason?: string;
  amount?: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PinAuthModal({
  visible,
  title = 'Verify Direct Bank PIN',
  reason = 'Required for contactless security above PIN-free threshold',
  amount,
  onSuccess,
  onCancel,
}: PinAuthModalProps) {
  const { colors } = useAppTheme();
  const { nfcSettings } = useTapPay();
  const [entered, setEntered] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (visible) {
      setEntered('');
      setErrorMsg('');
    }
  }, [visible]);

  const handleDigit = (digit: string) => {
    if (entered.length >= 5) return;
    triggerHaptic('light', nfcSettings.hapticsEnabled);
    const next = entered + digit;
    setEntered(next);
    setErrorMsg('');

    if (next.length === 5) {
      if (next === nfcSettings.pinCode) {
        triggerHaptic('success', nfcSettings.hapticsEnabled);
        setTimeout(() => {
          onSuccess();
        }, 160);
      } else {
        triggerHaptic('error', nfcSettings.hapticsEnabled);
        setErrorMsg(`Incorrect 5-digit PIN (Demo PIN: ${nfcSettings.pinCode})`);
        setTimeout(() => setEntered(''), 360);
      }
    }
  };

  const handleBackspace = () => {
    triggerHaptic('light', nfcSettings.hapticsEnabled);
    setEntered((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleBiometricInstant = () => {
    triggerHaptic('success', nfcSettings.hapticsEnabled);
    onSuccess();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <GlassModalBackdrop style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            getGlassStyle(colors.isDark, 26),
            {
              backgroundColor: colors.glassSheet,
              borderColor: colors.glassHighlight,
            },
          ]}
        >
          <View style={styles.headerRow}>
            <View
              style={[
                styles.shieldIcon,
                { backgroundColor: colors.primarySoft },
              ]}
            >
              <Ionicons name="lock-closed" size={20} color={colors.primary} />
            </View>
            <Pressable onPress={onCancel} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {reason}
          </Text>

          {typeof amount === 'number' && amount > 0 && (
            <View
              style={[
                styles.amountPill,
                { backgroundColor: colors.surfaceMuted },
              ]}
            >
              <Text style={[styles.amountText, { color: colors.text }]}>
                Authorizing {formatZAR(amount)}
              </Text>
            </View>
          )}

          {/* 5-Digit Dots */}
          <View style={styles.dotsRow}>
            {[0, 1, 2, 3, 4].map((idx) => {
              const filled = idx < entered.length;
              return (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    {
                      borderColor: filled ? colors.primary : colors.borderStrong,
                      backgroundColor: filled ? colors.primary : 'transparent',
                    },
                  ]}
                />
              );
            })}
          </View>

          {errorMsg ? (
            <Text style={[styles.errorText, { color: colors.danger }]}>
              {errorMsg}
            </Text>
          ) : (
            <Text style={[styles.hintText, { color: colors.textMuted }]}>
              Enter your 5-digit SA Banking PIN (Default: {nfcSettings.pinCode})
            </Text>
          )}

          {/* Numeric Pad */}
          <View style={styles.keypad}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <Pressable
                key={d}
                onPress={() => handleDigit(d)}
                style={({ pressed }) => [
                  styles.keyButton,
                  {
                    backgroundColor: pressed
                      ? colors.border
                      : colors.surfaceMuted,
                  },
                ]}
              >
                <Text style={[styles.keyText, { color: colors.text }]}>{d}</Text>
              </Pressable>
            ))}

            {nfcSettings.biometricsEnabled ? (
              <Pressable
                onPress={handleBiometricInstant}
                style={({ pressed }) => [
                  styles.keyButton,
                  {
                    backgroundColor: pressed
                      ? colors.primarySoft
                      : colors.surfaceMuted,
                  },
                ]}
              >
                <Ionicons
                  name="finger-print"
                  size={24}
                  color={colors.primary}
                />
              </Pressable>
            ) : (
              <View style={styles.keySpacer} />
            )}

            <Pressable
              onPress={() => handleDigit('0')}
              style={({ pressed }) => [
                styles.keyButton,
                {
                  backgroundColor: pressed
                    ? colors.border
                    : colors.surfaceMuted,
                },
              ]}
            >
              <Text style={[styles.keyText, { color: colors.text }]}>0</Text>
            </Pressable>

            <Pressable
              onPress={handleBackspace}
              style={({ pressed }) => [
                styles.keyButton,
                {
                  backgroundColor: pressed
                    ? colors.border
                    : colors.surfaceMuted,
                },
              ]}
            >
              <Ionicons
                name="backspace-outline"
                size={22}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>

          {nfcSettings.biometricsEnabled && (
            <Pressable
              onPress={handleBiometricInstant}
              style={[
                styles.bioBanner,
                {
                  backgroundColor: colors.primarySoft,
                  borderColor: colors.primary,
                },
              ]}
            >
              <Ionicons name="scan-outline" size={18} color={colors.primary} />
              <Text style={[styles.bioBannerText, { color: colors.primary }]}>
                Approve with Biometric Passkey
              </Text>
            </Pressable>
          )}
        </View>
      </GlassModalBackdrop>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  shieldIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  amountPill: {
    alignSelf: 'center',
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  amountText: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginVertical: 20,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  hintText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 14,
  },
  errorText: {
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  keyButton: {
    width: '31%',
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keySpacer: {
    width: '31%',
    height: 54,
  },
  keyText: {
    fontSize: 21,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  bioBanner: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  bioBannerText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
});
