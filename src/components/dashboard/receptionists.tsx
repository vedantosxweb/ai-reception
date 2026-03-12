'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bot, Plus, Loader2, Settings, Play, Pause, Trash2, Globe, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

interface Receptionist {
  id: string;
  name: string;
  description: string | null;
  status: string;
  voiceProvider: string;
  voiceId: string;
  llmProvider: string;
  llmModel: string;
  greeting: string;
  operatingMode: string;
  enableSmsFollowup: boolean;
  enableVoicemail: boolean;
  neverSendToVoicemail: boolean;
  voiceLanguage: string;
  phoneNumbers: Array<{ id: string; number: string; status: string }>;
  _count: { calls: number; knowledgeSources: number };
  metrics?: {
    resolutionRate: number;
    avgSentiment: number;
    successRate: number;
  };
  createdAt: string;
}

export default function ReceptionistsPanel({ tenantId }: { tenantId: string }) {
  const [receptionists, setReceptionists] = useState<Receptionist[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [greeting, setGreeting] = useState('Hello! Thank you for calling. How can I help you today?');
  const [llmProvider, setLlmProvider] = useState('openai');
  const [voiceProvider, setVoiceProvider] = useState('openai');
  const [voiceId, setVoiceId] = useState('alloy');
  const [operatingMode, setOperatingMode] = useState('standard');
  const [enableSms, setEnableSms] = useState(true);
  const [voiceLanguage, setVoiceLanguage] = useState('en');

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

  const loadData = () => {
    setLoading(true);
    fetch('/api/v1/receptionists')
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setReceptionists(res.data);
        else toast.error('Failed to load receptionists.');
      })
      .catch(() => toast.error('Network error loading receptionists.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [tenantId]);

  const createReceptionist = async () => {
    if (!name.trim()) { toast.error('Name is required.'); return; }
    setCreating(true);

    try {
      const res = await fetch('/api/v1/receptionists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, description, greeting, llmProvider, voiceProvider, voiceId,
          operatingMode, enableSmsFollowup: enableSms, voiceLanguage,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`"${name}" created successfully!`);
        setShowCreate(false);
        setName('');
        setDescription('');
        loadData();
      } else {
        toast.error(data.error || 'Failed to create receptionist.');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      const res = await fetch('/api/v1/receptionists', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Receptionist ${newStatus === 'ACTIVE' ? 'activated' : 'paused'}.`);
      } else {
        toast.error(data.error || 'Failed to update status.');
      }
    } catch {
      toast.error('Network error.');
    }
    loadData();
  };

  const deleteReceptionist = async (id: string) => {
    if (!confirm('Are you sure you want to delete this receptionist?')) return;
    await fetch(`/api/v1/receptionists?id=${id}`, { method: 'DELETE' });
    loadData();
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">AI Receptionists</h1>
          <p className="text-slate-500 mt-1">Create and manage your AI phone agents</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-emerald-500 to-teal-600">
              <Plus className="w-4 h-4 mr-2" /> New Receptionist
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create AI Receptionist</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Main Receptionist" />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Handles general inquiries" />
              </div>
              <div>
                <Label>Greeting</Label>
                <Textarea value={greeting} onChange={(e) => setGreeting(e.target.value)} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>LLM Provider</Label>
                  <Select value={llmProvider} onValueChange={setLlmProvider}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="gemini">Gemini</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Mode</Label>
                  <Select value={operatingMode} onValueChange={setOperatingMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="medical">Medical Clinic</SelectItem>
                      <SelectItem value="legal">Legal</SelectItem>
                      <SelectItem value="dental">Dental Clinic</SelectItem>
                      <SelectItem value="restaurant">Restaurant</SelectItem>
                      <SelectItem value="real_estate">Real Estate</SelectItem>
                      <SelectItem value="salon">Salon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Voice Language</Label>
                <Select value={voiceLanguage} onValueChange={setVoiceLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        <span className="flex items-center gap-2">
                          <Globe className="w-3 h-3" />
                          {lang.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>SMS Follow-up</Label>
                <Switch checked={enableSms} onCheckedChange={setEnableSms} />
              </div>
              <Button onClick={createReceptionist} disabled={creating} className="w-full">
                {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Receptionist
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {receptionists.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="py-16 text-center">
            <Bot className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold">No receptionists yet</h3>
            <p className="text-slate-500 mt-2">Create your first AI Receptionist to start handling calls.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {receptionists.map((r) => (
            <Card key={r.id} className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{r.name}</CardTitle>
                      <CardDescription className="text-xs">{r.description || 'No description'}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={r.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {r.status.toLowerCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-xs"><Mic className="w-3 h-3 mr-1" />{r.voiceProvider}</Badge>
                  <Badge variant="outline" className="text-xs">{r.llmProvider}/{r.llmModel}</Badge>
                  <Badge variant="outline" className="text-xs capitalize">{r.operatingMode}</Badge>
                  {r.voiceLanguage && r.voiceLanguage !== 'en' && (
                    <Badge variant="outline" className="text-xs"><Globe className="w-3 h-3 mr-1" />{r.voiceLanguage.toUpperCase()}</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-slate-500">Calls: <span className="font-medium text-slate-900 dark:text-white">{r._count.calls}</span></div>
                  <div className="text-slate-500">KB Sources: <span className="font-medium text-slate-900 dark:text-white">{r._count.knowledgeSources}</span></div>
                </div>

                {r.phoneNumbers.length > 0 && (
                  <div className="text-xs text-slate-500">
                    Phone: {r.phoneNumbers.map((p) => p.number).join(', ')}
                  </div>
                )}

                {r.metrics && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Resolution Rate</span>
                      <span className="font-medium">{r.metrics.resolutionRate}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full">
                      <div 
                        className="bg-emerald-500 h-1.5 rounded-full" 
                        style={{ width: `${r.metrics.resolutionRate}%` }}
                      />
                    </div>
                    
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Avg Sentiment</span>
                      <span className="font-medium">{r.metrics.avgSentiment}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full">
                      <div 
                        className="bg-teal-500 h-1.5 rounded-full" 
                        style={{ width: `${r.metrics.avgSentiment}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    size="sm"
                    variant={r.status === 'ACTIVE' ? 'outline' : 'default'}
                    onClick={() => toggleStatus(r.id, r.status)}
                    className="flex-1"
                  >
                    {r.status === 'ACTIVE' ? <><Pause className="w-3 h-3 mr-1" /> Pause</> : <><Play className="w-3 h-3 mr-1" /> Activate</>}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => deleteReceptionist(r.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
