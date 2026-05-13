'use client';

import { useState, useEffect, useMemo } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';
import { useCompanyProfile } from '@/utils/useCompanyProfile';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtPrice = n => `${fmtNum(n)} ₭`;

// A4 portrait page: 210×297mm. Usable area after 4mm margins: 202×289mm.
// Each LAYOUT divides that area into a fixed grid → label width/height are
// computed (not user-chosen) so the page is always filled neatly.
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 4;
const GAP = 1.5;

const LAYOUTS = {
  '4':  { label: '4 ປ້າຍ', cols: 2, rows: 2, sub: '~A6 ຕັ້ງ' },
  '6':  { label: '6 ປ້າຍ', cols: 2, rows: 3, sub: 'ກາງ' },
  '8':  { label: '8 ປ້າຍ', cols: 2, rows: 4, sub: '~A7 ນອນ' },
  '1':  { label: '1 ປ້າຍ', cols: 1, rows: 1, sub: 'ໃບໃຫຍ່ ເຕັມໜ້າ' },
};

function labelDims(layoutKey) {
  const L = LAYOUTS[layoutKey] || LAYOUTS['8'];
  const usableW = PAGE_W - MARGIN * 2;
  const usableH = PAGE_H - MARGIN * 2;
  const lw = (usableW - GAP * (L.cols - 1)) / L.cols;
  const lh = (usableH - GAP * (L.rows - 1)) / L.rows;
  return { lw, lh, cols: L.cols, rows: L.rows, perPage: L.cols * L.rows };
}

const ORIENT = {
  portrait:  { label: 'ຮູບເທິງ', icon: '⬆', sub: 'ຊື່-ລາຄາ-barcode' },
  landscape: { label: 'ຮູບຊ້າຍ', icon: '➡', sub: 'ຮູບ + ຂໍ້ມູນ' },
};

