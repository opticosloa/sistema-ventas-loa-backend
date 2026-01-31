import crypto from 'crypto';
import { envs } from './envs';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = envs.MP_ENCRYPTION_KEY || ''; // Must be 32 chars
const IV_LENGTH = 16; // AES block size

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    console.warn('MP_ENCRYPTION_KEY is not set or not 32 characters long. Encryption will fail.');
}

export const encrypt = (text: string): string => {
    if (!text) return text;
    // Check key at runtime to fail fast if not configured
    if (ENCRYPTION_KEY.length !== 32) {
        throw new Error('Invalid Encryption Key length. Must be 32 characters.');
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return iv.toString('hex') + ':' + encrypted.toString('hex');
};

export const decrypt = (text: string): string => {
    if (!text) return text;
    // Check format iv:content
    const textParts = text.split(':');
    if (textParts.length !== 2) {
        // Fallback: maybe it's not encrypted or old format? Return as is or throw?
        // For safety, if it doesn't look like iv:hex, return original (or empty string if strictly enforcing).
        // Given requirements, let's assume valid input or handle gracefully.
        return text;
    }

    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');

    try {
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        console.error('Error decrypting text:', error);
        return text; // Return original if decryption fails (e.g. key changed)
    }
};
