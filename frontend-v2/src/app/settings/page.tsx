'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Settings, Palette, Sparkles, Save, RotateCcw, Loader2, Shield } from 'lucide-react';
import { getTheme, updateTheme, listAIProviders } from '@/lib/api';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data: theme, isLoading } = useQuery({ queryKey: ['theme'], queryFn: getTheme });
  const { data: providers } = useQuery({ queryKey: ['ai-providers'], queryFn: listAIProviders });
  const [tab, setTab] = useState<'appearance'|'ai'>('appearance');
  const [local, setLocal] = useState<any>(null);
  const t = local || theme;

  const saveMut = useMutation({ mutationFn: updateTheme, onSuccess:(d:any)=>{qc.invalidateQueries({queryKey:['theme']});setLocal(d.theme);toast.success('Theme saved');}, onError:(e:Error)=>toast.error(e.message) });
  const resetMut = useMutation({ mutationFn: ()=>updateTheme({}), onSuccess:()=>{qc.invalidateQueries({queryKey:['theme']});setLocal(null);toast.success('Reset');}, onError:(e:Error)=>toast.error(e.message) });

  const setColor = (k:string,v:string)=>{const u={...t};const parts=k.split('.');if(parts.length===2){u[parts[0]]={...u[parts[0]],[parts[1]]:v};}else{u[k]=v;}setLocal(u);};

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted"/></div>;

  return <div className="animate-fade-in space-y-6">
    <div><h1 className="text-3xl font-bold">Settings</h1><p className="mt-1 text-muted">Customize your BI experience.</p></div>

    <div className="flex gap-1 rounded-lg border bg-surface p-1 w-fit">
      {[{id:'appearance',l:'Appearance',i:Palette},{id:'ai',l:'AI Providers',i:Sparkles}].map(x=>
        <button key={x.id} onClick={()=>setTab(x.id as any)} className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium ${tab===x.id?'bg-primary text-white':'text-muted hover:text-foreground'}`}><x.i className="h-4 w-4"/>{x.l}</button>
      )}
    </div>

    {tab==='appearance' && t && <div className="space-y-6">
      <div className="rounded-xl border bg-surface p-6"><h2 className="text-lg font-semibold mb-4">Branding</h2>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium mb-1">Company Name</label><input value={t.branding?.companyName||''} onChange={e=>setColor('branding.companyName',e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm"/></div>
          <div><label className="block text-sm font-medium mb-1">Tagline</label><input value={t.branding?.tagline||''} onChange={e=>setColor('branding.tagline',e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm"/></div>
        </div>
      </div>
      <div className="rounded-xl border bg-surface p-6"><h2 className="text-lg font-semibold mb-4">Colors</h2>
        <div className="grid grid-cols-3 gap-4">
          {['primary','secondary','accent','background','surface','text','border','success','warning','error','info'].map(k=>
            <div key={k}><label className="block text-xs font-medium mb-1 capitalize">{k}</label><div className="flex items-center gap-2"><input type="color" value={t.colors?.[k]||'#000'} onChange={e=>setColor(`colors.${k}`,e.target.value)} className="h-8 w-8 rounded border cursor-pointer"/><input value={t.colors?.[k]||''} onChange={e=>setColor(`colors.${k}`,e.target.value)} className="flex-1 rounded border bg-background px-2 py-1 text-xs font-mono"/></div></div>
          )}
        </div>
      </div>
      <div className="flex gap-3"><button onClick={()=>saveMut.mutate(t)} disabled={saveMut.isPending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><Save className="h-4 w-4"/> Save</button><button onClick={()=>resetMut.mutate(undefined as any)} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm"><RotateCcw className="h-4 w-4"/> Reset</button></div>
    </div>}

    {tab==='ai' && <div className="space-y-6">
      <div className="rounded-xl border bg-surface p-6"><h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-500"/> Supported AI Providers</h2>
        <div className="grid grid-cols-2 gap-3">{(providers||[]).map((p:any)=><div key={p.id} className="rounded-lg border p-4"><p className="font-semibold text-sm">{p.name}</p><p className="text-xs text-muted mt-1">Model: {p.default_model}</p><p className="text-xs text-muted">Env var: {p.id==='anthropic'?'ANTHROPIC_API_KEY':p.id==='deepseek'?'DEEPSEEK_API_KEY':p.id==='gemini'?'GEMINI_API_KEY':p.id==='openai'?'OPENAI_API_KEY':'API_KEY'}</p></div>)}</div>
      </div>
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950 flex items-start gap-3"><Shield className="h-5 w-5 text-green-600 mt-0.5"/><div><p className="text-sm font-semibold text-green-800 dark:text-green-200">Privacy Guaranteed</p><p className="text-xs text-green-700 dark:text-green-300 mt-1">AI models only receive column names and data types. No actual data values or rows are ever sent to external APIs. Use custom endpoints for complete data locality.</p></div></div>
    </div>}
  </div>;
}
