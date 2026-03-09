'use client';

import { useEffect, useState } from 'react';
import { BookUser, Plus, Loader2, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface DirectoryEntry {
  id: string;
  name: string;
  title: string | null;
  department: string | null;
  extension: string | null;
  phoneNumber: string | null;
  email: string | null;
}

export default function DirectoryPanel() {
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', title: '', department: '', extension: '', phoneNumber: '', email: '' });

  const load = () => {
    setLoading(true);
    fetch('/api/v1/directory')
      .then((r) => r.json())
      .then((res) => { if (res.success) setEntries(res.data); })
      .catch(() => { console.error('Data load error in directory-panel.tsx'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const addEntry = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      await fetch('/api/v1/directory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setShowAdd(false);
      setForm({ name: '', title: '', department: '', extension: '', phoneNumber: '', email: '' });
      load();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    await fetch(`/api/v1/directory?id=${id}`, { method: 'DELETE' });
    load();
  };

  if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Company Directory</h1>
          <p className="text-slate-500 mt-1">People your AI can transfer calls to</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-emerald-500 to-teal-600"><Plus className="w-4 h-4 mr-2" /> Add Person</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Directory Entry</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Smith" /></div>
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Office Manager" /></div>
              <div><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Front Desk" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Extension</Label><Input value={form.extension} onChange={(e) => setForm({ ...form, extension: e.target.value })} placeholder="101" /></div>
                <div><Label>Phone</Label><Input value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} placeholder="+1234567890" /></div>
              </div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <Button onClick={addEntry} disabled={saving} className="w-full">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Add Entry
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {entries.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="py-16 text-center">
            <BookUser className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold">No directory entries</h3>
            <p className="text-slate-500 mt-2">Add people so your AI knows who to transfer calls to.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Name</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Title</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Department</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Extension</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Phone</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Email</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-sm font-medium">{e.name}</td>
                    <td className="py-3 px-4 text-sm text-slate-500">{e.title || '-'}</td>
                    <td className="py-3 px-4 text-sm text-slate-500">{e.department || '-'}</td>
                    <td className="py-3 px-4 text-sm">{e.extension || '-'}</td>
                    <td className="py-3 px-4 text-sm">{e.phoneNumber || '-'}</td>
                    <td className="py-3 px-4 text-sm text-slate-500">{e.email || '-'}</td>
                    <td className="py-3 px-4">
                      <Button size="sm" variant="ghost" onClick={() => deleteEntry(e.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
