'use client';
import { useMemo, useRef, useCallback } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, ScatterChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
echarts.use([BarChart, LineChart, PieChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const C = ['#2563EB','#7C3AED','#DB2777','#EA580C','#16A34A','#0891B2','#4F46E5','#BE185D','#B45309','#15803D','#0E7490','#6D28D9','#E11D48','#D97706','#059669','#0284C7'];
const fmt = (n:number)=>Math.abs(n)>=1e9?(n/1e9).toFixed(1)+'B':Math.abs(n)>=1e6?(n/1e6).toFixed(1)+'M':Math.abs(n)>=1e3?(n/1e3).toFixed(1)+'K':n.toLocaleString();
const ttip = { backgroundColor:'#1E293B',borderColor:'#334155',textStyle:{color:'#F1F5F9',fontSize:13} };
const grid = { left:'3%',right:'4%',bottom:'10%',top:'10%',containLabel:true };
const xa = (cats:string[])=>({type:'category',data:cats,axisLabel:{color:'#64748B',fontSize:11,rotate:cats.length>12?35:0,interval:cats.length>30?Math.floor(cats.length/15):0},axisTick:{show:false},axisLine:{lineStyle:{color:'#E2E8F0'}}});
const ya = {type:'value',axisLabel:{color:'#64748B',fontSize:11,formatter:(v:number)=>fmt(v)},splitLine:{lineStyle:{color:'#E2E8F0',type:'dashed'}}};

interface Props { type: string; columns: string[]; rows: any[][]; onChartReady?: (fn:()=>Promise<string|null>)=>void; }

function detect(columns:string[],rows:any[][]){
  const ni:number[]=[]; columns.forEach((_,i)=>{if(rows.some(r=>{const v=r[i];return v!==null&&v!==undefined&&!isNaN(Number(v))&&typeof v!=='boolean';}))ni.push(i);});
  return {catIdx:0,metricIdx:ni.filter(i=>i!==0).length>0?ni.filter(i=>i!==0):ni.length>1?[ni[ni.length-1]]:ni};
}

export function ChartViewer({type,columns,rows,onChartReady}:Props){
  const ref = useRef<any>(null);
  const getImg = useCallback(async()=>{const i=ref.current?.getEchartsInstance?.();return i?i.getDataURL({type:'png',pixelRatio:2,backgroundColor:'#fff'}):null;},[]);
  useMemo(()=>{onChartReady?.(getImg);},[onChartReady,getImg]);
  const {catIdx,metricIdx}=useMemo(()=>detect(columns,rows),[columns,rows]);
  const catCol=columns[catIdx]||columns[0]; const mCols=metricIdx.map(i=>columns[i]); const pm=mCols[0]||columns[columns.length-1]||columns[0];
  const cats=useMemo(()=>rows.map(r=>String(r[catIdx]??'')),[rows,catIdx]);
  const h=Math.max(350,Math.min(500,rows.length*30));

  if(type==='table')return <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead><tr className="bg-surface-hover">{columns.map(c=><th key={c} className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted">{c}</th>)}</tr></thead><tbody className="divide-y">{rows.map((r,i)=><tr key={i} className="hover:bg-surface-hover/50">{r.map((c,j)=><td key={j} className="px-4 py-2.5 text-sm">{c===null||c===undefined?<span className="text-muted italic text-xs">—</span>:<span className={typeof c==='number'?'font-mono tabular-nums':''}>{typeof c==='number'?c.toLocaleString():String(c)}</span>}</td>)}</tr>)}</tbody></table></div>;
  if(type==='bar'){const o={color:C,tooltip:{...ttip,trigger:'axis'},legend:{top:0,textStyle:{color:'#64748B',fontSize:12}},grid,xAxis:xa(cats),yAxis:ya,series:mCols.map((c,i)=>({name:c,type:'bar',data:rows.map(r=>{const v=r[columns.indexOf(c)];return v===null||v===undefined?null:Number(v)}),barMaxWidth:48,itemStyle:{borderRadius:[4,4,0,0]}}))};return <ReactEChartsCore ref={ref} echarts={echarts} option={o} style={{height:h}}/>;}
  if(type==='line'){const o={color:C,tooltip:{...ttip,trigger:'axis'},legend:{top:0,textStyle:{color:'#64748B',fontSize:12}},grid,xAxis:xa(cats),yAxis:ya,series:mCols.map((c,i)=>({name:c,type:'line',smooth:true,symbol:'circle',symbolSize:4,lineStyle:{width:2.5},data:rows.map(r=>{const v=r[columns.indexOf(c)];return v===null||v===undefined?null:Number(v)})}))};return <ReactEChartsCore ref={ref} echarts={echarts} option={o} style={{height:h}}/>;}
  if(type==='area'){const o={color:C,tooltip:{...ttip,trigger:'axis'},legend:{top:0,textStyle:{color:'#64748B',fontSize:12}},grid,xAxis:xa(cats),yAxis:ya,series:mCols.map((c,i)=>({name:c,type:'line',smooth:true,symbol:'none',lineStyle:{width:2},areaStyle:{opacity:0.12},data:rows.map(r=>{const v=r[columns.indexOf(c)];return v===null||v===undefined?null:Number(v)})}))};return <ReactEChartsCore ref={ref} echarts={echarts} option={o} style={{height:h}}/>;}
  if(type==='pie'){const d=rows.map(r=>({name:String(r[catIdx]??''),value:Number(r[columns.indexOf(pm)])||0}));const o={color:C,tooltip:{...ttip,trigger:'item'},legend:{top:'bottom',textStyle:{color:'#64748B',fontSize:11},type:'scroll'},series:[{name:pm,type:'pie',radius:['40%','70%'],center:['50%','45%'],itemStyle:{borderRadius:4,borderColor:'#fff',borderWidth:2},label:{show:true,formatter:'{b}: {d}%',fontSize:11},data:d}]};return <ReactEChartsCore ref={ref} echarts={echarts} option={o} style={{height:420}}/>;}
  if(type==='scatter'){const d=rows.map(r=>[Number(r[catIdx]),Number(r[columns.indexOf(pm)])]).filter(p=>!isNaN(p[0])&&!isNaN(p[1]));const o={color:C,tooltip:{...ttip,trigger:'item',formatter:(p:any)=>`${catCol}: ${p.value[0]}<br/>${pm}: ${p.value[1].toLocaleString()}`},legend:{top:0},grid,xAxis:{type:'value',name:catCol,nameTextStyle:{color:'#64748B'},axisLabel:{color:'#64748B',fontSize:11},splitLine:{lineStyle:{color:'#E2E8F0',type:'dashed'}}},yAxis:{type:'value',name:pm,nameTextStyle:{color:'#64748B'},axisLabel:{color:'#64748B',fontSize:11,formatter:(v:number)=>fmt(v)},splitLine:{lineStyle:{color:'#E2E8F0',type:'dashed'}}},series:[{name:`${catCol} vs ${pm}`,type:'scatter',data:d,symbolSize:10}]};return <ReactEChartsCore ref={ref} echarts={echarts} option={o} style={{height:400}}/>;}
  return null;
}
