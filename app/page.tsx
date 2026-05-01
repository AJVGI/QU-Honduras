'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { GradeBadge } from '@/components/GradeBadge';
import { Grade } from '@/lib/types';

const REFRESH_INTERVAL = 30;

/* ── Types ──────────────────────────────────────────────────────── */
interface LiveAgentRow {
  id: string; name: string; status: 'active' | 'idle' | 'offline';
  statusLabel: string; chatsToday: number; openChats: number;
  lastSeenMs: number; lastSeenAgo: string;
}
interface LiveStatus {
  ok: boolean; agents: LiveAgentRow[];
  summary: { chatsToday:number; activeAgents:number; idleAgents:number; offlineAgents:number };
}
interface QAAgent {
  id:string; name:string; avg_score:number; grade:Grade;
  frt:number|null; closure_rate:number; tickets:number;
}
interface TicketAlert {
  id:string; auto_fail:boolean; has_recall:boolean;
  frt_seconds:number|null; is_closed:boolean; category:string;
}

/* ── Brand colors (match guidelines exactly) ────────────────────── */
const C = {
  pink:   '#E91E8C',
  rose:   '#C2185B',
  gold:   '#FFD600',
  purple: '#2D1B4E',
  promo:  '#7B2D8B',
  green:  '#00C882',
  red:    '#FF4444',
  navy:   '#0D0D1A',
  mid:    '#1A1A2E',
  white:  '#FFFFFF',
};

const GRADE_COLOR: Record<Grade,string> = {
  A: C.green, B: C.pink, C: C.gold, D:'#f97316', F: C.red, 'N/A':'#64748b',
};

/* ── Sub-components ─────────────────────────────────────────────── */

function KpiCard({ label, value, sub, icon, accent, glow }: {
  label:string; value:string|number; sub?:string; icon:string; accent:string; glow:string;
}) {
  return (
    <div className={`jd-card ${glow} flex items-center gap-4`}
      style={{ padding:'clamp(14px,1.8vw,24px)' }}>
      <div className="rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          width:'clamp(40px,4vw,52px)', height:'clamp(40px,4vw,52px)',
          fontSize:'clamp(18px,2vw,26px)',
          background:`${accent}18`, border:`1px solid ${accent}30`,
        }}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div style={{ color:'var(--text-muted)', fontSize:'var(--text-xs)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>
          {label}
        </div>
        <div style={{ color: accent, fontSize:'var(--text-2xl)', fontWeight:900, lineHeight:1 }}>
          {value}
        </div>
        {sub && <div style={{ color:'var(--text-muted)', fontSize:'var(--text-xs)', marginTop:3 }}>{sub}</div>}
      </div>
    </div>
  );
}

