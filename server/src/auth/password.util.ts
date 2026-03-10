import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const SCRYPT_KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [salt, expectedHash] = encoded.split(':');
  if (!salt || !expectedHash) return false;

  const computed = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  const expected = Buffer.from(expectedHash, 'hex');

  if (computed.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(computed, expected);
}
