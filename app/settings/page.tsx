'use client';
import { AGENTS, IS_REAL_DATA, DATA_TIMESTAMP } from '@/lib/dataLoader';

export default function Settings() {
  const allChats = AGENTS.flatMap(a => a.chats);
  const models = [...new Set(allChats.map(c => (c as any).scored_with).filter(Boolean))];
  const latestScore = allChats.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

  const info = [
    { label: 'Data Source', value: IS_REAL_DATA ? '🟢 WellyTalk Live API' : '🟡 Mock Data (demo mode)' },
    { label: 'Last Scored', value: DATA_TIMESTAMP ? new Date(DATA_TIMESTAMP).toLocaleString() : 'Never' },
    { label: 'Latest Chat', value: latestScore ? new Date(latestScore.timestamp).toLocaleString() : 'N/A' },
    { label: 'Total Agents', value: AGENTS.length },
    { label: 'Total Chats', value: allChats.length },
    { label: 'AI Models Used', value: models.length > 0 ? models.join(', ') : 'N/A' },
    { label: 'Deep Analysis', value: allChats.filter(c => (c as any).message_analysis?.length > 0).length + ' chats (Opus)' },
    { label: 'Auto-Fail Rate', value: Math.round((allChats.filter(c => c.auto_fail.triggered).length / (allChats.length || 1)) * 100) + '%' },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-black text-white">⚙️ Settings & Info</h1>
        <p className="text-slate-400 text-sm mt-1">System status, data source, and configuration.</p>
      </div>

      <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#7B2D8B]/20">
          <h2 className="text-sm font-semibold text-slate-300">System Status</h2>
        </div>
        <div className="divide-y divide-slate-700/30">
          {info.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-400">{label}</span>
              <span className="text-sm text-white font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-300">Scoring Pipeline</h2>
        <div className="text-xs text-slate-400 space-y-2">
          <p>• <strong className="text-slate-300">Realtime Watcher</strong> — polls WellyTalk every 5 min, scores new closed chats automatically</p>
          <p>• <strong className="text-slate-300">Free Tier Scoring</strong> — rotates across openai/gpt-oss-20b, llama-3.3-70b, gemma-3-27b</p>
          <p>• <strong className="text-slate-300">Deep Analysis (Opus)</strong> — per-message breakdown, run manually for training sessions</p>
          <p>• <strong className="text-slate-300">Auto-Deploy</strong> — every new score triggers a GitHub push → Vercel rebuild</p>
        </div>
      </div>

      <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-300">Manual Controls</h2>
        <div className="text-xs text-slate-400 font-mono space-y-1.5 bg-slate-900/50 rounded-lg p-3">
          <div># Deep score next 100 chats (Sonnet)</div>
          <div className="text-green-400">node qa-scorer/deep-scorer.js --batch 100</div>
          <div className="mt-2"># Deep score specific agent</div>
          <div className="text-green-400">node qa-scorer/deep-scorer.js --agent &quot;Oscar Zelaya&quot;</div>
          <div className="mt-2"># Opus deep dive (on-demand training session)</div>
          <div className="text-green-400">node qa-scorer/opus-agent-batch.js --agent &quot;Oskar Abaunza&quot;</div>
          <div className="mt-2"># Realtime watcher (one run)</div>
          <div className="text-green-400">node qa-scorer/realtime-watcher.js</div>
        </div>
      </div>
    </div>
  );
}
