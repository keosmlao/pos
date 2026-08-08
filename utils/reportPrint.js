'use client';

// ພິມລາຍງານເປັນ A4 (ຜ່ານໜ້າຕ່າງພິມຂອງ browser → ເລືອກ "Save as PDF" ໄດ້)
// ໃຊ້ຮ່ວມກັນໄດ້ທຸກລາຍງານ: ສົ່ງ kpis + ຕາຕະລາງເຂົ້າມາ ແລ້ວມັນຈັດໜ້າໃຫ້.

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const FONT_STACK = `'Noto Sans Lao','Phetsarath OT',system-ui,-apple-system,'Segoe UI',sans-serif`;

/**
 * @param {object}   opts
 * @param {object}   opts.company   { name, address, phone, tax_id }
 * @param {string}   opts.title     ຫົວລາຍງານ
 * @param {string}   opts.subtitle  ຄຳອະທິບາຍສັ້ນໆ
 * @param {Array}    opts.meta      [{ label, value }] ແຖບຂໍ້ມູນຊ່ວງເວລາ ຯລຯ
 * @param {Array}    opts.kpis      [{ label, value, accent }]
 * @param {Array}    opts.tables    [{ title, columns:[{header, align, width}], rows:[[cell]], totals:[cell] }]
 * @param {boolean}  opts.landscape
 */
export function printReportA4({ company = {}, title, subtitle, meta = [], kpis = [], tables = [], landscape = false }) {
  const metaHtml = meta.length ? `
    <div class="meta">
      ${meta.map(m => `<div class="meta-item"><span class="meta-label">${escapeHtml(m.label)}</span><span class="meta-value">${escapeHtml(m.value)}</span></div>`).join('')}
    </div>` : '';

  const kpiHtml = kpis.length ? `
    <div class="kpis">
      ${kpis.map(k => `
        <div class="kpi ${k.accent ? 'kpi-' + k.accent : ''}">
          <div class="kpi-label">${escapeHtml(k.label)}</div>
          <div class="kpi-value">${escapeHtml(k.value)}</div>
        </div>`).join('')}
    </div>` : '';

  const tablesHtml = tables.map(t => `
    <section class="block">
      <h2>${escapeHtml(t.title)}</h2>
      <table>
        <thead>
          <tr>${t.columns.map(c => `<th class="${c.align || 'left'}" ${c.width ? `style="width:${c.width}"` : ''}>${escapeHtml(c.header)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${t.rows.length === 0
            ? `<tr><td colspan="${t.columns.length}" class="empty">ບໍ່ມີຂໍ້ມູນ</td></tr>`
            : t.rows.map((row, i) => `<tr>${row.map((cell, ci) => `<td class="${t.columns[ci]?.align || 'left'}">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
        </tbody>
        ${t.totals ? `<tfoot><tr>${t.totals.map((cell, ci) => `<td class="${t.columns[ci]?.align || 'left'}">${escapeHtml(cell)}</td>`).join('')}</tr></tfoot>` : ''}
      </table>
    </section>`).join('');

  const now = new Date();
  const p2 = n => String(n).padStart(2, '0');
  const printedAt = `${p2(now.getDate())}-${p2(now.getMonth() + 1)}-${now.getFullYear()} ${p2(now.getHours())}:${p2(now.getMinutes())}`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 12mm }
  * { box-sizing: border-box; font-family: ${FONT_STACK} }
  html, body { margin: 0; padding: 0; color: #0f172a; font-size: 11px; line-height: 1.45;
               -webkit-print-color-adjust: exact; print-color-adjust: exact }
  header.top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px;
               border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px }
  .company-name { font-size: 18px; font-weight: 900 }
  .company-info { font-size: 10px; color: #475569; line-height: 1.4 }
  .doc { text-align: right }
  .doc h1 { margin: 0; font-size: 19px; font-weight: 900; color: #b91c1c; letter-spacing: .3px }
  .doc .sub { font-size: 10px; color: #475569; margin-top: 3px }
  .meta { display: flex; flex-wrap: wrap; gap: 6px 22px; padding: 8px 12px; background: #f8fafc;
          border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 12px; font-size: 10px }
  .meta-label { color: #64748b; font-weight: 700; margin-right: 6px }
  .meta-value { color: #0f172a; font-weight: 700 }
  .kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 14px;
          break-inside: avoid; page-break-inside: avoid }
  .kpi { border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 9px; background: #fff }
  .kpi-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; color: #64748b }
  .kpi-value { font-size: 14px; font-weight: 900; margin-top: 2px; font-variant-numeric: tabular-nums }
  .kpi-cyan .kpi-value { color: #0e7490 }
  .kpi-amber .kpi-value { color: #b45309 }
  .kpi-emerald { background: #f0fdf4; border-color: #86efac }
  .kpi-emerald .kpi-value { color: #15803d }
  .kpi-rose .kpi-value { color: #be123c }
  .block { margin-bottom: 16px }
  .block h2 { margin: 0 0 6px; font-size: 12px; font-weight: 900; color: #0f172a;
              border-left: 4px solid #b91c1c; padding-left: 8px }
  table { width: 100%; border-collapse: collapse }
  thead { display: table-header-group }
  tfoot { display: table-footer-group }
  th { background: #0f172a; color: #fff; padding: 5px 7px; font-size: 10px; font-weight: 700; text-align: left }
  th.right, td.right { text-align: right }
  th.center, td.center { text-align: center }
  tbody tr { break-inside: avoid; page-break-inside: avoid }
  tbody td { padding: 4px 7px; border-bottom: 1px solid #e5e7eb; font-size: 10px }
  tbody tr:nth-child(even) td { background: #f8fafc }
  td.right { font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, monospace }
  td.empty { text-align: center; color: #94a3b8; padding: 16px }
  tfoot td { padding: 6px 7px; font-weight: 900; font-size: 10px; background: #fef2f2; color: #991b1b;
             border-top: 2px solid #fca5a5 }
  footer.bottom { margin-top: 14px; padding-top: 6px; border-top: 1px solid #cbd5e1;
                  display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8 }
</style></head><body>
  <header class="top">
    <div>
      <div class="company-name">${escapeHtml(company.name || 'POS')}</div>
      ${company.address ? `<div class="company-info">${escapeHtml(company.address)}</div>` : ''}
      ${(company.phone || company.tax_id) ? `<div class="company-info">${escapeHtml([company.phone, company.tax_id && `TAX: ${company.tax_id}`].filter(Boolean).join(' · '))}</div>` : ''}
    </div>
    <div class="doc">
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<div class="sub">${escapeHtml(subtitle)}</div>` : ''}
    </div>
  </header>
  ${metaHtml}
  ${kpiHtml}
  ${tablesHtml}
  <footer class="bottom"><span>ພິມເມື່ອ: ${escapeHtml(printedAt)}</span><span>${escapeHtml(company.name || '')}</span></footer>
  <script>
    window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }
  </script>
</body></html>`;

  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) throw new Error('ເປີດໜ້າຕ່າງພິມບໍ່ໄດ້ — ກະລຸນາອະນຸຍາດ popup');
  win.document.open();
  win.document.write(html);
  win.document.close();
}
