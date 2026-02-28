'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Calendar, Briefcase, Plus, Search, Phone, Mail,
  Clock, Edit, Trash2, Eye, CheckCircle, RefreshCw, AlertCircle, Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

// ─── Types ────────────────────────────────────────────────

interface Contact {
  id: string; firstName: string; lastName: string; email: string | null
  phone: string | null; company: string | null; status: string; source: string | null
  lastContact: string | null; createdAt: string
  _count?: { appointments: number; conversations: number }
}

interface Appointment {
  id: string; title: string; startTime: string; endTime: string; status: string
  source: string; notes: string | null
  contact: { id: string; firstName: string; lastName: string; email: string | null }
  service: { id: string; name: string } | null
}

interface Service {
  id: string; name: string; description: string | null; duration: number
  price: number; category: string | null; active: boolean
  _count?: { appointments: number }
}

// ─── Helpers ──────────────────────────────────────────────

const statusColor: Record<string, string> = {
  customer: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400',
  prospect: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400',
  lead: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400',
  confirmed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400',
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400',
  completed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400',
}

// ─── Contact Form ─────────────────────────────────────────

interface ContactFormState {
  firstName: string; lastName: string; email: string; phone: string
  company: string; position: string; source: string; notes: string
}

const emptyContactForm: ContactFormState = {
  firstName: '', lastName: '', email: '', phone: '', company: '', position: '', source: 'manual', notes: ''
}

// ─── Service Form ─────────────────────────────────────────

interface ServiceFormState { name: string; description: string; duration: string; price: string; category: string }
const emptyServiceForm: ServiceFormState = { name: '', description: '', duration: '30', price: '0', category: '' }

// ─── Main Component ───────────────────────────────────────

