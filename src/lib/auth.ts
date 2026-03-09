// =============================================================================
// Auth Service - JWT + NextAuth integration with multi-tenancy
// =============================================================================

import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import bcryptjs from 'bcryptjs';
import type { UserRole } from '@prisma/client';

if (process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL.trim();
}
if (process.env.NEXTAUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET.trim();
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }, // 30 days
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;

        if (!email || !password) return null;

        const user = await db.user.findFirst({
          where: { email },
          include: {
            tenant: {
              select: {
                id: true,
                slug: true,
                name: true,
                status: true,
                plan: true,
                trialEndsAt: true,
              },
            },
          },
        });

        if (!user || !user.passwordHash) return null;
        if (user.status !== 'ACTIVE') return null;

        // Check tenant is active
        const tenant = user.tenant;
        if (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED') return null;
        if (tenant.status === 'TRIAL' && tenant.trialEndsAt && tenant.trialEndsAt < new Date()) return null;

        const isValid = await bcryptjs.compare(password, user.passwordHash);
        if (!isValid) return null;

        // Update last login
        log.auth.info({ userId: user.id, tenantId: user.tenant.id }, 'User login successful');
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        }).catch(() => {}); // non-blocking

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          tenantName: tenant.name,
          plan: tenant.plan,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as {
          id: string;
          email: string;
          name: string;
          role: UserRole;
          tenantId: string;
          tenantSlug: string;
          tenantName: string;
          plan: string;
        };
        token.sub = u.id;
        token.email = u.email;
        token.name = u.name;
        token.role = u.role;
        token.tenantId = u.tenantId;
        token.tenantSlug = u.tenantSlug;
        token.tenantName = u.tenantName;
        token.plan = u.plan;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub as string) || '';
        session.user.email = (token.email as string) || '';
        session.user.name = (token.name as string) || '';
        session.user.role = (token.role as UserRole) || 'MEMBER';
        session.user.tenantId = (token.tenantId as string) || '';
        session.user.tenantSlug = (token.tenantSlug as string) || '';
        session.user.tenantName = (token.tenantName as string) || '';
        session.user.plan = (token.plan as string) || 'STARTER';
      }
      return session;
    },
  },
};

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
