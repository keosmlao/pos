'use client';

// ສ້າງບາໂຄດ CODE 128 ໃຫ້ສິນຄ້າທີ່ຍັງບໍ່ມີບາໂຄດ
// ຕິກເລືອກເອງ · ກອງຕາມໝວດໝູ່/ຍີ່ຫໍ້ · ກຳນົດຄຳນຳໜ້າ ແລະ ຄວາມຍາວໄດ້

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';
import { usePagePermission } from '@/utils/adminPermissions';
import { code128Svg, generateBarcodeValues, BARCODE_PREFIX_RE } from '@/lib/code128';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Number(n) || 0);

export default function BarcodeGeneratorPage() {
  const perm = usePagePermission('/admin/barcode-generator');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState([]);
  const [prefix, setPrefix] = useState('33');
  const [length, setLength] = useState(13);
  const [mode, setMode] = useState('random');   // random = ສຸ່ມ · sequential = ລຽງຕໍ່ກັນ
  const [sampleSeed, setSampleSeed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const p = new URLSearchParams();
      if (category) p.set('category', category);
      if (brand) p.set('brand', brand);
      const res = await fetch(`${API}/admin/barcode-generator?${p}`, { cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      setData(d);
      setPicked([]);
    } catch (e) {
      setData(null);
      setError(`ດຶງຂໍ້ມູນບໍ່ໄດ້: ${e.message}`);
    }
    setLoading(false);
  }, [category, brand]);

  useEffect(() => { load(); }, [load]);

  const term = search.trim().toLowerCase();
  const rows = useMemo(() => {
    const all = data?.products || [];
    if (!term) return all;
    return all.filter(p => [p.product_code, p.product_name].some(v => String(v || '').toLowerCase().includes(term)));
  }, [data, term]);

  const toggle = (id) => setPicked(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id]);
  const toggleAll = () => setPicked(v => v.length === rows.length ? [] : rows.map(p => p.id));

  // ຕົວຢ່າງເລກ — ຄິດຢູ່ໜ້າຈໍດ້ວຍຕົວດຽວກັບ server
  const preview = useMemo(() => {
    if (!BARCODE_PREFIX_RE.test(prefix)) return { error: 'ຄຳນຳໜ້າໃຊ້ໄດ້ແຕ່ຕົວເລກ/ຕົວອັກສອນອັງກິດ (ສູງສຸດ 8 ຕົວ)' };
    try {
      const g = generateBarcodeValues({ prefix, totalLength: length, count: 1, taken: [], mode });
      return { value: g.values[0], digits: g.digits, capacity: g.capacity };
    } catch (e) {
      return { error: e.message };
    }
    // sampleSeed ຢູ່ໃນ deps ເພື່ອບັງຄັບໃຫ້ສຸ່ມຕົວຢ່າງໃໝ່ເມື່ອຜູ້ໃຊ້ກົດ
  }, [prefix, length, mode, sampleSeed]);

  const canRun = perm.edit && picked.length > 0 && !preview.error && !busy;

  const run = async (dryRun) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API}/admin/barcode-generator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_ids: picked, prefix, length, mode, dry_run: dryRun }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      setResult(d);
      if (!dryRun) await load();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const printLabels = () => {
    const list = result?.assignments || [];
    if (list.length === 0) return;
    const cards = list.map(a => `
      <div class="card">
        <div class="name">${escapeHtml(a.product_name || '')}</div>
        <div class="code">${escapeHtml(a.product_code || '')}</div>
        ${code128Svg(a.barcode, { moduleWidth: 1.6, height: 46, fontSize: 11 })}
      </div>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>ບາໂຄດສິນຄ້າ</title><style>
      @page { size: A4; margin: 10mm }
      body { font-family: "Noto Sans Lao", system-ui, sans-serif; margin: 0 }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm }
      .card { border: 1px dashed #bbb; padding: 4mm; text-align: center; break-inside: avoid }
      .name { font-size: 10px; font-weight: 700; margin-bottom: 1mm; height: 26px; overflow: hidden }
      .code { font-size: 9px; color: #666; margin-bottom: 1mm }
      svg { max-width: 100% }
    </style></head><body><div class="grid">${cards}</div></body></html>`;
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) return;
    w.document.open(); w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => { try { w.print(); } catch { /* ຜູ້ໃຊ້ປິດເອງ */ } }, 300);
  };

  const totals = data?.totals || {};

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Barcode"
        title="📇 ສ້າງບາໂຄດສິນຄ້າ"
        subtitle={`CODE 128 · ຍັງບໍ່ມີບາໂຄດ ${fmtNum(totals.without_barcode)} ລາຍການ · ມີແລ້ວ ${fmtNum(totals.with_barcode)} ລາຍການ`}
      />

      {/* ຕັ້ງຄ່າ */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">ໝວດໝູ່</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm min-w-[170px]">
              <option value="">ທັງໝົດ</option>
              {(data?.categories || []).map(c => <option key={c.name} value={c.name}>{c.name} ({c.n})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">ຍີ່ຫໍ້</label>
            <select value={brand} onChange={e => setBrand(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm min-w-[170px]">
              <option value="">ທັງໝົດ</option>
              {(data?.brands || []).map(b => <option key={b.name} value={b.name}>{b.name} ({b.n})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">ຂຶ້ນຕົ້ນດ້ວຍ</label>
            <input value={prefix} onChange={e => setPrefix(e.target.value)} placeholder="33"
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-28 font-mono" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">ຄວາມຍາວລວມ</label>
            <input type="number" min={4} max={48} value={length}
              onChange={e => setLength(Number(e.target.value) || 0)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-24 font-mono" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">ຮູບແບບເລກ</label>
            <select value={mode} onChange={e => setMode(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
              <option value="random">ສຸ່ມ</option>
              <option value="sequential">ລຽງຕໍ່ກັນ</option>
            </select>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ຄົ້ນຫາ ລະຫັດ / ຊື່ສິນຄ້າ..."
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm min-w-[200px] flex-1" />
        </div>

        {/* ຕົວຢ່າງ */}
        {preview.error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{preview.error}</div>
        ) : (
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span>ຕົວຢ່າງເລກ: <b className="font-mono text-slate-900">{preview.value}</b></span>
                {mode === 'random' && (
                  <button onClick={() => setSampleSeed(v => v + 1)}
                    className="px-2 py-0.5 rounded border border-slate-300 text-[10px] font-bold text-slate-600 hover:bg-white">🎲 ສຸ່ມໃໝ່</button>
                )}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {prefix || '(ບໍ່ມີຄຳນຳໜ້າ)'} + {mode === 'random' ? 'ຕົວເລກສຸ່ມ' : 'ເລກລຳດັບ'} {preview.digits} ຕົວ
                · ພື້ນທີ່ {fmtNum(preview.capacity)} ເລກ
              </div>
            </div>
            <div className="ml-auto" dangerouslySetInnerHTML={{ __html: code128Svg(preview.value, { moduleWidth: 1.5, height: 40, fontSize: 10 }) }} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">ຕິກໄວ້ <b className="text-red-600">{fmtNum(picked.length)}</b> / {fmtNum(rows.length)} ລາຍການ</span>
          <div className="flex-1" />
          <button onClick={() => run(true)} disabled={!canRun}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg text-xs font-bold text-slate-700">
            👁 ເບິ່ງກ່ອນ
          </button>
          <button onClick={() => run(false)} disabled={!canRun}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-lg text-sm font-bold">
            {busy ? 'ກຳລັງສ້າງ...' : `⚡ ສ້າງບາໂຄດ ${fmtNum(picked.length)} ລາຍການ`}
          </button>
        </div>
        {!perm.edit && !perm.loading && (
          <div className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ບໍ່ມີສິດແກ້ໄຂ — ເບິ່ງໄດ້ຢ່າງດຽວ
          </div>
        )}
        {error && <div className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}
      </div>

      {/* ຜົນລັບ */}
      {result && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center gap-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              {result.dry_run ? 'ຕົວຢ່າງ (ຍັງບໍ່ບັນທຶກ)' : `ບັນທຶກແລ້ວ ${fmtNum(result.assigned)} ລາຍການ`}
            </span>
            {result.skipped > 0 && (
              <span className="text-[11px] font-bold text-amber-700">ຂ້າມ {fmtNum(result.skipped)} (ມີບາໂຄດຢູ່ແລ້ວ)</span>
            )}
            <div className="flex-1" />
            <button onClick={printLabels}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold">🖨 ພິມປ້າຍບາໂຄດ</button>
            <button onClick={() => setResult(null)}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-600">ປິດ</button>
          </div>
          <div className="max-h-[50vh] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-2 font-bold">ລະຫັດ</th>
                  <th className="px-3 py-2 font-bold">ຊື່ສິນຄ້າ</th>
                  <th className="px-3 py-2 font-bold">ບາໂຄດໃໝ່</th>
                  <th className="px-3 py-2 font-bold">CODE 128</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(result.assignments || []).map(a => (
                  <tr key={a.product_id}>
                    <td className="px-3 py-1.5 font-mono text-slate-500">{a.product_code || '—'}</td>
                    <td className="px-3 py-1.5 text-slate-800">{a.product_name}</td>
                    <td className="px-3 py-1.5 font-mono font-bold text-red-600">{a.barcode}</td>
                    <td className="px-3 py-1.5">
                      <span dangerouslySetInnerHTML={{ __html: code128Svg(a.barcode, { moduleWidth: 1.1, height: 30, showText: false }) }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ລາຍການສິນຄ້າ */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left">
                <th className="px-3 py-2 w-8">
                  <input type="checkbox" className="accent-red-600 cursor-pointer"
                    checked={rows.length > 0 && picked.length === rows.length}
                    onChange={toggleAll} title="ຕິກ / ຍົກເລີກທັງໝົດ" />
                </th>
                <th className="px-3 py-2 font-bold text-slate-600">ລະຫັດ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ຊື່ສິນຄ້າ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ໝວດໝູ່</th>
                <th className="px-3 py-2 font-bold text-slate-600">ຍີ່ຫໍ້</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ຄົງເຫຼືອ</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                  {loading ? 'ກຳລັງໂຫຼດ...' : '✓ ສິນຄ້າທັງໝົດມີບາໂຄດແລ້ວ'}
                </td></tr>
              ) : rows.map(p => {
                const on = picked.includes(p.id);
                return (
                  <tr key={p.id} onClick={() => toggle(p.id)}
                    className={`border-t border-slate-100 cursor-pointer ${on ? 'bg-red-50/60' : 'hover:bg-slate-50'}`}>
                    <td className="px-3 py-1.5">
                      <input type="checkbox" className="accent-red-600 cursor-pointer" checked={on}
                        onChange={() => toggle(p.id)} onClick={e => e.stopPropagation()} />
                    </td>
                    <td className="px-3 py-1.5 font-mono text-slate-500">{p.product_code || '—'}</td>
                    <td className="px-3 py-1.5 font-bold text-slate-800">{p.product_name}</td>
                    <td className="px-3 py-1.5 text-slate-500">{p.category || '—'}</td>
                    <td className="px-3 py-1.5 text-slate-500">{p.brand || '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-slate-600">{fmtNum(p.qty_on_hand)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
