/**
 * Edge-safe auth helpers for middleware/runtime environments without Node crypto.
 */

const JWT_SECRET = process.env.JWT_SECRET || 'ai-receptionist-secret-change-in-production'

export interface TokenPayload {
  id: string
  email: string
  role: string
  name: string
  exp: number
}

function base64UrlToBase64(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padding = (4 - (normalized.length % 4)) % 4
  return normalized + '='.repeat(padding)
}

function decodeBase64Url(input: string): string {
  return atob(base64UrlToBase64(input))
}

async function verifySignature(unsignedToken: string, signature: string): Promise<boolean> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )

  const sigBytes = Uint8Array.from(atob(base64UrlToBase64(signature)), c => c.charCodeAt(0))

  return crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(unsignedToken))
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const [header, body, sig] = token.split('.')
    if (!header || !body || !sig) return null

    const valid = await verifySignature(`${header}.${body}`, sig)
    if (!valid) return null

    const payload: TokenPayload = JSON.parse(decodeBase64Url(body))
    if (payload.exp < Date.now()) return null

    return payload
  } catch {
    return null
  }
}
