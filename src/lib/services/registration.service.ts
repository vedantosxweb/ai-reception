import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { TenantService } from '@/lib/services/tenant.service';
import { registrationSchema, validateRequest } from '@/lib/security/validation';
import { log } from '@/lib/logger';

type RegistrationSuccess = {
  success: true;
  tenant: { id: string; name: string; slug: string };
  user: { id: string; email: string; name: string; role: string };
};

type RegistrationFailure = {
  success: false;
  status: number;
  error: string;
};

export type RegistrationResult = RegistrationSuccess | RegistrationFailure;

async function sendEmailVerification(userId: string, email: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const verifyToken = randomBytes(32).toString('hex');
  await db.emailVerificationToken.create({
    data: {
      userId,
      token: verifyToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const verifyUrl = `${appUrl}/api/v1/auth/verify-email?token=${verifyToken}`;
  const { Resend } = await import('resend');
  const resend = new Resend(resendKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'AI Receptionist <notifications@resend.dev>';

  await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: 'Verify Your Email — AI Receptionist',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;"><tr><td align="center" style="padding:32px 16px;">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <tr><td style="background:#0f172a;padding:24px 32px;"><h1 style="margin:0;color:#fff;font-size:18px;">AI Receptionist</h1></td></tr>
      <tr><td style="padding:32px;">
        <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Verify Your Email</h2>
        <p style="margin:0 0 24px;font-size:14px;color:#64748b;">Welcome! Please verify your email to get started.</p>
        <a href="${verifyUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;text-decoration:none;">Verify Email</a>
      </td></tr>
      <tr><td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;"><p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">Sent by AI Receptionist</p></td></tr>
    </table>
  </td></tr></table>
</body></html>`,
  });
}

export async function registerTenantOwner(input: unknown): Promise<RegistrationResult> {
  const validation = validateRequest(registrationSchema, input);
  if (!validation.success) {
    return { success: false, status: 400, error: validation.error };
  }

  const { name, email, password, companyName, website, industry } = validation.data;

  const existing = await db.user.findFirst({ where: { email } });
  if (existing) {
    return {
      success: false,
      status: 409,
      error: 'An account with this email already exists',
    };
  }

  const baseSlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let slug = baseSlug.slice(0, 50) || 'company';
  let counter = 0;
  while (await db.tenant.findUnique({ where: { slug } })) {
    counter++;
    slug = `${baseSlug.slice(0, 46)}-${counter}`;
  }

  const passwordHash = await hashPassword(password);
  const { tenant, user } = await TenantService.create({
    name: companyName,
    slug,
    website: website || undefined,
    industry: industry || undefined,
    ownerEmail: email,
    ownerName: name,
    ownerPasswordHash: passwordHash,
  });

  try {
    await sendEmailVerification(user.id, email);
  } catch (verifyError) {
    log.auth.error({ error: verifyError }, 'Email verification send error');
  }

  return {
    success: true,
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}
