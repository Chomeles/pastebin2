# Self-Hosting Guide

This document provides instructions for self-hosting the Secure Pastebin on your own VPS or server without relying on third-party services.

## Overview

The current implementation uses the browser's `localStorage` for storing paste data, which means:
1. Pastes are only stored in the browser that created them
2. Pastes aren't accessible from other devices/browsers
3. Pastes will be lost if the browser storage is cleared

For a proper self-hosted solution, you'll need to implement a simple backend service to store and retrieve the encrypted pastes.

## Backend Requirements

You'll need to implement a simple backend with the following endpoints:

1. `POST /api/paste` - Create a new paste
2. `GET /api/paste/:id` - Retrieve a paste by ID
3. (Optional) `DELETE /api/paste/:id` - Delete a paste

## Backend Implementation

Here's a simple example using Node.js with Express and MongoDB:

```javascript
// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/pastebin', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Create Paste model
const Paste = mongoose.model('Paste', {
  _id: String,                // Custom ID for the paste
  ciphertext: String,         // Encrypted content
  expiresAt: Date,            // Expiration date
  hasPassword: Boolean,       // Whether the paste is password-protected
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware
app.use(express.json());
app.use(cors());

// Serve static files from the 'dist' directory
app.use(express.static('dist'));

// Create a new paste
app.post('/api/paste', async (req, res) => {
  try {
    const { id, ciphertext, expiresAt, hasPassword } = req.body;

    const paste = new Paste({
      _id: id,
      ciphertext,
      expiresAt: new Date(expiresAt),
      hasPassword: hasPassword || false
    });

    await paste.save();

    res.status(201).json({
      id: paste._id,
      ciphertext: paste.ciphertext,
      expiresAt: paste.expiresAt.toISOString(),
      hasPassword: paste.hasPassword
    });
  } catch (error) {
    console.error('Error creating paste:', error);
    res.status(500).json({ error: 'Failed to create paste' });
  }
});

// Get paste by ID
app.get('/api/paste/:id', async (req, res) => {
  try {
    const paste = await Paste.findById(req.params.id);

    if (!paste) {
      return res.status(404).json({ error: 'Paste not found' });
    }

    // Check if the paste has expired
    if (paste.expiresAt < new Date()) {
      // Delete expired paste
      await paste.deleteOne();
      return res.status(404).json({ error: 'Paste has expired' });
    }

    res.json({
      ciphertext: paste.ciphertext,
      expiresAt: paste.expiresAt.toISOString(),
      hasPassword: paste.hasPassword
    });
  } catch (error) {
    console.error('Error retrieving paste:', error);
    res.status(500).json({ error: 'Failed to retrieve paste' });
  }
});

// Delete expired pastes (run this periodically)
const deleteExpiredPastes = async () => {
  try {
    await Paste.deleteMany({ expiresAt: { $lt: new Date() } });
    console.log('Expired pastes deleted');
  } catch (error) {
    console.error('Error deleting expired pastes:', error);
  }
};

// Set up a job to delete expired pastes every hour
setInterval(deleteExpiredPastes, 60 * 60 * 1000);

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile('index.html', { root: 'dist' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## Frontend Modifications

You'll need to modify the API service in the frontend to use HTTP requests instead of localStorage:

```typescript
// src/services/api.ts
import axios from 'axios';
import { PastePayload, PasteResponse, PasteData } from '../types';

const API_URL = '/api'; // Change this to your backend URL if needed

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

  // Calculate expiration date based on TTL
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

  const response = await axios.post(`${API_URL}/paste`, {
    id,
    ciphertext,
    expiresAt: expiresAt.toISOString(),
    hasPassword
  });

  return response.data;
};

// Fetch a paste by ID
export const fetchPaste = async (id: string): Promise<PasteData | null> => {
  try {
    const response = await axios.get(`${API_URL}/paste/${id}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null; // Paste not found or expired
    }
    throw error;
  }
};
```

## Deployment on a VPS

1. **Install Node.js and MongoDB:**
   ```bash
   # Update package list
   sudo apt update

   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs

   # Install MongoDB
   sudo apt install -y mongodb
   sudo systemctl start mongodb
   sudo systemctl enable mongodb
   ```

2. **Clone and build your project:**
   ```bash
   # Clone your repository
   git clone https://github.com/yourusername/secure-pastebin.git
   cd secure-pastebin

   # Install dependencies
   npm install

   # Build the frontend
   npm run build

   # Install backend dependencies
   npm install express mongoose cors
   ```

3. **Create the server file:**
   Create `server.js` with the code from the backend implementation above

4. **Run the server:**
   ```bash
   node server.js
   ```

5. **Set up a process manager (recommended):**
   ```bash
   # Install PM2
   sudo npm install -g pm2

   # Start the application with PM2
   pm2 start server.js --name secure-pastebin

   # Configure PM2 to start on system boot
   pm2 startup
   pm2 save
   ```

6. **Set up Nginx as a reverse proxy (recommended):**
   ```bash
   # Install Nginx
   sudo apt install -y nginx

   # Create a new site configuration
   sudo nano /etc/nginx/sites-available/secure-pastebin
   ```

   Add the following configuration:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com; # Replace with your domain

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   Enable the site and restart Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/secure-pastebin /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

7. **Set up HTTPS with Let's Encrypt (recommended):**
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

## Additional Security Considerations

1. **Rate limiting:** Implement rate limiting to prevent abuse
2. **Paste size limits:** Set a maximum size for pastes
3. **Firewall:** Configure a firewall to only allow necessary ports
4. **Regular updates:** Keep your system and dependencies updated
5. **Monitoring:** Set up monitoring for your server and application

## Database Alternatives

Instead of MongoDB, you could use:
- **PostgreSQL or MySQL:** For a traditional relational database
- **Redis:** For a simpler key-value store with built-in expiration support
- **SQLite:** For a lightweight file-based database

## Conclusion

With these modifications, you can self-host your secure pastebin on your own VPS without relying on third-party services. All encryption and decryption still happens client-side, maintaining the zero-knowledge security model.

Remember that the backend only stores encrypted data, ensuring that your pastes remain secure and private.
