const STORAGE_KEY = 'securemigrate.vault.v1';
const PBKDF2_ITERATIONS = 210_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const bytesToB64 = (bytes) => {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

const b64ToBytes = (value) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

async function deriveKey(password, salt) {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function hasVault() {
  try {
    return Boolean(localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

export async function saveVault(vault, password) {
  if (!password || password.length < 8) {
    throw new Error('Vault password must be at least 8 characters');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(vault)),
  );
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      salt: bytesToB64(salt),
      iv: bytesToB64(iv),
      ciphertext: bytesToB64(new Uint8Array(ciphertext)),
    }),
  );
}

export async function loadVault(password) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const envelope = JSON.parse(raw);
  const salt = b64ToBytes(envelope.salt);
  const iv = b64ToBytes(envelope.iv);
  const key = await deriveKey(password, salt);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    b64ToBytes(envelope.ciphertext),
  );
  const vault = JSON.parse(decoder.decode(plaintext));
  return {
    version: 1,
    wallets: vault.wallets && typeof vault.wallets === 'object' ? vault.wallets : {},
  };
}

export function clearVault() {
  localStorage.removeItem(STORAGE_KEY);
}
