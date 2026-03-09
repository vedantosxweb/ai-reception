// =============================================================================
// Forgot Password - Request reset link (sends email)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email/email.service';
import { isEmailConfigured } from '@/lib/email/email.service';
import { checkRateLimitRedis } from '@/lib/redis';
import crypto from 'crypto';

const RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_PER_EMAIL = 5;
const RATE_LIMIT_WINDOW = 3600; // 1 hour

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Rate limit by email (optional if Redis unavailable)
    try {
      const rl = await checkRateLimitRedis(
        `forgot-pw:${email}`,
        RATE_LIMIT_PER_EMAIL,
        RATE_LIMIT_WINDOW
      );
      if (!rl.allowed) {
        return NextResponse.json(
          { success: false, error: 'Too many requests. Try again later.' },
          { status: 429 }
        );
      }
    } catch {
      // Redis not available; allow request
    }

    if (!isEmailConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Password reset is not configured. Contact support.' },
        { status: 503 }
      );
    }

    const user = await db.user.findFirst({
      where: { email, status: 'ACTIVE' },
      select: { id: true, email: true },
    });

    // Always return success to avoid email enumeration
    if (!user) {
      return NextResponse.json({ success: true, message: 'If an account exists, you will receive an email.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + RESET_EXPIRY_MS);

    await db.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpires },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetLink = `${appUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

    const sent = await sendPasswordResetEmail(user.email, resetLink);
    if (!sent) {
      return NextResponse.json(
        { success: false, error: 'Failed to send email. Try again later.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'If an account exists, you will receive an email.' });
  } catch (err) {
    console.error('[ForgotPassword] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Something went wrong.' },
      { status: 500 }
    );
  }
}
