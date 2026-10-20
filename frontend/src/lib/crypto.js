import { secp256k1 } from '@noble/curves/secp256k1.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';

const encoder = new TextEncoder();

export const hexToBytes = (hex) => {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error('Invalid hex string');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

export const bytesToHex = (bytes) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(new Uint8Array(digest));
}

export async function addressFromPublicKey(publicKeyHex) {
  const hash = await sha256Hex(hexToBytes(publicKeyHex));
  return `0x${hash.slice(0, 40)}`;
}

export function publicKeyFromPrivateKey(walletType, privateKeyHex) {
  const secretKey = hexToBytes(privateKeyHex);
  if (walletType === 'ecdsa') {
    if (secretKey.length !== 32) throw new Error('Invalid ECDSA private key');
    return bytesToHex(secp256k1.getPublicKey(secretKey, false));
  }
  if (walletType === 'mldsa') {
    if (secretKey.length !== 4032) throw new Error('Invalid ML-DSA private key');
    return bytesToHex(ml_dsa65.getPublicKey(secretKey));
  }
  throw new Error('Unknown wallet type');
}

export async function generateWallet(walletType) {
  let privateKeyHex;
  if (walletType === 'ecdsa') {
    privateKeyHex = bytesToHex(secp256k1.keygen().secretKey);
  } else if (walletType === 'mldsa') {
    privateKeyHex = bytesToHex(ml_dsa65.keygen().secretKey);
  } else {
    throw new Error('Unknown wallet type');
  }

  const publicKey = publicKeyFromPrivateKey(walletType, privateKeyHex);
  const address = await addressFromPublicKey(publicKey);
  return {
    address,
    publicKey,
    privateKey: privateKeyHex,
    walletType,
    createdAt: Date.now(),
  };
}

export function signTxHash(walletType, privateKeyHex, txHash) {
  const message = encoder.encode(txHash);
  const secretKey = hexToBytes(privateKeyHex);
  if (walletType === 'ecdsa') {
    return bytesToHex(secp256k1.sign(message, secretKey, { format: 'der' }));
  }
  if (walletType === 'mldsa') {
    return bytesToHex(ml_dsa65.sign(message, secretKey));
  }
  throw new Error('Unknown wallet type');
}
