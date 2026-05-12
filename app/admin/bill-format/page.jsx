'use client';

import { useState, useEffect, useMemo } from 'react';
import { previewBillNumber, BILL_NUMBER_DEFAULTS } from '@/lib/billNumber';

const API = '/api';

const RESET_LABELS = {
  never: 'ບໍ່ຣີເຊັດ (ໄຫຼຕໍ່ເນື່ອງ)',
  daily: 'ຣີເຊັດທຸກວັນ',
  monthly: 'ຣີເຊັດທຸກເດືອນ (ແນະນຳ)',
  yearly: 'ຣີເຊັດທຸກປີ',
};

const TEMPLATE_PRESETS = [
  { label: 'INV-202605-00042', template: '{{prefix}}-{{YYYY}}{{MM}}-{{seq}}' },
  { label: 'INV-20260512-001', template: '{{prefix}}-{{YYYY}}{{MM}}{{DD}}-{{seq}}' },
  { label: 'INV-26-00042', template: '{{prefix}}-{{YY}}-{{seq}}' },
  { label: 'INV00042', template: '{{prefix}}{{seq}}' },
  { label: '00042', template: '{{seq}}' },
];

export default function BillFormatPage() {
  const [form, setForm] = useState(BILL_NUMBER_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    fetch(`${API}/admin/bill-format`)
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === 'object') {
          setForm({ ...BILL_NUMBER_DEFAULTS, ...data });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const previews = useMemo(() => {
    const start = Math.max(1, parseInt(form.bill_number_start, 10) || 1);
    return [
      previewBillNumber(form, start),
      previewBillNumber(form, start + 1),
      previewBillNumber(form, start + 41),
    ];
  }, [form]);

  const save = async () => {
    if (!String(form.bill_number_template).includes('{{seq}}')) {
      showToast('Template ຕ້ອງມີ {{seq}}', 'error');
      return;
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
        setForm({ ...BILL_NUMBER_DEFAULTS, ...data });
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

  if (loading) return <div className="text-sm text-slate-500">ກຳລັງໂຫຼດ...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">ຕັ້ງຄ່າເລກບິນ</h1>
          <p className="text-xs text-slate-500 mt-0.5">ກຳນົດ format ຂອງເລກບິນ POS ໃຫ້ເຫມາະກັບຮ້ານ</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg disabled:opacity-50"
        >
          {saving ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}
        </button>
      </div>

      <section className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 text-white">
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">ຕົວຢ່າງເລກບິນ</div>
        <div className="space-y-1.5">
          {previews.map((p, i) => (
            <div key={i} className="font-mono text-xl font-extrabold text-emerald-300 tracking-wide">{p}</div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Template</label>
          <input
            type="text"
            value={form.bill_number_template}
            onChange={(e) => upd('bill_number_template', e.target.value)}
            placeholder="{{prefix}}-{{YYYY}}{{MM}}-{{seq}}"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            ໃຊ້ໄດ້: <code className="bg-slate-100 px-1 rounded">{'{{prefix}}'}</code>{' '}
            <code className="bg-slate-100 px-1 rounded">{'{{YYYY}}'}</code>{' '}
            <code className="bg-slate-100 px-1 rounded">{'{{YY}}'}</code>{' '}
            <code className="bg-slate-100 px-1 rounded">{'{{MM}}'}</code>{' '}
            <code className="bg-slate-100 px-1 rounded">{'{{DD}}'}</code>{' '}
            <code className="bg-slate-100 px-1 rounded">{'{{seq}}'}</code>
          </p>
        </div>

        <div>
          <div className="text-xs font-bold text-slate-600 mb-1">Preset</div>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_PRESETS.map((p) => (
              <button
                key={p.template}
                type="button"
                onClick={() => upd('bill_number_template', p.template)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                  form.bill_number_template === p.template
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Prefix</label>
            <input
              type="text"
              value={form.bill_number_prefix}
              onChange={(e) => upd('bill_number_prefix', e.target.value)}
              placeholder="INV"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">ຈຳນວນຫຼັກ Sequence</label>
            <input
              type="number"
              min="1"
              max="12"
              value={form.bill_number_seq_digits}
              onChange={(e) => upd('bill_number_seq_digits', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">5 = 00001, 4 = 0001 ...</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">ການຣີເຊັດ Sequence</label>
            <select
              value={form.bill_number_seq_reset}
              onChange={(e) => upd('bill_number_seq_reset', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              {Object.entries(RESET_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">ເລີ່ມຈາກເລກ</label>
            <input
              type="number"
              min="1"
              value={form.bill_number_start}
              onChange={(e) => upd('bill_number_start', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">ໃຊ້ສຳລັບ period ໃໝ່. ບໍ່ກະທົບ sequence ປັດຈຸບັນທີ່ນັບສູງກວ່າ</p>
          </div>
        </div>
      </section>

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
