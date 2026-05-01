'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface Report {
  label: string;
  start: string;
  end: string;
  generated_at: string;
  files: {
    qa_report: string;
    inquiry_report: string;
    agent_report: string;
  };
}

export default function ReportsHub() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<{ period: string; generated_at: string } | null>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    try {
      const res = await fetch('/api/pipeline/reports');
      const data = await res.json();
      if (data.ok) {
        setReports(data.reports || []);
      }

      const statusRes = await fetch('/api/pipeline/status');
      const statusData = await statusRes.json();
      if (statusData.ok && statusData.last_run) {
        setLastRun(statusData.last_run);
      }
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  }

  async function runPipeline() {
    setRunning(true);
    try {
      const res = await fetch('/api/pipeline/run', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        // Wait a moment then refresh
        setTimeout(() => {
          fetchReports();
          setRunning(false);
        }, 2000);
      } else {
        console.error('Pipeline error:', data.error);
        setRunning(false);
      }
    } catch (err) {
      console.error('Failed to run pipeline:', err);
      setRunning(false);
    }
  }

  async function downloadReport(url: string, filename: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
    }
  }

  return (
    <div className="min-h-screen bg-[#1A1A2E] text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">QA Reports Hub</h1>
          <p className="text-gray-400">Automated quality assurance pipeline for JackpotDaily</p>
        </div>

        {/* Status Card */}
        <div className="bg-[#2D2D44] border border-[#7B2D8B]/20 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Pipeline Status</h2>
          {lastRun ? (
            <div className="space-y-2 mb-6">
              <p className="text-green-400">✓ Last run: {lastRun.period}</p>
              <p className="text-gray-400 text-sm">Generated: {new Date(lastRun.generated_at).toLocaleString()}</p>
            </div>
          ) : (
            <p className="text-gray-400 mb-6">No runs yet</p>
          )}

          <Button
            onClick={runPipeline}
            disabled={running}
            className="bg-[#E91E8C] hover:bg-[#E91E8C]/80 text-white font-semibold"
          >
            {running ? 'Running...' : 'Run Pipeline Now'}
          </Button>
        </div>

        {/* Reports Grid */}
        {loading ? (
          <div className="text-center text-gray-400">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="text-center text-gray-400">No reports available. Run the pipeline to generate reports.</div>
        ) : (
          <div className="grid gap-6">
            {reports.map((report, idx) => (
              <div
                key={idx}
                className="bg-[#2D2D44] border border-[#7B2D8B]/20 rounded-lg p-6 hover:border-[#E91E8C]/50 transition"
              >
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-[#E91E8C]">{report.label}</h3>
                  <p className="text-sm text-gray-400">Generated: {new Date(report.generated_at).toLocaleString()}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Button
                    onClick={() => downloadReport(report.files.qa_report, `qa-report-${report.label}.docx`)}
                    variant="outline"
                    className="border-[#7B2D8B]/50 hover:bg-[#7B2D8B]/10 text-white"
                  >
                    📊 QA Report
                  </Button>
                  <Button
                    onClick={() => downloadReport(report.files.inquiry_report, `inquiry-report-${report.label}.docx`)}
                    variant="outline"
                    className="border-[#7B2D8B]/50 hover:bg-[#7B2D8B]/10 text-white"
                  >
                    💬 Inquiry Report
                  </Button>
                  <Button
                    onClick={() => downloadReport(report.files.agent_report, `agent-report-${report.label}.docx`)}
                    variant="outline"
                    className="border-[#7B2D8B]/50 hover:bg-[#7B2D8B]/10 text-white"
                  >
                    👤 Agent Report
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
