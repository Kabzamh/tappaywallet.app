import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LinkedBankAccount,
  TapPayWallet,
  TAPPAY_WALLET_ID,
  Transaction,
  NfcSettings,
  ThemePreference,
  SABankId,
  BankAccountType,
  TransactionCategory,
  VasServiceType,
  EncryptionProfile,
} from '../types';
import {
  INITIAL_ACCOUNTS,
  INITIAL_TRANSACTIONS,
  INITIAL_WALLET,
  SA_BANKS,
} from '../data/saBanks';
import {
  generateUTR,
  generateStsToken,
  generateCashVoucher,
  maskAccountNumber,
  triggerHaptic,
} from '../utils/format';
import {
  initializeDeviceAndUserEncryption,
  rotateDeviceAndUserKeys,
  encryptVaultPayload,
  decryptVaultPayload,
  signTransactionCryptogram,
} from '../utils/encryption';

const STORAGE_KEYS = {
  ACCOUNTS: '@tappay_za_accounts_v1',
  WALLET: '@tappay_za_wallet_v1',
  TRANSACTIONS: '@tappay_za_transactions_v1',
  SETTINGS: '@tappay_za_settings_v1',
  THEME: '@tappay_za_theme_v1',
};

const DEFAULT_SETTINGS: NfcSettings = {
  pinlessLimit: 500,
  dailyLimit: 15000,
  biometricsEnabled: true,
  hapticsEnabled: true,
  soundEnabled: true,
  pinCode: '25800', // 5-digit South African banking PIN
  hideBalances: false,
};

export interface ExecuteTapPayInput {
  merchantName: string;
  subtitle: string;
  amount: number;
  category: TransactionCategory;
  acquirerBank: string;
  accountId?: string; // Bank Account ID or TAPPAY_WALLET_ID
  pinVerified?: boolean;
}

export interface ExecuteSoftPosReceiveInput {
  payerName: string;
  referenceNote: string;
  amount: number;
  payerBank: string;
  cardOrDeviceHint: string;
  isCommercialCard?: boolean;
  accountId?: string; // Bank Account ID or TAPPAY_WALLET_ID
}

export interface ExecutePayShapInput {
  recipientName: string;
  shapId: string;
  recipientBank: string;
  amount: number;
  reference: string;
  accountId?: string; // Bank Account ID or TAPPAY_WALLET_ID
}

export interface LinkBankInput {
  bankId: SABankId;
  accountHolder: string;
  accountNumber: string;
  accountType: BankAccountType;
  initialBalance: number;
  makeDefault: boolean;
}

export interface WalletTopUpInput {
  amount: number;
  method: 'bank' | 'retail_voucher';
  bankAccountId?: string;
  voucherLabel?: string; // e.g. "Pick n Pay Till Cash" or "1Voucher PIN"
}

export interface WalletCashOutInput {
  amount: number;
  bankAccountId: string;
}

export interface ExecuteVasInput {
  serviceType: VasServiceType;
  providerName: string;
  targetIdentifier: string;
  productDescription: string;
  amount: number;
  accountId?: string;
}

export interface ExecuteCashSendInput {
  networkName: string; // e.g., "FNB eWallet", "Standard Bank Instant Money"
  collectionHint: string;
  recipientName: string;
  recipientPhone: string;
  secretPin: string; // 4-digit ATM collection PIN
  amount: number;
  accountId?: string;
}

interface TapPayContextValue {
  isHydrated: boolean;
  encryptionProfile: EncryptionProfile | null;
  storageCipherSample: string;
  wallet: TapPayWallet;
  accounts: LinkedBankAccount[];
  defaultAccount: LinkedBankAccount;
  activeNfcSourceId: string;
  transactions: Transaction[];
  nfcSettings: NfcSettings;
  themePreference: ThemePreference;
  todayNfcSpend: number;
  totalBankBalance: number;
  totalBalance: number;
  setThemePreference: (pref: ThemePreference) => void;
  updateNfcSettings: (partial: Partial<NfcSettings>) => void;
  rotateEncryptionKeys: () => Promise<EncryptionProfile | null>;
  setDefaultAccount: (accountId: string) => void;
  selectPrimaryNfcSource: (sourceId: string) => void;
  toggleAccountNfc: (accountId: string) => void;
  toggleWalletNfc: () => void;
  topUpWallet: (
    input: WalletTopUpInput
  ) => { ok: boolean; tx?: Transaction; error?: string };
  cashOutWalletToBank: (
    input: WalletCashOutInput
  ) => { ok: boolean; tx?: Transaction; error?: string };
  linkNewBankAccount: (input: LinkBankInput) => LinkedBankAccount;
  removeBankAccount: (accountId: string) => { ok: boolean; error?: string };
  executeTapPayment: (
    input: ExecuteTapPayInput
  ) => { ok: boolean; tx?: Transaction; error?: string };
  executeSoftPosReceive: (
    input: ExecuteSoftPosReceiveInput
  ) => { ok: boolean; tx?: Transaction; error?: string };
  executePayShapTransfer: (
    input: ExecutePayShapInput
  ) => { ok: boolean; tx?: Transaction; error?: string };
  executeVasPurchase: (
    input: ExecuteVasInput
  ) => { ok: boolean; tx?: Transaction; error?: string };
  executeCashSend: (
    input: ExecuteCashSendInput
  ) => { ok: boolean; tx?: Transaction; error?: string };
  resetDemoData: () => Promise<void>;
  refreshLedger: () => Promise<void>;
}

const TapPayContext = createContext<TapPayContextValue | undefined>(undefined);

