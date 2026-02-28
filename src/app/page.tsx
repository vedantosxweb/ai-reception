'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard, MessageSquare, Users, Phone, MessageCircle,
  Settings, Brain, Menu, X, Headphones, Sun, Moon, ChevronLeft,
  LogOut, User, Building2, Bell
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import Dashboard from '@/components/dashboard'
import AIChat from '@/components/ai-chat'
import CRM from '@/components/crm'
import VoicePanel from '@/components/voice-panel'
import WhatsAppPanel from '@/components/whatsapp-panel'
import SettingsPanel from '@/components/settings-panel'
import UserPortal from '@/components/user-portal'
import { useRouter } from 'next/navigation'

interface AuthUser {
  id: string; email: string; name: string; role: string; businessName?: string | null
}

const hostNavItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'chat', label: 'AI Receptionist', icon: Brain },
  { id: 'crm', label: 'CRM', icon: Users },
  { id: 'voice', label: 'Voice', icon: Phone },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { setUser(d.user); setAuthLoading(false) })
      .catch(() => { router.push('/auth'); setAuthLoading(false) })
  }, [router])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/auth')
    router.refresh()
  }

  const handleTabChange = (tab: string) => { setActiveTab(tab); setMobileMenuOpen(false) }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Headphones className="w-7 h-7 text-white" />
          </div>
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  // ─── User (customer) view ─────────────────────────────
  if (user.role === 'user') {
    return <UserPortal user={user} onLogout={handleLogout} />
  }

  // ─── Host (business) view ─────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />
      case 'chat': return <AIChat />
      case 'crm': return <CRM />
      case 'voice': return <VoicePanel />
      case 'whatsapp': return <WhatsAppPanel />
      case 'settings': return <SettingsPanel />
      default: return <Dashboard />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between h-full px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)} className="h-10 w-10">
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Headphones className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">AI Receptionist</span>
            </div>
          </div>
          {mounted && (
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="h-9 w-9">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
              <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <Headphones className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold text-lg">AI Receptionist</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}><X className="w-5 h-5" /></Button>
              </div>
              <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {hostNavItems.map(item => {
                  const Icon = item.icon
                  return (
                    <button key={item.id} onClick={() => handleTabChange(item.id)}
                      className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                        activeTab === item.id ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800')}>
                      <Icon className="w-5 h-5 flex-shrink-0" />{item.label}
                    </button>
                  )
                })}
              </nav>
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-sm font-bold">{user.name[0]}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{user.name}</p><p className="text-xs text-slate-400 truncate">{user.businessName || user.email}</p></div>
                </div>
                <Button variant="ghost" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" /> Sign Out
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex h-screen pt-16 lg:pt-0">
        {/* Desktop Sidebar */}
        <aside className={cn('hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 transition-all duration-300 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800 shadow-sm',
          sidebarOpen ? 'w-64' : 'w-20')}>
          {/* Logo */}
          <div className={cn('flex items-center h-16 px-4 border-b border-slate-200 dark:border-slate-800', sidebarOpen ? 'gap-3' : 'justify-center')}>
            <div className="w-9 h-9 flex-shrink-0 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Headphones className="w-5 h-5 text-white" />
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 dark:text-white text-sm leading-none">AI Receptionist</p>
                {user.businessName && <p className="text-xs text-slate-400 mt-0.5 truncate">{user.businessName}</p>}
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {hostNavItems.map(item => {
              const Icon = item.icon
              return (
                <button key={item.id} onClick={() => handleTabChange(item.id)}
                  className={cn('w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative',
                    sidebarOpen ? 'gap-3' : 'justify-center',
                    activeTab === item.id ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white')}>
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {sidebarOpen && <span>{item.label}</span>}
                  {!sidebarOpen && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">{item.label}</div>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Bottom */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            {mounted && (
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={cn('w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all', sidebarOpen ? 'gap-3' : 'justify-center')}>
                {theme === 'dark' ? <Sun className="w-5 h-5 flex-shrink-0" /> : <Moon className="w-5 h-5 flex-shrink-0" />}
                {sidebarOpen && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
              </button>
            )}
            {sidebarOpen && (
              <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{user.name[0]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{user.name}</p>
                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="w-full mt-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs justify-start" onClick={handleLogout}>
                  <LogOut className="w-3 h-3 mr-1" /> Sign Out
                </Button>
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden lg:flex w-full h-8 text-slate-400 hover:text-slate-600">
              <ChevronLeft className={cn('w-4 h-4 transition-transform', !sidebarOpen && 'rotate-180')} />
            </Button>
          </div>
        </aside>

        {/* Main */}
        <main className={cn('flex-1 flex flex-col overflow-hidden transition-all duration-300', sidebarOpen ? 'lg:pl-64' : 'lg:pl-20')}>
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 lg:p-8 max-w-[1400px] mx-auto">
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                  {renderContent()}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          {/* Status bar */}
          <div className="flex-shrink-0 h-8 bg-white/80 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 px-4 flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs text-slate-400">System Online</span>
            </div>
            <span className="text-xs text-slate-300 dark:text-slate-700">·</span>
            <span className="text-xs text-slate-400">Model ready · Voice active</span>
          </div>
        </main>
      </div>
    </div>
  )
}
