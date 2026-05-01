'use client';

import React, { useEffect, useState } from 'react';

interface Report {
  id: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  totalTickets: number;
  agentCount: number;
  downloadUrls: {
    qa: string | null;
    inquiry: string | null;
    individual: string | null;
  };
}

interface StatusData {
  lastRun: {
    id: string;
    period_label: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    created_at: string;
    completed_at: string | null;
  } | null;
}

async function downloadViaProxy(proxyUrl: string, filename: string) {
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

export default function ReportsHub() {
  const [reports, setReports] = useState<Report[]>([]);
  const [status, setStatus] = useState<StatusData['lastRun'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setError(null);
      const [reportsRes, statusRes] = await Promise.all([
        fetch('/api/pipeline/reports').then((r) => r.json()),
        fetch('/api/pipeline/status').then((r) => r.json()),
      ]);
      if (reportsRes.ok) setReports(reportsRes.reports || []);
      if (statusRes.ok) setStatus(statusRes.lastRun);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRunPipeline = async () => {
    try {
      setRunning(true);
      setError(null);
      const res = await fetch('/api/pipeline/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ weekOffset }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Pipeline failed');
      }
      let attempts = 0;
      while (attempts < 60) {
        await new Promise((r) => setTimeout(r, 5000));
        const s = await fetch('/api/pipeline/status').then((r) => r.json());
        if (s.lastRun?.status === 'completed' || s.lastRun?.status === 'failed') {
          setStatus(s.lastRun);
          break;
        }
        attempts++;
      }
      await fetchData();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const handleDownload = async (proxyUrl: string, label: string, filename: string) => {
    try {
      setDownloading(proxyUrl);
      await downloadViaProxy(proxyUrl, filename);
    } catch (e) {
      setError(`${label} download failed: ${(e as Error).message}`);
    } finally {
      setDownloading(null);
    }
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return d; }
  };
  const formatTime = (d: string) => {
    try { return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); }
    catch { return d; }
  };

  function DownloadBtn({ url, label, emoji, filename }: { url: string; label: string; emoji: string; filename: string }) {
    const busy = downloading === url;
    return (
      <button
        onClick={() => handleDownload(url, label, filename)}
        disabled={busy}
        className="px-4 py-2 rounded font-semibold transition flex items-center gap-2 text-white text-sm"
        style={{ background: busy ? '#555' : '#7B2D8B', cursor: busy ? 'not-allowed' : 'pointer' }}
        onMouseEnter={e => { if (!busy) (e.currentTarget as HTMLButtonElement).style.background = '#9B3DAB'; }}
        onMouseLeave={e => { if (!busy) (e.currentTarget as HTMLButtonElement).style.background = '#7B2D8B'; }}
      >
        {busy ? '⏳' : emoji} {busy ? 'Downloading...' : label}
      </button>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1A1A2E', color: '#E0E0E0' }}>
      <div className="border-b p-6" style={{ borderColor: '#7B2D8B' }}>
        <h1 className="text-3xl font-bold mb-2">📊 Reports Hub</h1>
        <p className="text-gray-400">Download QA pipeline reports as Word documents</p>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-700 rounded-lg flex items-start gap-3">
            <span>⚠️</span>
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        <div className="mb-8 p-6 border rounded-xl" style={{ borderColor: '#7B2D8B', background: '#242435' }}>
          <h2 className="text-xl font-bold mb-4">Pipeline Status</h2>
          {status ? (
            <div className="flex flex-wrap gap-6 mb-4 text-sm">
              <div><span className="text-gray-400">Last Run: </span><span>{formatDate(status.created_at)} {formatTime(status.created_at)}</span></div>
              <div><span className="text-gray-400">Period: </span><span>{status.period_label}</span></div>
              <div>
                <span className="text-gray-400">Status: </span>
                <span className="font-bold" style={{ color: status.status === 'completed' ? '#4ADE80' : status.status === 'failed' ? '#F87171' : '#FBBF24' }}>
                  {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
                </span>
              </div>
            </div>
          ) : <p className="text-gray-400 mb-4 text-sm">No runs yet.</p>}

          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Week</label>
              <select
                value={weekOffset}
                onChange={(e) => setWeekOffset(parseInt(e.target.value))}
                disabled={running}
                className="px-3 py-2 rounded border text-sm"
                style={{ background: '#1A1A2E', borderColor: '#7B2D8B', color: '#E0E0E0' }}
              >
                <option value="0">Last Week</option>
                <option value="1">2 Weeks Ago</option>
                <option value="2">3 Weeks Ago</option>
                <option value="4">Monthly</option>
              </select>
            </div>
            <button
              onClick={handleRunPipeline}
              disabled={running}
              className="px-6 py-2 rounded font-semibold text-white transition text-sm"
              style={{ background: running ? '#555' : '#E91E8C', cursor: running ? 'not-allowed' : 'pointer' }}
            >
              {running ? '⏳ Running pipeline...' : '▶ Run Pipeline Now'}
            </button>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-4">Generated Reports</h2>
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center border rounded-xl" style={{ borderColor: '#7B2D8B', background: '#242435' }}>
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-400">No reports yet. Run the pipeline above to generate your first report.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((r) => (
              <div key={r.id} className="p-6 border rounded-xl" style={{ borderColor: '#7B2D8B', background: '#242435' }}>
                <div className="mb-4">
                  <div className="text-lg font-bold text-white">{r.periodLabel}</div>
                  <div className="text-sm text-gray-400 mt-1">
                    Generated {formatDate(r.createdAt)} · {r.totalTickets} tickets · {r.agentCount} agents
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {r.downloadUrls.qa && (
                    <DownloadBtn url={r.downloadUrls.qa} label="QA Report" emoji="📊" filename={`QA_Report_${r.periodLabel.replace(/\s/g,'_')}.docx`} />
                  )}
                  {r.downloadUrls.inquiry && (
                    <DownloadBtn url={r.downloadUrls.inquiry} label="Inquiry Report" emoji="📋" filename={`Inquiry_Report_${r.periodLabel.replace(/\s/g,'_')}.docx`} />
                  )}
                  {r.downloadUrls.individual && (
                    <DownloadBtn url={r.downloadUrls.individual} label="Individual Report" emoji="👤" filename={`Individual_Report_${r.periodLabel.replace(/\s/g,'_')}.docx`} />
                  )}
                  {!r.downloadUrls.qa && !r.downloadUrls.inquiry && !r.downloadUrls.individual && (
                    <span className="text-sm text-gray-500 italic">No files for this run.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
