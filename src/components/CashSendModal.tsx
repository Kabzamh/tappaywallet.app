import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Transaction, TAPPAY_WALLET_ID } from '../types';
import { useAppTheme, getGlassStyle } from '../theme/colors';
import { useTapPay } from '../context/TapPayContext';
import {
  SA_BANKS,
  SA_EWALLET_NETWORKS,
  QUICK_CONTACTS,
} from '../data/saBanks';
import { formatZAR, maskAccountNumber, triggerHaptic } from '../utils/format';

interface CashSendModalProps {
  visible: boolean;
  restrictBalances?: boolean;
  onClose: () => void;
  onCompleted: (tx: Transaction) => void;
}

function random4DigitPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function CashSendModal({
  visible,
  restrictBalances = false,
  onClose,
  onCompleted,
}: CashSendModalProps) {
  const { colors } = useAppTheme();
  const {
    wallet,
    accounts,
    activeNfcSourceId,
    executeCashSend,
    nfcSettings,
  } = useTapPay();

  const [selectedSourceId, setSelectedSourceId] = useState(activeNfcSourceId);
  const [selectedNetwork, setSelectedNetwork] = useState(
    SA_EWALLET_NETWORKS[0]
  );
  const [recipientName, setRecipientName] = useState('Lerato Ndlovu');
  const [recipientPhone, setRecipientPhone] = useState('0836149021');
  const [amountStr, setAmountStr] = useState('500');
  const [secretPin, setSecretPin] = useState(random4DigitPin);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (visible) {
      setSelectedSourceId(activeNfcSourceId);
      setSecretPin(random4DigitPin());
      setErrorMsg('');
    }
  }, [visible, activeNfcSourceId]);

  const isFromWallet = selectedSourceId === TAPPAY_WALLET_ID;
  const maskBal = restrictBalances || nfcSettings.hideBalances;
  const numericAmount = parseFloat(amountStr) || 0;
  const fee = isFromWallet ? 7.5 : numericAmount <= 1000 ? 9.5 : 15.5;

  const handleConfirm = () => {
    setErrorMsg('');
    const cleanPhone = recipientPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setErrorMsg('Enter a valid 10-digit South African cellphone number.');
      triggerHaptic('error', nfcSettings.hapticsEnabled);
      return;
    }
    if (!recipientName.trim()) {
      setErrorMsg('Enter recipient name or "Myself".');
      return;
    }
    const cleanPin = secretPin.replace(/\D/g, '');
    if (cleanPin.length !== 4) {
      setErrorMsg('Secret ATM collection code must be 4 digits.');
      triggerHaptic('error', nfcSettings.hapticsEnabled);
      return;
    }

    const res = executeCashSend({
      networkName: selectedNetwork.name,
      collectionHint: selectedNetwork.collectionHint,
      recipientName: recipientName.trim(),
      recipientPhone: cleanPhone,
      secretPin: cleanPin,
      amount: numericAmount,
      accountId: selectedSourceId,
    });

    if (!res.ok || !res.tx) {
      setErrorMsg(res.error || 'Unable to issue ATM Cash Send voucher.');
      triggerHaptic('error', nfcSettings.hapticsEnabled);
      return;
    }

    onClose();
    onCompleted(res.tx);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          styles.backdrop,
          { backgroundColor: colors.overlay },
          Platform.OS === 'web' &&
            ({
              backdropFilter: 'blur(14px) saturate(160%)',
              WebkitBackdropFilter: 'blur(14px) saturate(160%)',
            } as any),
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
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: colors.primarySoft },
                ]}
              >
                <Ionicons
                  name="cash-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.text }]}>
                  Send Instant Cash (e-Wallet)
                </Text>
                <Text
                  style={[styles.subtitle, { color: colors.textSecondary }]}
                >
                  Cardless ATM & Retail Cash Withdrawal across SA
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Funding Source */}
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              FUND FROM @TAPPAY WALLET OR LINKED BANK
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillsRow}
            >
              <Pressable
                onPress={() => setSelectedSourceId(TAPPAY_WALLET_ID)}
                style={[
                  styles.sourcePill,
                  {
                    backgroundColor: isFromWallet
                      ? colors.primarySoft
                      : colors.surfaceMuted,
                    borderColor: isFromWallet ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sourcePillTitle,
                    { color: isFromWallet ? colors.primary : colors.text },
                  ]}
                >
                  @TapPay Wallet •• {wallet.walletNumber.slice(-4)}
                </Text>
                <Text
                  style={[
                    styles.sourcePillSub,
                    { color: colors.textSecondary },
                  ]}
                >
                  {maskBal ? 'Balance Protected' : formatZAR(wallet.balance)} • R 7.50 fee
                </Text>
              </Pressable>

              {accounts.map((acc) => {
                const active = acc.id === selectedSourceId;
                const b = SA_BANKS[acc.bankId];
                return (
                  <Pressable
                    key={acc.id}
                    onPress={() => setSelectedSourceId(acc.id)}
                    style={[
                      styles.sourcePill,
                      {
                        backgroundColor: active
                          ? colors.primarySoft
                          : colors.surfaceMuted,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.sourcePillTitle,
                        { color: active ? colors.primary : colors.text },
                      ]}
                    >
                      {b.shortName} {maskAccountNumber(acc.accountNumber)}
                    </Text>
                    <Text
                      style={[
                        styles.sourcePillSub,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {maskBal ? `Branch ${acc.branchCode}` : formatZAR(acc.balance)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Target SA Bank ATM / Cash-Out Network */}
            <Text
              style={[
                styles.label,
                { color: colors.textSecondary, marginTop: 14 },
              ]}
            >
              SELECT SA BANK ATM / CASH-OUT NETWORK
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillsRow}
            >
              {SA_EWALLET_NETWORKS.map((net) => {
                const active = selectedNetwork.id === net.id;
                return (
                  <Pressable
                    key={net.id}
                    onPress={() => {
                      triggerHaptic('light', nfcSettings.hapticsEnabled);
                      setSelectedNetwork(net);
                    }}
                    style={[
                      styles.netCard,
                      {
                        backgroundColor: active
                          ? colors.primarySoft
                          : colors.surfaceMuted,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <View style={styles.netHeader}>
                      <View
                        style={[
                          styles.netDot,
                          { backgroundColor: net.color },
                        ]}
                      />
                      <Text
                        style={[
                          styles.netName,
                          { color: active ? colors.primary : colors.text },
                        ]}
                      >
                        {net.name}
                      </Text>
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.netHint,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {net.collectionHint}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Quick Recipient Contacts + Myself */}
            <View style={styles.rowBetween}>
              <Text
                style={[
                  styles.label,
                  { color: colors.textSecondary, marginTop: 14 },
                ]}
              >
                RECIPIENT SA MOBILE NUMBER
              </Text>
              <Pressable
                onPress={() => {
                  triggerHaptic('light', nfcSettings.hapticsEnabled);
                  setRecipientName('Thabo Mokoena (Self)');
                  setRecipientPhone('0824917732');
                }}
              >
                <Text
                  style={[
                    styles.selfLink,
                    { color: colors.primary, marginTop: 14 },
                  ]}
                >
                  Withdraw Myself
                </Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.contactChips}
            >
              {QUICK_CONTACTS.slice(0, 4).map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    triggerHaptic('light', nfcSettings.hapticsEnabled);
                    setRecipientName(c.name);
                    setRecipientPhone(c.phone.replace(/\D/g, ''));
                  }}
                  style={[
                    styles.contactChip,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.contactChipText, { color: colors.text }]}
                  >
                    {c.name.split(' ')[0]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.dualInputsRow}>
              <TextInput
                value={recipientName}
                onChangeText={setRecipientName}
                placeholder="Recipient Name"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  {
                    flex: 1,
                    backgroundColor: colors.surfaceMuted,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
              />
              <TextInput
                value={recipientPhone}
                onChangeText={(t) => {
                  setRecipientPhone(t.replace(/\D/g, ''));
                  setErrorMsg('');
                }}
                keyboardType="phone-pad"
                maxLength={10}
                placeholder="0836149021"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  {
                    flex: 1,
                    backgroundColor: colors.surfaceMuted,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
              />
            </View>

            {/* ATM Cash Note Presets */}
            <Text
              style={[
                styles.label,
                { color: colors.textSecondary, marginTop: 14 },
              ]}
            >
              ATM CASH AMOUNT (ZAR NOTES)
            </Text>
            <View style={styles.presetsGrid}>
              {[100, 200, 500, 1000, 2000].map((v) => {
                const active = Number(amountStr) === v;
                return (
                  <Pressable
                    key={v}
                    onPress={() => {
                      triggerHaptic('light', nfcSettings.hapticsEnabled);
                      setAmountStr(String(v));
                      setErrorMsg('');
                    }}
                    style={[
                      styles.presetBtn,
                      {
                        backgroundColor: active
                          ? colors.primary
                          : colors.surfaceMuted,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetText,
                        { color: active ? '#FFFFFF' : colors.text },
                      ]}
                    >
                      R {v}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.amountAndPinRow}>
              <View style={{ flex: 1.3 }}>
                <Text
                  style={[
                    styles.miniFieldLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Custom Amount (R)
                </Text>
                <TextInput
                  value={amountStr}
                  onChangeText={(t) => {
                    setAmountStr(t.replace(/[^0-9]/g, ''));
                    setErrorMsg('');
                  }}
                  keyboardType="number-pad"
                  placeholder="500"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surfaceMuted,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                />
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.rowBetween}>
                  <Text
                    style={[
                      styles.miniFieldLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    4-Digit ATM PIN
                  </Text>
                  <Pressable onPress={() => setSecretPin(random4DigitPin())}>
                    <Text
                      style={[styles.regenLink, { color: colors.primary }]}
                    >
                      New
                    </Text>
                  </Pressable>
                </View>
                <TextInput
                  value={secretPin}
                  onChangeText={(t) => setSecretPin(t.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="4820"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surfaceMuted,
                      color: colors.text,
                      borderColor: colors.border,
                      letterSpacing: 3,
                      textAlign: 'center',
                    },
                  ]}
                />
              </View>
            </View>

            {/* Summary Strip */}
            <View
              style={[
                styles.summaryStrip,
                { backgroundColor: colors.surfaceMuted },
              ]}
            >
              <View style={styles.summaryRow}>
                <Text
                  style={[styles.summaryLabel, { color: colors.textSecondary }]}
                >
                  Redeemable At
                </Text>
                <Text style={[styles.summaryVal, { color: colors.text }]}>
                  {selectedNetwork.collectionHint}
                </Text>
              </View>
              <View style={[styles.summaryRow, { marginTop: 4 }]}>
                <Text
                  style={[styles.summaryLabel, { color: colors.textSecondary }]}
                >
                  Cardless ATM Clearing Fee
                </Text>
                <Text style={[styles.summaryVal, { color: colors.primary }]}>
                  {formatZAR(fee)}
                </Text>
              </View>
            </View>

            {errorMsg ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>
                {errorMsg}
              </Text>
            ) : null}

            <Pressable
              onPress={handleConfirm}
              style={({ pressed }) => [
                styles.submitBtn,
                {
                  backgroundColor: pressed
                    ? colors.primaryDark
                    : colors.primary,
                },
              ]}
            >
              <Ionicons name="cash-outline" size={19} color="#FFFFFF" />
              <Text style={styles.submitBtnText}>
                {numericAmount > 0
                  ? `Issue ${formatZAR(numericAmount)} ${selectedNetwork.name} Voucher`
                  : 'Send Instant ATM Cash'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    maxHeight: '92%',
    borderTopWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  label: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  pillsRow: {
    gap: 8,
  },
  sourcePill: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 13,
    borderWidth: 1,
  },
  sourcePillTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  sourcePillSub: {
    fontSize: 11,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  netCard: {
    width: 195,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 13,
    borderWidth: 1,
  },
  netHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  netDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  netName: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  netHint: {
    fontSize: 10.5,
    marginTop: 3,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selfLink: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  contactChips: {
    gap: 7,
    marginBottom: 8,
  },
  contactChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  contactChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dualInputsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  presetsGrid: {
    flexDirection: 'row',
    gap: 7,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  amountAndPinRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  miniFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  regenLink: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  summaryStrip: {
    padding: 12,
    borderRadius: 13,
    marginTop: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  summaryLabel: {
    fontSize: 11.5,
  },
  summaryVal: {
    fontSize: 11.5,
    fontWeight: '800',
    flexShrink: 1,
    textAlign: 'right',
  },
  errorText: {
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 10,
  },
  submitBtn: {
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 15,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
