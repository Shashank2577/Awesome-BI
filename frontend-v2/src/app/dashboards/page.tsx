'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { Plus, PieChart, Trash2, Loader2, Eye, BarChart3, LineChart, Table2, AreaChart, ScatterChart } from 'lucide-react';
import { listDashboards, createDashboard, deleteDashboard, listReports, addCardToDashboard, runReport, removeCard } from '@/lib/api';
import { ChartViewer } from '@/components/charts/chart-viewer';
import toast from 'react-hot-toast';

const vizIcons: any = { bar: BarChart3, line: LineChart, pie: PieChart, table: Table2, area: AreaChart, scatter: ScatterChart };

export default function DashboardsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [selectedDash, setSelectedDash] = useState<string | null>(null);
  const [addingCard, setAddingCard] = useState(false);

  const { data: dashboards, isLoading } = useQuery({ queryKey: ['dashboards'], queryFn: listDashboards });
  const { data: reports } = useQuery({ queryKey: ['reports'], queryFn: listReports });
  const { data: dashDetail, refetch: refetchDash } = useQuery({
    queryKey: ['dashboard', selectedDash],
    queryFn: () => import('@/lib/api').then(m => m.getDashboard(selectedDash!)),
    enabled: !!selectedDash,
  });

  const createMut = useMutation({ mutationFn: () => createDashboard(name, desc), onSuccess: () => { qc.invalidateQueries({ queryKey: ['dashboards'] }); setShowCreate(false); setName(''); setDesc(''); toast.success('Dashboard created'); } });
  const delMut = useMutation({ mutationFn: deleteDashboard, onSuccess: () => { qc.invalidateQueries({ queryKey: ['dashboards'] }); setSelectedDash(null); toast.success('Deleted'); } });

  const handleAddCard = async (reportId: string) => {
    if (!selectedDash) return;
    const cards = dashDetail?.cards || [];
    const row = Math.floor(cards.length / 2);
    const col = cards.length % 2;
    await addCardToDashboard(selectedDash, reportId, row, col);
    refetchDash();
    setAddingCard(false);
    toast.success('Card added');
  };

  return <div className="animate-fade-in space-y-6">
    <div className="flex items-center justify-between">
      <div><h1 className="text-3xl font-bold">Dashboards</h1><p className="mt-1 text-muted">Collections of charts and questions on a single page.</p></div>
      <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"><Plus className="h-4 w-4"/> New Dashboard</button>
    </div>

    {showCreate && <div className="rounded-xl border bg-surface p-6 space-y-4">
      <h2 className="text-lg font-semibold">Create Dashboard</h2>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Dashboard name" className="w-full rounded-lg border bg-background px-3 py-2 text-sm"/>
      <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description (optional)" className="w-full rounded-lg border bg-background px-3 py-2 text-sm"/>
      <div className="flex gap-3"><button onClick={()=>createMut.mutate()} disabled={!name||createMut.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{createMut.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:'Create'}</button><button onClick={()=>setShowCreate(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button></div>
    </div>}

    {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted"/></div>
    : dashboards && dashboards.length > 0 ? (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {dashboards.map((d: any) => (
            <div key={d.id} className={`rounded-xl border p-4 cursor-pointer transition-all ${selectedDash===d.id ? 'border-primary bg-primary/5 shadow-md' : 'bg-surface hover:shadow-sm'}`} onClick={()=>setSelectedDash(d.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><PieChart className="h-5 w-5 text-primary"/><div><p className="font-medium text-sm">{d.name}</p><p className="text-xs text-muted">{d.card_count || 0} cards</p></div></div>
                <button onClick={(e)=>{e.stopPropagation(); if(confirm('Delete?'))delMut.mutate(d.id);}} className="p-1 text-muted hover:text-red-600"><Trash2 className="h-4 w-4"/></button>
              </div>
            </div>
          ))}
        </div>

        {selectedDash && dashDetail && (
          <div className="rounded-xl border bg-surface p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div><h2 className="text-xl font-bold">{dashDetail.dashboard?.name}</h2><p className="text-sm text-muted">{dashDetail.dashboard?.description}</p></div>
              <div className="flex gap-2">
                <button onClick={()=>setAddingCard(!addingCard)} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-surface-hover"><Plus className="h-4 w-4 inline mr-1"/>Add Card</button>
                <button onClick={()=>setSelectedDash(null)} className="rounded-lg border px-3 py-1.5 text-sm text-muted">Close</button>
              </div>
            </div>

            {addingCard && <div className="mb-4 rounded-lg border bg-background p-4">
              <p className="text-sm font-medium mb-2">Select a question to add:</p>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {(reports||[]).map((r:any) => <button key={r.id} onClick={()=>handleAddCard(r.id)} className="text-left rounded-lg border p-3 hover:bg-surface-hover text-sm"><p className="font-medium">{r.name}</p><p className="text-xs text-muted">{r.visualization}</p></button>)}
              </div>
            </div>}

            {(dashDetail.cards||[]).length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {dashDetail.cards.map((card: any) => (
                  <DashboardCard key={card.id} card={card} dashId={selectedDash} onRemove={()=>{removeCard(selectedDash, card.id);refetchDash();toast.success('Card removed');}}/>
                ))}
              </div>
            ) : <div className="text-center py-8 text-muted text-sm">No cards yet. Click "Add Card" to add questions.</div>}
          </div>
        )}
      </div>
    ) : (
      <div className="rounded-xl border border-dashed bg-surface p-12 text-center">
        <PieChart className="mx-auto h-12 w-12 text-muted"/>
        <p className="mt-4 text-lg font-medium">No dashboards yet</p>
        <p className="mt-1 text-sm text-muted">Create a dashboard to group your questions and charts.</p>
        <button onClick={()=>setShowCreate(true)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"><Plus className="h-4 w-4"/> Create Dashboard</button>
      </div>
    )}
  </div>;
}

function DashboardCard({ card, dashId, onRemove }: { card: any; dashId: string; onRemove: () => void }) {
  const { data: report } = useQuery({ queryKey: ['report', card.report_id], queryFn: () => import('@/lib/api').then(m => m.getReport(card.report_id)) });
  const { data: result } = useQuery({ queryKey: ['result', card.report_id], queryFn: () => import('@/lib/api').then(m => m.runReport(card.report_id)), enabled: !!card.report_id });

  return <div className="rounded-lg border bg-background p-3 min-h-[250px] relative group">
    <div className="flex items-center justify-between mb-2">
      <Link href={`/questions/${card.report_id}`} className="text-sm font-medium hover:text-primary">{report?.name || card.report_id}</Link>
      <button onClick={onRemove} className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-red-600 transition-opacity"><Trash2 className="h-3.5 w-3.5"/></button>
    </div>
    {result?.rows?.length > 0 ? <ChartViewer type={report?.visualization || 'table'} columns={result.columns} rows={result.rows.slice(0, 20)}/> : <div className="flex items-center justify-center h-40 text-muted text-sm"><Loader2 className="h-5 w-5 animate-spin"/></div>}
  </div>;
}
