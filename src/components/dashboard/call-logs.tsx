'use client';

import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { Loader2, Play, Square } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface CallLog {
  id: string;
  callerNumber: string;
  dialedNumber: string;
  direction: string;
  status: string;
  duration: number | null;
  sentiment: string | null;
  intent: string | null;
  recordingUrl: string | null;
  startedAt: string;
  contact: { firstName: string; lastName: string } | null;
  receptionist: { name: string } | null;
  _count: { transcripts: number; transfers: number };
}

export default function CallLogsPanel({ tenantId }: { tenantId: string }) {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlayback = (callId: string, url: string) => {
    if (playingId === callId) {
      // Stop current playback
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
    } else {
      // Stop any existing playback
      audioRef.current?.pause();
      // Start new playback
      const audio = new Audio(url);
      audio.onended = () => {
        setPlayingId(null);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setPlayingId(null);
        audioRef.current = null;
      };
      audio.play().catch(() => setPlayingId(null));
      audioRef.current = audio;
      setPlayingId(callId);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/calls?page=${page}&limit=20`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setCalls(res.data);
          setTotal(res.meta?.total || 0);
        } else {
          toast.error('Failed to load call logs.');
        }
      })
      .catch(() => toast.error('Network error loading call logs.'))
      .finally(() => setLoading(false));
  }, [tenantId, page]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const filtered = calls.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.callerNumber.includes(s) ||
      c.contact?.firstName.toLowerCase().includes(s) ||
      c.contact?.lastName.toLowerCase().includes(s) ||
      c.intent?.toLowerCase().includes(s);
  });

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Call Logs</h1>
          <p className="text-slate-500 mt-1">{total} total calls</p>
        </div>
        <div className="w-64">
          <Input
            placeholder="Search calls..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10"
          />
        </div>
      </div>

      <Card className="border-0 shadow-lg">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Caller</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Direction</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Duration</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Intent</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Sentiment</th>
                   <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Agent</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Recording</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Time</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-500">No calls found</td>
                  </tr>
                )}
                {filtered.map((call) => (
                  <tr key={call.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {call.contact ? `${call.contact.firstName} ${call.contact.lastName}` : call.callerNumber}
                        </p>
                        {call.contact && <p className="text-xs text-slate-500">{call.callerNumber}</p>}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-xs">{call.direction.toLowerCase()}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={call.status === 'COMPLETED' ? 'default' : 'secondary'} className="text-xs">
                        {call.status.toLowerCase()}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm">{formatDuration(call.duration)}</td>
                    <td className="py-3 px-4">
                      {call.intent && <Badge variant="outline" className="text-xs">{call.intent}</Badge>}
                    </td>
                    <td className="py-3 px-4">
                      {call.sentiment && (
                        <Badge variant="outline" className={`text-xs ${
                          call.sentiment === 'POSITIVE' ? 'text-emerald-600 border-emerald-200' :
                          call.sentiment === 'NEGATIVE' ? 'text-red-600 border-red-200' : ''
                        }`}>{call.sentiment.toLowerCase()}</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-500">{call.receptionist?.name || '-'}</td>
                    <td className="py-3 px-4">
                      {call.recordingUrl ? (
                        <button
                          onClick={() => togglePlayback(call.id, call.recordingUrl!)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                          title={playingId === call.id ? 'Stop playback' : 'Play recording'}
                        >
                          {playingId === call.id ? (
                            <>
                              <Square className="w-3 h-3 fill-current" />
                              <span>Stop</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3 fill-current" />
                              <span>Play</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">{new Date(call.startedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {total > 20 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border rounded disabled:opacity-50">
            Previous
          </button>
          <span className="px-3 py-1 text-sm">Page {page} of {Math.ceil(total / 20)}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 20)} className="px-3 py-1 text-sm border rounded disabled:opacity-50">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
