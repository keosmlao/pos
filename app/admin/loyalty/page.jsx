'use client';

import { useState, useEffect, useMemo } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';

const API = '/api';

const blank = {
  loyalty_enabled: true,
  points_per_amount: 10000,
  points_redeem_value: 100,
  min_points_to_redeem: 100,
  tier_silver_threshold: 5000000,
  tier_gold_threshold: 20000000,
  tier_platinum_threshold: 50000000,
  points_lifetime_months: 0,
};

const fmtNum = (n) => new Intl.NumberFormat('lo-LA').format(Number(n) || 0);

const TIERS = [
  { key: 'tier_silver_threshold',   icon: '🥈', name: 'Silver',   accent: 'slate'   },
  { key: 'tier_gold_threshold',     icon: '🥇', name: 'Gold',     accent: 'amber'   },
  { key: 'tier_platinum_threshold', icon: '💎', name: 'Platinum', accent: 'violet'  },
];

const TIER_THEME = {
  slate:  { ring: 'ring-slate-300',  bg: 'bg-slate-50',  text: 'text-slate-800',  pill: 'bg-slate-200 text-slate-800' },
  amber:  { ring: 'ring-amber-300',  bg: 'bg-amber-50',  text: 'text-amber-900',  pill: 'bg-amber-200 text-amber-900' },
  violet: { ring: 'ring-violet-300', bg: 'bg-violet-50', text: 'text-violet-900', pill: 'bg-violet-200 text-violet-900' },
};

