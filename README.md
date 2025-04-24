# Secure Pastebin

A minimalist, secure pastebin application with end-to-end encryption and zero-knowledge design. All encryption and decryption happens client-side in the browser, ensuring that sensitive data never leaves your device unencrypted.

## Features

- **End-to-End Encryption**: All content is encrypted with AES-256-GCM before being stored
- **Zero-Knowledge Design**: Encryption keys never reach the server
- **Markdown Support**: Toggle between raw and rendered markdown views
- **Password Protection**: Optional password protection for pastes
- **Auto-Expiring Pastes**: Set time-to-live for all pastes (1 hour to 30 days)
- **Mobile-Friendly**: Responsive design works on all devices

## Technology Stack

- React with TypeScript
- Vite for bundling and development
- TailwindCSS for styling
- Web Crypto API for cryptographic operations
- LocalStorage as a data store (demo only; in production would use a proper backend)

## Security Model

1. **Key-Based Encryption**:
   - A random encryption key is generated in the browser
   - Content is encrypted with AES-256-GCM using the generated key
   - Only the encrypted data is stored in the database
   - The decryption key is shared in the URL fragment (#) which is never sent to the server

2. **Password-Based Encryption**:
   - A password-derived key is generated using PBKDF2 (100,000 iterations) with a random salt
   - Content is encrypted with AES-256-GCM using the derived key
   - Salt is stored alongside the encrypted data for later key derivation
   - User must enter the same password to decrypt the paste

## Development

### Prerequisites

- [Bun](https://bun.sh/) or Node.js 18+ with npm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/secure-pastebin.git
cd secure-pastebin

# Install dependencies
bun install  # or npm install

# Start development server
bun run dev  # or npm run dev
```

## Production Build

```bash
# Build for production
bun run build  # or npm run build

# Preview production build
bun run preview  # or npm run preview
```

## Deployment

The app is static and can be deployed on any static hosting service like Netlify, Vercel, or GitHub Pages.

## License

MIT
