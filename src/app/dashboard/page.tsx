import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { Suspense } from 'react';
import { authOptions } from '@/lib/auth';
import DashboardShell from '@/components/dashboard/shell';
import { Loader2 } from 'lucide-react';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/login');
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
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          role: session.user.role,
          tenantId: session.user.tenantId,
          tenantName: session.user.tenantName,
          tenantSlug: session.user.tenantSlug,
          plan: session.user.plan,
        }}
      />
    </Suspense>
  );
}

