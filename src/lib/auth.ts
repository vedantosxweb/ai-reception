// =============================================================================
// Auth Utilities - Password hashing and role checks
// =============================================================================

import bcryptjs from 'bcryptjs';
import type { UserRole } from '@prisma/client';

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

// Role checks
export function isOwnerOrAdmin(role: UserRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function isOwner(role: UserRole): boolean {
  return role === 'OWNER';
}
