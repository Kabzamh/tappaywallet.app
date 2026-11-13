import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Line, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinkedBankAccount, SABankId } from '../types';
import { SA_BANKS } from '../data/saBanks';
import { formatZAR, maskAccountNumber, triggerHaptic } from '../utils/format';
import { CardGlassSheen } from './GlassUI';

const SA_SWIFT_CODES: Record<SABankId, string> = {
  fnb: 'FIRNZAJJ',
  capitec: 'CABLZAJJ',
  standard: 'SBZAZAJJ',
  absa: 'ABSAZAJJ',
  nedbank: 'NEDSZAJJ',
  discovery: 'DISCZAJJ',
  tymebank: 'CBZAZAJJ',
};

const SA_BIN_PREFIXES: Record<SABankId, string> = {
  fnb: '4539 78',
  capitec: '5399 41',
  standard: '5221 60',
  absa: '4038 22',
  nedbank: '5196 18',
  discovery: '4790 88',
  tymebank: '5338 90',
};

const SA_HELPLINES: Record<SABankId, string> = {
  fnb: '087 575 9404',
  capitec: '0860 10 20 43',
  standard: '0800 020 600',
  absa: '0800 111 155',
  nedbank: '0800 110 929',
  discovery: '0800 07 96 97',
  tymebank: '0860 999 119',
};

interface BankCardViewProps {
  account: LinkedBankAccount;
  hideBalance?: boolean;
  restrictBalance?: boolean;
  onToggleHideBalance?: () => void;
  onSwitchAccount?: () => void;
  showSwitchPill?: boolean;
  compact?: boolean;
}

