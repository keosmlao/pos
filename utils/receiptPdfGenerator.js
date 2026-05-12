const curSymbol = { LAK: '₭', THB: '฿', USD: '$', CNY: '¥', VND: '₫' }
const receiptFontStack = "'Noto Sans Lao', 'Phetsarath OT', 'Saysettha OT', system-ui, sans-serif"

function formatAmount(amount, currency = 'LAK') {
  const cur = curSymbol[currency] || currency
  return new Intl.NumberFormat('lo-LA').format(Math.round(amount)) + ' ' + cur
}

function formatRate(rate) {
  return new Intl.NumberFormat('lo-LA', { maximumFractionDigits: 4 }).format(Number(rate) || 1)
}

function formatDisplayDate(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return '--'

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

async function fetchCompanyProfile() {
  try {
    const res = await fetch('/api/company')
    if (res.ok) {
      const data = await res.json()
      if (data && typeof data === 'object') return data
    }
  } catch {}
  return null
}

function renderBankAccounts(company) {
  const accounts = Array.isArray(company?.bank_accounts) ? company.bank_accounts : []
  if (accounts.length === 0) return ''
  return `
    <div style="margin-top:18px;padding:10px;border:1px dashed #999;font-size:11px;">
      <div style="font-weight:bold;margin-bottom:4px;">ບັນຊີຊຳລະ / Payment Accounts</div>
      ${accounts.map(a => `<div>• ${a.bank_name || ''}${a.account_name ? ` — ${a.account_name}` : ''}${a.account_number ? `: <span style="font-family:monospace">${a.account_number}</span>` : ''}</div>`).join('')}
    </div>
  `
}

function renderThermalCompanyHeader(company) {
  if (!company) return '<div class="center bold xl">POS</div>'
  const logo = company.logo_url
    ? `<div class="center"><img src="${location.origin}${company.logo_url}" style="max-height:40px;max-width:52mm;margin:0 auto 4px;object-fit:contain" /></div>`
    : ''
  const idLine = [company.tax_id && `TAX: ${company.tax_id}`, company.business_reg_no && `REG: ${company.business_reg_no}`].filter(Boolean).join(' · ')
  const contactLine = [company.phone, company.email].filter(Boolean).join(' · ')
  return `
    ${logo}
    <div class="center bold xl">${company.name || 'POS'}</div>
    ${company.slogan ? `<div class="center xs">${company.slogan}</div>` : ''}
    ${company.address ? `<div class="center xs">${company.address}</div>` : ''}
    ${contactLine ? `<div class="center xs">${contactLine}</div>` : ''}
    ${idLine ? `<div class="center xs">${idLine}</div>` : ''}
  `
}

function printThermalHtml(title, bodyHtml) {
  const html = `<!doctype html>
  <html><head><meta charset="utf-8"><title>${title}</title>
  <style>
    @page { size: 80mm auto; margin: 0 }
    * { box-sizing: border-box; font-family: ${receiptFontStack}; }
    html, body { margin: 0; padding: 0; width: 80mm; }
    body { padding: 4mm 3mm; width: 72mm; max-width: 72mm; color: #000; font-size: 11px; line-height: 1.3; overflow: hidden; }
    img { max-width: 52mm !important; height: auto; object-fit: contain; }
    .center { text-align: center }
    .right { text-align: right }
    .bold { font-weight: 800 }
    .xl { font-size: 14px }
    .lg { font-size: 12px }
    .sm { font-size: 10px }
    .xs { font-size: 9px; color: #555 }
    .divider { border-top: 1px dashed #000; margin: 6px 0 }
    .double { border-top: 2px solid #000; margin: 6px 0 }
    .row { margin: 2px 0; break-inside: avoid; }
    .name { font-weight: 700; overflow-wrap: anywhere; word-break: break-word }
    .line { display: flex; justify-content: space-between; gap: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; }
    .line span:first-child { min-width: 0; overflow-wrap: anywhere; }
    .line span:last-child { text-align: right; flex-shrink: 0 }
    .total { display: flex; justify-content: space-between; gap: 6px; margin: 2px 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; }
    .total span:first-child { min-width: 0; overflow-wrap: anywhere; }
    .total span:last-child { text-align: right; flex-shrink: 0 }
    .grand { font-size: 13px; font-weight: 800 }
    .note { font-size: 9px; margin-top: 4px; padding: 4px; border: 1px dashed #000; overflow-wrap: anywhere; word-break: break-word }
    @media print { .no-print { display: none } }
  </style></head><body>
    ${bodyHtml}
    <script>
      window.onload = () => { window.print(); setTimeout(() => window.close(), 400); }
    </script>
  </body></html>`

  const win = window.open('', '_blank', 'width=360,height=700')
  if (!win) throw new Error('Failed to open print window - popup may be blocked')
  win.document.open()
  win.document.write(html)
  win.document.close()
}

function printA4Html(title, bodyHtml) {
  const html = `<!doctype html>
  <html><head><meta charset="utf-8"><title>${title}</title>
  <style>
    @page { size: A4; margin: 12mm }
    * { box-sizing: border-box; font-family: ${receiptFontStack}; }
    body { margin: 0; color: #111827; font-size: 12px; line-height: 1.45; }
    .page { width: 100%; min-height: 273mm; }
    .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 14px; }
    .brand { display: flex; gap: 12px; min-width: 0; }
    .logo { width: 64px; height: 64px; object-fit: contain; border: 1px solid #e5e7eb; padding: 4px; }
    .company { font-size: 19px; font-weight: 900; color: #111827; }
    .muted { color: #6b7280; }
    .xs { font-size: 10px; }
    .sm { font-size: 11px; }
    .docbox { min-width: 190px; text-align: right; }
    .doctitle { font-size: 22px; font-weight: 900; color: #991b1b; letter-spacing: 0; }
    .section { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; margin-bottom: 12px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .label { color: #6b7280; font-size: 10px; font-weight: 800; text-transform: uppercase; }
    .value { font-weight: 700; color: #111827; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f3f4f6; border: 1px solid #d1d5db; padding: 6px 5px; font-size: 10px; text-align: left; color: #374151; }
    td { border: 1px solid #e5e7eb; padding: 6px 5px; vertical-align: top; }
    .right { text-align: right; }
    .center { text-align: center; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .summary { margin-left: auto; width: 310px; margin-top: 12px; }
    .sumrow { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #e5e7eb; padding: 6px 0; }
    .grand { font-size: 16px; font-weight: 900; color: #991b1b; border-bottom: 2px solid #111827; }
    .note { margin-top: 12px; padding: 8px; border: 1px dashed #9ca3af; color: #374151; min-height: 30px; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin-top: 34px; }
    .sig { text-align: center; padding-top: 42px; border-top: 1px solid #374151; font-weight: 700; }
    .no-print { margin-top: 12px; text-align: right; }
    @media print { .no-print { display: none } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style></head><body>
    <div class="page">${bodyHtml}</div>
    <div class="no-print"><button onclick="window.print()">Print</button></div>
    <script>
      window.onload = () => { window.print(); }
    </script>
  </body></html>`

  const win = window.open('', '_blank', 'width=900,height=1100')
  if (!win) throw new Error('Failed to open print window - popup may be blocked')
  win.document.open()
  win.document.write(html)
  win.document.close()
}

async function ensureReceiptFontLoaded() {
  if (typeof document === 'undefined') return
  if (!document.fonts) {
    await new Promise(resolve => setTimeout(resolve, 200))
    return
  }

  await Promise.allSettled([
    document.fonts.load(`400 16px ${receiptFontStack}`),
    document.fonts.load(`500 16px ${receiptFontStack}`),
    document.fonts.load(`700 16px ${receiptFontStack}`)
  ])

  try {
    await document.fonts.ready
  } catch {}
}

/**
 * Generate and print a purchase receipt for a thermal printer
 * @param {Object} purchaseData - The purchase data returned from API
 * @param {Object} form - Purchase form data
 * @param {Array} items - Purchase line items
 * @param {string} suppliername - Supplier name
 * @param {number} subtotal - Order subtotal
 * @param {number} discountAmount - Total discount amount
 * @param {number} itemsTotal - Final total
 * @param {string} currency - Currency code
 */
export async function generateAndPrintPurchaseReceipt(purchaseData, form, items, supplierName, subtotal, discountAmount, itemsTotal, currency) {
  try {
    await ensureReceiptFontLoaded()

    const productMap = {} // Will be populated from items with product names

    // Fetch product details to get names
    try {
      const productRes = await fetch('/api/admin/products')
      if (productRes.ok) {
        const productData = await productRes.json()
        productData.forEach(p => {
          productMap[p.id] = p
        })
      }
    } catch (e) {
      console.log('Could not load products for receipt')
    }

    const company = await fetchCompanyProfile()
    const exRate = Number(purchaseData?.exchange_rate) || 1
    const isForeign = currency && currency !== 'LAK'
    const totalLAK = Math.round(itemsTotal * exRate)
    const paymentType = form.payment_type === 'cash' ? 'ເງິນສົດ (Cash)' : 'ຕິດໜີ້ (Debt)'
    const itemLines = items.map(item => {
      const product = productMap[item.product_id] || {}
      const qty = Number(item.quantity) || 0
      const unitPrice = Number(item.cost_price) || 0
      const disc = Number(item.disc_value) || 0
      let lineDisc = 0
      let lineTotal = 0

      if (item.disc_type === 'percent') {
        const netPrice = unitPrice * (1 - disc / 100)
        lineTotal = Math.round(qty * netPrice)
        lineDisc = Math.round(qty * unitPrice - lineTotal)
      } else if (item.disc_type === 'fixed') {
        const netPrice = Math.max(0, unitPrice - disc)
        lineTotal = Math.round(qty * netPrice)
        lineDisc = disc * qty
      } else {
        lineTotal = qty * unitPrice
      }

      const code = product.product_code || item.product_code || item.item_code || ''
      return `
        <div class="row">
          <div class="name">${product.product_name || product.name || item.product_name || '—'}</div>
          ${code ? `<div class="xs">${code}</div>` : ''}
          <div class="line">
            <span>${qty} x ${formatAmount(unitPrice, currency)}</span>
            <span>${formatAmount(lineTotal, currency)}</span>
          </div>
          ${lineDisc > 0 ? `<div class="line xs"><span>ຫຼຸດ</span><span>-${formatAmount(lineDisc, currency)}</span></div>` : ''}
        </div>
      `
    }).join('')

    const receiptContent = `
      ${renderThermalCompanyHeader(company)}
      <div class="divider"></div>
      <div class="center bold lg">ໃບບິນຊື້ / PURCHASE</div>
      <div class="center xs">Generated: ${formatDisplayDate(new Date())}</div>
      <div class="divider"></div>
      <div class="sm"><span class="bold">ເລກທີ:</span> ${form.ref_number || 'N/A'}</div>
      <div class="sm"><span class="bold">ວັນທີ:</span> ${formatDisplayDate(form.date)}</div>
      <div class="sm"><span class="bold">ຜູ້ສະໜອງ:</span> ${supplierName || 'N/A'}</div>
      <div class="sm"><span class="bold">ປະເພດ:</span> ${paymentType}</div>
      ${isForeign ? `<div class="sm"><span class="bold">Rate:</span> 1 ${currency} = ${formatRate(exRate)} ₭</div>` : ''}
      <div class="divider"></div>
      ${itemLines || '<div class="xs">ບໍ່ມີລາຍການ</div>'}
      <div class="divider"></div>
      <div class="total"><span>ລວມຍ່ອຍ</span><span>${formatAmount(subtotal, currency)}</span></div>
      ${discountAmount > 0 ? `<div class="total"><span>ສ່ວນຫຼຸດ</span><span>-${formatAmount(discountAmount, currency)}</span></div>` : ''}
      <div class="double"></div>
      <div class="total grand"><span>ລວມທັງໝົດ</span><span>${formatAmount(itemsTotal, currency)}</span></div>
      ${isForeign ? `<div class="total bold"><span>ລວມກີບ</span><span>${new Intl.NumberFormat('lo-LA').format(totalLAK)} ₭</span></div>` : ''}
      ${form.note ? `<div class="note">${form.note}</div>` : ''}
      ${renderBankAccounts(company)}
      <div class="divider"></div>
      <div class="center sm bold">ຂໍຂອບໃຈ</div>
      <div style="height:20mm"></div>
    `

    printThermalHtml(`ໃບບິນ ${form.ref_number || ''}`, receiptContent)
  } catch (error) {
    console.error('Error generating receipt:', error)
    alert('Failed to print receipt: ' + error.message)
  }
}

export async function generateAndPrintPurchaseA4(purchaseData, form, items, supplierName, subtotal, discountAmount, itemsTotal, currency) {
  try {
    await ensureReceiptFontLoaded()

    const productMap = {}
    try {
      const productRes = await fetch('/api/admin/products')
      if (productRes.ok) {
        const productData = await productRes.json()
        productData.forEach(p => { productMap[p.id] = p })
      }
    } catch {}

    const company = await fetchCompanyProfile()
    const exRate = Number(purchaseData?.exchange_rate) || 1
    const billCurrency = currency || purchaseData?.currency || 'LAK'
    const isForeign = billCurrency !== 'LAK'
    const totalLAK = Number(purchaseData?.total) || (isForeign ? Number(itemsTotal || 0) * exRate : Number(itemsTotal || 0))
    const displaySubtotal = Number(subtotal || 0)
    const displayDiscount = Number(discountAmount || 0)
    const displayTotal = Number(itemsTotal || 0)
    const paymentType = form.payment_type === 'debt' || purchaseData?.payment_type === 'debt' ? 'ຕິດໜີ້ / Credit' : 'ເງິນສົດ / Cash'
    const docNo = form.ref_number || purchaseData?.ref_number || purchaseData?.sml_doc_no || `#${purchaseData?.id || ''}`
    const docDate = form.date || purchaseData?.created_at || Date.now()
    const idLine = [company?.tax_id && `TAX: ${company.tax_id}`, company?.business_reg_no && `REG: ${company.business_reg_no}`].filter(Boolean).join(' · ')
    const contactLine = [company?.phone, company?.email].filter(Boolean).join(' · ')

    const itemRows = (items || []).map((item, idx) => {
      const product = productMap[item.product_id] || {}
      const qty = Number(item.quantity ?? item.qty) || 0
      const rawUnitPrice = Number(item.cost_price ?? item.price ?? item.unit_price) || 0
      const unitPrice = isForeign && !item.disc_type && !item.disc_value ? rawUnitPrice / exRate : rawUnitPrice
      const disc = Number(item.disc_value || 0)
      let lineDisc = 0
      let lineTotal = 0
      if (item.disc_type === 'percent') {
        const netPrice = unitPrice * (1 - disc / 100)
        lineTotal = Math.round(qty * netPrice)
        lineDisc = Math.round(qty * unitPrice - lineTotal)
      } else if (item.disc_type === 'fixed') {
        const netPrice = Math.max(0, unitPrice - disc)
        lineTotal = Math.round(qty * netPrice)
        lineDisc = Math.round(disc * qty)
      } else {
        lineTotal = Math.round(qty * unitPrice)
      }
      const code = product.product_code || item.product_code || item.item_code || ''
      const name = product.product_name || product.name || item.product_name || item.name || '—'
      const unit = product.unit || item.unit || item.unit_name || item.unit_code || ''
      return `
        <tr>
          <td class="center mono">${idx + 1}</td>
          <td class="mono">${code || '—'}</td>
          <td>${name}</td>
          <td class="center mono">${new Intl.NumberFormat('lo-LA').format(qty)}</td>
          <td class="center">${unit || '—'}</td>
          <td class="right mono">${formatAmount(unitPrice, billCurrency)}</td>
          <td class="right mono">${lineDisc > 0 ? '-' + formatAmount(lineDisc, billCurrency) : '—'}</td>
          <td class="right mono"><strong>${formatAmount(lineTotal, billCurrency)}</strong></td>
        </tr>
      `
    }).join('')

    const body = `
      <div class="header">
        <div class="brand">
          ${company?.logo_url ? `<img class="logo" src="${location.origin}${company.logo_url}" />` : ''}
          <div>
            <div class="company">${company?.name || 'POS'}</div>
            ${company?.slogan ? `<div class="sm muted">${company.slogan}</div>` : ''}
            ${company?.address ? `<div class="sm muted">${company.address}</div>` : ''}
            ${contactLine ? `<div class="sm muted">${contactLine}</div>` : ''}
            ${idLine ? `<div class="xs muted">${idLine}</div>` : ''}
          </div>
        </div>
        <div class="docbox">
          <div class="doctitle">ໃບບິນຊື້ເຂົ້າ</div>
          <div class="sm muted">PURCHASE INVOICE</div>
          <div class="sm"><strong>ເລກທີ:</strong> ${docNo || 'N/A'}</div>
          <div class="sm"><strong>ວັນທີ:</strong> ${formatDisplayDate(docDate)}</div>
        </div>
      </div>

      <div class="grid2">
        <div class="section">
          <div class="label">Supplier</div>
          <div class="value">${supplierName || 'N/A'}</div>
          <div class="sm muted">ຜູ້ສະໜອງ</div>
        </div>
        <div class="section">
          <div class="grid2">
            <div>
              <div class="label">Payment</div>
              <div class="value">${paymentType}</div>
            </div>
            <div>
              <div class="label">Currency</div>
              <div class="value">${billCurrency}</div>
              ${isForeign ? `<div class="xs muted">1 ${billCurrency} = ${formatRate(exRate)} ₭</div>` : ''}
            </div>
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th class="center" style="width:32px">#</th>
            <th style="width:82px">ລະຫັດ</th>
            <th>ລາຍການ</th>
            <th class="center" style="width:58px">ຈຳນວນ</th>
            <th class="center" style="width:56px">ຫົວໜ່ວຍ</th>
            <th class="right" style="width:112px">ລາຄາ</th>
            <th class="right" style="width:96px">ຫຼຸດ</th>
            <th class="right" style="width:120px">ລວມ</th>
          </tr>
        </thead>
        <tbody>${itemRows || '<tr><td colspan="8" class="center muted">ບໍ່ມີລາຍການ</td></tr>'}</tbody>
      </table>

      <div class="summary">
        <div class="sumrow"><span>ລວມຍ່ອຍ</span><strong class="mono">${formatAmount(displaySubtotal, billCurrency)}</strong></div>
        <div class="sumrow"><span>ສ່ວນຫຼຸດ</span><strong class="mono">${displayDiscount > 0 ? '-' : ''}${formatAmount(displayDiscount, billCurrency)}</strong></div>
        <div class="sumrow grand"><span>ລວມທັງໝົດ</span><span class="mono">${formatAmount(displayTotal, billCurrency)}</span></div>
        ${isForeign ? `<div class="sumrow"><span>ລວມກີບ</span><strong class="mono">${formatAmount(totalLAK, 'LAK')}</strong></div>` : ''}
      </div>

      ${form.note || purchaseData?.note ? `<div class="note"><strong>ໝາຍເຫດ:</strong> ${form.note || purchaseData.note}</div>` : ''}

      <div class="signatures">
        <div class="sig">ຜູ້ຈັດຊື້</div>
        <div class="sig">ຜູ້ກວດຮັບ</div>
        <div class="sig">ຜູ້ອະນຸມັດ</div>
      </div>
    `

    printA4Html(`ໃບບິນຊື້ເຂົ້າ ${docNo || ''}`, body)
  } catch (error) {
    console.error('A4 purchase receipt error:', error)
    alert('Failed to print A4: ' + error.message)
  }
}

/**
 * Generate and print a payment receipt (ໃບຮັບເງິນ/ເອກະສານຊຳລະ)
 * @param {Object} payment - payment record { payment_number, payment_date, amount, currency, exchange_rate, payment_method, note, attachment, created_at }
 * @param {Object} purchase - purchase { id, ref_number, supplier_name, total, paid, remaining, currency, exchange_rate }
 */
export async function generateAndPrintPaymentReceipt(payment, purchase) {
  try {
    await ensureReceiptFontLoaded()

    const payCur = payment.currency || 'LAK'
    const paySym = curSymbol[payCur] || payCur
    const payRate = Number(payment.exchange_rate) || 1
    const payAmountLAK = Number(payment.amount) || 0
    const payAmountOriginal = payCur !== 'LAK' ? payAmountLAK / payRate : payAmountLAK

    const billCur = purchase?.currency || 'LAK'
    const billSym = curSymbol[billCur] || billCur
    const billRate = Number(purchase?.exchange_rate) || 1
    const billTotal = Number(purchase?.total) || 0
    const billPaid = Number(purchase?.paid) || 0
    const billRemaining = billTotal - billPaid
    const totalOrig = billCur !== 'LAK' ? billTotal / billRate : billTotal
    const paidOrig = billCur !== 'LAK' ? billPaid / billRate : billPaid
    const remainingOrig = billCur !== 'LAK' ? billRemaining / billRate : billRemaining

    const methodLabel = {
      transfer: 'Bank Transfer / ເງິນໂອນ',
      cash: 'Cash / ເງິນສົດ',
      cheque: 'Cheque / ເຊັກ',
    }[payment.payment_method] || payment.payment_method || '—'

    const dateStr = formatDisplayDate(payment.payment_date || payment.created_at || Date.now())
    const company = await fetchCompanyProfile()
    const itemLines = Array.isArray(purchase?.items) && purchase.items.length > 0
      ? purchase.items.map(it => {
          const qty = Number(it.quantity) || 0
          const priceLAK = Number(it.cost_price) || 0
          const priceOrig = billCur !== 'LAK' ? priceLAK / billRate : priceLAK
          const lineOrig = priceOrig * qty
          return `
            <div class="row">
              <div class="name">${it.product_name || '—'}</div>
              ${it.product_code ? `<div class="xs">${it.product_code}</div>` : ''}
              <div class="line">
                <span>${qty} x ${billSym} ${new Intl.NumberFormat('lo-LA').format(Math.round(priceOrig))}</span>
                <span>${billSym} ${new Intl.NumberFormat('lo-LA').format(Math.round(lineOrig))}</span>
              </div>
            </div>
          `
        }).join('')
      : ''

    const receiptContent = `
      ${renderThermalCompanyHeader(company)}
      <div class="divider"></div>
      <div class="center bold lg">ໃບຮັບເງິນ / PAYMENT</div>
      <div class="center xs">Generated: ${formatDisplayDate(new Date())}</div>
      <div class="divider"></div>
      <div class="sm"><span class="bold">ເລກໃບຊຳລະ:</span> ${payment.payment_number || '—'}</div>
      <div class="sm"><span class="bold">ວັນທີ:</span> ${dateStr}</div>
      <div class="sm"><span class="bold">ຜູ້ສະໜອງ:</span> ${purchase?.supplier_name || '—'}</div>
      <div class="sm"><span class="bold">ບິນຊື້:</span> #${purchase?.id || '—'}${purchase?.ref_number ? ' / ' + purchase.ref_number : ''}</div>
      <div class="sm"><span class="bold">ວິທີຊຳລະ:</span> ${methodLabel}</div>
      <div class="divider"></div>
      <div class="center xs bold">ຈຳນວນເງິນຊຳລະ</div>
      <div class="center bold xl">${paySym} ${new Intl.NumberFormat('lo-LA').format(Math.round(payAmountOriginal))}</div>
      ${payCur !== 'LAK' ? `
        <div class="center sm">= ${new Intl.NumberFormat('lo-LA').format(Math.round(payAmountLAK))} ₭</div>
        <div class="center xs">Rate: 1 ${payCur} = ${formatRate(payRate)} ₭</div>
      ` : ''}
      ${payment.note ? `<div class="note">${payment.note}</div>` : ''}
      ${itemLines ? `<div class="divider"></div>${itemLines}` : ''}
      <div class="divider"></div>
      <div class="total"><span>ຍອດລວມ</span><span>${billSym} ${new Intl.NumberFormat('lo-LA').format(Math.round(totalOrig))}</span></div>
      ${billCur !== 'LAK' ? `<div class="total xs"><span>ຍອດລວມ LAK</span><span>${new Intl.NumberFormat('lo-LA').format(Math.round(billTotal))} ₭</span></div>` : ''}
      <div class="total"><span>ຊຳລະແລ້ວ</span><span>${billSym} ${new Intl.NumberFormat('lo-LA').format(Math.round(paidOrig))}</span></div>
      <div class="double"></div>
      <div class="total grand"><span>${billRemaining <= 0 ? 'ຊຳລະຄົບ' : 'ຍັງເຫຼືອ'}</span><span>${billRemaining <= 0 ? 'PAID' : billSym + ' ' + new Intl.NumberFormat('lo-LA').format(Math.round(remainingOrig))}</span></div>
      ${billRemaining > 0 && billCur !== 'LAK' ? `<div class="total xs"><span>ຍັງເຫຼືອ LAK</span><span>${new Intl.NumberFormat('lo-LA').format(Math.round(billRemaining))} ₭</span></div>` : ''}
      <div class="divider"></div>
      <div class="center sm bold">ຂໍຂອບໃຈ</div>
      <div style="height:20mm"></div>
    `

    printThermalHtml(`ໃບຮັບເງິນ ${payment.payment_number || ''}`, receiptContent)
  } catch (error) {
    console.error('Payment receipt error:', error)
    alert('ບໍ່ສາມາດສ້າງເອກະສານໄດ້: ' + error.message)
  }
}