export function TapPayProvider({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [encryptionProfile, setEncryptionProfile] =
    useState<EncryptionProfile | null>(null);
  const [storageCipherSample, setStorageCipherSample] = useState('');
  const vaultKeyRef = useRef<Uint8Array | null>(null);
  const profileRef = useRef<EncryptionProfile | null>(null);

  const [wallet, setWallet] = useState<TapPayWallet>(INITIAL_WALLET);
  const [accounts, setAccounts] =
    useState<LinkedBankAccount[]>(INITIAL_ACCOUNTS);
  const [transactions, setTransactions] =
    useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [nfcSettings, setNfcSettings] = useState<NfcSettings>(DEFAULT_SETTINGS);
  const [themePreference, setThemePrefState] =
    useState<ThemePreference>('system');

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      try {
        // 1. Provision or unlock Hardware Device Key + FICA User Key
        const enclave = await initializeDeviceAndUserEncryption(
          DEFAULT_SETTINGS.pinCode
        );
        vaultKeyRef.current = enclave.vaultKey;
        profileRef.current = enclave.profile;

        const [accRaw, walRaw, txRaw, setRaw, themeRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.ACCOUNTS),
          AsyncStorage.getItem(STORAGE_KEYS.WALLET),
          AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS),
          AsyncStorage.getItem(STORAGE_KEYS.SETTINGS),
          AsyncStorage.getItem(STORAGE_KEYS.THEME),
        ]);
        if (!mounted) return;

        let loadedAccounts = INITIAL_ACCOUNTS;
        let loadedWallet = INITIAL_WALLET;
        let loadedTx = INITIAL_TRANSACTIONS;
        let loadedSettings = DEFAULT_SETTINGS;

        if (setRaw) {
          const decSet = decryptVaultPayload(setRaw, enclave.vaultKey);
          if (decSet) {
            loadedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(decSet) };
          }
        }
        if (accRaw) {
          const decAcc = decryptVaultPayload(accRaw, enclave.vaultKey);
          if (decAcc) {
            const parsed = JSON.parse(decAcc);
            if (Array.isArray(parsed) && parsed.length > 0) {
              loadedAccounts = parsed;
            }
          }
        }
        if (walRaw) {
          const decWal = decryptVaultPayload(walRaw, enclave.vaultKey);
          if (decWal) {
            loadedWallet = { ...INITIAL_WALLET, ...JSON.parse(decWal) };
          }
        }
        if (txRaw) {
          const decTx = decryptVaultPayload(txRaw, enclave.vaultKey);
          if (decTx) {
            const parsed = JSON.parse(decTx);
            if (Array.isArray(parsed)) {
              loadedTx = parsed;
            }
          }
        }

        // Sign all transactions with Device + User ARQC signature if not yet stamped
        const signedTx = loadedTx.map((tx) =>
          tx.e2eeSignature
            ? tx
            : {
                ...tx,
                encryptedDeviceId: enclave.profile.deviceId,
                e2eeSignature: signTransactionCryptogram(enclave.vaultKey, {
                  utrReference: tx.utrReference,
                  amount: tx.amount,
                  accountId: tx.accountId,
                  deviceId: enclave.profile.deviceId,
                  userId: enclave.profile.userId,
                  timestamp: tx.timestamp,
                }),
              }
        );

        // Encrypt at rest immediately (migrates any plaintext storage to TPENC1 ciphertext)
        const encryptedAccountsBlob = encryptVaultPayload(
          JSON.stringify(loadedAccounts),
          enclave.vaultKey
        );
        const encryptedWalletBlob = encryptVaultPayload(
          JSON.stringify(loadedWallet),
          enclave.vaultKey
        );
        const encryptedTxBlob = encryptVaultPayload(
          JSON.stringify(signedTx),
          enclave.vaultKey
        );
        const encryptedSettingsBlob = encryptVaultPayload(
          JSON.stringify(loadedSettings),
          enclave.vaultKey
        );

        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, encryptedAccountsBlob),
          AsyncStorage.setItem(STORAGE_KEYS.WALLET, encryptedWalletBlob),
          AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, encryptedTxBlob),
          AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, encryptedSettingsBlob),
        ]);

        if (!mounted) return;
        setEncryptionProfile(enclave.profile);
        setStorageCipherSample(encryptedAccountsBlob.slice(0, 48) + '...');
        setAccounts(loadedAccounts);
        setWallet(loadedWallet);
        setTransactions(signedTx);
        setNfcSettings(loadedSettings);

        if (
          themeRaw === 'light' ||
          themeRaw === 'dark' ||
          themeRaw === 'system'
        ) {
          setThemePrefState(themeRaw);
        }
      } catch {
        // Fallback to initial seeded SA state
      } finally {
        if (mounted) setIsHydrated(true);
      }
    }
    hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const persistWallet = useCallback((next: TapPayWallet) => {
    setWallet(next);
    const json = JSON.stringify(next);
    const payload = vaultKeyRef.current
      ? encryptVaultPayload(json, vaultKeyRef.current)
      : json;
    AsyncStorage.setItem(STORAGE_KEYS.WALLET, payload).catch(() => {});
  }, []);

  const persistAccounts = useCallback((next: LinkedBankAccount[]) => {
    setAccounts(next);
    const json = JSON.stringify(next);
    const payload = vaultKeyRef.current
      ? encryptVaultPayload(json, vaultKeyRef.current)
      : json;
    if (payload.startsWith('TPENC1:')) {
      setStorageCipherSample(payload.slice(0, 48) + '...');
    }
    AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, payload).catch(() => {});
  }, []);

  const persistTransactions = useCallback((next: Transaction[]) => {
    const vKey = vaultKeyRef.current;
    const prof = profileRef.current;
    if (vKey && prof) {
      next.forEach((tx) => {
        if (!tx.e2eeSignature) {
          tx.encryptedDeviceId = prof.deviceId;
          tx.e2eeSignature = signTransactionCryptogram(vKey, {
            utrReference: tx.utrReference,
            amount: tx.amount,
            accountId: tx.accountId,
            deviceId: prof.deviceId,
            userId: prof.userId,
            timestamp: tx.timestamp,
          });
        }
      });
    }
    setTransactions([...next]);
    const json = JSON.stringify(next);
    const payload = vKey ? encryptVaultPayload(json, vKey) : json;
    AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, payload).catch(() => {});
  }, []);

  const updateNfcSettings = useCallback((partial: Partial<NfcSettings>) => {
    setNfcSettings((prev) => {
      const updated = { ...prev, ...partial };
      const json = JSON.stringify(updated);
      const payload = vaultKeyRef.current
        ? encryptVaultPayload(json, vaultKeyRef.current)
        : json;
      AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, payload).catch(() => {});
      return updated;
    });
  }, []);

  const rotateEncryptionKeys =
    useCallback(async (): Promise<EncryptionProfile | null> => {
      const currentEpoch = profileRef.current?.keyEpoch || 1;
      const enclave = await rotateDeviceAndUserKeys(
        nfcSettings.pinCode,
        currentEpoch
      );
      vaultKeyRef.current = enclave.vaultKey;
      profileRef.current = enclave.profile;
      setEncryptionProfile(enclave.profile);

      // Re-encrypt all stored user + bank + wallet data under the newly rotated key epoch
      const encAcc = encryptVaultPayload(
        JSON.stringify(accounts),
        enclave.vaultKey
      );
      const encWal = encryptVaultPayload(
        JSON.stringify(wallet),
        enclave.vaultKey
      );
      const encTx = encryptVaultPayload(
        JSON.stringify(transactions),
        enclave.vaultKey
      );
      const encSet = encryptVaultPayload(
        JSON.stringify(nfcSettings),
        enclave.vaultKey
      );

      setStorageCipherSample(encAcc.slice(0, 48) + '...');
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, encAcc),
        AsyncStorage.setItem(STORAGE_KEYS.WALLET, encWal),
        AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, encTx),
        AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, encSet),
      ]);
      triggerHaptic('success', nfcSettings.hapticsEnabled);
      return enclave.profile;
    }, [accounts, wallet, transactions, nfcSettings]);

  const setThemePreference = useCallback((pref: ThemePreference) => {
    setThemePrefState(pref);
    AsyncStorage.setItem(STORAGE_KEYS.THEME, pref).catch(() => {});
  }, []);

  const defaultAccount = useMemo(() => {
    return accounts.find((a) => a.isDefault) || accounts[0];
  }, [accounts]);

  const activeNfcSourceId = useMemo(() => {
    return wallet.isPrimaryNfc ? TAPPAY_WALLET_ID : defaultAccount.id;
  }, [wallet.isPrimaryNfc, defaultAccount.id]);

  const totalBankBalance = useMemo(() => {
    return accounts.reduce((sum, a) => sum + a.balance, 0);
  }, [accounts]);

  const totalBalance = useMemo(() => {
    return Number((totalBankBalance + wallet.balance).toFixed(2));
  }, [totalBankBalance, wallet.balance]);

  const todayNfcSpend = useMemo(() => {
    const now = new Date();
    return transactions
      .filter((tx) => {
        if (tx.direction !== 'out' || tx.channel === 'Wallet Transfer') {
          return false;
        }
        const d = new Date(tx.timestamp);
        return (
          d.getDate() === now.getDate() &&
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions]);

  const setDefaultAccount = useCallback(
    (accountId: string) => {
      triggerHaptic('light', nfcSettings.hapticsEnabled);
      if (accountId === TAPPAY_WALLET_ID) {
        persistWallet({ ...wallet, isPrimaryNfc: true });
        return;
      }
      const next = accounts.map((acc) => ({
        ...acc,
        isDefault: acc.id === accountId,
      }));
      persistAccounts(next);
      if (wallet.isPrimaryNfc) {
        persistWallet({ ...wallet, isPrimaryNfc: false });
      }
    },
    [accounts, nfcSettings.hapticsEnabled, persistAccounts, persistWallet, wallet]
  );

  const selectPrimaryNfcSource = useCallback(
    (sourceId: string) => {
      setDefaultAccount(sourceId);
    },
    [setDefaultAccount]
  );

  const toggleAccountNfc = useCallback(
    (accountId: string) => {
      triggerHaptic('light', nfcSettings.hapticsEnabled);
      const next = accounts.map((acc) =>
        acc.id === accountId ? { ...acc, nfcEnabled: !acc.nfcEnabled } : acc
      );
      persistAccounts(next);
    },
    [accounts, nfcSettings.hapticsEnabled, persistAccounts]
  );

  const toggleWalletNfc = useCallback(() => {
    triggerHaptic('light', nfcSettings.hapticsEnabled);
    persistWallet({ ...wallet, nfcEnabled: !wallet.nfcEnabled });
  }, [nfcSettings.hapticsEnabled, persistWallet, wallet]);

  const topUpWallet = useCallback(
    (
      input: WalletTopUpInput
    ): { ok: boolean; tx?: Transaction; error?: string } => {
      if (input.amount <= 0 || Number.isNaN(input.amount)) {
        return { ok: false, error: 'Enter a valid ZAR top-up amount.' };
      }

      if (wallet.balance + input.amount > wallet.maxCap) {
        return {
          ok: false,
          error: `SARB FICA Tier-2 e-Money wallet cap is R ${wallet.maxCap.toLocaleString()}. Max top-up right now is R ${(
            wallet.maxCap - wallet.balance
          ).toFixed(2)}.`,
        };
      }

      const maskedWallet = `•• ${wallet.walletNumber.slice(-4)}`;

      if (input.method === 'retail_voucher') {
        const label = input.voucherLabel || 'Pick n Pay / Boxer Till Cash';
        const newTx: Transaction = {
          id: `tx-${Date.now()}`,
          utrReference: generateUTR('WLT'),
          title: `${label} Top-Up`,
          subtitle: 'Independent Cash / Voucher → TapPay Wallet',
          amount: Number(input.amount.toFixed(2)),
          fee: 0,
          direction: 'in',
          channel: 'Wallet Transfer',
          category: 'Wallet Funding',
          accountId: TAPPAY_WALLET_ID,
          bankShortName: 'TapPay Wallet',
          maskedAccount: maskedWallet,
          counterpartyBank: 'SARB Ring-Fenced e-Money Trust',
          cardOrDeviceHint: `${label} Instant Deposit`,
          timestamp: new Date().toISOString(),
          status: 'Settled',
        };

        persistWallet({
          ...wallet,
          balance: Number((wallet.balance + input.amount).toFixed(2)),
        });
        persistTransactions([newTx, ...transactions]);
        triggerHaptic('success', nfcSettings.hapticsEnabled);
        return { ok: true, tx: newTx };
      }

      // Method === 'bank'
      const sourceBankAcc =
        accounts.find((a) => a.id === input.bankAccountId) || defaultAccount;
      const bank = SA_BANKS[sourceBankAcc.bankId];

      if (sourceBankAcc.balance < input.amount) {
        return {
          ok: false,
          error: `Insufficient funds in ${bank.shortName} (${maskAccountNumber(
            sourceBankAcc.accountNumber
          )}).`,
        };
      }

      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        utrReference: generateUTR('WLT'),
        title: `Wallet Top-Up from ${bank.shortName}`,
        subtitle: `${bank.shortName} ${maskAccountNumber(
          sourceBankAcc.accountNumber
        )} → TapPay Wallet`,
        amount: Number(input.amount.toFixed(2)),
        fee: 0,
        direction: 'in',
        channel: 'Wallet Transfer',
        category: 'Wallet Funding',
        accountId: TAPPAY_WALLET_ID,
        bankShortName: 'TapPay Wallet',
        maskedAccount: maskedWallet,
        counterpartyBank: `${bank.name} (${maskAccountNumber(
          sourceBankAcc.accountNumber
        )})`,
        cardOrDeviceHint: 'Instant RTC Bank-to-Wallet Load',
        timestamp: new Date().toISOString(),
        status: 'Settled',
      };

      const nextAccounts = accounts.map((a) =>
        a.id === sourceBankAcc.id
          ? { ...a, balance: Number((a.balance - input.amount).toFixed(2)) }
          : a
      );

      persistAccounts(nextAccounts);
      persistWallet({
        ...wallet,
        balance: Number((wallet.balance + input.amount).toFixed(2)),
      });
      persistTransactions([newTx, ...transactions]);
      triggerHaptic('success', nfcSettings.hapticsEnabled);
      return { ok: true, tx: newTx };
    },
    [
      accounts,
      defaultAccount,
      nfcSettings.hapticsEnabled,
      persistAccounts,
      persistTransactions,
      persistWallet,
      transactions,
      wallet,
    ]
  );

  const cashOutWalletToBank = useCallback(
    (
      input: WalletCashOutInput
    ): { ok: boolean; tx?: Transaction; error?: string } => {
      if (input.amount <= 0 || Number.isNaN(input.amount)) {
        return { ok: false, error: 'Enter a valid ZAR withdrawal amount.' };
      }

      if (wallet.balance < input.amount) {
        return {
          ok: false,
          error: 'Insufficient available balance in your TapPay Wallet.',
        };
      }

      const destAcc =
        accounts.find((a) => a.id === input.bankAccountId) || defaultAccount;
      const bank = SA_BANKS[destAcc.bankId];
      const maskedBank = maskAccountNumber(destAcc.accountNumber);
      const maskedWallet = `•• ${wallet.walletNumber.slice(-4)}`;

      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        utrReference: generateUTR('WLT'),
        title: `Cash Out to ${bank.shortName}`,
        subtitle: `TapPay Wallet → ${bank.shortName} ${maskedBank}`,
        amount: Number(input.amount.toFixed(2)),
        fee: 0,
        direction: 'out',
        channel: 'Wallet Transfer',
        category: 'Wallet Funding',
        accountId: TAPPAY_WALLET_ID,
        bankShortName: 'TapPay Wallet',
        maskedAccount: maskedWallet,
        counterpartyBank: `${bank.name} (${maskedBank})`,
        cardOrDeviceHint: 'Instant RTC Wallet-to-Bank Payout',
        timestamp: new Date().toISOString(),
        status: 'Settled',
      };

      const nextAccounts = accounts.map((a) =>
        a.id === destAcc.id
          ? { ...a, balance: Number((a.balance + input.amount).toFixed(2)) }
          : a
      );

      persistAccounts(nextAccounts);
      persistWallet({
        ...wallet,
        balance: Number((wallet.balance - input.amount).toFixed(2)),
      });
      persistTransactions([newTx, ...transactions]);
      triggerHaptic('success', nfcSettings.hapticsEnabled);
      return { ok: true, tx: newTx };
    },
    [
      accounts,
      defaultAccount,
      nfcSettings.hapticsEnabled,
      persistAccounts,
      persistTransactions,
      persistWallet,
      transactions,
      wallet,
    ]
  );

  const linkNewBankAccount = useCallback(
    (input: LinkBankInput): LinkedBankAccount => {
      const bank = SA_BANKS[input.bankId];
      const cleanAcc = input.accountNumber.replace(/\D/g, '');
      const newAcc: LinkedBankAccount = {
        id: `acc-${input.bankId}-${Date.now()}`,
        bankId: input.bankId,
        accountHolder: input.accountHolder.trim().toUpperCase() || 'T MOKOENA',
        accountNumber: cleanAcc,
        accountType: input.accountType,
        branchCode: bank.universalBranchCode,
        balance: input.initialBalance,
        isDefault: input.makeDefault || accounts.length === 0,
        nfcEnabled: true,
        shapId: `0824917732@${bank.payShapDomain}`,
        linkedAt: new Date().toISOString(),
        mandateRef: `DBK-${bank.id.slice(0, 3).toUpperCase()}-${Math.floor(
          100000 + Math.random() * 900000
        )}`,
      };

      const updated = input.makeDefault
        ? [...accounts.map((a) => ({ ...a, isDefault: false })), newAcc]
        : [...accounts, newAcc];

      persistAccounts(updated);
      if (input.makeDefault && wallet.isPrimaryNfc) {
        persistWallet({ ...wallet, isPrimaryNfc: false });
      }
      triggerHaptic('success', nfcSettings.hapticsEnabled);
      return newAcc;
    },
    [
      accounts,
      nfcSettings.hapticsEnabled,
      persistAccounts,
      persistWallet,
      wallet,
    ]
  );

  const removeBankAccount = useCallback(
    (accountId: string): { ok: boolean; error?: string } => {
      if (accounts.length <= 1) {
        return {
          ok: false,
          error: 'At least one South African bank account must remain linked.',
        };
      }
      const target = accounts.find((a) => a.id === accountId);
      const remaining = accounts.filter((a) => a.id !== accountId);
      if (target?.isDefault && remaining.length > 0) {
        remaining[0] = { ...remaining[0], isDefault: true };
      }
      persistAccounts(remaining);
      triggerHaptic('warning', nfcSettings.hapticsEnabled);
      return { ok: true };
    },
    [accounts, nfcSettings.hapticsEnabled, persistAccounts]
  );

  const executeTapPayment = useCallback(
    (
      input: ExecuteTapPayInput
    ): { ok: boolean; tx?: Transaction; error?: string } => {
      const resolvedId = input.accountId || activeNfcSourceId;

      if (input.amount <= 0 || Number.isNaN(input.amount)) {
        return { ok: false, error: 'Enter a valid ZAR payment amount.' };
      }

      if (todayNfcSpend + input.amount > nfcSettings.dailyLimit) {
        return {
          ok: false,
          error: `Exceeds your daily NFC limit of R ${nfcSettings.dailyLimit.toLocaleString()}. Adjust limit in Banks tab.`,
        };
      }

      // Independent TapPay Wallet path
      if (resolvedId === TAPPAY_WALLET_ID) {
        if (!wallet.nfcEnabled) {
          return {
            ok: false,
            error:
              'NFC contactless tap is currently paused on your TapPay Wallet.',
          };
        }
        if (wallet.balance < input.amount) {
          return {
            ok: false,
            error:
              'Insufficient funds in your TapPay Wallet. Top up or switch to a linked SA bank.',
          };
        }

        const maskedWallet = `•• ${wallet.walletNumber.slice(-4)}`;
        const newTx: Transaction = {
          id: `tx-${Date.now()}`,
          utrReference: generateUTR('TAP'),
          title: input.merchantName,
          subtitle: input.subtitle,
          amount: Number(input.amount.toFixed(2)),
          fee: 0,
          direction: 'out',
          channel: 'NFC Tap to Pay',
          category: input.category,
          accountId: TAPPAY_WALLET_ID,
          bankShortName: 'TapPay Wallet',
          maskedAccount: maskedWallet,
          counterpartyBank: input.acquirerBank,
          cardOrDeviceHint: `TapPay e-Money Token ${maskedWallet}${
            input.pinVerified ? ' (PIN Verified)' : ''
          }`,
          timestamp: new Date().toISOString(),
          status: 'Settled',
        };

        persistWallet({
          ...wallet,
          balance: Number((wallet.balance - input.amount).toFixed(2)),
        });
        persistTransactions([newTx, ...transactions]);
        triggerHaptic('success', nfcSettings.hapticsEnabled);
        return { ok: true, tx: newTx };
      }

      // Direct-to-Bank path
      const targetAcc =
        accounts.find((a) => a.id === resolvedId) || defaultAccount;

      if (!targetAcc.nfcEnabled) {
        return {
          ok: false,
          error: `NFC contactless tap is currently paused on ${
            SA_BANKS[targetAcc.bankId].shortName
          } ${maskAccountNumber(targetAcc.accountNumber)}.`,
        };
      }

      if (targetAcc.balance < input.amount) {
        return {
          ok: false,
          error: `Insufficient available funds in ${
            SA_BANKS[targetAcc.bankId].shortName
          } (${maskAccountNumber(targetAcc.accountNumber)}).`,
        };
      }

      const bank = SA_BANKS[targetAcc.bankId];
      const masked = maskAccountNumber(targetAcc.accountNumber);

      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        utrReference: generateUTR('TAP'),
        title: input.merchantName,
        subtitle: input.subtitle,
        amount: Number(input.amount.toFixed(2)),
        fee: 0,
        direction: 'out',
        channel: 'NFC Tap to Pay',
        category: input.category,
        accountId: targetAcc.id,
        bankShortName: bank.shortName,
        maskedAccount: masked,
        counterpartyBank: input.acquirerBank,
        cardOrDeviceHint: `HCE Direct Token ${masked}${
          input.pinVerified ? ' (PIN Verified)' : ''
        }`,
        timestamp: new Date().toISOString(),
        status: 'Settled',
      };

      const nextAccounts = accounts.map((a) =>
        a.id === targetAcc.id
          ? { ...a, balance: Number((a.balance - input.amount).toFixed(2)) }
          : a
      );

      persistAccounts(nextAccounts);
      persistTransactions([newTx, ...transactions]);
      triggerHaptic('success', nfcSettings.hapticsEnabled);

      return { ok: true, tx: newTx };
    },
    [
      accounts,
      activeNfcSourceId,
      defaultAccount,
      nfcSettings.dailyLimit,
      nfcSettings.hapticsEnabled,
      persistAccounts,
      persistTransactions,
      persistWallet,
      todayNfcSpend,
      transactions,
      wallet,
    ]
  );

  const executeSoftPosReceive = useCallback(
    (
      input: ExecuteSoftPosReceiveInput
    ): { ok: boolean; tx?: Transaction; error?: string } => {
      const resolvedId = input.accountId || activeNfcSourceId;

      if (input.amount <= 0 || Number.isNaN(input.amount)) {
        return { ok: false, error: 'Enter a valid amount to receive.' };
      }

      // TapPay Direct P2P is R 0.00 fee; EMV card SoftPOS clearing is 0.45% capped at R 18.00
      const rawFee = input.isCommercialCard
        ? Math.min(18, Number((input.amount * 0.0045).toFixed(2)))
        : 0;
      const netCredit = Number((input.amount - rawFee).toFixed(2));

      // Independent TapPay Wallet path
      if (resolvedId === TAPPAY_WALLET_ID) {
        if (wallet.balance + netCredit > wallet.maxCap) {
          return {
            ok: false,
            error: `Would exceed your R ${wallet.maxCap.toLocaleString()} SARB wallet cap. Cash out to a linked bank or switch settlement to bank.`,
          };
        }

        const maskedWallet = `•• ${wallet.walletNumber.slice(-4)}`;
        const newTx: Transaction = {
          id: `tx-${Date.now()}`,
          utrReference: generateUTR('POS'),
          title: input.payerName,
          subtitle: input.referenceNote
            ? `${input.referenceNote} • Credited to Wallet`
            : 'SoftPOS Contactless • Credited to Wallet',
          amount: Number(input.amount.toFixed(2)),
          fee: rawFee,
          direction: 'in',
          channel: 'NFC SoftPOS Receive',
          category: input.isCommercialCard ? 'Market & Retail' : 'Peer Transfer',
          accountId: TAPPAY_WALLET_ID,
          bankShortName: 'TapPay Wallet',
          maskedAccount: maskedWallet,
          counterpartyBank: input.payerBank,
          cardOrDeviceHint: input.cardOrDeviceHint,
          timestamp: new Date().toISOString(),
          status: 'Settled',
        };

        persistWallet({
          ...wallet,
          balance: Number((wallet.balance + netCredit).toFixed(2)),
        });
        persistTransactions([newTx, ...transactions]);
        triggerHaptic('success', nfcSettings.hapticsEnabled);
        return { ok: true, tx: newTx };
      }

      // Direct-to-Bank path
      const targetAcc =
        accounts.find((a) => a.id === resolvedId) || defaultAccount;
      const bank = SA_BANKS[targetAcc.bankId];
      const masked = maskAccountNumber(targetAcc.accountNumber);

      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        utrReference: generateUTR('POS'),
        title: input.payerName,
        subtitle: input.referenceNote
          ? `${input.referenceNote} • Tap Received`
          : 'SoftPOS Contactless • Tap Received',
        amount: Number(input.amount.toFixed(2)),
        fee: rawFee,
        direction: 'in',
        channel: 'NFC SoftPOS Receive',
        category: input.isCommercialCard ? 'Market & Retail' : 'Peer Transfer',
        accountId: targetAcc.id,
        bankShortName: bank.shortName,
        maskedAccount: masked,
        counterpartyBank: input.payerBank,
        cardOrDeviceHint: input.cardOrDeviceHint,
        timestamp: new Date().toISOString(),
        status: 'Settled',
      };

      const nextAccounts = accounts.map((a) =>
        a.id === targetAcc.id
          ? { ...a, balance: Number((a.balance + netCredit).toFixed(2)) }
          : a
      );

      persistAccounts(nextAccounts);
      persistTransactions([newTx, ...transactions]);
      triggerHaptic('success', nfcSettings.hapticsEnabled);

      return { ok: true, tx: newTx };
    },
    [
      accounts,
      activeNfcSourceId,
      defaultAccount,
      nfcSettings.hapticsEnabled,
      persistAccounts,
      persistTransactions,
      persistWallet,
      transactions,
      wallet,
    ]
  );

  const executePayShapTransfer = useCallback(
    (
      input: ExecutePayShapInput
    ): { ok: boolean; tx?: Transaction; error?: string } => {
      const resolvedId = input.accountId || activeNfcSourceId;

      if (input.amount <= 0 || Number.isNaN(input.amount)) {
        return { ok: false, error: 'Enter a valid ZAR amount.' };
      }

      if (input.amount > 50000) {
        return {
          ok: false,
          error:
            'PayShap real-time clearing maximum is R 50,000 per transaction.',
        };
      }

      // TapPay Wallet PayShap transfers under R 500 are R 0.00, else R 1.50; bank PayShap free under R 100
      const isWallet = resolvedId === TAPPAY_WALLET_ID;
      const fee = isWallet
        ? input.amount > 500
          ? 1.5
          : 0
        : input.amount > 100
        ? 1.5
        : 0;
      const totalDebit = Number((input.amount + fee).toFixed(2));

      if (isWallet) {
        if (wallet.balance < totalDebit) {
          return {
            ok: false,
            error: 'Insufficient funds in your TapPay Wallet.',
          };
        }

        const maskedWallet = `•• ${wallet.walletNumber.slice(-4)}`;
        const newTx: Transaction = {
          id: `tx-${Date.now()}`,
          utrReference: generateUTR('SHP'),
          title: input.recipientName,
          subtitle: input.reference
            ? `PayShap • ${input.reference}`
            : `PayShap • ${input.shapId}`,
          amount: Number(input.amount.toFixed(2)),
          fee,
          direction: 'out',
          channel: 'PayShap Instant',
          category: 'Peer Transfer',
          accountId: TAPPAY_WALLET_ID,
          bankShortName: 'TapPay Wallet',
          maskedAccount: maskedWallet,
          counterpartyBank: input.recipientBank,
          cardOrDeviceHint: `ShapID ${input.shapId}`,
          timestamp: new Date().toISOString(),
          status: 'Settled',
        };

        persistWallet({
          ...wallet,
          balance: Number((wallet.balance - totalDebit).toFixed(2)),
        });
        persistTransactions([newTx, ...transactions]);
        triggerHaptic('success', nfcSettings.hapticsEnabled);
        return { ok: true, tx: newTx };
      }

      const targetAcc =
        accounts.find((a) => a.id === resolvedId) || defaultAccount;

      if (targetAcc.balance < totalDebit) {
        return {
          ok: false,
          error: `Insufficient funds in ${
            SA_BANKS[targetAcc.bankId].shortName
          } account.`,
        };
      }

      const bank = SA_BANKS[targetAcc.bankId];
      const masked = maskAccountNumber(targetAcc.accountNumber);

      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        utrReference: generateUTR('SHP'),
        title: input.recipientName,
        subtitle: input.reference
          ? `PayShap • ${input.reference}`
          : `PayShap • ${input.shapId}`,
        amount: Number(input.amount.toFixed(2)),
        fee,
        direction: 'out',
        channel: 'PayShap Instant',
        category: 'Peer Transfer',
        accountId: targetAcc.id,
        bankShortName: bank.shortName,
        maskedAccount: masked,
        counterpartyBank: input.recipientBank,
        cardOrDeviceHint: `ShapID ${input.shapId}`,
        timestamp: new Date().toISOString(),
        status: 'Settled',
      };

      const nextAccounts = accounts.map((a) =>
        a.id === targetAcc.id
          ? { ...a, balance: Number((a.balance - totalDebit).toFixed(2)) }
          : a
      );

      persistAccounts(nextAccounts);
      persistTransactions([newTx, ...transactions]);
      triggerHaptic('success', nfcSettings.hapticsEnabled);

      return { ok: true, tx: newTx };
    },
    [
      accounts,
      activeNfcSourceId,
      defaultAccount,
      nfcSettings.hapticsEnabled,
      persistAccounts,
      persistTransactions,
      persistWallet,
      transactions,
      wallet,
    ]
  );

  const executeVasPurchase = useCallback(
    (
      input: ExecuteVasInput
    ): { ok: boolean; tx?: Transaction; error?: string } => {
      const resolvedId = input.accountId || activeNfcSourceId;

      if (input.amount <= 0 || Number.isNaN(input.amount)) {
        return { ok: false, error: 'Enter a valid ZAR amount.' };
      }

      const isWallet = resolvedId === TAPPAY_WALLET_ID;
      // Municipal EFT via Bank incurs R 2.00 EasyPay clearing; Wallet VAS & Prepaid are R 0.00 fee
      const fee = input.serviceType === 'municipal' && !isWallet ? 2.0 : 0;
      const totalDebit = Number((input.amount + fee).toFixed(2));

      const isElectricity = input.serviceType === 'electricity';
      const kwhUnits = isElectricity
        ? (input.amount / 3.42).toFixed(1)
        : null;
      const stsToken = isElectricity ? generateStsToken() : undefined;

      const subtitle =
        input.serviceType === 'electricity'
          ? `Prepaid Electricity • ${kwhUnits} kWh`
          : input.serviceType === 'municipal'
          ? `Municipal Acct #${input.targetIdentifier}`
          : `${input.productDescription} • ${input.targetIdentifier}`;

      const counterpartySwitch =
        input.serviceType === 'electricity'
          ? 'STS National Vending Switch'
          : input.serviceType === 'municipal'
          ? 'EasyPay / Municipal Clearing'
          : `${input.providerName} Pinless Direct`;

      const hint =
        input.serviceType === 'electricity'
          ? `Meter #${input.targetIdentifier} (${kwhUnits} kWh)`
          : input.serviceType === 'municipal'
          ? `Municipal Ref #${input.targetIdentifier}`
          : `SIM ${input.targetIdentifier} • Instant Pinless`;

      const vasMeta = isElectricity
        ? `${kwhUnits} kWh • Meter ${input.targetIdentifier}`
        : input.serviceType === 'municipal'
        ? `${input.productDescription} • Acct #${input.targetIdentifier}`
        : `${input.productDescription} • ${input.targetIdentifier}`;

      if (isWallet) {
        if (wallet.balance < totalDebit) {
          return {
            ok: false,
            error:
              'Insufficient funds in your TapPay Wallet. Top up or choose a linked SA bank.',
          };
        }

        const maskedWallet = `•• ${wallet.walletNumber.slice(-4)}`;
        const newTx: Transaction = {
          id: `tx-${Date.now()}`,
          utrReference: generateUTR('VAS'),
          title: input.providerName,
          subtitle,
          amount: Number(input.amount.toFixed(2)),
          fee,
          direction: 'out',
          channel: 'Prepaid & Bills',
          category: 'Mobile & Utilities',
          accountId: TAPPAY_WALLET_ID,
          bankShortName: 'TapPay Wallet',
          maskedAccount: maskedWallet,
          counterpartyBank: counterpartySwitch,
          cardOrDeviceHint: hint,
          vasToken: stsToken,
          vasMeta,
          timestamp: new Date().toISOString(),
          status: 'Settled',
        };

        persistWallet({
          ...wallet,
          balance: Number((wallet.balance - totalDebit).toFixed(2)),
        });
        persistTransactions([newTx, ...transactions]);
        triggerHaptic('success', nfcSettings.hapticsEnabled);
        return { ok: true, tx: newTx };
      }

      const targetAcc =
        accounts.find((a) => a.id === resolvedId) || defaultAccount;
      if (targetAcc.balance < totalDebit) {
        return {
          ok: false,
          error: `Insufficient funds in ${
            SA_BANKS[targetAcc.bankId].shortName
          } account.`,
        };
      }

      const bank = SA_BANKS[targetAcc.bankId];
      const masked = maskAccountNumber(targetAcc.accountNumber);

      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        utrReference: generateUTR('VAS'),
        title: input.providerName,
        subtitle,
        amount: Number(input.amount.toFixed(2)),
        fee,
        direction: 'out',
        channel: 'Prepaid & Bills',
        category: 'Mobile & Utilities',
        accountId: targetAcc.id,
        bankShortName: bank.shortName,
        maskedAccount: masked,
        counterpartyBank: counterpartySwitch,
        cardOrDeviceHint: hint,
        vasToken: stsToken,
        vasMeta,
        timestamp: new Date().toISOString(),
        status: 'Settled',
      };

      const nextAccounts = accounts.map((a) =>
        a.id === targetAcc.id
          ? { ...a, balance: Number((a.balance - totalDebit).toFixed(2)) }
          : a
      );

      persistAccounts(nextAccounts);
      persistTransactions([newTx, ...transactions]);
      triggerHaptic('success', nfcSettings.hapticsEnabled);
      return { ok: true, tx: newTx };
    },
    [
      accounts,
      activeNfcSourceId,
      defaultAccount,
      nfcSettings.hapticsEnabled,
      persistAccounts,
      persistTransactions,
      persistWallet,
      transactions,
      wallet,
    ]
  );

  const executeCashSend = useCallback(
    (
      input: ExecuteCashSendInput
    ): { ok: boolean; tx?: Transaction; error?: string } => {
      const resolvedId = input.accountId || activeNfcSourceId;

      if (input.amount < 50 || Number.isNaN(input.amount)) {
        return {
          ok: false,
          error: 'Minimum SA ATM cardless cash withdrawal is R 50.00.',
        };
      }

      if (input.amount % 10 !== 0) {
        return {
          ok: false,
          error: 'Enter an ATM note multiple (e.g. R 50, R 100, R 200, R 500).',
        };
      }

      if (input.amount > 5000) {
        return {
          ok: false,
          error: 'Maximum single e-Wallet ATM cash voucher is R 5,000.00.',
        };
      }

      const isWallet = resolvedId === TAPPAY_WALLET_ID;
      // SA ATM Cash Send fee: R 7.50 flat via @TapPay Wallet; R 9.50 (<= R 1,000) or R 15.50 (> R 1,000) via Bank
      const fee = isWallet ? 7.5 : input.amount <= 1000 ? 9.5 : 15.5;
      const totalDebit = Number((input.amount + fee).toFixed(2));

      const voucherCode = generateCashVoucher();
      const voucherDisplay = `Voucher ${voucherCode} • PIN ${input.secretPin}`;
      const metaDisplay = `Recipient ${input.recipientPhone} • ${input.networkName}`;

      if (isWallet) {
        if (wallet.balance < totalDebit) {
          return {
            ok: false,
            error:
              'Insufficient funds in @TapPay Wallet (including R 7.50 ATM fee).',
          };
        }

        const maskedWallet = `•• ${wallet.walletNumber.slice(-4)}`;
        const newTx: Transaction = {
          id: `tx-${Date.now()}`,
          utrReference: generateUTR('ATM'),
          title: `${input.networkName} • ${input.recipientName}`,
          subtitle: `Instant ATM Cash • ${input.recipientPhone}`,
          amount: Number(input.amount.toFixed(2)),
          fee,
          direction: 'out',
          channel: 'e-Wallet Cash Send',
          category: 'Peer Transfer',
          accountId: TAPPAY_WALLET_ID,
          bankShortName: 'TapPay Wallet',
          maskedAccount: maskedWallet,
          counterpartyBank: `${input.networkName} ATM Switch`,
          cardOrDeviceHint: `${input.collectionHint} • Valid 30 Days`,
          vasToken: voucherDisplay,
          vasMeta: metaDisplay,
          timestamp: new Date().toISOString(),
          status: 'Settled',
        };

        persistWallet({
          ...wallet,
          balance: Number((wallet.balance - totalDebit).toFixed(2)),
        });
        persistTransactions([newTx, ...transactions]);
        triggerHaptic('success', nfcSettings.hapticsEnabled);
        return { ok: true, tx: newTx };
      }

      const targetAcc =
        accounts.find((a) => a.id === resolvedId) || defaultAccount;
      if (targetAcc.balance < totalDebit) {
        return {
          ok: false,
          error: `Insufficient funds in ${
            SA_BANKS[targetAcc.bankId].shortName
          } account.`,
        };
      }

      const bank = SA_BANKS[targetAcc.bankId];
      const masked = maskAccountNumber(targetAcc.accountNumber);

      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        utrReference: generateUTR('ATM'),
        title: `${input.networkName} • ${input.recipientName}`,
        subtitle: `Instant ATM Cash • ${input.recipientPhone}`,
        amount: Number(input.amount.toFixed(2)),
        fee,
        direction: 'out',
        channel: 'e-Wallet Cash Send',
        category: 'Peer Transfer',
        accountId: targetAcc.id,
        bankShortName: bank.shortName,
        maskedAccount: masked,
        counterpartyBank: `${input.networkName} ATM Switch`,
        cardOrDeviceHint: `${input.collectionHint} • Valid 30 Days`,
        vasToken: voucherDisplay,
        vasMeta: metaDisplay,
        timestamp: new Date().toISOString(),
        status: 'Settled',
      };

      const nextAccounts = accounts.map((a) =>
        a.id === targetAcc.id
          ? { ...a, balance: Number((a.balance - totalDebit).toFixed(2)) }
          : a
      );

      persistAccounts(nextAccounts);
      persistTransactions([newTx, ...transactions]);
      triggerHaptic('success', nfcSettings.hapticsEnabled);
      return { ok: true, tx: newTx };
    },
    [
      accounts,
      activeNfcSourceId,
      defaultAccount,
      nfcSettings.hapticsEnabled,
      persistAccounts,
      persistTransactions,
      persistWallet,
      transactions,
      wallet,
    ]
  );

  const resetDemoData = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.ACCOUNTS),
      AsyncStorage.removeItem(STORAGE_KEYS.WALLET),
      AsyncStorage.removeItem(STORAGE_KEYS.TRANSACTIONS),
      AsyncStorage.removeItem(STORAGE_KEYS.SETTINGS),
    ]);
    setWallet(INITIAL_WALLET);
    setAccounts(INITIAL_ACCOUNTS);
    setTransactions(INITIAL_TRANSACTIONS);
    setNfcSettings(DEFAULT_SETTINGS);
    triggerHaptic('medium', true);
  }, []);

  const refreshLedger = useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 650));
  }, []);

  const value = useMemo(
    () => ({
      isHydrated,
      encryptionProfile,
      storageCipherSample,
      wallet,
      accounts,
      defaultAccount,
      activeNfcSourceId,
      transactions,
      nfcSettings,
      themePreference,
      todayNfcSpend,
      totalBankBalance,
      totalBalance,
      setThemePreference,
      updateNfcSettings,
      rotateEncryptionKeys,
      setDefaultAccount,
      selectPrimaryNfcSource,
      toggleAccountNfc,
      toggleWalletNfc,
      topUpWallet,
      cashOutWalletToBank,
      linkNewBankAccount,
      removeBankAccount,
      executeTapPayment,
      executeSoftPosReceive,
      executePayShapTransfer,
      executeVasPurchase,
      executeCashSend,
      resetDemoData,
      refreshLedger,
    }),
    [
      isHydrated,
      encryptionProfile,
      storageCipherSample,
      wallet,
      accounts,
      defaultAccount,
      activeNfcSourceId,
      transactions,
      nfcSettings,
      themePreference,
      todayNfcSpend,
      totalBankBalance,
      totalBalance,
      setThemePreference,
      updateNfcSettings,
      rotateEncryptionKeys,
      setDefaultAccount,
      selectPrimaryNfcSource,
      toggleAccountNfc,
      toggleWalletNfc,
      topUpWallet,
      cashOutWalletToBank,
      linkNewBankAccount,
      removeBankAccount,
      executeTapPayment,
      executeSoftPosReceive,
      executePayShapTransfer,
      executeVasPurchase,
      executeCashSend,
      resetDemoData,
      refreshLedger,
    ]
  );

  return (
    <TapPayContext.Provider value={value}>{children}</TapPayContext.Provider>
  );
}

export function useTapPay() {
  const ctx = useContext(TapPayContext);
  if (!ctx) {
    throw new Error('useTapPay must be used within a TapPayProvider');
  }
  return ctx;
}
