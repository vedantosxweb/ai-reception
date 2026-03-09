'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  CreditCard, Loader2, Check, Zap, AlertTriangle, XCircle, Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface BillingData {
  plan: string;
  planConfig: { name: string; priceMonthly: number; features: string[]; monthlyMinutes: number };
  usage: {
    totalMinutes: number;
    includedMinutes: number;
    overageMinutes: number;
    overageCost: number;
    totalCalls: number;
    smsSent: number;
    periodStart: string;
    periodEnd: string;
  } | null;
  hasSubscription: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  allPlans: Array<{
    id: string;
    name: string;
    priceMonthly: number;
    features: string[];
    current: boolean;
    monthlyMinutes: number;
  }>;
}

export default function BillingPanel({ plan }: { plan: string }) {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradingPlanId, setUpgradingPlanId] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();

  // Show success toast after returning from checkout
  useEffect(() => {
    if (searchParams.get('billing') === 'success') {
      toast.success('Payment successful! Your plan has been updated.');
      // Clean the URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('billing');
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [searchParams, router]);

  const fetchData = () => {
    setLoading(true);
    fetch('/api/v1/billing')
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setData(res.data);
        else toast.error(res.error || 'Failed to load billing info.');
      })
      .catch(() => toast.error('Network error loading billing info.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [plan]);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/v1/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: window.location.href }),
      });
      const d = await res.json();
      if (d.success && d.data?.url) {
        window.location.href = d.data.url;
        return;
      }
      toast.error(
        d.error ||
          (res.status === 503
            ? 'Billing portal is not configured. Please contact support.'
            : 'Unable to open billing portal.')
      );
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setPortalLoading(false);
    }
  };

  const handlePlanAction = async (targetPlan: { id: string; name: string }) => {
    if (!data) return;
    setUpgradingPlanId(targetPlan.id);
    try {
      // Use 'subscribe' for brand-new subscriptions, 'change_plan' when one exists
      const action = data.hasSubscription ? 'change_plan' : 'subscribe';
      const res = await fetch('/api/v1/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, plan: targetPlan.id }),
      });
      const d = await res.json();
      if (d.success && d.data?.checkoutUrl) {
        window.location.href = d.data.checkoutUrl;
        return;
      }
      toast.error(
        d.error ||
          (res.status === 503
            ? 'Billing is not configured. Add CREEM_API_KEY and Creem product IDs to your environment.'
            : 'Unable to start checkout. Please try again.')
      );
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setUpgradingPlanId(null);
    }
  };

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    try {
      const res = await fetch('/api/v1/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const d = await res.json();
      if (d.success) {
        toast.success(d.message || 'Subscription will cancel at end of period.');
        fetchData();
      } else {
        toast.error(d.error || 'Failed to cancel subscription.');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setCancelLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-500">
        <AlertTriangle className="w-8 h-8 text-orange-400" />
        <p>Failed to load billing info.</p>
        <Button variant="outline" size="sm" onClick={fetchData}>Retry</Button>
      </div>
    );
  }

  const usagePercent = data.usage
    ? Math.min(100, (data.usage.totalMinutes / Math.max(1, data.usage.includedMinutes)) * 100)
    : 0;

  const planOrder = data.allPlans.map((p) => p.id);
  const currentPlanIdx = planOrder.indexOf(data.plan);

  const periodEndFormatted = data.currentPeriodEnd
    ? new Date(data.currentPeriodEnd).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Billing & Plans</h1>
          <p className="text-slate-500 mt-1">Manage your subscription and usage</p>
        </div>
        <Button
          onClick={openPortal}
          variant="outline"
          disabled={portalLoading || !data.hasSubscription}
          title={!data.hasSubscription ? 'Subscribe to a plan to access billing portal' : undefined}
        >
          {portalLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <CreditCard className="w-4 h-4 mr-2" />
          )}
          Manage Billing
        </Button>
      </div>

      {/* Scheduled cancellation banner */}
      {data.cancelAtPeriodEnd && periodEndFormatted && (
        <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
            <p className="text-sm text-orange-800 dark:text-orange-300">
              Your subscription is scheduled to cancel on <strong>{periodEndFormatted}</strong>. After that, your account will revert to the free tier.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Usage */}
      {data.usage && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Current Usage</CardTitle>
            <CardDescription>
              Billing period:{' '}
              {new Date(data.usage.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' – '}
              {new Date(data.usage.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600 dark:text-slate-400">
                  Minutes: <strong>{data.usage.totalMinutes}</strong> / {data.usage.includedMinutes}
                </span>
                <span className={usagePercent > 80 ? 'text-orange-500 font-semibold' : 'text-slate-500'}>
                  {Math.round(usagePercent)}%
                </span>
              </div>
              <Progress
                value={usagePercent}
                className={cn('h-2', usagePercent > 90 && '[&>div]:bg-red-500')}
              />
              {usagePercent > 80 && (
                <p className="text-xs text-orange-500 mt-1">
                  ⚠ You&apos;re approaching your limit. Upgrade to avoid overage charges.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                <p className="text-2xl font-bold">{data.usage.totalCalls}</p>
                <p className="text-xs text-slate-500 mt-1">Total Calls</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                <p className="text-2xl font-bold">{data.usage.smsSent}</p>
                <p className="text-xs text-slate-500 mt-1">SMS Sent</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                <p className="text-2xl font-bold">{data.usage.overageMinutes}</p>
                <p className="text-xs text-slate-500 mt-1">Overage Min</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                <p className={cn('text-2xl font-bold', data.usage.overageCost > 0 && 'text-orange-500')}>
                  ${(data.usage.overageCost / 100).toFixed(2)}
                </p>
                <p className="text-xs text-slate-500 mt-1">Overage Cost</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.allPlans.map((p) => {
            const targetIdx = planOrder.indexOf(p.id);
            const isUpgrade = targetIdx > currentPlanIdx;
            const isDowngrade = targetIdx < currentPlanIdx;

            return (
              <Card
                key={p.id}
                className={cn(
                  'border-0 shadow-lg relative',
                  p.current && 'ring-2 ring-emerald-500',
                  p.id === 'PRO' && !p.current && 'ring-1 ring-purple-200 dark:ring-purple-800'
                )}
              >
                {p.current && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-emerald-500 text-white">Current Plan</Badge>
                  </div>
                )}
                {p.id === 'PRO' && !p.current && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-purple-500 text-white">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl">{p.name}</CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">${(p.priceMonthly / 100).toFixed(0)}</span>
                    <span className="text-slate-500 text-sm">/mo</span>
                  </div>
                  <p className="text-sm text-slate-500">{p.monthlyMinutes.toLocaleString()} minutes/mo</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-4">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {!p.current ? (
                    <Button
                      className={cn(
                        'w-full',
                        isUpgrade
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white'
                          : ''
                      )}
                      variant={isDowngrade ? 'outline' : 'default'}
                      disabled={!!upgradingPlanId}
                      onClick={() => handlePlanAction(p)}
                    >
                      {upgradingPlanId === p.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Zap className="w-4 h-4 mr-2" />
                      )}
                      {isUpgrade ? 'Upgrade' : 'Downgrade'}
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2 py-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                        <Check className="w-4 h-4" /> Active Plan
                      </div>
                      {data.hasSubscription && !data.cancelAtPeriodEnd && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              disabled={cancelLoading}
                            >
                              {cancelLoading ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <XCircle className="w-3 h-3 mr-1" />
                              )}
                              Cancel Plan
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Your plan will remain active until the end of your current billing period
                                {periodEndFormatted ? ` (${periodEndFormatted})` : ''}. After that, you&apos;ll
                                lose access to premium features.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep Plan</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={handleCancelSubscription}
                              >
                                Yes, Cancel
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      {data.cancelAtPeriodEnd && periodEndFormatted && (
                        <p className="text-xs text-orange-500 text-center flex items-center gap-1 justify-center">
                          <Calendar className="w-3 h-3" /> Cancels {periodEndFormatted}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Billing info note */}
      <p className="text-xs text-slate-400 dark:text-slate-600">
        Payments are processed securely by Creem. Overage is billed at the end of each period.
        Upgrade takes effect immediately; downgrade applies at the next billing cycle.
      </p>
    </div>
  );
}
