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
import {
  Transaction,
  TAPPAY_WALLET_ID,
  VasServiceType,
} from '../types';
import { useAppTheme, getGlassStyle } from '../theme/colors';
import { useTapPay } from '../context/TapPayContext';
import {
  SA_BANKS,
  SA_MOBILE_NETWORKS,
  SA_DATA_BUNDLES,
  SA_VOICE_SMS_BUNDLES,
  SA_ELECTRICITY_VENDORS,
  SA_MUNICIPALITIES,
} from '../data/saBanks';
import { formatZAR, maskAccountNumber, triggerHaptic } from '../utils/format';

interface VasServicesModalProps {
  visible: boolean;
  initialService?: VasServiceType;
  preferWalletSource?: boolean;
  restrictBalances?: boolean;
  onClose: () => void;
  onCompleted: (tx: Transaction) => void;
}

export function VasServicesModal({
  visible,
  initialService = 'data',
  preferWalletSource = false,
  restrictBalances = false,
  onClose,
  onCompleted,
}: VasServicesModalProps) {
  const { colors } = useAppTheme();
  const {
    wallet,
    accounts,
    activeNfcSourceId,
    executeVasPurchase,
    nfcSettings,
  } = useTapPay();

  const [service, setService] = useState<VasServiceType>(initialService);
  const [selectedSourceId, setSelectedSourceId] = useState(activeNfcSourceId);

  // Mobile Data & Airtime
  const [selectedNetwork, setSelectedNetwork] = useState(
    SA_MOBILE_NETWORKS[0]
  );
  const [phoneNumber, setPhoneNumber] = useState('0824917732');
  const [selectedBundle, setSelectedBundle] = useState(SA_DATA_BUNDLES[1]);
  const [selectedVoiceBundle, setSelectedVoiceBundle] = useState(
    SA_VOICE_SMS_BUNDLES[0]
  );
  const [airtimeAmountStr, setAirtimeAmountStr] = useState('55');

  // Electricity
  const [selectedElecVendor, setSelectedElecVendor] = useState(
    SA_ELECTRICITY_VENDORS[1]
  );
  const [meterNumber, setMeterNumber] = useState('04218890412');
  const [elecAmountStr, setElecAmountStr] = useState('250');

  // Municipal Accounts
  const [selectedMunicipality, setSelectedMunicipality] = useState(
    SA_MUNICIPALITIES[0]
  );
  const [municipalAccNo, setMunicipalAccNo] = useState(
    SA_MUNICIPALITIES[0].sampleAcc
  );
  const [municipalAmountStr, setMunicipalAmountStr] = useState(
    SA_MUNICIPALITIES[0].sampleDue.toFixed(2)
  );

  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (visible) {
      setService(initialService);
      setSelectedSourceId(
        preferWalletSource ? TAPPAY_WALLET_ID : activeNfcSourceId
      );
      setErrorMsg('');
    }
  }, [visible, initialService, preferWalletSource, activeNfcSourceId]);

  const isFromWallet = selectedSourceId === TAPPAY_WALLET_ID;
  const maskBal = restrictBalances || nfcSettings.hideBalances;

  const currentAmount =
    service === 'data'
      ? selectedBundle.amount
      : service === 'bundles'
      ? selectedVoiceBundle.amount
      : service === 'airtime'
      ? parseFloat(airtimeAmountStr) || 0
      : service === 'electricity'
      ? parseFloat(elecAmountStr) || 0
      : parseFloat(municipalAmountStr) || 0;

  const estimatedKwh =
    service === 'electricity' && currentAmount > 0
      ? (currentAmount / 3.42).toFixed(1)
      : '0.0';

  const handleSelectMunicipality = (muni: (typeof SA_MUNICIPALITIES)[0]) => {
    triggerHaptic('light', nfcSettings.hapticsEnabled);
    setSelectedMunicipality(muni);
    setMunicipalAccNo(muni.sampleAcc);
    setMunicipalAmountStr(muni.sampleDue.toFixed(2));
    setErrorMsg('');
  };

  const handleConfirmPurchase = () => {
    setErrorMsg('');

    if (service === 'data' || service === 'airtime' || service === 'bundles') {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        setErrorMsg('Enter a valid 10-digit South African mobile number.');
        triggerHaptic('error', nfcSettings.hapticsEnabled);
        return;
      }
      if (currentAmount < 5) {
        setErrorMsg('Minimum prepaid purchase is R 5.00.');
        return;
      }

      const res = executeVasPurchase({
        serviceType: service,
        providerName: selectedNetwork.name,
        targetIdentifier: cleanPhone,
        productDescription:
          service === 'data'
            ? selectedBundle.label
            : service === 'bundles'
            ? selectedVoiceBundle.label
            : 'Pinless Airtime',
        amount: currentAmount,
        accountId: selectedSourceId,
      });

      if (!res.ok || !res.tx) {
        setErrorMsg(res.error || 'Unable to complete purchase.');
        triggerHaptic('error', nfcSettings.hapticsEnabled);
        return;
      }
      onClose();
      onCompleted(res.tx);
      return;
    }

    if (service === 'electricity') {
      const cleanMeter = meterNumber.replace(/\D/g, '');
      if (cleanMeter.length < 11) {
        setErrorMsg('Enter a valid 11-digit STS prepaid electricity meter #.');
        triggerHaptic('error', nfcSettings.hapticsEnabled);
        return;
      }
      if (currentAmount < 20) {
        setErrorMsg('Minimum STS electricity purchase is R 20.00.');
        return;
      }

      const res = executeVasPurchase({
        serviceType: 'electricity',
        providerName: selectedElecVendor,
        targetIdentifier: cleanMeter,
        productDescription: 'STS Prepaid Electricity',
        amount: currentAmount,
        accountId: selectedSourceId,
      });

      if (!res.ok || !res.tx) {
        setErrorMsg(res.error || 'Unable to vend electricity token.');
        triggerHaptic('error', nfcSettings.hapticsEnabled);
        return;
      }
      onClose();
      onCompleted(res.tx);
      return;
    }

    // Municipal Account Payment
    const cleanMuniAcc = municipalAccNo.trim();
    if (cleanMuniAcc.length < 6) {
      setErrorMsg('Enter a valid Municipal Rates / Utility Account number.');
      triggerHaptic('error', nfcSettings.hapticsEnabled);
      return;
    }
    if (currentAmount <= 0) {
      setErrorMsg('Enter a payment amount greater than R 0.00.');
      return;
    }

    const res = executeVasPurchase({
      serviceType: 'municipal',
      providerName: selectedMunicipality.name,
      targetIdentifier: cleanMuniAcc,
      productDescription: selectedMunicipality.type,
      amount: currentAmount,
      accountId: selectedSourceId,
    });

    if (!res.ok || !res.tx) {
      setErrorMsg(res.error || 'Unable to settle municipal bill.');
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
            <View>
              <Text style={[styles.title, { color: colors.text }]}>
                Prepaid & Municipal Bills
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Pay via TapPay Wallet or Linked SA Bank
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* 4-Tab Service Selector */}
          <View
            style={[
              styles.serviceTabs,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
              },
            ]}
          >
            {(
              [
                { id: 'data', label: 'Data', icon: 'cellular-outline' },
                { id: 'airtime', label: 'Airtime', icon: 'call-outline' },
                {
                  id: 'bundles',
                  label: 'Voice/SMS',
                  icon: 'chatbubble-ellipses-outline',
                },
                { id: 'electricity', label: 'Power', icon: 'flash-outline' },
                { id: 'municipal', label: 'Municipal', icon: 'business-outline' },
              ] as { id: VasServiceType; label: string; icon: string }[]
            ).map((tab) => {
              const active = service === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => {
                    triggerHaptic('light', nfcSettings.hapticsEnabled);
                    setService(tab.id);
                    setErrorMsg('');
                  }}
                  style={[
                    styles.serviceTabBtn,
                    active && { backgroundColor: colors.primary },
                  ]}
                >
                  <Ionicons
                    name={tab.icon as any}
                    size={15}
                    color={active ? '#FFFFFF' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.serviceTabText,
                      { color: active ? '#FFFFFF' : colors.textSecondary },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Funding Source Selector: TapPay Wallet OR Linked SA Bank */}
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              PAY FROM WALLET OR BANK
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sourcePillsRow}
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
                  TapPay Wallet •• {wallet.walletNumber.slice(-4)}
                </Text>
                <Text
                  style={[
                    styles.sourcePillBal,
                    { color: colors.textSecondary },
                  ]}
                >
                  {maskBal ? 'Balance Protected' : formatZAR(wallet.balance)}
                </Text>
              </Pressable>

              {accounts.map((acc) => {
                const selected = acc.id === selectedSourceId;
                const b = SA_BANKS[acc.bankId];
                return (
                  <Pressable
                    key={acc.id}
                    onPress={() => setSelectedSourceId(acc.id)}
                    style={[
                      styles.sourcePill,
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
                        styles.sourcePillTitle,
                        { color: selected ? colors.primary : colors.text },
                      ]}
                    >
                      {b.shortName} {maskAccountNumber(acc.accountNumber)}
                    </Text>
                    <Text
                      style={[
                        styles.sourcePillBal,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {maskBal ? `Branch ${acc.branchCode}` : formatZAR(acc.balance)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* ==================== DATA, AIRTIME & VOICE/SMS BUNDLES ==================== */}
            {(service === 'data' ||
              service === 'airtime' ||
              service === 'bundles') && (
              <View style={{ marginTop: 14 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  SA MOBILE NETWORK
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.networkRow}
                >
                  {(service === 'airtime' || service === 'bundles'
                    ? SA_MOBILE_NETWORKS.filter((n) => n.id !== 'rain')
                    : SA_MOBILE_NETWORKS
                  ).map((net) => {
                    const active = selectedNetwork.id === net.id;
                    return (
                      <Pressable
                        key={net.id}
                        onPress={() => setSelectedNetwork(net)}
                        style={[
                          styles.netChip,
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
                        <View
                          style={[
                            styles.netColorDot,
                            { backgroundColor: net.color },
                          ]}
                        />
                        <Text
                          style={[
                            styles.netChipText,
                            { color: active ? colors.primary : colors.text },
                          ]}
                        >
                          {net.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <View style={styles.rowBetween}>
                  <Text
                    style={[
                      styles.label,
                      { color: colors.textSecondary, marginTop: 14 },
                    ]}
                  >
                    SA CELLPHONE NUMBER
                  </Text>
                  <Pressable onPress={() => setPhoneNumber('0824917732')}>
                    <Text
                      style={[
                        styles.helperLink,
                        { color: colors.primary, marginTop: 14 },
                      ]}
                    >
                      My Number
                    </Text>
                  </Pressable>
                </View>
                <TextInput
                  value={phoneNumber}
                  onChangeText={(t) => {
                    setPhoneNumber(t.replace(/\D/g, ''));
                    setErrorMsg('');
                  }}
                  keyboardType="phone-pad"
                  maxLength={10}
                  placeholder="082 491 7732"
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

                {service === 'data' || service === 'bundles' ? (
                  <>
                    <Text
                      style={[
                        styles.label,
                        { color: colors.textSecondary, marginTop: 14 },
                      ]}
                    >
                      {service === 'data'
                        ? 'SELECT DATA BUNDLE'
                        : 'SELECT VOICE / SMS / SOCIAL BUNDLE'}
                    </Text>
                    <View style={styles.bundleList}>
                      {(service === 'data'
                        ? SA_DATA_BUNDLES
                        : SA_VOICE_SMS_BUNDLES
                      ).map((b) => {
                        const active =
                          service === 'data'
                            ? selectedBundle.id === b.id
                            : selectedVoiceBundle.id === b.id;
                        return (
                          <Pressable
                            key={b.id}
                            onPress={() =>
                              service === 'data'
                                ? setSelectedBundle(b)
                                : setSelectedVoiceBundle(b)
                            }
                            style={[
                              styles.bundleRow,
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
                                styles.bundleLabel,
                                { color: colors.text },
                              ]}
                            >
                              {b.label}
                            </Text>
                            <Text
                              style={[
                                styles.bundlePrice,
                                {
                                  color: active ? colors.primary : colors.text,
                                },
                              ]}
                            >
                              {formatZAR(b.amount)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <>
                    <Text
                      style={[
                        styles.label,
                        { color: colors.textSecondary, marginTop: 14 },
                      ]}
                    >
                      AIRTIME AMOUNT (ZAR)
                    </Text>
                    <View style={styles.presetsGrid}>
                      {[15, 30, 55, 110, 250].map((v) => {
                        const active = Number(airtimeAmountStr) === v;
                        return (
                          <Pressable
                            key={v}
                            onPress={() => setAirtimeAmountStr(String(v))}
                            style={[
                              styles.presetChip,
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
                                styles.presetChipText,
                                { color: active ? '#FFFFFF' : colors.text },
                              ]}
                            >
                              R {v}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <TextInput
                      value={airtimeAmountStr}
                      onChangeText={(t) =>
                        setAirtimeAmountStr(t.replace(/[^0-9.]/g, ''))
                      }
                      keyboardType="decimal-pad"
                      placeholder="Custom ZAR amount"
                      placeholderTextColor={colors.textMuted}
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.surfaceMuted,
                          color: colors.text,
                          borderColor: colors.border,
                          marginTop: 8,
                        },
                      ]}
                    />
                  </>
                )}
              </View>
            )}

            {/* ==================== PREPAID ELECTRICITY ==================== */}
            {service === 'electricity' && (
              <View style={{ marginTop: 14 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  SUPPLY AUTHORITY / UTILITY
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.networkRow}
                >
                  {SA_ELECTRICITY_VENDORS.map((vendor) => {
                    const active = selectedElecVendor === vendor;
                    return (
                      <Pressable
                        key={vendor}
                        onPress={() => setSelectedElecVendor(vendor)}
                        style={[
                          styles.netChip,
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
                          name="flash"
                          size={13}
                          color={active ? colors.primary : colors.gold}
                        />
                        <Text
                          style={[
                            styles.netChipText,
                            { color: active ? colors.primary : colors.text },
                          ]}
                        >
                          {vendor}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Text
                  style={[
                    styles.label,
                    { color: colors.textSecondary, marginTop: 14 },
                  ]}
                >
                  11-DIGIT STS PREPAID METER NUMBER
                </Text>
                <TextInput
                  value={meterNumber}
                  onChangeText={(t) => {
                    setMeterNumber(t.replace(/\D/g, ''));
                    setErrorMsg('');
                  }}
                  keyboardType="number-pad"
                  maxLength={11}
                  placeholder="04218890412"
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

                <Text
                  style={[
                    styles.label,
                    { color: colors.textSecondary, marginTop: 14 },
                  ]}
                >
                  ELECTRICITY VOUCHER AMOUNT (ZAR)
                </Text>
                <View style={styles.presetsGrid}>
                  {[100, 250, 500, 1000].map((v) => {
                    const active = Number(elecAmountStr) === v;
                    return (
                      <Pressable
                        key={v}
                        onPress={() => setElecAmountStr(String(v))}
                        style={[
                          styles.presetChip,
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
                            styles.presetChipText,
                            { color: active ? '#FFFFFF' : colors.text },
                          ]}
                        >
                          R {v}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  value={elecAmountStr}
                  onChangeText={(t) =>
                    setElecAmountStr(t.replace(/[^0-9.]/g, ''))
                  }
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surfaceMuted,
                      color: colors.text,
                      borderColor: colors.border,
                      marginTop: 8,
                    },
                  ]}
                />

                <View
                  style={[
                    styles.kwhPreview,
                    {
                      backgroundColor: colors.goldSoft,
                      borderColor: colors.gold,
                    },
                  ]}
                >
                  <Ionicons name="flash" size={17} color={colors.gold} />
                  <Text style={[styles.kwhPreviewText, { color: colors.text }]}>
                    Est. Units: <Text style={{ fontWeight: '800' }}>{estimatedKwh} kWh</Text> • Instant 20-Digit STS Token on POP
                  </Text>
                </View>
              </View>
            )}

            {/* ==================== MUNICIPAL ACCOUNTS ==================== */}
            {service === 'municipal' && (
              <View style={{ marginTop: 14 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  SOUTH AFRICAN MUNICIPALITY
                </Text>
                <View style={styles.bundleList}>
                  {SA_MUNICIPALITIES.map((muni) => {
                    const active = selectedMunicipality.id === muni.id;
                    return (
                      <Pressable
                        key={muni.id}
                        onPress={() => handleSelectMunicipality(muni)}
                        style={[
                          styles.bundleRow,
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
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[styles.bundleLabel, { color: colors.text }]}
                          >
                            {muni.name}
                          </Text>
                          <Text
                            style={[
                              styles.muniTypeSub,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {muni.type}
                          </Text>
                        </View>
                        {active && (
                          <Ionicons
                            name="checkmark-circle"
                            size={19}
                            color={colors.primary}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                <Text
                  style={[
                    styles.label,
                    { color: colors.textSecondary, marginTop: 14 },
                  ]}
                >
                  MUNICIPAL ACCOUNT / RATES REFERENCE #
                </Text>
                <TextInput
                  value={municipalAccNo}
                  onChangeText={(t) => {
                    setMunicipalAccNo(t);
                    setErrorMsg('');
                  }}
                  keyboardType="number-pad"
                  placeholder="e.g. 550918442"
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

                <View style={styles.rowBetween}>
                  <Text
                    style={[
                      styles.label,
                      { color: colors.textSecondary, marginTop: 14 },
                    ]}
                  >
                    PAYMENT AMOUNT (ZAR)
                  </Text>
                  <Pressable
                    onPress={() =>
                      setMunicipalAmountStr(
                        selectedMunicipality.sampleDue.toFixed(2)
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.helperLink,
                        { color: colors.primary, marginTop: 14 },
                      ]}
                    >
                      Statement Due ({formatZAR(selectedMunicipality.sampleDue)})
                    </Text>
                  </Pressable>
                </View>
                <TextInput
                  value={municipalAmountStr}
                  onChangeText={(t) =>
                    setMunicipalAmountStr(t.replace(/[^0-9.]/g, ''))
                  }
                  keyboardType="decimal-pad"
                  placeholder="0.00"
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

                <View
                  style={[
                    styles.feeBox,
                    { backgroundColor: colors.surfaceMuted },
                  ]}
                >
                  <Text
                    style={[styles.feeBoxLabel, { color: colors.textSecondary }]}
                  >
                    EasyPay / Municipal Clearing Fee
                  </Text>
                  <Text style={[styles.feeBoxVal, { color: colors.primary }]}>
                    {isFromWallet ? 'FREE (TapPay Wallet)' : 'R 2.00'}
                  </Text>
                </View>
              </View>
            )}

            {errorMsg ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>
                {errorMsg}
              </Text>
            ) : null}

            <Pressable
              onPress={handleConfirmPurchase}
              style={({ pressed }) => [
                styles.confirmBtn,
                {
                  backgroundColor: pressed
                    ? colors.primaryDark
                    : colors.primary,
                },
              ]}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={19}
                color="#FFFFFF"
              />
              <Text style={styles.confirmBtnText}>
                {currentAmount > 0
                  ? `Pay ${formatZAR(currentAmount)} via ${
                      isFromWallet ? 'TapPay Wallet' : 'Linked Bank'
                    }`
                  : 'Complete Payment'}
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
    paddingBottom: 34,
    maxHeight: '92%',
    borderTopWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  serviceTabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
    gap: 4,
  },
  serviceTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    borderRadius: 10,
  },
  serviceTabText: {
    fontSize: 12,
    fontWeight: '800',
  },
  label: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  sourcePillsRow: {
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
  sourcePillBal: {
    fontSize: 11.5,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  networkRow: {
    gap: 8,
  },
  netChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  netColorDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  netChipText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helperLink: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  input: {
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  bundleList: {
    gap: 8,
  },
  bundleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 13,
    borderWidth: 1,
  },
  bundleLabel: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  bundlePrice: {
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  muniTypeSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  presetsGrid: {
    flexDirection: 'row',
    gap: 7,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  presetChipText: {
    fontSize: 12.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  kwhPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  kwhPreviewText: {
    fontSize: 12,
    flex: 1,
  },
  feeBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 12,
  },
  feeBoxLabel: {
    fontSize: 12,
  },
  feeBoxVal: {
    fontSize: 12,
    fontWeight: '800',
  },
  errorText: {
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 10,
  },
  confirmBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 15,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
  },
});
