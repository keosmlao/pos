'use client';

import { useState, useEffect, useCallback } from 'react';
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

  // ດຶງສິດໃໝ່ຕອນກັບມາໃຊ້ໜ້າຈໍ — ໜ້າຂາຍເປີດຄ້າງໄວ້ທັງມື້,
  // ຖ້າບໍ່ດຶງໃໝ່ ສິດທີ່ admin ຫາກໍເປີດໃຫ້ຈະບໍ່ມີຜົນຈົນກວ່າຈະ refresh ໜ້າເອງ
  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/session', { cache: 'no-store' });
      // ສະເພາະ 401 (session ໝົດອາຍຸ/ຖືກລົບ) ຈຶ່ງເຕະອອກ —
      // ເນັດຫຼຸດຊົ່ວຄາວຕ້ອງບໍ່ໄລ່ພະນັກງານອອກກາງຄັນ
      if (res.status === 401) {
        localStorage.removeItem('pos_user');
        setUser(null);
        return;
      }
      if (!res.ok) return;
      const current = await res.json();
      localStorage.setItem('pos_user', JSON.stringify(current));
      // ປ່ຽນ state ສະເພາະຕອນຂໍ້ມູນຕ່າງຈິງ ຈຶ່ງບໍ່ render ຄືນຖີ່ໆ
      setUser(prev => (JSON.stringify(prev) === JSON.stringify(current) ? prev : current));
    } catch {
      /* ອອບລາຍ — ໃຊ້ສິດເກົ່າຕໍ່ໄປ */
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const onFocus = () => refreshSession();
    const onVisible = () => { if (document.visibilityState === 'visible') refreshSession(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(refreshSession, 5 * 60 * 1000);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [user, refreshSession]);

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