export function BankCardView({
  account,
  hideBalance = false,
  restrictBalance = false,
  onToggleHideBalance,
  onSwitchAccount,
  showSwitchPill = false,
  compact = false,
}: BankCardViewProps) {
  const bank = SA_BANKS[account.bankId];
  const [isFlipped, setIsFlipped] = useState(false);
  const [showCvv, setShowCvv] = useState(false);
  const [copiedAcc, setCopiedAcc] = useState(false);

  const flipProgress = useSharedValue(0);

  const handleFlip = () => {
    triggerHaptic('medium');
    const nextFlipped = !isFlipped;
    flipProgress.value = withTiming(0.5, {
      duration: 190,
      easing: Easing.in(Easing.quad),
    });
    setTimeout(() => {
      setIsFlipped(nextFlipped);
      flipProgress.value = withTiming(nextFlipped ? 1 : 0, {
        duration: 210,
        easing: Easing.out(Easing.quad),
      });
    }, 190);
  };

  const last4 = account.accountNumber.slice(-4);
  const binPrefix = SA_BIN_PREFIXES[account.bankId];
  const embossedPan = `${binPrefix}••  ••••  ${last4}`;
  const fullVirtualPan = `${binPrefix}${account.accountNumber.slice(
    2,
    4
  )}  ${account.accountNumber.slice(4, 8)}  ${last4}`;

  const dynamicCvv = String(((Number(last4) * 7 + 319) % 899) + 100);
  const formattedFullAccount = account.accountNumber.replace(
    /(\d{4})(\d{4})(\d+)/,
    '$1 $2 $3'
  );

  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 0.5], [0, 90], 'clamp');
    return {
      opacity: flipProgress.value < 0.5 ? 1 : 0,
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(
      flipProgress.value,
      [0.5, 1],
      [-90, 0],
      'clamp'
    );
    return {
      opacity: flipProgress.value >= 0.5 ? 1 : 0,
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
    };
  });

  return (
    <View style={styles.flipContainer}>
      {!isFlipped ? (
        /* ==================== FRONT OF CARD ==================== */
        <Animated.View style={frontAnimatedStyle}>
        <LinearGradient
          colors={bank.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, compact && styles.cardCompact]}
        >
          <CardGlassSheen />
          <View style={styles.decorCircleLarge} pointerEvents="none" />
          <View style={styles.decorCircleSmall} pointerEvents="none" />

          {/* Top Row: SA Bank Identity + Flip Button */}
          <View style={styles.topRow}>
            <View style={styles.bankBrandRow}>
              <View
                style={[
                  styles.bankMonogram,
                  { backgroundColor: 'rgba(255,255,255,0.18)' },
                ]}
              >
                <Text style={styles.bankMonogramText}>
                  {bank.shortName.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text numberOfLines={1} style={styles.bankName}>
                  {bank.name}
                </Text>
                <Text style={styles.branchText}>
                  {account.accountType} • Branch {account.branchCode}
                </Text>
              </View>
            </View>

            <View style={styles.topRightPills}>
              <Pressable
                onPress={handleFlip}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.flipBtn,
                  pressed && { opacity: 0.82 },
                ]}
              >
                <Ionicons name="sync-outline" size={14} color="#FFFFFF" />
                <Text style={styles.flipBtnText}>Flip Card</Text>
              </Pressable>
            </View>
          </View>

          {/* Middle Section: Physical Card Chip + Contactless OR Balance (when not restricted) */}
          <Pressable
            onPress={handleFlip}
            style={[styles.middleSection, compact && { marginVertical: 12 }]}
          >
            <View style={styles.chipAndWavesRow}>
              <EmvChipSvg />
              <ContactlessWavesSvg size={22} color="rgba(255,255,255,0.88)" />
              <View
                style={[
                  styles.nfcInlineBadge,
                  !account.nfcEnabled && styles.nfcInlinePaused,
                ]}
              >
                <Text style={styles.nfcInlineText}>
                  {account.nfcEnabled ? 'HCE DIRECT READY' : 'NFC PAUSED'}
                </Text>
              </View>
            </View>

            {restrictBalance ? (
              <View style={styles.embossedBlock}>
                <Text style={styles.embossedPanText}>{embossedPan}</Text>
                <View style={styles.restrictedPrivacyRow}>
                  <Ionicons
                    name="lock-closed"
                    size={11}
                    color="rgba(167, 243, 208, 0.9)"
                  />
                  <Text style={styles.restrictedPrivacyText}>
                    Balance hidden on Home for POS privacy • Tap card to flip
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.unrestrictedBalBlock}>
                <View style={styles.balanceLabelRow}>
                  <Text style={styles.balanceLabel}>AVAILABLE BANK BALANCE</Text>
                  {onToggleHideBalance && (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        onToggleHideBalance();
                      }}
                      hitSlop={10}
                      style={styles.eyeButton}
                    >
                      <Ionicons
                        name={hideBalance ? 'eye-off-outline' : 'eye-outline'}
                        size={16}
                        color="rgba(255,255,255,0.82)"
                      />
                    </Pressable>
                  )}
                </View>
                <Text
                  style={[styles.balanceValue, compact && { fontSize: 23 }]}
                >
                  {hideBalance ? 'R ••••••••' : formatZAR(account.balance)}
                </Text>
              </View>
            )}
          </Pressable>

          {/* Bottom Row: Cardholder, Valid Thru, Switcher / Card Scheme */}
          <View style={styles.bottomRow}>
            <Pressable onPress={handleFlip} style={styles.holderAndValidRow}>
              <View>
                <Text style={styles.microCaption}>CARDHOLDER</Text>
                <Text style={styles.holderName}>{account.accountHolder}</Text>
              </View>
              <View style={{ marginLeft: 18 }}>
                <Text style={styles.microCaption}>VALID THRU</Text>
                <Text style={styles.validThruVal}>08/29</Text>
              </View>
              {!restrictBalance && (
                <View style={{ marginLeft: 16 }}>
                  <Text style={styles.microCaption}>ACCOUNT</Text>
                  <Text style={styles.validThruVal}>
                    {maskAccountNumber(account.accountNumber)}
                  </Text>
                </View>
              )}
            </Pressable>

            <View style={styles.bottomRightCluster}>
              {showSwitchPill && onSwitchAccount ? (
                <Pressable
                  onPress={onSwitchAccount}
                  style={({ pressed }) => [
                    styles.switchButton,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Ionicons name="swap-horizontal" size={13} color="#FFFFFF" />
                  <Text style={styles.switchButtonText}>Switch</Text>
                </Pressable>
              ) : null}
              <CardSchemeMarkSvg isVisa={binPrefix.startsWith('4')} />
            </View>
          </View>
        </LinearGradient>
        </Animated.View>
      ) : (
        /* ==================== BACK OF CARD ==================== */
        <Animated.View style={backAnimatedStyle}>
        <LinearGradient
          colors={[bank.gradient[2], bank.gradient[1], '#060C17']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.cardBack, compact && styles.cardBackCompact]}
        >
          <CardGlassSheen />

          {/* Authentic Brushed Obsidian Magnetic Stripe */}
          <View style={styles.magStripe} />

          <View style={styles.backInnerContent}>
            {/* Authorized Signature Panel + Dynamic 3-Digit CVV + Security Hologram */}
            <View style={styles.sigLabelRow}>
              <Text style={styles.authorizedSigCaption}>
                AUTHORIZED SIGNATURE — NOT VALID UNLESS SIGNED
              </Text>
              <Text style={styles.authorizedSigCaption}>SECURITY CODE</Text>
            </View>

            <View style={styles.sigAndHoloRow}>
              <View style={styles.signatureStrip}>
                <View style={styles.sigLinesOverlay} pointerEvents="none" />
                <Text style={styles.sigScriptText}>{account.accountHolder}</Text>
                <Pressable
                  onPress={() => {
                    triggerHaptic('light');
                    setShowCvv((v) => !v);
                  }}
                  style={styles.cvvBox}
                >
                  <Text style={styles.cvvLabel}>CVV</Text>
                  <Text style={styles.cvvDigits}>
                    {showCvv ? dynamicCvv : '•••'}
                  </Text>
                  <Ionicons
                    name={showCvv ? 'eye-off-outline' : 'eye-outline'}
                    size={13}
                    color="#0F172A"
                  />
                </Pressable>
              </View>

              <View style={styles.hologramBadge}>
                <HologramSvg />
              </View>
            </View>

            {/* Full Virtual Card / Bank Account & Universal Branch / SWIFT */}
            <View style={styles.backDetailsGrid}>
              <Pressable
                onPress={() => {
                  triggerHaptic('light');
                  setCopiedAcc(true);
                  setTimeout(() => setCopiedAcc(false), 2000);
                }}
                style={styles.backDetailCol}
              >
                <Text style={styles.backMetaLabel}>
                  SA ACCOUNT NO {copiedAcc ? '• COPIED!' : '(TAP TO COPY)'}
                </Text>
                <Text style={styles.backMetaValue}>{formattedFullAccount}</Text>
                <Text style={styles.backSubTokenText}>
                  Token PAN: {fullVirtualPan}
                </Text>
              </Pressable>

              <View style={styles.backDetailColRight}>
                <Text style={styles.backMetaLabel}>BRANCH / SWIFT</Text>
                <Text style={styles.backMetaValue}>
                  {account.branchCode} • {SA_SWIFT_CODES[account.bankId]}
                </Text>
                <Text style={styles.backSubTokenText}>{account.shapId}</Text>
              </View>
            </View>

            {/* Footer Helpline + Flip to Front Button */}
            <View style={styles.backFooterRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.helplineText}>
                  24h SA Lost Card Line: {SA_HELPLINES[account.bankId]}
                </Text>
                <Text style={styles.mandateSmallText}>
                  Issued under SARB NPS • Mandate {account.mandateRef}
                </Text>
              </View>

              <Pressable
                onPress={handleFlip}
                style={({ pressed }) => [
                  styles.flipBackBtn,
                  pressed && { opacity: 0.82 },
                ]}
              >
                <Ionicons name="sync-outline" size={14} color="#FFFFFF" />
                <Text style={styles.flipBackBtnText}>Flip to Front</Text>
              </Pressable>
            </View>
          </View>
        </LinearGradient>
        </Animated.View>
      )}
    </View>
  );
}

