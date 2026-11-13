import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTabNavigation } from '../context/TabNavigationContext';
import { useAppTheme, getGlassStyle } from '../theme/colors';
import { GlassModalBackdrop, CardGlassSheen } from '../components/GlassUI';
import { useTapPay } from '../context/TapPayContext';
import { SA_BANKS } from '../data/saBanks';
import { BankCardView, ContactlessWavesSvg } from '../components/BankCardView';
import { TapPayWalletCard } from '../components/TapPayWalletCard';
import { WalletModal } from '../components/WalletModal';
import { VasServicesModal } from '../components/VasServicesModal';
import { CashSendModal } from '../components/CashSendModal';
import { ReceiptModal } from '../components/ReceiptModal';
import { PayShapModal } from '../components/PayShapModal';
import { LinkBankModal } from '../components/LinkBankModal';
import {
  QuickContact,
  Transaction,
  TAPPAY_WALLET_ID,
  VasServiceType,
} from '../types';
import {
  formatZAR,
  formatSASTDate,
  maskAccountNumber,
  triggerHaptic,
} from '../utils/format';

export function HomeScreen() {
  const { colors } = useAppTheme();
  const navigation = useTabNavigation();
  const {
    wallet,
    accounts,
    defaultAccount,
    encryptionProfile,
    activeNfcSourceId,
    transactions,
    nfcSettings,
    setDefaultAccount,
    selectPrimaryNfcSource,
    refreshLedger,
  } = useTapPay();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [payShapOpen, setPayShapOpen] = useState(false);
  const [selectedContact, setSelectedContact] =
    useState<QuickContact | null>(null);
  const [linkBankOpen, setLinkBankOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletModalTab, setWalletModalTab] = useState<'topup' | 'cashout'>(
    'topup'
  );
  const [vasModalOpen, setVasModalOpen] = useState(false);
  const [vasInitialService, setVasInitialService] =
    useState<VasServiceType>('data');
  const [vasPreferWallet, setVasPreferWallet] = useState(false);
  const [cashSendOpen, setCashSendOpen] = useState(false);
  const [heroView, setHeroView] = useState<'bank' | 'wallet'>('bank');
  const [switchSheetOpen, setSwitchSheetOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshLedger();
    setRefreshing(false);
  }, [refreshLedger]);

  const recentTransactions = transactions.slice(0, 4);

  const handleOpenPayShap = (contact?: QuickContact) => {
    triggerHaptic('light', nfcSettings.hapticsEnabled);
    setSelectedContact(contact || null);
    setPayShapOpen(true);
  };

  const transactTiles = [
    {
      id: 'payshap',
      label: 'PayShap',
      icon: 'flash-outline',
      tint: colors.primary,
      bg: colors.primarySoft,
      onPress: () => handleOpenPayShap(),
    },
    {
      id: 'ewallet',
      label: 'Send Cash',
      icon: 'cash-outline',
      tint: colors.primary,
      bg: colors.primarySoft,
      onPress: () => {
        triggerHaptic('light', nfcSettings.hapticsEnabled);
        setCashSendOpen(true);
      },
    },
    {
      id: 'wallet',
      label: 'My Wallet',
      icon: 'wallet-outline',
      tint: colors.info,
      bg: colors.infoSoft,
      onPress: () => {
        triggerHaptic('light', nfcSettings.hapticsEnabled);
        setWalletModalTab('topup');
        setWalletModalOpen(true);
      },
    },
    {
      id: 'linkbank',
      label: 'Add Bank',
      icon: 'business-outline',
      tint: colors.gold,
      bg: colors.goldSoft,
      onPress: () => {
        triggerHaptic('light', nfcSettings.hapticsEnabled);
        setLinkBankOpen(true);
      },
    },
    {
      id: 'data',
      label: 'Buy Data',
      icon: 'cellular-outline',
      tint: colors.primary,
      bg: colors.primarySoft,
      onPress: () => {
        triggerHaptic('light', nfcSettings.hapticsEnabled);
        setVasInitialService('data');
        setVasPreferWallet(heroView === 'wallet');
        setVasModalOpen(true);
      },
    },
    {
      id: 'airtime',
      label: 'Airtime',
      icon: 'call-outline',
      tint: colors.info,
      bg: colors.infoSoft,
      onPress: () => {
        triggerHaptic('light', nfcSettings.hapticsEnabled);
        setVasInitialService('airtime');
        setVasPreferWallet(heroView === 'wallet');
        setVasModalOpen(true);
      },
    },
    {
      id: 'electricity',
      label: 'Electricity',
      icon: 'bulb-outline',
      tint: colors.gold,
      bg: colors.goldSoft,
      onPress: () => {
        triggerHaptic('light', nfcSettings.hapticsEnabled);
        setVasInitialService('electricity');
        setVasPreferWallet(heroView === 'wallet');
        setVasModalOpen(true);
      },
    },
    {
      id: 'municipal',
      label: 'Municipal',
      icon: 'receipt-outline',
      tint: colors.info,
      bg: colors.infoSoft,
      onPress: () => {
        triggerHaptic('light', nfcSettings.hapticsEnabled);
        setVasInitialService('municipal');
        setVasPreferWallet(heroView === 'wallet');
        setVasModalOpen(true);
      },
    },
  ];

  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const isIncoming = item.direction === 'in';
    const iconName =
      item.channel === 'e-Wallet Cash Send'
        ? 'cash-outline'
        : item.channel === 'Prepaid & Bills'
        ? item.vasToken
          ? 'bulb-outline'
          : 'cellular-outline'
        : item.channel === 'Wallet Transfer'
        ? 'wallet-outline'
        : item.channel === 'PayShap Instant'
        ? 'flash-outline'
        : isIncoming
        ? 'arrow-down-outline'
        : 'wifi-outline';

    return (
      <Pressable
        onPress={() => {
          triggerHaptic('light', nfcSettings.hapticsEnabled);
          setSelectedTx(item);
        }}
        style={({ pressed }) => [
          styles.txCard,
          getGlassStyle(colors.isDark, 16),
          {
            backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            borderColor: colors.glassHighlight,
          },
        ]}
      >
        <View
          style={[
            styles.txIconWrap,
            {
              backgroundColor: isIncoming
                ? colors.primarySoft
                : colors.surfaceMuted,
            },
          ]}
        >
          <Ionicons
            name={iconName}
            size={19}
            color={isIncoming ? colors.primary : colors.text}
          />
        </View>

        <View style={styles.txCenter}>
          <Text
            numberOfLines={1}
            style={[styles.txTitle, { color: colors.text }]}
          >
            {item.title}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.txSubtitle, { color: colors.textSecondary }]}
          >
            {formatSASTDate(item.timestamp)} • {item.bankShortName}
          </Text>
        </View>

        <View style={styles.txRight}>
          <Text
            style={[
              styles.txAmount,
              { color: isIncoming ? colors.primary : colors.text },
            ]}
          >
            {nfcSettings.hideBalances
              ? 'R ••••'
              : formatZAR(item.amount, item.direction)}
          </Text>
          <Text style={[styles.txChannel, { color: colors.textMuted }]}>
            POP
          </Text>
        </View>
      </Pressable>
    );
  };

  const ListHeader = (
    <View style={styles.headerContent}>
      {/* 1. Clean SA Banking Header */}
      <View style={styles.topGreetingRow}>
        <View style={styles.brandGreeting}>
          <View
            style={[styles.logoBadge, { backgroundColor: colors.primary }]}
          >
            <ContactlessWavesSvg size={20} color="#FFFFFF" />
          </View>
          <View>
            <Text style={[styles.greetingTitle, { color: colors.text }]}>
              TapPay Wallet
            </Text>
            <View style={styles.subStatusRow}>
              <Ionicons
                name="shield-checkmark"
                size={12}
                color={colors.primary}
              />
              <Text
                style={[styles.greetingSub, { color: colors.textSecondary }]}
              >
                Good day, Thabo Mokoena
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={() => {
            triggerHaptic('light', nfcSettings.hapticsEnabled);
            setAlertsOpen(true);
          }}
          style={[
            styles.iconButton,
            getGlassStyle(colors.isDark, 18),
            {
              backgroundColor: colors.surface,
              borderColor: colors.glassHighlight,
            },
          ]}
        >
          <Ionicons
            name="notifications-outline"
            size={20}
            color={colors.text}
          />
          <View
            style={[styles.notifDot, { backgroundColor: colors.primary }]}
          />
        </Pressable>
      </View>

      {/* 2. Clean Card Switcher: Bank Card vs @TapPay Wallet */}
      <View
        style={[
          styles.cardModeSwitch,
          getGlassStyle(colors.isDark, 18),
          {
            backgroundColor: colors.surface,
            borderColor: colors.glassHighlight,
          },
        ]}
      >
        <Pressable
          onPress={() => {
            triggerHaptic('light', nfcSettings.hapticsEnabled);
            setHeroView('bank');
          }}
          style={[
            styles.cardModeBtn,
            heroView === 'bank' && { backgroundColor: colors.primary },
          ]}
        >
          <Ionicons
            name="card-outline"
            size={15}
            color={heroView === 'bank' ? '#FFFFFF' : colors.textSecondary}
          />
          <Text
            style={[
              styles.cardModeText,
              {
                color: heroView === 'bank' ? '#FFFFFF' : colors.textSecondary,
              },
            ]}
          >
            Bank Card
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            triggerHaptic('light', nfcSettings.hapticsEnabled);
            setHeroView('wallet');
          }}
          style={[
            styles.cardModeBtn,
            heroView === 'wallet' && { backgroundColor: colors.primary },
          ]}
        >
          <Ionicons
            name="wallet-outline"
            size={15}
            color={heroView === 'wallet' ? '#FFFFFF' : colors.textSecondary}
          />
          <Text
            style={[
              styles.cardModeText,
              {
                color:
                  heroView === 'wallet' ? '#FFFFFF' : colors.textSecondary,
              },
            ]}
          >
            TapPay Wallet
          </Text>
        </Pressable>
      </View>

      {/* Active Flip Card (Balances Strictly Protected on Home) */}
      {heroView === 'bank' ? (
        <BankCardView
          account={defaultAccount}
          restrictBalance
          showSwitchPill
          onSwitchAccount={() => {
            triggerHaptic('light', nfcSettings.hapticsEnabled);
            setSwitchSheetOpen(true);
          }}
        />
      ) : (
        <TapPayWalletCard
          wallet={wallet}
          restrictBalance
          onTopUp={() => {
            triggerHaptic('light', nfcSettings.hapticsEnabled);
            setWalletModalTab('topup');
            setWalletModalOpen(true);
          }}
          onCashOut={() => {
            triggerHaptic('light', nfcSettings.hapticsEnabled);
            setWalletModalTab('cashout');
            setWalletModalOpen(true);
          }}
          onSelectForNfc={() =>
            selectPrimaryNfcSource(
              wallet.isPrimaryNfc ? defaultAccount.id : TAPPAY_WALLET_ID
            )
          }
        />
      )}

      {/* 3. Primary Contactless NFC Actions */}
      <View style={styles.nfcPairRow}>
        <Pressable
          onPress={() => {
            triggerHaptic('medium', nfcSettings.hapticsEnabled);
            navigation.navigate('Tap', { mode: 'pay' });
          }}
          style={({ pressed }) => [
            styles.nfcActionBtn,
            {
              backgroundColor: colors.primary,
              overflow: 'hidden',
              opacity: pressed ? 0.92 : 1,
            },
          ]}
        >
          <CardGlassSheen />
          <View style={styles.nfcBtnIconLight}>
            <ContactlessWavesSvg size={20} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nfcBtnTitleLight}>Tap to Pay</Text>
            <Text style={styles.nfcBtnSubLight}>Card machine or phone</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => {
            triggerHaptic('medium', nfcSettings.hapticsEnabled);
            navigation.navigate('Tap', { mode: 'receive' });
          }}
          style={({ pressed }) => [
            styles.nfcActionBtn,
            getGlassStyle(colors.isDark, 20),
            {
              backgroundColor: colors.surfaceElevated,
              borderWidth: 1,
              borderColor: colors.glassHighlight,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <View
            style={[
              styles.nfcBtnIconThemed,
              { backgroundColor: colors.infoSoft },
            ]}
          >
            <Ionicons
              name="phone-portrait-outline"
              size={19}
              color={colors.info}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.nfcBtnTitleThemed, { color: colors.text }]}>
              Tap to Receive
            </Text>
            <Text
              style={[
                styles.nfcBtnSubThemed,
                { color: colors.textSecondary },
              ]}
            >
              Accept payment
            </Text>
          </View>
        </Pressable>
      </View>

      {/* 4. Orderly 2×4 South African Banking "Transact & Buy" Grid */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Transact & Buy
        </Text>
        <Pressable
          onPress={() => {
            triggerHaptic('light', nfcSettings.hapticsEnabled);
            setVasInitialService('bundles');
            setVasPreferWallet(heroView === 'wallet');
            setVasModalOpen(true);
          }}
        >
          <Text style={[styles.sectionLink, { color: colors.primary }]}>
            Voice & SMS Bundles
          </Text>
        </Pressable>
      </View>

      <View style={styles.bankingGrid}>
        {transactTiles.map((tile) => (
          <Pressable
            key={tile.id}
            onPress={tile.onPress}
            style={({ pressed }) => [
              styles.gridTile,
              getGlassStyle(colors.isDark, 18),
              {
                backgroundColor: colors.surface,
                borderColor: colors.glassHighlight,
                opacity: pressed ? 0.84 : 1,
              },
            ]}
          >
            <View style={[styles.gridTileIcon, { backgroundColor: tile.bg }]}>
              <Ionicons name={tile.icon as any} size={20} color={tile.tint} />
            </View>
            <Text
              numberOfLines={1}
              style={[styles.gridTileLabel, { color: colors.text }]}
            >
              {tile.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* 5. Recent Transactions Header */}
      <View style={[styles.sectionHeaderRow, { marginTop: 20 }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Recent Transactions
        </Text>
        <Pressable onPress={() => navigation.navigate('Activity')}>
          <Text style={[styles.sectionLink, { color: colors.primary }]}>
            See All
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safe, { backgroundColor: 'transparent' }]}
    >
      <FlatList
        data={recentTransactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransactionItem}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View
            style={[
              styles.emptyBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name="receipt-outline"
              size={26}
              color={colors.textMuted}
            />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No recent transactions yet.
            </Text>
          </View>
        }
      />

      {/* Switch Active Bank / Wallet Sheet */}
      <Modal
        visible={switchSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSwitchSheetOpen(false)}
      >
        <GlassModalBackdrop style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSwitchSheetOpen(false)}
          />
          <View
            style={[
              styles.switchModalCard,
              getGlassStyle(colors.isDark, 24),
              {
                backgroundColor: colors.glassSheet,
                borderColor: colors.glassHighlight,
              },
            ]}
          >
            <Text style={[styles.switchModalTitle, { color: colors.text }]}>
              Choose Payment Account
            </Text>
            <Text
              style={[styles.switchModalSub, { color: colors.textSecondary }]}
            >
              Select which card or wallet settles your NFC taps
            </Text>

            <Pressable
              onPress={() => {
                selectPrimaryNfcSource(TAPPAY_WALLET_ID);
                setHeroView('wallet');
                setSwitchSheetOpen(false);
              }}
              style={[
                styles.switchAccRow,
                {
                  backgroundColor:
                    activeNfcSourceId === TAPPAY_WALLET_ID
                      ? colors.primarySoft
                      : colors.surfaceMuted,
                  borderColor:
                    activeNfcSourceId === TAPPAY_WALLET_ID
                      ? colors.primary
                      : colors.border,
                },
              ]}
            >
              <View
                style={[styles.smallBankIcon, { backgroundColor: '#065F46' }]}
              >
                <Ionicons name="wallet" size={18} color="#34D399" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.switchAccName, { color: colors.text }]}>
                  TapPay Wallet
                </Text>
                <Text
                  style={[styles.switchAccBal, { color: colors.textSecondary }]}
                >
                  {wallet.walletNumber} • ZAR Wallet
                </Text>
              </View>
              {activeNfcSourceId === TAPPAY_WALLET_ID && (
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={colors.primary}
                />
              )}
            </Pressable>

            {accounts.map((acc) => {
              const b = SA_BANKS[acc.bankId];
              const active = activeNfcSourceId === acc.id;
              return (
                <Pressable
                  key={acc.id}
                  onPress={() => {
                    setDefaultAccount(acc.id);
                    setHeroView('bank');
                    setSwitchSheetOpen(false);
                  }}
                  style={[
                    styles.switchAccRow,
                    {
                      backgroundColor: active
                        ? colors.primarySoft
                        : colors.surfaceMuted,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.smallBankIcon,
                      { backgroundColor: b.gradient[0] },
                    ]}
                  >
                    <Text style={styles.smallBankIconText}>
                      {b.shortName.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.switchAccName, { color: colors.text }]}
                    >
                      {b.shortName} {acc.accountType}{' '}
                      {maskAccountNumber(acc.accountNumber)}
                    </Text>
                    <Text
                      style={[
                        styles.switchAccBal,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Branch {acc.branchCode}
                    </Text>
                  </View>
                  {active && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={colors.primary}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </GlassModalBackdrop>
      </Modal>

      {/* Banking Notices Modal */}
      <Modal
        visible={alertsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAlertsOpen(false)}
      >
        <GlassModalBackdrop style={styles.modalBackdrop}>
          <View
            style={[
              styles.switchModalCard,
              getGlassStyle(colors.isDark, 24),
              {
                backgroundColor: colors.glassSheet,
                borderColor: colors.glassHighlight,
              },
            ]}
          >
            <View style={styles.alertsHeader}>
              <Text style={[styles.switchModalTitle, { color: colors.text }]}>
                Notifications
              </Text>
              <Pressable onPress={() => setAlertsOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View
              style={[
                styles.alertRow,
                { backgroundColor: colors.surfaceMuted },
              ]}
            >
              <Ionicons
                name="shield-checkmark"
                size={20}
                color={colors.primary}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.alertTitle, { color: colors.text }]}>
                  Device & User Encryption Active
                </Text>
                <Text
                  style={[styles.alertBody, { color: colors.textSecondary }]}
                >
                  Bound to {encryptionProfile?.deviceId || 'this device'} with
                  256-bit end-to-end banking protection.
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.alertRow,
                { backgroundColor: colors.surfaceMuted },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={colors.info}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.alertTitle, { color: colors.text }]}>
                  Home Balance Privacy Enabled
                </Text>
                <Text
                  style={[styles.alertBody, { color: colors.textSecondary }]}
                >
                  Account and @TapPay Wallet balances are hidden on the Home
                  screen for your safety at tills and ATMs. View balances in
                  Cards.
                </Text>
              </View>
            </View>
          </View>
        </GlassModalBackdrop>
      </Modal>

      <ReceiptModal
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
      />

      <PayShapModal
        visible={payShapOpen}
        initialContact={selectedContact}
        restrictBalances
        onClose={() => setPayShapOpen(false)}
        onCompleted={(tx) => setSelectedTx(tx)}
      />

      <LinkBankModal
        visible={linkBankOpen}
        onClose={() => setLinkBankOpen(false)}
      />

      <WalletModal
        visible={walletModalOpen}
        initialTab={walletModalTab}
        restrictBalances
        onClose={() => setWalletModalOpen(false)}
        onCompleted={(tx) => setSelectedTx(tx)}
      />

      <VasServicesModal
        visible={vasModalOpen}
        initialService={vasInitialService}
        preferWalletSource={vasPreferWallet}
        restrictBalances
        onClose={() => setVasModalOpen(false)}
        onCompleted={(tx) => setSelectedTx(tx)}
      />

      <CashSendModal
        visible={cashSendOpen}
        restrictBalances
        onClose={() => setCashSendOpen(false)}
        onCompleted={(tx) => setSelectedTx(tx)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  headerContent: {
    paddingTop: 8,
    marginBottom: 8,
  },
  topGreetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  brandGreeting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  greetingSub: {
    fontSize: 12,
    fontWeight: '500',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  cardModeSwitch: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    gap: 4,
  },
  cardModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  cardModeText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  nfcPairRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  nfcActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 14,
  },
  nfcBtnIconLight: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nfcBtnIconThemed: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nfcBtnTitleLight: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  nfcBtnSubLight: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    marginTop: 1,
  },
  nfcBtnTitleThemed: {
    fontSize: 14,
    fontWeight: '800',
  },
  nfcBtnSubThemed: {
    fontSize: 11,
    marginTop: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: '800',
  },
  sectionLink: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  bankingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  gridTile: {
    width: '23.4%',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderRadius: 16,
    borderWidth: 1,
    gap: 7,
  },
  gridTileIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTileLabel: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  txIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txCenter: {
    flex: 1,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  txSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  txChannel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  emptyBox: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  switchModalCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    gap: 10,
  },
  switchModalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  switchModalSub: {
    fontSize: 12.5,
    marginBottom: 4,
  },
  switchAccRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 15,
    borderWidth: 1,
  },
  smallBankIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBankIconText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  switchAccName: {
    fontSize: 14,
    fontWeight: '700',
  },
  switchAccBal: {
    fontSize: 12,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  alertsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    padding: 14,
    borderRadius: 14,
  },
  alertTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  alertBody: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
});
