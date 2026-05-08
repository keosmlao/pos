'use client';

import { useState, useEffect } from 'react';
import Login from '../components/Login';
import POS from '../components/POS';

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('pos_user');
    if (saved) setUser(JSON.parse(saved));
    setLoading(false);
    fetch('/api/init').catch(() => {});
  }, []);

  const handleLogin = (userData) => {
    localStorage.setItem('pos_user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('pos_user');
    setUser(null);
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-slate-400">ກຳລັງໂຫລດ...</div>;
  if (!user) return <Login onLogin={handleLogin} />;
  return <POS user={user} onLogout={handleLogout} />;
}
