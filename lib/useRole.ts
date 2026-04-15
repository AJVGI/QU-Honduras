'use client';
import { useState, useEffect } from 'react';

export type Role = 'admin' | 'user' | null;

let cachedRole: Role = null;
let fetched = false;

export function useRole(): Role {
  const [role, setRole] = useState<Role>(cachedRole);

  useEffect(() => {
    if (fetched) {
      setRole(cachedRole);
      return;
    }
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        cachedRole = d.role ?? null;
        fetched = true;
        setRole(cachedRole);
      })
      .catch(() => setRole(null));
  }, []);

  return role;
}
