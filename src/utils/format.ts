import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Formats a number into authentic South African Rand (ZAR) representation.
 * e.g., 24680.5 -> "R 24,680.50"
 */
export function formatZAR(amount: number, showSign?: 'in' | 'out'): string {
  const absVal = Math.abs(amount);
  const fixed = absVal.toFixed(2);
  const [whole, cents] = fixed.split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const base = `R ${withCommas}.${cents}`;
  if (showSign === 'in') return `+${base}`;
  if (showSign === 'out') return `-${base}`;
  return base;
}

/**
 * Masks a South African bank account number: "62849108492" -> "•••• 8492"
 */
export function maskAccountNumber(accountNumber: string): string {
  const cleaned = accountNumber.replace(/\s+/g, '');
  const last4 = cleaned.slice(-4);
  return `•••• ${last4}`;
}

/**
 * Generates an authentic BankservAfrica / PayShap Unique Transaction Reference (UTR)
 */
export function generateUTR(
  prefix: 'TAP' | 'POS' | 'SHP' | 'WLT' | 'VAS' | 'ATM' = 'TAP'
): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `ZA-${prefix}-${y}${m}${d}-${rand}`;
}

/**
 * Generates an authentic 20-digit South African STS Prepaid Electricity Token
 * formatted in 5 groups of 4 digits: "4829 1044 7721 9038 5512"
 */
export function generateStsToken(): string {
  const groups: string[] = [];
  for (let i = 0; i < 5; i++) {
    groups.push(String(Math.floor(1000 + Math.random() * 9000)));
  }
  return groups.join(' ');
}

/**
 * Generates an authentic 10-digit South African Cardless ATM Cash Voucher Number
 * formatted as "8849 201 745"
 */
export function generateCashVoucher(): string {
  const p1 = String(Math.floor(1000 + Math.random() * 9000));
  const p2 = String(Math.floor(100 + Math.random() * 900));
  const p3 = String(Math.floor(100 + Math.random() * 900));
  return `${p1} ${p2} ${p3}`;
}
export function formatSASTDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  const timePart = `${hours}:${mins}`;

  if (isToday) return `Today, ${timePart}`;
  if (isYesterday) return `Yesterday, ${timePart}`;

  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}, ${timePart}`;
}

export function formatFullReceiptTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  const secs = String(date.getSeconds()).padStart(2, '0');
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} at ${hours}:${mins}:${secs} SAST`;
}

/**
 * Safe cross-platform haptic triggers (silent no-op on Web)
 */
export async function triggerHaptic(
  type: 'light' | 'medium' | 'success' | 'warning' | 'error' = 'light',
  enabled = true
): Promise<void> {
  if (!enabled || Platform.OS === 'web') return;
  try {
    switch (type) {
      case 'light':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  } catch {
    // Ignore haptic unavailability
  }
}
