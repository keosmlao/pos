'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';
import { usePagePermission } from '@/utils/adminPermissions';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Number(n) || 0);
const signed = n => (Number(n) > 0 ? `+${fmtNum(n)}` : fmtNum(n));

export default function StockReconcilePage() {
  const perm = usePagePermission('/admin/stock-reconcile');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modes, setModes] = useState({});      // product_id -> 'trust_stock' | 'trust_docs' | 'skip'
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/admin/stock-reconcile`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setData(d);
      // ຄ່າເລີ່ມຕົ້ນ: ຍັງບໍ່ເລືອກ ຕ້ອງໃຫ້ຄົນຕັດສິນໃຈເອງ
      setModes(Object.fromEntries((d.items || []).map(i => [i.product_id, 'skip'])));
    } catch (e) {
      setData(null);
      setError(`ດຶງຂໍ້ມູນບໍ່ໄດ້: ${e.message}`);
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const term = search.trim().toLowerCase();
  const items = useMemo(() => {
    const rows = data?.items || [];
    if (!term) return rows;
    return rows.filter(r => [r.product_code, r.product_name].some(v => String(v || '').toLowerCase().includes(term)));
  }, [data, term]);

  const decisions = useMemo(
    () => (data?.items || [])
      .filter(i => modes[i.product_id] && modes[i.product_id] !== 'skip')
      .map(i => ({ product_id: i.product_id, mode: modes[i.product_id] })),
    [data, modes]
  );

  const setAll = (mode) => setModes(Object.fromEntries(items.map(i => [i.product_id, mode])));

  const runPreview = async () => {
    if (decisions.length === 0) return showToast('ຍັງບໍ່ໄດ້ເລືອກລາຍການໃດ', 'error');
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/stock-reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apply: false, decisions }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
      setPreview(d);
    } catch (e) {
      showToast(`ບໍ່ສຳເລັດ: ${e.message}`, 'error');
    }
    setSaving(false);
  };

  const applyFix = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/stock-reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apply: true, decisions }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
      setPreview(null);
      showToast(`ແກ້ໄຂແລ້ວ ${d.count} ລາຍການ`);
      await load();
    } catch (e) {
      showToast(`ບໍ່ສຳເລັດ: ${e.message}`, 'error');
    }
    setSaving(false);
  };

  const balanced = data && data.total === 0;

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Stock Reconcile"
        title="⚖ ກວດຄວາມສົມດຸນສະຕັອກ"
        subtitle="ຊອກຫາສິນຄ້າທີ່ຈຳນວນໃນລະບົບບໍ່ຕົງກັບເອກະສານຮັບເຂົ້າ-ຈ່າຍອອກ"
      />

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-600 leading-relaxed">
        <b className="text-slate-800">ຫຼັກການ:</b> ຈຳນວນໃນລະບົບຄວນເທົ່າກັບຜົນລວມການເຄື່ອນໄຫວທີ່ມີເອກະສານ.
        ຖ້າບໍ່ຕົງ ແປວ່າມີການປ່ຽນສະຕັອກທີ່ບໍ່ມີເອກະສານ — ພິມຍອດຕອນສ້າງສິນຄ້າ, ນຳເຂົ້າ CSV
        ຫຼື ແກ້ຈຳນວນໃນໜ້າຈັດການສິນຄ້າ. ໜ້ານີ້ບໍ່ໄດ້ "ຄິດຍອດໃໝ່ທັບລົງ" — ມັນອອກ<b className="text-slate-800">ເອກະສານ</b>ອະທິບາຍສ່ວນຕ່າງ
        ຫຼື ປັບຈຳນວນຕາມທີ່ທ່ານຕັດສິນໃຈລາຍລາຍການ.
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-400">ກຳລັງກວດ...</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>
      ) : balanced ? (
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 py-16 text-center">
          <div className="text-5xl">✅</div>
          <div className="mt-3 text-lg font-extrabold text-emerald-800">ສະຕັອກສົມດຸນທັງໝົດ</div>
          <div className="text-xs text-emerald-700 mt-1">ທຸກລາຍການມີເອກະສານອະທິບາຍຄົບຖ້ວນ</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="ລາຍການທີ່ບໍ່ຕົງ" value={fmtNum(data.total)} accent="rose" highlight />
            <Kpi label="ໃນລະບົບຫຼາຍກວ່າ" value={fmtNum(data.surplus)} accent="amber" />
            <Kpi label="ໃນລະບົບໜ້ອຍກວ່າ" value={fmtNum(data.shortage)} accent="cyan" />
            <Kpi label="ສ່ວນຕ່າງສຸດທິ" value={signed(data.net_diff)} />
          </div>

          <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200 flex flex-wrap items-center gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ຄົ້ນຫາ ລະຫັດ / ຊື່ສິນຄ້າ..."
              className="flex-1 min-w-[200px] px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            <span className="text-[11px] font-bold text-slate-400">ເລືອກທັງໝົດເປັນ:</span>
            <button onClick={() => setAll('trust_stock')}
              className="px-3 py-2 rounded-lg text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
              ຂອງໃນສາງຖືກ
            </button>
            <button onClick={() => setAll('trust_docs')}
              className="px-3 py-2 rounded-lg text-xs font-extrabold bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100">
              ເອກະສານຖືກ
            </button>
            <button onClick={() => setAll('skip')}
              className="px-3 py-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100">ລ້າງ</button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto max-h-[560px]">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-bold text-slate-600">ສິນຄ້າ</th>
                    <th className="px-3 py-2 font-bold text-slate-600 text-right">ໃນລະບົບ</th>
                    <th className="px-3 py-2 font-bold text-slate-600 text-right">ຕາມເອກະສານ</th>
                    <th className="px-3 py-2 font-bold text-slate-600 text-right">ຕ່າງ</th>
                    <th className="px-3 py-2 font-bold text-slate-600">ຈະແກ້ແນວໃດ</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">ບໍ່ພົບລາຍການ</td></tr>
                  ) : items.map(i => {
                    const mode = modes[i.product_id] || 'skip';
                    return (
                      <tr key={i.product_id} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <div className="font-bold text-slate-900">{i.product_name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {i.product_code} · {i.unit}
                            {i.no_documents
                              ? ' · ບໍ່ມີເອກະສານເລີຍ'
                              : ` · ເອກະສານທຳອິດ ${String(i.first_doc_at || '').slice(0, 10).split('-').reverse().join('/')}`}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold">{fmtNum(i.stock_qty)}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600">{fmtNum(i.doc_qty)}</td>
                        <td className={`px-3 py-2 text-right font-mono font-extrabold ${i.diff > 0 ? 'text-amber-700' : 'text-cyan-700'}`}>
                          {signed(i.diff)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            <Choice
                              checked={mode === 'trust_stock'}
                              onChange={() => setModes({ ...modes, [i.product_id]: 'trust_stock' })}
                              title={`ຂອງໃນສາງຖືກ (${fmtNum(i.stock_qty)})`}
                              desc={`ອອກໃບປັບປຸງ “ຍອດຍົກມາ” ${signed(i.diff)} · ຈຳນວນບໍ່ປ່ຽນ`}
                              tone="emerald"
                            />
                            <Choice
                              checked={mode === 'trust_docs'}
                              onChange={() => setModes({ ...modes, [i.product_id]: 'trust_docs' })}
                              title={`ເອກະສານຖືກ (${fmtNum(i.doc_qty)})`}
                              desc={`ປັບຈຳນວນ ${fmtNum(i.stock_qty)} → ${fmtNum(i.doc_qty)} · ບັນທຶກໃນປະຫວັດການເຮັດວຽກ`}
                              tone="cyan"
                            />
                            <Choice
                              checked={mode === 'skip'}
                              onChange={() => setModes({ ...modes, [i.product_id]: 'skip' })}
                              title="ຍັງບໍ່ແກ້"
                              desc="ຂ້າມລາຍການນີ້ໄວ້ກ່ອນ"
                              tone="slate"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 rounded-xl border-2 border-slate-800 bg-slate-900 p-4 shadow-2xl flex items-center justify-between gap-4">
            <div className="text-white">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">ເລືອກໄວ້ແລ້ວ</div>
              <div className="mt-0.5 text-2xl font-extrabold font-mono">{fmtNum(decisions.length)} / {fmtNum(data.total)}</div>
            </div>
            {perm.edit && (
              <button onClick={runPreview} disabled={saving || decisions.length === 0}
                className="rounded-xl bg-white px-6 py-3 text-sm font-extrabold text-slate-900 shadow-lg hover:bg-slate-100 disabled:opacity-40">
                {saving ? 'ກຳລັງກວດ...' : 'ເບິ່ງຜົນກ່ອນ'}
              </button>
            )}
          </div>
        </>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <div className="font-extrabold text-slate-900">ຜົນທີ່ຈະເກີດຂຶ້ນ (ຍັງບໍ່ໄດ້ບັນທຶກ)</div>
                <div className="text-xs text-slate-500">{fmtNum(preview.count)} ລາຍການ</div>
              </div>
              <button onClick={() => setPreview(null)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-bold text-slate-600">ສິນຄ້າ</th>
                    <th className="px-3 py-2 font-bold text-slate-600">ຈະເຮັດຫຍັງ</th>
                    <th className="px-3 py-2 font-bold text-slate-600 text-right">ຈຳນວນຫຼັງແກ້</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.results.map(r => (
                    <tr key={r.product_id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <div className="font-bold text-slate-900">{r.product_name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{r.product_code}</div>
                      </td>
                      <td className="px-3 py-2">
                        {r.action === 'opening_document' ? (
                          <span className="text-emerald-700 font-bold">
                            ອອກໃບປັບປຸງ “ຍອດຍົກມາ” {signed(r.delta)} ລົງວັນທີ {String(r.first_doc_at || '').slice(0, 10).split('-').reverse().join('/')}
                          </span>
                        ) : (
                          <span className="text-cyan-700 font-bold">
                            ປັບຈຳນວນ {fmtNum(r.stock_qty)} → {fmtNum(r.doc_qty)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-extrabold">{fmtNum(r.new_stock_qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button onClick={() => setPreview(null)} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100">ຍົກເລີກ</button>
              <button onClick={applyFix} disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-extrabold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40">
                {saving ? 'ກຳລັງບັນທຶກ...' : `ຢືນຢັນ ແກ້ໄຂ ${fmtNum(preview.count)} ລາຍການ`}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full shadow-2xl text-sm font-semibold z-50 ${toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function Choice({ checked, onChange, title, desc, tone }) {
  const on = {
    emerald: 'border-emerald-400 bg-emerald-50',
    cyan: 'border-cyan-400 bg-cyan-50',
    slate: 'border-slate-400 bg-slate-50',
  }[tone];
  return (
    <button type="button" onClick={onChange}
      className={`text-left rounded-lg border px-2 py-1.5 transition ${checked ? on : 'border-slate-200 bg-white hover:border-slate-300'}`}>
      <div className="flex items-center gap-1.5">
        <span className={`inline-block h-3 w-3 shrink-0 rounded-full border-2 ${checked ? 'border-slate-800 bg-slate-800' : 'border-slate-300'}`} />
        <span className="text-[11px] font-extrabold text-slate-800">{title}</span>
      </div>
      <div className="ml-[18px] text-[10px] text-slate-500">{desc}</div>
    </button>
  );
}

function Kpi({ label, value, accent = 'slate', highlight }) {
  const valCls = {
    slate: 'text-slate-900', cyan: 'text-cyan-700', emerald: 'text-emerald-700',
    rose: 'text-rose-700', amber: 'text-amber-700',
  }[accent];
  return (
    <div className={`rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm ${highlight ? 'ring-2 ring-rose-100' : ''}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold ${valCls}`}>{value}</div>
    </div>
  );
}
