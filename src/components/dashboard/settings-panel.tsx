'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Save, Loader2, Building2, Clock3, Globe, CalendarOff, Plus, Trash2,
  Timer, ChevronRight, TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ---------------------------------------------------------------------------
// Blocked Times Card
// ---------------------------------------------------------------------------

function BlockedTimesCard({
  exceptions,
  onAdd,
  onRemove,
}: {
  exceptions: AvailabilityExceptionRow[];
  onAdd: (ex: Omit<AvailabilityExceptionRow, 'id'>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [exceptionDate, setExceptionDate] = useState('');
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('13:00');
  const [label, setLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const isRecurring = !exceptionDate.trim();

  const handleAdd = async () => {
    if (!startTime || !endTime) {
      toast.error('Please set both start and end times.');
      return;
    }
    if (startTime >= endTime) {
      toast.error('End time must be after start time.');
      return;
    }
    setAdding(true);
    await onAdd({
      dayOfWeek: isRecurring ? dayOfWeek : 0,
      exceptionDate: isRecurring ? null : exceptionDate.trim() || null,
      startTime,
      endTime,
      label: label.trim() || null,
    });
    setAdding(false);
    setLabel('');
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    await onRemove(id);
    setRemovingId(null);
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarOff className="w-5 h-5" /> Blocked Times
        </CardTitle>
        <CardDescription>
          Block specific times from being bookable — e.g. lunch breaks, meetings. Supports weekly
          recurring or one-off dates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add form */}
        <div className="flex flex-wrap items-end gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium">Type</Label>
            <Select
              value={exceptionDate ? 'date' : 'recurring'}
              onValueChange={(v) =>
                setExceptionDate(v === 'date' ? new Date().toISOString().slice(0, 10) : '')
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recurring">Recurring (weekly)</SelectItem>
                <SelectItem value="date">Specific date</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {exceptionDate ? (
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium">Date</Label>
              <Input
                type="date"
                value={exceptionDate}
                onChange={(e) => setExceptionDate(e.target.value)}
                className="w-40"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium">Day of Week</Label>
              <Select value={String(dayOfWeek)} onValueChange={(v) => setDayOfWeek(Number(v))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium">Start</Label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-28"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium">End</Label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-28"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium">Label (optional)</Label>
            <Input
              placeholder="e.g. Lunch"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-28"
            />
          </div>

          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
            disabled={adding}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span className="ml-1 hidden sm:inline">Add Block</span>
          </Button>
        </div>

        {/* List */}
        <ul className="space-y-2">
          {exceptions.map((ex) => (
            <li
              key={ex.id}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="flex items-center gap-2 text-sm">
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium">
                  {ex.exceptionDate
                    ? new Date(ex.exceptionDate + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : DAYS[ex.dayOfWeek]}
                </span>
                <span className="text-slate-500">
                  {ex.startTime} – {ex.endTime}
                </span>
                {ex.label && (
                  <span className="text-xs bg-slate-200 dark:bg-slate-700 rounded px-1.5 py-0.5">
                    {ex.label}
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={removingId === ex.id}
                onClick={() => handleRemove(ex.id)}
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                {removingId === ex.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            </li>
          ))}
          {exceptions.length === 0 && (
            <li className="text-sm text-slate-500 py-3 text-center">
              No blocked times — all hours within business hours are bookable.
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ar', label: 'Arabic' },
  { value: 'nl', label: 'Dutch' },
  { value: 'pl', label: 'Polish' },
  { value: 'ru', label: 'Russian' },
  { value: 'sv', label: 'Swedish' },
  { value: 'tr', label: 'Turkish' },
  { value: 'da', label: 'Danish' },
  { value: 'nb', label: 'Norwegian' },
];

const INDUSTRIES = [
  'Healthcare', 'Legal', 'Real Estate', 'Finance', 'Technology', 'Retail',
  'Education', 'Hospitality', 'Construction', 'Consulting', 'Other',
];

const CURRENCIES = [
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'INR', label: 'Indian Rupee (INR)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
  { value: 'AED', label: 'UAE Dirham (AED)' },
  { value: 'AUD', label: 'Australian Dollar (AUD)' },
  { value: 'CAD', label: 'Canadian Dollar (CAD)' },
];

interface AvailabilityExceptionRow {
  id: string;
  dayOfWeek: number;
  exceptionDate: string | null;
  startTime: string;
  endTime: string;
  label: string | null;
}

interface TenantData {
  name: string;
  website: string;
  description: string;
  industry: string;
  timezone: string;
  defaultLanguage: string;
  defaultMeetingDurationMinutes: number;
  meetingBufferMinutes: number;
  slotStepMinutes: number;
  revenueCurrency: string;
  defaultAppointmentValue: number;
  pricingCatalog: Array<{ service: string; price: number; currency: string }>;
  businessHours: Array<{
    dayOfWeek: number;
    openTime: string;
    closeTime: string;
    isOpen: boolean;
  }>;
  availabilityExceptions: AvailabilityExceptionRow[];
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SettingsPanel() {
  const [data, setData] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/tenants').then((r) => r.json()),
      fetch('/api/v1/availability-exceptions').then((r) => r.json()),
    ])
      .then(([tenantRes, exRes]) => {
        if (!tenantRes.success) {
          toast.error('Failed to load settings.');
          return;
        }
        const t = tenantRes.data;
        const baseRevenueCurrency =
          typeof t.revenueCurrency === 'string' && t.revenueCurrency.trim()
            ? t.revenueCurrency.toUpperCase()
            : 'USD';
        const pricingCatalog: Array<{ service: string; price: number; currency: string }> = Array.isArray(t.pricingCatalog)
          ? t.pricingCatalog
              .map((item: { service?: unknown; price?: unknown }) => ({
                service: typeof item?.service === 'string' ? item.service : '',
                price: typeof item?.price === 'number' && Number.isFinite(item.price) ? item.price : 0,
                currency:
                  typeof (item as { currency?: unknown })?.currency === 'string' &&
                  /^[A-Z]{3}$/.test(((item as { currency?: string }).currency || '').trim().toUpperCase())
                    ? ((item as { currency?: string }).currency || '').trim().toUpperCase()
                    : baseRevenueCurrency,
              }))
              .filter((item: { service: string; price: number; currency: string }) => item.service.trim().length > 0)
          : [];
        const exceptions: AvailabilityExceptionRow[] =
          exRes.success && exRes.data
            ? exRes.data.map(
                (x: {
                  id: string;
                  dayOfWeek: number;
                  exceptionDate: string | null;
                  startTime: string;
                  endTime: string;
                  label: string | null;
                }) => ({
                  id: x.id,
                  dayOfWeek: x.dayOfWeek,
                  exceptionDate: x.exceptionDate ? x.exceptionDate.slice(0, 10) : null,
                  startTime: x.startTime,
                  endTime: x.endTime,
                  label: x.label,
                })
              )
            : [];
        setData({
          name: t.name || '',
          website: t.website || '',
          description: t.description || '',
          industry: t.industry || '',
          timezone: t.timezone || 'America/New_York',
          defaultLanguage: t.defaultLanguage || 'en',
          defaultMeetingDurationMinutes:
            typeof t.defaultMeetingDurationMinutes === 'number'
              ? t.defaultMeetingDurationMinutes
              : 30,
          meetingBufferMinutes:
            typeof t.meetingBufferMinutes === 'number' ? t.meetingBufferMinutes : 0,
          slotStepMinutes:
            typeof t.slotStepMinutes === 'number' ? t.slotStepMinutes : 15,
          revenueCurrency:
            typeof t.revenueCurrency === 'string' && t.revenueCurrency.trim()
              ? t.revenueCurrency.toUpperCase()
              : 'USD',
          defaultAppointmentValue:
            typeof t.defaultAppointmentValue === 'number' && Number.isFinite(t.defaultAppointmentValue)
              ? t.defaultAppointmentValue
              : 200,
          pricingCatalog,
          businessHours:
            t.businessHours?.length > 0
              ? t.businessHours
              : DAYS.map((_, i) => ({
                  dayOfWeek: i,
                  openTime: '09:00',
                  closeTime: '17:00',
                  isOpen: i > 0 && i < 6,
                })),
          availabilityExceptions: exceptions,
        });
      })
      .catch(() => toast.error('Network error loading settings.'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          website: data.website,
          description: data.description,
          industry: data.industry,
          timezone: data.timezone,
          defaultLanguage: data.defaultLanguage,
          defaultMeetingDurationMinutes: data.defaultMeetingDurationMinutes,
          meetingBufferMinutes: data.meetingBufferMinutes,
          slotStepMinutes: data.slotStepMinutes,
          revenueCurrency: data.revenueCurrency,
          defaultAppointmentValue: data.defaultAppointmentValue,
          pricingCatalog: data.pricingCatalog
            .map((p) => ({
              service: p.service.trim(),
              price: Number(p.price),
              currency: (p.currency || data.revenueCurrency || 'USD').trim().toUpperCase(),
            }))
            .filter((p) => p.service && Number.isFinite(p.price) && p.price >= 0 && /^[A-Z]{3}$/.test(p.currency)),
          businessHours: data.businessHours,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Settings saved successfully!');
        // Refresh server data so sidebar shows updated company name
        router.refresh();
      } else {
        toast.error(json.error || 'Failed to save settings.');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const addException = async (ex: Omit<AvailabilityExceptionRow, 'id'>) => {
    try {
      const res = await fetch('/api/v1/availability-exceptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayOfWeek: ex.dayOfWeek,
          exceptionDate: ex.exceptionDate || null,
          startTime: ex.startTime,
          endTime: ex.endTime,
          label: ex.label || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.success && json.data) {
        setData((d) =>
          d
            ? {
                ...d,
                availabilityExceptions: [
                  ...d.availabilityExceptions,
                  { ...ex, id: json.data.id },
                ],
              }
            : d
        );
        toast.success('Blocked time added.');
      } else {
        toast.error(json.error || 'Failed to add blocked time.');
      }
    } catch {
      toast.error('Network error. Please try again.');
    }
  };

  const removeException = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/availability-exceptions?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setData((d) =>
          d
            ? {
                ...d,
                availabilityExceptions: d.availabilityExceptions.filter((e) => e.id !== id),
              }
            : d
        );
        toast.success('Blocked time removed.');
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error || 'Failed to remove blocked time.');
      }
    } catch {
      toast.error('Network error. Please try again.');
    }
  };

  if (loading || !data) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-500 mt-1">Configure your company and scheduling settings</p>
      </div>

      {/* Company Info */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" /> Company Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Company Name</Label>
            <Input
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              placeholder="Acme Corp"
            />
          </div>
          <div>
            <Label>Website</Label>
            <Input
              value={data.website}
              onChange={(e) => setData({ ...data, website: e.target.value })}
              placeholder="https://example.com"
              type="url"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={data.description}
              onChange={(e) => setData({ ...data, description: e.target.value })}
              rows={3}
              placeholder="Brief description of your business..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Industry</Label>
              <Select
                value={data.industry || ''}
                onValueChange={(v) => setData({ ...data, industry: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>
                      {ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Timezone</Label>
              <Input
                value={data.timezone}
                onChange={(e) => setData({ ...data, timezone: e.target.value })}
                placeholder="America/New_York"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Settings */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" /> Revenue Settings
          </CardTitle>
          <CardDescription>
            Configure how dashboard revenue is calculated from booked appointments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Revenue Currency</Label>
              <Select
                value={data.revenueCurrency}
                onValueChange={(v) => setData({ ...data, revenueCurrency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Default Appointment Value</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={Number.isFinite(data.defaultAppointmentValue) ? data.defaultAppointmentValue : 0}
                onChange={(e) =>
                  setData({
                    ...data,
                    defaultAppointmentValue: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
              <p className="text-xs text-slate-500 mt-1">
                Used when a booked service does not match any product-specific pricing.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Product/Service Pricing</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setData({
                    ...data,
                    pricingCatalog: [
                      ...data.pricingCatalog,
                      { service: '', price: 0, currency: data.revenueCurrency || 'USD' },
                    ],
                  })
                }
              >
                <Plus className="w-4 h-4 mr-1" /> Add Pricing Row
              </Button>
            </div>

            {data.pricingCatalog.length === 0 && (
              <p className="text-sm text-slate-500">
                No product-specific pricing yet. Add rows to map service names to prices.
              </p>
            )}

            {data.pricingCatalog.map((row, idx) => (
              <div key={`${idx}-${row.service}`} className="grid grid-cols-1 md:grid-cols-[1fr_140px_160px_auto] gap-2 items-end">
                <div>
                  <Label className="text-xs">Service Name</Label>
                  <Input
                    value={row.service}
                    onChange={(e) => {
                      const next = [...data.pricingCatalog];
                      next[idx] = { ...next[idx], service: e.target.value };
                      setData({ ...data, pricingCatalog: next });
                    }}
                    placeholder="e.g. Discovery Call"
                  />
                </div>
                <div>
                  <Label className="text-xs">Price</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={Number.isFinite(row.price) ? row.price : 0}
                    onChange={(e) => {
                      const next = [...data.pricingCatalog];
                      next[idx] = { ...next[idx], price: Math.max(0, Number(e.target.value) || 0) };
                      setData({ ...data, pricingCatalog: next });
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Currency</Label>
                  <Select
                    value={row.currency || data.revenueCurrency || 'USD'}
                    onValueChange={(v) => {
                      const next = [...data.pricingCatalog];
                      next[idx] = { ...next[idx], currency: v };
                      setData({ ...data, pricingCatalog: next });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() =>
                    setData({
                      ...data,
                      pricingCatalog: data.pricingCatalog.filter((_, i) => i !== idx),
                    })
                  }
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Default Language */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" /> Default Language
          </CardTitle>
          <CardDescription>
            Default language for new AI receptionists. Each receptionist can override this.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Select
              value={data.defaultLanguage}
              onValueChange={(v) => setData({ ...data, defaultLanguage: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Business Hours */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock3 className="w-5 h-5" /> Business Hours
          </CardTitle>
          <CardDescription>
            Set the hours your business is open for bookings each day.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.businessHours.map((hour, idx) => (
              <div
                key={hour.dayOfWeek}
                className="flex items-center gap-4 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
              >
                <div className="w-24 text-sm font-medium text-slate-700 dark:text-slate-300">
                  {DAYS[hour.dayOfWeek]}
                </div>
                <Switch
                  checked={hour.isOpen}
                  onCheckedChange={(checked) => {
                    const updated = [...data.businessHours];
                    updated[idx] = { ...updated[idx], isOpen: checked };
                    setData({ ...data, businessHours: updated });
                  }}
                />
                {hour.isOpen ? (
                  <>
                    <Input
                      type="time"
                      value={hour.openTime}
                      onChange={(e) => {
                        const updated = [...data.businessHours];
                        updated[idx] = { ...updated[idx], openTime: e.target.value };
                        setData({ ...data, businessHours: updated });
                      }}
                      className="w-32"
                    />
                    <span className="text-slate-400 text-sm">to</span>
                    <Input
                      type="time"
                      value={hour.closeTime}
                      onChange={(e) => {
                        const updated = [...data.businessHours];
                        updated[idx] = { ...updated[idx], closeTime: e.target.value };
                        setData({ ...data, businessHours: updated });
                      }}
                      className="w-32"
                    />
                  </>
                ) : (
                  <span className="text-sm text-slate-400 italic">Closed</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Meeting Settings */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="w-5 h-5" /> Meeting Slot Settings
          </CardTitle>
          <CardDescription>
            Control how booking slots are generated and presented to callers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Duration */}
          <div>
            <Label className="font-medium">Default Meeting Duration</Label>
            <p className="text-xs text-slate-500 mb-2">
              How long each appointment is (e.g. 30 min consultation, 60 min session).
            </p>
            <div className="flex items-center gap-3 max-w-xs">
              <Select
                value={String(data.defaultMeetingDurationMinutes)}
                onValueChange={(v) =>
                  setData({ ...data, defaultMeetingDurationMinutes: Number(v) })
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[15, 20, 25, 30, 45, 60, 75, 90, 120].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} minutes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Buffer */}
          <div>
            <Label className="font-medium">Buffer Between Meetings</Label>
            <p className="text-xs text-slate-500 mb-2">
              Gap between appointments — gives you time to prepare or wrap up.
            </p>
            <Select
              value={String(data.meetingBufferMinutes)}
              onValueChange={(v) => setData({ ...data, meetingBufferMinutes: Number(v) })}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">No buffer</SelectItem>
                <SelectItem value="5">5 minutes</SelectItem>
                <SelectItem value="10">10 minutes</SelectItem>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Slot step */}
          <div>
            <Label className="font-medium">Slot Offer Interval</Label>
            <p className="text-xs text-slate-500 mb-2">
              How frequently slots are offered (e.g. every 15 min: 9:00, 9:15, 9:30...).
            </p>
            <Select
              value={String(data.slotStepMinutes)}
              onValueChange={(v) => setData({ ...data, slotStepMinutes: Number(v) })}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">Every 5 minutes</SelectItem>
                <SelectItem value="10">Every 10 minutes</SelectItem>
                <SelectItem value="15">Every 15 minutes</SelectItem>
                <SelectItem value="30">Every 30 minutes</SelectItem>
                <SelectItem value="60">Every hour</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Blocked Times */}
      <BlockedTimesCard
        exceptions={data.availabilityExceptions}
        onAdd={addException}
        onRemove={removeException}
      />

      {/* Save */}
      <div className="flex justify-end">
        <Button
          onClick={save}
          disabled={saving}
          className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 min-w-[140px]"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
