import { useState, useEffect } from 'react';
import { PasteData } from '../types';
import { fetchPaste } from '../services/api';

interface UseFetchPasteReturn {
  paste: PasteData | null;
  loading: boolean;
  error: string | null;
}

export function useFetchPaste(id: string): UseFetchPasteReturn {
  const [paste, setPaste] = useState<PasteData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const pasteData = await fetchPaste(id);

        if (!pasteData) {
          setError('Paste not found or expired');
          setPaste(null);
        } else {
          setPaste(pasteData);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch paste';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  return { paste, loading, error };
}
