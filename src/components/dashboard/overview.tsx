'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Phone, Bot, Clock, TrendingUp, Loader2, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, LineChart, Line } from 'recharts';

interface AnalyticsData {
  summary: {
    totalCalls: number;
    completedCalls: number;
    inboundCalls: number;
    outboundCalls: number;
    totalTransfers: number;
    totalSMS: number;
    appointmentsBooked: number;
    leadsCaptured: number;
    revenueGenerated: number;
    revenueCurrency?: string;
    missedCallsRecovered: number;
    highValueLeads: number;
    avgCallDuration: number;
    transferRate: number;
    resolutionRate: number;
    activeReceptionists: number;
    activePhoneNumbers: number;
  };
  callVolume: Array<{ date: string; inbound: number; outbound: number }>;
  topIntents: Array<{ intent: string; count: number; percentage: number }>;
  recentCalls: Array<{
    id: string;
    callerNumber: string;
    contactName: string | null;
    direction: string;
    status: string;
    duration: number | null;
    sentiment: string | null;
    intent: string | null;
    startedAt: string;
  }>;
  usage: {
    totalMinutes: number;
    includedMinutes: number;
    overageMinutes: number;
    totalCalls: number;
  } | null;
}

function formatMoney(value: number, currency?: string): string {
  const code = (currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0,
    }).format(value || 0);
  } catch {
    return `$${(value || 0).toLocaleString()}`;
  }
}

export default function OverviewPanel({ tenantId }: { tenantId: string }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/analytics?period=7d')
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setData(res.data);
        else toast.error('Failed to load dashboard data.');
      })
      .catch(() => toast.error('Network error loading dashboard.'))
      .finally(() => setLoading(false));
  }, [tenantId]);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading dashboard...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <Bot className="w-12 h-12 mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Welcome to your dashboard</h3>
        <p className="text-slate-500 mt-2">Set up your first AI Receptionist to start receiving calls.</p>
      </div>
    );
  }

  const cards = [
    { title: 'Total Calls', value: data.summary.totalCalls, icon: Phone, color: 'from-blue-500 to-indigo-500' },
    {
      title: 'Revenue Generated',
      value: formatMoney(data.summary.revenueGenerated || 0, data.summary.revenueCurrency),
      icon: TrendingUp,
      color: 'from-emerald-500 to-teal-500',
    },
    { title: 'Appointments Booked', value: data.summary.appointmentsBooked, icon: Bot, color: 'from-cyan-500 to-blue-500' },
    { title: 'Missed Calls Recovered', value: data.summary.missedCallsRecovered, icon: Clock, color: 'from-orange-500 to-amber-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-slate-500 mt-1">Last 7 days overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div key={card.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="relative overflow-hidden border-0 shadow-lg">
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${card.color}`} />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-slate-500">{card.title}</p>
                      <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">{card.value}</p>
                    </div>
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${card.color}`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Call Volume</CardTitle>
            <CardDescription>Inbound vs outbound calls</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.callVolume}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="inbound" fill="#10b981" radius={[4, 4, 0, 0]} name="Inbound" />
                  <Bar dataKey="outbound" fill="#6366f1" radius={[4, 4, 0, 0]} name="Outbound" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Recent Calls</CardTitle>
            <CardDescription>Latest call activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {data.recentCalls.length === 0 && (
                <p className="text-sm text-slate-500 py-4 text-center">No calls yet</p>
              )}
              {data.recentCalls.slice(0, 10).map((call) => (
                <div key={call.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {call.contactName || call.callerNumber}
                    </p>
                    <p className="text-xs text-slate-500">
                      {call.intent || 'general'} &middot; {call.duration ? `${Math.floor(call.duration / 60)}:${String(call.duration % 60).padStart(2, '0')}` : 'N/A'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {call.sentiment && (
                      <Badge variant="outline" className={
                        call.sentiment === 'POSITIVE' ? 'text-emerald-600' :
                        call.sentiment === 'NEGATIVE' ? 'text-red-600' : 'text-slate-600'
                      }>{call.sentiment.toLowerCase()}</Badge>
                    )}
                    <Badge variant="outline">{call.direction.toLowerCase()}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {data.usage && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Usage This Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-slate-500">Minutes Used</p>
                <p className="text-2xl font-bold">{data.usage.totalMinutes}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Included</p>
                <p className="text-2xl font-bold">{data.usage.includedMinutes}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Overage</p>
                <p className="text-2xl font-bold text-orange-500">{data.usage.overageMinutes}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Calls</p>
                <p className="text-2xl font-bold">{data.usage.totalCalls}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
