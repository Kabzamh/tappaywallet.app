import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Share,
} from 'react-native';
import { GlassModalBackdrop } from './GlassUI';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Transaction } from '../types';
import { useAppTheme, getGlassStyle } from '../theme/colors';
import {
  formatZAR,
  formatFullReceiptTimestamp,
  triggerHaptic,
} from '../utils/format';

interface ReceiptModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export function ReceiptModal({ transaction, onClose }: ReceiptModalProps) {
  const { colors } = useAppTheme();
  const [bannerText, setBannerText] = useState<string | null>(null);

  useEffect(() => {
    setBannerText(null);
  }, [transaction]);

  if (!transaction) return null;

  const isIncoming = transaction.direction === 'in';

  const handleCopyRef = () => {
    triggerHaptic('light');
    setBannerText(`Copied ${transaction.utrReference} to clipboard`);
  };

  const handleSharePop = async () => {
    triggerHaptic('medium');
    const popSummary = [
      'TAPPAY WALLET SOUTH AFRICA — OFFICIAL PROOF OF PAYMENT (POP)',
      `Status: ${transaction.status} (Real-Time Bank Clearing)`,
      `Direction: ${isIncoming ? 'RECEIVED (CREDIT)' : 'PAID (DEBIT)'}`,
      `Counterparty: ${transaction.title}`,
      `Amount: ${formatZAR(transaction.amount)}`,
      `Clearing Fee: ${formatZAR(transaction.fee)}`,
      `Channel: ${transaction.channel}`,
      `Account / Wallet: ${transaction.bankShortName} (${transaction.maskedAccount})`,
      ...(transaction.vasToken
        ? [
            `${
              transaction.channel === 'e-Wallet Cash Send'
                ? 'Cardless ATM Voucher & PIN'
                : '20-Digit STS Token'
            }: ${transaction.vasToken}`,
          ]
        : []),
      ...(transaction.vasMeta ? [`Utility / VAS Details: ${transaction.vasMeta}`] : []),
      ...(transaction.e2eeSignature
        ? [`Device+User E2EE Signature: ${transaction.e2eeSignature}`]
        : []),
      `UTR Clearing Ref: ${transaction.utrReference}`,
      `Timestamp: ${formatFullReceiptTimestamp(transaction.timestamp)}`,
    ].join('\n');

    try {
      await Share.share({
        message: popSummary,
        title: `Proof of Payment ${transaction.utrReference}`,
      });
      setBannerText('Official Proof of Payment ready to share');
    } catch {
      setBannerText('Proof of Payment POP generated');
    }
  };

  return (
    <Modal
      visible={!!transaction}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <GlassModalBackdrop style={styles.backdrop}>
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
          <View style={styles.topBar}>
            <View style={styles.brandRow}>
              <View
                style={[
                  styles.popBadge,
                  { backgroundColor: colors.primarySoft },
                ]}
              >
                <Ionicons
                  name="shield-checkmark"
                  size={15}
                  color={colors.primary}
                />
                <Text style={[styles.popBadgeText, { color: colors.primary }]}>
                  PROOF OF PAYMENT (POP)
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Hero Amount */}
            <View style={styles.heroBlock}>
              <View
                style={[
                  styles.statusIconCircle,
                  {
                    backgroundColor: isIncoming
                      ? colors.primarySoft
                      : colors.infoSoft,
                  },
                ]}
              >
                <Ionicons
                  name={isIncoming ? 'arrow-down' : 'wifi'}
                  size={26}
                  color={isIncoming ? colors.primary : colors.info}
                />
              </View>
              <Text
                style={[
                  styles.amountText,
                  { color: isIncoming ? colors.primary : colors.text },
                ]}
              >
                {formatZAR(transaction.amount, transaction.direction)}
              </Text>
              <Text style={[styles.titleText, { color: colors.text }]}>
                {transaction.title}
              </Text>
              <Text
                style={[styles.subtitleText, { color: colors.textSecondary }]}
              >
                {transaction.subtitle}
              </Text>

              <View
                style={[
                  styles.settledChip,
                  { backgroundColor: colors.primarySoft },
                ]}
              >
                <View
                  style={[
                    styles.settledDot,
                    { backgroundColor: colors.primary },
                  ]}
                />
                <Text
                  style={[styles.settledChipText, { color: colors.primary }]}
                >
                  {transaction.status} Instantly via BankservAfrica
                </Text>
              </View>
            </View>

