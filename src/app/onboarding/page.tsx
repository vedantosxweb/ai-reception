'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Bot, Globe, Mic, MessageSquare, Users, Check, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 'voice', label: 'Choose Voice', icon: Mic },
  { id: 'company', label: 'Company Info', icon: Bot },
  { id: 'website', label: 'Website URL', icon: Globe },
  { id: 'greeting', label: 'Greeting', icon: MessageSquare },
  { id: 'directory', label: 'Directory', icon: Users },
  { id: 'review', label: 'Review & Deploy', icon: Check },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapedData, setScrapedData] = useState<Record<string, unknown> | null>(null);

  // Form data
  const [voiceProvider, setVoiceProvider] = useState('openai');
  const [voiceId, setVoiceId] = useState('alloy');
  const [llmProvider, setLlmProvider] = useState('openai');
  const [name, setName] = useState('AI Receptionist');
  const [description, setDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [greeting, setGreeting] = useState('Hello! Thank you for calling. How can I help you today?');
  const [operatingMode, setOperatingMode] = useState('standard');
  const [directory, setDirectory] = useState<Array<{ name: string; department: string; phoneNumber: string }>>([]);
  const [newEntry, setNewEntry] = useState({ name: '', department: '', phoneNumber: '' });

  const scrapeWebsite = async () => {
    if (!websiteUrl) return;
    setScraping(true);
    try {
      const res = await fetch(`/api/v1/receptionists/wizard?url=${encodeURIComponent(websiteUrl)}`);
      const data = await res.json();
      if (data.success) {
        setScrapedData(data.data);
        if (data.data.description && !description) setDescription(data.data.description);
        toast.success('Website info imported successfully!');
      } else {
        toast.error(data.error || 'Could not fetch website info. Continue manually.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error fetching website. Continue manually.');
    }
    finally { setScraping(false); }
  };

  const deploy = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/receptionists/wizard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, voiceProvider, voiceId, llmProvider, operatingMode,
          companyDescription: description, websiteUrl, greeting, directory,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('AI Receptionist deployed successfully!');
        router.replace('/dashboard');
      } else {
        toast.error(data.error || 'Failed to deploy. Please try again.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error. Please try again.');
    }
    finally { setLoading(false); }
  };

  const addDirectoryEntry = () => {
    if (!newEntry.name) return;
    setDirectory([...directory, { ...newEntry }]);
    setNewEntry({ name: '', department: '', phoneNumber: '' });
  };

  const renderStep = () => {
    switch (step) {
      case 0: // Voice
        return (
          <div className="space-y-6">
            <div>
              <Label>Voice Provider</Label>
              <Select value={voiceProvider} onValueChange={setVoiceProvider}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI TTS</SelectItem>
                  <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                  <SelectItem value="playht">PlayHT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Voice</Label>
              <Select value={voiceId} onValueChange={setVoiceId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alloy">Alloy (Natural)</SelectItem>
                  <SelectItem value="echo">Echo (Warm)</SelectItem>
                  <SelectItem value="fable">Fable (British)</SelectItem>
                  <SelectItem value="onyx">Onyx (Deep)</SelectItem>
                  <SelectItem value="nova">Nova (Friendly)</SelectItem>
                  <SelectItem value="shimmer">Shimmer (Soft)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>LLM Provider</Label>
              <Select value={llmProvider} onValueChange={setLlmProvider}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI (GPT-4o)</SelectItem>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  <SelectItem value="gemini">Google (Gemini)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Operating Mode</Label>
              <Select value={operatingMode} onValueChange={setOperatingMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard Business</SelectItem>
                  <SelectItem value="medical">Medical Clinic</SelectItem>
                  <SelectItem value="legal">Legal Office</SelectItem>
                  <SelectItem value="dental">Dental Clinic</SelectItem>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                  <SelectItem value="real_estate">Real Estate</SelectItem>
                  <SelectItem value="salon">Salon</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      case 1: // Company
        return (
          <div className="space-y-6">
            <div><Label>Receptionist Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>Company Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Describe your business..." /></div>
          </div>
        );
      case 2: // Website
        return (
          <div className="space-y-6">
            <div>
              <Label>Website URL</Label>
              <div className="flex gap-2">
                <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://example.com" />
                <Button onClick={scrapeWebsite} disabled={scraping || !websiteUrl}>
                  {scraping ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Scan'}
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-1">We&apos;ll auto-extract services, FAQs, hours, and contact info</p>
            </div>
            {scrapedData && (
              <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200">
                <CardContent className="p-4 space-y-2">
                  <p className="text-sm font-medium text-emerald-700">Website scanned successfully!</p>
                  {(scrapedData.services as string[])?.length > 0 && (
                    <p className="text-xs text-slate-600">Services found: {(scrapedData.services as string[]).slice(0, 5).join(', ')}</p>
                  )}
                  {(scrapedData.faqs as unknown[])?.length > 0 && (
                    <p className="text-xs text-slate-600">FAQs found: {(scrapedData.faqs as unknown[]).length}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        );
      case 3: // Greeting
        return (
          <div className="space-y-6">
            <div>
              <Label>Custom Greeting</Label>
              <Textarea value={greeting} onChange={(e) => setGreeting(e.target.value)} rows={4} />
              <p className="text-xs text-slate-500 mt-1">This is what callers will hear first</p>
            </div>
          </div>
        );
      case 4: // Directory
        return (
          <div className="space-y-6">
            <p className="text-sm text-slate-500">Add people your AI can transfer calls to</p>
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Name" value={newEntry.name} onChange={(e) => setNewEntry({ ...newEntry, name: e.target.value })} />
              <Input placeholder="Department" value={newEntry.department} onChange={(e) => setNewEntry({ ...newEntry, department: e.target.value })} />
              <div className="flex gap-2">
                <Input placeholder="Phone" value={newEntry.phoneNumber} onChange={(e) => setNewEntry({ ...newEntry, phoneNumber: e.target.value })} />
                <Button onClick={addDirectoryEntry} size="sm">Add</Button>
              </div>
            </div>
            {directory.length > 0 && (
              <div className="space-y-2">
                {directory.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <span className="text-sm font-medium">{d.name}</span>
                    <Badge variant="outline" className="text-xs">{d.department}</Badge>
                    <span className="text-xs text-slate-500">{d.phoneNumber}</span>
                    <Button size="sm" variant="ghost" onClick={() => setDirectory(directory.filter((_, j) => j !== i))} className="ml-auto h-6 w-6 p-0">x</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 5: // Review
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-slate-500">Name:</span> <span className="font-medium">{name}</span></div>
              <div><span className="text-slate-500">Voice:</span> <span className="font-medium">{voiceId}</span></div>
              <div><span className="text-slate-500">LLM:</span> <span className="font-medium">{llmProvider}</span></div>
              <div><span className="text-slate-500">Mode:</span> <span className="font-medium capitalize">{operatingMode}</span></div>
              <div className="col-span-2"><span className="text-slate-500">Website:</span> <span className="font-medium">{websiteUrl || 'None'}</span></div>
              <div className="col-span-2"><span className="text-slate-500">Directory:</span> <span className="font-medium">{directory.length} entries</span></div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <p className="text-xs text-slate-500 mb-1">Greeting:</p>
              <p className="text-sm">{greeting}</p>
            </div>
          </div>
        );
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium',
                  i < step ? 'bg-emerald-500 text-white' :
                  i === step ? 'bg-emerald-500 text-white ring-4 ring-emerald-100' :
                  'bg-slate-200 text-slate-500'
                )}>
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                {i < STEPS.length - 1 && <div className={cn('w-8 h-0.5', i < step ? 'bg-emerald-500' : 'bg-slate-200')} />}
              </div>
            );
          })}
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl">{STEPS[step].label}</CardTitle>
            <CardDescription>Step {step + 1} of {STEPS.length}</CardDescription>
          </CardHeader>
          <CardContent>
            {renderStep()}

            <div className="flex items-center justify-between mt-8">
              <Button variant="outline" onClick={() => setStep(step - 1)} disabled={step === 0}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              {step < STEPS.length - 1 ? (
                <Button onClick={() => setStep(step + 1)} className="bg-gradient-to-r from-emerald-500 to-teal-600">
                  Next <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={deploy} disabled={loading} className="bg-gradient-to-r from-emerald-500 to-teal-600">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                  Deploy Receptionist
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
