/**
 * Crypto utility functions for secure pastebin
 * Using Web Crypto API with AES-GCM
 */

// Convert a string to a Uint8Array
const strToUint8Array = (str: string): Uint8Array => {
  return new TextEncoder().encode(str);
};

// Convert a Uint8Array to a string
const uint8ArrayToStr = (buffer: ArrayBuffer): string => {
  return new TextDecoder().decode(buffer);
};

// Convert a Uint8Array to a hex string
const arrayBufferToHex = (buffer: ArrayBuffer): string => {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

// Convert a hex string to a Uint8Array
const hexToArrayBuffer = (hex: string): Uint8Array => {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) return new Uint8Array();
  return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
};

// Generate a random encryption key
export const generateKey = async (): Promise<string> => {
  const key = await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );

  const exportedKey = await window.crypto.subtle.exportKey('raw', key);
  return arrayBufferToHex(exportedKey);
};

// Derive a key from a password
export const deriveKeyFromPassword = async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
  // Convert the password to a key using PBKDF2
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    strToUint8Array(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive a key for AES-GCM
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
};

// Import a hex key for use with SubtleCrypto
const importKey = async (hexKey: string): Promise<CryptoKey> => {
  const keyData = hexToArrayBuffer(hexKey);
  return window.crypto.subtle.importKey(
    'raw',
    keyData,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
};

// Encrypt text with the given key
export const encrypt = async (text: string, hexKey: string): Promise<string> => {
  const key = await importKey(hexKey);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    strToUint8Array(text)
  );

  // Format: iv + ciphertext, both as hex
  const ivHex = arrayBufferToHex(iv);
  const encryptedHex = arrayBufferToHex(encrypted);

  return ivHex + encryptedHex;
};

// Encrypt text with a password
export const encryptWithPassword = async (text: string, password: string): Promise<string> => {
  // Generate a random salt
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  console.log('Encrypting with password. Salt:', arrayBufferToHex(salt), 'IV:', arrayBufferToHex(iv));

  // Derive a key from the password
  const key = await deriveKeyFromPassword(password, salt);

  // Encrypt the text
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    strToUint8Array(text)
  );

  // Format: salt + iv + ciphertext, all as hex
  const saltHex = arrayBufferToHex(salt);
  const ivHex = arrayBufferToHex(iv);
  const encryptedHex = arrayBufferToHex(encrypted);

  console.log('Encryption complete. Ciphertext length:', encryptedHex.length);

  return saltHex + ivHex + encryptedHex;
};

// Decrypt ciphertext with the given key
export const decrypt = async (ciphertext: string, hexKey: string): Promise<string> => {
  // Extract IV from the beginning of the ciphertext (first 24 chars = 12 bytes)
  const ivHex = ciphertext.substring(0, 24);
  const encryptedHex = ciphertext.substring(24);

  const iv = hexToArrayBuffer(ivHex);
  const encrypted = hexToArrayBuffer(encryptedHex);
  const key = await importKey(hexKey);

  try {
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      encrypted
    );

    return uint8ArrayToStr(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt: Invalid key or corrupted data');
  }
};

// Decrypt ciphertext with a password
export const decryptWithPassword = async (ciphertext: string, password: string): Promise<string> => {
  // Extract salt and IV
  const saltHex = ciphertext.substring(0, 32); // 16 bytes = 32 chars hex
  const ivHex = ciphertext.substring(32, 56); // 12 bytes = 24 chars hex
  const encryptedHex = ciphertext.substring(56);

  console.log('Decrypting with password');
  console.log('Salt:', saltHex);
  console.log('IV:', ivHex);
  console.log('Encrypted data length:', encryptedHex.length);

  const salt = hexToArrayBuffer(saltHex);
  const iv = hexToArrayBuffer(ivHex);
  const encrypted = hexToArrayBuffer(encryptedHex);

  try {
    // Derive the key from the password
    const key = await deriveKeyFromPassword(password, salt);

    // Decrypt
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      encrypted
    );

    const plaintext = uint8ArrayToStr(decrypted);
    console.log('Decryption successful, plaintext length:', plaintext.length);

    return plaintext;
  } catch (error) {
    console.error('Decryption with password failed:', error);
    throw new Error('Failed to decrypt: Invalid password or corrupted data');
  }
};
