import { redirect } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { Suspense } from 'react';
import DashboardShell from '@/components/dashboard/shell';
import { Loader2 } from 'lucide-react';

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/');
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress;

  // Look up local user in DB
  const dbUser = email
    ? await db.user.findFirst({
        where: { email },
        include: {
          tenant: { select: { id: true, name: true, slug: true, plan: true } },
        },
      })
    : null;

  if (!dbUser || !dbUser.tenant) {
    // User exists in Clerk but not in local DB yet — redirect to onboarding
    redirect('/onboarding');
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
      }
    >
      <DashboardShell
        user={{
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          role: dbUser.role,
          tenantId: dbUser.tenant.id,
          tenantName: dbUser.tenant.name,
          tenantSlug: dbUser.tenant.slug,
          plan: dbUser.tenant.plan,
        }}
      />
    </Suspense>
  );
}
