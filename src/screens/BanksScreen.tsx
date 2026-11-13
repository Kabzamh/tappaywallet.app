import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Switch,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppTheme, getGlassStyle } from '../theme/colors';
import { GlassPanel } from '../components/GlassUI';
import { useTapPay } from '../context/TapPayContext';
import { BankCardView } from '../components/BankCardView';
import { TapPayWalletCard } from '../components/TapPayWalletCard';
import { WalletModal } from '../components/WalletModal';
import { VasServicesModal } from '../components/VasServicesModal';
import { ReceiptModal } from '../components/ReceiptModal';
import { LinkBankModal } from '../components/LinkBankModal';
import {
  LinkedBankAccount,
  Transaction,
  TAPPAY_WALLET_ID,
  VasServiceType,
} from '../types';
import { formatZAR, triggerHaptic } from '../utils/format';

export function BanksScreen() {
  const { colors } = useAppTheme();
  const {
    wallet,
    accounts,
    activeNfcSourceId,
    nfcSettings,
    todayNfcSpend,
    updateNfcSettings,
    setDefaultAccount,
    selectPrimaryNfcSource,
    toggleAccountNfc,
    toggleWalletNfc,
    removeBankAccount,
    refreshLedger,
  } = useTapPay();

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletModalTab, setWalletModalTab] = useState<'topup' | 'cashout'>(
    'topup'
  );
  const [vasModalOpen, setVasModalOpen] = useState(false);
  const [vasService, setVasService] = useState<VasServiceType>('data');
  const [receiptTx, setReceiptTx] = useState<Transaction | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshLedger();
    setRefreshing(false);
  }, [refreshLedger]);

  const spendPercent = Math.min(
    100,
    Math.round((todayNfcSpend / Math.max(1, nfcSettings.dailyLimit)) * 100)
  );

  const handleUnlink = (acc: LinkedBankAccount) => {
    const res = removeBankAccount(acc.id);
    if (!res.ok) {
      setFeedbackMsg(res.error || 'Cannot unlink account.');
    } else {
      setFeedbackMsg('Bank mandate unlinked cleanly.');
    }
    setTimeout(() => setFeedbackMsg(null), 3200);
  };

  const renderAccountItem = ({ item }: { item: LinkedBankAccount }) => {
    return (
      <View
        style={[
          styles.accountBundle,
          getGlassStyle(colors.isDark, 20),
          {
            backgroundColor: colors.surface,
            borderColor: colors.glassHighlight,
          },
        ]}
      >
        <BankCardView
          account={item}
          compact
          hideBalance={nfcSettings.hideBalances}
        />

        <View style={styles.accountControls}>
          <View style={styles.controlRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.controlTitle, { color: colors.text }]}>
                Contactless Tap Payments
              </Text>
              <Text
                style={[styles.controlSub, { color: colors.textSecondary }]}
              >
                Branch {item.branchCode} • Direct Bank Link
              </Text>
            </View>
            <Switch
              value={item.nfcEnabled}
              onValueChange={() => toggleAccountNfc(item.id)}
              trackColor={{ false: colors.borderStrong, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View
            style={[
              styles.bottomActionRow,
              { borderTopColor: colors.border },
            ]}
          >
            {activeNfcSourceId === item.id ? (
              <View
                style={[
                  styles.defaultBadge,
                  { backgroundColor: colors.primarySoft },
                ]}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color={colors.primary}
                />
                <Text
                  style={[styles.defaultBadgeText, { color: colors.primary }]}
                >
                  Default Tap Account
                </Text>
              </View>
            ) : (
              <Pressable
                onPress={() => setDefaultAccount(item.id)}
                style={[
                  styles.makeDefaultBtn,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.makeDefaultText, { color: colors.text }]}
                >
                  Set as Default
                </Text>
              </Pressable>
            )}

            {accounts.length > 1 && (
              <Pressable
                onPress={() => handleUnlink(item)}
                hitSlop={8}
                style={styles.unlinkBtn}
              >
                <Ionicons
                  name="trash-outline"
                  size={17}
                  color={colors.danger}
                />
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  };

  const ListHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>
            My Cards & Wallet
          </Text>
          <Text style={[styles.screenSub, { color: colors.textSecondary }]}>
            Manage your TapPay Wallet, linked SA bank cards & limits
          </Text>
        </View>
        <Pressable
          onPress={() => {
            triggerHaptic('light', nfcSettings.hapticsEnabled);
            setLinkModalOpen(true);
          }}
          style={({ pressed }) => [
            styles.addBankBtn,
            {
              backgroundColor: pressed ? colors.primaryDark : colors.primary,
            },
          ]}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.addBankBtnText}>Link Bank</Text>
        </Pressable>
      </View>

      {feedbackMsg && (
        <View
          style={[
            styles.feedbackToast,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.primary,
            },
          ]}
        >
          <Ionicons
            name="information-circle"
            size={18}
            color={colors.primary}
          />
          <Text style={[styles.feedbackText, { color: colors.text }]}>
            {feedbackMsg}
          </Text>
        </View>
      )}

      {/* Independent TapPay Wallet Bundle */}
      <View
        style={[
          styles.accountBundle,
          getGlassStyle(colors.isDark, 20),
          {
            backgroundColor: colors.surface,
            borderColor: colors.glassHighlight,
            marginTop: 14,
            marginBottom: 4,
          },
        ]}
      >
        <TapPayWalletCard
          wallet={wallet}
          compact
          hideBalance={nfcSettings.hideBalances}
          onTopUp={() => {
            setWalletModalTab('topup');
            setWalletModalOpen(true);
          }}
          onCashOut={() => {
            setWalletModalTab('cashout');
            setWalletModalOpen(true);
          }}
          onSelectForNfc={() => selectPrimaryNfcSource(TAPPAY_WALLET_ID)}
        />
        <View style={styles.accountControls}>
          <View style={styles.controlRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.controlTitle, { color: colors.text }]}>
                Wallet Tap Payments
              </Text>
              <Text
                style={[styles.controlSub, { color: colors.textSecondary }]}
              >
                Separate from your personal bank accounts
              </Text>
            </View>
            <Switch
              value={wallet.nfcEnabled}
              onValueChange={toggleWalletNfc}
              trackColor={{ false: colors.borderStrong, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
      </View>
    </View>
  );

  const ListFooter = (
    <GlassPanel style={styles.limitsCard}>
      <View style={styles.limitsHeader}>
        <Ionicons
          name="shield-half-outline"
          size={20}
          color={colors.primary}
        />
        <Text style={[styles.limitsTitle, { color: colors.text }]}>
          Daily Tap Limits
        </Text>
      </View>

      {/* Daily Spend Progress */}
      <View style={styles.progressSection}>
        <View style={styles.progressLabels}>
          <Text
            style={[styles.progressLabelLeft, { color: colors.textSecondary }]}
          >
            Today&apos;s NFC Spend
          </Text>
          <Text style={[styles.progressLabelRight, { color: colors.text }]}>
            {formatZAR(todayNfcSpend)} / {formatZAR(nfcSettings.dailyLimit)}
          </Text>
        </View>
        <View
          style={[
            styles.progressTrack,
            { backgroundColor: colors.surfaceMuted },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.max(4, spendPercent)}%`,
                backgroundColor:
                  spendPercent > 85 ? colors.gold : colors.primary,
              },
            ]}
          />
        </View>
      </View>

      {/* PIN-less Threshold Picker */}
      <Text style={[styles.settingSubhead, { color: colors.textSecondary }]}>
        PIN-FREE CONTACTLESS TAP THRESHOLD
      </Text>
      <View style={styles.pillsRow}>
        {[250, 500, 1000].map((val) => {
          const active = nfcSettings.pinlessLimit === val;
          return (
            <Pressable
              key={val}
              onPress={() => {
                triggerHaptic('light', nfcSettings.hapticsEnabled);
                updateNfcSettings({ pinlessLimit: val });
              }}
              style={[
                styles.limitPill,
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
                  styles.limitPillText,
                  { color: active ? '#FFFFFF' : colors.text },
                ]}
              >
                R {val}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Daily Cap Picker */}
      <Text
        style={[
          styles.settingSubhead,
          { color: colors.textSecondary, marginTop: 16 },
        ]}
      >
        DAILY NFC SETTLEMENT CAP
      </Text>
      <View style={styles.pillsRow}>
        {[5000, 15000, 30000, 50000].map((val) => {
          const active = nfcSettings.dailyLimit === val;
          return (
            <Pressable
              key={val}
              onPress={() => {
                triggerHaptic('light', nfcSettings.hapticsEnabled);
                updateNfcSettings({ dailyLimit: val });
              }}
              style={[
                styles.limitPill,
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
                  styles.limitPillText,
                  { color: active ? '#FFFFFF' : colors.text },
                ]}
              >
                R {val / 1000}k
              </Text>
            </Pressable>
          );
        })}
      </View>
    </GlassPanel>
  );

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safe, { backgroundColor: 'transparent' }]}
    >
      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        renderItem={renderAccountItem}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
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
      />

      <LinkBankModal
        visible={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        onLinked={() => {
          setFeedbackMsg('New South African bank account linked & tokenized!');
          setTimeout(() => setFeedbackMsg(null), 3500);
        }}
      />

      <WalletModal
        visible={walletModalOpen}
        initialTab={walletModalTab}
        onClose={() => setWalletModalOpen(false)}
        onCompleted={(tx) => setReceiptTx(tx)}
      />

      <VasServicesModal
        visible={vasModalOpen}
        initialService={vasService}
        preferWalletSource
        onClose={() => setVasModalOpen(false)}
        onCompleted={(tx) => setReceiptTx(tx)}
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
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 32,
  },
  headerBlock: {
    paddingTop: 10,
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  screenSub: {
    fontSize: 12.5,
    marginTop: 2,
  },
  addBankBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 13,
  },
  addBankBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  feedbackToast: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 13,
    borderWidth: 1,
  },
  feedbackText: {
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1,
  },
  accountBundle: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 10,
    marginBottom: 14,
  },
  accountControls: {
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 4,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  controlTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  controlSub: {
    fontSize: 11.5,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  bottomActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  defaultBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  makeDefaultBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  makeDefaultText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  unlinkBtn: {
    padding: 6,
  },
  limitsCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginTop: 4,
  },
  limitsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  limitsTitle: {
    fontSize: 15.5,
    fontWeight: '800',
  },
  progressSection: {
    marginBottom: 18,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  progressLabelLeft: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  progressLabelRight: {
    fontSize: 12.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 9,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  settingSubhead: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  limitPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
  },
  limitPillText: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
