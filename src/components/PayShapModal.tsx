import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import { QuickContact, Transaction, TAPPAY_WALLET_ID } from '../types';
import { useAppTheme, getGlassStyle } from '../theme/colors';
import { useTapPay } from '../context/TapPayContext';
import { SA_BANKS, QUICK_CONTACTS } from '../data/saBanks';
import { formatZAR, maskAccountNumber, triggerHaptic } from '../utils/format';

interface PayShapModalProps {
  visible: boolean;
  initialContact?: QuickContact | null;
  restrictBalances?: boolean;
  onClose: () => void;
  onCompleted: (tx: Transaction) => void;
}

export function PayShapModal({
  visible,
  initialContact,
  restrictBalances = false,
  onClose,
  onCompleted,
}: PayShapModalProps) {
  const { colors } = useAppTheme();
  const {
    wallet,
    accounts,
    activeNfcSourceId,
    executePayShapTransfer,
    nfcSettings,
  } = useTapPay();

  const [recipientName, setRecipientName] = useState('');
  const [shapId, setShapId] = useState('');
  const [recipientBank, setRecipientBank] = useState('Capitec Bank');
  const [amountStr, setAmountStr] = useState('');
  const [reference, setReference] = useState('');
  const [selectedAccountId, setSelectedAccountId] =
    useState(activeNfcSourceId);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (visible) {
      setSelectedAccountId(activeNfcSourceId);
      setAmountStr('');
      setReference('');
      setErrorMsg('');
      if (initialContact) {
        setRecipientName(initialContact.name);
        setShapId(initialContact.shapId);
        setRecipientBank(initialContact.bankName);
      } else {
        setRecipientName('');
        setShapId('');
        setRecipientBank('PayShap Participating Bank');
      }
    }
  }, [visible, initialContact, activeNfcSourceId]);

  const numericAmount = parseFloat(amountStr) || 0;
  const isFromWallet = selectedAccountId === TAPPAY_WALLET_ID;
  const maskBal = restrictBalances || nfcSettings.hideBalances;
  const estimatedFee = isFromWallet
    ? numericAmount > 500
      ? 1.5
      : 0
    : numericAmount > 100
    ? 1.5
    : 0;

  const handleSend = () => {
    if (!shapId.trim()) {
      setErrorMsg('Enter a South African cell number or ShapID.');
      return;
    }
    if (!recipientName.trim()) {
      setErrorMsg('Enter recipient name.');
      return;
    }
    if (numericAmount <= 0) {
      setErrorMsg('Enter an amount greater than R 0.00.');
      return;
    }

    const res = executePayShapTransfer({
      recipientName: recipientName.trim(),
      shapId: shapId.trim(),
      recipientBank,
      amount: numericAmount,
      reference: reference.trim(),
      accountId: selectedAccountId,
    });

    if (!res.ok || !res.tx) {
      setErrorMsg(res.error || 'Unable to process PayShap payment.');
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
          <View style={styles.headerRow}>
            <View style={styles.titleRow}>
              <View
                style={[
                  styles.flashBadge,
                  { backgroundColor: colors.primarySoft },
                ]}
              >
                <Ionicons name="flash" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.text }]}>
                  PayShap Direct Send
                </Text>
                <Text
                  style={[styles.subtitle, { color: colors.textSecondary }]}
                >
                  Instant SA Bank-to-Bank Clearing (ShapID)
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
            {/* Source Wallet or Bank Account */}
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              FROM WALLET OR LINKED SA BANK
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.accPillsRow}
            >
              <Pressable
                onPress={() => setSelectedAccountId(TAPPAY_WALLET_ID)}
                style={[
                  styles.accPill,
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
                    styles.accPillTitle,
                    { color: isFromWallet ? colors.primary : colors.text },
                  ]}
                >
                  TapPay Wallet •• {wallet.walletNumber.slice(-4)}
                </Text>
                <Text
                  style={[styles.accPillBal, { color: colors.textSecondary }]}
                >
                  {maskBal ? 'Balance Protected' : formatZAR(wallet.balance)}
                </Text>
              </Pressable>

              {accounts.map((acc) => {
                const selected = acc.id === selectedAccountId;
                const b = SA_BANKS[acc.bankId];
                return (
                  <Pressable
                    key={acc.id}
                    onPress={() => setSelectedAccountId(acc.id)}
                    style={[
                      styles.accPill,
                      {
                        backgroundColor: selected
                          ? colors.primarySoft
                          : colors.surfaceMuted,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.accPillTitle,
                        { color: selected ? colors.primary : colors.text },
                      ]}
                    >
                      {b.shortName} {maskAccountNumber(acc.accountNumber)}
                    </Text>
                    <Text
                      style={[
                        styles.accPillBal,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {maskBal
                        ? `Branch ${acc.branchCode}`
                        : formatZAR(acc.balance)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Quick SA Contacts */}
            <Text
              style={[
                styles.label,
                { color: colors.textSecondary, marginTop: 14 },
              ]}
            >
              SAVED BENEFICIARIES OR NEW SHAPID
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 7, marginBottom: 10 }}
            >
              {QUICK_CONTACTS.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    triggerHaptic('light', nfcSettings.hapticsEnabled);
                    setRecipientName(c.name);
                    setShapId(c.shapId);
                    setRecipientBank(c.bankName);
                    setErrorMsg('');
                  }}
                  style={[
                    styles.presetChip,
                    {
                      paddingHorizontal: 11,
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.presetText, { color: colors.text }]}>
                    {c.name.split(' ')[0]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Recipient Name & ShapID */}
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              RECIPIENT NAME
            </Text>
            <TextInput
              value={recipientName}
              onChangeText={(t) => {
                setRecipientName(t);
                setErrorMsg('');
              }}
              placeholder="e.g. Lerato Ndlovu"
              placeholderTextColor={colors.textMuted}
              returnKeyType="next"
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceMuted,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
            />

            <Text
              style={[
                styles.label,
                { color: colors.textSecondary, marginTop: 12 },
              ]}
            >
              SHAPID OR SA MOBILE NUMBER
            </Text>
            <TextInput
              value={shapId}
              onChangeText={(t) => {
                setShapId(t);
                setErrorMsg('');
              }}
              placeholder="e.g. 0836149021@capitec"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              returnKeyType="next"
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceMuted,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
            />

            {/* Amount */}
            <Text
              style={[
                styles.label,
                { color: colors.textSecondary, marginTop: 12 },
              ]}
            >
              AMOUNT (ZAR)
            </Text>
            <View
              style={[
                styles.amountInputWrap,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.zarPrefix, { color: colors.text }]}>R</Text>
              <TextInput
                value={amountStr}
                onChangeText={(t) => {
                  setAmountStr(t.replace(/[^0-9.]/g, ''));
                  setErrorMsg('');
                }}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                returnKeyType="done"
                style={[styles.amountInput, { color: colors.text }]}
              />
            </View>

            {/* Quick Presets */}
            <View style={styles.presetsRow}>
              {[50, 100, 250, 500].map((val) => (
                <Pressable
                  key={val}
                  onPress={() => {
                    triggerHaptic('light', nfcSettings.hapticsEnabled);
                    setAmountStr(String(val));
                  }}
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.presetText, { color: colors.text }]}>
                    R {val}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Reference */}
            <Text
              style={[
                styles.label,
                { color: colors.textSecondary, marginTop: 12 },
              ]}
            >
              STATEMENT REFERENCE (OPTIONAL)
            </Text>
            <TextInput
              value={reference}
              onChangeText={setReference}
              placeholder="e.g. Braai contribution"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceMuted,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
            />

            <View
              style={[
                styles.feeRow,
                { backgroundColor: colors.surfaceMuted },
              ]}
            >
              <Text style={[styles.feeLabel, { color: colors.textSecondary }]}>
                PayShap Real-Time Clearing Fee
              </Text>
              <Text style={[styles.feeVal, { color: colors.primary }]}>
                {estimatedFee === 0
                  ? isFromWallet
                    ? 'FREE (Wallet ≤ R 500)'
                    : 'FREE (Under R 100)'
                  : formatZAR(estimatedFee)}
              </Text>
            </View>

            {errorMsg ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>
                {errorMsg}
              </Text>
            ) : null}

            <Pressable
              onPress={handleSend}
              style={({ pressed }) => [
                styles.payBtn,
                {
                  backgroundColor: pressed
                    ? colors.primaryDark
                    : colors.primary,
                },
              ]}
            >
              <Ionicons name="flash" size={18} color="#FFFFFF" />
              <Text style={styles.payBtnText}>
                {numericAmount > 0
                  ? `Pay ${formatZAR(numericAmount)} Now`
                  : 'Send Instant PayShap'}
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
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 34,
    maxHeight: '90%',
    borderTopWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flashBadge: {
    width: 38,
    height: 38,
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
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  accPillsRow: {
    gap: 8,
  },
  accPill: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 13,
    borderWidth: 1,
  },
  accPillTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  accPillBal: {
    fontSize: 11.5,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  input: {
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14.5,
    fontWeight: '600',
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  zarPrefix: {
    fontSize: 22,
    fontWeight: '800',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    paddingVertical: 11,
    fontVariant: ['tabular-nums'],
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 12.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 14,
  },
  feeLabel: {
    fontSize: 12,
  },
  feeVal: {
    fontSize: 12,
    fontWeight: '800',
  },
  errorText: {
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 10,
  },
  payBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 15,
  },
  payBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
