import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCrypto } from '../hooks/useCrypto';
import { createPaste } from '../services/api';

const CreatePaste = () => {
  const [content, setContent] = useState<string>('');
  const [ttl, setTtl] = useState<string>('24h');
  const [usePassword, setUsePassword] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { encryptText, encryptWithPassword, isProcessing } = useCrypto();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      setError('Content cannot be empty');
      return;
    }

    if (usePassword && !password.trim()) {
      setError('Password cannot be empty when password protection is enabled');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      if (usePassword) {
        // Encrypt with password
        const ciphertext = await encryptWithPassword(content, password);

        // Create the paste
        const response = await createPaste(ciphertext, ttl, true);

        // Navigate to the view page
        // Note: No key in URL fragment with password protection
        navigate(`/p/${response.id}`);
      } else {
        // Encrypt with random key
        const { ciphertext, key } = await encryptText(content);

        // Create the paste
        const response = await createPaste(ciphertext, ttl, false);

        // Navigate to the view page with the key in the URL fragment
        navigate(`/p/${response.id}#${key}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create paste';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
        <div className="flex flex-col">
          <label htmlFor="content" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Content
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[300px] p-3 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your text here. Supports Markdown."
            autoFocus
          />
        </div>

        <div className="flex flex-col sm:flex-row justify-between space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="flex flex-col">
            <label htmlFor="ttl" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Time to Live
            </label>
            <select
              id="ttl"
              value={ttl}
              onChange={(e) => setTtl(e.target.value)}
              className="p-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1h">1 hour</option>
              <option value="6h">6 hours</option>
              <option value="24h">24 hours</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={isSubmitting || isProcessing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting || isProcessing ? 'Creating...' : 'Create Secure Paste'}
            </button>
          </div>
        </div>

        {/* Password Protection Option */}
        <div className="flex flex-col space-y-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="usePassword"
              checked={usePassword}
              onChange={(e) => setUsePassword(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="usePassword" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Protect with password
            </label>
          </div>

          {usePassword && (
            <div className="flex flex-col space-y-1">
              <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="p-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter a secure password"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Note: With password protection, the decryption key is derived from your password.
                You'll need to remember and enter this password to view the paste.
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
          <h3 className="font-medium">How it works:</h3>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <li>Your content is encrypted in your browser with AES-256</li>
            <li>The encryption key never leaves your browser</li>
            <li>Only the encrypted data is stored on the server</li>
            {!usePassword ? (
              <li>The decryption key is shared in the URL fragment (#) which is never sent to the server</li>
            ) : (
              <li>With password protection, you'll need to enter your password to decrypt the paste</li>
            )}
            <li>Once the paste expires, it's deleted permanently</li>
          </ul>
        </div>
      </form>
    </div>
  );
};

export default CreatePaste;