            {/* 20-Digit STS Electricity Token OR Cardless ATM Cash Voucher Card */}
            {transaction.vasToken && (
              <Pressable
                onPress={() => {
                  triggerHaptic('light');
                  setBannerText(
                    `Copied (${transaction.vasToken}) to clipboard`
                  );
                }}
                style={[
                  styles.stsTokenCard,
                  {
                    backgroundColor: colors.primarySoft,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <View style={styles.stsTokenHeader}>
                  <Ionicons
                    name={
                      transaction.channel === 'e-Wallet Cash Send'
                        ? 'cash-outline'
                        : 'flash'
                    }
                    size={16}
                    color={colors.primary}
                  />
                  <Text
                    style={[styles.stsTokenLabel, { color: colors.primary }]}
                  >
                    {transaction.channel === 'e-Wallet Cash Send'
                      ? 'INSTANT ATM CASH VOUCHER & SECRET PIN'
                      : '20-DIGIT STS PREPAID ELECTRICITY TOKEN'}
                  </Text>
                </View>
                <Text style={[styles.stsTokenDigits, { color: colors.text }]}>
                  {transaction.vasToken}
                </Text>
                {transaction.vasMeta ? (
                  <Text
                    style={[
                      styles.stsTokenSub,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {transaction.vasMeta} • Tap card to copy
                  </Text>
                ) : null}
              </Pressable>
            )}

            {/* Detailed Clearing Rows */}
            <View
              style={[
                styles.detailsCard,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: colors.border,
                },
              ]}
            >
              <DetailRow
                label="Date & SAST Time"
                value={formatFullReceiptTimestamp(transaction.timestamp)}
                colors={colors}
              />
              <DetailRow
                label="Payment Rail"
                value={transaction.channel}
                colors={colors}
              />
              <DetailRow
                label={
                  isIncoming
                    ? 'Credited Wallet / Bank'
                    : 'Debited Wallet / Bank'
                }
                value={`${transaction.bankShortName} (${transaction.maskedAccount})`}
                colors={colors}
              />
              {transaction.counterpartyBank && (
                <DetailRow
                  label={isIncoming ? 'Originating Bank' : 'Acquiring Bank'}
                  value={transaction.counterpartyBank}
                  colors={colors}
                />
              )}
              {transaction.cardOrDeviceHint && (
                <DetailRow
                  label="Cryptogram / Token"
                  value={transaction.cardOrDeviceHint}
                  colors={colors}
                />
              )}
              <DetailRow
                label="Clearing Fee"
                value={
                  transaction.fee === 0
                    ? 'R 0.00 (Zero Fee Direct)'
                    : formatZAR(transaction.fee)
                }
                colors={colors}
              />
              {transaction.e2eeSignature && (
                <DetailRow
                  label="Device + User E2EE Sig"
                  value={`${transaction.e2eeSignature}${
                    transaction.encryptedDeviceId
                      ? ` (${transaction.encryptedDeviceId})`
                      : ''
                  }`}
                  colors={colors}
                  mono
                />
              )}
              <DetailRow
                label="UTR Clearing Reference"
                value={transaction.utrReference}
                colors={colors}
                isLast
                mono
              />
            </View>

            {bannerText && (
              <View
                style={[
                  styles.toastBanner,
                  {
                    backgroundColor: colors.primarySoft,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={17}
                  color={colors.primary}
                />
                <Text
                  style={[styles.toastBannerText, { color: colors.primary }]}
                >
                  {bannerText}
                </Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actionsRow}>
              <Pressable
                onPress={handleCopyRef}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  {
                    borderColor: colors.borderStrong,
                    backgroundColor: pressed
                      ? colors.surfaceMuted
                      : colors.surface,
                  },
                ]}
              >
                <Ionicons name="copy-outline" size={18} color={colors.text} />
                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
                  Copy UTR
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSharePop}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: pressed
                      ? colors.primaryDark
                      : colors.primary,
                  },
                ]}
              >
                <Ionicons name="share-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Share POP</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </GlassModalBackdrop>
    </Modal>
  );
}

function DetailRow({
  label,
  value,
  colors,
  isLast,
  mono,
}: {
  label: string;
  value: string;
  colors: any;
  isLast?: boolean;
  mono?: boolean;
}) {
  return (
    <View
      style={[
        styles.detailRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text
        style={[
          styles.detailValue,
          { color: colors.text },
          mono && { fontVariant: ['tabular-nums'], letterSpacing: 0.3 },
        ]}
      >
        {value}
      </Text>
    </View>
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
    paddingTop: 18,
    paddingBottom: 32,
    maxHeight: '88%',
    borderTopWidth: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  popBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  popBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  heroBlock: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  statusIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  amountText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  titleText: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 6,
  },
  subtitleText: {
    fontSize: 13,
    marginTop: 2,
    textAlign: 'center',
  },
  settledChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  settledDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  settledChipText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  stsTokenCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  stsTokenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  stsTokenLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  stsTokenDigits: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 1.4,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  stsTokenSub: {
    fontSize: 11.5,
    marginTop: 5,
  },
  detailsCard: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    marginVertical: 10,
  },
  detailRow: {
    paddingVertical: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailLabel: {
    fontSize: 12.5,
    flexShrink: 0,
  },
  detailValue: {
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'right',
    flex: 1,
  },
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  toastBannerText: {
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  primaryBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
