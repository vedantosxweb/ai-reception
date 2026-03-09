'use client';

import { useEffect, useState } from 'react';
import { Plug, Loader2, CheckCircle2, XCircle, RefreshCw, Trash2, Globe, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Integration {
  id: string;
  provider: string;
  status: string;
  config: Record<string, unknown>;
  lastSyncAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

const PROVIDERS = [
  {
    id: 'hubspot',
    name: 'HubSpot CRM',
    description: 'Sync contacts and log call engagements to HubSpot automatically.',
    icon: Phone,
    color: 'from-orange-500 to-red-500',
    fields: [{ key: 'accessToken', label: 'API Access Token', type: 'password' }],
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Sync appointments and check availability via Google Calendar.',
    icon: Globe,
    color: 'from-blue-500 to-indigo-500',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password' },
      { key: 'refreshToken', label: 'Refresh Token', type: 'password' },
    ],
    configFields: [{ key: 'calendarId', label: 'Calendar ID (optional)', type: 'text' }],
  },
];

export default function IntegrationsPanel() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [showConnect, setShowConnect] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const loadIntegrations = () => {
    setLoading(true);
    fetch('/api/v1/integrations')
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setIntegrations(res.data);
      })
      .catch(() => { console.error('Data load error in integrations-panel.tsx'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadIntegrations();
  }, []);

  const connect = async (providerId: string) => {
    setConnecting(providerId);
    setError('');

    const provider = PROVIDERS.find((p) => p.id === providerId);
    if (!provider) return;

    const credentials: Record<string, string> = {};
    for (const field of provider.fields) {
      credentials[field.key] = formData[field.key] || '';
    }

    const config: Record<string, string> = {};
    if (provider.configFields) {
      for (const field of provider.configFields) {
        if (formData[field.key]) config[field.key] = formData[field.key];
      }
    }

    try {
      const res = await fetch('/api/v1/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, credentials, config }),
      });
      const data = await res.json();
      if (data.success) {
        setShowConnect(null);
        setFormData({});
        loadIntegrations();
      } else {
        setError(data.error || 'Connection failed');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setConnecting(null);
    }
  };

  const disconnect = async (providerId: string) => {
    if (!confirm(`Are you sure you want to disconnect ${providerId}?`)) return;
    setDisconnecting(providerId);
    try {
      await fetch(`/api/v1/integrations?provider=${providerId}`, { method: 'DELETE' });
      loadIntegrations();
    } catch (err) {
      console.error(err);
    } finally {
      setDisconnecting(null);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Integrations</h1>
        <p className="text-slate-500 mt-1">Connect your tools for seamless workflows</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PROVIDERS.map((provider) => {
          const connected = integrations.find((i) => i.provider === provider.id);
          const Icon = provider.icon;

          return (
            <Card key={provider.id} className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${provider.color} flex items-center justify-center`}
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{provider.name}</CardTitle>
                      <CardDescription className="text-sm">{provider.description}</CardDescription>
                    </div>
                  </div>
                  {connected && (
                    <Badge
                      variant={connected.status === 'active' ? 'default' : 'secondary'}
                      className={
                        connected.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : ''
                      }
                    >
                      {connected.status === 'active' ? (
                        <><CheckCircle2 className="w-3 h-3 mr-1" /> Connected</>
                      ) : (
                        <><XCircle className="w-3 h-3 mr-1" /> {connected.status}</>
                      )}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {connected ? (
                  <div className="space-y-3">
                    {connected.lastSyncAt && (
                      <p className="text-xs text-slate-500">
                        Last synced: {new Date(connected.lastSyncAt).toLocaleString()}
                      </p>
                    )}
                    {connected.errorMessage && (
                      <p className="text-xs text-red-500">{connected.errorMessage}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => disconnect(provider.id)}
                        disabled={disconnecting === provider.id}
                      >
                        {disconnecting === provider.id ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3 mr-1" />
                        )}
                        Disconnect
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Dialog
                    open={showConnect === provider.id}
                    onOpenChange={(open) => {
                      setShowConnect(open ? provider.id : null);
                      if (!open) {
                        setFormData({});
                        setError('');
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button className="bg-gradient-to-r from-emerald-500 to-teal-600">
                        <Plug className="w-4 h-4 mr-2" /> Connect
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Connect {provider.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        {provider.fields.map((field) => (
                          <div key={field.key}>
                            <Label>{field.label}</Label>
                            <Input
                              type={field.type}
                              value={formData[field.key] || ''}
                              onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                              placeholder={`Enter ${field.label.toLowerCase()}`}
                            />
                          </div>
                        ))}
                        {provider.configFields?.map((field) => (
                          <div key={field.key}>
                            <Label>{field.label}</Label>
                            <Input
                              type={field.type}
                              value={formData[field.key] || ''}
                              onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                              placeholder={`Enter ${field.label.toLowerCase()}`}
                            />
                          </div>
                        ))}
                        {error && <p className="text-sm text-red-500">{error}</p>}
                        <Button
                          onClick={() => connect(provider.id)}
                          disabled={connecting === provider.id}
                          className="w-full"
                        >
                          {connecting === provider.id && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Connect {provider.name}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
