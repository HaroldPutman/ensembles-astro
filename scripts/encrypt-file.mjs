/* eslint-env node */

import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const files = [
  {
    'plaintext': 'collections/instructors-private.json', 
    'encrypted': 'mango-pasta.crypt'
  },
]

// Encryption settings
const algorithm = 'aes-256-gcm'; // Algorithm to use (authenticated encryption)
const iterations = 100000; // Number of iterations for PBKDF2
const keyLength = 32; // Key length for AES-256
const ivLength = 12; // IV/nonce length for GCM (96 bits recommended)
const authTagLength = 16; // Auth tag length for GCM

// Function to derive a key from a passphrase and salt
function deriveKey(password, salt) {
  // Derive the key using PBKDF2
  const key = crypto.pbkdf2Sync(password, salt, iterations, keyLength, 'sha256');
  return key;
}

// Function to encrypt the file content
// File format: salt (16 bytes) || iv (12 bytes) || ciphertext || authTag (16 bytes)
function encryptFile(plainTextFilePath, cryptFilePath, password) {
  try {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(ivLength);
    const key = deriveKey(password, salt);
    const fileData = fs.readFileSync(plainTextFilePath);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const encryptedData = Buffer.concat([cipher.update(fileData), cipher.final()]);
    const authTag = cipher.getAuthTag();
    fs.writeFileSync(cryptFilePath, Buffer.concat([salt, iv, encryptedData, authTag]));
    console.log(`File ${plainTextFilePath} encrypted successfully to ${cryptFilePath}`);
  } catch (error) {
    console.error('Error during encryption:', error.message);
    throw error;
  }
}

// Function to decrypt the file content
// File format: salt (16 bytes) || iv (12 bytes) || ciphertext || authTag (16 bytes)
function decryptFile(cryptFilePath, plainTextFilePath, password) {
  try {
    const fileData = fs.readFileSync(cryptFilePath);
    const salt = fileData.subarray(0, 16);
    const iv = fileData.subarray(16, 16 + ivLength);
    const authTag = fileData.subarray(fileData.length - authTagLength);
    const encryptedData = fileData.subarray(16 + ivLength, fileData.length - authTagLength);
    const key = deriveKey(password, salt);
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    const decryptedData = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    fs.writeFileSync(plainTextFilePath, decryptedData);
    // Set the mtime of the plainTextFile to match the cryptFile's mtime
    try {
      const cryptStats = fs.statSync(cryptFilePath);
      fs.utimesSync(plainTextFilePath, cryptStats.atime, cryptStats.mtime);
    } catch (err) {
      console.warn(`Warning: Failed to set mtime: ${err.message}`);
    }
    console.log(`File ${cryptFilePath} decrypted successfully to ${plainTextFilePath}`);
  } catch (error) {
    console.error('Error during decryption:', error.message);
    throw error;
  }
}


const password = process.env.GIT_CRYPT_KEY;
if (!password) {
  console.error('Error: GIT_CRYPT_KEY is not set. Aborting encryption/decryption.');
  process.exit(1);
}

if (process.argv[2] === 'unlock') {
  files.forEach(file => {
    // Check if plaintext file exists and is newer than the encrypted file
    const fsStat = (path) => {
      try { return fs.statSync(path); } catch { return null; }
    };

    const plainStats = fsStat(file.plaintext);
    const encryptedStats = fsStat(file.encrypted);
    if (!encryptedStats) {
      console.error(`Error: Missing encrypted file '${file.encrypted}'.`);
      process.exit(1);
    }

    if (
      plainStats && encryptedStats &&
      plainStats.mtime > encryptedStats.mtime
    ) {
      console.error(`Error: It looks like '${file.plaintext}' has been modified. Run 'npm run lock' to encrypt it first.`);
      process.exit(1);
    }

    decryptFile(file.encrypted, file.plaintext, password);
  });
} else if (process.argv[2] === 'clean') {
    // Remove the plaintext files
    files.forEach(file => {
     try {
       fs.unlinkSync(file.plaintext);
     } catch (err) {
       if (err.code !== 'ENOENT') {
         throw err;
       }
      }
       // File doesn't exist, nothing to clean
    });
} else {
  files.forEach(file => {
    encryptFile(file.plaintext, file.encrypted, password);
  });
}
