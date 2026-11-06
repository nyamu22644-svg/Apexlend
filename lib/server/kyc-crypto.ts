import { createCipheriv, createHash, randomBytes } from 'crypto';

function key(): Buffer {
  const value = process.env.KYC_PII_ENCRYPTION_KEY;
  if (!value || value.includes('replace-with') || value.length < 32) {
    throw new Error('KYC_PII_ENCRYPTION_KEY must be configured as a server-only secret');
  }
  return createHash('sha256').update(value).digest();
}

export function encryptPii(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(value.trim(), 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function hashNationalId(value: string): string {
  const pepper = process.env.KYC_PII_HASH_PEPPER;
  if (!pepper || pepper.includes('replace-with') || pepper.length < 32) {
    throw new Error('KYC_PII_HASH_PEPPER must be configured as a server-only secret');
  }
  return createHash('sha256').update(`${pepper}:${value.trim()}`).digest('hex');
}
