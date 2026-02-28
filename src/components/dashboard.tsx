'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users, Phone, MessageCircle, Calendar,
  TrendingUp, Clock, Activity, ArrowUpRight,
  ArrowDownRight, Sparkles, Brain, HeadphonesIcon,
  RefreshCw
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, BarChart, Bar
} from 'recharts'

interface Analytics {
  summary: {
    totalContacts: number; newContacts: number; totalAppointments: number
    newAppointments: number; completedAppointments: number; inboundCalls: number
    outboundCalls: number; missedCalls: number; avgCallDuration: number
    whatsappMessages: number; conversations: number; resolvedConversations: number
  }
  sentiment: { positive: number; negative: number; neutral: number }
  leadDistribution: { lead: number; prospect: number; customer: number }
  hourlyDistribution: Record<string, number>
  metrics: { responseRate: string; conversionRate: string | number; satisfactionRate: number }
  recentCalls: Array<{ id: string; phoneNumber: string; direction: string; status: string; duration: number | null; sentiment: string | null; intent: string | null; createdAt: string }>
}

export default function Dashboard() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('7d')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics?period=${period}`)
      const json = await res.json()
      setData(json)
      setLastUpdated(new Date())
    } catch (e) {
      console.error('Analytics fetch failed', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAnalytics() }, [period])

  const hourlyData = data ? Object.entries(data.hourlyDistribution)
    .filter((_, i) => i >= 8 && i <= 18)
    .map(([hour, count]) => ({
      time: `${hour.padStart(2,'0')}:00`,
      calls: count,
    })) : []

  const weeklyData = data ? [
    { name: 'Contacts', value: data.summary.newContacts, icon: Users, color: 'from-blue-500 to-indigo-500', change: data.summary.newContacts },
    { name: "Today's Calls", value: data.summary.inboundCalls + data.summary.outboundCalls, icon: Phone, color: 'from-emerald-500 to-teal-500', change: data.summary.inboundCalls },
    { name: 'Messages', value: data.summary.conversations, icon: MessageCircle, color: 'from-purple-500 to-pink-500', change: data.summary.whatsappMessages },
    { name: 'Appointments', value: data.summary.newAppointments, icon: Calendar, color: 'from-orange-500 to-red-500', change: data.summary.completedAppointments },
  ] : []

  const leadChartData = data ? [
    { name: 'Leads', value: data.leadDistribution.lead, fill: '#f59e0b' },
    { name: 'Prospects', value: data.leadDistribution.prospect, fill: '#8b5cf6' },
    { name: 'Customers', value: data.leadDistribution.customer, fill: '#10b981' },
  ] : []

  const sentimentTotal = data ? (data.sentiment.positive + data.sentiment.negative + data.sentiment.neutral) || 1 : 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : 'Loading live data...'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {(['1d','7d','30d'] as const).map(p => (
            <Button key={p} variant={period === p ? 'default' : 'outline'} size="sm"
              onClick={() => setPeriod(p)}
              className={period === p ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
              {p === '1d' ? 'Today' : p === '7d' ? '7 Days' : '30 Days'}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={fetchAnalytics} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Badge variant="outline" className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800">
            <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse" />
            <span className="text-emerald-700 dark:text-emerald-400">System Online</span>
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? Array(4).fill(0).map((_, i) => (
          <Card key={i} className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-3 w-1/2" />
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2 w-2/3" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-1/3" />
            </CardContent>
          </Card>
        )) : weeklyData.map((stat, index) => {
          const Icon = stat.icon
          return (
            <motion.div key={stat.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
              <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${stat.color}`} />
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.name}</p>
                      <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">{stat.value}</p>
                      <p className="text-xs text-slate-400 mt-1">last {period === '1d' ? '24h' : period}</p>
                    </div>
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color}`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Calls */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Call Activity Today</CardTitle>
            <CardDescription>Inbound calls by hour</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyData}>
                  <defs>
                    <linearGradient id="callGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: 'none', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="calls" stroke="#10b981" fillOpacity={1} fill="url(#callGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {!loading && data && (
              <p className="text-xs text-slate-400 mt-3 text-center">
                {data.summary.inboundCalls} inbound · {data.summary.outboundCalls} outbound · {data.summary.missedCalls} missed
              </p>
            )}
          </CardContent>
        </Card>

        {/* Lead Distribution */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Lead Pipeline</CardTitle>
            <CardDescription>Customer journey breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: 'none', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {leadChartData.map((entry, index) => (
                      <rect key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Performance */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Brain className="w-5 h-5 text-emerald-500" /> AI Performance
            </CardTitle>
            <CardDescription>Real-time metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Response Rate', value: loading ? '—' : `${data?.metrics.responseRate}%`, icon: Clock, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/50' },
              { label: 'Satisfaction', value: loading ? '—' : `${data ? Math.round(data.metrics.satisfactionRate) : 0}%`, icon: Sparkles, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/50' },
              { label: 'Conversations', value: loading ? '—' : String(data?.summary.conversations || 0), icon: Activity, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/50' },
              { label: 'Resolved', value: loading ? '—' : String(data?.summary.resolvedConversations || 0), icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/50' },
            ].map(m => {
              const Icon = m.icon
              return (
                <div key={m.label} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${m.color}`} />
                    <span className="text-sm font-medium">{m.label}</span>
                  </div>
                  <Badge className={`${m.bg} ${m.color} border-0`}>{m.value}</Badge>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Recent Calls */}
        <Card className="lg:col-span-2 border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Recent Calls</CardTitle>
            <CardDescription>Latest call logs from the system</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
              </div>
            ) : (data?.recentCalls?.length || 0) === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Phone className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No calls recorded yet</p>
                <p className="text-xs mt-1">Calls will appear here once Twilio is set up</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {data!.recentCalls.map((call, i) => (
                  <motion.div key={call.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <div className={`p-2 rounded-lg ${call.status === 'answered' ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-red-100 dark:bg-red-900/50'}`}>
                      <Phone className={`w-4 h-4 ${call.status === 'answered' ? 'text-emerald-600' : 'text-red-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{call.phoneNumber}</p>
                      <p className="text-xs text-slate-500">{call.direction} · {call.duration ? `${Math.floor(call.duration/60)}m ${call.duration%60}s` : 'No answer'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-slate-400">{new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      <Badge variant="outline" className={`text-xs mt-0.5 ${call.status === 'answered' ? 'text-emerald-600 border-emerald-200' : 'text-red-500 border-red-200'}`}>
                        {call.status}
                      </Badge>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
