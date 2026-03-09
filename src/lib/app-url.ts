function trim(value?: string | null): string {
  const raw = value?.trim() || '';
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1).trim();
  }
  return raw;
}

function toCandidate(raw: string): string {
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('localhost') || raw.startsWith('127.0.0.1')) return `http://${raw}`;
  return `https://${raw}`;
}

function parseOrigin(raw?: string | null): string | null {
  const candidate = toCandidate(trim(raw));
  if (!candidate) return null;
  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
}

export function getAppBaseUrl(): string {
  return (
    parseOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    parseOrigin(process.env.NEXTAUTH_URL) ||
    parseOrigin(process.env.VERCEL_URL) ||
    'http://localhost:3000'
  );
}
