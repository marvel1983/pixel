import bcrypt from 'bcrypt';
import crypto from 'node:crypto';

const PRF_MAP: Record<number, string> = {
  0: 'sha1',
  1: 'sha256',
  2: 'sha512',
};

export async function verifyPassword(
  plaintext: string,
  storedHash: string
): Promise<boolean> {
  if (storedHash.startsWith('$2')) {
    return bcrypt.compare(plaintext, storedHash);
  }

  if (isAspNetIdentityV3Hash(storedHash)) {
    return verifyAspNetIdentityV3(plaintext, storedHash);
  }

  return false;
}

function isAspNetIdentityV3Hash(hash: string): boolean {
  try {
    const buffer = Buffer.from(hash, 'base64');
    return buffer.length >= 13 && buffer[0] === 0x01;
  } catch {
    return false;
  }
}

function verifyAspNetIdentityV3(
  plaintext: string,
  storedHash: string
): boolean {
  try {
    const hashBytes = Buffer.from(storedHash, 'base64');

    if (hashBytes.length < 13) {
      return false;
    }

    if (hashBytes[0] !== 0x01) {
      return false;
    }

    const prf = hashBytes.readUInt32BE(1);
    const algorithm = PRF_MAP[prf];
    if (!algorithm) {
      return false;
    }

    const iterCount = hashBytes.readUInt32BE(5);
    const saltLength = hashBytes.readUInt32BE(9);

    if (hashBytes.length < 13 + saltLength) {
      return false;
    }

    const salt = hashBytes.subarray(13, 13 + saltLength);
    const expectedSubkey = hashBytes.subarray(13 + saltLength);

    const derivedKey = crypto.pbkdf2Sync(
      plaintext,
      salt,
      iterCount,
      expectedSubkey.length,
      algorithm
    );

    return crypto.timingSafeEqual(derivedKey, expectedSubkey);
  } catch {
    return false;
  }
}

export function getHashType(hash: string): 'bcrypt' | 'aspnet-v3' | 'unknown' {
  if (hash.startsWith('$2')) {
    return 'bcrypt';
  }
  if (isAspNetIdentityV3Hash(hash)) {
    return 'aspnet-v3';
  }
  return 'unknown';
}
