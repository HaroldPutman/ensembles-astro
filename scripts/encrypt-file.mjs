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
const algorithm = 'aes-256-cbc'; // Algorithm to use
const iterations = 100000; // Number of iterations for PBKDF2
const keyLength = 32; // Key length for AES-256
const ivLength = 16; // IV length for AES

// Function to derive a key and IV from a passphrase and salt
function deriveKeyAndIV(password, salt) {
  // Derive the key using PBKDF2
  const key = crypto.pbkdf2Sync(password, salt, iterations, keyLength, 'sha256');
  const iv = key.subarray(0, ivLength); // Use the first 16 bytes as the IV
  return { key, iv };
}

// Function to encrypt the file content
function encryptFile(plainTextFilePath, cryptFilePath, password) {
  try {
    const salt = crypto.randomBytes(16);
    const { key, iv } = deriveKeyAndIV(password, salt);
    const fileData = fs.readFileSync(plainTextFilePath);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const encryptedData = Buffer.concat([cipher.update(fileData), cipher.final()]);
    fs.writeFileSync(cryptFilePath, Buffer.concat([salt, encryptedData]));
    console.log(`File ${plainTextFilePath} encrypted successfully to ${cryptFilePath}`);
  } catch (error) {
    console.error('Error during encryption:', error.message);
  }
}

// Function to decrypt the file content
function decryptFile(cryptFilePath, plainTextFilePath, password) {
  try {
    const fileData = fs.readFileSync(cryptFilePath);
    const salt = fileData.subarray(0, 16);
    const encryptedData = fileData.subarray(16);
    const { key, iv } = deriveKeyAndIV(password, salt);
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
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
  }
}


const password = process.env.GIT_CRYPT_KEY;

if (process.argv[2] === 'unlock') {
  files.forEach(file => {
    // Check if plaintext file exists and is newer than the encrypted file
    const fsStat = (path) => {
      try { return fs.statSync(path); } catch { return null; }
    };

    const plainStats = fsStat(file.plaintext);
    const encryptedStats = fsStat(file.encrypted);

    if (
      plainStats && encryptedStats &&
      plainStats.mtime > encryptedStats.mtime
    ) {
      console.error(`Error: It looks like '${file.plaintext}' has been modified. Run 'npm lock' to encrypt it first.`);
      process.exit(-1);
    }

    decryptFile(file.encrypted, file.plaintext, password);
  });
} else {
  files.forEach(file => {
    encryptFile(file.plaintext, file.encrypted, password);
  });
}
