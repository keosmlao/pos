import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// hash ໃໝ່ທັງໝົດໃຊ້ bcrypt; hash ເກົ່າເປັນ sha256 hex (64 ຕົວ) ຍັງກວດໄດ້
// ແລະຈະຖືກ upgrade ເປັນ bcrypt ອັດຕະໂນມັດຕອນ login ສຳເລັດ

const sha256 = (password) => crypto.createHash('sha256').update(String(password || '')).digest('hex');

export const isLegacyHash = (stored) => /^[0-9a-f]{64}$/.test(String(stored || ''));

export async function hashPassword(password) {
  return bcrypt.hash(String(password || ''), 10);
}

export async function verifyPassword(password, stored) {
  if (!stored) return false;
  if (isLegacyHash(stored)) {
    const a = Buffer.from(sha256(password));
    const b = Buffer.from(stored);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  return bcrypt.compare(String(password || ''), stored);
}
