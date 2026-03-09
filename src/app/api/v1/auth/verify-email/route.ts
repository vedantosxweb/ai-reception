// =============================================================================
// Email Verification API — Verifies email via token
// GET /api/v1/auth/verify-email?token=...
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json({ success: false, error: 'Missing verification token' }, { status: 400 });
    }

    const verificationToken = await db.emailVerificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { success: false, error: 'Invalid verification link.' },
        { status: 400 }
      );
    }

    if (verificationToken.usedAt) {
      // Already verified — redirect to login
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      return NextResponse.redirect(`${appUrl}/login?verified=true`);
    }

    if (verificationToken.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Verification link has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Mark email as verified
    await db.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: true },
    });

    // Mark token as used
    await db.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() },
    });

    // Redirect to login with success
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${appUrl}/login?verified=true`);
  } catch (error) {
    console.error('[Auth] Email verification error:', error);
    return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 });
  }
}
