'use client';
import { useEffect } from 'react';

export function DevToolsGuard() {
  useEffect(() => {
    // 1. Disable right-click context menu
    const blockContext = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', blockContext);

    // 2. Block devtools keyboard shortcuts
    const blockKeys = (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12') { e.preventDefault(); return false; }
      // Ctrl+Shift+I / Cmd+Opt+I
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') { e.preventDefault(); return false; }
      // Ctrl+Shift+J / Cmd+Opt+J (console)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') { e.preventDefault(); return false; }
      // Ctrl+Shift+C (inspector)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') { e.preventDefault(); return false; }
      // Ctrl+U (view source)
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') { e.preventDefault(); return false; }
      // Ctrl+S (save page)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); return false; }
    };
    document.addEventListener('keydown', blockKeys, true);

    // 3. Override console methods (disable console output)
    const noop = () => {};
    const consoleMethods = ['log', 'warn', 'error', 'info', 'debug', 'table', 'dir'] as const;
    type ConsoleMethod = typeof consoleMethods[number];
    const originals = {} as Record<ConsoleMethod, typeof noop>;
    consoleMethods.forEach(m => {
      originals[m] = console[m] as typeof noop;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (console as any)[m] = noop;
    });

    // 4. Detect devtools open via size heuristic and warn
    let warned = false;
    const detectDevtools = () => {
      const threshold = 160;
      if (
        window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold
      ) {
        if (!warned) {
          warned = true;
          document.body.innerHTML = `
            <div style="min-height:100vh;background:#0f172a;display:flex;align-items:center;justify-content:center;font-family:sans-serif;">
              <div style="text-align:center;color:#f1f5f9;padding:2rem;">
                <div style="font-size:4rem;margin-bottom:1rem;">⛔</div>
                <h1 style="font-size:1.5rem;font-weight:900;margin-bottom:0.5rem;">Unauthorized Access Detected</h1>
                <p style="color:#94a3b8;margin-bottom:1.5rem;">Developer tools are not permitted on this platform.</p>
                <p style="color:#64748b;font-size:0.8rem;">This session has been flagged.</p>
              </div>
            </div>`;
        }
      }
    };
    const interval = setInterval(detectDevtools, 1000);

    return () => {
      document.removeEventListener('contextmenu', blockContext);
      document.removeEventListener('keydown', blockKeys, true);
      clearInterval(interval);
      // Restore console
      consoleMethods.forEach(m => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (originals[m]) (console as any)[m] = originals[m];
      });
    };
  }, []);

  return null;
}
