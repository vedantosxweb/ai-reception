'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Plus, Loader2, Globe, FileText, HelpCircle, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface KnowledgeSource {
  id: string;
  type: string;
  name: string;
  url: string | null;
  status: string;
  chunkCount: number;
  lastSyncedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  _count: { embeddings: number };
}

export default function KnowledgePanel({ tenantId }: { tenantId: string }) {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [receptionists, setReceptionists] = useState<Array<{ id: string; name: string }>>([]);

  const [type, setType] = useState('website');
  const [receptionistId, setReceptionistId] = useState('');
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');
  const [name, setName] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/v1/knowledge').then((r) => r.json()),
      fetch('/api/v1/receptionists').then((r) => r.json()),
    ])
      .then(([ks, rs]) => {
        if (ks.success) setSources(ks.data);
        if (rs.success) {
          setReceptionists(rs.data.map((r: { id: string; name: string }) => ({ id: r.id, name: r.name })));
          if (rs.data.length > 0 && !receptionistId) setReceptionistId(rs.data[0].id);
        }
      })
      .catch(() => { console.error('Data load error in knowledge-panel.tsx'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tenantId]);

  const addSource = async () => {
    if (!receptionistId) return;
    setAdding(true);
    try {
      const body: Record<string, unknown> = { type, receptionistId };
      if (type === 'website') body.url = url;
      if (type === 'text') { body.content = content; body.name = name; }
      if (type === 'faq') {
        body.faqs = content.split('\n\n').map((block) => {
          const lines = block.split('\n');
          return { question: lines[0]?.replace(/^Q:\s*/i, ''), answer: lines.slice(1).join('\n').replace(/^A:\s*/i, '') };
        }).filter((f) => f.question && f.answer);
      }

      const res = await fetch('/api/v1/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if ((await res.json()).success) {
        setShowAdd(false);
        setUrl('');
        setContent('');
        setName('');
        load();
      }
    } catch (err) { console.error(err); }
    finally { setAdding(false); }
  };

  const deleteSource = async (id: string) => {
    if (!confirm('Delete this knowledge source?')) return;
    await fetch(`/api/v1/knowledge?id=${id}`, { method: 'DELETE' });
    load();
  };

  const typeIcon = (t: string) => {
    if (t === 'WEBSITE' || t === 'CRAWL') return <Globe className="w-4 h-4" />;
    if (t === 'FAQ') return <HelpCircle className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Knowledge Base</h1>
          <p className="text-slate-500 mt-1">Teach your AI what to say</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-emerald-500 to-teal-600">
              <Plus className="w-4 h-4 mr-2" /> Add Source
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Knowledge Source</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Receptionist</Label>
                <Select value={receptionistId} onValueChange={setReceptionistId}>
                  <SelectTrigger><SelectValue placeholder="Select receptionist" /></SelectTrigger>
                  <SelectContent>
                    {receptionists.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">Website URL</SelectItem>
                    <SelectItem value="text">Text/Document</SelectItem>
                    <SelectItem value="faq">FAQs</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {type === 'website' && (
                <div>
                  <Label>Website URL</Label>
                  <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
                </div>
              )}

              {type === 'text' && (
                <>
                  <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company policies" /></div>
                  <div><Label>Content</Label><Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} className="max-h-[40vh] overflow-y-auto" placeholder="Paste your content here..." /></div>
                </>
              )}

              {type === 'faq' && (
                <div>
                  <Label>FAQs (Q: and A: format, separated by blank lines)</Label>
                  <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} className="max-h-[40vh] overflow-y-auto" placeholder={"Q: What are your hours?\nA: We are open Monday-Friday, 9AM-5PM.\n\nQ: How do I book?\nA: Call us or use our online booking."} />
                </div>
              )}

              <Button onClick={addSource} disabled={adding} className="w-full">
                {adding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add Source
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {sources.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="py-16 text-center">
            <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold">No knowledge sources</h3>
            <p className="text-slate-500 mt-2">Add websites, FAQs, or documents to train your AI.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sources.map((s) => (
            <Card key={s.id} className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {typeIcon(s.type)}
                    <CardTitle className="text-base">{s.name}</CardTitle>
                  </div>
                  <Badge variant={s.status === 'READY' ? 'default' : s.status === 'ERROR' ? 'destructive' : 'secondary'} className="text-xs">
                    {s.status.toLowerCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {s.url && <p className="text-xs text-slate-500 truncate">{s.url}</p>}
                <div className="text-sm text-slate-500">
                  {s.chunkCount} chunks &middot; {s._count.embeddings} embeddings
                </div>
                {s.errorMessage && <p className="text-xs text-red-500">{s.errorMessage}</p>}
                {s.lastSyncedAt && <p className="text-xs text-slate-400">Synced: {new Date(s.lastSyncedAt).toLocaleString()}</p>}
                <Button size="sm" variant="outline" onClick={() => deleteSource(s.id)} className="w-full mt-2">
                  <Trash2 className="w-3 h-3 mr-1" /> Remove
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
