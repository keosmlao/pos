'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { useCompanyProfile } from '@/utils/useCompanyProfile';
import { canAccessAdmin, firstAccessibleAdminPath } from '@/utils/adminPermissions';
import { installAuditFetch } from '@/utils/auditFetch';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const company = useCompanyProfile();
  const [authorized, setAuthorized] = useState(false);
  const [user, setUser] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { installAuditFetch(); }, []);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('pos_user') : null;
    const savedUser = saved ? JSON.parse(saved) : null;
    if (!savedUser || !canAccessAdmin(savedUser, pathname)) {
      const firstPath = firstAccessibleAdminPath(savedUser);
      if (firstPath && firstPath !== pathname) {
        router.replace(firstPath);
        return;
      }
      router.replace('/');
    } else {
      setUser(savedUser);
      setAuthorized(true);
    }
  }, [router, pathname]);

  if (!authorized) return null;

  const sidebarProps = {
    company,
    pathname,
    user,
    onClose: () => setMobileOpen(false),
    onBackToPos: () => router.push('/'),
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <aside className="hidden md:flex w-[230px] bg-slate-950 text-white shrink-0">
        <AdminSidebar {...sidebarProps} />
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
                : '\u2699\ufe0f'}
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
