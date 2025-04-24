export interface PastePayload {
  content: string;
  ttl: string; // e.g., "1h", "24h"
  hasPassword: boolean;
}

export interface PasteResponse {
  id: string;
  ciphertext: string;
  expiresAt: string; // ISO date string
  hasPassword: boolean;
}

export interface PasteData {
  ciphertext: string;
  expiresAt: string; // ISO date string
  hasPassword: boolean;
}

export type ViewMode = 'raw' | 'markdown';
