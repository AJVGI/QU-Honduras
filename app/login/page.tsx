'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const from = searchParams.get('from') || '/';
        router.replace(from);
      } else {
        const data = await res.json();
        setError(data.error || 'Invalid password');
        setPassword('');
        inputRef.current?.focus();
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#0D0D1A' }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #E91E8C 0%, transparent 70%)' }} />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 rounded-full opacity-8"
          style={{ background: 'radial-gradient(circle, #7B2D8B 0%, transparent 70%)' }} />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-black text-3xl mb-4 font-display"
            style={{
              background: 'linear-gradient(135deg, #E91E8C 0%, #7B2D8B 50%, #2D1B4E 100%)',
              boxShadow: '0 0 40px rgba(233, 30, 140, 0.4), 0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            JD
          </div>
          <h1 className="text-3xl font-black text-white font-display tracking-wide">JackpotDaily</h1>
          <p className="mt-1 text-sm" style={{ color: '#7B2D8B' }}>QA Dashboard — Restricted Access</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8 shadow-2xl"
          style={{
            backgroundColor: '#1A1A2E',
            border: '1px solid rgba(233, 30, 140, 0.2)',
            boxShadow: '0 0 60px rgba(233, 30, 140, 0.08), 0 24px 48px rgba(0,0,0,0.6)',
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-300 mb-2">
                Access Password
              </label>
              <input
                ref={inputRef}
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                required
                className="w-full px-4 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none transition-all"
                style={{
                  backgroundColor: '#0D0D1A',
                  border: '1px solid rgba(123, 45, 139, 0.4)',
                  outline: 'none',
                }}
                onFocus={e => { e.target.style.border = '1px solid #E91E8C'; e.target.style.boxShadow = '0 0 0 3px rgba(233,30,140,0.15)'; }}
                onBlur={e => { e.target.style.border = '1px solid rgba(123,45,139,0.4)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {error && (
              <div
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                style={{ backgroundColor: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', color: '#FF4444' }}
              >
                <span>⚠️</span><span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 px-4 text-white font-bold rounded-xl transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-display tracking-wide"
              style={{
                background: loading || !password ? '#2D1B4E' : 'linear-gradient(135deg, #E91E8C 0%, #7B2D8B 100%)',
                boxShadow: loading || !password ? 'none' : '0 0 20px rgba(233,30,140,0.3)',
              }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verifying...
                </>
              ) : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#2D1B4E' }}>
          Internal use only · JackpotDaily Operations
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
