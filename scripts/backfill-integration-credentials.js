/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const { createCipheriv, randomBytes } = require('crypto');

const prisma = new PrismaClient();

function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error(
      'ENCRYPTION_KEY must be set and at least 32 hex characters. Generate one with: openssl rand -hex 32'
    );
  }
  return Buffer.from(key.slice(0, 64), 'hex');
}

function encrypt(plaintext) {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function isEncryptedEnvelope(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      value.__encrypted === true &&
      value.v === 1 &&
      value.alg === 'aes-256-gcm' &&
      typeof value.data === 'string'
  );
}

async function main() {
  const integrations = await prisma.integration.findMany({
    where: { credentials: { not: null } },
    select: { id: true, credentials: true, provider: true, tenantId: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const integration of integrations) {
    const raw = integration.credentials;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      skipped++;
      continue;
    }
    if (isEncryptedEnvelope(raw)) {
      skipped++;
      continue;
    }

    const encryptedPayload = {
      __encrypted: true,
      v: 1,
      alg: 'aes-256-gcm',
      data: encrypt(JSON.stringify(raw)),
    };

    await prisma.integration.update({
      where: { id: integration.id },
      data: { credentials: encryptedPayload },
    });
    updated++;
  }

  console.log(`[Backfill] Completed. Updated=${updated} Skipped=${skipped}`);
}

main()
  .catch((error) => {
    console.error('[Backfill] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
