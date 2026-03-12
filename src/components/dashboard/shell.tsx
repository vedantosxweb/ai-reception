'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useClerk } from '@clerk/nextjs';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import {
  LayoutDashboard,
  Bot,
  Phone,
  BookOpen,
  Settings,
  Menu,
  X,
  Headphones,
  Sun,
  Moon,
  ChevronLeft,
  LogOut,
  CreditCard,
  Users,
  BarChart3,
  MessageSquare,
  Zap,
  BookUser,
  Plug,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { UserRole } from '@prisma/client';

// Dynamic imports for code splitting
const OverviewPanel = dynamic(() => import('@/components/dashboard/overview'), { ssr: false });
const ReceptionistsPanel = dynamic(() => import('@/components/dashboard/receptionists'), { ssr: false });
const CallLogsPanel = dynamic(() => import('@/components/dashboard/call-logs'), { ssr: false });
const KnowledgePanel = dynamic(() => import('@/components/dashboard/knowledge-panel'), { ssr: false });
const BillingPanel = dynamic(() => import('@/components/dashboard/billing-panel'), { ssr: false });
const SettingPanel = dynamic(() => import('@/components/dashboard/settings-panel'), { ssr: false });
const DirectoryPanel = dynamic(() => import('@/components/dashboard/directory-panel'), { ssr: false });
const AnalyticsPanel = dynamic(() => import('@/components/dashboard/analytics-panel'), { ssr: false });
const IntegrationsPanel = dynamic(() => import('@/components/dashboard/integrations-panel'), { ssr: false });
const PhoneNumbersPanel = dynamic(() => import('@/components/dashboard/phone-numbers-panel'), { ssr: false });
const LeadsPanel = dynamic(() => import('@/components/dashboard/leads-panel'), { ssr: false });

interface DashboardUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  plan: string;
}

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'receptionists', label: 'AI Receptionists', icon: Bot },
  { id: 'phone-numbers', label: 'Phone Numbers', icon: Phone },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'calls', label: 'Call Logs', icon: Headphones },
  { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen },
  { id: 'directory', label: 'Directory', icon: BookUser },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function DashboardShell({ user }: { user: DashboardUser }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { signOut } = useClerk();

  useEffect(() => { setMounted(true); }, []);

  // Handle ?tab=xxx and ?billing=success URL params
  useEffect(() => {
    const tab = searchParams.get('tab');
    const billing = searchParams.get('billing');

    if (tab && navItems.find((n) => n.id === tab)) {
      setActiveTab(tab);
    }

    if (billing === 'success') {
      setActiveTab('billing');
      toast.success('Payment successful! Your plan has been upgraded.');
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('billing');
      url.searchParams.delete('tab');
      router.replace(url.pathname + (url.search || ''), { scroll: false });
    }
  }, [searchParams, router]);

  const handleLogout = async () => {
    await signOut({ redirectUrl: '/' });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return <OverviewPanel tenantId={user.tenantId} />;
      case 'receptionists': return <ReceptionistsPanel tenantId={user.tenantId} />;
      case 'phone-numbers': return <PhoneNumbersPanel tenantId={user.tenantId} />;
      case 'leads': return <LeadsPanel tenantId={user.tenantId} />;
      case 'calls': return <CallLogsPanel tenantId={user.tenantId} />;
      case 'knowledge': return <KnowledgePanel tenantId={user.tenantId} />;
      case 'directory': return <DirectoryPanel />;
      case 'analytics': return <AnalyticsPanel />;
      case 'integrations': return <IntegrationsPanel />;
      case 'billing': return <BillingPanel plan={user.plan} />;
      case 'settings': return <SettingPanel />;
      default: return <OverviewPanel tenantId={user.tenantId} />;
    }
  };

  const planColor = {
    STARTER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    GROWTH: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    PRO: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    ENTERPRISE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  }[user.plan] || 'bg-slate-100 text-slate-700';

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
              <span className="font-bold text-lg bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                {user.tenantName}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {mounted && (
              <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="h-10 w-10">
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={handleLogout} className="h-10 w-10">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-72 bg-white dark:bg-slate-900 shadow-2xl"
            >
              <div className="flex items-center justify-between h-16 px-4 border-b">
                <span className="font-bold text-lg bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  {user.tenantName}
                </span>
                <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <nav className="p-3 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all',
                        activeTab === item.id
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className={cn(
        'hidden lg:flex fixed left-0 top-0 z-40 h-screen flex-col transition-all duration-300',
        sidebarOpen ? 'w-64' : 'w-20'
      )}>
        <div className="h-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800 shadow-xl flex flex-col">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 dark:border-slate-800">
            {sidebarOpen && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <Headphones className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-lg bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent truncate">
                  {user.tenantName}
                </span>
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="h-8 w-8">
              {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <motion.button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all',
                    isActive
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  )}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <Icon className={cn('w-5 h-5 flex-shrink-0', !sidebarOpen && 'mx-auto')} />
                  {sidebarOpen && <span className="font-medium truncate">{item.label}</span>}
                </motion.button>
              );
            })}
          </nav>

          {/* User info */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
            {mounted && sidebarOpen && (
              <div className="flex items-center justify-between px-2">
                <span className="text-sm text-slate-600 dark:text-slate-400">Dark Mode</span>
                <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="h-8 w-8">
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </Button>
              </div>
            )}
            {sidebarOpen && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user.name}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="capitalize text-xs">{user.role.toLowerCase()}</Badge>
                  <Badge className={cn('text-xs', planColor)}>{user.plan}</Badge>
                </div>
                <Button variant="outline" onClick={handleLogout} className="w-full mt-3" size="sm">
                  <LogOut className="w-4 h-4 mr-2" /> Logout
                </Button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn('transition-all duration-300 pt-16 lg:pt-0', sidebarOpen ? 'lg:ml-64' : 'lg:ml-20')}>
        <div className="p-4 md:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
