import * as SecureStore from 'expo-secure-store';
import * as ExpoCrypto from 'expo-crypto';
import CryptoJS from 'crypto-js';

const KEY = 'forever_credentials';

type Credentials = {
  userId:       string;
  displayName:  string;
  passwordHash: string;
  salt:         string;
};

export async function hasAccount(): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(KEY);
  return raw !== null;
}

export async function createAccount(
  displayName: string,
  password: string,
): Promise<string> {
  const salt         = ExpoCrypto.randomUUID();
  const passwordHash = CryptoJS.SHA256(password + salt).toString();
  const userId       = ExpoCrypto.randomUUID();
  const creds: Credentials = { userId, displayName, passwordHash, salt };
  await SecureStore.setItemAsync(KEY, JSON.stringify(creds));
  return userId;
}

export async function login(displayName: string, password: string): Promise<Credentials | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  const creds: Credentials = JSON.parse(raw);
  if (creds.displayName.toLowerCase() !== displayName.trim().toLowerCase()) return null;
  const hash = CryptoJS.SHA256(password + creds.salt).toString();
  return hash === creds.passwordHash ? creds : null;
}

export async function getCredentials(): Promise<Credentials | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
