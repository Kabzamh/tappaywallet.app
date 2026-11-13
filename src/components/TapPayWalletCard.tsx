import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TapPayWallet, VasServiceType } from '../types';
import { ContactlessWavesSvg, EmvChipSvg } from './BankCardView';
import { CardGlassSheen } from './GlassUI';
import { formatZAR, triggerHaptic } from '../utils/format';

interface TapPayWalletCardProps {
  wallet: TapPayWallet;
  hideBalance?: boolean;
  restrictBalance?: boolean;
  onTopUp: () => void;
  onCashOut: () => void;
  onSelectForNfc?: () => void;
  onOpenVas?: (service: VasServiceType) => void;
  compact?: boolean;
}

export function TapPayWalletCard({
  wallet,
  hideBalance = false,
  restrictBalance = false,
  onTopUp,
  onCashOut,
  onSelectForNfc,
  onOpenVas,
  compact = false,
}: TapPayWalletCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [showVirtualCvv, setShowVirtualCvv] = useState(false);
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
    <View style={styles.flipWrap}>
      {!isFlipped ? (
        /* ==================== FRONT OF WALLET CARD ==================== */
        <Animated.View style={frontAnimatedStyle}>
        <LinearGradient
          colors={['#064E3B', '#065F46', '#0A1626']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, compact && styles.cardCompact]}
        >
          <CardGlassSheen />
          <View style={styles.glowOrb} pointerEvents="none" />

          {/* Top Row */}
          <View style={styles.topRow}>
            <View style={styles.brandRow}>
              <View style={styles.walletIconBox}>
                <Ionicons name="wallet" size={18} color="#34D399" />
              </View>
              <View style={{ flexShrink: 1 }}>
                <View style={styles.titleLine}>
                  <Text style={styles.walletTitle}>TapPay Wallet</Text>
                  <View style={styles.independentPill}>
                    <Text style={styles.independentPillText}>ZAR WALLET</Text>
                  </View>
                </View>
                <Text style={styles.walletMeta}>
                  Independent Account • {wallet.walletNumber}
                </Text>
              </View>
            </View>

            <View style={styles.topRightRow}>
              {onSelectForNfc && (
                <Pressable
                  onPress={onSelectForNfc}
                  style={({ pressed }) => [
                    styles.nfcBadge,
                    wallet.isPrimaryNfc && styles.nfcBadgeActive,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  {Platform.OS !== 'web' && (
                    <BlurView
                      pointerEvents="none"
                      intensity={24}
                      tint="light"
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <ContactlessWavesSvg size={13} color="#FFFFFF" />
                  <Text style={styles.nfcBadgeText}>
                    {wallet.isPrimaryNfc ? 'Primary' : 'NFC'}
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={handleFlip}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.flipBtn,
                  pressed && { opacity: 0.82 },
                ]}
              >
                <Ionicons name="sync-outline" size={13} color="#FFFFFF" />
                <Text style={styles.flipBtnText}>Flip Card</Text>
              </Pressable>
            </View>
          </View>

          {/* Middle Section: Physical/Virtual Card Face when Restricted on Home vs Balance in Banks */}
          <Pressable
            onPress={handleFlip}
            style={[styles.balanceBlock, compact && { marginVertical: 10 }]}
          >
            {restrictBalance ? (
              <View>
                <View style={styles.chipRow}>
                  <EmvChipSvg />
                  <ContactlessWavesSvg
                    size={20}
                    color="rgba(255,255,255,0.88)"
                  />
                  <Svg
                    width={34}
                    height={22}
                    viewBox="0 0 38 24"
                    style={{ marginLeft: 'auto' }}
                  >
                    <Circle
                      cx="14"
                      cy="12"
                      r="10"
                      fill="#EB001B"
                      fillOpacity="0.9"
                    />
                    <Circle
                      cx="24"
                      cy="12"
                      r="10"
                      fill="#F79E1B"
                      fillOpacity="0.88"
                    />
                  </Svg>
                </View>
                <Text style={styles.embossedWalletPan}>
                  5399  48••  ••••  {wallet.walletNumber.slice(-4)}
                </Text>
                <View style={styles.privacySubRow}>
                  <Ionicons
                    name="lock-closed"
                    size={11}
                    color="rgba(167, 243, 208, 0.9)"
                  />
                  <Text style={styles.capSub}>
                    Wallet balance restricted on Home • Tap card to flip
                  </Text>
                </View>
              </View>
            ) : (
              <View>
                <Text style={styles.balanceLabel}>AVAILABLE WALLET FUNDS</Text>
                <Text style={[styles.balanceVal, compact && { fontSize: 24 }]}>
                  {hideBalance ? 'R ••••••••' : formatZAR(wallet.balance)}
                </Text>
                <Text style={styles.capSub}>
                  ShapID: {wallet.shapId} • Tap card to flip
                </Text>
              </View>
            )}
          </Pressable>

          {/* Embedded Frosted Glass Wallet Prepaid & Municipal Strip */}
          {onOpenVas && (
            <View style={styles.walletVasStrip}>
              {Platform.OS !== 'web' && (
                <BlurView
                  pointerEvents="none"
                  intensity={28}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
              )}
              {(
                [
                  { id: 'data', label: 'Data', icon: 'cellular-outline' },
                  { id: 'airtime', label: 'Airtime', icon: 'call-outline' },
                  {
                    id: 'bundles',
                    label: 'Bundles',
                    icon: 'chatbubble-ellipses-outline',
                  },
                  { id: 'electricity', label: 'Power', icon: 'flash-outline' },
                  {
                    id: 'municipal',
                    label: 'Municipal',
                    icon: 'business-outline',
                  },
                ] as { id: VasServiceType; label: string; icon: string }[]
              ).map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => onOpenVas(item.id)}
                  style={({ pressed }) => [
                    styles.walletVasBtn,
                    pressed && { backgroundColor: 'rgba(255,255,255,0.16)' },
                  ]}
                >
                  <Ionicons name={item.icon as any} size={15} color="#6EE7B7" />
                  <Text style={styles.walletVasLabel}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Action Buttons: Top Up & Cash Out */}
          <View style={styles.actionsRow}>
            <Pressable
              onPress={onTopUp}
              style={({ pressed }) => [
                styles.topUpBtn,
                pressed && { opacity: 0.88 },
              ]}
            >
              <Ionicons name="add-circle" size={17} color="#064E3B" />
              <Text style={styles.topUpBtnText}>Top Up Wallet</Text>
            </Pressable>

            <Pressable
              onPress={onCashOut}
              style={({ pressed }) => [
                styles.cashOutBtn,
                pressed && { opacity: 0.82 },
              ]}
            >
              {Platform.OS !== 'web' && (
                <BlurView
                  pointerEvents="none"
                  intensity={22}
                  tint="light"
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Ionicons
                name="arrow-up-circle-outline"
                size={17}
                color="#FFFFFF"
              />
              <Text style={styles.cashOutBtnText}>Cash Out to Bank</Text>
            </Pressable>
          </View>
        </LinearGradient>
        </Animated.View>
      ) : (
        /* ==================== BACK OF @TAPPAY VIRTUAL CARD ==================== */
        <Animated.View style={backAnimatedStyle}>
        <LinearGradient
          colors={['#042F2E', '#064E3B', '#060D18']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.cardBack, compact && styles.cardBackCompact]}
        >
          <CardGlassSheen />
          <View style={styles.magStripe} />

          <View style={styles.backBody}>
            <View style={styles.sigCaptionRow}>
              <Text style={styles.sigCaptionText}>
                AUTHORIZED VIRTUAL E-MONEY SIGNATURE
              </Text>
              <Text style={styles.sigCaptionText}>SECURITY CVV</Text>
            </View>

            <View style={styles.sigStrip}>
              <Text style={styles.sigText}>THABO MOKOENA • TAPPAY WALLET</Text>
              <Pressable
                onPress={() => {
                  triggerHaptic('light');
                  setShowVirtualCvv((v) => !v);
                }}
                style={styles.cvvPill}
              >
                <Text style={styles.cvvLabel}>CVV</Text>
                <Text style={styles.cvvVal}>
                  {showVirtualCvv ? '619' : '•••'}
                </Text>
                <Ionicons
                  name={showVirtualCvv ? 'eye-off-outline' : 'eye-outline'}
                  size={13}
                  color="#064E3B"
                />
              </Pressable>
            </View>

            <View style={styles.virtualPanRow}>
              <View>
                <Text style={styles.backLabel}>VIRTUAL HCE CARD NUMBER</Text>
                <Text style={styles.virtualPanText}>
                  5399 4820 9910 {wallet.walletNumber.slice(-4)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.backLabel}>VALID THRU</Text>
                <Text style={styles.virtualPanText}>11/29</Text>
              </View>
            </View>

            <View style={styles.backFootRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.backFootNote}>
                  SARB Ring-Fenced e-Money • ShapID {wallet.shapId}
                </Text>
                <Text style={styles.backFootSub}>
                  Wallet ID {wallet.walletNumber} • Zero Bank Exposure
                </Text>
              </View>

              <Pressable
                onPress={handleFlip}
                style={({ pressed }) => [
                  styles.flipBackBtn,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Ionicons name="sync-outline" size={14} color="#FFFFFF" />
                <Text style={styles.flipBackText}>Flip to Front</Text>
              </Pressable>
            </View>
          </View>
        </LinearGradient>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flipWrap: {
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
    padding: 18,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.34)',
    shadowColor: '#022C22',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 7,
  },
  cardCompact: {
    padding: 15,
    borderRadius: 18,
  },
  cardBack: {
    borderRadius: 22,
    paddingTop: 16,
    paddingBottom: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.34)',
    shadowColor: '#022C22',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 7,
  },
  cardBackCompact: {
    borderRadius: 18,
    paddingTop: 14,
    paddingBottom: 14,
  },
  magStripe: {
    width: '100%',
    height: 38,
    backgroundColor: '#040911',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.18)',
  },
  backBody: {
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  sigCaptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sigCaptionText: {
    color: 'rgba(167, 243, 208, 0.6)',
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sigStrip: {
    height: 36,
    borderRadius: 6,
    backgroundColor: '#D1FAE5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  sigText: {
    color: '#064E3B',
    fontSize: 11.5,
    fontStyle: 'italic',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cvvPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  cvvLabel: {
    color: '#047857',
    fontSize: 9.5,
    fontWeight: '800',
  },
  cvvVal: {
    color: '#064E3B',
    fontSize: 12.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  virtualPanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
  },
  backLabel: {
    color: 'rgba(167, 243, 208, 0.72)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  virtualPanText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  backFootRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 11,
    gap: 8,
  },
  backFootNote: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10,
    fontWeight: '700',
  },
  backFootSub: {
    color: 'rgba(255,255,255,0.58)',
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
  flipBackText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  glowOrb: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    top: -65,
    right: -45,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  topRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  walletIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  walletTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  independentPill: {
    backgroundColor: 'rgba(52, 211, 153, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  independentPillText: {
    color: '#A7F3D0',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  walletMeta: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 11,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  nfcBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  nfcBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.78)',
    borderColor: '#A7F3D0',
  },
  nfcBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
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
  balanceBlock: {
    marginVertical: 13,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  embossedWalletPan: {
    color: '#FFFFFF',
    fontSize: 19.5,
    fontWeight: '800',
    letterSpacing: 2.0,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  privacySubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  balanceVal: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  capSub: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 10.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  walletVasStrip: {
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
    gap: 4,
  },
  walletVasBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 10,
  },
  walletVasLabel: {
    color: '#ECFDF5',
    fontSize: 11,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  topUpBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#34D399',
    paddingVertical: 11,
    borderRadius: 13,
  },
  topUpBtnText: {
    color: '#064E3B',
    fontSize: 13,
    fontWeight: '800',
  },
  cashOutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    paddingVertical: 11,
    borderRadius: 13,
  },
  cashOutBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
