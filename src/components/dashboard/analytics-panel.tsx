'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Loader2, TrendingUp, Clock, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area,
} from 'recharts';

const DAYS_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS_LABELS = Array.from({ length: 24 }, (_, i) => `${i}:00`);

export default function AnalyticsPanel() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7d');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/analytics?period=${period}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setData(res.data); })
      .catch(() => { console.error('Data load error in analytics-panel.tsx'); })
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (!data) return null;

  const summary = data.summary as {
    totalCalls: number;
    completedCalls: number;
    appointmentsBooked: number;
    leadsCaptured: number;
    revenueGenerated: number;
    revenueCurrency?: string;
    missedCallsRecovered: number;
    highValueLeads: number;
    totalTransfers: number;
    totalSMS: number;
    inboundCalls: number;
    outboundCalls: number;
    resolutionRate: number;
    transferRate: number;
  };
  const topIntents = (data.topIntents as Array<{ intent: string; count: number; percentage: number }>) || [];
  const callVolume = (data.callVolume as Array<{ date: string; inbound: number; outbound: number }>) || [];
  const sentimentBreakdown = data.sentimentBreakdown as Record<string, number> || {};
  const revenueDisplay = (() => {
    const code = (summary.revenueCurrency || 'USD').toUpperCase();
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: code,
        maximumFractionDigits: 0,
      }).format(summary.revenueGenerated || 0);
    } catch {
      return `$${(summary.revenueGenerated || 0).toLocaleString()}`;
    }
  })();

  // New advanced analytics
  const sentimentTrend = (data.sentimentTrend as Array<{ date: string; POSITIVE: number; NEUTRAL: number; NEGATIVE: number }>) || [];
  const peakHours = (data.peakHours as Array<{ dayOfWeek: number; hour: number; count: number }>) || [];
  const conversions = data.conversions as { totalAppointments: number; bookingRate: number; resolutionTrend: Array<{ date: string; rate: number; completed: number; total: number }> } | null;

  const sentimentData = Object.entries(sentimentBreakdown).map(([key, value]) => ({ name: key, value }));
  const COLORS = { POSITIVE: '#10b981', NEUTRAL: '#94a3b8', NEGATIVE: '#ef4444' };

  // Build heatmap grid data
  const maxHeatVal = Math.max(...peakHours.map((p) => p.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Analytics</h1>
          <p className="text-slate-500 mt-1">Detailed call and performance metrics</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 Days</SelectItem>
            <SelectItem value="30d">30 Days</SelectItem>
            <SelectItem value="90d">90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Calls', value: summary.totalCalls },
          { label: 'Completed', value: summary.completedCalls },
          { label: 'Appointments Booked', value: summary.appointmentsBooked },
          { label: 'Leads Captured', value: summary.leadsCaptured },
          { label: 'Revenue Generated', value: revenueDisplay },
          { label: 'Missed Calls Recovered', value: summary.missedCallsRecovered },
          { label: 'High-Value Leads', value: summary.highValueLeads },
          { label: 'Transfers', value: summary.totalTransfers },
          { label: 'SMS Sent', value: summary.totalSMS },
          { label: 'Inbound', value: summary.inboundCalls },
          { label: 'Outbound', value: summary.outboundCalls },
          { label: 'Resolution', value: `${summary.resolutionRate}%` },
          { label: 'Transfer Rate', value: `${summary.transferRate}%` },
        ].map((m) => (
          <Card key={m.label} className="border-0 shadow-md">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">{m.label}</p>
              <p className="text-2xl font-bold mt-1">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Call Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={callVolume}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="inbound" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outbound" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Sentiment Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 flex items-center justify-center">
              {sentimentData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sentimentData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {sentimentData.map((entry) => (
                        <Cell key={entry.name} fill={COLORS[entry.name as keyof typeof COLORS] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-slate-500">No sentiment data yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sentiment Trend Over Time */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Sentiment Trend</CardTitle>
          <CardDescription>How caller sentiment changes over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            {sentimentTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sentimentTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="POSITIVE" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="NEUTRAL" stackId="1" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.4} />
                  <Area type="monotone" dataKey="NEGATIVE" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center"><p className="text-slate-500">No sentiment trend data yet</p></div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Peak Hours Heatmap */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" /> Peak Hours Heatmap</CardTitle>
          <CardDescription>Call volume by day of week and hour</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              {/* Header row: hours */}
              <div className="flex gap-0.5 mb-1">
                <div className="w-12 flex-shrink-0" />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="flex-1 text-center text-[10px] text-slate-400">{h}</div>
                ))}
              </div>
              {/* Rows: days */}
              {DAYS_LABELS.map((day, dow) => (
                <div key={day} className="flex gap-0.5 mb-0.5">
                  <div className="w-12 flex-shrink-0 text-xs text-slate-500 flex items-center">{day}</div>
                  {Array.from({ length: 24 }, (_, h) => {
                    const entry = peakHours.find((p) => p.dayOfWeek === dow && p.hour === h);
                    const count = entry?.count || 0;
                    const intensity = maxHeatVal > 0 ? count / maxHeatVal : 0;
                    return (
                      <div
                        key={h}
                        className="flex-1 aspect-square rounded-sm cursor-default"
                        style={{
                          backgroundColor: count === 0
                            ? 'rgb(241 245 249)'
                            : `rgba(16, 185, 129, ${0.15 + intensity * 0.85})`,
                        }}
                        title={`${day} ${h}:00 — ${count} call${count !== 1 ? 's' : ''}`}
                      />
                    );
                  })}
                </div>
              ))}
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                <span>Less</span>
                {[0, 0.25, 0.5, 0.75, 1].map((i) => (
                  <div key={i} className="w-4 h-4 rounded-sm" style={{ backgroundColor: i === 0 ? 'rgb(241 245 249)' : `rgba(16, 185, 129, ${0.15 + i * 0.85})` }} />
                ))}
                <span>More</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conversion & Resolution Tracking */}
      {conversions && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Target className="w-5 h-5" /> Booking Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6">
                <p className="text-5xl font-bold text-emerald-600">{conversions.bookingRate}%</p>
                <p className="text-slate-500 mt-2">of calls led to a booking</p>
                <p className="text-sm text-slate-400 mt-1">{conversions.totalAppointments} appointment{conversions.totalAppointments !== 1 ? 's' : ''} booked</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg lg:col-span-2">
            <CardHeader>
              <CardTitle>Resolution Rate Trend</CardTitle>
              <CardDescription>Percentage of calls resolved without escalation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                {conversions.resolutionTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={conversions.resolutionTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" fontSize={11} />
                      <YAxis domain={[0, 100]} fontSize={12} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(value: number) => [`${value}%`, 'Resolution Rate']} />
                      <Line type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center"><p className="text-slate-500">No resolution data yet</p></div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Top Intents</CardTitle>
          <CardDescription>Most common caller intents</CardDescription>
        </CardHeader>
        <CardContent>
          {topIntents.length === 0 ? (
            <p className="text-slate-500 text-sm">No intent data yet</p>
          ) : (
            <div className="space-y-3">
              {topIntents.map((intent) => (
                <div key={intent.intent} className="flex items-center gap-4">
                  <Badge variant="outline" className="w-32 justify-center">{intent.intent}</Badge>
                  <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 h-3 rounded-full"
                      style={{ width: `${intent.percentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-16 text-right">{intent.count} ({intent.percentage}%)</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
