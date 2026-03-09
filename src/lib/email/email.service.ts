// =============================================================================
// Email Service - Resend-powered notifications for missed calls,
//                voicemails, and daily call summaries
// =============================================================================

import { Resend } from 'resend';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';

// =============================================================================
// Client
// =============================================================================

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

const fromEmail = () =>
  process.env.RESEND_FROM_EMAIL || 'AI Receptionist <notifications@resend.dev>';

const appUrl = () =>
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// =============================================================================
// Helpers
// =============================================================================

/** Get OWNER + ADMIN users for a tenant (active only). */
async function getNotificationRecipients(tenantId: string): Promise<string[]> {
  const users = await db.user.findMany({
    where: {
      tenantId,
      status: 'ACTIVE',
      role: { in: ['OWNER', 'ADMIN'] },
    },
    select: { email: true },
  });
  return users.map((u) => u.email);
}

function formatPhone(phone: string): string {
  // +1XXXXXXXXXX → (XXX) XXX-XXXX
  if (phone.startsWith('+1') && phone.length === 12) {
    return `(${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8)}`;
  }
  return phone;
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return 'N/A';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// =============================================================================
// Shared template shell
// =============================================================================

function emailShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr><td style="background:#0f172a;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">AI Receptionist</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
            <a href="${appUrl()}/dashboard" style="color:#6366f1;text-decoration:none;">Open Dashboard</a>
            &nbsp;&middot;&nbsp; Sent by AI Receptionist
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// =============================================================================
// 0. Password Reset
// =============================================================================

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;

  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Reset your password</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;">You requested a password reset. Click the button below to set a new password. This link expires in 1 hour.</p>
    <a href="${resetLink}" style="display:inline-block;background:#6366f1;color:#ffffff;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:500;text-decoration:none;">
      Reset password
    </a>
    <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">If you didn't request this, you can ignore this email.</p>`;

  try {
    await resend.emails.send({
      from: fromEmail(),
      to: [to],
      subject: 'Reset your AI Receptionist password',
      html: emailShell('Reset password', body),
    });
    return true;
  } catch (error) {
    console.error('[Email] Failed to send password reset:', error);
    return false;
  }
}

// =============================================================================
// 1. Missed Call Alert
// =============================================================================

interface MissedCallData {
  tenantId: string;
  callerNumber: string;
  dialedNumber: string;
  status: string; // FAILED | BUSY | NO_ANSWER
  startedAt: Date | string;
  contactName?: string;
  receptionistName?: string;
}

