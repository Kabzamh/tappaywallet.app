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
import { Transaction } from '../types';
import { useAppTheme, getGlassStyle } from '../theme/colors';
import { useTapPay } from '../context/TapPayContext';
import { SA_BANKS } from '../data/saBanks';
import { formatZAR, maskAccountNumber, triggerHaptic } from '../utils/format';

interface WalletModalProps {
  visible: boolean;
  initialTab?: 'topup' | 'cashout';
  restrictBalances?: boolean;
  onClose: () => void;
  onCompleted: (tx: Transaction) => void;
}

const RETAIL_VOUCHER_RAILS = [
  'Pick n Pay / Boxer Till Cash',
  '1Voucher 16-Digit PIN',
  'Kazang / Blu Voucher',
];

export function WalletModal({
  visible,
  initialTab = 'topup',
  restrictBalances = false,
  onClose,
  onCompleted,
}: WalletModalProps) {
  const { colors } = useAppTheme();
  const {
    wallet,
    accounts,
    defaultAccount,
    topUpWallet,
    cashOutWalletToBank,
    nfcSettings,
  } = useTapPay();

  const [tab, setTab] = useState<'topup' | 'cashout'>(initialTab);
  const [fundingMethod, setFundingMethod] = useState<'bank' | 'retail_voucher'>(
    'bank'
  );
  const [selectedBankId, setSelectedBankId] = useState(defaultAccount.id);
  const [selectedVoucherRail, setSelectedVoucherRail] = useState(
    RETAIL_VOUCHER_RAILS[0]
  );
  const [voucherPin, setVoucherPin] = useState('8841-9024-1109-4420');
  const [amountStr, setAmountStr] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (visible) {
      setTab(initialTab);
      setSelectedBankId(defaultAccount.id);
      setAmountStr('');
      setErrorMsg('');
    }
  }, [visible, initialTab, defaultAccount.id]);

  const numericAmount = parseFloat(amountStr) || 0;
  const maskBal = restrictBalances || nfcSettings.hideBalances;

  const handleConfirm = () => {
    if (numericAmount <= 0) {
      setErrorMsg('Enter an amount above R 0.00.');
      triggerHaptic('error', nfcSettings.hapticsEnabled);
      return;
    }

    if (tab === 'topup') {
      const res = topUpWallet({
        amount: numericAmount,
        method: fundingMethod,
        bankAccountId: selectedBankId,
        voucherLabel: selectedVoucherRail,
      });
      if (!res.ok || !res.tx) {
        setErrorMsg(res.error || 'Unable to top up TapPay Wallet.');
        triggerHaptic('error', nfcSettings.hapticsEnabled);
        return;
      }
      onClose();
      onCompleted(res.tx);
      return;
    }

    // Cash Out to Linked SA Bank
    const res = cashOutWalletToBank({
      amount: numericAmount,
      bankAccountId: selectedBankId,
    });
    if (!res.ok || !res.tx) {
      setErrorMsg(res.error || 'Unable to cash out to bank.');
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
                <Ionicons name="wallet" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.text }]}>
                  TapPay ZAR Wallet
                </Text>
                <Text
                  style={[styles.subtitle, { color: colors.textSecondary }]}
                >
                  {maskBal
                    ? `${wallet.walletNumber} • Balance Protected`
                    : `Balance: ${formatZAR(wallet.balance)} • Independent e-Money`}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Segmented Top Up vs Cash Out */}
          <View
            style={[
              styles.segmented,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
              },
            ]}
          >
            <Pressable
              onPress={() => {
                setTab('topup');
                setErrorMsg('');
              }}
              style={[
                styles.segmentBtn,
                tab === 'topup' && { backgroundColor: colors.primary },
              ]}
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  { color: tab === 'topup' ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                Top Up Wallet
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setTab('cashout');
                setErrorMsg('');
              }}
              style={[
                styles.segmentBtn,
                tab === 'cashout' && { backgroundColor: colors.primary },
              ]}
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  {
                    color:
                      tab === 'cashout' ? '#FFFFFF' : colors.textSecondary,
                  },
                ]}
              >
                Cash Out to Bank
              </Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {tab === 'topup' && (
              <>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  FUNDING RAIL
                </Text>
                <View style={styles.railSwitchRow}>
                  <Pressable
                    onPress={() => setFundingMethod('bank')}
                    style={[
                      styles.railCard,
                      {
                        backgroundColor:
                          fundingMethod === 'bank'
                            ? colors.primarySoft
                            : colors.surfaceMuted,
                        borderColor:
                          fundingMethod === 'bank'
                            ? colors.primary
                            : colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="business-outline"
                      size={18}
                      color={
                        fundingMethod === 'bank'
                          ? colors.primary
                          : colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.railCardTitle,
                        {
                          color:
                            fundingMethod === 'bank'
                              ? colors.primary
                              : colors.text,
                        },
                      ]}
                    >
                      Linked SA Bank
                    </Text>
                    <Text
                      style={[styles.railCardSub, { color: colors.textMuted }]}
                    >
                      Instant RTC • Free
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setFundingMethod('retail_voucher')}
                    style={[
                      styles.railCard,
                      {
                        backgroundColor:
                          fundingMethod === 'retail_voucher'
                            ? colors.primarySoft
                            : colors.surfaceMuted,
                        borderColor:
                          fundingMethod === 'retail_voucher'
                            ? colors.primary
                            : colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="cash-outline"
                      size={18}
                      color={
                        fundingMethod === 'retail_voucher'
                          ? colors.primary
                          : colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.railCardTitle,
                        {
                          color:
                            fundingMethod === 'retail_voucher'
                              ? colors.primary
                              : colors.text,
                        },
                      ]}
                    >
                      Cash / Voucher
                    </Text>
                    <Text
                      style={[styles.railCardSub, { color: colors.textMuted }]}
                    >
                      100% Bank-Free
                    </Text>
                  </Pressable>
                </View>

                {fundingMethod === 'bank' ? (
                  <>
                    <Text
                      style={[
                        styles.label,
                        { color: colors.textSecondary, marginTop: 14 },
                      ]}
                    >
                      PULL FROM LINKED SA BANK
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.bankPills}
                    >
                      {accounts.map((acc) => {
                        const active = acc.id === selectedBankId;
                        const b = SA_BANKS[acc.bankId];
                        return (
                          <Pressable
                            key={acc.id}
                            onPress={() => setSelectedBankId(acc.id)}
                            style={[
                              styles.bankPill,
                              {
                                backgroundColor: active
                                  ? colors.primarySoft
                                  : colors.surfaceMuted,
                                borderColor: active
                                  ? colors.primary
                                  : colors.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.bankPillName,
                                {
                                  color: active ? colors.primary : colors.text,
                                },
                              ]}
                            >
                              {b.shortName}{' '}
                              {maskAccountNumber(acc.accountNumber)}
                            </Text>
                            <Text
                              style={[
                                styles.bankPillBal,
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
                  </>
                ) : (
                  <>
                    <Text
                      style={[
                        styles.label,
                        { color: colors.textSecondary, marginTop: 14 },
                      ]}
                    >
                      RETAIL CASH / VOUCHER CHANNEL
                    </Text>
                    <View style={styles.voucherList}>
                      {RETAIL_VOUCHER_RAILS.map((r) => {
                        const active = selectedVoucherRail === r;
                        return (
                          <Pressable
                            key={r}
                            onPress={() => setSelectedVoucherRail(r)}
                            style={[
                              styles.voucherOption,
                              {
                                backgroundColor: active
                                  ? colors.primarySoft
                                  : colors.surfaceMuted,
                                borderColor: active
                                  ? colors.primary
                                  : colors.border,
                              },
                            ]}
                          >
                            <Ionicons
                              name={
                                active ? 'radio-button-on' : 'radio-button-off'
                              }
                              size={17}
                              color={
                                active ? colors.primary : colors.textMuted
                              }
                            />
                            <Text
                              style={[
                                styles.voucherOptionText,
                                { color: colors.text },
                              ]}
                            >
                              {r}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Text
                      style={[
                        styles.label,
                        { color: colors.textSecondary, marginTop: 12 },
                      ]}
                    >
                      VOUCHER / TILL DEPOSIT BARCODE PIN
                    </Text>
                    <TextInput
                      value={voucherPin}
                      onChangeText={setVoucherPin}
                      placeholder="16-digit voucher or till ref"
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
                  </>
                )}
              </>
            )}

            {tab === 'cashout' && (
              <>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  SETTLE INSTANTLY TO LINKED SA BANK
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.bankPills}
                >
                  {accounts.map((acc) => {
                    const active = acc.id === selectedBankId;
                    const b = SA_BANKS[acc.bankId];
                    return (
                      <Pressable
                        key={acc.id}
                        onPress={() => setSelectedBankId(acc.id)}
                        style={[
                          styles.bankPill,
                          {
                            backgroundColor: active
                              ? colors.primarySoft
                              : colors.surfaceMuted,
                            borderColor: active
                              ? colors.primary
                              : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.bankPillName,
                            { color: active ? colors.primary : colors.text },
                          ]}
                        >
                          {b.shortName} {maskAccountNumber(acc.accountNumber)}
                        </Text>
                        <Text
                          style={[
                            styles.bankPillBal,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Branch {acc.branchCode}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* Amount Input */}
            <View style={styles.amountHeaderRow}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                AMOUNT (ZAR)
              </Text>
              {tab === 'cashout' && wallet.balance > 0 && !maskBal && (
                <Pressable
                  onPress={() => setAmountStr(wallet.balance.toFixed(2))}
                >
                  <Text
                    style={[styles.withdrawAllLink, { color: colors.primary }]}
                  >
                    Withdraw Full {formatZAR(wallet.balance)}
                  </Text>
                </Pressable>
              )}
            </View>
            <View
              style={[
                styles.amountWrap,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.zarSign, { color: colors.text }]}>R</Text>
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
              {[100, 250, 500, 1000].map((v) => (
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
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.presetText, { color: colors.text }]}>
                    R {v}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View
              style={[
                styles.trustNote,
                { backgroundColor: colors.surfaceMuted },
              ]}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={16}
                color={colors.primary}
              />
              <Text
                style={[styles.trustNoteText, { color: colors.textSecondary }]}
              >
                {tab === 'topup'
                  ? 'Funds in your TapPay Wallet are ring-fenced 1:1 and never expose your personal bank account to merchants.'
                  : 'Instant zero-fee RTC settlement straight into your selected South African bank account.'}
              </Text>
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
              <Ionicons
                name={
                  tab === 'topup' ? 'add-circle-outline' : 'arrow-up-circle'
                }
                size={19}
                color="#FFFFFF"
              />
              <Text style={styles.submitBtnText}>
                {tab === 'topup'
                  ? numericAmount > 0
                    ? `Load ${formatZAR(numericAmount)} into Wallet`
                    : 'Top Up TapPay Wallet'
                  : numericAmount > 0
                  ? `Cash Out ${formatZAR(numericAmount)} to Bank`
                  : 'Cash Out to Bank'}
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
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    fontVariant: ['tabular-nums'],
  },
  segmented: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  label: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  railSwitchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  railCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 3,
  },
  railCardTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    marginTop: 2,
  },
  railCardSub: {
    fontSize: 11,
  },
  bankPills: {
    gap: 8,
  },
  bankPill: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 13,
    borderWidth: 1,
  },
  bankPillName: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  bankPillBal: {
    fontSize: 11.5,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  voucherList: {
    gap: 7,
  },
  voucherOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  voucherOptionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  pinInput: {
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  amountHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  withdrawAllLink: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  amountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  zarSign: {
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
  presetBtn: {
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
  trustNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginTop: 14,
  },
  trustNoteText: {
    fontSize: 11.5,
    lineHeight: 16,
    flex: 1,
  },
  errorText: {
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 10,
  },
  submitBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 15,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
