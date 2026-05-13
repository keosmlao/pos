'use client';

import { useState } from 'react';
import { useCompanyProfile } from '@/utils/useCompanyProfile';

const API = '/api';

export default function Login({ onLogin }) {
  const company = useCompanyProfile();
  const saved = JSON.parse(localStorage.getItem('pos_remember') || '{}');
  const [username, setUsername] = useState(saved.username || '');
  const [password, setPassword] = useState(saved.password || '');
  const [remember, setRemember] = useState(!!saved.username);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        if (remember) {
          localStorage.setItem('pos_remember', JSON.stringify({ username, password }));
        } else {
          localStorage.removeItem('pos_remember');
        }
        onLogin(data);
      } else {
        setError(data.error);
      }
    } catch {
      setError('ບໍ່ສາມາດເຊື່ອມຕໍ່ເຊີບເວີ');
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden lg:flex w-[480px] bg-gradient-to-br from-slate-900 via-red-900 to-red-600 text-white flex-col justify-center px-14 relative overflow-hidden shrink-0">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-white/5 rounded-full" />
        <div className="relative z-10">
          <div className="w-20 h-20 bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl flex items-center justify-center mb-7 overflow-hidden">
            {company.logo_url ? (
              <img src={company.logo_url} alt="logo" className="w-full h-full object-contain" />
            ) : (
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 14h6v6H4z" /><path d="M14 4h6v6h-6z" /><path d="M7 4v6" /><path d="M4 7h6" /><path d="M17 14v6" /><path d="M14 17h6" />
              </svg>
            )}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">{company.name}</h1>
          <p className="text-white/50 text-base mb-10">{company.slogan || 'ລະບົບຈັດການຂາຍໜ້າຮ້ານ'}</p>
          <div className="space-y-4">
            {[
              { icon: '\u{1F4E6}', text: 'ຈັດການສິນຄ້າ ແລະ ສະຕ໊ອກ' },
              { icon: '\u{1F4B0}', text: 'ຂາຍ ແລະ ອອກໃບບິນ' },
              { icon: '\u{1F4CA}', text: 'ລາຍງານ ແລະ ສະຖິຕິ' },
              { icon: '\u{1F6D2}', text: 'ລະບົບຊື້ເຂົ້າ ແລະ ຊຳລະໜີ້' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3.5">
                <span className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-base shrink-0">{f.icon}</span>
                <span className="text-sm text-white/70">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-7 left-14 text-xs text-white/25 z-10">POS System v1.0</div>
      </div>
      <div className="flex-1 flex items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden">
              {company.logo_url ? (
                <img src={company.logo_url} alt="logo" className="w-full h-full object-contain" />
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 14h6v6H4z" /><path d="M14 4h6v6h-6z" /><path d="M7 4v6" /><path d="M4 7h6" /><path d="M17 14v6" /><path d="M14 17h6" />
                </svg>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900">{company.name}</h1>
          </div>
          <div className="mb-9">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">ຍິນດີຕ້ອນຮັບ</h2>
            <p className="text-slate-500 text-[15px]">ກະລຸນາເຂົ້າສູ່ລະບົບເພື່ອດຳເນີນການ</p>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-700 mb-2">ຊື່ຜູ້ໃຊ້</label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="ປ້ອນຊື່ຜູ້ໃຊ້" autoFocus required className="w-full pl-11 pr-4 py-3.5 border-2 border-slate-200 rounded-xl text-[15px] outline-none transition-all bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 placeholder:text-slate-300" />
              </div>
            </div>
            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-700 mb-2">ລະຫັດຜ່ານ</label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="ປ້ອນລະຫັດຜ່ານ" required className="w-full pl-11 pr-4 py-3.5 border-2 border-slate-200 rounded-xl text-[15px] outline-none transition-all bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 placeholder:text-slate-300" />
              </div>
            </div>
            <label className="flex items-center gap-2.5 mb-6 cursor-pointer select-none">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="w-[18px] h-[18px] accent-red-600 cursor-pointer" />
              <span className="text-sm text-slate-500">ຈື່ຂໍ້ມູນເຂົ້າລະບົບ</span>
            </label>
            {error && (
              <div className="flex items-center gap-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl px-4 py-3 text-sm mb-5">
                <span className="w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">!</span>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl text-base font-bold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-red-500/30 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-2">
              {loading ? (<span className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />) : ('ເຂົ້າສູ່ລະບົບ')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}