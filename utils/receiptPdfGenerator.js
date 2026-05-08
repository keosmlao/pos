import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const curSymbol = { LAK: '₭', THB: '฿', USD: '$', CNY: '¥', VND: '₫' }
const receiptFontStack = "'Noto Sans Lao', 'Phetsarath OT', 'Saysettha OT', system-ui, sans-serif"

function formatAmount(amount, currency = 'LAK') {
  const cur = curSymbol[currency] || currency
  return new Intl.NumberFormat('lo-LA').format(Math.round(amount)) + ' ' + cur
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

function renderCompanyHeader(company) {
  if (!company) return ''
  const logo = company.logo_url
    ? `<img src="${location.origin}${company.logo_url}" style="max-height:50px;max-width:160px;margin-right:14px;object-fit:contain" />`
    : ''
  const idLine = [company.tax_id && `TAX: ${company.tax_id}`, company.business_reg_no && `REG: ${company.business_reg_no}`].filter(Boolean).join(' · ')
  const contactLine = [company.phone, company.email].filter(Boolean).join(' · ')
  return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #ddd;">
      ${logo}
      <div style="flex:1;">
        <div style="font-size:18px;font-weight:bold;color:#111;">${company.name || ''}</div>
        ${company.slogan ? `<div style="font-size:11px;color:#666;margin-top:2px;">${company.slogan}</div>` : ''}
        ${company.address ? `<div style="font-size:11px;color:#444;margin-top:2px;">${company.address}</div>` : ''}
        ${contactLine ? `<div style="font-size:11px;color:#444;">${contactLine}</div>` : ''}
        ${idLine ? `<div style="font-size:10px;color:#888;margin-top:2px;">${idLine}</div>` : ''}
      </div>
    </div>
  `
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
 * Generate and print a purchase receipt PDF
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

    // Create a hidden div with receipt HTML - positioned off-screen but with dimensions
    const receiptHtml = document.createElement('div')
    receiptHtml.style.cssText = `position:fixed;top:-10000px;left:0;width:210mm;background:white;z-index:-1;font-family:${receiptFontStack};color:#111827;`

    const productMap = {} // Will be populated from items with product names
    let productsLoaded = false

    // Fetch product details to get names
    try {
      const productRes = await fetch('/api/admin/products')
      if (productRes.ok) {
        const productData = await productRes.json()
        productData.forEach(p => {
          productMap[p.id] = p
        })
        productsLoaded = true
      }
    } catch (e) {
      console.log('Could not load products for receipt')
    }

    const company = await fetchCompanyProfile()

    const receiptContent = `
      <div style="font-family: ${receiptFontStack}; width: 210mm; margin: 0 auto; padding: 20px; background: white; line-height: 1.5;">
        ${renderCompanyHeader(company)}
        <!-- Header -->
        <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px;">
          <h1 style="margin: 0 0 5px 0; font-size: 18px; font-weight: bold;">RECEIPT / ໃບບິນ</h1>
          <p style="margin: 5px 0; font-size: 12px; color: #666;">Purchase Order - ໃບສັ່ງຊື້</p>
          <p style="margin: 3px 0; font-size: 11px; color: #999;">Generated: ${formatDisplayDate(new Date())}</p>
        </div>

        <!-- Order Info -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; font-size: 12px;">
          <div>
            <p style="margin: 0 0 8px 0; font-weight: bold; color: #333;">Supplier / ຜູ້ສະໜອງ</p>
            <p style="margin: 0; font-weight: 500;">${supplierName || 'N/A'}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0 0 8px 0; font-weight: bold; color: #333;">PO Number / ເລກທີ</p>
            <p style="margin: 0; font-family: monospace; font-weight: 500; font-size: 13px;">${form.ref_number || 'N/A'}</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; font-size: 12px;">
          <div>
            <p style="margin: 0 0 8px 0; font-weight: bold; color: #333;">Date / ວັນທີ</p>
            <p style="margin: 0;">${formatDisplayDate(form.date)}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0 0 8px 0; font-weight: bold; color: #333;">Payment Type / ປະເພດ</p>
            <p style="margin: 0; font-weight: 500; color: ${form.payment_type === 'cash' ? '#10b981' : '#ef4444'};">
              ${form.payment_type === 'cash' ? '\u{1F4B5} ເງິນສົດ (Cash)' : '\u{1F4CB} ຕິດໜີ້ (Debt)'}
            </p>
          </div>
        </div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px;">
          <thead>
            <tr style="background: #f0f0f0; border-bottom: 2px solid #333;">
              <th style="text-align: left; padding: 8px; font-weight: bold; width: 90px;">Code / ລະຫັດ</th>
              <th style="text-align: left; padding: 8px; font-weight: bold;">Product / ສິນຄ້າ</th>
              <th style="text-align: center; padding: 8px; font-weight: bold; width: 60px;">Qty / ຈຳນວນ</th>
              <th style="text-align: right; padding: 8px; font-weight: bold; width: 80px;">Unit Price / ລາຄາ</th>
              <th style="text-align: right; padding: 8px; font-weight: bold; width: 60px;">Disc. / ຫຼຸດ</th>
              <th style="text-align: right; padding: 8px; font-weight: bold; width: 80px;">Total / ລວມ</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, idx) => {
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
                <tr style="border-bottom: 1px solid #e5e5e5;">
                  <td style="padding: 8px; text-align: left; font-family: monospace; color: #6366f1;">${code || '-'}</td>
                  <td style="padding: 8px; text-align: left;">${product.product_name || product.name || item.product_name || '—'}</td>
                  <td style="padding: 8px; text-align: center;">${qty}</td>
                  <td style="padding: 8px; text-align: right;">${formatAmount(unitPrice, currency)}</td>
                  <td style="padding: 8px; text-align: right;">${lineDisc > 0 ? formatAmount(lineDisc, currency) : '-'}</td>
                  <td style="padding: 8px; text-align: right; font-weight: 500;">${formatAmount(lineTotal, currency)}</td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>

        <!-- Totals -->
        ${(() => {
          const exRate = Number(purchaseData?.exchange_rate) || 1
          const isForeign = currency && currency !== 'LAK'
          const subtotalLAK = Math.round(subtotal * exRate)
          const discountLAK = Math.round(discountAmount * exRate)
          const totalLAK = Math.round(itemsTotal * exRate)
          return `
        <div style="display: flex; justify-content: flex-end; margin-bottom: 15px;">
          <div style="width: 340px;">
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 15px; font-size: 12px; margin-bottom: 10px;">
              <div style="text-align: right; color: #666; font-weight: 500;">Subtotal / ລວມຍ່ອຍ:</div>
              <div style="text-align: right; font-weight: 500;">${formatAmount(subtotal, currency)}</div>
            </div>
            ${discountAmount > 0 ? `
              <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 15px; font-size: 12px; margin-bottom: 10px;">
                <div style="text-align: right; color: #ef4444; font-weight: 500;">Discount / ຫຼຸດ:</div>
                <div style="text-align: right; color: #ef4444; font-weight: 500;">-${formatAmount(discountAmount, currency)}</div>
              </div>
            ` : ''}
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 15px; font-size: 14px; border-top: 2px solid #333; padding-top: 10px;">
              <div style="text-align: right; font-weight: bold;">Total / ລວມທັງສິ້ນ:</div>
              <div style="text-align: right; font-weight: bold; font-size: 16px;">${formatAmount(itemsTotal, currency)}</div>
            </div>
            ${isForeign ? `
              <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 15px; font-size: 13px; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #999;">
                <div style="text-align: right; color: #059669; font-weight: 600;">ລວມ (ເປັນກີບ) / Total LAK:</div>
                <div style="text-align: right; font-weight: bold; color: #059669; font-size: 15px;">${new Intl.NumberFormat('lo-LA').format(totalLAK)} ₭</div>
              </div>
            ` : ''}
          </div>
        </div>`
        })()}

        <!-- Payment Info -->
        <div style="background: #f9f9f9; border-left: 4px solid #3b82f6; padding: 12px; margin-top: 20px; font-size: 11px;">
          <p style="margin: 0 0 8px 0; font-weight: bold; color: #333;">Payment Method / ວິທີຊຳລະ</p>
          <p style="margin: 0; color: #666;">
            ${form.payment_type === 'cash'
              ? `\u{1F4B5} ${form.payment_method === 'transfer' ? '\u{1F3E6} Bank Transfer' : '\u{1F4B5} Cash Payment'}`
              : '\u{1F4CB} Debt - Pay Later / ຕິດໜີ້ - ຊຳລະພາຍຫຼັງ'}
          </p>
          ${form.currency !== 'LAK' ? `
            <p style="margin: 8px 0 0 0; color: #666;">
              Exchange Rate: 1 ${form.currency} = ${form.currency === 'THB' ? '600' : form.currency === 'USD' ? '21,500' : form.currency === 'CNY' ? '2,950' : '0.85'} ₭
            </p>
          ` : ''}
          ${form.note ? `<p style="margin: 8px 0 0 0; color: #666;"><strong>Note:</strong> ${form.note}</p>` : ''}
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 25px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 10px; color: #999;">
          <p style="margin: 0;">Thank you for your business / ຂອບໃຈ</p>
          <p style="margin: 5px 0 0 0;">POS System \u2022 ${new Date().toLocaleTimeString('lo-LA')}</p>
        </div>
      </div>
    `

    receiptHtml.innerHTML = receiptContent
    document.body.appendChild(receiptHtml)

    // Wait for font/layout to settle before html2canvas processes it.
    await ensureReceiptFontLoaded()
    await new Promise(resolve => setTimeout(resolve, 150))

    // Convert HTML to Canvas with improved settings
    let canvas
    try {
      canvas = await html2canvas(receiptHtml, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: true,
        removeContainer: true
      })
    } catch (canvasErr) {
      console.error('Canvas conversion failed:', canvasErr)
      document.body.removeChild(receiptHtml)
      throw new Error('Failed to render receipt: ' + canvasErr.message)
    }

    // Validate canvas dimensions
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
      document.body.removeChild(receiptHtml)
      throw new Error('Invalid canvas dimensions: ' + (canvas ? `${canvas.width}x${canvas.height}` : 'canvas is null'))
    }

    // Use JPEG instead of PNG for better reliability
    let imgData
    try {
      imgData = canvas.toDataURL('image/jpeg', 0.95)
    } catch (dataErr) {
      console.error('DataURL conversion failed:', dataErr)
      document.body.removeChild(receiptHtml)
      throw new Error('Failed to generate image data: ' + dataErr.message)
    }

    // Validate image data
    if (!imgData || imgData.length === 0) {
      document.body.removeChild(receiptHtml)
      throw new Error('Generated image data is empty')
    }

    // Create PDF from canvas
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    // Calculate dimensions with validation
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()

    // Calculate image height maintaining aspect ratio
    let imgWidth = pageWidth - 20 // Leave 10mm margin on each side
    let imgHeight = (canvas.height * imgWidth) / canvas.width

    // Ensure valid positive dimensions
    if (imgWidth <= 0 || imgHeight <= 0 || !isFinite(imgHeight)) {
      document.body.removeChild(receiptHtml)
      throw new Error('Invalid calculated image dimensions: width=' + imgWidth + ', height=' + imgHeight)
    }

    try {
      // Add image to first page
      pdf.addImage(imgData, 'JPEG', 10, 10, imgWidth, imgHeight)
    } catch (addErr) {
      console.error('PDF image add failed:', addErr)
      console.error('Image dimensions:', { imgWidth, imgHeight, pageWidth, pageHeight })
      console.error('Canvas dimensions:', { canvasWidth: canvas.width, canvasHeight: canvas.height })
      document.body.removeChild(receiptHtml)
      throw new Error('Failed to add image to PDF: ' + addErr.message)
    }

    // Handle multiple pages if receipt is long
    let currentY = 10 + imgHeight
    if (currentY > pageHeight - 10) { // A4 height - margin
      let heightRemaining = imgHeight
      let sourceY = pageHeight - 20 // How much fit on first page

      while (heightRemaining > 0) {
        pdf.addPage()
        try {
          // For multi-page, we'd need to slice the image or use a different approach
          // For now, keep it simple - just add on one page
          break
        } catch (e) {
          console.error('Multi-page error:', e)
          break
        }
      }
    }

    // Clean up
    document.body.removeChild(receiptHtml)

    // Trigger print
    try {
      const pdfUrl = pdf.output('bloburi')
      const printWindow = window.open(pdfUrl)
      if (printWindow) {
        printWindow.onload = function() {
          setTimeout(() => {
            printWindow.print()
          }, 250)
        }
      } else {
        throw new Error('Failed to open print window - popup may be blocked')
      }
    } catch (printErr) {
      console.error('Print window error:', printErr)
      alert('Popup blocked or failed to open. Please allow popups and try again.')
      throw printErr
    }
  } catch (error) {
    console.error('Error generating receipt:', error)
    alert('Failed to generate receipt PDF: ' + error.message)
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

    const receiptHtml = document.createElement('div')
    receiptHtml.style.cssText = `position:fixed;top:-10000px;left:0;width:210mm;background:white;z-index:-1;font-family:${receiptFontStack};color:#111827;`

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
      transfer: '🏦 Bank Transfer / ເງິນໂອນ',
      cash: '💵 Cash / ເງິນສົດ',
      cheque: '📝 Cheque / ເຊັກ',
    }[payment.payment_method] || payment.payment_method || '—'

    const dateStr = formatDisplayDate(payment.payment_date || payment.created_at || Date.now())
    const company = await fetchCompanyProfile()

    receiptHtml.innerHTML = `
      <div style="font-family: ${receiptFontStack}; width: 210mm; padding: 24px; background: white; line-height: 1.5;">
        ${renderCompanyHeader(company)}
        <!-- Header -->
        <div style="text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 16px; margin-bottom: 20px;">
          <h1 style="margin: 0 0 4px 0; font-size: 20px; font-weight: bold; color: #065f46;">PAYMENT RECEIPT / ໃບຮັບເງິນ</h1>
          <p style="margin: 2px 0; font-size: 12px; color: #6b7280;">ເອກະສານຢືນຢັນການຊຳລະ</p>
          <p style="margin: 2px 0; font-size: 11px; color: #9ca3af;">Generated: ${formatDisplayDate(new Date())}</p>
        </div>

        <!-- Meta info 2 cols -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; font-size: 12px;">
          <div>
            <p style="margin: 0 0 6px 0; color: #6b7280; font-weight: bold;">Payment No. / ເລກໃບຊຳລະ</p>
            <p style="margin: 0; font-family: monospace; font-weight: bold; font-size: 14px; color: #065f46;">${payment.payment_number || '—'}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0 0 6px 0; color: #6b7280; font-weight: bold;">Date / ວັນທີ</p>
            <p style="margin: 0; font-weight: 500;">${dateStr}</p>
          </div>
        </div>

        <!-- Supplier / PO Ref -->
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px;">
            <div>
              <p style="margin: 0 0 4px 0; color: #9ca3af; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Supplier / ຜູ້ສະໜອງ</p>
              <p style="margin: 0; font-weight: 600; color: #111827;">${purchase?.supplier_name || '—'}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0 0 4px 0; color: #9ca3af; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Purchase Order / ໃບສັ່ງຊື້</p>
              <p style="margin: 0; font-family: monospace; font-weight: 600; color: #111827;">#${purchase?.id || '—'}${purchase?.ref_number ? ' • ' + purchase.ref_number : ''}</p>
            </div>
          </div>
        </div>

        <!-- Amount box -->
        <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border: 2px solid #10b981; border-radius: 12px; padding: 20px; margin-bottom: 20px; text-align: center;">
          <p style="margin: 0 0 8px 0; font-size: 11px; color: #065f46; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Amount Paid / ຈຳນວນເງິນຊຳລະ</p>
          <p style="margin: 0; font-size: 32px; font-weight: 900; color: #064e3b; font-family: monospace;">
            ${paySym} ${new Intl.NumberFormat('lo-LA').format(Math.round(payAmountOriginal))}
          </p>
          ${payCur !== 'LAK' ? `
            <p style="margin: 6px 0 0 0; font-size: 14px; color: #047857; font-family: monospace;">
              ≈ ${new Intl.NumberFormat('lo-LA').format(Math.round(payAmountLAK))} ₭
            </p>
            <p style="margin: 4px 0 0 0; font-size: 10px; color: #059669;">Exchange Rate: 1 ${paySym} = ${new Intl.NumberFormat('lo-LA').format(payRate)} ₭</p>
          ` : ''}
        </div>

        <!-- Method + Note -->
        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 12px; margin-bottom: 20px; font-size: 12px;">
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px;">
            <p style="margin: 0 0 4px 0; color: #9ca3af; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Method / ວິທີຊຳລະ</p>
            <p style="margin: 0; font-weight: 600; color: #111827;">${methodLabel}</p>
          </div>
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px;">
            <p style="margin: 0 0 4px 0; color: #9ca3af; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Note / ໝາຍເຫດ</p>
            <p style="margin: 0; color: #374151;">${payment.note || '—'}</p>
          </div>
        </div>

        <!-- Items list -->
        ${Array.isArray(purchase?.items) && purchase.items.length > 0 ? `
        <div style="margin-bottom: 16px;">
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Items / ລາຍການສິນຄ້າ (${purchase.items.length})</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
              <tr style="background: #f3f4f6; border-bottom: 2px solid #d1d5db;">
                <th style="text-align: left; padding: 6px 8px; font-weight: 600; color: #4b5563; width: 30px;">#</th>
                <th style="text-align: left; padding: 6px 8px; font-weight: 600; color: #4b5563; width: 90px;">Code / ລະຫັດ</th>
                <th style="text-align: left; padding: 6px 8px; font-weight: 600; color: #4b5563;">Product / ສິນຄ້າ</th>
                <th style="text-align: center; padding: 6px 8px; font-weight: 600; color: #4b5563; width: 50px;">Qty</th>
                <th style="text-align: right; padding: 6px 8px; font-weight: 600; color: #4b5563; width: 90px;">Price</th>
                <th style="text-align: right; padding: 6px 8px; font-weight: 600; color: #4b5563; width: 90px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${purchase.items.map((it, i) => {
                const qty = Number(it.quantity) || 0
                const priceLAK = Number(it.cost_price) || 0
                const priceOrig = billCur !== 'LAK' ? priceLAK / billRate : priceLAK
                const lineOrig = priceOrig * qty
                return `
                  <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 6px 8px; color: #9ca3af; font-family: monospace;">${i + 1}</td>
                    <td style="padding: 6px 8px; font-family: monospace; color: #4f46e5;">${it.product_code || '—'}</td>
                    <td style="padding: 6px 8px; color: #374151;">${it.product_name || '—'}</td>
                    <td style="padding: 6px 8px; text-align: center; font-family: monospace; font-weight: 600;">${qty}</td>
                    <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #6b7280;">${billSym} ${new Intl.NumberFormat('lo-LA').format(Math.round(priceOrig))}</td>
                    <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 600; color: #111827;">${billSym} ${new Intl.NumberFormat('lo-LA').format(Math.round(lineOrig))}</td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        <!-- PO Summary table -->
        <div style="margin-bottom: 16px;">
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Purchase Order Summary / ສະຫຼຸບໃບສັ່ງຊື້</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tbody>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px; color: #6b7280;">Total / ຍອດລວມ</td>
                <td style="padding: 8px; text-align: right; font-family: monospace; font-weight: 600; color: #111827;">
                  ${billSym} ${new Intl.NumberFormat('lo-LA').format(Math.round(totalOrig))}
                  ${billCur !== 'LAK' ? `<span style="color: #9ca3af; font-size: 10px; margin-left: 6px;">(${new Intl.NumberFormat('lo-LA').format(Math.round(billTotal))} ₭)</span>` : ''}
                </td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px; color: #059669;">Paid (including this) / ຊຳລະແລ້ວ</td>
                <td style="padding: 8px; text-align: right; font-family: monospace; font-weight: 600; color: #047857;">
                  ${billSym} ${new Intl.NumberFormat('lo-LA').format(Math.round(paidOrig))}
                  ${billCur !== 'LAK' ? `<span style="color: #9ca3af; font-size: 10px; margin-left: 6px;">(${new Intl.NumberFormat('lo-LA').format(Math.round(billPaid))} ₭)</span>` : ''}
                </td>
              </tr>
              <tr style="background: ${billRemaining <= 0 ? '#d1fae5' : '#fef2f2'}; border-top: 2px solid ${billRemaining <= 0 ? '#10b981' : '#ef4444'};">
                <td style="padding: 10px 8px; font-weight: 700; color: ${billRemaining <= 0 ? '#047857' : '#991b1b'};">${billRemaining <= 0 ? 'Fully Paid / ຊຳລະຄົບ' : 'Remaining / ຍັງເຫຼືອ'}</td>
                <td style="padding: 10px 8px; text-align: right; font-family: monospace; font-weight: 800; font-size: 14px; color: ${billRemaining <= 0 ? '#047857' : '#991b1b'};">
                  ${billRemaining <= 0 ? '✓ PAID' : billSym + ' ' + new Intl.NumberFormat('lo-LA').format(Math.round(remainingOrig))}
                  ${billRemaining > 0 && billCur !== 'LAK' ? `<div style="color: #9ca3af; font-size: 10px; font-weight: 400;">(${new Intl.NumberFormat('lo-LA').format(Math.round(billRemaining))} ₭)</div>` : ''}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Signatures -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 48px;">
          <div style="text-align: center;">
            <div style="border-top: 1px solid #9ca3af; padding-top: 6px; margin-top: 36px;">
              <p style="margin: 0; font-size: 11px; color: #6b7280;">Paid By / ຜູ້ຊຳລະ</p>
            </div>
          </div>
          <div style="text-align: center;">
            <div style="border-top: 1px solid #9ca3af; padding-top: 6px; margin-top: 36px;">
              <p style="margin: 0; font-size: 11px; color: #6b7280;">Received By / ຜູ້ຮັບເງິນ</p>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 28px; padding-top: 12px; border-top: 1px dashed #d1d5db; font-size: 10px; color: #9ca3af;">
          <p style="margin: 0;">ຂໍຂອບໃຈ / Thank you</p>
          <p style="margin: 4px 0 0 0;">POS System • ${new Date().toLocaleTimeString('lo-LA')}</p>
        </div>
      </div>
    `

    document.body.appendChild(receiptHtml)
    await ensureReceiptFontLoaded()
    await new Promise(r => setTimeout(r, 150))

    const canvas = await html2canvas(receiptHtml, {
      scale: 1.5, useCORS: true, logging: false, backgroundColor: '#ffffff', allowTaint: true, removeContainer: true
    })
    if (!canvas || canvas.width <= 0) { document.body.removeChild(receiptHtml); throw new Error('Canvas failed') }

    const imgData = canvas.toDataURL('image/jpeg', 0.95)
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const imgWidth = pageWidth - 20
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    pdf.addImage(imgData, 'JPEG', 10, 10, imgWidth, imgHeight)

    document.body.removeChild(receiptHtml)

    const pdfUrl = pdf.output('bloburi')
    const printWindow = window.open(pdfUrl)
    if (printWindow) {
      printWindow.onload = () => setTimeout(() => printWindow.print(), 250)
    }
  } catch (error) {
    console.error('Payment receipt error:', error)
    alert('ບໍ່ສາມາດສ້າງເອກະສານໄດ້: ' + error.message)
  }
}