export default function PriceLabelsPage() {
  const company = useCompanyProfile();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState({}); // { product_id: qty }
  const [layoutKey, setLayoutKey] = useState('8'); // 4 | 6 | 8 | 1
  const [orientation, setOrientation] = useState('portrait');
  const [opts, setOpts] = useState({
    show_shop: true,
    show_image: true,
    show_code: true,
    show_barcode: true,
    show_unit: true,
    show_currency: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/admin/products`)
      .then(r => r.json())
      .then(d => setProducts(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 200);
    return products.filter(p =>
      (p.product_name || '').toLowerCase().includes(q) ||
      (p.product_code || '').toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q)
    ).slice(0, 200);
  }, [products, search]);

  const updateQty = (pid, val) => {
    const n = Math.max(0, Number(val) || 0);
    setSelected(prev => {
      const next = { ...prev };
      if (n <= 0) delete next[pid];
      else next[pid] = n;
      return next;
    });
  };

  const selectedItems = useMemo(() => {
    return Object.entries(selected)
      .map(([pid, qty]) => ({ product: products.find(p => p.id === Number(pid)), qty }))
      .filter(it => it.product && it.qty > 0);
  }, [selected, products]);

  const totalLabels = selectedItems.reduce((s, it) => s + it.qty, 0);

  const selectAllFiltered = () => {
    setSelected(prev => {
      const next = { ...prev };
      filtered.forEach(p => { if (!next[p.id]) next[p.id] = 1; });
      return next;
    });
  };
  const clearAll = () => setSelected({});

  const print = () => {
    if (selectedItems.length === 0) return;
    const labelsHtml = buildLabelsHtml({ items: selectedItems, layoutKey, orientation, opts, company });
    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) return;
    win.document.open();
    win.document.write(labelsHtml);
    win.document.close();
  };

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Price labels"
        title="🏷 ພິມປ້າຍລາຄາ"
        subtitle="ເລືອກສິນຄ້າ + ຈຳນວນ → ກຳນົດຂະໜາດ A6/A7 → ພິມ"
        action={
          <button onClick={print} disabled={totalLabels === 0}
            className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-3 text-sm font-extrabold shadow-lg shadow-red-950/20 disabled:opacity-50">
            🖨 ພິມ {totalLabels > 0 ? `${fmtNum(totalLabels)} ປ້າຍ` : ''}
          </button>
        }
        metrics={[
          { label: 'ສິນຄ້າທີ່ເລືອກ', value: fmtNum(selectedItems.length) },
          { label: 'ປ້າຍລວມ', value: fmtNum(totalLabels), tone: 'emerald' },
          { label: 'ຮູບແບບ', value: LAYOUTS[layoutKey].label },
          { label: 'ຂະໜາດ/ປ້າຍ', value: (() => { const d = labelDims(layoutKey); return `${d.lw.toFixed(0)}×${d.lh.toFixed(0)}mm`; })() },
        ]}
      />

      {/* Settings + Picker */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        {/* Left: settings */}
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <h2 className="font-bold text-slate-900">ຮູບແບບປ້າຍ (ຕໍ່ A4)</h2>
            <div className="grid grid-cols-2 gap-2">
              {['4', '6', '8', '1'].map(k => {
                const L = LAYOUTS[k];
                const d = labelDims(k);
                const active = layoutKey === k;
                return (
                  <button key={k} type="button" onClick={() => setLayoutKey(k)}
                    className={`rounded-xl border-2 p-3 text-center transition ${active ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <div className={`text-base font-extrabold ${active ? 'text-red-700' : 'text-slate-800'}`}>{L.label}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{L.cols}×{L.rows} · {d.lw.toFixed(0)}×{d.lh.toFixed(0)}mm</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">{L.sub}</div>
                  </button>
                );
              })}
            </div>

            <h2 className="font-bold text-slate-900 pt-2">ການວາງໃນປ້າຍ</h2>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ORIENT).map(([k, v]) => (
                <button key={k} type="button" onClick={() => setOrientation(k)}
                  className={`rounded-xl border-2 p-2.5 text-center transition ${orientation === k ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className="text-lg">{v.icon}</div>
                  <div className={`text-xs font-extrabold mt-0.5 ${orientation === k ? 'text-red-700' : 'text-slate-800'}`}>{v.label}</div>
                  <div className="text-[9px] text-slate-400">{v.sub}</div>
                </button>
              ))}
            </div>

            <h2 className="font-bold text-slate-900 pt-2">ສະແດງໃນປ້າຍ</h2>
            <div className="space-y-1">
              {[
                ['show_shop', 'ຊື່ຮ້ານ / ໂລໂກ້'],
                ['show_image', '🖼 ຮູບສິນຄ້າ'],
                ['show_code', 'ລະຫັດສິນຄ້າ'],
                ['show_barcode', '📊 Barcode'],
                ['show_unit', 'ຫົວໜ່ວຍ'],
                ['show_currency', 'ສະກຸນເງິນ (₭)'],
              ].map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={opts[k]} onChange={e => setOpts(o => ({ ...o, [k]: e.target.checked }))} className="accent-red-600" />
                  <span className="text-xs font-bold text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

        </div>

        {/* Right: product picker */}
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="ຄົ້ນຫາ barcode / ຊື່ / ລະຫັດ..."
                  className="w-full pl-8 pr-2 h-8 bg-slate-50 border border-slate-200 rounded-md text-xs focus:border-red-400 focus:ring-1 focus:ring-red-200 outline-none" />
              </div>
              <button onClick={selectAllFiltered}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-xs font-bold">+ ເພີ່ມທີ່ສະແດງ</button>
              {selectedItems.length > 0 && (
                <button onClick={clearAll}
                  className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-md text-xs font-bold">ລ້າງ</button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 text-xs font-bold text-slate-600">
              ສິນຄ້າ {fmtNum(filtered.length)} ລາຍການ {loading && '· ກຳລັງໂຫຼດ...'}
            </div>
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-bold text-slate-600 w-8"></th>
                    <th className="px-3 py-2 font-bold text-slate-600">ສິນຄ້າ</th>
                    <th className="px-3 py-2 font-bold text-slate-600">Barcode</th>
                    <th className="px-3 py-2 font-bold text-slate-600 text-right">ລາຄາ</th>
                    <th className="px-3 py-2 font-bold text-slate-600 text-right w-24">ຈຳນວນ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">ບໍ່ພົບສິນຄ້າ</td></tr>
                  ) : filtered.map(p => {
                    const qty = selected[p.id] || 0;
                    return (
                      <tr key={p.id} className={`border-t border-slate-100 hover:bg-slate-50 ${qty > 0 ? 'bg-red-50/30' : ''}`}>
                        <td className="px-3 py-1.5">
                          <input type="checkbox" checked={qty > 0}
                            onChange={e => updateQty(p.id, e.target.checked ? 1 : 0)}
                            className="accent-red-600" />
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="font-bold text-slate-900">{p.product_name}</div>
                          <div className="text-[10px] font-mono text-slate-500">{p.product_code} {p.unit ? `· ${p.unit}` : ''}</div>
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[11px]">{p.barcode || '—'}</td>
                        <td className="px-3 py-1.5 text-right font-mono font-bold text-red-700">{fmtPrice(p.selling_price)}</td>
                        <td className="px-3 py-1.5 text-right">
                          <input type="number" min="0" value={qty || ''}
                            onChange={e => updateQty(p.id, e.target.value)}
                            placeholder="0"
                            className="w-16 px-2 py-1 border border-slate-200 rounded text-right text-sm font-mono outline-none focus:border-red-400" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Full A4 sheet preview */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-900">📄 ຕົວຢ່າງ A4</h2>
          <div className="text-xs text-slate-500">
            {selectedItems.length === 0 ? 'ເລືອກສິນຄ້າເພື່ອເບິ່ງຕົວຢ່າງ' : `${fmtNum(totalLabels)} ປ້າຍ`}
          </div>
        </div>
        <SheetPreview
          layoutKey={layoutKey}
          orientation={orientation}
          opts={opts}
          company={company}
          items={selectedItems.length > 0 ? selectedItems : (products[0] ? [{ product: products[0], qty: 1 }] : [])}
        />
      </div>
    </div>
  );
}

// Full A4 sheet preview. Renders the actual A4 page at scale with labels in
// their grid positions, showing what the user will get when printing.
function SheetPreview({ layoutKey, orientation, opts, company, items }) {
  const isLandscape = orientation === 'landscape';
  const d = labelDims(layoutKey);
  const { lw, lh, cols, rows, perPage } = d;

  // Build flat list of all labels (product × qty)
  const labels = [];
  items.forEach(it => {
    for (let i = 0; i < (it.qty || 1); i++) labels.push(it.product);
  });

  // Scale A4 to fit the preview panel
  const maxW = 380;
  const maxH = 540;
  const scale = Math.min(maxW / PAGE_W, maxH / PAGE_H);
  const visibleLabels = labels.slice(0, perPage);
  const remaining = labels.length - visibleLabels.length;

  if (labels.length === 0) {
    return (
      <div className="bg-slate-50 rounded-lg p-8 text-center text-slate-400 text-sm">
        ກະຣຸນາເລືອກສິນຄ້າ
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="bg-white border-2 border-slate-300 shadow-lg"
        style={{
          width: `${PAGE_W * scale}px`,
          height: `${PAGE_H * scale}px`,
          padding: `${MARGIN * scale}px`,
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gap: `${GAP * scale}px`,
        }}
      >
        {Array.from({ length: perPage }).map((_, i) => {
          const p = visibleLabels[i];
          return p
            ? <MiniLabel key={i} product={p} company={company} opts={opts} isLandscape={isLandscape} scale={scale} lw={lw} lh={lh} />
            : <div key={i} className="border border-dashed border-slate-200" />;
        })}
      </div>
      <div className="text-xs text-slate-500 text-center">
        {cols}×{rows} = {perPage} ປ້າຍ/A4 · ປ້າຍ {lw.toFixed(0)}×{lh.toFixed(0)}mm
        {remaining > 0 && ` · ຍັງເຫຼືອ ${remaining} ໃບໃນໜ້າຕໍ່ໄປ`}
      </div>
    </div>
  );
}

function MiniLabel({ product: p, company, opts, isLandscape, scale, lw, lh }) {
  // Scale font sizes proportional to label dimensions
  const labelArea = lw * lh;
  const baseFont  = Math.max(8, Math.min(15, labelArea / 700));
  const priceFont = Math.max(16, Math.min(34, labelArea / 200));
  const imgSize   = Math.max(14, Math.min(36, Math.min(lw, lh) * 0.4));
  return (
    <div
      style={{ padding: `${1.5 * scale}px`, width: '100%', height: '100%' }}
      className={`bg-white border border-dashed border-slate-300 flex overflow-hidden ${isLandscape ? 'flex-row items-stretch gap-1' : 'flex-col items-center text-center'}`}
    >
      {isLandscape && opts.show_image && (
        <div className="rounded bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 self-center"
          style={{ width: `${imgSize * scale * 1.3}px`, height: `${imgSize * scale * 1.3}px` }}>
          {p.image_url
            ? <img src={p.image_url} alt="" className="w-full h-full object-contain" />
            : <span style={{ fontSize: `${baseFont * scale * 1.5}px` }} className="text-slate-300">📦</span>}
        </div>
      )}
      <div className={`flex-1 flex flex-col min-w-0 ${isLandscape ? 'items-start text-left' : 'items-center justify-between w-full'}`}
        style={{ gap: `${0.5 * scale}px` }}>
        {opts.show_shop && (
          <div className="font-bold text-slate-700 truncate w-full border-b border-dotted border-slate-300"
            style={{ fontSize: `${7 * scale}px`, paddingBottom: `${0.5 * scale}px`, marginBottom: `${0.5 * scale}px`, textAlign: isLandscape ? 'left' : 'center' }}>
            {company?.name || 'POS'}
          </div>
        )}
        <div className={`flex-1 flex flex-col w-full ${isLandscape ? 'items-start' : 'items-center justify-center'}`}
          style={{ gap: `${0.5 * scale}px` }}>
          {!isLandscape && opts.show_image && (
            <div className="rounded bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden"
              style={{ width: `${imgSize * scale}px`, height: `${imgSize * scale}px` }}>
              {p.image_url
                ? <img src={p.image_url} alt="" className="w-full h-full object-contain" />
                : <span style={{ fontSize: `${baseFont * scale}px` }} className="text-slate-300">📦</span>}
            </div>
          )}
          <div className="font-extrabold text-slate-900 leading-tight w-full truncate"
            style={{ fontSize: `${baseFont * scale}px`, textAlign: isLandscape ? 'left' : 'center' }}>
            {p.product_name}
          </div>
          {opts.show_code && p.product_code && (
            <div className="font-mono text-slate-500" style={{ fontSize: `${8 * scale}px` }}>{p.product_code}</div>
          )}
          <div className="font-extrabold text-red-600 leading-none"
            style={{ fontSize: `${priceFont * scale}px` }}>
            {new Intl.NumberFormat('lo-LA').format(Math.round(Number(p.selling_price) || 0))}
            {opts.show_currency && <span style={{ fontSize: `${(priceFont * 0.5) * scale}px`, marginLeft: `${1 * scale}px` }}>₭</span>}
            {opts.show_unit && p.unit && (
              <span className="text-slate-500 font-bold" style={{ fontSize: `${9 * scale}px`, marginLeft: `${2 * scale}px` }}>/{p.unit}</span>
            )}
          </div>
        </div>
        {opts.show_barcode && p.barcode && (
          <div className="w-full border-t border-dotted border-slate-300"
            style={{ paddingTop: `${0.5 * scale}px`, marginTop: `${0.5 * scale}px`, textAlign: isLandscape ? 'left' : 'center' }}>
            <div className="font-mono text-slate-700" style={{ fontSize: `${7 * scale}px`, letterSpacing: '-0.5px' }}>▮▮▌▮▌▌▮▮▮▌▮▮▌</div>
            <div className="font-mono text-slate-700" style={{ fontSize: `${6 * scale}px` }}>{p.barcode}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Build the print-ready HTML document. Uses JsBarcode from CDN for accurate
// scannable barcodes. Falls back to plain text if the CDN fails.
function buildLabelsHtml({ items, layoutKey, orientation = 'portrait', opts, company }) {
  const labels = [];
  items.forEach(it => {
    for (let i = 0; i < it.qty; i++) labels.push(it.product);
  });
  const isLandscape = orientation === 'landscape';
  const d = labelDims(layoutKey);
  const lw = d.lw;
  const lh = d.lh;
  // Font sizes scaled to label area
  const area = lw * lh;
  const nameFont = area >= 9000 ? 14 : area >= 5000 ? 11 : 9;
  const priceFont = area >= 9000 ? 32 : area >= 5000 ? 24 : 18;
  const imgSize = Math.max(15, Math.min(34, Math.min(lw, lh) * 0.4));

  const absUrl = (path) => {
    if (!path) return '';
    if (/^https?:/i.test(path)) return path;
    return path.startsWith('/') ? `${location.origin}${path}` : path;
  };

  const labelEl = (p, idx) => {
    const barcodeSvg = opts.show_barcode && p.barcode
      ? `<svg class="bc" id="bc-${idx}" data-code="${esc(p.barcode)}"></svg>`
      : '';
    const imgSrc = absUrl(p.image_url);
    const imageEl = opts.show_image
      ? (imgSrc
          ? `<img class="img" src="${esc(imgSrc)}" alt="" crossorigin="anonymous" />`
          : `<div class="img placeholder">📦</div>`)
      : '';
    const info = `
      <div class="info">
        ${opts.show_shop && company?.name ? `<div class="shop">${esc(company.name)}</div>` : ''}
        <div class="main">
          ${!isLandscape && imageEl ? `<span class="in-main">${imageEl.replace('class="img"', 'class="img in-main"')}</span>` : ''}
          <div class="name">${esc(p.product_name)}</div>
          ${opts.show_code && p.product_code ? `<div class="code">${esc(p.product_code)}</div>` : ''}
          <div class="price">${fmtNum(p.selling_price)}${opts.show_currency ? '<span class="cur">₭</span>' : ''}${opts.show_unit && p.unit ? `<span class="unit">/${esc(p.unit)}</span>` : ''}</div>
        </div>
        ${barcodeSvg}
        ${opts.show_barcode && p.barcode ? `<div class="bc-num">${esc(p.barcode)}</div>` : ''}
      </div>
    `;
    return `
      <div class="label">
        ${isLandscape && imageEl ? imageEl : ''}
        ${info}
      </div>
    `;
  };

  // Always A4 portrait. Layout = fixed grid (1, 4, 6, or 8 per page).
  const pageRule = `@page { size: A4 portrait; margin: ${MARGIN}mm; }`;
  const gridStyle = `
    .sheet {
      display: grid;
      grid-template-columns: repeat(${d.cols}, 1fr);
      grid-template-rows: repeat(${d.rows}, 1fr);
      gap: ${GAP}mm;
      width: ${PAGE_W - MARGIN * 2}mm;
      height: ${PAGE_H - MARGIN * 2}mm;
      page-break-after: always;
    }
    .label { width: 100%; height: 100%; }
  `;

  // Chunk into sheets of perPage so each A4 page is filled in order.
  const sheets = [];
  for (let i = 0; i < labels.length; i += d.perPage) {
    sheets.push(labels.slice(i, i + d.perPage));
  }

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Price labels</title>
<style>
  ${pageRule}
  * { box-sizing: border-box; font-family: 'Noto Sans Lao', system-ui, sans-serif; }
  html, body { margin: 0; padding: 0; }
  ${gridStyle}
  .sheet:last-child { page-break-after: auto; }
  .label {
    border: 1px solid #cbd5e1;
    border-radius: 1mm;
    padding: 1.5mm;
    display: flex;
    ${isLandscape ? 'flex-direction: row; align-items: stretch; gap: 1.5mm;' : 'flex-direction: column; align-items: center; text-align: center;'}
    overflow: hidden;
    page-break-inside: avoid;
  }
  ${isLandscape ? `
  .label > .img:not(.in-main) { width: ${imgSize * 1.4}mm; height: ${imgSize * 1.4}mm; align-self: center; flex-shrink: 0; }
  .info { flex: 1; display: flex; flex-direction: column; justify-content: space-between; min-width: 0; }
  ` : `
  .info { width: 100%; display: flex; flex-direction: column; align-items: center; height: 100%; }
  `}
  .shop { font-size: ${Math.max(6, nameFont * 0.55)}pt; font-weight: 700; color: #475569; width: 100%; ${isLandscape ? '' : 'text-align: center;'} border-bottom: 1px dotted #cbd5e1; padding-bottom: 0.5mm; margin-bottom: 0.5mm; flex-shrink: 0; }
  .main { flex: 1; display: flex; flex-direction: column; ${isLandscape ? 'justify-content: center; align-items: flex-start;' : 'justify-content: center; align-items: center;'} width: 100%; min-height: 0; gap: 0.5mm; }
  .img {
    width: ${imgSize}mm;
    height: ${imgSize}mm;
    object-fit: contain;
    border: 1px solid #e2e8f0;
    border-radius: 1mm;
    background: #f8fafc;
    flex-shrink: 0;
  }
  .img.placeholder { display: flex; align-items: center; justify-content: center; font-size: ${imgSize * 0.5}pt; color: #cbd5e1; }
  .name { font-size: ${nameFont}pt; font-weight: 800; color: #0f172a; line-height: 1.1; word-break: break-word; ${isLandscape ? 'text-align: left;' : 'text-align: center;'} display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .code { font-family: ui-monospace, SFMono-Regular, monospace; font-size: ${Math.max(6, nameFont * 0.7)}pt; color: #64748b; }
  .price { font-size: ${priceFont}pt; font-weight: 900; color: #b91c1c; line-height: 1; ${isLandscape ? 'text-align: left; width: 100%;' : ''} }
  .cur { font-size: ${priceFont * 0.5}pt; margin-left: 1mm; }
  .unit { font-size: ${nameFont * 0.7}pt; color: #64748b; margin-left: 2mm; font-weight: 700; }
  .bc { width: 100%; max-height: ${Math.min(15, lh * 0.18)}mm; margin-top: 0.5mm; flex-shrink: 0; }
  .bc-num { font-family: ui-monospace, monospace; font-size: ${Math.max(6, nameFont * 0.55)}pt; color: #475569; letter-spacing: 0.5px; flex-shrink: 0; ${isLandscape ? 'text-align: left;' : 'text-align: center;'} }
</style>
</head><body>
  ${sheets.map((pageLabels, pageIdx) => `
    <div class="sheet">
      ${pageLabels.map((p, i) => labelEl(p, pageIdx * d.perPage + i)).join('')}
    </div>
  `).join('')}
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
  <script>
    function renderBarcodes() {
      if (typeof JsBarcode === 'undefined') return false;
      document.querySelectorAll('.bc').forEach(el => {
        const code = el.getAttribute('data-code');
        if (!code) return;
        try {
          JsBarcode(el, code, {
            format: 'CODE128',
            displayValue: false,
            margin: 0,
            height: 40,
            width: 1.5,
          });
        } catch (e) {
          el.outerHTML = '<div style="font-family:monospace;font-size:9pt;">' + code + '</div>';
        }
      });
      return true;
    }
    function waitForImages() {
      const imgs = Array.from(document.querySelectorAll('img.img'));
      if (imgs.length === 0) return Promise.resolve();
      return Promise.all(imgs.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(res => {
          img.addEventListener('load', res, { once: true });
          img.addEventListener('error', res, { once: true });
        });
      }));
    }
    function whenReady() {
      if (!renderBarcodes()) { setTimeout(whenReady, 100); return; }
      waitForImages().then(() => {
        window.print();
        setTimeout(() => window.close(), 500);
      });
    }
    window.onload = whenReady;
  </script>
</body></html>`;
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}
