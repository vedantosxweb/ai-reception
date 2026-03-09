// =============================================================================
// Forgot Password API — Generates reset token and sends email
// POST /api/v1/auth/forgot-password
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateSecureToken } from '@/lib/security/crypto';
import { rateLimitAuth } from '@/lib/security/rate-limit';
import { forgotPasswordSchema, validateRequest } from '@/lib/security/validation';
import { getAppBaseUrl } from '@/lib/app-url';
import { sendPasswordResetEmail } from '@/lib/email/email.service';

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 attempts per minute per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const rateLimited = await rateLimitAuth(ip);
    if (rateLimited) return rateLimited;

    const body = await req.json();
    const validation = validateRequest(forgotPasswordSchema, body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    const { email } = validation.data;

    // Always return success to prevent email enumeration
    const successResponse = NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });

    const user = await db.user.findFirst({
      where: { email, status: 'ACTIVE' },
    });

    if (!user) return successResponse;

    // Delete any existing tokens for this user
    await db.passwordResetToken.deleteMany({ where: { userId: user.id } });

    // Generate token (expires in 1 hour)
    const token = generateSecureToken(32);
    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // Send email
    const appUrl = getAppBaseUrl();
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    try {
      const sent = await sendPasswordResetEmail(email, resetUrl);
      if (!sent) {
        console.error('[Auth] Failed to send password reset email: RESEND_API_KEY missing or send failed');
      }
    } catch (emailError) {
      console.error('[Auth] Failed to send password reset email:', emailError);
    }

    return successResponse;
  } catch (error) {
    console.error('[Auth] Forgot password error:', error);
    return NextResponse.json({ success: false, error: 'An error occurred' }, { status: 500 });
  }
}
