/**
 * Auth utilities — JWT-like tokens using Node.js built-in crypto
 * No external deps required. httpOnly cookie storage.
 */
import { createHmac, pbkdf2Sync, randomBytes } from 'crypto'
import { cookies } from 'next/headers'

const JWT_SECRET = process.env.JWT_SECRET || 'ai-receptionist-secret-change-in-production'
const COOKIE_NAME = 'ar_token'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export interface TokenPayload {
  id: string
  email: string
  role: string
  name: string
  exp: number
}

// ─── Password Hashing ─────────────────────────────────────

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const incoming = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex')
  return incoming === hash
}

// ─── JWT Helpers ──────────────────────────────────────────

function base64url(str: string): string {
  return Buffer.from(str).toString('base64url')
}

function fromBase64url(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf8')
}

export function createToken(payload: Omit<TokenPayload, 'exp'>): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64url(JSON.stringify({ ...payload, exp: Date.now() + COOKIE_MAX_AGE * 1000 }))
  const sig = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const [header, body, sig] = token.split('.')
    if (!header || !body || !sig) return null
    const expected = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url')
    if (sig !== expected) return null
    const payload: TokenPayload = JSON.parse(fromBase64url(body))
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

// ─── Cookie Helpers (Server Components / Route Handlers) ──

export async function setAuthCookie(token: string) {
  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

export async function clearAuthCookie() {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

export async function getAuthUser(): Promise<TokenPayload | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}
