// =============================================================================
// NextAuth Type Augmentation - Multi-tenant session
// =============================================================================

import type { UserRole } from '@prisma/client';
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      tenantId: string;
      tenantSlug: string;
      tenantName: string;
      plan: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    tenantId: string;
    tenantSlug: string;
    tenantName: string;
    plan: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    sub: string;
    email: string;
    name: string;
    role: UserRole;
    tenantId: string;
    tenantSlug: string;
    tenantName: string;
    plan: string;
  }
}
