'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Clock, Activity,
  PhoneCall, PhoneMissed, PhoneIncoming, PhoneOutgoing, RefreshCw, Search
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface CallLog {
  id: string; phoneNumber: string; direction: string; status: string
  duration: number | null; transcript: string | null; summary: string | null
  sentiment: string | null; intent: string | null; resolved: boolean; createdAt: string
}

const sentimentColor: Record<string, string> = {
  positive: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30',
  neutral: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30',
  negative: 'text-red-600 bg-red-50 dark:bg-red-900/30',
}

function fmt(s: number) { return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}` }

export default function VoicePanel() {
  const [isCallActive, setIsCallActive] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [callDuration, setCallDuration] = useState(0)
  const [dialNumber, setDialNumber] = useState('')
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stats, setStats] = useState({ answered: 0, missed: 0, total: 0, avgDuration: 0 })
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const fetchCallLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/analytics?period=7d')
      const data = await res.json()
      setCallLogs(data.recentCalls || [])
      const calls = data.recentCalls || []
      setStats({
        answered: calls.filter((c: CallLog) => c.status === 'answered').length,
        missed: calls.filter((c: CallLog) => c.status === 'missed').length,
        total: calls.length,
        avgDuration: Math.round(calls.reduce((a: number, c: CallLog) => a + (c.duration || 0), 0) / (calls.length || 1)),
      })
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchCallLogs() }, [fetchCallLogs])

  useEffect(() => {
    if (!isCallActive) return
    timerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isCallActive])

  const startCall = async () => {
    if (!dialNumber) return
    try {
      const res = await fetch('/api/calls', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ to: dialNumber }) })
      if (res.ok) { setIsCallActive(true); setCallDuration(0) }
    } catch (e) { console.error('Call failed:', e) }
  }

  const endCall = () => { setIsCallActive(false); setCallDuration(0); if (timerRef.current) clearInterval(timerRef.current) }

  const filtered = callLogs.filter(c => c.phoneNumber.includes(search) || (c.intent || '').toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Voice</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">AI-powered phone receptionist & call logs</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCallLogs} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Calls', value: stats.total, icon: Phone, color: 'from-blue-500 to-indigo-500' },
          { label: 'Answered', value: stats.answered, icon: PhoneCall, color: 'from-emerald-500 to-teal-500' },
          { label: 'Missed', value: stats.missed, icon: PhoneMissed, color: 'from-red-500 to-orange-500' },
          { label: 'Avg Duration', value: stats.avgDuration > 0 ? fmt(stats.avgDuration) : '0:00', icon: Clock, color: 'from-purple-500 to-pink-500' },
        ].map((s, i) => {
          const Icon = s.icon
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${s.color}`}><Icon className="w-5 h-5 text-white" /></div>
                  <div>
                    <p className="text-xs text-slate-500">{s.label}</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{loading ? '—' : s.value}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dialer */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Outbound Call</CardTitle>
            <CardDescription>Make a call via Twilio</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isCallActive ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                  <Phone className="w-8 h-8 text-emerald-500 animate-pulse" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{dialNumber}</p>
                  <p className="text-2xl font-mono font-bold text-emerald-500 mt-1">{fmt(callDuration)}</p>
                </div>
                <div className="flex justify-center gap-3">
                  <Button variant="outline" size="icon" onClick={() => setIsMuted(!isMuted)} className={isMuted ? 'bg-red-50 border-red-200' : ''}>
                    {isMuted ? <MicOff className="w-4 h-4 text-red-500" /> : <Mic className="w-4 h-4" />}
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setIsSpeakerOn(!isSpeakerOn)}>
                    {isSpeakerOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </Button>
                  <Button onClick={endCall} className="bg-red-500 hover:bg-red-600 text-white w-12 h-10 rounded-full">
                    <PhoneOff className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input placeholder="+1 555 000 0000" className="pl-10" value={dialNumber} onChange={e => setDialNumber(e.target.value)} />
                </div>
                <Button onClick={startCall} disabled={!dialNumber} className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600">
                  <PhoneCall className="w-4 h-4 mr-2" /> Call
                </Button>
                <div className="text-xs text-slate-400 text-center pt-2 border-t border-slate-100 dark:border-slate-800">
                  Calls are AI-handled · Recorded & transcribed
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Call Logs */}
        <Card className="lg:col-span-2 border-0 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Call Logs</CardTitle>
                <CardDescription>All inbound & outbound calls</CardDescription>
              </div>
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Search calls..." className="pl-10 h-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              {loading ? (
                <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <Phone className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No calls yet</p>
                  <p className="text-xs mt-1 max-w-xs mx-auto">Once you configure your Twilio number in Settings, all calls will be logged here automatically</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((call, i) => (
                    <motion.div key={call.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <div className={cn('p-2 rounded-lg', call.status === 'answered' ? 'bg-emerald-100 dark:bg-emerald-900/50' : call.status === 'missed' ? 'bg-red-100 dark:bg-red-900/50' : 'bg-slate-100 dark:bg-slate-800')}>
                        {call.direction === 'inbound' ? (
                          <PhoneIncoming className={cn('w-4 h-4', call.status === 'answered' ? 'text-emerald-600' : 'text-red-500')} />
                        ) : (
                          <PhoneOutgoing className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{call.phoneNumber}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-slate-500">{call.direction}</span>
                          {call.duration && <span className="text-xs text-slate-400">· {fmt(call.duration)}</span>}
                          {call.intent && <Badge variant="outline" className="text-xs px-1 py-0">{call.intent}</Badge>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 space-y-1">
                        <p className="text-xs text-slate-400">{new Date(call.createdAt).toLocaleDateString()}</p>
                        <Badge className={cn('text-xs', call.status === 'answered' ? 'bg-emerald-100 text-emerald-700' : call.status === 'missed' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600')}>
                          {call.status}
                        </Badge>
                        {call.sentiment && <Badge className={cn('text-xs block', sentimentColor[call.sentiment])}>{call.sentiment}</Badge>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
