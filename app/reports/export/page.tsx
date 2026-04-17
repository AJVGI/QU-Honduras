'use client';
import { AGENTS } from '@/lib/dataLoader';

export default function ExportPage() {
  const totalChats = AGENTS.flatMap(a => a.chats).length;

  const handleExport = () => {
    const allChats = AGENTS.flatMap(a =>
      a.chats.map(c => ({
        chat_id: c.chat_id,
        agent_name: c.agent_name,
        timestamp: c.timestamp,
        total_score: c.total_score,
        grade: c.grade,
        auto_fail: c.auto_fail.triggered ? 'YES' : 'NO',
        auto_fail_reason: c.auto_fail.reason || '',
        website: c.website || '',
        greeting: c.categories?.greeting?.score ?? '',
        issue_discovery: c.categories?.issue_discovery?.score ?? '',
        resolution: c.categories?.resolution?.score ?? '',
        communication: c.categories?.communication?.score ?? '',
        compliance: c.categories?.compliance?.score ?? '',
        closing: c.categories?.closing?.score ?? '',
        summary: (c.summary || '').replace(/,/g, ';'),
        coaching_tip: (c.coaching_tip || '').replace(/,/g, ';'),
      }))
    );

    const headers = Object.keys(allChats[0] || {}).join(',');
    const rows = allChats.map(row => Object.values(row).map(v => `"${v}"`).join(','));
    const csv = [headers, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jackpotdaily-qa-${new Date().toISOString().substring(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-black text-white">⬇️ Export Data</h1>
        <p className="text-slate-400 text-sm mt-1">Download QA scores for analysis in Excel, Google Sheets, or your BI tool.</p>
      </div>

      <div className="bg-[#1A1A2E] border border-[#7B2D8B]/20 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-white">Full Chat History CSV</div>
            <div className="text-sm text-slate-400 mt-1">All {totalChats} scored chats with category scores, grades, summaries, and coaching tips.</div>
          </div>
          <button onClick={handleExport}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-sm transition-colors">
            ⬇️ Download CSV
          </button>
        </div>

        <div className="border-t border-[#7B2D8B]/20 pt-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Columns included</div>
          <div className="flex flex-wrap gap-2">
            {['chat_id','agent_name','timestamp','total_score','grade','auto_fail','website','greeting','issue_discovery','resolution','communication','compliance','closing','summary','coaching_tip'].map(col => (
              <span key={col} className="text-xs px-2 py-1 bg-slate-800 text-slate-300 rounded font-mono">{col}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#2D1B4E]/15 border border-[#7B2D8B]/15 rounded-xl p-5 text-sm text-slate-400 space-y-2">
        <div className="font-semibold text-slate-300">Coming soon</div>
        <ul className="space-y-1 text-xs">
          <li>• Per-agent CSV exports</li>
          <li>• Date range filtering</li>
          <li>• JSON export format</li>
          <li>• Google Sheets direct integration</li>
          <li>• Scheduled email reports</li>
        </ul>
      </div>
    </div>
  );
}
