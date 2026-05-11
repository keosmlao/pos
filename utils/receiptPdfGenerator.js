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
    ? `<div class="center"><img src="${location.origin}${company.logo_url}" style="max-height:40px;max-width:60mm;margin:0 auto 4px;object-fit:contain" /></div>`
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
    body { margin: 0; padding: 5mm 4mm; width: 80mm; color: #000; font-size: 12px; line-height: 1.35; }
    .center { text-align: center }
    .right { text-align: right }
    .bold { font-weight: 800 }
    .xl { font-size: 16px }
    .lg { font-size: 14px }
    .sm { font-size: 11px }
    .xs { font-size: 10px; color: #555 }
    .divider { border-top: 1px dashed #000; margin: 6px 0 }
    .double { border-top: 2px solid #000; margin: 6px 0 }
    .row { margin: 4px 0 }
    .name { font-weight: 700; word-break: break-word }
    .line { display: flex; justify-content: space-between; gap: 8px; font-family: monospace; }
    .line span:last-child { text-align: right; flex-shrink: 0 }
    .total { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; font-family: monospace; }
    .grand { font-size: 15px; font-weight: 800 }
    .note { font-size: 10px; margin-top: 4px; padding: 4px; border: 1px dashed #000; word-break: break-word }
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
