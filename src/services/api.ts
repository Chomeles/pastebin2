import { PastePayload, PasteResponse, PasteData } from '../types';

// For this demo, we'll use localStorage instead of a real backend
// In a real app, this would be replaced with actual API calls

const API_PREFIX = 'pastebin_';

// Helper to convert TTL to expiration date
const ttlToExpiresAt = (ttl: string): string => {
  const now = new Date();
  let expiresAt = new Date(now);

  const value = parseInt(ttl);
  if (ttl.endsWith('h')) {
    expiresAt.setHours(now.getHours() + value);
  } else if (ttl.endsWith('d')) {
    expiresAt.setDate(now.getDate() + value);
  } else if (ttl.endsWith('m')) {
    expiresAt.setMinutes(now.getMinutes() + value);
  } else {
    // Default to 24 hours
    expiresAt.setHours(now.getHours() + 24);
  }

  return expiresAt.toISOString();
};

// Generate a random ID
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 10);
};

// Create a new paste
export const createPaste = async (
  ciphertext: string,
  ttl: string,
  hasPassword: boolean = false
): Promise<PasteResponse> => {
  const id = generateId();
  const expiresAt = ttlToExpiresAt(ttl);

  console.log('Creating paste with hasPassword:', hasPassword);

  const pasteData: PasteData = {
    ciphertext,
    expiresAt,
    hasPassword
  };

  // Store the paste in localStorage
  localStorage.setItem(`${API_PREFIX}${id}`, JSON.stringify(pasteData));

  console.log('Paste created with ID:', id);
  console.log('Paste data:', pasteData);

  return {
    id,
    ciphertext,
    expiresAt,
    hasPassword
  };
};

// Fetch a paste by ID
export const fetchPaste = async (id: string): Promise<PasteData | null> => {
  console.log('Fetching paste with ID:', id);

  const pasteJson = localStorage.getItem(`${API_PREFIX}${id}`);

  if (!pasteJson) {
    console.log('Paste not found in localStorage');
    return null;
  }

  const paste: PasteData = JSON.parse(pasteJson);
  console.log('Retrieved paste:', paste);

  // Ensure hasPassword property exists (for backward compatibility)
  if (paste.hasPassword === undefined) {
    paste.hasPassword = false;
  }

  // Check if the paste has expired
  if (new Date(paste.expiresAt) < new Date()) {
    console.log('Paste has expired, deleting');
    // Delete expired paste
    localStorage.removeItem(`${API_PREFIX}${id}`);
    return null;
  }

  return paste;
};