function CardSchemeMarkSvg({ isVisa }: { isVisa: boolean }) {
  if (isVisa) {
    return (
      <View style={styles.visaMarkWrap}>
        <Text style={styles.visaMarkText}>VISA</Text>
        <Text style={styles.visaSubText}>DEBIT</Text>
      </View>
    );
  }
  return (
    <Svg width={38} height={24} viewBox="0 0 38 24">
      <Circle cx="14" cy="12" r="10" fill="#EB001B" fillOpacity="0.9" />
      <Circle cx="24" cy="12" r="10" fill="#F79E1B" fillOpacity="0.88" />
    </Svg>
  );
}

function HologramSvg() {
  return (
    <Svg width={38} height={30} viewBox="0 0 38 30">
      <Rect
        x="1"
        y="1"
        width="36"
        height="28"
        rx="6"
        fill="rgba(167, 243, 208, 0.24)"
        stroke="rgba(255,255,255,0.48)"
        strokeWidth="1"
      />
      <Circle cx="15" cy="15" r="7.5" fill="rgba(56, 189, 248, 0.48)" />
      <Circle cx="23" cy="15" r="7.5" fill="rgba(52, 211, 153, 0.48)" />
    </Svg>
  );
}

export function EmvChipSvg() {
  return (
    <Svg width={42} height={31} viewBox="0 0 42 31">
      <Rect
        x="1"
        y="1"
        width="40"
        height="29"
        rx="5.5"
        fill="#E5C168"
        stroke="rgba(255,255,255,0.42)"
        strokeWidth="1"
      />
      <Line x1="15" y1="1" x2="15" y2="30" stroke="#9C7A2B" strokeWidth="1.1" />
      <Line x1="27" y1="1" x2="27" y2="30" stroke="#9C7A2B" strokeWidth="1.1" />
      <Line x1="1" y1="11" x2="15" y2="11" stroke="#9C7A2B" strokeWidth="1.1" />
      <Line x1="1" y1="20" x2="15" y2="20" stroke="#9C7A2B" strokeWidth="1.1" />
      <Line x1="27" y1="11" x2="41" y2="11" stroke="#9C7A2B" strokeWidth="1.1" />
      <Line x1="27" y1="20" x2="41" y2="20" stroke="#9C7A2B" strokeWidth="1.1" />
    </Svg>
  );
}

