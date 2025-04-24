import { useState, useCallback } from 'react';
import * as cryptoUtils from '../utils/crypto';

interface UseCryptoReturn {
  encryptText: (text: string) => Promise<{ ciphertext: string, key: string }>;
  encryptWithPassword: (text: string, password: string) => Promise<string>;
  decryptText: (ciphertext: string, key: string) => Promise<string>;
  decryptWithPassword: (ciphertext: string, password: string) => Promise<string>;
  isProcessing: boolean;
  error: string | null;
}

export function useCrypto(): UseCryptoReturn {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const encryptText = useCallback(async (text: string): Promise<{ ciphertext: string, key: string }> => {
    setIsProcessing(true);
    setError(null);

    try {
      const key = await cryptoUtils.generateKey();
      const ciphertext = await cryptoUtils.encrypt(text, key);
      return { ciphertext, key };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to encrypt text';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const encryptWithPassword = useCallback(async (text: string, password: string): Promise<string> => {
    setIsProcessing(true);
    setError(null);

    try {
      const ciphertext = await cryptoUtils.encryptWithPassword(text, password);
      return ciphertext;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to encrypt text with password';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const decryptText = useCallback(async (ciphertext: string, key: string): Promise<string> => {
    setIsProcessing(true);
    setError(null);

    try {
      const plaintext = await cryptoUtils.decrypt(ciphertext, key);
      return plaintext;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to decrypt text';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const decryptWithPassword = useCallback(async (ciphertext: string, password: string): Promise<string> => {
    setIsProcessing(true);
    setError(null);

    try {
      const plaintext = await cryptoUtils.decryptWithPassword(ciphertext, password);
      return plaintext;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to decrypt text with password';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return {
    encryptText,
    encryptWithPassword,
    decryptText,
    decryptWithPassword,
    isProcessing,
    error
  };
}
