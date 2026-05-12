'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useCompanyProfile } from '@/utils/useCompanyProfile';

const menuSections = [
  {
    title: 'ພາບລວມ',
    items: [
      { path: '/admin', icon: '\u{1F4CA}', label: 'ແຜງຄວບຄຸມ' },
    ],
  },
  {
    title: 'ສິນຄ້າ',
    items: [
      { path: '/admin/products', icon: '\u{1F4E6}', label: 'ຈັດການສິນຄ້າ' },
      { path: '/admin/categories-brands', icon: '\u{1F3F7}️', label: 'ໝວດໝູ່ / ຍີ່ຫໍ້ / ຫົວໜ່ວຍ' },
      { path: '/admin/suppliers', icon: '\u{1F69A}', label: 'ຜູ້ສະໜອງ' },
    ],
  },
  {
    title: 'ຊື້',
    items: [
      { path: '/admin/purchases', icon: '\u{1F6D2}', label: 'ລະບົບຊື້ເຂົ້າ' },
      { path: '/admin/debts', icon: '\u{1F4B3}', label: 'ໜີ້ຜູ້ສະໜອງ' },
      { path: '/admin/debt-payments/supplier', icon: '\u{1F4B8}', label: 'ຊຳລະໃຫ້ເຈົ້າໜີ້' },
    ],
  },
  {
    title: 'ຂາຍ',
    items: [
      { path: '/admin/pricing', icon: '\u{1F4B2}', label: 'ກຳນົດລາຄາຂາຍ' },
      { path: '/admin/promotions', icon: '\u{1F381}', label: 'ໂປຣໂມຊັ່ນ' },
      { path: '/admin/members', icon: '\u{1Faaa}', label: 'ສະມາຊິກ' },
      { path: '/admin/loyalty', icon: '\u{2B50}', label: 'ຕັ້ງຄ່າແຕ້ມສະສົມ' },
      { path: '/admin/sales', icon: '\u{1F4CB}', label: 'ປະຫວັດການຂາຍ' },
      { path: '/admin/customer-debts', icon: '\u{1F9FE}', label: 'ໜີ້ລູກຄ້າ' },
      { path: '/admin/debt-payments/customer', icon: '\u{1F4B5}', label: 'ຊຳລະຈາກລູກໜີ້' },
      { path: '/admin/cash-handovers', icon: '\u{1F4B0}', label: 'ລາຍການສົ່ງເງິນ' },
    ],
  },
  {
    title: 'ຕັ້ງຄ່າ',
    items: [
      { path: '/admin/users', icon: '\u{1F464}', label: 'User ແລະ ສິດ' },
      { path: '/admin/currencies', icon: '\u{1F4B1}', label: 'ສະກຸນເງິນ / ອັດຕາ' },
      { path: '/admin/locations', icon: '\u{1F4CD}', label: 'ແຂວງ / ເມືອງ / ບ້ານ' },
      { path: '/admin/company', icon: '\u{1F3E2}', label: 'ຂໍ້ມູນບໍລິສັດ' },
      { path: '/admin/bill-format', icon: '\u{1F9FE}', label: 'ຮູບແບບເລກບິນ' },
    ],
  },
];

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const company = useCompanyProfile();
  const [authorized, setAuthorized] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('pos_user') : null;
    const user = saved ? JSON.parse(saved) : null;
    if (!user || user.role !== 'admin') {
      router.replace('/');
    } else {
      setAuthorized(true);
    }
  }, [router]);

  if (!authorized) return null;

  const sidebar = (
    <>
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-sm overflow-hidden shrink-0">
            {company.logo_url
              ? <img src={company.logo_url} alt="logo" className="w-full h-full object-contain" />
              : '⚙️'}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">{company.name}</div>
            <div className="text-[11px] text-white/50">ຫຼັງບ້ານ</div>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="ປິດເມນູ"
          className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 shrink-0"
        >
          ✕
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {menuSections.map(section => (
          <div key={section.title} className="mb-4 last:mb-0">
            <div className="mb-1.5 px-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
              {section.title}
            </div>
            <div className="space-y-1">
              {section.items.map(item => {
                const isActive = item.path === '/admin' ? pathname === '/admin' : pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`group flex min-h-10 items-center gap-3 rounded-lg border px-3 py-2 text-[13px] font-bold transition-all ${
                      isActive
                        ? 'border-red-500/30 bg-red-500/10 text-white shadow-inner shadow-red-950/30'
                        : 'border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-white'
                    }`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm ${
                      isActive ? 'bg-red-600 text-white' : 'bg-white/5 text-slate-400 group-hover:text-white'
                    }`}>
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {isActive && <span className="h-2 w-2 shrink-0 rounded-full bg-red-400"></span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-2">
        <button
          onClick={() => router.push('/')}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-sm font-medium transition-colors"
        >
          {'←'} ກັບໜ້າ POS
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* Sidebar — desktop (always visible at md+) */}
      <aside className="hidden md:flex w-[260px] bg-slate-950 text-white flex-col shrink-0">
        {sidebar}
      </aside>

      {/* Sidebar — mobile drawer */}
      <div
        className={`md:hidden fixed inset-0 z-40 transition ${mobileOpen ? 'visible' : 'invisible pointer-events-none'}`}
        aria-hidden={!mobileOpen}
      >
        <div
          className={`absolute inset-0 bg-black transition-opacity ${mobileOpen ? 'opacity-50' : 'opacity-0'}`}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={`absolute top-0 left-0 bottom-0 w-[260px] max-w-[85vw] bg-slate-950 text-white flex flex-col shadow-2xl transition-transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          {sidebar}
        </aside>
      </div>

      {/* Main column */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar — only on small screens */}
        <header className="md:hidden flex items-center gap-3 px-4 h-12 bg-white border-b border-slate-200 shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="ເປີດເມນູ"
            className="w-9 h-9 -ml-2 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 bg-red-600 rounded-md flex items-center justify-center text-white text-xs overflow-hidden shrink-0">
              {company.logo_url
                ? <img src={company.logo_url} alt="logo" className="w-full h-full object-contain" />
                : '⚙️'}
            </span>
            <div className="text-sm font-bold text-slate-900 truncate">{company.name}</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="admin-content p-3 sm:p-4 md:p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
