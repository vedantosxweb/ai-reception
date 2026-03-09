import type { NextRequest } from 'next/server';

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function stripTwilioWebhookPath(url: string): string {
  return stripTrailingSlash(url).replace(/\/api\/webhooks\/twilio\/?.*$/, '');
}

export function getTwilioWebhookBaseUrl(req?: NextRequest): string {
  const configured = process.env.TWILIO_WEBHOOK_URL;
  if (configured) return stripTwilioWebhookPath(configured);

  if (req) {
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    if (host) return `${proto}://${host}`;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  return stripTrailingSlash(appUrl);
}

export function buildTwilioWebhookUrl(path: string, req?: NextRequest): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getTwilioWebhookBaseUrl(req)}${normalizedPath}`;
}

export function shouldEnforceTwilioWebhookSignature(): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  const explicit = process.env.TWILIO_WEBHOOK_STRICT_VALIDATION;
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;
  return false;
}

export function isSmsEnabled(): boolean {
  return process.env.ENABLE_SMS !== 'false';
}
