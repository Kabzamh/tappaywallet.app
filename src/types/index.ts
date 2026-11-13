export type SABankId =
  | 'fnb'
  | 'capitec'
  | 'standard'
  | 'absa'
  | 'nedbank'
  | 'discovery'
  | 'tymebank';

export interface SABankInstitution {
  id: SABankId;
  name: string;
  shortName: string;
  universalBranchCode: string;
  gradient: [string, string, string];
  accentColor: string;
  textColor: string;
  payShapDomain: string;
  supportsOpenBanking: boolean;
}

export type BankAccountType = 'Cheque' | 'Savings' | 'Business';

export interface LinkedBankAccount {
  id: string;
  bankId: SABankId;
  accountHolder: string;
  accountNumber: string; // Full 10-digit SA account number stored locally, masked in UI
  accountType: BankAccountType;
  branchCode: string;
  balance: number; // in ZAR
  isDefault: boolean;
  nfcEnabled: boolean;
  shapId: string;
  linkedAt: string;
  mandateRef: string;
}

export const TAPPAY_WALLET_ID = 'tappay-wallet';

export interface TapPayWallet {
  id: typeof TAPPAY_WALLET_ID;
  walletNumber: string; // e.g., "TP-884-920-114"
  shapId: string; // e.g., "0824917732@tappay"
  balance: number; // Independent ZAR e-Money balance
  maxCap: number; // SARB Tier-2 FICA e-Money cap (R 25,000)
  nfcEnabled: boolean;
  isPrimaryNfc: boolean; // Whether TapPay Wallet is preferred over Default Bank for NFC
}

export type TransactionDirection = 'out' | 'in';

export type PaymentChannel =
  | 'NFC Tap to Pay'
  | 'NFC SoftPOS Receive'
  | 'PayShap Instant'
  | 'Wallet Transfer'
  | 'Prepaid & Bills'
  | 'e-Wallet Cash Send';

export type VasServiceType =
  | 'data'
  | 'airtime'
  | 'bundles'
  | 'electricity'
  | 'municipal';

export type TransactionCategory =
  | 'Groceries'
  | 'Coffee & Dining'
  | 'Fuel & Gautrain'
  | 'Peer Transfer'
  | 'Market & Retail'
  | 'Services'
  | 'Wallet Funding'
  | 'Mobile & Utilities';

export interface Transaction {
  id: string;
  utrReference: string; // e.g., ZA-PSH-20261111-849201
  title: string; // Merchant or Person name
  subtitle: string; // Location or note
  amount: number; // Positive value in ZAR
  fee: number; // Clearing fee in ZAR
  direction: TransactionDirection;
  channel: PaymentChannel;
  category: TransactionCategory;
  accountId: string;
  bankShortName: string;
  maskedAccount: string;
  counterpartyBank?: string;
  cardOrDeviceHint?: string; // e.g. "ISO 14443-4 • Visa •••• 4021" or "HCE Token •••• 8492"
  vasToken?: string; // 20-digit STS electricity token e.g. "4829 1044 7721 9038 5512"
  vasMeta?: string; // e.g. "73.1 kWh • Meter 04218890412" or "Rates Acct #550918442"
  e2eeSignature?: string; // Per-device & per-user HMAC-SHA256 ARQC signature
  encryptedDeviceId?: string; // Bound hardware device ID e.g. "ZA-IOS-8F29-C401"
  timestamp: string; // ISO string
  status: 'Settled' | 'Pending';
}

export interface EncryptionProfile {
  deviceId: string;
  userId: string;
  deviceKeyFingerprint: string;
  userKeyFingerprint: string;
  vaultKeyFingerprint: string;
  cipherSuite: string;
  enclaveProvider: string;
  keyEpoch: number;
  lastRotatedAt: string;
}

export interface QuickContact {
  id: string;
  name: string;
  initials: string;
  shapId: string;
  bankName: string;
  avatarBg: string;
  phone: string;
}

export interface NfcSettings {
  pinlessLimit: number; // e.g. R 500
  dailyLimit: number; // e.g. R 15,000
  biometricsEnabled: boolean;
  hapticsEnabled: boolean;
  soundEnabled: boolean;
  pinCode: string; // 5-digit SA banking PIN
  hideBalances: boolean;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface SimulatedMerchant {
  id: string;
  name: string;
  branch: string;
  amount: number;
  category: TransactionCategory;
  acquirerBank: string;
  icon: string;
}
