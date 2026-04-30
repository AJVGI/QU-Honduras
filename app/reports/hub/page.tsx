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

export default function ReportsHub() {
  const [reports, setReports] = useState<Report[]>([]);
  const [status, setStatus] = useState<StatusData['lastRun'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Fetch reports and status
  const fetchData = async () => {
    try {
      setError(null);
      const [reportsRes, statusRes] = await Promise.all([
        fetch('/api/pipeline/reports').then((r) => r.json()),
        fetch('/api/pipeline/status').then((r) => r.json()),
      ]);

      if (reportsRes.ok) {
        setReports(reportsRes.reports || []);
      }
      if (statusRes.ok) {
        setStatus(statusRes.lastRun);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  // Trigger pipeline run
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
        const err = await res.json();
        throw new Error(err.error || 'Pipeline failed');
      }

      // Poll until complete
      let completed = false;
      let attempts = 0;
      while (!completed && attempts < 60) {
        await new Promise((r) => setTimeout(r, 5000));
        const statusRes = await fetch('/api/pipeline/status').then((r) => r.json());
        if (statusRes.lastRun?.status === 'completed' || statusRes.lastRun?.status === 'failed') {
          completed = true;
          setStatus(statusRes.lastRun);
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

  const formatDate = (isoDate: string) => {
    try {
      return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoDate;
    }
  };

  const formatTime = (isoDate: string) => {
    try {
      return new Date(isoDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoDate;
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1A1A2E', color: '#E0E0E0' }}>
      {/* Header */}
      <div className="border-b p-6" style={{ borderColor: '#7B2D8B' }}>
        <h1 className="text-3xl font-bold mb-2">📊 Reports Hub</h1>
        <p className="text-gray-400">View and download QA pipeline reports</p>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-700 rounded">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {/* Pipeline Status Card */}
        <div className="mb-8 p-6 border rounded" style={{ borderColor: '#7B2D8B', backgroundColor: '#242435' }}>
          <h2 className="text-xl font-bold mb-4">Pipeline Status</h2>
          {status ? (
            <div className="space-y-2 mb-4">
              <p>
                <strong>Last Run:</strong> {formatDate(status.created_at)} at {formatTime(status.created_at)}
              </p>
              <p>
                <strong>Status:</strong>{' '}
                <span
                  className="font-bold"
                  style={{
                    color:
                      status.status === 'completed'
                        ? '#4ADE80'
                        : status.status === 'failed'
                          ? '#F87171'
                          : status.status === 'running'
                            ? '#FBBF24'
                            : '#9CA3AF',
                  }}
                >
                  {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
                </span>
              </p>
              <p>
                <strong>Period:</strong> {status.period_label}
              </p>
            </div>
          ) : (
            <p className="text-gray-400 mb-4">No runs yet</p>
          )}

          {/* Run Pipeline Button */}
          <div className="flex items-end gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Select Period</label>
              <select
                value={weekOffset}
                onChange={(e) => setWeekOffset(parseInt(e.target.value))}
                disabled={running}
                className="px-3 py-2 rounded border"
                style={{
                  backgroundColor: '#1A1A2E',
                  borderColor: '#7B2D8B',
                  color: '#E0E0E0',
                }}
              >
                <option value="0">Last Week</option>
                <option value="1">2 Weeks Ago</option>
                <option value="2">3 Weeks Ago</option>
                <option value="4">Monthly (4 weeks ago)</option>
              </select>
            </div>
            <button
              onClick={handleRunPipeline}
              disabled={running}
              className="px-6 py-2 rounded font-semibold transition"
              style={{
                backgroundColor: running ? '#666' : '#E91E8C',
                color: 'white',
                cursor: running ? 'not-allowed' : 'pointer',
              }}
            >
              {running ? '⏳ Running...' : '▶ Run Pipeline Now'}
            </button>
          </div>
        </div>

        {/* Reports List */}
        <div>
          <h2 className="text-xl font-bold mb-4">Generated Reports</h2>
          {loading ? (
            <p className="text-gray-400">Loading...</p>
          ) : reports.length === 0 ? (
            <div className="p-6 text-center border rounded" style={{ borderColor: '#7B2D8B', backgroundColor: '#242435' }}>
              <p className="text-gray-400">No reports generated yet. Run the pipeline to generate your first report.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <div key={report.id} className="p-6 border rounded" style={{ borderColor: '#7B2D8B', backgroundColor: '#242435' }}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-400">Period</p>
                      <p className="font-semibold">{report.periodLabel}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Generated</p>
                      <p className="font-semibold">{formatDate(report.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Tickets</p>
                      <p className="font-semibold">
                        {report.totalTickets} tickets / {report.agentCount} agents
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {report.downloadUrls.qa && (
                      <a
                        href={report.downloadUrls.qa}
                        download="QA_Report.docx"
                        className="px-4 py-2 rounded font-semibold transition"
                        style={{
                          backgroundColor: '#7B2D8B',
                          color: 'white',
                          textDecoration: 'none',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#9B3DAB')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#7B2D8B')}
                      >
                        📊 QA Report
                      </a>
                    )}
                    {report.downloadUrls.inquiry && (
                      <a
                        href={report.downloadUrls.inquiry}
                        download="Inquiry_Report.docx"
                        className="px-4 py-2 rounded font-semibold transition"
                        style={{
                          backgroundColor: '#7B2D8B',
                          color: 'white',
                          textDecoration: 'none',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#9B3DAB')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#7B2D8B')}
                      >
                        📋 Inquiry Report
                      </a>
                    )}
                    {report.downloadUrls.individual && (
                      <a
                        href={report.downloadUrls.individual}
                        download="Individual_Report.docx"
                        className="px-4 py-2 rounded font-semibold transition"
                        style={{
                          backgroundColor: '#7B2D8B',
                          color: 'white',
                          textDecoration: 'none',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#9B3DAB')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#7B2D8B')}
                      >
                        👤 Individual Report
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
