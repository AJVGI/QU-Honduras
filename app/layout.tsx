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
  A: 'bg-green-400', B: 'bg-blue-400', C: 'bg-amber-400', D: 'bg-orange-400', F: 'bg-red-400',
};

function NavLink({ href, icon, label, onClick }: { href: string; icon: string; label: string; onClick?: () => void }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link href={href} onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
        active
          ? 'bg-[#E91E8C]/15 text-[#E91E8C] font-semibold border border-[#E91E8C]/25'
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
    <aside className="flex flex-col h-full w-64 bg-[#0D0D1A] border-r border-[#E91E8C]/20">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-[#E91E8C]/20 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl jd-gradient flex items-center justify-center text-white font-black text-sm font-display shadow-lg" style={{boxShadow:'0 0 16px rgba(233,30,140,0.4)'}}>JD</div>
        <div>
          <div className="font-black text-white text-sm font-display tracking-wide">JackpotDaily</div>
          <div className="text-xs text-[#7B2D8B] flex items-center gap-1">
            QA Dashboard {IS_REAL_DATA && <span className="w-1.5 h-1.5 rounded-full bg-[#00C882] inline-block" title="Live data" />}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6 jd-sidebar-scroll">
        {/* Overview */}
        <div>
          <NavLink href="/" icon="📊" label="Team Overview" onClick={close} />
        </div>

        {/* Agents */}
        <div>
          <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Agents ({AGENTS.length})</div>
          <div className="space-y-0.5">
            {AGENTS.map(a => (
              <Link key={a.id} href={`/agent/${a.id}`} onClick={close}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-400 hover:bg-[#2D1B4E]/60 hover:text-white text-sm transition-all group border border-transparent hover:border-[#7B2D8B]/30">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${GRADE_DOT[a.grade]}`} />
                <span className="flex-1 truncate group-hover:text-white">{a.name}</span>
                <span className="text-xs font-mono" style={{ color: gradeColor(a.grade) }}>{a.avg_score}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Reports */}
        <div>
          <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reports</div>
          <div className="space-y-0.5">
            <NavLink href="/reports/daily" icon="📅" label="Daily Report" onClick={close} />
            <NavLink href="/reports/weekly" icon="📈" label="Weekly Report" onClick={close} />
            <NavLink href="/reports/autofails" icon="🚨" label="Auto-Fails" onClick={close} />
            {isAdmin && <NavLink href="/reports/export" icon="⬇️" label="Export Data" onClick={close} />}
          </div>
        </div>

        {/* Settings — admin only */}
        {isAdmin && (
          <div>
            <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">System</div>
            <div className="space-y-0.5">
              <NavLink href="/settings" icon="⚙️" label="Settings & Info" onClick={close} />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#E91E8C]/20 space-y-2">
        <div className="text-xs flex items-center gap-1" style={{color:'#7B2D8B'}}>
          {isAdmin ? '🔑 Admin' : '👤 Viewer'} · {IS_REAL_DATA ? <><span className="w-1.5 h-1.5 rounded-full bg-[#00C882] inline-block"/> Live</> : '🟡 Mock'}
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
      <body className="min-h-screen text-slate-100" style={{backgroundColor:'#0D0D1A'}}>
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
            <header className="lg:hidden sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-[#E91E8C]/20 backdrop-blur" style={{backgroundColor:'rgba(13,13,26,0.95)'}}>
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