export async function sendMissedCallAlert(data: MissedCallData): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const recipients = await getNotificationRecipients(data.tenantId);
  if (recipients.length === 0) return;

  const statusLabel =
    data.status === 'BUSY' ? 'Busy' :
    data.status === 'NO_ANSWER' ? 'No Answer' : 'Failed';

  const callerDisplay = data.contactName || formatPhone(data.callerNumber);

  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Missed Call</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;">A call was not connected. Here are the details:</p>
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:12px 16px;background:#fef2f2;border-radius:8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#64748b;width:120px;">Caller</td>
              <td style="padding:4px 0;font-size:14px;color:#0f172a;font-weight:500;">${callerDisplay}</td>
            </tr>
            ${data.contactName ? `<tr>
              <td style="padding:4px 0;font-size:13px;color:#64748b;">Phone</td>
              <td style="padding:4px 0;font-size:14px;color:#0f172a;">${formatPhone(data.callerNumber)}</td>
            </tr>` : ''}
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#64748b;">Dialed Number</td>
              <td style="padding:4px 0;font-size:14px;color:#0f172a;">${formatPhone(data.dialedNumber)}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#64748b;">Status</td>
              <td style="padding:4px 0;font-size:14px;color:#dc2626;font-weight:500;">${statusLabel}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#64748b;">Time</td>
              <td style="padding:4px 0;font-size:14px;color:#0f172a;">${formatDate(data.startedAt)}</td>
            </tr>
            ${data.receptionistName ? `<tr>
              <td style="padding:4px 0;font-size:13px;color:#64748b;">Receptionist</td>
              <td style="padding:4px 0;font-size:14px;color:#0f172a;">${data.receptionistName}</td>
            </tr>` : ''}
          </table>
        </td>
      </tr>
    </table>

    <a href="${appUrl()}/dashboard" style="display:inline-block;background:#6366f1;color:#ffffff;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:500;text-decoration:none;">
      View Call Logs
    </a>`;

  try {
    await resend.emails.send({
      from: fromEmail(),
      to: recipients,
      subject: `Missed Call from ${callerDisplay}`,
      html: emailShell('Missed Call Alert', body),
    });
    log.webhook.info({ tenantId: data.tenantId, caller: data.callerNumber }, 'Missed call email sent');
  } catch (error) {
    console.error('[Email] Failed to send missed call alert:', error);
  }
}

// =============================================================================
// 2. Voicemail Notification
// =============================================================================

interface VoicemailData {
  tenantId: string;
  callerNumber: string;
  dialedNumber: string;
  recordingUrl: string;
  duration?: number | null;
  startedAt: Date | string;
  contactName?: string;
  receptionistName?: string;
}

export async function sendVoicemailNotification(data: VoicemailData): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const recipients = await getNotificationRecipients(data.tenantId);
  if (recipients.length === 0) return;

  const callerDisplay = data.contactName || formatPhone(data.callerNumber);

  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">New Voicemail</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;">You received a voicemail. Listen to it below or on the dashboard.</p>
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:12px 16px;background:#eff6ff;border-radius:8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#64748b;width:120px;">Caller</td>
              <td style="padding:4px 0;font-size:14px;color:#0f172a;font-weight:500;">${callerDisplay}</td>
            </tr>
            ${data.contactName ? `<tr>
              <td style="padding:4px 0;font-size:13px;color:#64748b;">Phone</td>
              <td style="padding:4px 0;font-size:14px;color:#0f172a;">${formatPhone(data.callerNumber)}</td>
            </tr>` : ''}
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#64748b;">Time</td>
              <td style="padding:4px 0;font-size:14px;color:#0f172a;">${formatDate(data.startedAt)}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#64748b;">Duration</td>
              <td style="padding:4px 0;font-size:14px;color:#0f172a;">${formatDuration(data.duration)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <a href="${data.recordingUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:500;text-decoration:none;margin-right:8px;">
      Listen to Voicemail
    </a>
    <a href="${appUrl()}/dashboard" style="display:inline-block;background:#e2e8f0;color:#0f172a;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:500;text-decoration:none;">
      Open Dashboard
    </a>`;

  try {
    await resend.emails.send({
      from: fromEmail(),
      to: recipients,
      subject: `New Voicemail from ${callerDisplay}`,
      html: emailShell('Voicemail Notification', body),
    });
    log.webhook.info({ tenantId: data.tenantId, caller: data.callerNumber }, 'Voicemail email sent');
  } catch (error) {
    console.error('[Email] Failed to send voicemail notification:', error);
  }
}

// =============================================================================
// 3. Daily Call Summary
// =============================================================================

interface DailySummaryData {
  tenantId: string;
  tenantName: string;
  date: Date;
  totalCalls: number;
  completedCalls: number;
  missedCalls: number;
  totalMinutes: number;
  avgDuration: number;
  topIntents: { intent: string; count: number }[];
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
}

