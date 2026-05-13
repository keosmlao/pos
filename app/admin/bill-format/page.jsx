'use client';

import { useState, useEffect, useMemo } from 'react';
import { DOCUMENT_NUMBER_TYPES, DOCUMENT_NUMBER_DEFAULTS, previewDocumentNumber } from '@/lib/billNumber';
import { AdminHero } from '@/components/admin/ui/AdminHero';

const API = '/api';

const RESET_LABELS = {
  never: 'ບໍ່ຣີເຊັດ (ໄຫຼຕໍ່ເນື່ອງ)',
  daily: 'ຣີເຊັດທຸກວັນ',
  monthly: 'ຣີເຊັດທຸກເດືອນ (ແນະນຳ)',
  yearly: 'ຣີເຊັດທຸກປີ',
};

const BILL_PRESETS = [
  { label: 'INV-202605-00042', template: '{{prefix}}-{{YYYY}}{{MM}}-{{seq}}' },
  { label: 'INV-20260512-001', template: '{{prefix}}-{{YYYY}}{{MM}}{{DD}}-{{seq}}' },
  { label: 'INV-26-00042', template: '{{prefix}}-{{YY}}-{{seq}}' },
  { label: 'INV00042', template: '{{prefix}}{{seq}}' },
  { label: '00042', template: '{{seq}}' },
];

const RETURN_PRESETS = [
  { label: 'RET-202605-0042', template: '{{prefix}}-{{YYYY}}{{MM}}-{{seq}}' },
  { label: 'RET-20260512-001', template: '{{prefix}}-{{YYYY}}{{MM}}{{DD}}-{{seq}}' },
  { label: 'RET-26-0042', template: '{{prefix}}-{{YY}}-{{seq}}' },
  { label: 'RET0042', template: '{{prefix}}{{seq}}' },
];

const GENERIC_PRESETS = [
  { label: 'DOC-202605-0001', template: '{{prefix}}-{{YYYY}}{{MM}}-{{seq}}' },
  { label: 'DOC-20260513-001', template: '{{prefix}}-{{YYYY}}{{MM}}{{DD}}-{{seq}}' },
  { label: 'DOC-26-0001', template: '{{prefix}}-{{YY}}-{{seq}}' },
  { label: 'DOC0001', template: '{{prefix}}{{seq}}' },
];

const PRESETS_BY_TYPE = {
  bill: BILL_PRESETS,
  return: RETURN_PRESETS,
};

const DEFAULTS = DOCUMENT_NUMBER_DEFAULTS;

