/* eslint-disable no-console */
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

const skipLlmCheck = process.argv.includes('--skip-llm') || process.env.SKIP_LLM_KEY_CHECK === 'true';

function isHex(str) {
  return /^[0-9a-fA-F]+$/.test(str);
}

async function main() {
  const errors = [];
  const warnings = [];

  const requiredEnv = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'NEXT_PUBLIC_APP_URL',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
    'CREEM_API_KEY',
    'CREEM_WEBHOOK_SECRET',
  ];

  for (const key of requiredEnv) {
    if (!process.env[key] || !String(process.env[key]).trim()) {
      errors.push(`Missing required env: ${key}`);
    }
  }

  const hasLlm = Boolean(
    process.env.OPENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.ANTHROPIC_API_KEY
  );
  if (!hasLlm) {
    if (skipLlmCheck) {
      warnings.push('Skipping LLM key check (--skip-llm / SKIP_LLM_KEY_CHECK=true).');
    } else {
      errors.push('At least one LLM key is required: OPENAI_API_KEY or GEMINI_API_KEY or ANTHROPIC_API_KEY');
    }
  }

  const nextAuthSecret = process.env.NEXTAUTH_SECRET || '';
  if (nextAuthSecret.length < 32) {
    errors.push('NEXTAUTH_SECRET must be at least 32 characters');
  }

  const encryptionKey = process.env.ENCRYPTION_KEY || '';
  if (!encryptionKey) {
    warnings.push('ENCRYPTION_KEY is not set. Integration credentials may not be encrypted at rest.');
  } else if (encryptionKey.length < 64 || !isHex(encryptionKey.slice(0, 64))) {
    errors.push('ENCRYPTION_KEY must be a valid hex key (generate with: openssl rand -hex 32)');
  }

  const strictValidation = process.env.TWILIO_WEBHOOK_STRICT_VALIDATION;
  if (process.env.NODE_ENV === 'production' && strictValidation === 'false') {
    warnings.push('TWILIO_WEBHOOK_STRICT_VALIDATION=false in production is not recommended.');
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    errors.push(`Database connectivity failed: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }

  console.log('=== Launch Readiness Check ===');
  if (warnings.length > 0) {
    console.log('\nWarnings:');
    for (const w of warnings) console.log(`- ${w}`);
  }
  if (errors.length > 0) {
    console.log('\nErrors:');
    for (const e of errors) console.log(`- ${e}`);
    process.exitCode = 1;
    return;
  }

  console.log('\nAll critical checks passed.');
}

main().catch((error) => {
  console.error('Launch readiness check failed:', error);
  process.exitCode = 1;
});
