'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Clock, CheckCircle2, XCircle, Bot, MessageSquare, User, LogOut, Headphones } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import AIChat from '@/components/ai-chat'

interface AuthUser {
  id: string; email: string; name: string; role: string; businessName?: string
}

interface Appointment {
  id: string; title: string; startTime: string; endTime: string
  status: string; source: string; service?: { name: string }
}

export default function UserPortal({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loadingApts, setLoadingApts] = useState(true)

  useEffect(() => {
    const email = user.email
    fetch(`/api/appointments/my?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => { setAppointments(d.appointments || []); setLoadingApts(false) })
      .catch(() => setLoadingApts(false))
  }, [user.email])

  const upcoming = appointments.filter(a => new Date(a.startTime) >= new Date() && a.status !== 'cancelled')
  const past = appointments.filter(a => new Date(a.startTime) < new Date() || a.status === 'cancelled')

  const statusColor: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-700',
    confirmed: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-slate-100 text-slate-700',
    cancelled: 'bg-red-100 text-red-700',
    'no-show': 'bg-orange-100 text-orange-700',
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <Headphones className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-white text-sm leading-none">AI Receptionist</p>
              <p className="text-xs text-slate-400 mt-0.5">Welcome back, {user.name.split(' ')[0]}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs text-slate-600 dark:text-slate-400">{user.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={onLogout} className="text-slate-500 hover:text-red-500 gap-2">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <Tabs defaultValue="chat">
          <TabsList className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mb-6 w-full sm:w-auto">
            <TabsTrigger value="chat" className="gap-2 flex-1 sm:flex-none">
              <Bot className="w-4 h-4" /> Book Appointment
            </TabsTrigger>
            <TabsTrigger value="bookings" className="gap-2 flex-1 sm:flex-none">
              <Calendar className="w-4 h-4" /> My Bookings
              {upcoming.length > 0 && (
                <Badge className="ml-1 bg-emerald-500 text-white text-xs px-1.5 py-0">{upcoming.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat">
            <div className="h-[calc(100vh-14rem)]">
              <AIChat />
            </div>
          </TabsContent>

          <TabsContent value="bookings">
            <div className="space-y-6">
              {/* Upcoming */}
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-emerald-500" /> Upcoming Appointments
                </h2>
                {loadingApts ? (
                  <div className="space-y-3">
                    {[1,2].map(i => <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
                  </div>
                ) : upcoming.length === 0 ? (
                  <Card className="border-0 shadow-sm">
                    <CardContent className="py-12 text-center">
                      <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 dark:text-slate-400">No upcoming appointments</p>
                      <p className="text-sm text-slate-400 mt-1">Use the chat to book one!</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {upcoming.map((apt, i) => (
                      <motion.div key={apt.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                          <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex flex-col items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 leading-none">
                                {new Date(apt.startTime).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                              </span>
                              <span className="text-lg font-black text-emerald-700 dark:text-emerald-400 leading-none">
                                {new Date(apt.startTime).getDate()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-white truncate">{apt.service?.name || apt.title}</p>
                              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                {new Date(apt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {' — '}
                                {new Date(apt.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <Badge className={`${statusColor[apt.status] || 'bg-slate-100 text-slate-700'} text-xs capitalize`}>
                              {apt.status}
                            </Badge>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Past */}
              {past.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-slate-400" /> Past Appointments
                  </h2>
                  <div className="space-y-3">
                    {past.slice(0, 5).map((apt, i) => (
                      <Card key={apt.id} className="border-0 shadow-sm opacity-70">
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-slate-500 leading-none">
                              {new Date(apt.startTime).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                            </span>
                            <span className="text-lg font-black text-slate-500 leading-none">
                              {new Date(apt.startTime).getDate()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-700 dark:text-slate-300 truncate">{apt.service?.name || apt.title}</p>
                            <p className="text-sm text-slate-400 mt-0.5">
                              {new Date(apt.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                          <Badge className={`${statusColor[apt.status] || 'bg-slate-100 text-slate-700'} text-xs capitalize`}>
                            {apt.status}
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
