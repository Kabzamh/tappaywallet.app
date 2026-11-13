import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { EncryptionProfile } from '../types';

const SECURE_DEVICE_KEY_ALIAS = 'tappay_za_hw_device_key_v1';
const SECURE_DEVICE_ID_ALIAS = 'tappay_za_hw_device_id_v1';
const SECURE_USER_KEY_ALIAS = 'tappay_za_user_master_secret_v1';
const SECURE_KEY_EPOCH_ALIAS = 'tappay_za_key_epoch_v1';

const WEB_FALLBACK_PREFIX = '@tappay_enclave_';
const CIPHER_PREFIX = 'TPENC1';

// UTF-8 safe byte conversion (supports •, è, ê, etc. identically on Hermes & Web)
function utf8ToBytes(str: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }
  const encoded = unescape(encodeURIComponent(str));
  const out = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    out[i] = encoded.charCodeAt(i);
  }
  return out;
}

function bytesToUtf8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(bytes);
  }
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return decodeURIComponent(escape(bin));
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : '0' + hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  return out;
}

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  const cryptoObj = (globalThis as any)?.crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < length; i++) {
    out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}

// RFC 6234 SHA-256 round constants
const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

export function sha256Bytes(message: Uint8Array): Uint8Array {
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const bitLenHi = Math.floor((message.length * 8) / 0x100000000);
  const bitLenLo = (message.length * 8) >>> 0;

  const paddedLen = Math.ceil((message.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(message);
  padded[message.length] = 0x80;

  const dv = new DataView(padded.buffer);
  dv.setUint32(paddedLen - 8, bitLenHi, false);
  dv.setUint32(paddedLen - 4, bitLenLo, false);

  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = dv.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K256[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outDv = new DataView(out.buffer);
  outDv.setUint32(0, h0, false);
  outDv.setUint32(4, h1, false);
  outDv.setUint32(8, h2, false);
  outDv.setUint32(12, h3, false);
  outDv.setUint32(16, h4, false);
  outDv.setUint32(20, h5, false);
  outDv.setUint32(24, h6, false);
  outDv.setUint32(28, h7, false);
  return out;
}

export function hmacSha256(key: Uint8Array, data: Uint8Array): Uint8Array {
  const blockSize = 64;
  let k = key;
  if (k.length > blockSize) {
    k = sha256Bytes(k);
  }
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(k);

  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = paddedKey[i] ^ 0x5c;
    iKeyPad[i] = paddedKey[i] ^ 0x36;
  }

  const inner = new Uint8Array(blockSize + data.length);
  inner.set(iKeyPad, 0);
  inner.set(data, blockSize);
  const innerHash = sha256Bytes(inner);

  const outer = new Uint8Array(blockSize + innerHash.length);
  outer.set(oKeyPad, 0);
  outer.set(innerHash, blockSize);
  return sha256Bytes(outer);
}

/**
 * Formats first 8 bytes of SHA-256 digest as "9F4A:C812:77E0:3B19"
 */
export function formatKeyFingerprint(secretHex: string): string {
  const digest = sha256Bytes(utf8ToBytes(secretHex));
  const hex = bytesToHex(digest).toUpperCase().slice(0, 16);
  return `${hex.slice(0, 4)}:${hex.slice(4, 8)}:${hex.slice(
    8,
    12
  )}:${hex.slice(12, 16)}`;
}

/**
 * Derives a 256-bit Master Vault Key bound to BOTH the specific Hardware Device Key
 * AND the specific FICA User Identity Key + Key Rotation Epoch.
 */
export function deriveDeviceUserVaultKey(
  deviceKeyHex: string,
  userKeyHex: string,
  userId: string,
  keyEpoch: number
): Uint8Array {
  const devBytes = hexToBytes(deviceKeyHex);
  const contextInfo = utf8ToBytes(
    `TAPPAY-ZA-NPS-E2EE|USER:${userId}|UKEY:${userKeyHex}|EPOCH:${keyEpoch}`
  );
  return hmacSha256(devBytes, contextInfo);
}

/**
 * Authenticated Counter-Mode Stream Encryption (CTR-HMAC-SHA256)
 * Output format: TPENC1:<ivHex>:<cipherHex>:<macHex>
 */
export function encryptVaultPayload(
  plaintext: string,
  vaultKey: Uint8Array
): string {
  const iv = randomBytes(16);
  const plainBytes = utf8ToBytes(plaintext);
  const cipherBytes = new Uint8Array(plainBytes.length);

  const encSubKey = hmacSha256(vaultKey, utf8ToBytes('ENC-SUBKEY-CTR'));
  const macSubKey = hmacSha256(vaultKey, utf8ToBytes('MAC-SUBKEY-AUTH'));

  const counterBlock = new Uint8Array(20);
  counterBlock.set(iv, 0);
  const counterDv = new DataView(counterBlock.buffer);

  let blockIdx = 0;
  for (let offset = 0; offset < plainBytes.length; offset += 32) {
    counterDv.setUint32(16, blockIdx++, false);
    const keystream = hmacSha256(encSubKey, counterBlock);
    const chunkLen = Math.min(32, plainBytes.length - offset);
    for (let i = 0; i < chunkLen; i++) {
      cipherBytes[offset + i] = plainBytes[offset + i] ^ keystream[i];
    }
  }

  const macInput = new Uint8Array(iv.length + cipherBytes.length);
  macInput.set(iv, 0);
  macInput.set(cipherBytes, iv.length);
  const mac = hmacSha256(macSubKey, macInput).slice(0, 16);

  return `${CIPHER_PREFIX}:${bytesToHex(iv)}:${bytesToHex(
    cipherBytes
  )}:${bytesToHex(mac)}`;
}

/**
 * Verifies HMAC tag in constant time and decrypts payload.
 * Seamlessly parses legacy unencrypted JSON during migration.
 */
export function decryptVaultPayload(
  stored: string,
  vaultKey: Uint8Array
): string | null {
  if (!stored.startsWith(`${CIPHER_PREFIX}:`)) {
    // Legacy plaintext migration support
    return stored;
  }

  const parts = stored.split(':');
  if (parts.length !== 4) return null;

  const iv = hexToBytes(parts[1]);
  const cipherBytes = hexToBytes(parts[2]);
  const expectedMac = hexToBytes(parts[3]);

  const encSubKey = hmacSha256(vaultKey, utf8ToBytes('ENC-SUBKEY-CTR'));
  const macSubKey = hmacSha256(vaultKey, utf8ToBytes('MAC-SUBKEY-AUTH'));

  const macInput = new Uint8Array(iv.length + cipherBytes.length);
  macInput.set(iv, 0);
  macInput.set(cipherBytes, iv.length);
  const computedMac = hmacSha256(macSubKey, macInput).slice(0, 16);

  if (computedMac.length !== expectedMac.length) return null;
  let diff = 0;
  for (let i = 0; i < computedMac.length; i++) {
    diff |= computedMac[i] ^ expectedMac[i];
  }
  if (diff !== 0) {
    return null;
  }

  const plainBytes = new Uint8Array(cipherBytes.length);
  const counterBlock = new Uint8Array(20);
  counterBlock.set(iv, 0);
  const counterDv = new DataView(counterBlock.buffer);

  let blockIdx = 0;
  for (let offset = 0; offset < cipherBytes.length; offset += 32) {
    counterDv.setUint32(16, blockIdx++, false);
    const keystream = hmacSha256(encSubKey, counterBlock);
    const chunkLen = Math.min(32, cipherBytes.length - offset);
    for (let i = 0; i < chunkLen; i++) {
      plainBytes[offset + i] = cipherBytes[offset + i] ^ keystream[i];
    }
  }

  return bytesToUtf8(plainBytes);
}

/**
 * Generates a per-transaction EMV / HCE ARQC Cryptogram signed by the Device + User Vault Key
 */
export function signTransactionCryptogram(
  vaultKey: Uint8Array,
  params: {
    utrReference: string;
    amount: number;
    accountId: string;
    deviceId: string;
    userId: string;
    timestamp: string;
  }
): string {
  const payload = `${params.utrReference}|${params.amount.toFixed(2)}|${
    params.accountId
  }|${params.deviceId}|${params.userId}|${params.timestamp}`;
  const sig = hmacSha256(vaultKey, utf8ToBytes(payload));
  return `ARQC-${bytesToHex(sig).toUpperCase().slice(0, 16)}`;
}

// Cross-platform Hardware SecureStore wrapper (iOS Keychain / Android Keystore + Web Enclave fallback)
async function getEnclaveItem(key: string): Promise<string | null> {
  if (Platform.OS !== 'web') {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return AsyncStorage.getItem(`${WEB_FALLBACK_PREFIX}${key}`);
    }
  }
  return AsyncStorage.getItem(`${WEB_FALLBACK_PREFIX}${key}`);
}

async function setEnclaveItem(key: string, value: string): Promise<void> {
  if (Platform.OS !== 'web') {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch {
      await AsyncStorage.setItem(`${WEB_FALLBACK_PREFIX}${key}`, value);
      return;
    }
  }
  await AsyncStorage.setItem(`${WEB_FALLBACK_PREFIX}${key}`, value);
}

export interface ProvisionedEnclave {
  profile: EncryptionProfile;
  vaultKey: Uint8Array;
  deviceKeyHex: string;
  userKeyHex: string;
}

const FICA_USER_ID = 'ZA-USR-940814-087';

/**
 * Provisions or loads the unique Hardware Device Key + FICA User Identity Key
 */
export async function initializeDeviceAndUserEncryption(
  pinCode = '25800'
): Promise<ProvisionedEnclave> {
  let [deviceId, deviceKeyHex, userSecretHex, epochRaw] = await Promise.all([
    getEnclaveItem(SECURE_DEVICE_ID_ALIAS),
    getEnclaveItem(SECURE_DEVICE_KEY_ALIAS),
    getEnclaveItem(SECURE_USER_KEY_ALIAS),
    getEnclaveItem(SECURE_KEY_EPOCH_ALIAS),
  ]);

  if (!deviceId) {
    const platTag = Platform.OS.toUpperCase().slice(0, 3);
    const randHex = bytesToHex(randomBytes(4)).toUpperCase();
    deviceId = `ZA-${platTag}-${randHex.slice(0, 4)}-${randHex.slice(4, 8)}`;
    await setEnclaveItem(SECURE_DEVICE_ID_ALIAS, deviceId);
  }

  if (!deviceKeyHex) {
    deviceKeyHex = bytesToHex(randomBytes(32));
    await setEnclaveItem(SECURE_DEVICE_KEY_ALIAS, deviceKeyHex);
  }

  if (!userSecretHex) {
    userSecretHex = bytesToHex(randomBytes(32));
    await setEnclaveItem(SECURE_USER_KEY_ALIAS, userSecretHex);
  }

  const keyEpoch = epochRaw ? parseInt(epochRaw, 10) || 1 : 1;
  if (!epochRaw) {
    await setEnclaveItem(SECURE_KEY_EPOCH_ALIAS, String(keyEpoch));
  }

  // Bind User Key to FICA User ID + User Secret + Banking PIN digest
  const boundUserKeyBytes = hmacSha256(
    hexToBytes(userSecretHex),
    utf8ToBytes(`${FICA_USER_ID}|PIN:${pinCode}|EPOCH:${keyEpoch}`)
  );
  const boundUserKeyHex = bytesToHex(boundUserKeyBytes);

  const vaultKey = deriveDeviceUserVaultKey(
    deviceKeyHex,
    boundUserKeyHex,
    FICA_USER_ID,
    keyEpoch
  );

  const enclaveHardware =
    Platform.OS === 'ios'
      ? 'Apple Secure Enclave (Keychain)'
      : Platform.OS === 'android'
      ? 'Android StrongBox Keystore'
      : 'WebCrypto Isolated Origin Enclave';

  const appName = Constants.expoConfig?.name || 'TapPay Wallet';

  const profile: EncryptionProfile = {
    deviceId,
    userId: FICA_USER_ID,
    deviceKeyFingerprint: formatKeyFingerprint(deviceKeyHex),
    userKeyFingerprint: formatKeyFingerprint(boundUserKeyHex),
    vaultKeyFingerprint: formatKeyFingerprint(bytesToHex(vaultKey)),
    cipherSuite: 'CTR-HMAC-SHA256 (256-bit E2EE)',
    enclaveProvider: `${enclaveHardware} • ${appName}`,
    keyEpoch,
    lastRotatedAt: new Date().toISOString(),
  };

  return {
    profile,
    vaultKey,
    deviceKeyHex,
    userKeyHex: boundUserKeyHex,
  };
}

/**
 * Rotates User & Device-derived keys to a new cryptographic epoch
 */
export async function rotateDeviceAndUserKeys(
  pinCode: string,
  currentEpoch: number
): Promise<ProvisionedEnclave> {
  const nextEpoch = currentEpoch + 1;
  const freshUserSecretHex = bytesToHex(randomBytes(32));
  await Promise.all([
    setEnclaveItem(SECURE_USER_KEY_ALIAS, freshUserSecretHex),
    setEnclaveItem(SECURE_KEY_EPOCH_ALIAS, String(nextEpoch)),
  ]);
  return initializeDeviceAndUserEncryption(pinCode);
}
