'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminMenuSections, isMenuItemActive, normalizePermissions } from '@/utils/adminPermissions';
import ThemeToggle from '@/components/admin/ThemeToggle';
import * as LucideIcons from 'lucide-react';

const PINS_KEY = 'admin_sidebar_pins_v1';
const OPEN_KEY = 'admin_sidebar_open_v2';
const RECENT_KEY = 'admin_sidebar_recent_v1';
const MAX_PINS = 12;
const MAX_RECENT = 5;

// ── Dynamic icon resolver ──────────────────────────────────────────
function SidebarIcon({ name, size = 16, className = '', fallback = '' }) {
  const IconComponent = LucideIcons[name];
  if (IconComponent) {
    return <IconComponent size={size} className={className} />;
  }
  return <span className={className} style={{ fontSize: size }}>{fallback}</span>;
}

// ── localStorage helpers ───────────────────────────────────────────
function loadJSON(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    const val = JSON.parse(raw || 'null');
    return val !== null && val !== undefined ? val : fallback;
  } catch { return fallback; }
}

function saveJSON(key, value) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ── Highlight matching text ────────────────────────────────────────
function HighlightText({ text, query }) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-500/30 text-white rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────
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
        out.push({ ...item, section: section.title, sectionIcon: section.icon, sectionIconName: section.iconName });
      }
    }
    return out;
  }, [visibleSections]);

  const itemByPath = useMemo(() => Object.fromEntries(allItems.map(it => [it.path, it])), [allItems]);

  const [pins, setPins] = useState([]);
  const [search, setSearch] = useState('');
  const [openSections, setOpenSections] = useState({});
  const [openLoaded, setOpenLoaded] = useState(false);
  const [recent, setRecent] = useState([]);
  const searchRef = useRef(null);
  const navRef = useRef(null);
  const [focusIdx, setFocusIdx] = useState(-1);

  useEffect(() => { setPins(loadJSON(PINS_KEY, [])); }, []);
  useEffect(() => { saveJSON(PINS_KEY, pins); }, [pins]);
  useEffect(() => {
    setOpenSections(loadJSON(OPEN_KEY, {}));
    setOpenLoaded(true);
  }, []);
  useEffect(() => { if (openLoaded) saveJSON(OPEN_KEY, openSections); }, [openSections, openLoaded]);
  useEffect(() => {
    const saved = loadJSON(RECENT_KEY, []);
    setRecent(Array.isArray(saved) ? saved : []);
  }, []);
  useEffect(() => { saveJSON(RECENT_KEY, recent); }, [recent]);

  // Track recent pages on navigation
  useEffect(() => {
    const item = allItems.find(it => isMenuItemActive(it, pathname));
    if (item) {
      setRecent(prev => {
        const filtered = prev.filter(p => p !== item.path);
        return [item.path, ...filtered].slice(0, MAX_RECENT);
      });
    }
  }, [pathname, allItems]);

  const activeSection = useMemo(() => {
    const item = [...allItems].sort((a, b) => b.path.length - a.path.length)
      .find(it => isMenuItemActive(it, pathname));
    return item?.section || null;
  }, [allItems, pathname]);

  const isSectionOpen = (title) => title === activeSection || openSections[title] === true;

  const toggleSection = (title) =>
    setOpenSections(prev => ({ ...prev, [title]: !isSectionOpen(title) }));

  const togglePin = (path) => {
    setPins(prev => {
      if (prev.includes(path)) return prev.filter(p => p !== path);
      return [...prev, path].slice(0, MAX_PINS);
    });
  };

  const pinnedItems = useMemo(() => pins.map(p => itemByPath[p]).filter(Boolean), [pins, itemByPath]);
  const recentItems = useMemo(() => recent.map(p => itemByPath[p]).filter(Boolean), [recent, itemByPath]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return allItems.filter(it =>
      it.label.toLowerCase().includes(q) ||
      it.section.toLowerCase().includes(q)
    );
  }, [search, allItems]);

  const isPinned = (path) => pins.includes(path);

  // ── Keyboard shortcut: Cmd+K / Ctrl+K to focus search ──────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        if (search) { setSearch(''); setFocusIdx(-1); }
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [search]);

  // ── Keyboard navigation in search results ──────────────────────
  const handleSearchKeyDown = useCallback((e) => {
    if (!searchResults || searchResults.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIdx(prev => Math.min(prev + 1, searchResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && focusIdx >= 0) {
      e.preventDefault();
      const item = searchResults[focusIdx];
      if (item) window.location.href = item.path;
    }
  }, [searchResults, focusIdx]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusIdx >= 0 && navRef.current) {
      const items = navRef.current.querySelectorAll('[data-search-item]');
      if (items[focusIdx]) items[focusIdx].scrollIntoView({ block: 'nearest' });
    }
  }, [focusIdx]);

  // ── No permissions ──────────────────────────────────────────────
  if (visibleSections.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500 text-sm p-4 text-center">
        ບໍ່ມີສິດເຂົ້າເຖິງເມນູ admin
      </div>
    );
  }

  // ── Collapsed mode ──────────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center">
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
          className="mb-1 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
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
                title={`${item.label} \u00B7 ${item.section}`}
                className={`group relative flex h-9 items-center justify-center rounded-lg text-sm transition-all ${
                  active
                    ? 'bg-red-500/20 text-white'
                    : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-red-400" />}
                <SidebarIcon name={item.iconName} size={16} className="shrink-0" fallback={item.icon} />
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/[0.06] py-2 w-full flex flex-col items-center gap-1.5">
          <button
            onClick={onBackToPos}
            title="ກັບໜ້າ POS"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-200 text-sm transition-colors"
          >
            ←
          </button>
          {process.env.NEXT_PUBLIC_APP_VERSION && (
            <div className="text-[9px] font-mono text-slate-600">v{process.env.NEXT_PUBLIC_APP_VERSION}</div>
          )}
        </div>
      </div>
    );
  }

  // ── Full sidebar ────────────────────────────────────────────────
  return (
    <div className="admin-sidebar-panel flex h-full flex-col">
      {/* Brand header */}
      <div className="sidebar-brand mx-3 mt-3 rounded-2xl p-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-red-500 to-red-700 text-sm font-black text-white shadow-lg shadow-red-950/20 ring-1 ring-white/15">
            {company?.logo_url
              ? <img src={company.logo_url} alt="logo" className="h-full w-full object-contain" />
              : (company?.name?.charAt(0).toUpperCase() || 'A')}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-extrabold text-white leading-tight">{company?.name || 'POS Admin'}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
              {user?.display_name ? `${user.display_name} \u00B7 ${user.role}` : 'Admin Console'}
            </div>
          </div>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title="ຫຍໍ້ເມນູ"
              className="hidden md:flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="ປິດເມນູ"
            className="md:hidden flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pb-3 pt-3">
        <div className="relative">
          <SidebarIcon name="Search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setFocusIdx(-1); }}
            onKeyDown={handleSearchKeyDown}
            placeholder="ຄົ້ນຫາເມນູ..."
            className="sidebar-search w-full h-10 pl-9 pr-8 bg-white/[0.04] border border-white/10 rounded-xl text-[12px] font-semibold text-slate-200 placeholder:text-slate-500 outline-none focus:border-red-500/50 focus:bg-white/[0.06] focus:ring-4 focus:ring-red-500/5 transition-all"
          />
          {search ? (
            <button
              onClick={() => { setSearch(''); setFocusIdx(-1); }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/10 text-xs"
            >✕</button>
          ) : (
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white/[0.06] text-[9px] font-bold text-slate-500 border border-white/[0.08]">
              <span className="text-[8px]">⌘</span>K
            </kbd>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav ref={navRef} className="sidebar-nav flex-1 overflow-y-auto px-2.5 pb-3">
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
              {searchResults.map((item, idx) => (
                <div
                  key={item.path}
                  data-search-item
                  data-focused={focusIdx === idx ? 'true' : undefined}
                  className={`rounded-xl transition-all ${
                    focusIdx === idx ? 'ring-1 ring-red-500/40 bg-white/[0.04]' : ''
                  }`}
                >
                  <SidebarItem
                    item={item}
                    pathname={pathname}
                    pinned={isPinned(item.path)}
                    onTogglePin={() => togglePin(item.path)}
                    showSection
                    searchQuery={search}
                  />
                </div>
              ))}
            </div>
          )
        ) : (
          <>
            {/* Recent section */}
            {recentItems.length > 0 && pinnedItems.length < MAX_PINS && (
              <div className="mb-3">
                <div className="flex items-center gap-2 px-2 pb-1.5 pt-2">
                  <SidebarIcon name="Clock" size={11} className="text-slate-500" />
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500">ຫຼ້າສຸດ</span>
                </div>
                <div className="space-y-0.5">
                  {recentItems.map(item => (
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
                <div className="mx-2 mt-2 h-px bg-white/[0.06]" />
              </div>
            )}

            {/* Pinned section */}
            {pinnedItems.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center justify-between px-2 pb-1.5 pt-2">
                  <div className="flex items-center gap-2">
                    <SidebarIcon name="Pin" size={11} className="text-amber-400" />
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-amber-400">ປັກໄວ້</span>
                  </div>
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

            {/* Section menus */}
            {visibleSections.map(section => {
              const open = isSectionOpen(section.title);
              const hasActive = section.title === activeSection;
              return (
                <div key={section.title} className="mb-1">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title)}
                    className={`sidebar-section w-full flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[12.5px] font-extrabold leading-5 transition-all select-none ${
                      hasActive ? 'text-white bg-white/[0.03]' : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
                    }`}
                  >
                    <svg
                      width="10" height="10" viewBox="0 0 24 24" fill="currentColor"
                      className={`shrink-0 text-slate-500 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
                    >
                      <path d="M8 5l8 7-8 7V5z" />
                    </svg>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm leading-none transition-all ${
                      hasActive ? 'bg-red-500/15 text-red-300' : 'bg-white/[0.04] text-slate-400'
                    }`}>
                      <SidebarIcon name={section.iconName} size={14} fallback={section.icon} />
                    </span>
                    <span className="truncate flex-1 text-left">{section.title}</span>
                    <span className="flex min-w-5 h-5 items-center justify-center rounded-full bg-white/[0.04] px-1.5 text-[9px] font-bold text-slate-500">{section.items.length}</span>
                  </button>
                  <div className={`sidebar-section-content overflow-hidden transition-all duration-200 ease-in-out ${
                    open ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
                  }`}>
                    <div className="ml-[21px] border-l border-white/[0.08] pl-2 py-1 space-y-1">
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
                  </div>
                </div>
              );
            })}

            {pinnedItems.length === 0 && recentItems.length === 0 && (
              <div className="mx-2 mb-2 rounded-lg border border-dashed border-white/[0.08] px-3 py-2.5 text-[10px] leading-relaxed text-slate-500">
                ກົດ ☆ ຂ້າງເມນູ ເພື່ອປັກໄວ້ຂ້າງເທິງ
              </div>
            )}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer border-t border-white/[0.06] p-3 space-y-2">
        <ThemeToggle />
        <button
          onClick={onBackToPos}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-xs font-extrabold text-red-200 transition-all hover:-translate-y-px active:translate-y-0"
        >
          <SidebarIcon name="ArrowLeft" size={14} />
          ກັບໜ້າ POS
        </button>
        {process.env.NEXT_PUBLIC_APP_VERSION && (
          <div className="text-center text-[10px] font-mono text-slate-600">
            {company?.name || 'POS'} · v{process.env.NEXT_PUBLIC_APP_VERSION}
          </div>
        )}
      </div>
    </div>
  );
}

// ── SidebarItem ────────────────────────────────────────────────────
function SidebarItem({ item, pathname, pinned, onTogglePin, showSection, pinnedAccent, searchQuery }) {
  const active = isMenuItemActive(item, pathname);
  return (
    <div className="group relative">
      <Link
        href={item.path}
        className={`sidebar-item relative flex items-center gap-2.5 rounded-xl pl-2.5 pr-8 py-1.5 text-[12px] font-bold leading-5 transition-all ${
          active
            ? 'bg-gradient-to-r from-red-600/35 to-red-500/10 text-white shadow-sm shadow-red-950/20'
            : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'
        }`}
      >
        {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-red-400" />}
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm leading-none transition-all ${
          active ? 'bg-white/10 opacity-100' : 'bg-white/[0.03] opacity-80 group-hover:opacity-100'
        }`}>
          <SidebarIcon name={item.iconName} size={14} fallback={item.icon} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate">
            {searchQuery ? <HighlightText text={item.label} query={searchQuery} /> : item.label}
          </div>
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
        {pinned ? (
          <SidebarIcon name="Star" size={12} className="fill-amber-400" />
        ) : (
          <SidebarIcon name="Star" size={12} />
        )}
      </button>
    </div>
  );
}