# PHP & MariaDB Backend Implementation Guide

This guide provides instructions for implementing a backend for the Secure Pastebin using PHP and MariaDB instead of the localStorage-based demo implementation.

## Overview

The current frontend implementation uses browser localStorage, which has limitations:
- Pastes only exist in the browser where they were created
- Pastes cannot be shared across devices
- Pastes are lost when clearing browser data

This guide will walk you through creating a simple PHP backend with a MariaDB database to properly store and serve encrypted pastes.

## Requirements

- Web server (Apache or Nginx)
- PHP 7.4+ with PDO extension
- MariaDB 10.3+
- Composer (for dependencies)

## Database Setup

First, create a database and user for the application:

```sql
-- Connect to MariaDB as root
-- mysql -u root -p

-- Create database
CREATE DATABASE pastebin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user with permissions
CREATE USER 'pastebinuser'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON pastebin.* TO 'pastebinuser'@'localhost';
FLUSH PRIVILEGES;

-- Create the pastes table
USE pastebin;
CREATE TABLE pastes (
    id VARCHAR(20) PRIMARY KEY,
    ciphertext MEDIUMTEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    has_password BOOLEAN NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create an index for expiration
CREATE INDEX idx_expires_at ON pastes(expires_at);
```

## PHP Backend Structure

Create the following directory structure:

```
api/
├── config/
│   └── database.php
├── models/
│   └── Paste.php
├── paste.php
└── cron_cleanup.php
```

### 1. Database Configuration

Create `api/config/database.php`:

```php
<?php
// Database configuration
return [
    'host' => 'localhost',
    'dbname' => 'pastebin',
    'username' => 'pastebinuser',
    'password' => 'your_secure_password',
    'charset' => 'utf8mb4'
];
```

### 2. Paste Model

Create `api/models/Paste.php`:

```php
<?php
class Paste {
    private $conn;

    // Constructor with database connection
    public function __construct($db) {
        $this->conn = $db;
    }

    // Create a new paste
    public function create($id, $ciphertext, $expiresAt, $hasPassword) {
        $query = "INSERT INTO pastes (id, ciphertext, expires_at, has_password)
                  VALUES (:id, :ciphertext, :expires_at, :has_password)";

        try {
            $stmt = $this->conn->prepare($query);

            // Sanitize inputs
            $id = htmlspecialchars(strip_tags($id));
            $ciphertext = $ciphertext; // No sanitization for encrypted content
            $hasPassword = (bool) $hasPassword;

            // Bind parameters
            $stmt->bindParam(":id", $id);
            $stmt->bindParam(":ciphertext", $ciphertext);
            $stmt->bindParam(":expires_at", $expiresAt);
            $stmt->bindParam(":has_password", $hasPassword, PDO::PARAM_BOOL);

            // Execute query
            if ($stmt->execute()) {
                return true;
            }

            return false;
        } catch (PDOException $e) {
            // Log error (in production, don't expose the error message)
            error_log($e->getMessage());
            return false;
        }
    }

    // Get a paste by ID
    public function read($id) {
        $query = "SELECT ciphertext, expires_at, has_password FROM pastes
                  WHERE id = :id AND expires_at > NOW()";

        try {
            $stmt = $this->conn->prepare($query);

            // Sanitize input
            $id = htmlspecialchars(strip_tags($id));

            // Bind parameter
            $stmt->bindParam(":id", $id);

            // Execute query
            $stmt->execute();

            // Get record
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($row) {
                return [
                    'ciphertext' => $row['ciphertext'],
                    'expiresAt' => $row['expires_at'],
                    'hasPassword' => (bool) $row['has_password']
                ];
            }

            return null;
        } catch (PDOException $e) {
            error_log($e->getMessage());
            return null;
        }
    }

    // Delete expired pastes
    public function deleteExpired() {
        $query = "DELETE FROM pastes WHERE expires_at <= NOW()";

        try {
            $stmt = $this->conn->prepare($query);
            $stmt->execute();

            return true;
        } catch (PDOException $e) {
            error_log($e->getMessage());
            return false;
        }
    }
}
```

### 3. API Endpoint

Create `api/paste.php`:

```php
<?php
// Set headers for CORS and JSON
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Get database configuration
$db_config = require_once 'config/database.php';

// Connect to database
try {
    $dsn = "mysql:host={$db_config['host']};dbname={$db_config['dbname']};charset={$db_config['charset']}";
    $pdo = new PDO($dsn, $db_config['username'], $db_config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// Include paste model
require_once 'models/Paste.php';
$paste = new Paste($pdo);

// Process based on request method
$request_method = $_SERVER["REQUEST_METHOD"];

switch ($request_method) {
    // GET request - retrieve a paste
    case 'GET':
        // Check if ID is provided in the URL
        $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        $parts = explode('/', trim($path, '/'));
        $id = end($parts);

        if (empty($id)) {
            http_response_code(400);
            echo json_encode(['error' => 'Paste ID is required']);
            exit;
        }

        // Get paste
        $data = $paste->read($id);

        if ($data) {
            http_response_code(200);
            echo json_encode($data);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Paste not found or expired']);
        }
        break;

    // POST request - create a new paste
    case 'POST':
        // Get request data
        $data = json_decode(file_get_contents("php://input"), true);

        // Validate required fields
        if (
            empty($data['id']) ||
            empty($data['ciphertext']) ||
            empty($data['expiresAt'])
        ) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }

        // Default hasPassword to false if not provided
        $hasPassword = isset($data['hasPassword']) ? (bool) $data['hasPassword'] : false;

        // Create paste
        if ($paste->create($data['id'], $data['ciphertext'], $data['expiresAt'], $hasPassword)) {
            http_response_code(201);
            echo json_encode([
                'id' => $data['id'],
                'ciphertext' => $data['ciphertext'],
                'expiresAt' => $data['expiresAt'],
                'hasPassword' => $hasPassword
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to create paste']);
        }
        break;

    // Invalid request method
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        break;
}
```

