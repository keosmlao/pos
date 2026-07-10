'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { adminMenuSections, isMenuItemActive, normalizePermissions } from '@/utils/adminPermissions';
import ThemeToggle from '@/components/admin/ThemeToggle';

const PINS_KEY = 'admin_sidebar_pins_v1';
const OPEN_KEY = 'admin_sidebar_open_v2';
const MAX_PINS = 12;

function loadOpenSections() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(OPEN_KEY);
    const obj = JSON.parse(raw || 'null');
    return obj && typeof obj === 'object' ? obj : null;
  } catch {
    return null;
  }
}

function saveOpenSections(open) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(OPEN_KEY, JSON.stringify(open)); } catch {}
}

function loadPins() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PINS_KEY);
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr.filter(p => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

function savePins(pins) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(PINS_KEY, JSON.stringify(pins)); } catch {}
}

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '';

export default function AdminSidebar({ company, pathname, user, onClose, onBackToPos, collapsed = false, onToggleCollapse }) {
  const permissions = useMemo(() => normalizePermissions(user?.permissions), [user?.permissions]);
  const visibleSections = useMemo(() => {
    if (user?.role === 'admin') return adminMenuSections;
    return adminMenuSections
      .map(section => ({ ...section, items: section.items.filter(item => permissions[item.path]?.access) }))
      .filter(section => section.items.length > 0);
  }, [permissions, user?.role]);

  const allItems = useMemo(() => {
    const out = [];
    for (const section of visibleSections) {
      for (const item of section.items) {
        out.push({ ...item, section: section.title, sectionIcon: section.icon });
      }
    }
    return out;
  }, [visibleSections]);

  const itemByPath = useMemo(() => Object.fromEntries(allItems.map(it => [it.path, it])), [allItems]);

  const [pins, setPins] = useState([]);
  const [search, setSearch] = useState('');
  // ໝວດໃດເປີດ/ປິດ — ຄ່າເລີ່ມຕົ້ນເປີດໝົດ, ຈື່ໄວ້ໃນເຄື່ອງ
  const [openSections, setOpenSections] = useState({});
  const [openLoaded, setOpenLoaded] = useState(false);

  useEffect(() => { setPins(loadPins()); }, []);
  useEffect(() => { savePins(pins); }, [pins]);
  useEffect(() => {
    setOpenSections(loadOpenSections() || {});
    setOpenLoaded(true);
  }, []);
  useEffect(() => { if (openLoaded) saveOpenSections(openSections); }, [openSections, openLoaded]);

  // ໝວດທີ່ມີໜ້າປັດຈຸບັນຢູ່ ໃຫ້ເປີດສະເໝີ ເພື່ອເຫັນວ່າຢູ່ໃສ
  const activeSection = useMemo(() => {
    const item = [...allItems].sort((a, b) => b.path.length - a.path.length)
      .find(it => isMenuItemActive(it, pathname));
    return item?.section || null;
  }, [allItems, pathname]);

  // ຄ່າເລີ່ມຕົ້ນ: ປິດທຸກໝວດ — ເປີດສະເພາະໝວດຂອງໜ້າປັດຈຸບັນ ຫຼື ທີ່ຜູ້ໃຊ້ເປີດເອງ
  const isSectionOpen = (title) =>
    title === activeSection || openSections[title] === true;

  const toggleSection = (title) =>
    setOpenSections(prev => ({ ...prev, [title]: !isSectionOpen(title) }));

  const togglePin = (path) => {
    setPins(prev => {
      if (prev.includes(path)) return prev.filter(p => p !== path);
      const next = [...prev, path];
      return next.slice(0, MAX_PINS);
    });
  };

  const pinnedItems = useMemo(
    () => pins.map(p => itemByPath[p]).filter(Boolean),
    [pins, itemByPath]
  );

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return allItems.filter(it =>
      it.label.toLowerCase().includes(q) ||
      it.section.toLowerCase().includes(q)
    );
  }, [search, allItems]);

  if (visibleSections.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500 text-sm p-4 text-center">
        ບໍ່ມີສິດເຂົ້າເຖິງເມນູ admin
      </div>
    );
  }

  const isPinned = (path) => pins.includes(path);

  // ໂໝດຫຍໍ້: ສະແດງແຕ່ໄອຄອນ + tooltip — ກົດປຸ່ມລູກສອນເພື່ອຂະຫຍາຍຄືນ
  if (collapsed) {
    return (
      <div className="flex h-full w-full flex-col items-center">
        <div className="pt-3 pb-2">
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-red-500 to-red-700 text-sm font-black text-white shadow-md shadow-red-950/40">
            {company?.logo_url
              ? <img src={company.logo_url} alt="logo" className="h-full w-full object-contain" />
              : (company?.name?.charAt(0).toUpperCase() || 'A')}
          </span>
        </div>
        <button
          onClick={onToggleCollapse}
          title="ຂະຫຍາຍເມນູ"
          className="mb-1 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
        </button>
        <nav className="flex-1 overflow-y-auto w-full px-2 py-1 space-y-0.5">
          {allItems.map(item => {
            const active = isMenuItemActive(item, pathname);
            return (
              <Link
                key={item.path}
                href={item.path}
                title={`${item.label} · ${item.section}`}
                className={`relative flex h-9 items-center justify-center rounded-md text-base transition-colors ${
                  active ? 'bg-red-500/20' : 'opacity-70 hover:opacity-100 hover:bg-white/[0.06]'
                }`}
              >
                {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-red-400" />}
                <span>{item.icon}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/[0.06] py-2 w-full flex flex-col items-center gap-1.5">
          <button
            onClick={onBackToPos}
            title="ກັບໜ້າ POS"
            className="flex h-8 w-8 items-center justify-center rounded-md bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-200 text-sm"
          >
            ←
          </button>
          {APP_VERSION && <div className="text-[9px] font-mono text-slate-600">v{APP_VERSION}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-red-500 to-red-700 text-sm font-black text-white shadow-md shadow-red-950/40">
            {company?.logo_url
              ? <img src={company.logo_url} alt="logo" className="h-full w-full object-contain" />
              : (company?.name?.charAt(0).toUpperCase() || 'A')}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-extrabold text-white leading-tight">{company?.name || 'POS Admin'}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-0.5">
              {user?.display_name ? `${user.display_name} · ${user.role}` : 'Admin Console'}
            </div>
          </div>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title="ຫຍໍ້ເມນູ"
              className="hidden md:flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="ປິດເມນູ"
            className="md:hidden flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ຄົ້ນຫາເມນູ..."
            className="w-full h-8 pl-8 pr-7 bg-white/[0.04] border border-white/10 rounded-lg text-[12px] text-slate-200 placeholder:text-slate-500 outline-none focus:border-red-500/50 focus:bg-white/[0.06]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/10 text-xs"
            >✕</button>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {searchResults ? (
          searchResults.length === 0 ? (
            <div className="py-8 text-center text-[11px] text-slate-500">
              ບໍ່ພົບເມນູທີ່ກົງກັບ &quot;{search}&quot;
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="px-2 pb-1.5 pt-1 text-[9px] font-extrabold uppercase tracking-widest text-slate-500">
                ຜົນຄົ້ນຫາ · {searchResults.length}
              </div>
              {searchResults.map(item => (
                <SidebarItem
                  key={item.path}
                  item={item}
                  pathname={pathname}
                  pinned={isPinned(item.path)}
                  onTogglePin={() => togglePin(item.path)}
                  showSection
                />
              ))}
            </div>
          )
        ) : (
          <>
            {pinnedItems.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center justify-between px-2 pb-1.5 pt-2">
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-amber-400">⭐ ປັກໄວ້</span>
                  <span className="text-[9px] font-bold text-slate-500">{pinnedItems.length}/{MAX_PINS}</span>
                </div>
                <div className="space-y-0.5">
                  {pinnedItems.map(item => (
                    <SidebarItem
                      key={item.path}
                      item={item}
                      pathname={pathname}
                      pinned
                      onTogglePin={() => togglePin(item.path)}
                      showSection
                      pinnedAccent
                    />
                  ))}
                </div>
                <div className="mx-2 mt-2 h-px bg-white/[0.06]" />
              </div>
            )}

            {visibleSections.map(section => {
              const open = isSectionOpen(section.title);
              const hasActive = section.title === activeSection;
              return (
                <div key={section.title} className="mb-0.5">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title)}
                    className={`w-full flex items-center gap-2 rounded-md px-2 py-2 text-[13px] font-extrabold transition-colors select-none ${
                      hasActive ? 'text-white bg-white/[0.03]' : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
                    }`}
                  >
                    <svg
                      width="10" height="10" viewBox="0 0 24 24" fill="currentColor"
                      className={`shrink-0 text-slate-500 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
                    >
                      <path d="M8 5l8 7-8 7V5z" />
                    </svg>
                    <span className="text-sm leading-none shrink-0 w-4 text-center">{section.icon}</span>
                    <span className="truncate flex-1 text-left">{section.title}</span>
                    <span className="text-[9px] font-bold text-slate-600">{section.items.length}</span>
                  </button>
                  {open && (
                    <div className="ml-[13px] border-l border-white/[0.08] pl-1.5 py-0.5 space-y-0.5">
                      {section.items.map(item => (
                        <SidebarItem
                          key={item.path}
                          item={item}
                          pathname={pathname}
                          pinned={isPinned(item.path)}
                          onTogglePin={() => togglePin(item.path)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {pinnedItems.length === 0 && (
              <div className="mx-2 mb-2 rounded-lg border border-dashed border-white/[0.08] px-3 py-2.5 text-[10px] leading-relaxed text-slate-500">
                💡 ກົດ ⭐ ຂ້າງເມນູ ເພື່ອປັກໄວ້ຂ້າງເທິງ
              </div>
            )}
          </>
        )}
      </nav>

      <div className="border-t border-white/[0.06] p-2 space-y-2">
        <ThemeToggle />
        <button
          onClick={onBackToPos}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-xs font-extrabold text-red-200 transition-colors"
        >
          {'←'} ກັບໜ້າ POS
        </button>
        {APP_VERSION && (
          <div className="text-center text-[10px] font-mono text-slate-600">
            {company?.name || 'POS'} · v{APP_VERSION}
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarItem({ item, pathname, pinned, onTogglePin, showSection, pinnedAccent }) {
  const active = isMenuItemActive(item, pathname);
  return (
    <div className="group relative">
      <Link
        href={item.path}
        className={`relative flex items-center gap-2.5 rounded-md pl-2.5 pr-8 py-1.5 text-[12.5px] font-bold transition-colors ${
          active
            ? 'bg-red-500/20 text-white'
            : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
        }`}
      >
        {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-red-400" />}
        <span className={`text-base leading-none shrink-0 ${active ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
          {item.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate">{item.label}</div>
          {showSection && (
            <div className={`text-[9px] font-bold truncate ${pinnedAccent ? 'text-amber-300/70' : 'text-slate-500'}`}>
              {item.section}
            </div>
          )}
        </div>
      </Link>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTogglePin(); }}
        title={pinned ? 'ຍົກເລີກປັກ' : 'ປັກໄວ້ດ້ານເທິງ'}
        className={`absolute right-1.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded text-[12px] transition-all ${
          pinned
            ? 'text-amber-400 opacity-100'
            : 'text-slate-500 opacity-0 group-hover:opacity-100 hover:text-amber-400 hover:bg-white/[0.06]'
        }`}
      >
        {pinned ? '★' : '☆'}
      </button>
    </div>
  );
}
