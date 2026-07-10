'use client';

import { useState } from 'react';
import Link from 'next/link';
import { readFirstWorksheet } from '@/utils/excelClient';

const API = '/api';

const COLUMNS = [
  { key: 'product_code', label: 'ລະຫັດສິນຄ້າ', required: false, aliases: ['code', 'ລະຫັດ'] },
  { key: 'product_name', label: 'ຊື່ສິນຄ້າ', required: true, aliases: ['name', 'ຊື່'] },
  { key: 'barcode', label: 'Barcode', required: false, aliases: ['ບາໂຄດ'] },
  { key: 'category', label: 'ໝວດໝູ່', required: false, aliases: ['ໝວດ'] },
  { key: 'brand', label: 'ຍີ່ຫໍ້', required: false, aliases: [] },
  { key: 'unit', label: 'ຫົວໜ່ວຍ', required: false, aliases: ['ຫນ່ວຍ'] },
  { key: 'cost_price', label: 'ຕົ້ນທຶນ', required: false, aliases: ['cost', 'ລາຄາຊື້'] },
  { key: 'selling_price', label: 'ລາຄາຂາຍ', required: false, aliases: ['price', 'ລາຄາ'] },
  { key: 'qty_on_hand', label: 'ຈຳນວນ', required: false, aliases: ['qty', 'stock', 'ສະຕັອກ'] },
  { key: 'min_stock', label: 'ສະຕັອກຂັ້ນຕ່ຳ', required: false, aliases: ['ຂັ້ນຕ່ຳ', 'ສະຕ໊ອກຕ່ຳສຸດ'] },
  { key: 'supplier_name', label: 'ຜູ້ສະໜອງ', required: false, aliases: ['supplier'] },
  { key: 'costing_method', label: 'ວິທີຄຳນວນຕົ້ນທຶນ', required: false, aliases: ['costing', 'fifo'] },
  { key: 'expiry_date', label: 'ວັນໝົດອາຍຸ', required: false, aliases: ['expiry', 'ໝົດອາຍຸ'] },
];

// Simple CSV parser — handles quoted fields with commas and CRLF.
function parseCSV(text) {
  const rows = [];
  let cur = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        cur.push(field); field = '';
        if (cur.length > 1 || cur[0] !== '') rows.push(cur);
        cur = [];
      } else field += c;
    }
  }
  if (field !== '' || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows;
}

const sampleCSV = `product_code,product_name,barcode,category,brand,unit,cost_price,selling_price,qty_on_hand,min_stock,supplier_name,costing_method,expiry_date
P001,ນ້ຳດື່ມ 500ml,8851234567890,ເຄື່ອງດື່ມ,Tigerhead,ຂວດ,2000,3000,100,10,ABC Co.,FIFO,2027-12-31
P002,ກາເຟ 3in1,,ເຄື່ອງດື່ມ,Nescafe,ຫໍ່,1500,2500,200,20,,AVG,
`;

