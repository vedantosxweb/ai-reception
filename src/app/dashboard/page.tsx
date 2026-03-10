import { redirect } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { PLAN_CONFIG } from '@/lib/config/env';
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

  if (!email) {
    redirect('/');
  }

  // Look up or auto-create local user
  let dbUser = await db.user.findFirst({
    where: { email },
    include: {
      tenant: { select: { id: true, name: true, slug: true, plan: true } },
    },
  });

  // Auto-provision if not in DB yet
  if (!dbUser || !dbUser.tenant) {
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || 'User';
    const planConfig = PLAN_CONFIG['STARTER'];
    const companyName = name + "'s Company";
    const baseSlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let slug = baseSlug.slice(0, 50) || 'company';
    let counter = 0;
    while (await db.tenant.findUnique({ where: { slug } })) {
      counter++;
      slug = `${baseSlug.slice(0, 46)}-${counter}`;
    }

    const result = await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: companyName,
          slug,
          plan: 'STARTER',
          status: 'TRIAL',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          monthlyMinutes: planConfig.monthlyMinutes,
          maxReceptionists: planConfig.maxReceptionists,
          maxPhoneNumbers: planConfig.maxPhoneNumbers,
          maxKnowledgeSources: planConfig.maxKnowledgeSources,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          name,
          passwordHash: '',
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });

      await tx.businessHour.createMany({
        data: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
          tenantId: tenant.id,
          dayOfWeek: day,
          openTime: '09:00',
          closeTime: '17:00',
          isOpen: day >= 1 && day <= 5,
        })),
      });

      return { tenant, user };
    });

    dbUser = {
      ...result.user,
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
        plan: result.tenant.plan,
      },
    };
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
          tenantId: dbUser.tenant!.id,
          tenantName: dbUser.tenant!.name,
          tenantSlug: dbUser.tenant!.slug,
          plan: dbUser.tenant!.plan,
        }}
      />
    </Suspense>
  );
}
