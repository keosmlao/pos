'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';
import ThemeToggle from '@/components/admin/ThemeToggle';
import { useCompanyProfile } from '@/utils/useCompanyProfile';
import { canAccessAdmin, firstAccessibleAdminPath, adminMenuItems, isMenuItemActive } from '@/utils/adminPermissions';
import { installAuditFetch } from '@/utils/auditFetch';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const company = useCompanyProfile();
  const [authorized, setAuthorized] = useState(false);
  const [user, setUser] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem('admin_sidebar_collapsed_v1') === '1'); } catch {}
  }, []);
  const toggleCollapsed = () => {
    setCollapsed(prev => {
      try { localStorage.setItem('admin_sidebar_collapsed_v1', prev ? '0' : '1'); } catch {}
      return !prev;
    });
  };

  useEffect(() => { installAuditFetch(); }, []);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('pos_user') : null;
    if (!saved) { router.replace('/'); return; }
    fetch('/api/session').then(async (res) => {
      if (!res.ok) throw new Error('unauthorized');
      const savedUser = await res.json();
      localStorage.setItem('pos_user', JSON.stringify(savedUser));
      if (!canAccessAdmin(savedUser, pathname)) {
        const firstPath = firstAccessibleAdminPath(savedUser);
        router.replace(firstPath || '/');
        return;
      }
      setUser(savedUser);
      setAuthorized(true);
    }).catch(() => {
      localStorage.removeItem('pos_user');
      router.replace('/');
    });
  }, [router, pathname]);

  if (!authorized) return null;

  // ຊື່ໜ້າປັດຈຸບັນສຳລັບ topbar
  const currentItem = [...adminMenuItems]
    .sort((a, b) => b.path.length - a.path.length)
    .find(item => isMenuItemActive(item, pathname));

  const handleLogout = () => {
    fetch('/api/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem('pos_user');
    router.replace('/');
  };

  const sidebarProps = {
    company,
    pathname,
    user,
    onClose: () => setMobileOpen(false),
    onBackToPos: () => router.push('/'),
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      <aside className={`hidden md:flex bg-slate-950 text-white shrink-0 transition-[width] duration-200 ${collapsed ? 'w-[60px]' : 'w-[230px]'}`}>
        <AdminSidebar {...sidebarProps} collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      </aside>

      <div
        className={`md:hidden fixed inset-0 z-40 transition ${mobileOpen ? 'visible' : 'invisible pointer-events-none'}`}
        aria-hidden={!mobileOpen}
      >
        <div
          className={`absolute inset-0 bg-black transition-opacity ${mobileOpen ? 'opacity-50' : 'opacity-0'}`}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={`absolute top-0 left-0 bottom-0 w-[230px] max-w-[90vw] bg-slate-950 text-white shadow-2xl transition-transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <AdminSidebar {...sidebarProps} />
        </aside>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden flex items-center gap-3 px-4 h-12 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="ເປີດເມນູ"
            className="w-9 h-9 -ml-2 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="w-7 h-7 bg-red-600 rounded-md flex items-center justify-center text-white text-xs overflow-hidden shrink-0">
              {company.logo_url
                ? <img src={company.logo_url} alt="logo" className="w-full h-full object-contain" />
                : '\u2699\ufe0f'}
            </span>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{company.name}</div>
          </div>
          <ThemeToggle compact />
        </header>

        {/* Desktop topbar: ຊື່ໜ້າ + ໂໝດມືດ + ຜູ້ໃຊ້ + ອອກຈາກລະບົບ */}
        <header className="hidden md:flex items-center gap-3 px-5 h-14 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="text-xl leading-none">{currentItem?.icon || '📊'}</span>
            <div className="min-w-0">
              <div className="text-[15px] font-extrabold text-slate-900 dark:text-slate-100 truncate leading-tight">
                {currentItem?.label || 'ແຜງຄວບຄຸມ'}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {currentItem?.section || 'Admin'}
              </div>
            </div>
          </div>
          <ThemeToggle compact />
          <div className="flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-slate-700">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 text-xs font-black text-white">
              {(user?.display_name || user?.username || '?').charAt(0).toUpperCase()}
            </span>
            <div className="leading-tight">
              <div className="text-[12px] font-extrabold text-slate-800 dark:text-slate-200">{user?.display_name || user?.username}</div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{user?.role}</div>
            </div>
            <button
              onClick={handleLogout}
              title="ອອກຈາກລະບົບ"
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="admin-content p-3 sm:p-4 md:p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
