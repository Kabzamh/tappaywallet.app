import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Rect } from 'react-native-svg';
import { useAppTheme, getGlassStyle } from '../theme/colors';
import { GlassPanel } from '../components/GlassUI';
import { useTapPay } from '../context/TapPayContext';
import { ReceiptModal } from '../components/ReceiptModal';
import { Transaction, TAPPAY_WALLET_ID } from '../types';
import { formatZAR, formatSASTDate, triggerHaptic } from '../utils/format';

type FilterType = 'all' | 'wallet' | 'ewallet' | 'nfc_out' | 'bills';

export function ActivityScreen() {
  const { colors } = useAppTheme();
  const { transactions, nfcSettings, refreshLedger } = useTapPay();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshLedger();
    setRefreshing(false);
  }, [refreshLedger]);

  const { totalIn, totalOut } = useMemo(() => {
    return transactions.reduce(
      (acc, tx) => {
        if (tx.direction === 'in') acc.totalIn += tx.amount;
        else acc.totalOut += tx.amount;
        return acc;
      },
      { totalIn: 0, totalOut: 0 }
    );
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (
        activeFilter === 'wallet' &&
        tx.accountId !== TAPPAY_WALLET_ID &&
        tx.channel !== 'Wallet Transfer'
      ) {
        return false;
      }
      if (activeFilter === 'nfc_out' && tx.channel !== 'NFC Tap to Pay') {
        return false;
      }
      if (activeFilter === 'ewallet' && tx.channel !== 'e-Wallet Cash Send') {
        return false;
      }
      if (
        activeFilter === 'bills' &&
        tx.channel !== 'Prepaid & Bills' &&
        tx.channel !== 'PayShap Instant'
      ) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          tx.title.toLowerCase().includes(q) ||
          tx.subtitle.toLowerCase().includes(q) ||
          tx.bankShortName.toLowerCase().includes(q) ||
          tx.utrReference.toLowerCase().includes(q) ||
          tx.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [transactions, activeFilter, searchQuery]);

  const sumCombined = Math.max(totalIn + totalOut, 1);
  const inRatio = Math.max(0.08, Math.min(0.92, totalIn / sumCombined));

  const renderItem = ({ item }: { item: Transaction }) => {
    const isIncoming = item.direction === 'in';
    const iconName =
      item.channel === 'e-Wallet Cash Send'
        ? 'cash-outline'
        : item.channel === 'Prepaid & Bills'
        ? item.vasToken
          ? 'flash-outline'
          : 'cellular-outline'
        : item.channel === 'Wallet Transfer'
        ? 'wallet-outline'
        : item.channel === 'PayShap Instant'
        ? 'flash-outline'
        : isIncoming
        ? 'phone-portrait-outline'
        : 'wifi-outline';

    return (
      <Pressable
        onPress={() => {
          triggerHaptic('light', nfcSettings.hapticsEnabled);
          setSelectedTx(item);
        }}
        style={({ pressed }) => [
          styles.txRow,
          getGlassStyle(colors.isDark, 16),
          {
            backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            borderColor: colors.glassHighlight,
          },
        ]}
      >
        <View
          style={[
            styles.txIcon,
            {
              backgroundColor: isIncoming
                ? colors.primarySoft
                : colors.surfaceMuted,
            },
          ]}
        >
          <Ionicons
            name={iconName}
            size={20}
            color={isIncoming ? colors.primary : colors.text}
          />
        </View>

        <View style={styles.txBody}>
          <Text
            numberOfLines={1}
            style={[styles.txTitle, { color: colors.text }]}
          >
            {item.title}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.txSub, { color: colors.textSecondary }]}
          >
            {item.subtitle}
          </Text>
          <View style={styles.txMetaRow}>
            <Text style={[styles.txTime, { color: colors.textMuted }]}>
              {formatSASTDate(item.timestamp)}
            </Text>
            <Text style={[styles.txBankBadge, { color: colors.textSecondary }]}>
              • {item.bankShortName} {item.maskedAccount}
            </Text>
          </View>
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
          <View
            style={[
              styles.popHintPill,
              { backgroundColor: colors.surfaceMuted },
            ]}
          >
            <Text style={[styles.popHintText, { color: colors.textSecondary }]}>
              POP
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const ListHeader = (
    <View style={styles.headerWrap}>
      <Text style={[styles.screenTitle, { color: colors.text }]}>
        Statements
      </Text>
      <Text style={[styles.screenSub, { color: colors.textSecondary }]}>
        Transaction history & official Proof of Payment (POP)
      </Text>

      {/* Cashflow Summary Card */}
      <GlassPanel style={styles.summaryCard}>
        <View style={styles.summarySplit}>
          <View style={{ flex: 1 }}>
            <View style={styles.summaryLabelRow}>
              <View
                style={[styles.dot, { backgroundColor: colors.primary }]}
              />
              <Text
                style={[styles.summaryLabel, { color: colors.textSecondary }]}
              >
                MONEY IN
              </Text>
            </View>
            <Text style={[styles.summaryVal, { color: colors.primary }]}>
              {nfcSettings.hideBalances ? 'R ••••••' : formatZAR(totalIn)}
            </Text>
          </View>

          <View
            style={[
              styles.verticalDivider,
              { backgroundColor: colors.border },
            ]}
          />

          <View style={{ flex: 1, paddingLeft: 14 }}>
            <View style={styles.summaryLabelRow}>
              <View style={[styles.dot, { backgroundColor: colors.info }]} />
              <Text
                style={[styles.summaryLabel, { color: colors.textSecondary }]}
              >
                MONEY OUT
              </Text>
            </View>
            <Text style={[styles.summaryVal, { color: colors.text }]}>
              {nfcSettings.hideBalances ? 'R ••••••' : formatZAR(totalOut)}
            </Text>
          </View>
        </View>

        {/* Crisp SVG Proportional Cashflow Bar */}
        <View style={styles.svgBarWrap}>
          <Svg width="100%" height={10}>
            <Rect
              x="0"
              y="0"
              width="100%"
              height="10"
              rx="5"
              fill={colors.info}
            />
            <Rect
              x="0"
              y="0"
              width={`${Math.round(inRatio * 100)}%`}
              height="10"
              rx="5"
              fill={colors.primary}
            />
          </Svg>
        </View>
      </GlassPanel>

      {/* Search Input */}
      <View
        style={[
          styles.searchBar,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search store, person or reference..."
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          style={[styles.searchInput, { color: colors.text }]}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={10}>
            <Ionicons
              name="close-circle"
              size={18}
              color={colors.textMuted}
            />
          </Pressable>
        )}
      </View>

      {/* Filter Chips */}
      <View style={styles.filtersRow}>
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'wallet', label: 'Wallet' },
            { id: 'ewallet', label: 'e-Wallet' },
            { id: 'nfc_out', label: 'NFC Tap' },
            { id: 'bills', label: 'Bills/VAS' },
          ] as { id: FilterType; label: string }[]
        ).map((f) => {
          const active = activeFilter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => {
                triggerHaptic('light', nfcSettings.hapticsEnabled);
                setActiveFilter(f.id);
              }}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: active ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safe, { backgroundColor: 'transparent' }]}
    >
      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
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
              styles.emptyState,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name="document-text-outline"
              size={34}
              color={colors.textMuted}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No matching settlements
            </Text>
            <Text
              style={[styles.emptySub, { color: colors.textSecondary }]}
            >
              Try clearing your search term or switching payment channel filters.
            </Text>
            <Pressable
              onPress={() => {
                setSearchQuery('');
                setActiveFilter('all');
              }}
              style={[
                styles.resetFilterBtn,
                { backgroundColor: colors.primarySoft },
              ]}
            >
              <Text
                style={[styles.resetFilterText, { color: colors.primary }]}
              >
                Reset Filters
              </Text>
            </Pressable>
          </View>
        }
      />

      <ReceiptModal
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
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
  headerWrap: {
    paddingTop: 10,
    marginBottom: 12,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  screenSub: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: 14,
  },
  summaryCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  summarySplit: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verticalDivider: {
    width: 1,
    height: 38,
  },
  summaryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  summaryVal: {
    fontSize: 19,
    fontWeight: '800',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  svgBarWrap: {
    marginTop: 14,
    overflow: 'hidden',
    borderRadius: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 13,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 11,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 9,
    gap: 12,
  },
  txIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txBody: {
    flex: 1,
  },
  txTitle: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  txSub: {
    fontSize: 12,
    marginTop: 2,
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  txTime: {
    fontSize: 11,
  },
  txBankBadge: {
    fontSize: 11,
    fontWeight: '600',
  },
  txRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  txAmount: {
    fontSize: 14.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  popHintPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  popHintText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  emptyState: {
    padding: 28,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  resetFilterBtn: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
  },
  resetFilterText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
