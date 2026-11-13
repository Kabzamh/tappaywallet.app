import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppTheme, getGlassStyle } from '../theme/colors';
import { GlassPanel, GlassModalBackdrop } from '../components/GlassUI';
import { useTapPay } from '../context/TapPayContext';
import { ThemePreference } from '../types';
import { triggerHaptic } from '../utils/format';

export function ProfileScreen() {
  const { colors, themePreference, setThemePreference } = useAppTheme();
  const {
    defaultAccount,
    encryptionProfile,
    storageCipherSample,
    nfcSettings,
    updateNfcSettings,
    rotateEncryptionKeys,
    resetDemoData,
  } = useTapPay();

  const [copiedShap, setCopiedShap] = useState(false);
  const [pinChangeOpen, setPinChangeOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [pinBanner, setPinBanner] = useState('');
  const [rotationNotice, setRotationNotice] = useState('');
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const handleCopyShapId = () => {
    triggerHaptic('light', nfcSettings.hapticsEnabled);
    setCopiedShap(true);
    setTimeout(() => setCopiedShap(false), 2400);
  };

  const handleSaveNewPin = async () => {
    const cleaned = newPin.replace(/\D/g, '');
    if (cleaned.length !== 5) {
      setPinBanner('PIN must be exactly 5 digits.');
      return;
    }
    updateNfcSettings({ pinCode: cleaned });
    await rotateEncryptionKeys();
    triggerHaptic('success', nfcSettings.hapticsEnabled);
    setPinChangeOpen(false);
    setNewPin('');
    setPinBanner('');
    setRotationNotice('PIN updated & User/Device vault keys re-encrypted!');
    setTimeout(() => setRotationNotice(''), 3500);
  };

  const handleRotateKeys = async () => {
    const updated = await rotateEncryptionKeys();
    if (updated) {
      setRotationNotice(
        `Rotated to Key Epoch v${updated.keyEpoch} — Vault re-encrypted!`
      );
      setTimeout(() => setRotationNotice(''), 3500);
    }
  };

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safe, { backgroundColor: 'transparent' }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.screenTitle, { color: colors.text }]}>
          My Profile & Settings
        </Text>

        {/* FICA Identity Card */}
        <GlassPanel style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View
              style={[styles.avatarCircle, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.avatarInitials}>TM</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={[styles.profileName, { color: colors.text }]}>
                  Thabo Mokoena
                </Text>
                <View
                  style={[
                    styles.ficaPill,
                    { backgroundColor: colors.primarySoft },
                  ]}
                >
                  <Ionicons
                    name="shield-checkmark"
                    size={12}
                    color={colors.primary}
                  />
                  <Text
                    style={[styles.ficaPillText, { color: colors.primary }]}
                  >
                    FICA Verified
                  </Text>
                </View>
              </View>
              <Text
                style={[styles.profileMeta, { color: colors.textSecondary }]}
              >
                SA ID: 940814 •••• 087 • +27 82 491 7732
              </Text>
            </View>
          </View>

          <Pressable
            onPress={handleCopyShapId}
            style={[
              styles.shapIdBar,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.shapIdLeft}>
              <Ionicons name="flash" size={16} color={colors.primary} />
              <Text style={[styles.shapIdText, { color: colors.text }]}>
                Active ShapID: {defaultAccount.shapId}
              </Text>
            </View>
            <Text style={[styles.copyLabel, { color: colors.primary }]}>
              {copiedShap ? 'Copied!' : 'Copy'}
            </Text>
          </Pressable>
        </GlassPanel>

        {/* Appearance / Theme */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
          APPEARANCE
        </Text>
        <View
          style={[
            styles.groupCard,
            getGlassStyle(colors.isDark, 18),
            {
              backgroundColor: colors.surface,
              borderColor: colors.glassHighlight,
            },
          ]}
        >
          <View style={styles.themeRow}>
            {(
              [
                { id: 'system', label: 'System', icon: 'contrast-outline' },
                { id: 'light', label: 'Light', icon: 'sunny-outline' },
                { id: 'dark', label: 'Dark', icon: 'moon-outline' },
              ] as { id: ThemePreference; label: string; icon: string }[]
            ).map((opt) => {
              const active = themePreference === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => {
                    triggerHaptic('light', nfcSettings.hapticsEnabled);
                    setThemePreference(opt.id);
                  }}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor: active
                        ? colors.primary
                        : colors.surfaceMuted,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={opt.icon as any}
                    size={16}
                    color={active ? '#FFFFFF' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.themeOptionText,
                      { color: active ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Security & NFC Preferences */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
          SECURITY & CONTACTLESS PRIVACY
        </Text>
        <View
          style={[
            styles.groupCard,
            getGlassStyle(colors.isDark, 18),
            {
              backgroundColor: colors.surface,
              borderColor: colors.glassHighlight,
            },
          ]}
        >
          <SettingToggleRow
            icon="finger-print-outline"
            title="Biometric NFC Passkey"
            subtitle="Approve taps above limit via FaceID / Fingerprint"
            value={nfcSettings.biometricsEnabled}
            onToggle={(val) => updateNfcSettings({ biometricsEnabled: val })}
            colors={colors}
          />
          <SettingToggleRow
            icon="eye-off-outline"
            title="Privacy Balance Mask"
            subtitle="Hide Rand balances in public spaces"
            value={nfcSettings.hideBalances}
            onToggle={(val) => updateNfcSettings({ hideBalances: val })}
            colors={colors}
          />
          <SettingToggleRow
            icon="pulse-outline"
            title="Haptic Tap Confirmation"
            subtitle="Tactile vibration when 13.56 MHz field settles"
            value={nfcSettings.hapticsEnabled}
            onToggle={(val) => updateNfcSettings({ hapticsEnabled: val })}
            colors={colors}
          />

          <Pressable
            onPress={() => {
              setNewPin('');
              setPinBanner('');
              setPinChangeOpen(true);
            }}
            style={styles.actionSettingRow}
          >
            <View style={styles.settingLeft}>
              <View
                style={[
                  styles.settingIconWrap,
                  { backgroundColor: colors.surfaceMuted },
                ]}
              >
                <Ionicons
                  name="keypad-outline"
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: colors.text }]}>
                  Change 5-Digit Banking PIN
                </Text>
                <Text
                  style={[
                    styles.settingSub,
                    { color: colors.textSecondary },
                  ]}
                >
                  Current active PIN: {nfcSettings.pinCode}
                </Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textMuted}
            />
          </Pressable>
        </View>

        {/* Per-Device & Per-User End-to-End Encryption Vault */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
          DEVICE & USER ENCRYPTION
        </Text>
        <GlassPanel style={styles.encryptionVaultCard}>
          <View style={styles.vaultTopRow}>
            <View
              style={[
                styles.vaultBadge,
                { backgroundColor: colors.primarySoft },
              ]}
            >
              <Ionicons name="lock-closed" size={13} color={colors.primary} />
              <Text style={[styles.vaultBadgeText, { color: colors.primary }]}>
                256-BIT ENCRYPTED
              </Text>
            </View>
            <Text style={[styles.epochLabel, { color: colors.textSecondary }]}>
              Key v{encryptionProfile?.keyEpoch ?? 1}
            </Text>
          </View>

          <DiagRow
            label="Protected Device"
            value={encryptionProfile?.deviceId || 'Active'}
            colors={colors}
          />
          <DiagRow
            label="Device Key Signature"
            value={encryptionProfile?.deviceKeyFingerprint || '••••'}
            colors={colors}
          />
          <DiagRow
            label="User Key Signature"
            value={encryptionProfile?.userKeyFingerprint || '••••'}
            colors={colors}
            isLast
          />

          {rotationNotice ? (
            <Text style={[styles.rotationToast, { color: colors.primary }]}>
              {rotationNotice}
            </Text>
          ) : null}

          <Pressable
            onPress={handleRotateKeys}
            style={({ pressed }) => [
              styles.rotateBtn,
              {
                backgroundColor: pressed
                  ? colors.primaryDark
                  : colors.primary,
              },
            ]}
          >
            <Ionicons name="key-outline" size={16} color="#FFFFFF" />
            <Text style={styles.rotateBtnText}>
              Refresh Security Keys
            </Text>
          </Pressable>
        </GlassPanel>

        {/* Reset Demo Data */}
        <Pressable
          onPress={() => setResetConfirmOpen(true)}
          style={[
            styles.resetBtn,
            {
              backgroundColor: colors.dangerSoft,
              borderColor: colors.dangerSoft,
            },
          ]}
        >
          <Ionicons name="refresh-outline" size={18} color={colors.danger} />
          <Text style={[styles.resetBtnText, { color: colors.danger }]}>
            Reset Demo Balances & Ledger
          </Text>
        </Pressable>
      </ScrollView>

      {/* Change PIN Modal */}
      <Modal
        visible={pinChangeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPinChangeOpen(false)}
      >
        <View
          style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}
        >
          <View
            style={[
              styles.modalBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Set New 5-Digit Bank PIN
            </Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              Used when contactless NFC taps exceed your PIN-free limit.
            </Text>
            <TextInput
              value={newPin}
              onChangeText={(t) => {
                setNewPin(t.replace(/\D/g, ''));
                setPinBanner('');
              }}
              keyboardType="number-pad"
              maxLength={5}
              placeholder="e.g. 25800"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.pinInput,
                {
                  backgroundColor: colors.surfaceMuted,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
            />
            {pinBanner ? (
              <Text style={[styles.pinErr, { color: colors.danger }]}>
                {pinBanner}
              </Text>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setPinChangeOpen(false)}
                style={[
                  styles.modalCancel,
                  { backgroundColor: colors.surfaceMuted },
                ]}
              >
                <Text style={[styles.modalCancelText, { color: colors.text }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSaveNewPin}
                style={[
                  styles.modalConfirm,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text style={styles.modalConfirmText}>Save PIN</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal
        visible={resetConfirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setResetConfirmOpen(false)}
      >
        <View
          style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}
        >
          <View
            style={[
              styles.modalBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Reset TapPay Demo State?
            </Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              Restores initial FNB & Capitec balances, default settings, and
              sample South African transactions.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setResetConfirmOpen(false)}
                style={[
                  styles.modalCancel,
                  { backgroundColor: colors.surfaceMuted },
                ]}
              >
                <Text style={[styles.modalCancelText, { color: colors.text }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  await resetDemoData();
                  setResetConfirmOpen(false);
                }}
                style={[
                  styles.modalConfirm,
                  { backgroundColor: colors.danger },
                ]}
              >
                <Text style={styles.modalConfirmText}>Reset Now</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SettingToggleRow({
  icon,
  title,
  subtitle,
  value,
  onToggle,
  colors,
}: {
  icon: string;
  title: string;
  subtitle: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  colors: any;
}) {
  return (
    <View
      style={[
        styles.settingRow,
        { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      <View style={styles.settingLeft}>
        <View
          style={[
            styles.settingIconWrap,
            { backgroundColor: colors.surfaceMuted },
          ]}
        >
          <Ionicons name={icon as any} size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.settingTitle, { color: colors.text }]}>
            {title}
          </Text>
          <Text style={[styles.settingSub, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.borderStrong, true: colors.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function DiagRow({
  label,
  value,
  colors,
  isLast,
}: {
  label: string;
  value: string;
  colors: any;
  isLast?: boolean;
}) {
  return (
    <View
      style={[
        styles.diagRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      <Text style={[styles.diagLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[styles.diagVal, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 36,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 14,
  },
  profileCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 18,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  profileName: {
    fontSize: 17,
    fontWeight: '800',
  },
  ficaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  ficaPillText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  profileMeta: {
    fontSize: 12,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  shapIdBar: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 13,
    borderWidth: 1,
  },
  shapIdLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  shapIdText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  copyLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 2,
  },
  groupCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 18,
  },
  encryptionVaultCard: {
    borderRadius: 20,
    padding: 15,
    marginBottom: 18,
  },
  vaultTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  vaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  vaultBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  epochLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  cipherSampleBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 11,
    borderWidth: 1,
  },
  cipherSampleTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cipherSampleMono: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  rotationToast: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 10,
  },
  rotateBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: 13,
  },
  rotateBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  themeOptionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 10,
  },
  actionSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flex: 1,
  },
  settingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  settingSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 8,
  },
  diagLabel: {
    fontSize: 12.5,
  },
  diagVal: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 13,
    marginTop: 5,
    lineHeight: 18,
  },
  pinInput: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  pinErr: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 13,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 13,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
