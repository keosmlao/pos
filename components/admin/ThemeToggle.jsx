'use client';

import { useTheme } from '@/components/ThemeProvider';

const OPTIONS = [
  { key: 'light',  label: 'ສະຫວ່າງ', icon: '☀️' },
  { key: 'system', label: 'ລະບົບ',   icon: '🖥️' },
  { key: 'dark',   label: 'ມືດ',     icon: '🌙' },
];

export default function ThemeToggle({ compact = false }) {
  const { theme, setTheme } = useTheme();

  if (compact) {
    // Single icon button that cycles light → dark → system
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    const icon = OPTIONS.find(o => o.key === theme)?.icon || '🖥️';
    return (
      <button
        type="button"
        onClick={() => setTheme(next)}
        title={`ໂໝດ: ${OPTIONS.find(o => o.key === theme)?.label} (ກົດເພື່ອປ່ຽນ)`}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-base hover:bg-white/[0.12] transition-colors"
      >
        {icon}
      </button>
    );
  }

  return (
    <div className="flex rounded-lg bg-white/[0.04] p-0.5 border border-white/[0.06]">
      {OPTIONS.map(opt => {
        const active = theme === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => setTheme(opt.key)}
            title={opt.label}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${
              active
                ? 'bg-red-500/20 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <span>{opt.icon}</span>
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