export default function ProductImportPage() {
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [mode, setMode] = useState('upsert');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    let parsed;
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      // Excel: ອ່ານ sheet ທຳອິດເປັນ array ຂອງແຖວ
      parsed = (await readFirstWorksheet(file))
        .map(r => r.map(c => String(c ?? '').trim()))
        .filter(r => r.some(c => c !== ''));
    } else {
      parsed = parseCSV(await file.text());
    }
    if (!parsed || parsed.length === 0) { showToast('ໄຟລ໌ວ່າງ', 'error'); return; }
    setRows(parsed);
    // Auto-map headers (ຮອງຮັບທັງຊື່ key, ຊື່ພາສາລາວ ແລະ ຊື່ຫຍໍ້)
    const header = parsed[0].map(s => String(s).toLowerCase().trim());
    const auto = {};
    for (const col of COLUMNS) {
      const names = [col.key, col.label.toLowerCase(), ...(col.aliases || []).map(a => a.toLowerCase())];
      const idx = header.findIndex(h => names.includes(h));
      auto[col.key] = idx >= 0 ? idx : null;
    }
    setMapping(auto);
    setResult(null);
    e.target.value = '';
  };

  const downloadSample = () => {
    const blob = new Blob([sampleCSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'products-import-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const dataRows = rows.slice(1);

  const buildPreview = () => {
    return dataRows.slice(0, 100).map(r => {
      const obj = {};
      for (const col of COLUMNS) {
        const idx = mapping[col.key];
        obj[col.key] = idx != null ? r[idx] || '' : '';
      }
      return obj;
    });
  };

  const submit = async () => {
    if (mapping.product_name == null) { showToast('ກະຣຸນາ map ຄໍລໍາ "ຊື່ສິນຄ້າ"', 'error'); return; }
    const payload = dataRows.map(r => {
      const obj = {};
      for (const col of COLUMNS) {
        const idx = mapping[col.key];
        obj[col.key] = idx != null ? r[idx] || '' : '';
      }
      return obj;
    });
    setImporting(true);
    setResult(null);
    try {
      const res = await fetch(`${API}/admin/products/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: payload, mode }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        showToast(`ສຳເລັດ: ສ້າງ ${data.created} · ອັບເດດ ${data.updated} · ຂ້າມ ${data.skipped}`);
      } else {
        showToast(data.error || 'ບໍ່ສຳເລັດ', 'error');
      }
    } catch {
      showToast('ບໍ່ສຳເລັດ', 'error');
    }
    setImporting(false);
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/admin/products" className="text-slate-500 hover:text-slate-900">← ກັບສິນຄ້າ</Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">📤 ນຳເຂົ້າສິນຄ້າ (Excel / CSV)</h1>
        <p className="text-sm text-slate-500 mt-1">ນຳເຂົ້າສິນຄ້າຫຼາຍລາຍການພ້ອມກັນຈາກໄຟລ໌ Excel (.xlsx) ຫຼື CSV — ຮອງຮັບ ລະຫັດ, ຊື່, ຫົວໜ່ວຍ, ບາໂຄດ, ໝວດໝູ່, ຍີ່ຫໍ້, ຜູ້ສະໜອງ, ວິທີຄຳນວນຕົ້ນທຶນ, ວັນໝົດອາຍຸ, ສະຕັອກຂັ້ນຕ່ຳ</p>
      </div>

      {/* Step 1 */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
        <h2 className="font-bold text-slate-900 mb-3">1. ເລືອກໄຟລ໌</h2>
        <div className="flex flex-wrap items-center gap-3">
          <input type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={onFile}
            className="text-sm" />
          <button onClick={downloadSample}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold">
            📥 ດາວໂຫຼດ template
          </button>
        </div>
        {rows.length > 0 && (
          <div className="mt-2 text-sm text-emerald-700">✓ ໂຫຼດໄຟລ໌ສຳເລັດ — {dataRows.length} ແຖວ</div>
        )}
      </div>

      {rows.length > 0 && (
        <>
          {/* Step 2: Mapping */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <h2 className="font-bold text-slate-900 mb-3">2. ຈັບຄູ່ຄໍລໍາ</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {COLUMNS.map(col => (
                <div key={col.key} className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-700 w-32 shrink-0">
                    {col.label} {col.required && <span className="text-rose-500">*</span>}
                  </label>
                  <select
                    value={mapping[col.key] ?? ''}
                    onChange={e => setMapping(m => ({ ...m, [col.key]: e.target.value === '' ? null : Number(e.target.value) }))}
                    className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm"
                  >
                    <option value="">— ບໍ່ map —</option>
                    {rows[0].map((h, i) => (
                      <option key={i} value={i}>{h || `(ຄໍລໍາ ${i + 1})`}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Step 3: Mode */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <h2 className="font-bold text-slate-900 mb-3">3. ໂໝດການນຳເຂົ້າ</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {[
                { key: 'upsert', label: 'ສ້າງໃໝ່ + ອັບເດດ', desc: 'ຖ້າມີຢູ່ → ອັບເດດ, ບໍ່ມີ → ສ້າງໃໝ່' },
                { key: 'create_only', label: 'ສ້າງໃໝ່ເທົ່ານັ້ນ', desc: 'ຂ້າມສິນຄ້າທີ່ມີຢູ່ແລ້ວ' },
                { key: 'update_only', label: 'ອັບເດດເທົ່ານັ້ນ', desc: 'ສະເພາະສິນຄ້າທີ່ມີຢູ່ແລ້ວ' },
              ].map(m => (
                <button key={m.key} onClick={() => setMode(m.key)}
                  className={`text-left p-3 rounded-lg border-2 transition ${mode === m.key ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className={`text-sm font-extrabold ${mode === m.key ? 'text-red-700' : 'text-slate-800'}`}>{m.label}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 font-bold text-slate-900">
              ຕົວຢ່າງ ({Math.min(100, dataRows.length)} ຂອງ {dataRows.length} ແຖວ)
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-left">
                    {COLUMNS.map(c => <th key={c.key} className="px-2 py-1.5 font-bold text-slate-600">{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {buildPreview().map((row, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {COLUMNS.map(c => <td key={c.key} className="px-2 py-1 font-mono">{row[c.key] || <span className="text-slate-300">—</span>}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button onClick={submit} disabled={importing}
            className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-extrabold text-sm">
            {importing ? `ກຳລັງນຳເຂົ້າ ${dataRows.length} ແຖວ...` : `📥 ນຳເຂົ້າ ${dataRows.length} ແຖວ`}
          </button>
        </>
      )}

      {result && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-emerald-300">
          <h3 className="font-bold text-emerald-800">✓ ຜົນການນຳເຂົ້າ</h3>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <Stat label="ສ້າງໃໝ່" value={result.created} accent="emerald" />
            <Stat label="ອັບເດດ" value={result.updated} accent="cyan" />
            <Stat label="ຂ້າມ" value={result.skipped} accent="slate" />
          </div>
          {result.errors?.length > 0 && (
            <details className="mt-3">
              <summary className="text-xs font-bold text-rose-600 cursor-pointer">⚠ ມີຂໍ້ຜິດພາດ {result.errors.length} ລາຍການ</summary>
              <ul className="mt-2 text-xs text-rose-700 space-y-1 max-h-48 overflow-y-auto">
                {result.errors.slice(0, 100).map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'} text-white px-5 py-2.5 rounded-full shadow-2xl z-50 text-sm font-semibold`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }) {
  const cls = accent === 'emerald' ? 'text-emerald-700' : accent === 'cyan' ? 'text-cyan-700' : 'text-slate-700';
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-center">
      <div className="text-[10px] font-bold text-slate-500 uppercase">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold ${cls}`}>{value}</div>
    </div>
  );
}
