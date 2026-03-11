'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Phone, Plus, Trash2, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Receptionist {
  id: string;
  name: string;
  status: string;
}

interface PhoneNumberConfig {
  id: string;
  number: string;
  provider: string;
  status: string;
  receptionistId: string | null;
  receptionist: Receptionist | null;
  _count: { calls: number; smsMessages: number };
  createdAt: string;
}

export default function PhoneNumbersPanel({ tenantId }: { tenantId: string }) {
  const [numbers, setNumbers] = useState<PhoneNumberConfig[]>([]);
  const [receptionists, setReceptionists] = useState<Receptionist[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Custom Registration Dialog
  const [showAdd, setShowAdd] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newNumber, setNewNumber] = useState('');
  const [selectedReceptionistId, setSelectedReceptionistId] = useState<string | 'none'>('none');

  const loadData = () => {
    setLoading(true);
    
    Promise.all([
      fetch('/api/v1/phone-numbers').then(r => r.json()),
      fetch('/api/v1/receptionists').then(r => r.json())
    ]).then(([numbersRes, recRes]) => {
      if (numbersRes.success) setNumbers(numbersRes.data);
      if (recRes.success) setReceptionists(recRes.data);
    })
    .catch(() => toast.error('Error loading data'))
    .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [tenantId]);

  const handleRegisterManual = async () => {
    if (!newNumber.trim()) { toast.error('Please enter a phone number'); return; }
    
    setIsAdding(true);
    try {
        const res = await fetch('/api/v1/internal-numbers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                number: newNumber,
                receptionistId: selectedReceptionistId === 'none' ? undefined : selectedReceptionistId
            })
        });
        const data = await res.json();
        if (data.success) {
            toast.success('Phone number registered successfully');
            setShowAdd(false);
            setNewNumber('');
            setSelectedReceptionistId('none');
            loadData();
        } else {
            toast.error(data.error || 'Failed to register number');
        }
    } catch {
        toast.error('Network error');
    } finally {
        setIsAdding(false);
    }
  };

  const handleUpdateAssignment = async (id: string, receptionistId: string) => {
    const val = receptionistId === 'none' ? null : receptionistId;
    try {
        const res = await fetch('/api/v1/phone-numbers', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, receptionistId: val })
        });
        const data = await res.json();
        if (data.success) {
            toast.success('Assignment updated');
            loadData();
        } else {
            toast.error(data.error || 'Failed to update assignment');
        }
    } catch {
        toast.error('Network error');
    }
  };

  const handleDelete = async (id: string, provider: string) => {
    if (!confirm('Are you sure you want to delete this phone number? If it belongs to Twilio, you should also release it in the Twilio console to stop billing.')) return;
    try {
        const res = await fetch(`/api/v1/phone-numbers?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
            toast.success('Phone number released');
            loadData();
        } else {
            const data = await res.json().catch(()=>({}));
            toast.error(data.error || 'Failed to release number');
        }
    } catch {
        toast.error('Network error');
    }
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Phone Numbers</h1>
          <p className="text-slate-500 mt-1">Manage your connected Twilio numbers and link them to Receptionists.</p>
        </div>

        <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-emerald-500 to-teal-600">
                    <Plus className="w-4 h-4 mr-2" /> Add Number Manually
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Register Existing Number</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <p className="text-sm text-slate-500">
                        Bind an existing Twilio or WhatsApp number to your account so it can route messages to an AI Receptionist.
                    </p>
                    <div className="space-y-2">
                        <Label>Phone Number (with country code)</Label>
                        <Input value={newNumber} onChange={e => setNewNumber(e.target.value)} placeholder="+14155238886" />
                    </div>
                    <div className="space-y-2">
                        <Label>Assign Receptionist</Label>
                        <Select value={selectedReceptionistId} onValueChange={setSelectedReceptionistId}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Unassigned</SelectItem>
                                {receptionists.filter(r => r.status !== 'ARCHIVED').map(r => (
                                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button className="w-full" onClick={handleRegisterManual} disabled={isAdding}>
                        {isAdding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save Number
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
      </div>

      {numbers.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="py-16 text-center">
            <Phone className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold">No Phone Numbers</h3>
            <p className="text-slate-500 mt-2">You haven't added any phone numbers yet.</p>
          </CardContent>
        </Card>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {numbers.map(num => (
                  <Card key={num.id} className="border-0 shadow-lg">
                      <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                                      <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                  </div>
                                  <div>
                                       <CardTitle className="text-lg tracking-wide">{num.number}</CardTitle>
                                       <CardDescription className="uppercase text-xs font-semibold">{num.provider}</CardDescription>
                                  </div>
                              </div>
                              <Badge variant={num.status === 'ACTIVE' ? 'default' : 'secondary'}>{num.status}</Badge>
                          </div>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-4">
                          <div className="flex items-center justify-between">
                               <div className="text-sm font-medium">Assigned AI:</div>
                               <Select value={num.receptionistId || 'none'} onValueChange={val => handleUpdateAssignment(num.id, val)}>
                                   <SelectTrigger className="w-[180px] h-8 text-xs">
                                       <SelectValue placeholder="Unassigned" />
                                   </SelectTrigger>
                                   <SelectContent>
                                       <SelectItem value="none">Unassigned</SelectItem>
                                       {receptionists.map(r => (
                                           <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                       ))}
                                   </SelectContent>
                               </Select>
                          </div>
                          
                          <div className="bg-slate-50 dark:bg-slate-900 rounded p-3 flex justify-between items-center text-sm">
                              <div><span className="text-slate-500">Calls Linked:</span> <span className="font-semibold">{num._count.calls}</span></div>
                              <div><span className="text-slate-500">Texts Linked:</span> <span className="font-semibold">{num._count.smsMessages}</span></div>
                          </div>

                          <div className="pt-2 flex justify-end">
                              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(num.id, num.provider)}>
                                  <Trash2 className="w-4 h-4 mr-2" /> Release
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