function CardHeader({ title, sub }: { title:string; sub?:string }) {
  return (
    <div style={{ padding:'clamp(12px,1.4vw,20px) clamp(16px,1.8vw,24px)', borderBottom:'1px solid var(--border-default)' }}>
      <div style={{ color:'var(--text-primary)', fontSize:'var(--text-sm)', fontWeight:600 }}>{title}</div>
      {sub && <div style={{ color:'var(--text-muted)', fontSize:'var(--text-xs)', marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function AlertRow({ icon, label, value, accent }: { icon:string; label:string; value:number; accent:string }) {
  return (
    <div className="flex items-center justify-between rounded-lg"
      style={{ padding:'clamp(10px,1.2vw,16px) clamp(12px,1.4vw,18px)', background:`${accent}10`, border:`1px solid ${accent}22` }}>
      <span style={{ color:`${accent}cc`, fontSize:'var(--text-sm)', fontWeight:500 }}>{icon} {label}</span>
      <span style={{ color: accent, fontSize:'var(--text-xl)', fontWeight:900 }}>{value}</span>
    </div>
  );
}

const STATUS_PILL: Record<string,{bg:string;color:string;border:string}> = {
  active:  { bg:'rgba(0,200,130,0.12)', color:'#00C882', border:'rgba(0,200,130,0.28)' },
  idle:    { bg:'rgba(255,214,0,0.12)', color:'#FFD600', border:'rgba(255,214,0,0.28)' },
  offline: { bg:'rgba(100,116,139,0.12)', color:'#94a3b8', border:'rgba(100,116,139,0.22)' },
};

/* ── Page ───────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const [liveData,   setLiveData]   = useState<LiveStatus|null>(null);
  const [qaAgents,   setQaAgents]   = useState<QAAgent[]>([]);
  const [tickets,    setTickets]    = useState<TicketAlert[]>([]);
  const [countdown,  setCountdown]  = useState(REFRESH_INTERVAL);
  const [loading,    setLoading]    = useState(true);

  const fetchLive = useCallback(async () => {
    try { const r=await fetch('/api/live-status'); const j=await r.json(); if(j.ok) setLiveData(j); } catch {}
  },[]);

  const fetchQA = useCallback(async () => {
    try {
      const r=await fetch('/api/data/agents'); const j=await r.json();
      setQaAgents((j.agents||[]).map((a:Record<string,unknown>)=>{
        const cp=Number(a.closure_pct)||0;
        const grade:Grade=cp>=90?'A':cp>=75?'B':cp>=60?'C':cp>=45?'D':'F';
        return { id:String(a.id||a.agent_name||''), name:String(a.agent_name||''),
          avg_score:cp, grade, frt:a.avg_frt_seconds!=null?Number(a.avg_frt_seconds):null,
          closure_rate:cp, tickets:Number(a.tickets)||0 };
      }));
    } catch {}
  },[]);

  const fetchTickets = useCallback(async () => {
    try {
      const r=await fetch('/api/data/tickets?limit=2000'); const j=await r.json();
      setTickets((j.tickets||[]).map((t:Record<string,unknown>)=>({
        id:String(t.id||''), auto_fail:Boolean(t.auto_fail), has_recall:Boolean(t.has_recall),
        frt_seconds:t.frt_seconds!=null?Number(t.frt_seconds):null,
        is_closed:Boolean(t.is_closed), category:String(t.category||'Other'),
      })));
    } catch {}
  },[]);

  useEffect(() => {
    Promise.all([fetchLive(),fetchQA(),fetchTickets()]).then(()=>setLoading(false));
  },[fetchLive,fetchQA,fetchTickets]);

  useEffect(()=>{ const t=setInterval(fetchLive,REFRESH_INTERVAL*1000); return()=>clearInterval(t); },[fetchLive]);
  useEffect(()=>{ const t=setInterval(()=>setCountdown(c=>c<=1?REFRESH_INTERVAL:c-1),1000); return()=>clearInterval(t); },[]);

  const topAgents    = useMemo(()=>[...qaAgents].sort((a,b)=>b.closure_rate-a.closure_rate).slice(0,5),[qaAgents]);
  const bottomAgents = useMemo(()=>{
    const ord:Record<string,number>={F:0,D:1,C:2,B:3,A:4};
    return [...qaAgents].filter(a=>a.tickets>=5)
      .sort((a,b)=>(ord[a.grade]??4)-(ord[b.grade]??4)||a.closure_rate-b.closure_rate).slice(0,3);
  },[qaAgents]);

  const teamKpis = useMemo(()=>{
    if(!qaAgents.length) return {avgFrt:0,avgClosure:0};
    return {
      avgFrt:   Math.round(qaAgents.reduce((s,a)=>s+(a.frt||0),0)/qaAgents.length),
      avgClosure:Math.round(qaAgents.reduce((s,a)=>s+a.closure_rate,0)/qaAgents.length),
    };
  },[qaAgents]);

  const gradeDist = useMemo(()=>{
    const d:Record<Grade,number>={A:0,B:0,C:0,D:0,F:0,'N/A':0};
    qaAgents.forEach(a=>{if(a.grade in d) d[a.grade]++;});
    return d;
  },[qaAgents]);

  const alerts = useMemo(()=>({
    autoFails:  tickets.filter(t=>t.auto_fail).length,
    recalls:    tickets.filter(t=>t.has_recall).length,
    slowFrt:    tickets.filter(t=>(t.frt_seconds||0)>300).length,
    unresolved: tickets.filter(t=>!t.is_closed).length,
  }),[tickets]);

  const categories = useMemo(()=>{
    const m=new Map<string,number>();
    tickets.forEach(t=>m.set(t.category,(m.get(t.category)||0)+1));
    const total=tickets.length;
    return Array.from(m.entries())
      .map(([name,count])=>({name,count,pct:total>0?Math.round(count/total*100):0}))
      .sort((a,b)=>b.count-a.count).slice(0,7);
  },[tickets]);

  const trendData = useMemo(()=>
    qaAgents.length?[{day:'Current',avg:Math.round(teamKpis.avgClosure)}]:[]
  ,[qaAgents,teamKpis]);

  const matchQA = (name:string)=>{
    const n=name.toLowerCase().trim();
    return qaAgents.find(a=>a.name.toLowerCase().trim()===n)||
           qaAgents.find(a=>a.name.toLowerCase().split(' ')[0]===n.split(' ')[0]);
  };

  const sortedAgents=[...(liveData?.agents||[])].sort((a,b)=>{
    const o={active:0,idle:1,offline:2}; return o[a.status]-o[b.status];
  });

  if(loading) return (
    <div className="flex items-center justify-center" style={{minHeight:'60vh'}}>
      <div className="text-center" style={{gap:12,display:'flex',flexDirection:'column',alignItems:'center'}}>
        <div style={{width:32,height:32,border:`2px solid ${C.pink}`,borderTopColor:'transparent',borderRadius:'50%'}} className="animate-spin"/>
        <p style={{color:'var(--text-muted)',fontSize:'var(--text-sm)'}}>Loading dashboard…</p>
      </div>
    </div>
  );

  return (
    <div className="jd-main-content" style={{padding:'clamp(16px,2vw,32px)',display:'flex',flexDirection:'column',gap:'clamp(16px,2vw,28px)'}}>

      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap" style={{gap:'clamp(8px,1vw,16px)'}}>
        <div>
          <h1 className="font-display" style={{color:C.white,fontSize:'var(--text-2xl)',fontWeight:900,letterSpacing:'-0.02em',lineHeight:1.1}}>
            Dashboard
          </h1>
          <p style={{color:'var(--text-muted)',fontSize:'var(--text-sm)',marginTop:4}}>
            Honduras Agents · JackpotDaily QA
            <span className="glow-live" style={{marginLeft:8,color:C.green}}>● LIVE</span>
          </p>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{color:'var(--text-muted)',fontSize:'var(--text-xs)'}}>
            Refresh in <span style={{color:'var(--text-secondary)',fontFamily:'monospace'}}>{countdown}s</span>
          </div>
          <div style={{color:'var(--text-muted)',fontSize:'var(--text-xs)',marginTop:2}}>
            {new Date().toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})} ET
          </div>
        </div>
      </div>

      {/* ── KPI strip ────────────────────────────────────────────── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(clamp(160px,20vw,260px),1fr))',gap:'clamp(10px,1.4vw,20px)'}}>
        <KpiCard label="Active Now"  value={liveData?.summary.activeAgents??0} sub="handling chats"      icon="🟢" accent={C.green} glow="glow-green"/>
        <KpiCard label="Idle"        value={liveData?.summary.idleAgents??0}   sub="15 – 120 min"        icon="🟡" accent={C.gold}  glow="glow-gold"/>
        <KpiCard label="This Week"   value={qaAgents.reduce((s,a)=>s+a.tickets,0).toLocaleString()} sub="total tickets" icon="💬" accent={C.pink} glow="glow-pink"/>
        <KpiCard label="QA Agents"   value={qaAgents.length}                   sub="with data this week" icon="📊" accent={C.promo} glow="glow-promo"/>
      </div>

      {/* ── Body: Left | Mid | Right ─────────────────────────────── */}
      {/* Fluid grid: 3 cols on desktop, stacks on mobile */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',gap:'clamp(12px,1.5vw,22px)',alignItems:'start'}}>

        {/* ── LEFT: Live Agent Status ───── flex-grow dominates */}
        <div className="jd-card glow-panel" style={{gridColumn:'span 2 / span 2',minWidth:0}}>
          <CardHeader title="Live Agent Status" sub="Real-time from WellyTalk · refreshes every 30s"/>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'var(--text-sm)'}}>
              <thead>
                <tr style={{background:'rgba(45,27,78,0.45)'}}>
                  {['Agent','Status','Last Active','Chats','Open'].map(h=>(
                    <th key={h} style={{textAlign:'left',padding:'clamp(8px,1vw,14px) clamp(12px,1.4vw,20px)',color:'var(--text-muted)',fontSize:'var(--text-xs)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedAgents.map((agent,i)=>{
                  const qa=matchQA(agent.name);
                  const pill=STATUS_PILL[agent.status];
                  return(
                    <tr key={agent.id} style={{borderTop:'1px solid var(--border-default)',background:i%2===0?'transparent':'rgba(255,255,255,0.015)',transition:'background 0.15s'}}
                      onMouseEnter={e=>(e.currentTarget.style.background='var(--surface-hover)')}
                      onMouseLeave={e=>(e.currentTarget.style.background=i%2===0?'transparent':'rgba(255,255,255,0.015)')}>
                      <td style={{padding:'clamp(8px,1vw,14px) clamp(12px,1.4vw,20px)',fontWeight:600,color:'var(--text-primary)',whiteSpace:'nowrap'}}>
                        {qa
                          ? <Link href={`/all-chats?agent=${encodeURIComponent(qa.name)}`} style={{color:'var(--text-primary)',textDecoration:'none',transition:'color 0.15s'}}
                              onMouseEnter={e=>(e.currentTarget.style.color=C.pink)}
                              onMouseLeave={e=>(e.currentTarget.style.color='var(--text-primary)')}>{agent.name}</Link>
                          : agent.name}
                      </td>
                      <td style={{padding:'clamp(8px,1vw,14px) clamp(12px,1.4vw,20px)'}}>
                        <span style={{background:pill.bg,color:pill.color,border:`1px solid ${pill.border}`,padding:'3px 10px',borderRadius:20,fontSize:'var(--text-xs)',fontWeight:600,whiteSpace:'nowrap'}}>
                          {agent.statusLabel}
                        </span>
                      </td>
                      <td style={{padding:'clamp(8px,1vw,14px) clamp(12px,1.4vw,20px)',color:'var(--text-secondary)',whiteSpace:'nowrap'}}>{agent.lastSeenAgo}</td>
                      <td style={{padding:'clamp(8px,1vw,14px) clamp(12px,1.4vw,20px)',fontWeight:700,color:'var(--text-primary)'}}>{agent.chatsToday}</td>
                      <td style={{padding:'clamp(8px,1vw,14px) clamp(12px,1.4vw,20px)'}}>
                        {agent.openChats>0
                          ? <span style={{fontWeight:700,color:C.green}}>{agent.openChats}</span>
                          : <span style={{color:'var(--text-muted)'}}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── MIDDLE: KPIs + Grades + Performers ───── */}
        <div style={{display:'flex',flexDirection:'column',gap:'clamp(10px,1.3vw,18px)',minWidth:0}}>

          {/* Team KPIs + grade pills combined */}
          <div className="jd-card glow-panel">
            <CardHeader title="Team KPIs"/>
            <div style={{padding:'clamp(12px,1.5vw,20px)',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'clamp(8px,1vw,16px)'}}>
              <div>
                <div style={{color:'var(--text-muted)',fontSize:'var(--text-xs)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>Avg Closure</div>
                <div style={{color:C.white,fontSize:'var(--text-3xl)',fontWeight:900,lineHeight:1}}>{teamKpis.avgClosure}<span style={{fontSize:'var(--text-lg)'}}>%</span></div>
              </div>
              <div>
                <div style={{color:'var(--text-muted)',fontSize:'var(--text-xs)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>Avg FRT</div>
                <div style={{color:'var(--text-secondary)',fontSize:'var(--text-3xl)',fontWeight:900,lineHeight:1}}>{teamKpis.avgFrt}<span style={{fontSize:'var(--text-lg)'}}>s</span></div>
              </div>
            </div>
            <div style={{padding:'0 clamp(12px,1.5vw,20px) clamp(12px,1.5vw,20px)'}}>
              <div style={{color:'var(--text-muted)',fontSize:'var(--text-xs)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Grade Distribution</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {(Object.entries(gradeDist) as [Grade,number][]).filter(([,v])=>v>0).map(([g,c])=>(
                  <div key={g} style={{background:`${GRADE_COLOR[g]}18`,border:`1px solid ${GRADE_COLOR[g]}35`,color:GRADE_COLOR[g],padding:'3px 10px',borderRadius:20,fontSize:'var(--text-xs)',fontWeight:700}}>
                    {g}: {c}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Performers */}
          <div className="jd-card glow-panel">
            <CardHeader title="Top Performers"/>
            <div style={{padding:'clamp(8px,1vw,14px)'}}>
              {topAgents.map((a,i)=>(
                <Link key={a.id} href={`/all-chats?agent=${encodeURIComponent(a.name)}`}
                  style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'clamp(7px,0.9vw,12px) clamp(10px,1.2vw,16px)',borderRadius:8,textDecoration:'none',transition:'background 0.15s'}}
                  onMouseEnter={e=>(e.currentTarget.style.background='var(--surface-raised)')}
                  onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                  <span style={{color:'var(--text-secondary)',fontSize:'var(--text-sm)'}}>
                    <span style={{color:'var(--text-muted)',fontWeight:700,marginRight:8}}>#{i+1}</span>{a.name.split(' ')[0]}
                  </span>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <GradeBadge grade={a.grade}/>
                    <span style={{color:'var(--text-primary)',fontWeight:700,fontSize:'var(--text-sm)',minWidth:38,textAlign:'right'}}>{a.closure_rate}%</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Needing Attention */}
          <div className="jd-card" style={{borderColor:'rgba(255,68,68,0.22)',background:'rgba(255,68,68,0.04)'}}>
            <CardHeader title="Needing Attention"/>
            <div style={{padding:'clamp(8px,1vw,14px)'}}>
              {bottomAgents.length===0
                ? <p style={{color:'var(--text-muted)',fontSize:'var(--text-sm)',padding:'8px 12px'}}>All agents performing well ✓</p>
                : bottomAgents.map((a,i)=>(
                  <Link key={a.id} href={`/all-chats?agent=${encodeURIComponent(a.name)}`}
                    style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'clamp(7px,0.9vw,12px) clamp(10px,1.2vw,16px)',borderRadius:8,textDecoration:'none',transition:'background 0.15s'}}
                    onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,68,68,0.08)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    <span style={{color:'#f87171',fontSize:'var(--text-sm)'}}>
                      <span style={{color:C.red,fontWeight:700,marginRight:8}}>#{i+1}</span>{a.name.split(' ')[0]}
                    </span>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <GradeBadge grade={a.grade}/>
                      <span style={{color:C.red,fontWeight:700,fontSize:'var(--text-sm)',minWidth:38,textAlign:'right'}}>{a.closure_rate}%</span>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Alerts ───── */}
        <div className="jd-card glow-panel" style={{minWidth:0}}>
          <CardHeader title="Alerts & Flags"/>
          <div style={{padding:'clamp(12px,1.5vw,20px)',display:'flex',flexDirection:'column',gap:'clamp(8px,1vw,12px)'}}>
            <AlertRow icon="🚨" label="Auto-Fails"     value={alerts.autoFails}  accent={C.red}/>
            <AlertRow icon="⚠️" label="Recalls"        value={alerts.recalls}    accent="#f97316"/>
            <AlertRow icon="⏱️" label="Slow FRT (>5m)" value={alerts.slowFrt}    accent={C.gold}/>
            <AlertRow icon="❓" label="Unresolved"     value={alerts.unresolved} accent="#60a5fa"/>
          </div>
        </div>
      </div>

      {/* ── Bottom: Trend + Categories ───────────────────────────── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,320px),1fr))',gap:'clamp(12px,1.5vw,22px)',alignItems:'start'}}>

        {/* Trend (2/3 on wide) */}
        <div className="jd-card glow-panel" style={{gridColumn:'span 2 / span 2',minWidth:0}}>
          <CardHeader title="Team Performance Trend" sub="Closure Rate % · Current Week"/>
          <div style={{padding:'clamp(12px,1.5vw,20px)',paddingTop:'clamp(8px,1vw,16px)'}}>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={trendData} margin={{top:4,right:20,left:-10,bottom:0}}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.pink} stopOpacity={0.28}/>
                    <stop offset="95%" stopColor={C.pink} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,27,78,0.5)"/>
                <XAxis dataKey="day" tick={{fill:'var(--text-muted)',fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis domain={[0,100]} tick={{fill:'var(--text-muted)',fontSize:11}} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{background:'var(--surface-raised)',border:'1px solid var(--border-mid)',borderRadius:8,color:'var(--text-primary)',fontSize:12}}/>
                <ReferenceLine y={65} stroke={C.promo} strokeDasharray="4 4"
                  label={{value:'Target 65%',position:'right',fill:'var(--text-muted)',fontSize:10}}/>
                <Area type="monotone" dataKey="avg" stroke={C.pink} strokeWidth={2}
                  fill="url(#areaGrad)" dot={{fill:C.pink,r:4,strokeWidth:0}}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inquiry Categories */}
        <div className="jd-card glow-panel" style={{minWidth:0}}>
          <CardHeader title="Inquiry Categories"/>
          <div style={{padding:'clamp(12px,1.5vw,20px)',display:'flex',flexDirection:'column',gap:'clamp(10px,1.2vw,16px)'}}>
            {categories.length===0
              ? <p style={{color:'var(--text-muted)',fontSize:'var(--text-sm)'}}>No ticket data</p>
              : categories.map((cat,i)=>(
                <div key={i}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                    <span style={{color:'var(--text-secondary)',fontSize:'var(--text-xs)',fontWeight:500}}>{cat.name}</span>
                    <span style={{color:'var(--text-muted)',fontSize:'var(--text-xs)'}}>{cat.count} · {cat.pct}%</span>
                  </div>
                  <div style={{height:5,borderRadius:3,background:'var(--surface-raised)',overflow:'hidden'}}>
                    <div className="jd-gradient-h" style={{width:`${cat.pct}%`,height:'100%',borderRadius:3,transition:'width 0.6s ease'}}/>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* ── Footer CTA ────────────────────────────────────────────── */}
      <div style={{display:'flex',justifyContent:'center',paddingBottom:'clamp(8px,1vw,16px)'}}>
        <Link href="/reports/hub"
          style={{padding:'clamp(8px,1vw,12px) clamp(20px,2.5vw,36px)',borderRadius:10,fontSize:'var(--text-sm)',fontWeight:600,background:'rgba(233,30,140,0.10)',border:'1px solid rgba(233,30,140,0.28)',color:C.pink,textDecoration:'none',transition:'background 0.2s'}}
          onMouseEnter={e=>(e.currentTarget.style.background='rgba(233,30,140,0.20)')}
          onMouseLeave={e=>(e.currentTarget.style.background='rgba(233,30,140,0.10)')}>
          View Full Reports →
        </Link>
      </div>

    </div>
  );
}