export default function LoyaltySettingsPage() {
  const [form, setForm] = useState(blank);
  const [original, setOriginal] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [previewSpend, setPreviewSpend] = useState(100000);
  const [previewRedeem, setPreviewRedeem] = useState(500);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    fetch(`${API}/admin/loyalty`)
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === 'object') {
          const merged = { ...blank, ...data, loyalty_enabled: data.loyalty_enabled !== false };
          setForm(merged);
          setOriginal(merged);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(original), [form, original]);

  const tierError = useMemo(() => {
    const s = Number(form.tier_silver_threshold);
    const g = Number(form.tier_gold_threshold);
    const p = Number(form.tier_platinum_threshold);
    if (!(s <= g && g <= p)) return 'ຕ້ອງເປັນ Silver ≤ Gold ≤ Platinum';
    return null;
  }, [form.tier_silver_threshold, form.tier_gold_threshold, form.tier_platinum_threshold]);

  const save = async () => {
    if (tierError) { showToast(tierError, 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/loyalty`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        const merged = { ...blank, ...data, loyalty_enabled: data.loyalty_enabled !== false };
        setForm(merged);
        setOriginal(merged);
        const promoted = Number(data.tiers_recomputed) || 0;
        showToast(promoted > 0 ? `ບັນທຶກສຳເລັດ · ປັບລະດັບສະມາຊິກ ${fmtNum(promoted)} ຄົນ` : 'ບັນທຶກສຳເລັດ');
      } else {
        showToast(data.error || 'ບັນທຶກບໍ່ສຳເລັດ', 'error');
      }
    } catch {
      showToast('ບັນທຶກບໍ່ສຳເລັດ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => setForm(original);

  if (loading) {
    return (
      <div className="space-y-4 pb-6">
        <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  const perAmount = Math.max(1, Number(form.points_per_amount) || 10000);
  const redeemValue = Math.max(0, Number(form.points_redeem_value) || 0);
  const minRedeem = Math.max(0, Number(form.min_points_to_redeem) || 0);
  const lifetime = Math.max(0, Number(form.points_lifetime_months) || 0);

  const previewEarn = Math.floor(Math.max(0, Number(previewSpend) || 0) / perAmount);
  const previewRedeemValue = Math.max(0, Number(previewRedeem) || 0) * redeemValue;
  const canRedeem = Number(previewRedeem) >= minRedeem;
  const enabled = form.loyalty_enabled;

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Loyalty"
        title="⭐ ຕັ້ງຄ່າແຕ້ມສະສົມ"
        subtitle="ກຳນົດອັດຕາສະສົມ, ການແລກຄືນ, ແລະ ລະດັບສະມາຊິກ"
        action={
          <div className="flex items-center gap-2">
            {dirty && (
              <button
                onClick={reset}
                disabled={saving}
                className="rounded-xl bg-white/10 hover:bg-white/20 text-white px-3 py-3 text-sm font-bold disabled:opacity-50"
              >
                ↩ ຍົກເລີກ
              </button>
            )}
            <button
              onClick={save}
              disabled={saving || !dirty || !!tierError}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-3 text-sm font-extrabold shadow-lg shadow-red-950/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'ກຳລັງບັນທຶກ...' : dirty ? '💾 ບັນທຶກການປ່ຽນແປງ' : '✓ ບັນທຶກແລ້ວ'}
            </button>
          </div>
        }
        metrics={[
          { label: 'ສະຖານະ', value: enabled ? 'ເປີດໃຊ້' : 'ປິດ', tone: enabled ? 'emerald' : 'rose' },
          { label: 'ຍອດຊື້ / 1 ແຕ້ມ', value: `${fmtNum(perAmount)} ₭` },
          { label: 'ມູນຄ່າ / 1 ແຕ້ມ', value: redeemValue > 0 ? `${fmtNum(redeemValue)} ₭` : 'ປິດ', tone: redeemValue > 0 ? 'violet' : 'slate' },
          { label: 'ອາຍຸແຕ້ມ', value: lifetime > 0 ? `${lifetime} ເດືອນ` : 'ບໍ່ໝົດ', tone: lifetime > 0 ? 'amber' : 'slate' },
        ]}
      />

      {/* Master toggle */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">ເປີດໃຊ້ລະບົບແຕ້ມສະສົມ</h2>
            <p className="mt-1 text-xs text-slate-500">
              ປິດເພື່ອບໍ່ໃຫ້ POS ສະສົມ ຫຼື ແລກແຕ້ມ. ຂໍ້ມູນແຕ້ມຂອງສະມາຊິກຍັງຄົງຢູ່.
            </p>
          </div>
          <Toggle checked={enabled} onChange={(v) => upd('loyalty_enabled', v)} />
        </div>
      </section>

      <div className={enabled ? 'space-y-4' : 'opacity-60 pointer-events-none space-y-4'}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Section icon="💰" title="ການສະສົມແຕ້ມ" desc="ລູກຄ້າຊື້ສິນຄ້າແລ້ວໄດ້ແຕ້ມເທົ່າໃດ">
            <Field
              label="ຍອດຊື້ຕໍ່ 1 ແຕ້ມ (₭)"
              hint="ຕົວຢ່າງ: 10,000 ₭ = 1 ແຕ້ມ"
              value={form.points_per_amount}
              onChange={(v) => upd('points_per_amount', v)}
              min={1}
              suffix="₭"
            />

            <PreviewBox tone="emerald" label="ຕົວຢ່າງການສະສົມ">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 mb-2">
                ຖ້າຊື້ສິນຄ້າ
                <input
                  type="number"
                  min="0"
                  value={previewSpend}
                  onChange={(e) => setPreviewSpend(e.target.value)}
                  className="w-32 px-2 py-1 border border-emerald-200 rounded-md text-sm font-mono text-right bg-white"
                />
                ₭
              </div>
              <div className="text-sm text-slate-700">
                → ໄດ້ <span className="font-mono font-extrabold text-emerald-700 text-lg">{fmtNum(previewEarn)}</span> ແຕ້ມ
              </div>
            </PreviewBox>
          </Section>

          <Section icon="🎁" title="ການແລກຄືນແຕ້ມ" desc="ສະມາຊິກໃຊ້ແຕ້ມເປັນສ່ວນຫຼຸດໄດ້ເທົ່າໃດ">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="ມູນຄ່າ 1 ແຕ້ມ (₭)"
                hint="0 = ປິດການແລກຄືນ"
                value={form.points_redeem_value}
                onChange={(v) => upd('points_redeem_value', v)}
                min={0}
                suffix="₭"
              />
              <Field
                label="ແຕ້ມຂັ້ນຕ່ຳເພື່ອແລກ"
                hint="ຕ້ອງມີຢ່າງໜ້ອຍຈຳນວນນີ້"
                value={form.min_points_to_redeem}
                onChange={(v) => upd('min_points_to_redeem', v)}
                min={0}
              />
            </div>

            <PreviewBox tone={redeemValue > 0 ? 'violet' : 'slate'} label="ຕົວຢ່າງການແລກ">
              {redeemValue > 0 ? (
                <>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600 mb-2">
                    ໃຊ້
                    <input
                      type="number"
                      min="0"
                      value={previewRedeem}
                      onChange={(e) => setPreviewRedeem(e.target.value)}
                      className="w-24 px-2 py-1 border border-violet-200 rounded-md text-sm font-mono text-right bg-white"
                    />
                    ແຕ້ມ
                  </div>
                  <div className="text-sm text-slate-700">
                    → ສ່ວນຫຼຸດ <span className="font-mono font-extrabold text-violet-700 text-lg">{fmtNum(previewRedeemValue)}</span> ₭
                  </div>
                  {!canRedeem && (
                    <div className="mt-2 text-[11px] font-bold text-rose-600">
                      ⚠ ຕ້ອງມີຢ່າງໜ້ອຍ {fmtNum(minRedeem)} ແຕ້ມຈິ່ງແລກໄດ້
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-slate-500 font-bold">ການແລກຄືນຖືກປິດຢູ່</div>
              )}
            </PreviewBox>
          </Section>

          <Section icon="⏰" title="ອາຍຸແຕ້ມສະສົມ" desc={`ວັນໝົດອາຍຸອັບເດດເປັນ ${lifetime || 0} ເດືອນຈາກວັນທີ່ສະສົມໃໝ່`}>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={form.points_lifetime_months}
                  onChange={(e) => upd('points_lifetime_months', e.target.value)}
                  className="w-full px-3 py-2 pr-16 border border-slate-300 rounded-lg text-sm font-mono font-bold text-right outline-none focus:border-red-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">ເດືອນ</span>
              </div>
              <button
                onClick={() => upd('points_lifetime_months', 0)}
                className={`px-3 py-2 rounded-lg text-xs font-extrabold border whitespace-nowrap ${
                  lifetime === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                ບໍ່ໝົດ
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {[3, 6, 12, 24].map((m) => (
                <button
                  key={m}
                  onClick={() => upd('points_lifetime_months', m)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold border ${
                    Number(form.points_lifetime_months) === m
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {m} ເດືອນ
                </button>
              ))}
            </div>
            <PreviewBox tone={lifetime > 0 ? 'amber' : 'slate'} label="ສະຖານະ">
              {lifetime > 0 ? (
                <div className="text-sm text-slate-700">
                  ແຕ້ມຈະຫາຍຫຼັງຈາກ <span className="font-extrabold text-amber-700">{lifetime} ເດືອນ</span> ບໍ່ໃຊ້ງານ
                </div>
              ) : (
                <div className="text-sm text-slate-700 font-bold">ແຕ້ມບໍ່ມີວັນໝົດອາຍຸ</div>
              )}
            </PreviewBox>
          </Section>
        </div>

        {/* Tier system */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">🏆 ລະດັບສະມາຊິກ</h2>
              <p className="mt-1 text-xs text-slate-500">
                ສະມາຊິກຈະຖືກປັບລະດັບອັດຕະໂນມັດເມື່ອຍອດໃຊ້ຈ່າຍສະສົມຮອດເງື່ອນໄຂ
              </p>
            </div>
            {tierError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-1.5 text-[11px] font-extrabold text-rose-700">
                ⚠ {tierError}
              </div>
            )}
          </div>

          {/* Visual progression bar */}
          <TierProgressionBar form={form} />

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Bronze (starting) — informational only */}
            <div className="rounded-xl bg-orange-50 ring-1 ring-orange-200 p-4 flex flex-col">
              <div className="flex items-center justify-between">
                <div className="text-3xl">🥉</div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-orange-200 text-orange-900">Bronze</span>
              </div>
              <label className="mt-3 block text-[11px] font-extrabold uppercase tracking-wider text-orange-900">
                ລະດັບເລີ່ມຕົ້ນ
              </label>
              <div className="mt-1 px-3 py-2 bg-white/60 border border-orange-200 rounded-lg text-sm font-mono font-bold text-orange-900 text-right">
                0 ₭
              </div>
              <div className="mt-2 text-[11px] text-orange-700">ສະມາຊິກໃໝ່ທຸກຄົນ</div>
            </div>

            {TIERS.map((t) => {
              const theme = TIER_THEME[t.accent];
              return (
                <div key={t.key} className={`rounded-xl ${theme.bg} ring-1 ${theme.ring} p-4 flex flex-col`}>
                  <div className="flex items-center justify-between">
                    <div className="text-3xl">{t.icon}</div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${theme.pill}`}>{t.name}</span>
                  </div>
                  <label className={`mt-3 block text-[11px] font-extrabold uppercase tracking-wider ${theme.text}`}>
                    ຍອດໃຊ້ຈ່າຍສະສົມ ≥
                  </label>
                  <div className="mt-1 relative">
                    <input
                      type="number"
                      min="0"
                      value={form[t.key]}
                      onChange={(e) => upd(t.key, e.target.value)}
                      className="w-full px-3 py-2 pr-9 bg-white border border-slate-200 rounded-lg text-sm font-mono font-bold text-right outline-none focus:border-red-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">₭</span>
                  </div>
                  <div className={`mt-2 text-[11px] ${theme.text} font-bold`}>
                    {fmtNum(form[t.key])} ₭ ຂຶ້ນໄປ
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full shadow-2xl text-sm font-semibold z-50 ${
            toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function TierProgressionBar({ form }) {
  const silver = Math.max(0, Number(form.tier_silver_threshold) || 0);
  const gold = Math.max(silver, Number(form.tier_gold_threshold) || 0);
  const platinum = Math.max(gold, Number(form.tier_platinum_threshold) || 0);
  const max = Math.max(platinum * 1.2, 1);

  const pct = (v) => `${Math.min(100, (v / max) * 100)}%`;

  return (
    <div className="mt-4 rounded-xl bg-gradient-to-r from-orange-50 via-slate-50 via-amber-50 to-violet-50 border border-slate-200 px-4 py-5">
      <div className="relative h-2.5 bg-white rounded-full overflow-visible border border-slate-200">
        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-400 via-slate-400 via-amber-400 to-violet-500 rounded-full" style={{ width: '100%' }} />
        {/* Tier markers */}
        {[
          { v: 0,        icon: '🥉', name: 'Bronze',   tone: 'text-orange-700'  },
          { v: silver,   icon: '🥈', name: 'Silver',   tone: 'text-slate-700'   },
          { v: gold,     icon: '🥇', name: 'Gold',     tone: 'text-amber-700'   },
          { v: platinum, icon: '💎', name: 'Platinum', tone: 'text-violet-700'  },
        ].map((m, i) => (
          <div key={i} className="absolute -translate-x-1/2" style={{ left: pct(m.v) }}>
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-4 w-0.5 bg-slate-700" />
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
              <div className="text-lg leading-none">{m.icon}</div>
              <div className={`mt-0.5 text-[10px] font-extrabold uppercase tracking-wider ${m.tone}`}>{m.name}</div>
              <div className="text-[10px] font-mono font-bold text-slate-500">{fmtCompact(m.v)} ₭</div>
            </div>
          </div>
        ))}
      </div>
      <div className="h-14" />
    </div>
  );
}

function fmtCompact(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
        checked ? 'bg-emerald-500' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function Section({ icon, title, desc, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-extrabold text-slate-900">
          <span className="mr-1.5">{icon}</span>{title}
        </h2>
        {desc && <p className="mt-0.5 text-xs text-slate-500">{desc}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, value, onChange, min, suffix }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-600 mb-1">{label}</label>
      <div className="relative">
        <input
          type="number"
          min={min}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold text-right outline-none focus:border-red-500 ${suffix ? 'pr-9' : ''}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>}
      </div>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

function PreviewBox({ tone = 'emerald', label, children }) {
  const cls = {
    emerald: 'bg-emerald-50 border-emerald-200',
    violet:  'bg-violet-50 border-violet-200',
    slate:   'bg-slate-50 border-slate-200',
  }[tone];
  const labelCls = {
    emerald: 'text-emerald-700',
    violet:  'text-violet-700',
    slate:   'text-slate-500',
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <div className={`text-[10px] font-extrabold uppercase tracking-wider ${labelCls}`}>{label}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
