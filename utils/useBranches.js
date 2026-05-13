'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'pos_active_branch_id';

let cached = null;
let inFlight = null;

export function useBranches() {
  const [branches, setBranches] = useState(cached || []);
  const [activeBranchId, setActiveBranchIdState] = useState(() => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Number(saved) : null;
  });

  useEffect(() => {
    if (cached) { setBranches(cached); return; }
    if (!inFlight) {
      inFlight = fetch('/api/admin/branches')
        .then(r => r.json())
        .then(data => {
          cached = Array.isArray(data) ? data : [];
          return cached;
        })
        .catch(() => { cached = []; return []; });
    }
    inFlight.then(setBranches);
  }, []);

  // If no active branch saved, default to user's branch_id or the system default
  useEffect(() => {
    if (activeBranchId || branches.length === 0) return;
    let resolved = null;
    try {
      const userRaw = typeof window !== 'undefined' ? localStorage.getItem('pos_user') : null;
      const user = userRaw ? JSON.parse(userRaw) : null;
      if (user?.branch_id) resolved = Number(user.branch_id);
    } catch {}
    if (!resolved) {
      const def = branches.find(b => b.is_default && b.active !== false) || branches.find(b => b.active !== false) || branches[0];
      resolved = def?.id || null;
    }
    if (resolved) {
      setActiveBranchIdState(resolved);
      if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, String(resolved));
    }
  }, [branches, activeBranchId]);

  const setActiveBranchId = (id) => {
    setActiveBranchIdState(id);
    if (typeof window !== 'undefined') {
      if (id) localStorage.setItem(STORAGE_KEY, String(id));
      else localStorage.removeItem(STORAGE_KEY);
    }
  };

  const activeBranch = branches.find(b => b.id === activeBranchId) || null;
  return { branches, activeBranch, activeBranchId, setActiveBranchId };
}

export function clearBranchesCache() {
  cached = null;
  inFlight = null;
}