export default function BillFormatPage() {
  const [form, setForm] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState(DOCUMENT_NUMBER_TYPES[0].key);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    fetch(`${API}/admin/bill-format`)
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === 'object') {
          setForm({ ...DEFAULTS, ...data });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const previews = useMemo(() => {
    const base = `${tab}_number`;
    const start = Math.max(1, parseInt(form[`${base}_start`], 10) || 1);
    return [
      previewDocumentNumber(tab, form, start),
      previewDocumentNumber(tab, form, start + 1),
      previewDocumentNumber(tab, form, start + 9),
    ];
  }, [form, tab]);

  const save = async () => {
    for (const type of DOCUMENT_NUMBER_TYPES) {
      if (!String(form[`${type.key}_number_template`]).includes('{{seq}}')) {
        showToast(`${type.label} Template ຕ້ອງມີ {{seq}}`, 'error');
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/bill-format`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setForm({ ...DEFAULTS, ...data });
        showToast('ບັນທຶກສຳເລັດ');
      } else {
        showToast(data.error || 'ບັນທຶກບໍ່ສຳເລັດ', 'error');
      }
    } catch {
      showToast('ບັນທຶກບໍ່ສຳເລັດ', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-400 shadow-sm">
        ກຳລັງໂຫຼດ...
      </div>
    );
  }

  const docType = DOCUMENT_NUMBER_TYPES.find(t => t.key === tab) || DOCUMENT_NUMBER_TYPES[0];
  const base = `${docType.key}_number`;
  const cfg = {
    templateKey: `${base}_template`,
    prefixKey: `${base}_prefix`,
    digitsKey: `${base}_seq_digits`,
    resetKey: `${base}_seq_reset`,
    startKey: `${base}_start`,
    presets: PRESETS_BY_TYPE[docType.key] || GENERIC_PRESETS,
    previews,
    title: docType.title,
    subtitle: docType.subtitle,
    accent: 'red',
  };

  const fieldCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-500/10";
  const accentCls = cfg.accent === 'blue'
    ? {
        header: 'from-blue-950 to-slate-950',
        chip: 'bg-blue-50 text-red-700 border-blue-200',
        active: 'border-red-500 bg-blue-50 text-red-700',
        preview: 'text-blue-200',
      }
    : {
        header: 'from-slate-950 to-red-950',
        chip: 'bg-red-50 text-red-700 border-red-200',
        active: 'border-red-500 bg-red-50 text-red-700',
        preview: 'text-emerald-300',
      };

  return (
    <div className="space-y-3 pb-4">
      <AdminHero
        tag="Document numbering"
        title="🧾 ຕັ້ງຄ່າເລກເອກະສານ"
        subtitle="ກຳນົດ format ເລກບິນຂາຍ ແລະ ເລກບິນຮັບຄືນ"
        action={
          <button onClick={save} disabled={saving}
            className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-3 text-sm font-extrabold shadow-lg shadow-red-950/20 disabled:opacity-50">
            {saving ? 'ກຳລັງບັນທຶກ...' : '💾 ບັນທຶກທັງໝົດ'}
          </button>
        }
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-1 gap-2 bg-slate-50 p-2 sm:grid-cols-2">
          {DOCUMENT_NUMBER_TYPES.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-lg border p-2.5 text-left transition ${
                tab === t.key
                  ? 'border-red-500 bg-white shadow-sm'
                  : 'border-transparent bg-transparent hover:bg-white'
              }`}
            >
              <div className="text-xs font-extrabold text-slate-950">{t.label}</div>
              <div className="mt-0.5 truncate font-mono text-[11px] font-bold text-slate-500">
                {previewDocumentNumber(t.key, form)}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[310px_1fr]">
        <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
          <section className={`overflow-hidden rounded-xl bg-gradient-to-br ${accentCls.header} text-white shadow-sm`}>
            <div className="border-b border-white/10 p-4">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-white/50">{cfg.title}</div>
              <h2 className="mt-0.5 text-lg font-extrabold">ຕົວຢ່າງເລກເອກະສານ</h2>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-white/55">{cfg.subtitle}</p>
            </div>
            <div className="space-y-2 p-4">
              {cfg.previews.map((p, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-white/35">Sequence {i + 1}</div>
                  <div className={`mt-1 truncate font-mono text-lg font-black tracking-wide ${accentCls.preview}`}>{p}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Tokens</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['{{prefix}}', '{{YYYY}}', '{{YY}}', '{{MM}}', '{{DD}}', '{{seq}}'].map(token => (
                <code key={token} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-extrabold text-slate-700">{token}</code>
              ))}
            </div>
          </section>
        </aside>

        <main className="space-y-3">
          <Panel title="Template" subtitle="ຕ້ອງມີ {{seq}} ເພື່ອໃຫ້ລະບົບນັບເລກຕໍ່ໄດ້">
            <input
              type="text"
              value={form[cfg.templateKey]}
              onChange={(e) => upd(cfg.templateKey, e.target.value)}
              placeholder="{{prefix}}-{{YYYY}}{{MM}}-{{seq}}"
              className={`${fieldCls} font-mono font-bold`}
            />
            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-slate-600">
              ຕົວຢ່າງປັດຈຸບັນ: <span className="font-mono font-extrabold text-slate-950">{cfg.previews[0]}</span>
            </div>
          </Panel>

          <Panel title="Preset" subtitle="ເລືອກຮູບແບບສຳເລັດຮູບແລ້ວປັບຕໍ່ໄດ້">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {cfg.presets.map((p) => (
                <button
                  key={p.template}
                  type="button"
                  onClick={() => upd(cfg.templateKey, p.template)}
                  className={`rounded-xl border p-3 text-left transition ${
                    form[cfg.templateKey] === p.template
                      ? accentCls.active
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                  }`}
                >
                  <div className="font-mono text-xs font-extrabold">{p.label}</div>
                  <div className="mt-1 truncate font-mono text-[11px] font-semibold text-slate-400">{p.template}</div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Sequence settings" subtitle="ກຳນົດ prefix, ຈຳນວນຫຼັກ ແລະ ຮອບຣີເຊັດ">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Prefix">
                <input
                  type="text"
                  value={form[cfg.prefixKey]}
                  onChange={(e) => upd(cfg.prefixKey, e.target.value)}
                  placeholder="DOC"
                  className={`${fieldCls} font-mono font-bold`}
                />
              </Field>
              <Field label="ຈຳນວນຫຼັກ Sequence">
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={form[cfg.digitsKey]}
                  onChange={(e) => upd(cfg.digitsKey, e.target.value)}
                  className={`${fieldCls} font-mono font-bold`}
                />
                <div className="mt-1 text-[11px] font-semibold text-slate-500">5 = 00001, 4 = 0001</div>
              </Field>
              <Field label="ການຣີເຊັດ Sequence">
                <select
                  value={form[cfg.resetKey]}
                  onChange={(e) => upd(cfg.resetKey, e.target.value)}
                  className={fieldCls}
                >
                  {Object.entries(RESET_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="ເລີ່ມຈາກເລກ">
                <input
                  type="number"
                  min="1"
                  value={form[cfg.startKey]}
                  onChange={(e) => upd(cfg.startKey, e.target.value)}
                  className={`${fieldCls} font-mono font-bold`}
                />
                <div className="mt-1 text-[11px] font-semibold text-slate-500">ໃຊ້ສຳລັບ period ໃໝ່</div>
              </Field>
            </div>
          </Panel>
        </main>
      </div>

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-3 border-t border-slate-200 bg-slate-100/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-red-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}
        </button>
      </div>

      {toast && (
        <div
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg text-sm font-bold z-50 ${
            toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-extrabold text-slate-950">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs font-semibold text-slate-500">{subtitle}</p>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">{label}</span>
      {children}
    </label>
  );
}
