'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Database, Plus, Trash2, Loader2, Eye, EyeOff, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { listDatasources, createDatasource, deleteDatasource, getSchema } from '@/lib/api';
import toast from 'react-hot-toast';

export default function DatabasePage() {
  const qc = useQueryClient();
  const { data: dss, isLoading } = useQuery({ queryKey: ['datasources'], queryFn: listDatasources });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:'',host:'localhost',port:5432,database:'',username:'',password:'' });
  const [expanded, setExpanded] = useState<string|null>(null);
  const [schema, setSchema] = useState<any>(null);
  const [testResults, setTestResults] = useState<Record<string,{status:string;message:string}>>({});

  const createMut = useMutation({ mutationFn: createDatasource, onSuccess:()=>{qc.invalidateQueries({queryKey:['datasources']});setShowForm(false);toast.success('Connected!');}, onError:(e:Error)=>toast.error(e.message) });
  const delMut = useMutation({ mutationFn: deleteDatasource, onSuccess:()=>{qc.invalidateQueries({queryKey:['datasources']});toast.success('Removed');}, onError:(e:Error)=>toast.error(e.message) });

  const viewSchema = async (id:string) => {
    if(expanded===id) { setExpanded(null); return; }
    try { setSchema(await getSchema(id)); setExpanded(id); } catch(e:any) { toast.error(e.message); }
  };

  const testConn = async (id:string) => {
    try {
      const r = await fetch(`http://localhost:8000/datasources/${id}/test`, { method:'POST' }).then(r=>r.json());
      setTestResults(p=>({...p,[id]:r}));
      toast.success(r.status==='ok'?'Connected':'Failed: '+r.message);
    } catch(e:any) { toast.error(e.message); }
  };

  return <div className="animate-fade-in space-y-6">
    <div className="flex items-center justify-between"><div><h1 className="text-3xl font-bold">Database</h1><p className="mt-1 text-muted">Manage your database connections.</p></div><button onClick={()=>setShowForm(!showForm)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"><Plus className="h-4 w-4"/> Connect Database</button></div>

    {showForm && <div className="rounded-xl border bg-surface p-6 space-y-4">
      <h2 className="text-lg font-semibold">New Connection</h2>
      <div className="grid grid-cols-2 gap-4">
        {[{k:'name',p:'Name'},{k:'host',p:'Host'},{k:'port',p:'Port',t:'number'},{k:'database',p:'Database'},{k:'username',p:'Username'},{k:'password',p:'Password',tp:'password'}].map(f=>
          <div key={f.k}><label className="block text-sm font-medium mb-1">{f.p}</label>
            <input type={f.tp||'text'} value={(form as any)[f.k]} onChange={e=>setForm({...form,[f.k]:f.t==='number'?parseInt(e.target.value):e.target.value})} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
          </div>
        )}
      </div>
      <div className="flex gap-3"><button onClick={()=>createMut.mutate(form)} disabled={createMut.isPending||!form.name} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{createMut.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:'Connect'}</button><button onClick={()=>setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button></div>
    </div>}

    {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted"/></div>
    : dss && dss.length > 0 ? <div className="space-y-3">{dss.map((ds:any)=><div key={ds.id} className="rounded-xl border bg-surface overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50"><Database className="h-5 w-5 text-green-600"/></div><div><p className="font-medium">{ds.name}</p><p className="text-xs text-muted">{ds.host}:{ds.port}/{ds.database}</p></div>
          {testResults[ds.id] && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${testResults[ds.id].status==='ok'?'bg-green-50 text-green-700':'bg-red-50 text-red-700'}`}>{testResults[ds.id].status==='ok'?<CheckCircle className="h-3 w-3"/>:<XCircle className="h-3 w-3"/>}{testResults[ds.id].status==='ok'?'Connected':'Failed'}</span>}
        </div>
        <div className="flex gap-2">
          <button onClick={()=>testConn(ds.id)} className="rounded-lg p-2 text-muted hover:bg-surface-hover"><RefreshCw className="h-4 w-4"/></button>
          <button onClick={()=>viewSchema(ds.id)} className="rounded-lg p-2 text-muted hover:bg-surface-hover">{expanded===ds.id?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}</button>
          <button onClick={()=>{if(confirm('Delete?'))delMut.mutate(ds.id)}} className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4"/></button>
        </div>
      </div>
      {expanded===ds.id && schema && <div className="border-t bg-background p-4 space-y-3">{schema.tables?.map((t:any)=><div key={t.name} className="rounded-lg border p-3"><p className="text-sm font-medium">{t.name} <span className="text-xs text-muted">({t.columns?.length} cols)</span></p><div className="mt-2 grid grid-cols-2 gap-1">{t.columns?.map((c:any)=><div key={c.name} className="flex items-center gap-2 text-xs"><code className="text-primary">{c.name}</code><span className="text-muted">{c.type}</span></div>)}</div></div>)}</div>}
    </div>)}</div>
    : <div className="rounded-xl border border-dashed bg-surface p-12 text-center"><Database className="mx-auto h-12 w-12 text-muted"/><p className="mt-4 text-lg font-medium">No databases connected</p><p className="mt-1 text-sm text-muted">Connect a database to start asking questions.</p><button onClick={()=>setShowForm(true)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"><Plus className="h-4 w-4"/> Connect Database</button></div>}
  </div>;
}