export default function CRM() {
  const [activeTab, setActiveTab] = useState('contacts')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState({ contacts: true, appointments: true, services: true })
  const [searchQuery, setSearchQuery] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [contactForm, setContactForm] = useState<ContactFormState>(emptyContactForm)
  const [serviceForm, setServiceForm] = useState<ServiceFormState>(emptyServiceForm)

  // ─── Fetch Data ───────────────────────────────────────

  const fetchContacts = useCallback(async (search = '') => {
    setLoading(l => ({ ...l, contacts: true }))
    try {
      const res = await fetch(`/api/contacts${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      const data = await res.json()
      setContacts(data.contacts || [])
    } catch { setError('Failed to load contacts') }
    setLoading(l => ({ ...l, contacts: false }))
  }, [])

  const fetchAppointments = useCallback(async () => {
    setLoading(l => ({ ...l, appointments: true }))
    try {
      const res = await fetch('/api/appointments')
      const data = await res.json()
      setAppointments(data.appointments || [])
    } catch { setError('Failed to load appointments') }
    setLoading(l => ({ ...l, appointments: false }))
  }, [])

  const fetchServices = useCallback(async () => {
    setLoading(l => ({ ...l, services: true }))
    try {
      const res = await fetch('/api/services')
      const data = await res.json()
      setServices(data.services || [])
    } catch { setError('Failed to load services') }
    setLoading(l => ({ ...l, services: false }))
  }, [])

  useEffect(() => { fetchContacts(); fetchAppointments(); fetchServices() }, [fetchContacts, fetchAppointments, fetchServices])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchContacts(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery, fetchContacts])

  // ─── Save Handlers ────────────────────────────────────

  const saveContact = async () => {
    if (!contactForm.firstName || !contactForm.lastName) { setError('First and last name required'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to save'); return }
      setIsAddDialogOpen(false)
      setContactForm(emptyContactForm)
      fetchContacts(searchQuery)
    } catch { setError('Network error') }
    setSaving(false)
  }

  const saveService = async () => {
    if (!serviceForm.name) { setError('Service name required'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/services', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...serviceForm, duration: parseInt(serviceForm.duration) || 30, price: parseFloat(serviceForm.price) || 0 }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to save'); return }
      setIsAddDialogOpen(false)
      setServiceForm(emptyServiceForm)
      fetchServices()
    } catch { setError('Network error') }
    setSaving(false)
  }

  const updateAppointmentStatus = async (id: string, status: string) => {
    try {
      await fetch('/api/appointments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
      fetchAppointments()
    } catch { setError('Failed to update') }
  }

  const handleSave = () => {
    setError('')
    if (activeTab === 'contacts') saveContact()
    else if (activeTab === 'services') saveService()
  }

  // ─── Render ───────────────────────────────────────────

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">CRM</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage contacts, appointments & services</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchContacts(); fetchAppointments(); fetchServices() }}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          {activeTab !== 'appointments' && (
            <Dialog open={isAddDialogOpen} onOpenChange={o => { setIsAddDialogOpen(o); setError('') }}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600">
                  <Plus className="w-4 h-4 mr-2" /> Add {activeTab === 'contacts' ? 'Contact' : 'Service'}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New {activeTab === 'contacts' ? 'Contact' : 'Service'}</DialogTitle>
                  <DialogDescription>Fill in the details below.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {activeTab === 'contacts' ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>First Name *</Label><Input className="mt-1" value={contactForm.firstName} onChange={e => setContactForm(f => ({...f, firstName: e.target.value}))} /></div>
                        <div><Label>Last Name *</Label><Input className="mt-1" value={contactForm.lastName} onChange={e => setContactForm(f => ({...f, lastName: e.target.value}))} /></div>
                      </div>
                      <div><Label>Email</Label><Input className="mt-1" type="email" value={contactForm.email} onChange={e => setContactForm(f => ({...f, email: e.target.value}))} /></div>
                      <div><Label>Phone</Label><Input className="mt-1" value={contactForm.phone} onChange={e => setContactForm(f => ({...f, phone: e.target.value}))} /></div>
                      <div><Label>Company</Label><Input className="mt-1" value={contactForm.company} onChange={e => setContactForm(f => ({...f, company: e.target.value}))} /></div>
                      <div><Label>Source</Label>
                        <Select value={contactForm.source} onValueChange={v => setContactForm(f => ({...f, source: v}))}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['manual','website','voice','whatsapp','chat','referral'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Notes</Label><Textarea className="mt-1" rows={3} value={contactForm.notes} onChange={e => setContactForm(f => ({...f, notes: e.target.value}))} /></div>
                    </>
                  ) : (
                    <>
                      <div><Label>Service Name *</Label><Input className="mt-1" value={serviceForm.name} onChange={e => setServiceForm(f => ({...f, name: e.target.value}))} /></div>
                      <div><Label>Description</Label><Textarea className="mt-1" rows={2} value={serviceForm.description} onChange={e => setServiceForm(f => ({...f, description: e.target.value}))} /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Duration (min)</Label><Input className="mt-1" type="number" min="5" value={serviceForm.duration} onChange={e => setServiceForm(f => ({...f, duration: e.target.value}))} /></div>
                        <div><Label>Price ($)</Label><Input className="mt-1" type="number" min="0" step="0.01" value={serviceForm.price} onChange={e => setServiceForm(f => ({...f, price: e.target.value}))} /></div>
                      </div>
                      <div><Label>Category</Label><Input className="mt-1" value={serviceForm.category} onChange={e => setServiceForm(f => ({...f, category: e.target.value}))} /></div>
                    </>
                  )}
                  {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600">
                    {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <><CheckCircle className="w-4 h-4 mr-2" /> Save</>}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <TabsTrigger value="contacts" className="gap-2">
            <Users className="w-4 h-4" /> Contacts
            <Badge variant="outline" className="ml-1 text-xs">{contacts.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="appointments" className="gap-2">
            <Calendar className="w-4 h-4" /> Appointments
            <Badge variant="outline" className="ml-1 text-xs">{appointments.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="services" className="gap-2">
            <Briefcase className="w-4 h-4" /> Services
            <Badge variant="outline" className="ml-1 text-xs">{services.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* ─── Contacts ─────────────────────────────────────────── */}
        <TabsContent value="contacts" className="mt-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search contacts..." className="pl-10" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          {loading.contacts ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}</div>
          ) : contacts.length === 0 ? (
            <Card className="border-0 shadow-sm"><CardContent className="py-16 text-center">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No contacts found</p>
              <p className="text-xs text-slate-400 mt-1">Add a contact or they'll appear automatically from chat bookings</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {contacts.map((c, i) => (
                <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
                          {c.firstName[0]}{c.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-900 dark:text-white">{c.firstName} {c.lastName}</p>
                            <Badge className={`${statusColor[c.status] || ''} text-xs capitalize`}>{c.status}</Badge>
                            {c.source && <Badge variant="outline" className="text-xs capitalize">{c.source}</Badge>}
                          </div>
                          <div className="flex items-center gap-4 mt-1 flex-wrap">
                            {c.email && <span className="text-xs text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                            {c.phone && <span className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                            {c.company && <span className="text-xs text-slate-500">{c.company}</span>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</p>
                          {c._count && <p className="text-xs text-slate-400">{c._count.appointments} apts</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Appointments ─────────────────────────────────────── */}
        <TabsContent value="appointments" className="mt-4">
          {loading.appointments ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}</div>
          ) : appointments.length === 0 ? (
            <Card className="border-0 shadow-sm"><CardContent className="py-16 text-center">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No appointments yet</p>
              <p className="text-xs text-slate-400 mt-1">Appointments booked via chat, voice or WhatsApp appear here automatically</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {appointments.map((apt, i) => (
                <motion.div key={apt.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-slate-500 leading-none">{new Date(apt.startTime).toLocaleDateString('en-US',{month:'short'}).toUpperCase()}</span>
                          <span className="text-lg font-black text-slate-700 dark:text-slate-300 leading-none">{new Date(apt.startTime).getDate()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">{apt.title}</p>
                            <Badge className={`${statusColor[apt.status] || ''} text-xs capitalize`}>{apt.status}</Badge>
                            <Badge variant="outline" className="text-xs capitalize">{apt.source}</Badge>
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">
                            {apt.contact.firstName} {apt.contact.lastName} · {new Date(apt.startTime).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                            {apt.service && ` · ${apt.service.name}`}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {apt.status === 'scheduled' && (
                            <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 text-xs"
                              onClick={() => updateAppointmentStatus(apt.id, 'confirmed')}>
                              Confirm
                            </Button>
                          )}
                          {(apt.status === 'scheduled' || apt.status === 'confirmed') && (
                            <Button size="sm" variant="outline" className="text-red-500 border-red-200 hover:bg-red-50 text-xs"
                              onClick={() => updateAppointmentStatus(apt.id, 'cancelled')}>
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Services ─────────────────────────────────────────── */}
        <TabsContent value="services" className="mt-4">
          {loading.services ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => <div key={i} className="h-36 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
            </div>
          ) : services.length === 0 ? (
            <Card className="border-0 shadow-sm"><CardContent className="py-16 text-center">
              <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No services yet</p>
              <p className="text-xs text-slate-400 mt-1">Add your first service to get started</p>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((svc, i) => (
                <motion.div key={svc.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                  <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-slate-900 dark:text-white">{svc.name}</h3>
                        <Badge className={svc.active ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-slate-100 text-slate-500 border-0'}>
                          {svc.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {svc.description && <p className="text-xs text-slate-500 mb-3 line-clamp-2">{svc.description}</p>}
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{svc.duration}m</span>
                        <span className="font-semibold text-emerald-600">{svc.price > 0 ? `$${svc.price}` : 'Free'}</span>
                        {svc.category && <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{svc.category}</span>}
                      </div>
                      {svc._count && <p className="text-xs text-slate-400 mt-2">{svc._count.appointments} bookings</p>}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
