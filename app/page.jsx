'use client';

import { useState, useEffect } from 'react';
import Login from '../components/Login';
import POS from '../components/POS';
import { installAuditFetch } from '../utils/auditFetch';

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    installAuditFetch();
    const saved = localStorage.getItem('pos_user');
    if (!saved) {
      setLoading(false);
      return;
    }
    fetch('/api/session')
      .then(async (res) => {
        if (!res.ok) throw new Error('unauthorized');
        const current = await res.json();
        localStorage.setItem('pos_user', JSON.stringify(current));
        setUser(current);
      })
      .catch(() => localStorage.removeItem('pos_user'))
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = (userData) => {
    localStorage.setItem('pos_user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    fetch('/api/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem('pos_user');
    setUser(null);
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-slate-400">ກຳລັງໂຫລດ...</div>;
  if (!user) return <Login onLogin={handleLogin} />;
  return <POS user={user} onLogout={handleLogout} />;
}
