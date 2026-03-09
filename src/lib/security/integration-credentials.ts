import type { Prisma } from '@prisma/client';
import { decrypt, encrypt } from '@/lib/security/crypto';
import { log } from '@/lib/logger';

interface EncryptedCredentialsEnvelope {
  __encrypted: true;
  v: 1;
  alg: 'aes-256-gcm';
  data: string;
}

function toStringRecord(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string') out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function isEncryptedEnvelope(value: unknown): value is EncryptedCredentialsEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const maybe = value as Partial<EncryptedCredentialsEnvelope>;
  return maybe.__encrypted === true && maybe.v === 1 && maybe.alg === 'aes-256-gcm' && typeof maybe.data === 'string';
}

export function serializeIntegrationCredentials(
  credentials: Record<string, string>
): Prisma.InputJsonValue {
  try {
    return {
      __encrypted: true,
      v: 1,
      alg: 'aes-256-gcm',
      data: encrypt(JSON.stringify(credentials)),
    } satisfies EncryptedCredentialsEnvelope as unknown as Prisma.InputJsonValue;
  } catch (error) {
    log.auth.warn(
      { error: error instanceof Error ? error.message : String(error) },
      'ENCRYPTION_KEY missing/invalid. Storing integration credentials in plaintext for compatibility.'
    );
    return credentials as unknown as Prisma.InputJsonValue;
  }
}

export function deserializeIntegrationCredentials(value: unknown): Record<string, string> | null {
  if (isEncryptedEnvelope(value)) {
    try {
      const decrypted = decrypt(value.data);
      const parsed = JSON.parse(decrypted) as unknown;
      return toStringRecord(parsed);
    } catch (error) {
      log.auth.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to decrypt integration credentials'
      );
      return null;
    }
  }

  return toStringRecord(value);
}

export function integrationCredentialsAreEncrypted(value: unknown): boolean {
  return isEncryptedEnvelope(value);
}