export async function sendDailySummary(data: DailySummaryData): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const recipients = await getNotificationRecipients(data.tenantId);
  if (recipients.length === 0) return;

  const dateStr = data.date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const answerRate = data.totalCalls > 0
    ? Math.round((data.completedCalls / data.totalCalls) * 100)
    : 0;

  const intentsHtml = data.topIntents.length > 0
    ? data.topIntents.slice(0, 5).map((i) =>
        `<tr>
          <td style="padding:4px 0;font-size:13px;color:#0f172a;">${i.intent}</td>
          <td style="padding:4px 0;font-size:13px;color:#64748b;text-align:right;">${i.count} calls</td>
        </tr>`
      ).join('')
    : '<tr><td style="padding:4px 0;font-size:13px;color:#94a3b8;">No intents recorded</td></tr>';

  const statBox = (label: string, value: string, color: string) =>
    `<td style="padding:12px;text-align:center;background:#f8fafc;border-radius:8px;">
      <p style="margin:0;font-size:24px;font-weight:700;color:${color};">${value}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#64748b;">${label}</p>
    </td>`;

  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Daily Call Summary</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;">${data.tenantName} &mdash; ${dateStr}</p>
    
    <!-- Key Metrics -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="8" style="margin-bottom:24px;">
      <tr>
        ${statBox('Total Calls', String(data.totalCalls), '#0f172a')}
        ${statBox('Completed', String(data.completedCalls), '#16a34a')}
        ${statBox('Missed', String(data.missedCalls), '#dc2626')}
      </tr>
      <tr>
        ${statBox('Total Minutes', String(data.totalMinutes), '#0f172a')}
        ${statBox('Avg Duration', formatDuration(data.avgDuration), '#6366f1')}
        ${statBox('Answer Rate', `${answerRate}%`, answerRate >= 80 ? '#16a34a' : '#f59e0b')}
      </tr>
    </table>

    <!-- Sentiment -->
    <h3 style="margin:0 0 8px;font-size:14px;color:#0f172a;font-weight:600;">Caller Sentiment</h3>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:8px 12px;background:#f0fdf4;border-radius:6px 0 0 6px;text-align:center;">
          <span style="font-size:13px;color:#16a34a;">Positive: ${data.sentimentBreakdown.positive}</span>
        </td>
        <td style="padding:8px 12px;background:#f8fafc;text-align:center;">
          <span style="font-size:13px;color:#64748b;">Neutral: ${data.sentimentBreakdown.neutral}</span>
        </td>
        <td style="padding:8px 12px;background:#fef2f2;border-radius:0 6px 6px 0;text-align:center;">
          <span style="font-size:13px;color:#dc2626;">Negative: ${data.sentimentBreakdown.negative}</span>
        </td>
      </tr>
    </table>

    <!-- Top Intents -->
    <h3 style="margin:0 0 8px;font-size:14px;color:#0f172a;font-weight:600;">Top Call Intents</h3>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${intentsHtml}
    </table>

    <a href="${appUrl()}/dashboard" style="display:inline-block;background:#6366f1;color:#ffffff;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:500;text-decoration:none;">
      View Full Analytics
    </a>`;

  try {
    await resend.emails.send({
      from: fromEmail(),
      to: recipients,
      subject: `Daily Summary: ${data.totalCalls} calls on ${dateStr}`,
      html: emailShell('Daily Call Summary', body),
    });
    log.webhook.info({ tenantId: data.tenantId }, 'Daily summary email sent');
  } catch (error) {
    console.error('[Email] Failed to send daily summary:', error);
  }
}

// =============================================================================
// Daily Summary Data Builder
// Queries the DB for a tenant's calls from the previous day and builds
// the DailySummaryData object, then sends the email.
// =============================================================================

export async function buildAndSendDailySummary(tenantId: string): Promise<void> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant || tenant.status === 'CANCELLED') return;

  // Yesterday midnight-to-midnight (UTC)
  const now = new Date();
  const startOfYesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const endOfYesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const calls = await db.call.findMany({
    where: {
      tenantId,
      startedAt: { gte: startOfYesterday, lt: endOfYesterday },
    },
    select: {
      status: true,
      duration: true,
      sentiment: true,
      intent: true,
    },
  });

  if (calls.length === 0) return; // Don't send if no calls

  const completedCalls = calls.filter((c) => c.status === 'COMPLETED').length;
  const missedCalls = calls.filter((c) =>
    ['FAILED', 'BUSY', 'NO_ANSWER'].includes(c.status)
  ).length;

  const durations = calls.filter((c) => c.duration != null).map((c) => c.duration!);
  const totalMinutes = Math.ceil(durations.reduce((a, b) => a + b, 0) / 60);
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  // Intent counts
  const intentMap = new Map<string, number>();
  for (const c of calls) {
    if (c.intent) {
      intentMap.set(c.intent, (intentMap.get(c.intent) || 0) + 1);
    }
  }
  const topIntents = Array.from(intentMap.entries())
    .map(([intent, count]) => ({ intent, count }))
    .sort((a, b) => b.count - a.count);

  // Sentiment
  const sentimentBreakdown = { positive: 0, neutral: 0, negative: 0 };
  for (const c of calls) {
    if (c.sentiment === 'POSITIVE') sentimentBreakdown.positive++;
    else if (c.sentiment === 'NEGATIVE') sentimentBreakdown.negative++;
    else sentimentBreakdown.neutral++;
  }

  await sendDailySummary({
    tenantId,
    tenantName: tenant.name,
    date: startOfYesterday,
    totalCalls: calls.length,
    completedCalls,
    missedCalls,
    totalMinutes,
    avgDuration,
    topIntents,
    sentimentBreakdown,
  });
}
