'use client';
import Link from 'next/link';

export default function DeniedPage() {
  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">🔒</div>
        <h1 className="text-2xl font-black text-white mb-2">Access Restricted</h1>
        <p className="text-slate-400 mb-8">
          This section requires administrator access. Contact your admin if you need access.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
