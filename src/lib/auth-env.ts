function clean(value?: string | null): string {
  return value?.trim() || '';
}

export function getAuthSecret(): string {
  return clean(process.env.NEXTAUTH_SECRET) || clean(process.env.AUTH_SECRET);
}

export function getAuthBaseUrl(): string {
  const explicit = clean(process.env.NEXTAUTH_URL);
  const vercelUrl = clean(process.env.VERCEL_URL);

  // On hosted envs, fall back to VERCEL_URL when NEXTAUTH_URL is missing/localhost.
  if ((!explicit || explicit.includes('localhost')) && vercelUrl) {
    return vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;
  }

  return explicit || 'http://localhost:3000';
}
