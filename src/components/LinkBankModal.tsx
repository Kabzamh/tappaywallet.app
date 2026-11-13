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
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppTheme, getGlassStyle } from '../theme/colors';
import { SA_BANK_LIST, SA_BANKS } from '../data/saBanks';
import { SABankId, BankAccountType, LinkedBankAccount } from '../types';
import { useTapPay } from '../context/TapPayContext';
import { triggerHaptic } from '../utils/format';

interface LinkBankModalProps {
  visible: boolean;
  onClose: () => void;
  onLinked?: (acc: LinkedBankAccount) => void;
}

export function LinkBankModal({
  visible,
  onClose,
  onLinked,
}: LinkBankModalProps) {
  const { colors } = useAppTheme();
  const { linkNewBankAccount, nfcSettings } = useTapPay();

  const [step, setStep] = useState<'bank' | 'details' | 'authorizing'>('bank');
  const [selectedBank, setSelectedBank] = useState<SABankId>('standard');
  const [accountType, setAccountType] = useState<BankAccountType>('Cheque');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('T MOKOENA');
  const [makeDefault, setMakeDefault] = useState(true);
  const [authStageText, setAuthStageText] = useState(
    'Connecting to BankservAfrica Open Banking...'
  );
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (visible) {
      setStep('bank');
      setSelectedBank('standard');
      setAccountType('Cheque');
      setAccountNumber('');
      setAccountHolder('T MOKOENA');
      setMakeDefault(true);
      setErrorMsg('');
    }
  }, [visible]);

  const bankInfo = SA_BANKS[selectedBank];

  const handleAutofillDemoNumber = () => {
    triggerHaptic('light', nfcSettings.hapticsEnabled);
    const prefixes: Record<SABankId, string> = {
      fnb: '62',
      capitec: '16',
      standard: '01',
      absa: '40',
      nedbank: '19',
      discovery: '78',
      tymebank: '51',
    };
    const random8 = String(Math.floor(10000000 + Math.random() * 89999999));
    setAccountNumber(`${prefixes[selectedBank]}${random8}`);
    setErrorMsg('');
  };

  const handleAuthorizeMandate = () => {
    const digits = accountNumber.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 11) {
      setErrorMsg('Enter a valid 9 to 11-digit South African account number.');
      triggerHaptic('error', nfcSettings.hapticsEnabled);
      return;
    }
    if (!accountHolder.trim()) {
      setErrorMsg('Enter the FICA-registered account holder name.');
      return;
    }

    setErrorMsg('');
    setStep('authorizing');
    setAuthStageText(
      `Requesting DebiCheck & HCE Mandate from ${bankInfo.shortName}...`
    );

    setTimeout(() => {
      setAuthStageText(
        `Verifying Universal Branch ${bankInfo.universalBranchCode} & FICA ID...`
      );
    }, 800);

    setTimeout(() => {
      setAuthStageText('Provisioning ISO 14443-4 Direct NFC Token...');
    }, 1550);

    setTimeout(() => {
      const realisticSeededBalance = Number(
        (4500 + Math.random() * 19500).toFixed(2)
      );
      const created = linkNewBankAccount({
        bankId: selectedBank,
        accountHolder: accountHolder.trim(),
        accountNumber: digits,
        accountType,
        initialBalance: realisticSeededBalance,
        makeDefault,
      });
      onLinked?.(created);
      onClose();
    }, 2300);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (step !== 'authorizing') onClose();
      }}
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
              {step === 'details' && (
                <Pressable
                  onPress={() => setStep('bank')}
                  hitSlop={10}
                  style={styles.backBtn}
                >
                  <Ionicons name="arrow-back" size={20} color={colors.text} />
                </Pressable>
              )}
              <View>
                <Text style={[styles.title, { color: colors.text }]}>
                  {step === 'bank'
                    ? 'Link SA Bank Account'
                    : step === 'details'
                    ? `Connect ${bankInfo.shortName}`
                    : 'Authorizing Mandate'}
                </Text>
                <Text
                  style={[styles.subtitle, { color: colors.textSecondary }]}
                >
                  {step === 'bank'
                    ? 'Direct-to-bank NFC & PayShap settlement'
                    : `Universal Branch Code: ${bankInfo.universalBranchCode}`}
                </Text>
              </View>
            </View>
            {step !== 'authorizing' && (
              <Pressable onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>

          {step === 'bank' && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.bankList}
            >
              {SA_BANK_LIST.map((bank) => {
                const isSelected = bank.id === selectedBank;
                return (
                  <Pressable
                    key={bank.id}
                    onPress={() => {
                      triggerHaptic('light', nfcSettings.hapticsEnabled);
                      setSelectedBank(bank.id);
                      setStep('details');
                    }}
                    style={({ pressed }) => [
                      styles.bankRow,
                      {
                        backgroundColor: pressed
                          ? colors.surfaceMuted
                          : colors.surfaceElevated,
                        borderColor: isSelected
                          ? colors.primary
                          : colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.bankBadge,
                        { backgroundColor: bank.gradient[0] },
                      ]}
                    >
                      <Text style={styles.bankBadgeText}>
                        {bank.shortName.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.bankMeta}>
                      <Text style={[styles.bankName, { color: colors.text }]}>
                        {bank.name}
                      </Text>
                      <Text
                        style={[
                          styles.bankSub,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Branch {bank.universalBranchCode} • Open Banking &
                        PayShap
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.textMuted}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {step === 'details' && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Account Type Selector */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                ACCOUNT TYPE
              </Text>
              <View style={styles.typeSegmented}>
                {(['Cheque', 'Savings', 'Business'] as BankAccountType[]).map(
                  (t) => {
                    const active = accountType === t;
                    return (
                      <Pressable
                        key={t}
                        onPress={() => setAccountType(t)}
                        style={[
                          styles.typeSegmentBtn,
                          {
                            backgroundColor: active
                              ? colors.primary
                              : colors.surfaceMuted,
                            borderColor: active
                              ? colors.primary
                              : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.typeSegmentText,
                            { color: active ? '#FFFFFF' : colors.text },
                          ]}
                        >
                          {t}
                        </Text>
                      </Pressable>
                    );
                  }
                )}
              </View>

              {/* Account Number */}
              <View style={styles.labelRowBetween}>
                <Text
                  style={[styles.fieldLabel, { color: colors.textSecondary }]}
                >
                  SA ACCOUNT NUMBER
                </Text>
                <Pressable onPress={handleAutofillDemoNumber}>
                  <Text
                    style={[styles.autofillLink, { color: colors.primary }]}
                  >
                    Generate Sample #
                  </Text>
                </Pressable>
              </View>
              <TextInput
                value={accountNumber}
                onChangeText={(txt) => {
                  setAccountNumber(txt.replace(/\D/g, ''));
                  setErrorMsg('');
                }}
                placeholder="e.g. 6289104421"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                returnKeyType="done"
                maxLength={11}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceMuted,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
              />

              {/* Account Holder */}
              <Text
                style={[
                  styles.fieldLabel,
                  { color: colors.textSecondary, marginTop: 14 },
                ]}
              >
                ACCOUNT HOLDER (FICA VERIFIED)
              </Text>
              <TextInput
                value={accountHolder}
                onChangeText={setAccountHolder}
                placeholder="Initials & Surname"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
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

              {/* Auto-filled Universal Branch Code */}
              <View
                style={[
                  styles.branchInfoBox,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={colors.primary}
                />
                <Text
                  style={[
                    styles.branchInfoText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Universal Branch Code{' '}
                  <Text style={{ fontWeight: '800', color: colors.text }}>
                    {bankInfo.universalBranchCode}
                  </Text>{' '}
                  & PayShap handle{' '}
                  <Text style={{ fontWeight: '700', color: colors.text }}>
                    @{bankInfo.payShapDomain}
                  </Text>{' '}
                  linked automatically.
                </Text>
              </View>

              {/* Default NFC Toggle */}
              <Pressable
                onPress={() => setMakeDefault((v) => !v)}
                style={styles.checkboxRow}
              >
                <Ionicons
                  name={makeDefault ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={makeDefault ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                  Set as primary account for NFC Tap to Pay & Receive
                </Text>
              </Pressable>

              {errorMsg ? (
                <Text style={[styles.errorText, { color: colors.danger }]}>
                  {errorMsg}
                </Text>
              ) : null}

              <Pressable
                onPress={handleAuthorizeMandate}
                style={({ pressed }) => [
                  styles.submitBtn,
                  {
                    backgroundColor: pressed
                      ? colors.primaryDark
                      : colors.primary,
                  },
                ]}
              >
                <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                <Text style={styles.submitBtnText}>
                  Authorize Direct NFC Mandate
                </Text>
              </Pressable>
            </ScrollView>
          )}

          {step === 'authorizing' && (
            <View style={styles.authContainer}>
              <View
                style={[
                  styles.authPulseBox,
                  { backgroundColor: colors.primarySoft },
                ]}
              >
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
              <Text style={[styles.authTitle, { color: colors.text }]}>
                Linking {bankInfo.name}
              </Text>
              <Text
                style={[styles.authSubtitle, { color: colors.textSecondary }]}
              >
                {authStageText}
              </Text>
              <View
                style={[
                  styles.securityFoot,
                  { backgroundColor: colors.surfaceMuted },
                ]}
              >
                <Ionicons
                  name="lock-closed"
                  size={14}
                  color={colors.primary}
                />
                <Text
                  style={[
                    styles.securityFootText,
                    { color: colors.textSecondary },
                  ]}
                >
                  SARB & POPIA Encrypted Open Banking Channel
                </Text>
              </View>
            </View>
          )}
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
    maxHeight: '88%',
    borderTopWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  backBtn: {
    padding: 4,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12.5,
    marginTop: 2,
  },
  bankList: {
    gap: 10,
    paddingBottom: 12,
  },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  bankBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  bankMeta: {
    flex: 1,
  },
  bankName: {
    fontSize: 15,
    fontWeight: '700',
  },
  bankSub: {
    fontSize: 12,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 7,
  },
  labelRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  autofillLink: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 7,
  },
  typeSegmented: {
    flexDirection: 'row',
    gap: 8,
  },
  typeSegmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  typeSegmentText: {
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  branchInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 12,
    borderRadius: 13,
    borderWidth: 1,
    marginTop: 14,
  },
  branchInfoText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  checkboxLabel: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  errorText: {
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 10,
  },
  submitBtn: {
    marginTop: 18,
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
  authContainer: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  authPulseBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  authTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  authSubtitle: {
    fontSize: 13.5,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
    paddingHorizontal: 12,
  },
  securityFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  securityFootText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
});
