'use client';
import './globals.css';
import Link from 'next/link';
import { useState } from 'react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <html lang="en">
      <head>
        <title>JackpotDaily QA Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="min-h-screen bg-[#0f172a] text-slate-100">
        <div className="flex min-h-screen">
          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/60 z-20 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside className={`
            fixed top-0 left-0 h-full w-64 bg-[#0f172a] border-r border-slate-700/50 z-30
            transform transition-transform duration-200
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0 lg:static lg:block
          `}>
            <div className="p-6 border-b border-slate-700/50">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎰</span>
                <div>
                  <div className="font-bold text-white text-sm">JackpotDaily</div>
                  <div className="text-xs text-slate-400">QA Dashboard</div>
                </div>
              </div>
            </div>
            <nav className="p-4 space-y-1">
              <Link
                href="/"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-sm"
              >
                <span>📊</span> Team Overview
              </Link>
              <div className="pt-4 pb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Honduras Agents
              </div>
              <Link
                href="/"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-sm"
              >
                <span>👥</span> Leaderboard
              </Link>
            </nav>
            <div className="absolute bottom-4 left-4 right-4">
              <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-400">
                <div className="font-semibold text-slate-300 mb-1">AI-Powered QA</div>
                <div>Automated scoring via Claude API</div>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Mobile header */}
            <header className="lg:hidden flex items-center justify-between p-4 border-b border-slate-700/50 bg-[#0f172a]">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <span className="font-bold text-white flex items-center gap-2">
                <span>🎰</span> JackpotDaily QA
              </span>
              <div className="w-9" />
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
