'use client';
import './globals.css';
import Link from 'next/link';
import { useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AGENTS, IS_REAL_DATA } from '@/lib/dataLoader';
import { gradeColor } from '@/lib/utils';
import { Grade } from '@/lib/types';
import { DevToolsGuard } from '@/components/DevToolsGuard';
import { useRole } from '@/lib/useRole';

const GRADE_DOT: Record<Grade, string> = {
  A: 'bg-green-400', B: 'bg-blue-400', C: 'bg-amber-400', D: 'bg-orange-400', F: 'bg-red-400', 'N/A': 'bg-slate-500',
};

function NavLink({ href, icon, label, onClick }: { href: string; icon: string; label: string; onClick?: () => void }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link href={href} onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
        active
          ? 'bg-[#E91E8C]/15 text-[#E91E8C] font-semibold border border-[#E91E8C]/25 nav-active-glow'
          : 'text-slate-400 hover:bg-[#2D1B4E]/60 hover:text-white border border-transparent'
      }`}>
      <span>{icon}</span>{label}
    </Link>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const close = () => setOpen(false);
  const pathname = usePathname();
  const role = useRole();
  const isAdmin = role === 'admin';

  // Don't render sidebar on login page
  const isLoginPage = pathname === '/login';

  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }, [router]);

  const Sidebar = () => (
    <aside className="jd-sidebar flex flex-col h-full" style={{background:'var(--surface-card)',borderRight:'1px solid var(--border-default)'}}>
      {/* Brand */}
      <div className="flex items-center gap-3" style={{padding:'clamp(14px,1.6vw,22px) clamp(16px,1.8vw,24px)',borderBottom:'1px solid var(--border-default)'}}>
        <div className="jd-gradient font-display" style={{width:'clamp(32px,3vw,40px)',height:'clamp(32px,3vw,40px)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:900,fontSize:'clamp(11px,1.1vw,14px)',boxShadow:'0 0 16px rgba(233,30,140,0.4)',flexShrink:0}}>JD</div>
        <div>
          <div className="font-display" style={{color:'#fff',fontWeight:900,fontSize:'clamp(12px,1.1vw,15px)',letterSpacing:'0.02em'}}>JackpotDaily</div>
          <div style={{color:'var(--promo-purple)',fontSize:'clamp(10px,0.9vw,12px)',display:'flex',alignItems:'center',gap:4}}>
            QA Dashboard <span style={{width:6,height:6,borderRadius:'50%',background:'var(--winner-green)',display:'inline-block'}} title="Live data"/>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-4 jd-sidebar-scroll">
        {/* Dashboard */}
        <div>
          <NavLink href="/" icon="📊" label="Dashboard" onClick={close} />
        </div>

        {/* Reports Hub */}
        <div>
          <NavLink href="/reports/hub" icon="📄" label="Reports Hub" onClick={close} />
        </div>

        {/* LIVE section */}
        <div className="pt-2">
          <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">──── LIVE ────</div>
          <div className="space-y-0.5">
            <NavLink href="/all-chats" icon="💬" label="Chat History" onClick={close} />
          </div>
        </div>

        {/* ANALYTICS section */}
        <div className="pt-2">
          <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">──── ANALYTICS ────</div>
          <div className="space-y-0.5">
            <NavLink href="/reports/weekly" icon="📈" label="Weekly" onClick={close} />
            <NavLink href="/reports/daily" icon="📅" label="Daily" onClick={close} />
            <NavLink href="/reports/autofails" icon="🚩" label="Auto-Flags" onClick={close} />
            {isAdmin && <NavLink href="/reports/export" icon="⬇️" label="Export Data" onClick={close} />}
          </div>
        </div>

        {/* SYSTEM section — admin only */}
        {isAdmin && (
          <div className="pt-2">
            <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">──── SYSTEM ────</div>
            <div className="space-y-0.5">
              <NavLink href="/settings" icon="⚙️" label="Settings" onClick={close} />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#E91E8C]/20 space-y-2">
        <div className="text-xs flex items-center gap-1" style={{color:'#7B2D8B'}}>
          {isAdmin ? '🔑 Admin' : '👤 Viewer'} · {<span className="text-green-400">● Live</span>}
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-500 hover:bg-[#FF4444]/10 hover:text-[#FF4444] text-xs transition-all border border-transparent hover:border-[#FF4444]/20"
        >
          <span>🔓</span> Sign Out
        </button>
      </div>
    </aside>
  );

  if (isLoginPage) {
    return (
      <html lang="en">
        <head>
          <title>JackpotDaily QA — Sign In</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body className="min-h-screen bg-[#0f172a] text-slate-100">
          {children}
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        <title>JackpotDaily QA Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="min-h-screen" style={{backgroundColor:'var(--surface-page)',color:'var(--text-primary)'}}>
        <DevToolsGuard />
        <div className="flex min-h-screen">
          {/* Mobile overlay */}
          {open && <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={close} />}

          {/* Desktop sidebar */}
          <div className="hidden lg:flex flex-col w-64 flex-shrink-0 fixed top-0 left-0 h-full z-30">
            <Sidebar />
          </div>

          {/* Mobile sidebar */}
          <div className={`fixed top-0 left-0 h-full z-30 transform transition-transform duration-200 lg:hidden ${open ? 'translate-x-0' : '-translate-x-full'}`}>
            <Sidebar />
          </div>

          {/* Main */}
          <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
            {/* Mobile header */}
            <header className="lg:hidden sticky top-0 z-10 flex items-center gap-3 px-4 py-3 backdrop-blur" style={{borderBottom:'1px solid var(--border-default)',backgroundColor:'rgba(13,13,26,0.96)'}}>
              <button onClick={() => setOpen(true)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <span className="font-bold text-white">JackpotDaily QA</span>
              {IS_REAL_DATA && <span className="ml-auto text-xs text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-400 rounded-full" />LIVE</span>}
            </header>

            <main className="flex-1 p-6 overflow-auto">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
