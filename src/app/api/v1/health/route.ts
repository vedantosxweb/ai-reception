// =============================================================================
// Health Check API
// =============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

  // Database check
  const dbStart = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = { status: 'healthy', latencyMs: Date.now() - dbStart };
  } catch (err) {
    checks.database = { status: 'unhealthy', latencyMs: Date.now() - dbStart, error: (err as Error).message };
  }

  // Twilio check
  checks.twilio = {
    status: process.env.TWILIO_ACCOUNT_SID ? 'configured' : 'not_configured',
  };

  // Creem (billing) check
  checks.creem = {
    status: process.env.CREEM_API_KEY ? 'configured' : 'not_configured',
  };

  // LLM check
  const hasLLM = !!(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY);
  checks.llm = {
    status: hasLLM ? 'configured' : 'not_configured',
  };

  const allHealthy = checks.database.status === 'healthy';

  return NextResponse.json({
    status: allHealthy ? 'healthy' : 'degraded',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
  }, { status: allHealthy ? 200 : 503 });
}