### 4. Cleanup Script for Expired Pastes

Create `api/cron_cleanup.php`:

```php
<?php
// Get database configuration
$db_config = require_once 'config/database.php';

// Connect to database
try {
    $dsn = "mysql:host={$db_config['host']};dbname={$db_config['dbname']};charset={$db_config['charset']}";
    $pdo = new PDO($dsn, $db_config['username'], $db_config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
} catch (PDOException $e) {
    error_log('Database connection failed: ' . $e->getMessage());
    exit;
}

// Include paste model
require_once 'models/Paste.php';
$paste = new Paste($pdo);

// Delete expired pastes
if ($paste->deleteExpired()) {
    echo "Expired pastes deleted successfully." . PHP_EOL;
} else {
    echo "Failed to delete expired pastes." . PHP_EOL;
}
```

## Frontend Modifications

Update the API service file in the frontend application to use the PHP backend:

```typescript
// src/services/api.ts
import { PastePayload, PasteResponse, PasteData } from '../types';

const API_URL = '/api'; // Update with your backend URL if different

// Generate a random ID
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 10);
};

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

// Create a new paste
export const createPaste = async (
  ciphertext: string,
  ttl: string,
  hasPassword: boolean = false
): Promise<PasteResponse> => {
  const id = generateId();
  const expiresAt = ttlToExpiresAt(ttl);

  const response = await fetch(`${API_URL}/paste.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id,
      ciphertext,
      expiresAt,
      hasPassword
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create paste');
  }

  return response.json();
};

// Fetch a paste by ID
export const fetchPaste = async (id: string): Promise<PasteData | null> => {
  try {
    const response = await fetch(`${API_URL}/paste.php/${id}`);

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Paste not found or expired
      }
      throw new Error('Failed to fetch paste');
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching paste:', error);
    return null;
  }
};
```

## Web Server Configuration

### Apache Configuration (.htaccess)

Create an `.htaccess` file in the `api` directory to handle routing:

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^paste/(.*)$ paste.php [QSA,L]
```

### Nginx Configuration

If using Nginx, add this to your server block:

```nginx
location /api/ {
    try_files $uri $uri/ /api/paste.php?$args;
}

# Rewrite for paste ID access
location ~ ^/api/paste/([^/]+)$ {
    fastcgi_pass unix:/var/run/php/php7.4-fpm.sock; # Update PHP version as needed
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME $document_root/api/paste.php;
    fastcgi_param PATH_INFO /$1;
}
```

## Setting Up a Cron Job

Set up a cron job to automatically delete expired pastes:

```bash
# Run every hour
0 * * * * php /path/to/your/api/cron_cleanup.php >> /path/to/your/logs/cleanup.log 2>&1
```

## Deployment Steps

1. **Build the frontend application:**
   ```bash
   npm run build  # or bun run build
   ```

2. **Upload the distribution files:**
   Copy the contents of the `dist` directory to your web server's public directory.

3. **Create the API directory:**
   Create an `api` directory at the same level as your frontend files and copy all the PHP files there.

4. **Set file permissions:**
   ```bash
   chmod 750 /path/to/web/api
   chmod 640 /path/to/web/api/config/database.php
   ```

5. **Test the API endpoints:**
   Try creating and retrieving a paste to ensure everything is working properly.

## Security Considerations

1. **Store sensitive information in environment variables:**
   Consider using environment variables or a `.env` file (with appropriate protections) for database credentials.

2. **Implement rate limiting:**
   Add rate limiting to prevent abuse of the API.

3. **Add HTTPS:**
   Ensure your server uses HTTPS to protect data in transit.

4. **Set appropriate CORS headers:**
   If your frontend and backend are on different domains, configure CORS appropriately.

5. **Validate input data:**
   Implement thorough validation for all input data.

6. **Logging and monitoring:**
   Set up proper logging and monitoring for your application.

## Conclusion

This implementation provides a simple but robust PHP and MariaDB backend for the Secure Pastebin. All encryption and decryption still happens client-side, maintaining the zero-knowledge security model, while the backend simply stores and retrieves the encrypted data.

Remember that the source code should be reviewed for potential security issues before deploying to a production environment.
