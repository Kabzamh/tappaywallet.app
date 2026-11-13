import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTabNavigation } from '../context/TabNavigationContext';
import { useAppTheme, getGlassStyle } from '../theme/colors';
import { GlassPanel } from '../components/GlassUI';
import { useTapPay } from '../context/TapPayContext';
import {
  SA_BANKS,
  SIMULATED_SA_MERCHANTS,
  SIMULATED_PAYERS,
} from '../data/saBanks';
import { NfcRadarAnimation, NfcStage } from '../components/NfcRadarAnimation';
import { PinAuthModal } from '../components/PinAuthModal';
import { ReceiptModal } from '../components/ReceiptModal';
import {
  SimulatedMerchant,
  Transaction,
  TAPPAY_WALLET_ID,
} from '../types';
import { formatZAR, maskAccountNumber, triggerHaptic } from '../utils/format';

export function TapHubScreen() {
  const { colors } = useAppTheme();
  const { tapParams } = useTabNavigation();
  const {
    wallet,
    accounts,
    defaultAccount,
    encryptionProfile,
    activeNfcSourceId,
    selectPrimaryNfcSource,
    nfcSettings,
    executeTapPayment,
    executeSoftPosReceive,
  } = useTapPay();

  const [mode, setMode] = useState<'pay' | 'receive'>('pay');

  // --- Tap to Pay State ---
  const [selectedMerchant, setSelectedMerchant] =
    useState<SimulatedMerchant | null>(SIMULATED_SA_MERCHANTS[0]);
  const [useCustomPayAmount, setUseCustomPayAmount] = useState(false);
  const [customPayAmount, setCustomPayAmount] = useState('120.00');
  const [customPayMerchant, setCustomPayMerchant] = useState(
    'Checkers Sixty60 POS'
  );
  const [payStage, setPayStage] = useState<NfcStage>('idle');
  const [payStageLabel, setPayStageLabel] = useState(
    'Hold phone near POS terminal or TapPay device'
  );
  const [payError, setPayError] = useState('');
  const [pinModalOpen, setPinModalOpen] = useState(false);

  // --- Tap to Receive (SoftPOS) State ---
  const [receiveAmountStr, setReceiveAmountStr] = useState('185.00');
  const [receiveRef, setReceiveRef] = useState('');
  const [terminalActive, setTerminalActive] = useState(false);
  const [receiveStage, setReceiveStage] = useState<NfcStage>('scanning');
  const [receiveStageLabel, setReceiveStageLabel] = useState(
    'Ask customer to tap card, phone, or watch on back of device'
  );
  const [receiveError, setReceiveError] = useState('');

  // Shared Receipt & Approved Banner
  const [latestTx, setLatestTx] = useState<Transaction | null>(null);
  const [receiptTx, setReceiptTx] = useState<Transaction | null>(null);

  useEffect(() => {
    if (tapParams.mode === 'receive' || tapParams.mode === 'pay') {
      setMode(tapParams.mode);
      setLatestTx(null);
      setTerminalActive(false);
      setPayStage('idle');
    }
  }, [tapParams.mode, tapParams.ts]);

  const activePayAmount = useCustomPayAmount
    ? parseFloat(customPayAmount) || 0
    : selectedMerchant?.amount || 0;

  const requiresPin = activePayAmount > nfcSettings.pinlessLimit;

  const isUsingWallet = activeNfcSourceId === TAPPAY_WALLET_ID;
  const activeSourceLabel = isUsingWallet
    ? 'TapPay Wallet'
    : SA_BANKS[defaultAccount.bankId].shortName;

  const cycleBankAccount = () => {
    const orderedIds = [TAPPAY_WALLET_ID, ...accounts.map((a) => a.id)];
    const idx = orderedIds.indexOf(activeNfcSourceId);
    const nextId = orderedIds[(idx + 1) % orderedIds.length];
    selectPrimaryNfcSource(nextId);
  };

  // --- Execute Multi-stage NFC Tap to Pay ---
  const runTapPayHandshake = (pinWasVerified: boolean) => {
    setPayError('');
    setLatestTx(null);
    setPayStage('scanning');
    setPayStageLabel('13.56 MHz RF Field Detected...');
    triggerHaptic('medium', nfcSettings.hapticsEnabled);

    setTimeout(() => {
      setPayStage('authenticating');
      setPayStageLabel('Exchanging HCE Direct-to-Bank Cryptogram...');
    }, 650);

    setTimeout(() => {
      setPayStage('settling');
      setPayStageLabel('Clearing Instantly via BankservAfrica...');
    }, 1350);

    setTimeout(() => {
      const merchantTitle = useCustomPayAmount
        ? customPayMerchant.trim() || 'Direct Contactless Merchant'
        : selectedMerchant?.name || 'SA Retail POS';

      const subtitle = useCustomPayAmount
        ? 'Direct HCE Tap to Pay'
        : `${selectedMerchant?.branch} • Tap to Pay`;

      const res = executeTapPayment({
        merchantName: merchantTitle,
        subtitle,
        amount: activePayAmount,
        category: useCustomPayAmount
          ? 'Market & Retail'
          : selectedMerchant?.category || 'Groceries',
        acquirerBank: useCustomPayAmount
          ? 'SA Open Acquiring POS'
          : selectedMerchant?.acquirerBank || 'Standard Bank POS',
        accountId: activeNfcSourceId,
        pinVerified: pinWasVerified,
      });

      if (!res.ok || !res.tx) {
        setPayStage('idle');
        setPayStageLabel('Hold phone near POS terminal or TapPay device');
        setPayError(res.error || 'NFC Tap declined.');
        triggerHaptic('error', nfcSettings.hapticsEnabled);
        return;
      }

      setPayStage('approved');
      setPayStageLabel(`Approved! Paid ${formatZAR(res.tx.amount)}`);
      setLatestTx(res.tx);
    }, 2050);
  };

  const handleTriggerTapPay = () => {
    if (payStage !== 'idle' && payStage !== 'approved') return;
    setPayError('');

    if (activePayAmount <= 0) {
      setPayError('Enter an amount greater than R 0.00.');
      return;
    }

    if (isUsingWallet && !wallet.nfcEnabled) {
      setPayError(
        'NFC is paused on your TapPay Wallet. Enable it in the Banks tab.'
      );
      triggerHaptic('error', nfcSettings.hapticsEnabled);
      return;
    }

    if (!isUsingWallet && !defaultAccount.nfcEnabled) {
      setPayError(
        `NFC is paused on ${SA_BANKS[defaultAccount.bankId].shortName}. Enable it in the Banks tab.`
      );
      triggerHaptic('error', nfcSettings.hapticsEnabled);
      return;
    }

    if (requiresPin) {
      setPinModalOpen(true);
      return;
    }

    runTapPayHandshake(false);
  };

  // --- Keypad for SoftPOS Receive ---
  const handleKeypadPress = (key: string) => {
    triggerHaptic('light', nfcSettings.hapticsEnabled);
    setReceiveError('');
    setReceiveAmountStr((prev) => {
      if (key === 'BACK') {
        const sliced = prev.slice(0, -1);
        return sliced.length === 0 ? '0' : sliced;
      }
      if (key === '.') {
        if (prev.includes('.')) return prev;
        return prev + '.';
      }
      const parts = prev.split('.');
      if (parts[1] && parts[1].length >= 2) {
        return prev;
      }
      if (prev === '0' || prev === '0.00') {
        return key;
      }
      if (prev.replace('.', '').length >= 7) return prev;
      return prev + key;
    });
  };

  const receiveNumeric = parseFloat(receiveAmountStr) || 0;

  const handleActivateSoftPos = () => {
    if (receiveNumeric <= 0) {
      setReceiveError('Enter an amount above R 0.00 to activate SoftPOS.');
      triggerHaptic('error', nfcSettings.hapticsEnabled);
      return;
    }
    setReceiveError('');
    setLatestTx(null);
    setReceiveStage('scanning');
    setReceiveStageLabel(
      'Ask customer to tap card, phone, or watch on back of device'
    );
    setTerminalActive(true);
    triggerHaptic('medium', nfcSettings.hapticsEnabled);
  };

  const handleSimulateCustomerTap = (payer: (typeof SIMULATED_PAYERS)[0]) => {
    if (receiveStage !== 'scanning') return;
    triggerHaptic('medium', nfcSettings.hapticsEnabled);
    setReceiveStage('authenticating');
    setReceiveStageLabel(`Reading ${payer.label}...`);

    setTimeout(() => {
      setReceiveStage('settling');
      setReceiveStageLabel(
        `Settling ${formatZAR(receiveNumeric)} directly to ${activeSourceLabel}...`
      );
    }, 700);

    setTimeout(() => {
      const isCard = payer.id !== 'p-2';
      const res = executeSoftPosReceive({
        payerName: payer.customerName,
        referenceNote: receiveRef.trim(),
        amount: receiveNumeric,
        payerBank: payer.bank,
        cardOrDeviceHint: payer.hint,
        isCommercialCard: isCard,
        accountId: activeNfcSourceId,
      });

      if (!res.ok || !res.tx) {
        setReceiveStage('scanning');
        setReceiveError(res.error || 'Unable to complete SoftPOS settlement.');
        return;
      }

      setReceiveStage('approved');
      setReceiveStageLabel(
        `Credited ${formatZAR(res.tx.amount - res.tx.fee)} to ${activeSourceLabel}!`
      );
      setLatestTx(res.tx);
    }, 1550);
  };

  const activeBank = SA_BANKS[defaultAccount.bankId];

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safe, { backgroundColor: 'transparent' }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Mode Segmented Header */}
          <View
            style={[
              styles.segmentedWrap,
              getGlassStyle(colors.isDark, 20),
              {
                backgroundColor: colors.surface,
                borderColor: colors.glassHighlight,
              },
            ]}
          >
            <Pressable
              onPress={() => {
                triggerHaptic('light', nfcSettings.hapticsEnabled);
                setMode('pay');
                setLatestTx(null);
                setPayStage('idle');
              }}
              style={[
                styles.segmentTab,
                mode === 'pay' && { backgroundColor: colors.primary },
              ]}
            >
              <Ionicons
                name="wifi"
                size={16}
                color={mode === 'pay' ? '#FFFFFF' : colors.textSecondary}
              />
              <Text
                style={[
                  styles.segmentTabText,
                  { color: mode === 'pay' ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                Tap to Pay
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                triggerHaptic('light', nfcSettings.hapticsEnabled);
                setMode('receive');
                setLatestTx(null);
                setTerminalActive(false);
              }}
              style={[
                styles.segmentTab,
                mode === 'receive' && { backgroundColor: colors.info },
              ]}
            >
              <Ionicons
                name="phone-portrait-outline"
                size={16}
                color={mode === 'receive' ? '#FFFFFF' : colors.textSecondary}
              />
              <Text
                style={[
                  styles.segmentTabText,
                  {
                    color:
                      mode === 'receive' ? '#FFFFFF' : colors.textSecondary,
                  },
                ]}
              >
                Tap to Receive
              </Text>
            </Pressable>
          </View>

          {/* Active Funding Source Pill (TapPay Wallet OR Linked SA Bank) */}
          <Pressable
            onPress={cycleBankAccount}
            style={[
              styles.activeBankBar,
              getGlassStyle(colors.isDark, 18),
              {
                backgroundColor: colors.surface,
                borderColor: colors.glassHighlight,
              },
            ]}
          >
            <View style={styles.activeBankLeft}>
              <View
                style={[
                  styles.bankDot,
                  {
                    backgroundColor: isUsingWallet
                      ? '#065F46'
                      : activeBank.gradient[0],
                  },
                ]}
              >
                {isUsingWallet ? (
                  <Ionicons name="wallet" size={16} color="#34D399" />
                ) : (
                  <Text style={styles.bankDotText}>
                    {activeBank.shortName.slice(0, 2).toUpperCase()}
                  </Text>
                )}
              </View>
              <View>
                <Text style={[styles.activeBankLabel, { color: colors.text }]}>
                  {mode === 'pay' ? 'Paying from' : 'Receiving into'}{' '}
                  {isUsingWallet
                    ? `TapPay Wallet •• ${wallet.walletNumber.slice(-4)}`
                    : `${activeBank.shortName} ${maskAccountNumber(
                        defaultAccount.accountNumber
                      )}`}
                </Text>
                <Text
                  style={[
                    styles.activeBankBal,
                    { color: colors.textSecondary },
                  ]}
                >
                  {isUsingWallet
                    ? 'TapPay ZAR Wallet'
                    : `${defaultAccount.accountType} • Branch ${defaultAccount.branchCode}`}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.swapChip,
                { backgroundColor: colors.surfaceMuted },
              ]}
            >
              <Ionicons
                name="swap-horizontal"
                size={14}
                color={colors.primary}
              />
              <Text style={[styles.swapChipText, { color: colors.primary }]}>
                Switch
              </Text>
            </View>
          </Pressable>

          {/* ==================== MODE 1: TAP TO PAY ==================== */}
          {mode === 'pay' && (
            <View style={styles.modeBody}>
              {/* Radar Centerpiece */}
              <GlassPanel style={styles.radarCard}>
                <View
                  style={[
                    styles.enclavePill,
                    { backgroundColor: colors.primarySoft },
                  ]}
                >
                  <Ionicons
                    name="lock-closed"
                    size={11}
                    color={colors.primary}
                  />
                  <Text
                    style={[styles.enclavePillText, { color: colors.primary }]}
                  >
                    Encrypted Contactless Ready
                  </Text>
                </View>
                <NfcRadarAnimation stage={payStage} mode="pay" size={168} />

                <Text style={[styles.stageHeadline, { color: colors.text }]}>
                  {formatZAR(activePayAmount)}
                </Text>
                <Text
                  style={[
                    styles.stageSubline,
                    {
                      color:
                        payStage === 'approved'
                          ? colors.primary
                          : colors.textSecondary,
                    },
                  ]}
                >
                  {payStageLabel}
                </Text>

                {requiresPin && payStage === 'idle' && (
                  <View
                    style={[
                      styles.pinNoticeBadge,
                      { backgroundColor: colors.goldSoft },
                    ]}
                  >
                    <Ionicons
                      name="lock-closed"
                      size={13}
                      color={colors.gold}
                    />
                    <Text
                      style={[styles.pinNoticeText, { color: colors.gold }]}
                    >
                      Above {formatZAR(nfcSettings.pinlessLimit)} — Bank PIN /
                      Biometric Required
                    </Text>
                  </View>
                )}

                {payError ? (
                  <Text style={[styles.errorBanner, { color: colors.danger }]}>
                    {payError}
                  </Text>
                ) : null}

                {latestTx && payStage === 'approved' ? (
                  <View style={styles.postApprovalRow}>
                    <Pressable
                      onPress={() => setReceiptTx(latestTx)}
                      style={[
                        styles.popButton,
                        { backgroundColor: colors.primarySoft },
                      ]}
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={17}
                        color={colors.primary}
                      />
                      <Text
                        style={[
                          styles.popButtonText,
                          { color: colors.primary },
                        ]}
                      >
                        View Proof of Payment
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setPayStage('idle');
                        setLatestTx(null);
                        setPayStageLabel(
                          'Hold phone near POS terminal or TapPay device'
                        );
                      }}
                      style={[
                        styles.newTapBtn,
                        {
                          backgroundColor: colors.surfaceMuted,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.newTapBtnText, { color: colors.text }]}
                      >
                        Ready Again
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    disabled={payStage !== 'idle'}
                    onPress={handleTriggerTapPay}
                    style={({ pressed }) => [
                      styles.tapTriggerBtn,
                      {
                        backgroundColor:
                          payStage !== 'idle'
                            ? colors.textMuted
                            : pressed
                            ? colors.primaryDark
                            : colors.primary,
                      },
                    ]}
                  >
                    <Ionicons name="wifi" size={20} color="#FFFFFF" />
                    <Text style={styles.tapTriggerBtnText}>
                      {payStage === 'idle'
                        ? 'Tap Now (Hold Near Machine)'
                        : 'Processing Payment...'}
                    </Text>
                  </Pressable>
                )}
              </GlassPanel>

              {/* Merchant / Custom Scenario Selector */}
              <View style={styles.scenarioHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Stores & Card Machines
                </Text>
                <Pressable
                  onPress={() => {
                    triggerHaptic('light', nfcSettings.hapticsEnabled);
                    setUseCustomPayAmount((v) => !v);
                    setPayStage('idle');
                  }}
                >
                  <Text
                    style={[styles.customToggleLink, { color: colors.primary }]}
                  >
                    {useCustomPayAmount ? 'Choose Store' : 'Enter Amount'}
                  </Text>
                </Pressable>
              </View>

              {useCustomPayAmount ? (
                <View
                  style={[
                    styles.customBox,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.customLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    TERMINAL / RECIPIENT NAME
                  </Text>
                  <TextInput
                    value={customPayMerchant}
                    onChangeText={setCustomPayMerchant}
                    placeholder="e.g. Dis-Chem Sandton"
                    placeholderTextColor={colors.textMuted}
                    style={[
                      styles.customInput,
                      {
                        backgroundColor: colors.surfaceMuted,
                        color: colors.text,
                        borderColor: colors.border,
                      },
                    ]}
                  />

                  <Text
                    style={[
                      styles.customLabel,
                      { color: colors.textSecondary, marginTop: 12 },
                    ]}
                  >
                    TAP AMOUNT (ZAR)
                  </Text>
                  <TextInput
                    value={customPayAmount}
                    onChangeText={(t) =>
                      setCustomPayAmount(t.replace(/[^0-9.]/g, ''))
                    }
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={colors.textMuted}
                    style={[
                      styles.customInput,
                      {
                        backgroundColor: colors.surfaceMuted,
                        color: colors.text,
                        borderColor: colors.border,
                      },
                    ]}
                  />
                </View>
              ) : (
                <View style={styles.merchantGrid}>
                  {SIMULATED_SA_MERCHANTS.map((m) => {
                    const active = selectedMerchant?.id === m.id;
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => {
                          triggerHaptic('light', nfcSettings.hapticsEnabled);
                          setSelectedMerchant(m);
                          setPayStage('idle');
                          setLatestTx(null);
                          setPayError('');
                        }}
                        style={[
                          styles.merchantRow,
                          {
                            backgroundColor: active
                              ? colors.primarySoft
                              : colors.surface,
                            borderColor: active
                              ? colors.primary
                              : colors.border,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.merchantIconBox,
                            {
                              backgroundColor: active
                                ? colors.primary
                                : colors.surfaceMuted,
                            },
                          ]}
                        >
                          <Ionicons
                            name={m.icon as any}
                            size={18}
                            color={active ? '#FFFFFF' : colors.text}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.merchantName,
                              { color: colors.text },
                            ]}
                          >
                            {m.name}
                          </Text>
                          <Text
                            style={[
                              styles.merchantBranch,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {m.branch} • {m.acquirerBank}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text
                            style={[
                              styles.merchantAmount,
                              {
                                color: active ? colors.primary : colors.text,
                              },
                            ]}
                          >
                            {formatZAR(m.amount)}
                          </Text>
                          {m.amount > nfcSettings.pinlessLimit && (
                            <Text
                              style={[styles.pinMiniTag, { color: colors.gold }]}
                            >
                              PIN Req
                            </Text>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ==================== MODE 2: TAP TO RECEIVE (SOFTPOS) ==================== */}
          {mode === 'receive' && !terminalActive && (
            <GlassPanel style={styles.softPosSetupCard}>
              <Text
                style={[styles.softPosTag, { color: colors.info }]}
              >
                TAP-ON-PHONE SOFTPOS TERMINAL
              </Text>
              <Text style={[styles.softPosAmount, { color: colors.text }]}>
                {formatZAR(receiveNumeric)}
              </Text>
              <Text
                style={[styles.softPosFeeNote, { color: colors.textSecondary }]}
              >
                TapPay P2P: R 0.00 fee • Bank Card Tap: 0.45% instant clearing
              </Text>

              {/* Quick Add Chips */}
              <View style={styles.quickReceiveRow}>
                {[50, 120, 250, 500].map((v) => (
                  <Pressable
                    key={v}
                    onPress={() => {
                      triggerHaptic('light', nfcSettings.hapticsEnabled);
                      setReceiveAmountStr(v.toFixed(2));
                    }}
                    style={[
                      styles.quickChip,
                      {
                        backgroundColor: colors.surfaceMuted,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.quickChipText, { color: colors.text }]}>
                      R {v}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => {
                    triggerHaptic('light', nfcSettings.hapticsEnabled);
                    setReceiveAmountStr('0');
                  }}
                  style={[
                    styles.quickChip,
                    {
                      backgroundColor: colors.dangerSoft,
                      borderColor: colors.dangerSoft,
                    },
                  ]}
                >
                  <Text
                    style={[styles.quickChipText, { color: colors.danger }]}
                  >
                    Clear
                  </Text>
                </Pressable>
              </View>

              {/* Optional Reference */}
              <TextInput
                value={receiveRef}
                onChangeText={setReceiveRef}
                placeholder="Payment reference (e.g. Market Stall / Braai Split)"
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                style={[
                  styles.refInput,
                  {
                    backgroundColor: colors.surfaceMuted,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
              />

              {/* Custom Tactile Keypad */}
              <View style={styles.keypadGrid}>
                {[
                  '1',
                  '2',
                  '3',
                  '4',
                  '5',
                  '6',
                  '7',
                  '8',
                  '9',
                  '.',
                  '0',
                  'BACK',
                ].map((k) => (
                  <Pressable
                    key={k}
                    onPress={() => handleKeypadPress(k)}
                    style={({ pressed }) => [
                      styles.padKey,
                      {
                        backgroundColor: pressed
                          ? colors.border
                          : colors.surfaceMuted,
                      },
                    ]}
                  >
                    {k === 'BACK' ? (
                      <Ionicons
                        name="backspace-outline"
                        size={22}
                        color={colors.text}
                      />
                    ) : (
                      <Text style={[styles.padKeyText, { color: colors.text }]}>
                        {k}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>

              {receiveError ? (
                <Text style={[styles.errorBanner, { color: colors.danger }]}>
                  {receiveError}
                </Text>
              ) : null}

              <Pressable
                onPress={handleActivateSoftPos}
                style={({ pressed }) => [
                  styles.activateTerminalBtn,
                  {
                    backgroundColor: pressed ? '#0369A1' : colors.info,
                  },
                ]}
              >
                <Ionicons name="radio-outline" size={20} color="#FFFFFF" />
                <Text style={styles.activateTerminalText}>
                  Activate NFC Reader ({formatZAR(receiveNumeric)})
                </Text>
              </Pressable>
            </GlassPanel>
          )}

          {/* ==================== ACTIVE SOFTPOS READER TERMINAL ==================== */}
          {mode === 'receive' && terminalActive && (
            <GlassPanel style={styles.radarCard}>
              <View style={styles.terminalTopBadge}>
                <View
                  style={[
                    styles.liveDot,
                    {
                      backgroundColor:
                        receiveStage === 'approved'
                          ? colors.primary
                          : colors.info,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.terminalTopText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {receiveStage === 'approved'
                    ? 'PAYMENT SETTLED TO BANK'
                    : 'NFC READER ARMED • HOLD CARD OR PHONE HERE'}
                </Text>
              </View>

              <NfcRadarAnimation
                stage={receiveStage}
                mode="receive"
                size={172}
              />

              <Text style={[styles.stageHeadline, { color: colors.text }]}>
                {formatZAR(receiveNumeric)}
              </Text>
              {receiveRef ? (
                <Text
                  style={[styles.refSubtag, { color: colors.textSecondary }]}
                >
                  Ref: {receiveRef}
                </Text>
              ) : null}
              <Text
                style={[
                  styles.stageSubline,
                  {
                    color:
                      receiveStage === 'approved'
                        ? colors.primary
                        : colors.textSecondary,
                  },
                ]}
              >
                {receiveStageLabel}
              </Text>

              {receiveStage === 'scanning' && (
                <View style={styles.payerSimBlock}>
                  <Text
                    style={[
                      styles.payerSimHeading,
                      { color: colors.textMuted },
                    ]}
                  >
                    SIMULATE INCOMING CUSTOMER / PEER NFC TAP:
                  </Text>
                  {SIMULATED_PAYERS.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => handleSimulateCustomerTap(p)}
                      style={({ pressed }) => [
                        styles.payerSimBtn,
                        {
                          backgroundColor: pressed
                            ? colors.infoSoft
                            : colors.surfaceMuted,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          p.id === 'p-2'
                            ? 'phone-portrait-outline'
                            : p.id === 'p-3'
                            ? 'watch-outline'
                            : 'card-outline'
                        }
                        size={20}
                        color={colors.info}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.payerSimTitle, { color: colors.text }]}
                        >
                          {p.label}
                        </Text>
                        <Text
                          style={[
                            styles.payerSimHint,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {p.customerName} • {p.hint}
                        </Text>
                      </View>
                      <Ionicons
                        name="wifi"
                        size={18}
                        color={colors.info}
                      />
                    </Pressable>
                  ))}

                  <Pressable
                    onPress={() => setTerminalActive(false)}
                    style={styles.cancelReaderBtn}
                  >
                    <Text
                      style={[
                        styles.cancelReaderText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Edit Amount / Cancel Reader
                    </Text>
                  </Pressable>
                </View>
              )}

              {receiveStage === 'approved' && latestTx && (
                <View style={styles.postApprovalRow}>
                  <Pressable
                    onPress={() => setReceiptTx(latestTx)}
                    style={[
                      styles.popButton,
                      { backgroundColor: colors.primarySoft },
                    ]}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={17}
                      color={colors.primary}
                    />
                    <Text
                      style={[styles.popButtonText, { color: colors.primary }]}
                    >
                      Customer POP Receipt
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setTerminalActive(false);
                      setLatestTx(null);
                      setReceiveRef('');
                    }}
                    style={[
                      styles.newTapBtn,
                      {
                        backgroundColor: colors.surfaceMuted,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.newTapBtnText, { color: colors.text }]}
                    >
                      New Sale
                    </Text>
                  </Pressable>
                </View>
              )}
            </GlassPanel>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <PinAuthModal
        visible={pinModalOpen}
        amount={activePayAmount}
        title="Verify Contactless PIN"
        reason={`Payments above ${formatZAR(
          nfcSettings.pinlessLimit
        )} require your 5-digit SA Bank PIN or Biometrics`}
        onCancel={() => setPinModalOpen(false)}
        onSuccess={() => {
          setPinModalOpen(false);
          runTapPayHandshake(true);
        }}
      />

      <ReceiptModal
        transaction={receiptTx}
        onClose={() => setReceiptTx(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 34,
  },
  segmentedWrap: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: 12,
  },
  segmentTabText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  activeBankBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  activeBankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  bankDot: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankDotText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12.5,
  },
  activeBankLabel: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  activeBankBal: {
    fontSize: 11.5,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  swapChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  swapChipText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  modeBody: {
    gap: 14,
  },
  radarCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
  },
  enclavePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  enclavePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  stageHeadline: {
    fontSize: 32,
    fontWeight: '800',
    marginTop: 10,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  refSubtag: {
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
  stageSubline: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 5,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  pinNoticeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pinNoticeText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  errorBanner: {
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 10,
  },
  tapTriggerBtn: {
    marginTop: 18,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 15,
    borderRadius: 16,
  },
  tapTriggerBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  postApprovalRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    width: '100%',
  },
  popButton: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
  },
  popButtonText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  newTapBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  newTapBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  scenarioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  customToggleLink: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  customBox: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  customLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  customInput: {
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
  },
  merchantGrid: {
    gap: 9,
  },
  merchantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  merchantIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantName: {
    fontSize: 14,
    fontWeight: '700',
  },
  merchantBranch: {
    fontSize: 11.5,
    marginTop: 2,
  },
  merchantAmount: {
    fontSize: 14.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  pinMiniTag: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  softPosSetupCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    alignItems: 'center',
  },
  softPosTag: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  softPosAmount: {
    fontSize: 38,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  softPosFeeNote: {
    fontSize: 11.5,
    marginTop: 3,
    marginBottom: 12,
    textAlign: 'center',
  },
  quickReceiveRow: {
    flexDirection: 'row',
    gap: 7,
    width: '100%',
    marginBottom: 12,
  },
  quickChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  refInput: {
    width: '100%',
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 13.5,
    marginBottom: 12,
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    rowGap: 9,
  },
  padKey: {
    width: '31.5%',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  padKeyText: {
    fontSize: 21,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  activateTerminalBtn: {
    marginTop: 14,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 16,
  },
  activateTerminalText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  terminalTopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  terminalTopText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  payerSimBlock: {
    width: '100%',
    marginTop: 18,
    gap: 9,
  },
  payerSimHeading: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  payerSimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 13,
    borderRadius: 15,
    borderWidth: 1,
  },
  payerSimTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  payerSimHint: {
    fontSize: 11.5,
    marginTop: 1,
  },
  cancelReaderBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelReaderText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