export function ContactlessWavesSvg({
  size = 22,
  color = '#FFFFFF',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8.5 15.5C9.8 13.5 9.8 10.5 8.5 8.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path
        d="M12 17.5C14.1 14.2 14.1 9.8 12 6.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path
        d="M15.5 19.5C18.5 15 18.5 9 15.5 4.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  flipContainer: {
    position: 'relative',
  },
  hiddenFaceAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  card: {
    borderRadius: 22,
    padding: 20,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#040B16',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 8,
  },
  cardCompact: {
    padding: 16,
    borderRadius: 18,
  },
  cardBack: {
    borderRadius: 22,
    paddingTop: 16,
    paddingBottom: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#040B16',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 8,
  },
  cardBackCompact: {
    borderRadius: 18,
    paddingTop: 14,
    paddingBottom: 14,
  },
  magStripe: {
    width: '100%',
    height: 38,
    backgroundColor: '#05080F',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  backInnerContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  sigLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  authorizedSigCaption: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sigAndHoloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  signatureStrip: {
    flex: 1,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  sigLinesOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 12,
    height: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  sigScriptText: {
    color: '#334155',
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  cvvBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  cvvLabel: {
    color: '#64748B',
    fontSize: 9.5,
    fontWeight: '800',
  },
  cvvDigits: {
    color: '#0F172A',
    fontSize: 12.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  hologramBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  backDetailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
  },
  backDetailCol: {
    flex: 1,
  },
  backDetailColRight: {
    alignItems: 'flex-end',
  },
  backMetaLabel: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  backMetaValue: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  backSubTokenText: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 10,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  backFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 11,
    gap: 8,
  },
  helplineText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  mandateSmallText: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 9.5,
    marginTop: 1,
  },
  flipBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  flipBackBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  decorCircleLarge: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -75,
    right: -55,
  },
  decorCircleSmall: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: -45,
    left: -30,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  bankBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  topRightPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bankMonogram: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  bankMonogramText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  bankName: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  branchText: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 11,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  flipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  flipBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  middleSection: {
    marginVertical: 16,
  },
  chipAndWavesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nfcInlineBadge: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(16, 185, 129, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(167, 243, 208, 0.38)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  nfcInlinePaused: {
    backgroundColor: 'rgba(239, 68, 68, 0.32)',
    borderColor: 'rgba(254, 202, 202, 0.4)',
  },
  nfcInlineText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  embossedBlock: {
    marginTop: 14,
  },
  embossedPanText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2.1,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.42)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  restrictedPrivacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },
  restrictedPrivacyText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10.5,
    fontWeight: '600',
  },
  unrestrictedBalBlock: {
    marginTop: 12,
  },
  balanceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  eyeButton: {
    padding: 2,
  },
  balanceValue: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  holderAndValidRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  microCaption: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  holderName: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  validThruVal: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  bottomRightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  switchButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  visaMarkWrap: {
    alignItems: 'flex-end',
  },
  visaMarkText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontStyle: 'italic',
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  visaSubText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: -2,
  },
});
