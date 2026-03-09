// =============================================================================
// Forgot Password API — Generates reset token and sends email
// POST /api/v1/auth/forgot-password
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateSecureToken } from '@/lib/security/crypto';
import { rateLimitAuth } from '@/lib/security/rate-limit';
import { forgotPasswordSchema, validateRequest } from '@/lib/security/validation';

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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    try {
      const { Resend } = await import('resend');
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        const resend = new Resend(resendKey);
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'AI Receptionist <notifications@resend.dev>';

        await resend.emails.send({
          from: fromEmail,
          to: email,
          subject: 'Reset Your Password — AI Receptionist',
          html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:#0f172a;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">AI Receptionist</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Reset Your Password</h2>
          <p style="margin:0 0 24px;font-size:14px;color:#64748b;">
            We received a request to reset your password. Click the button below to create a new password. This link expires in 1 hour.
          </p>
          <a href="${resetUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;text-decoration:none;">
            Reset Password
          </a>
          <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">
            If you didn't request this, you can safely ignore this email. Your password will not be changed.
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">Sent by AI Receptionist</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        });
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
