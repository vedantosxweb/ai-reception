// =============================================================================
// FX Rate Utility - converts currencies for analytics rollups
// =============================================================================

const DEFAULT_FX_API_URL = 'https://api.frankfurter.app/latest';
const DEFAULT_CACHE_TTL_MINUTES = 360;

type FxCacheEntry = {
  rate: number;
  expiresAt: number;
};

const fxRateCache = new Map<string, FxCacheEntry>();
const fxInflight = new Map<string, Promise<number | null>>();

function pairKey(from: string, to: string): string {
  return `${from}->${to}`;
}

function getCacheTtlMs(): number {
  const minutes = Number(process.env.FX_CACHE_TTL_MINUTES || DEFAULT_CACHE_TTL_MINUTES);
  if (!Number.isFinite(minutes) || minutes <= 0) return DEFAULT_CACHE_TTL_MINUTES * 60 * 1000;
  return minutes * 60 * 1000;
}

async function fetchFxRate(from: string, to: string): Promise<number | null> {
  const apiUrl = (process.env.FX_API_URL || DEFAULT_FX_API_URL).trim();
  const url = `${apiUrl}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as { rates?: Record<string, number> };
    const rate = payload?.rates?.[to];
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return null;
    return rate;
  } catch {
    return null;
  }
}

export async function getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number | null> {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) return null;
  if (from === to) return 1;

  const key = pairKey(from, to);
  const now = Date.now();
  const cached = fxRateCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.rate;
  }

  const inflight = fxInflight.get(key);
  if (inflight) return inflight;

  const request = (async () => {
    const rate = await fetchFxRate(from, to);
    if (rate && Number.isFinite(rate)) {
      fxRateCache.set(key, { rate, expiresAt: now + getCacheTtlMs() });
      return rate;
    }

    // Fall back to stale cache if present.
    if (cached && Number.isFinite(cached.rate) && cached.rate > 0) {
      return cached.rate;
    }

    return null;
  })();

  fxInflight.set(key, request);
  try {
    return await request;
  } finally {
    fxInflight.delete(key);
  }
}

export async function convertCurrencyAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number | null> {
  if (!Number.isFinite(amount)) return null;
  const rate = await getExchangeRate(fromCurrency, toCurrency);
  if (!rate) return null;
  return amount * rate;
}
