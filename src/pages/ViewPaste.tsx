import { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useFetchPaste } from '../hooks/useFetchPaste';
import { useCrypto } from '../hooks/useCrypto';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { ViewMode } from '../types';

const ViewPaste = () => {
  const { id = '' } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { paste, loading, error: fetchError } = useFetchPaste(id);
  const { decryptText, decryptWithPassword, isProcessing, error: decryptError } = useCrypto();

  const [content, setContent] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('raw');
  const [decryptionError, setDecryptionError] = useState<string | null>(null);
  const [password, setPassword] = useState<string>('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState<boolean>(false);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);

  // Extract the decryption key from the URL fragment
  const key = location.hash.substring(1);

  useEffect(() => {
    if (!paste) return;

    // If the paste requires a password and we don't have a key in the URL,
    // show the password prompt
    if (paste.hasPassword && !key) {
      setShowPasswordPrompt(true);
      return;
    }

    const decryptPaste = async () => {
      if (!paste) return;

      try {
        let plaintext;

        if (paste.hasPassword && key) {
          // If we have both password protection and a key, try the key first
          // (This is a fallback case that shouldn't normally happen)
          try {
            plaintext = await decryptText(paste.ciphertext, key);
          } catch (err) {
            // If key decryption fails, show password prompt
            setShowPasswordPrompt(true);
            return;
          }
        } else if (!paste.hasPassword && key) {
          // Standard key-based decryption
          plaintext = await decryptText(paste.ciphertext, key);
        } else {
          // This case shouldn't be reached (paste requires password but we're not showing prompt)
          return;
        }

        setContent(plaintext);
        setDecryptionError(null);
        setShowPasswordPrompt(false);
      } catch (err) {
        setDecryptionError('Failed to decrypt: Invalid key or corrupted data');
      }
    };

    if (paste && !showPasswordPrompt) {
      decryptPaste();
    }
  }, [paste, key, decryptText, showPasswordPrompt]);

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!password.trim() || !paste) {
      return;
    }

    setIsDecrypting(true);
    setDecryptionError(null);

    try {
      console.log('Attempting to decrypt with password:', password);
      console.log('Ciphertext:', paste.ciphertext);

      const plaintext = await decryptWithPassword(paste.ciphertext, password);
      console.log('Decryption successful, plaintext length:', plaintext.length);

      setContent(plaintext);
      setShowPasswordPrompt(false);
    } catch (err) {
      console.error('Password decryption failed:', err);
      setDecryptionError('Failed to decrypt: Invalid password');
    } finally {
      setIsDecrypting(false);
    }
  };

  // Format the expiration date
  const formatExpirationDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Calculate remaining time
  const getRemainingTime = (dateString: string) => {
    const expiresAt = new Date(dateString).getTime();
    const now = new Date().getTime();
    const diff = expiresAt - now;

    if (diff <= 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'raw' ? 'markdown' : 'raw');
  };

  // Function to open raw text in a new tab
  const openRawView = () => {
    // Create a blob with the text content
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    // Open the blob URL in a new tab
    window.open(url, '_blank');

    // Clean up the URL object after opening
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const createNewPaste = () => {
    navigate('/');
  };

  if (loading || isProcessing) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (fetchError || !paste) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
        <div className="p-4 bg-red-100 text-red-700 rounded-md max-w-md text-center">
          {fetchError || 'Paste not found or expired'}
        </div>
        <button
          onClick={createNewPaste}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md"
        >
          Create New Paste
        </button>
      </div>
    );
  }

  if (showPasswordPrompt) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
            Password Protected Paste
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            This paste is protected with a password. Enter the password to view its contents.
          </p>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter password"
                autoFocus
              />
            </div>

            {decryptionError && (
              <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
                {decryptionError}
              </div>
            )}

            <div className="flex justify-between">
              <button
                type="button"
                onClick={createNewPaste}
                className="px-4 py-2 border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isDecrypting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md disabled:opacity-50"
              >
                {isDecrypting ? 'Decrypting...' : 'Unlock'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (!key && !showPasswordPrompt && !paste.hasPassword) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
        <div className="p-4 bg-yellow-100 text-yellow-700 rounded-md max-w-md text-center">
          Missing decryption key. The URL should include a fragment identifier (#) containing the key.
        </div>
        <button
          onClick={createNewPaste}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md"
        >
          Create New Paste
        </button>
      </div>
    );
  }

  if (decryptionError || decryptError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
        <div className="p-4 bg-red-100 text-red-700 rounded-md max-w-md text-center">
          {decryptionError || decryptError}
        </div>
        <button
          onClick={createNewPaste}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md"
        >
          Create New Paste
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="flex space-x-2">
            <button
              onClick={toggleViewMode}
              className={`px-3 py-1 font-medium rounded-md focus:outline-none
                ${viewMode === 'raw'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
            >
              Raw
            </button>
            <button
              onClick={toggleViewMode}
              className={`px-3 py-1 font-medium rounded-md focus:outline-none
                ${viewMode === 'markdown'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
            >
              Markdown
            </button>
            <button
              onClick={openRawView}
              className="px-3 py-1 font-medium rounded-md focus:outline-none bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
              title="Open raw text in a new tab"
            >
              Raw View
            </button>
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            <span title={formatExpirationDate(paste.expiresAt)}>
              {getRemainingTime(paste.expiresAt)}
            </span>
          </div>
        </div>

        <div className="border rounded-md p-4 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 min-h-[300px]">
          {viewMode === 'raw' ? (
            <pre className="whitespace-pre-wrap break-all font-mono text-sm">{content}</pre>
          ) : (
            <MarkdownRenderer content={content} />
          )}
        </div>

        <div className="flex justify-between">
          <button
            onClick={createNewPaste}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md"
          >
            Create New Paste
          </button>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            Secure, end-to-end encrypted paste
            {paste.hasPassword && ' (Password protected)'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewPaste;
