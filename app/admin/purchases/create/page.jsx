'use client';

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import SearchSelect from '@/components/SearchSelect'
import { generateAndPrintPurchaseA4 } from '@/utils/receiptPdfGenerator'

const API = '/api'

const defaultCurrencies = [
  { value: 'LAK', label: 'LAK', symbol: '₭', rate: 1 },
  { value: 'THB', label: 'THB', symbol: '฿', rate: 625 },
  { value: 'USD', label: 'USD', symbol: '$', rate: 21500 },
  { value: 'CNY', label: 'CNY', symbol: '¥', rate: 2950 },
  { value: 'VND', label: 'VND', symbol: '₫', rate: 0.85 },
]

const paymentMethods = [
  { value: 'cash', label: 'ເງິນສົດ', icon: '💵' },
  { value: 'transfer', label: 'ໂອນ', icon: '🏦' },
  { value: 'other', label: 'ອື່ນ', icon: '📋' },
]

function formatAmount(amount, currency = 'LAK') {
  const cur = defaultCurrencies.find(c => c.value === currency)
  return new Intl.NumberFormat('lo-LA').format(amount) + ' ' + (cur?.symbol || currency)
}

export default function PurchaseCreate() {
  const router = useRouter()
  const navigate = (path, opts = {}) => {
    if (opts.state) sessionStorage.setItem('navState', JSON.stringify(opts.state))
    else if (!opts.replace) sessionStorage.removeItem('navState')
    if (opts.replace) router.replace(path); else router.push(path)
  }
  const [pendingInvoice] = useState(() => {
    if (typeof window === 'undefined') return null
    const raw = sessionStorage.getItem('navState')
    if (!raw) return null
    try { return JSON.parse(raw)?.pendingInvoice || null } catch { return null }
  })
  const [pendingRequest] = useState(() => {
    if (typeof window === 'undefined') return null
    const raw = sessionStorage.getItem('navState')
    if (!raw) return null
    try { return JSON.parse(raw)?.pendingRequest || null } catch { return null }
  })
  useEffect(() => { sessionStorage.removeItem('navState') }, [])
  const fileRef = useRef(null)

  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [currencies, setCurrencies] = useState(defaultCurrencies)
  const [form, setForm] = useState({
    supplier_id: '', paid: '', note: '',
    date: new Date().toISOString().split('T')[0],
    currency: 'LAK', payment_type: 'cash', payment_method: 'cash',
    payment_note: '', ref_number: '', bill_number: ''
  })
  const [items, setItems] = useState([{ product_id: '', quantity: 1, cost_price: '', unit: '', disc_type: 'none', disc_value: '' }])
  const [discount, setDiscount] = useState({ type: 'none', value: '' })
  const [lastPrices, setLastPrices] = useState({})
  const [loading, setLoading] = useState(false)
  const [invoiceFile, setInvoiceFile] = useState(null)
  const [invoiceName, setInvoiceName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [exchangeRate, setExchangeRate] = useState(1)
  const [poFormat, setPoFormat] = useState('')
  const [showFormatSettings, setShowFormatSettings] = useState(false)
  const [productPicker, setProductPicker] = useState(null) // { rowIdx }
  const [pickerSearch, setPickerSearch] = useState('')
  const [editFormat, setEditFormat] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [purchaseData, setPurchaseData] = useState(null)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/admin/suppliers`).then(r => r.json()),
      fetch(`${API}/admin/products`).then(r => r.json()),
      fetch(`${API}/admin/currencies`).then(r => r.json()).catch(() => defaultCurrencies),
    ]).then(([suppliersData, productsData, currencyData]) => {
      setSuppliers(suppliersData)
      setProducts(productsData)
      const enabledCurrencies = Array.isArray(currencyData)
        ? currencyData
            .filter(c => c.enabled !== false)
            .map(c => ({
              value: c.code,
              label: c.code,
              symbol: c.symbol || c.code,
              rate: Number(c.rate) || 1,
            }))
        : defaultCurrencies
      setCurrencies(enabledCurrencies.length > 0 ? enabledCurrencies : defaultCurrencies)

      if (pendingInvoice) {
        const pickNum = (obj, keys) => {
          if (!obj) return 0
          for (const k of keys) {
            const v = Number(obj[k])
            if (!isNaN(v) && v !== 0) return v
          }
          return 0
        }
        const productByCode = new Map(productsData.map(p => [String(p.product_code || '').trim(), p]))
        const mappedItems = (Array.isArray(pendingInvoice.items) ? pendingInvoice.items : [])
          .map(it => {
            const code = String(it.item_code || '').trim()
            const p = productByCode.get(code)
            if (!p) return null
            const qty = pickNum(it, ['qty', 'quantity']) || 1
            const smlPrice = pickNum(it, ['price', 'unit_price', 'item_price', 'price_2'])
            const smlLineDiscount = pickNum(it, ['sum_discount', 'discount_amount', 'discount_amt', 'line_discount'])
            const discPerUnit = qty > 0 && smlLineDiscount > 0 ? Math.round((smlLineDiscount / qty) * 100) / 100 : 0
            return {
              product_id: p.id,
              quantity: qty,
              cost_price: smlPrice || Number(p.cost_price) || '',
              unit: p.unit || it.unit_code || '',
              disc_type: discPerUnit > 0 ? 'fixed' : 'none',
              disc_value: discPerUnit > 0 ? String(discPerUnit) : ''
            }
          })
          .filter(Boolean)

        if (mappedItems.length > 0) setItems(mappedItems)
        const thbRate = enabledCurrencies.find(c => c.value === 'THB')?.rate || 625
        setExchangeRate(thbRate)
        setForm(f => ({
          ...f,
          supplier_id: pendingInvoice.supplier_id ? String(pendingInvoice.supplier_id) : '',
          bill_number: pendingInvoice.doc_no || '',
          currency: 'THB',
          note: `ນຳເຂົ້າຈາກບິນ SML: ${pendingInvoice.doc_no}`
        }))
      }

      if (pendingRequest) {
        const prItems = (Array.isArray(pendingRequest.items) ? pendingRequest.items : [])
          .map(it => {
            const productById = productsData.find(p => Number(p.id) === Number(it.product_id))
            if (!productById) return null
            return {
              product_id: productById.id,
              quantity: Number(it.quantity) || 1,
              cost_price: Number(it.cost_price) || Number(productById.cost_price) || '',
              unit: productById.unit || '',
              disc_type: 'none',
              disc_value: '',
            }
          })
          .filter(Boolean)
        if (prItems.length > 0) setItems(prItems)
        setForm(f => ({
          ...f,
          supplier_id: pendingRequest.supplier_id ? String(pendingRequest.supplier_id) : '',
          note: pendingRequest.note || `ດຶງຈາກໃບສະເໜີຊື້: ${pendingRequest.request_number || ''}`,
        }))
      }
    })
    fetch(`${API}/admin/purchases/next-number`).then(r => r.json()).then(data => {
      setForm(f => ({ ...f, ref_number: data.number }))
      setPoFormat(data.format)
    })
    fetch(`${API}/admin/products/last-prices`).then(r => r.json()).then(data => {
      const map = {}
      data.forEach(d => { map[d.product_id] = d })
      setLastPrices(map)
    })
  }, [pendingInvoice, pendingRequest])

  const addItem = () => setItems([...items, { product_id: '', quantity: 1, cost_price: '', unit: '', disc_type: 'none', disc_value: '' }])
  const removeItem = (i) => items.length > 1 && setItems(items.filter((_, idx) => idx !== i))
  const updateItem = (i, field, val) => { const u = [...items]; u[i] = { ...u[i], [field]: val }; setItems(u) }

  const selectProduct = (i, val) => {
    const p = products.find(pr => pr.id === Number(val))
    const lp = lastPrices[Number(val)]
    const u = [...items]
    let price = ''
    if (lp && lp.last_cost_lak > 0) {
      price = exchangeRate > 0 ? Math.round(lp.last_cost_lak / exchangeRate) : lp.last_cost_lak
    } else if (p?.cost_price > 0) {
      price = exchangeRate > 0 ? Math.round(p.cost_price / exchangeRate) : p.cost_price
    }
    u[i] = { ...u[i], product_id: val, cost_price: price, unit: p?.unit || '', disc_type: 'none', disc_value: '' }
    setItems(u)
  }

  const calcLineTotal = (item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.cost_price) || 0
    const disc = Number(item.disc_value) || 0
    if (item.disc_type === 'percent') return Math.round(qty * price * (1 - disc / 100))
    if (item.disc_type === 'fixed') return Math.round(qty * Math.max(0, price - disc))
    return qty * price
  }

  const calcNetUnitPrice = (item) => {
    const price = Number(item.cost_price) || 0
    const disc = Number(item.disc_value) || 0
    if (item.disc_type === 'percent') return Math.round(price * (1 - disc / 100))
    if (item.disc_type === 'fixed') return Math.max(0, price - disc)
    return price
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setInvoiceName(file.name)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${API}/admin/uploads/invoice`, {
      method: 'POST',
      body: fd
    })
    if (res.ok) {
      const data = await res.json()
      setInvoiceFile(data.filename)
    } else {
      const err = await res.json().catch(() => ({}))
      alert('ອັບໂຫຼດບໍ່ສຳເລັດ: ' + (err.error || res.status))
    }
    setUploading(false)
  }

  const subtotal = items.reduce((s, i) => s + calcLineTotal(i), 0)
  const discountAmount = discount.type === 'percent' ? Math.round(subtotal * (Number(discount.value) || 0) / 100) :
    discount.type === 'fixed' ? (Number(discount.value) || 0) : 0
  const itemsTotal = Math.max(0, subtotal - discountAmount)
  const totalAmountLAK = Math.max(0, Math.round(itemsTotal * exchangeRate))
  const paidAmountLAK = form.payment_type === 'debt' ? 0 : totalAmountLAK
  const remainingAmountLAK = Math.max(0, totalAmountLAK - paidAmountLAK)
  const paidAmountOriginal = form.payment_type === 'debt' ? 0 : itemsTotal
  const remainingAmountOriginal = form.payment_type === 'debt' ? itemsTotal : 0
  const paymentStatus = paidAmountLAK >= totalAmountLAK && totalAmountLAK > 0 ? 'paid' : paidAmountLAK > 0 ? 'partial' : 'pending'
  const validItems = items.filter(i => i.product_id && i.quantity && i.cost_price)
  const cur = currencies.find(c => c.value === form.currency)
  const selectedSupplier = suppliers.find(s => s.id === Number(form.supplier_id))

  const handleConfirm = async () => {
    if (validItems.length === 0) return alert('ກະລຸນາເພີ່ມສິນຄ້າຢ່າງໜ້ອຍ 1 ລາຍການ')
    if (!form.supplier_id) return alert('ກະລຸນາເລືອກຜູ້ສະໜອງ')
    if (form.currency !== 'LAK' && exchangeRate <= 0) return alert('ກະລຸນາລະບຸອັດຕາແລກປ່ຽນໃຫ້ຖືກຕ້ອງ')
    if (totalAmountLAK <= 0) return alert('ຍອດລວມຂອງບິນຕ້ອງຫຼາຍກວ່າ 0')
    setLoading(true)
    const res = await fetch(`${API}/admin/purchases`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        total: totalAmountLAK,
        paid: paidAmountLAK,
        note: form.note,
        status: paymentStatus,
        currency: form.currency, payment_method: form.payment_method,
        invoice_file: invoiceFile, ref_number: form.ref_number || null,
        sml_doc_no: form.bill_number || null,
        sml_doc_date: pendingInvoice?.doc_date || null,
        payment_type: form.payment_type,
        due_date: form.payment_type === 'debt' ? (() => {
          const d = new Date(form.date || Date.now())
          d.setDate(d.getDate() + (selectedSupplier?.credit_days || 0))
          return d.toISOString().split('T')[0]
        })() : null,
        exchange_rate: exchangeRate,
        original_total: itemsTotal,
        discount_amount: discountAmount,
        subtotal: subtotal,
        items: validItems.map(i => {
          const netUnit = calcNetUnitPrice(i)
          return { product_id: Number(i.product_id), quantity: Number(i.quantity), cost_price: Math.round(netUnit * exchangeRate) }
        })
      })
    })
    setLoading(false)
    if (res.ok) {
      const data = await res.json()
      setPurchaseData(data)
      setShowSuccess(true)
      // If created from an approved Purchase Request, mark it converted + link
      if (pendingRequest?.id && data?.id) {
        try {
          await fetch(`${API}/admin/purchase-requests/${pendingRequest.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'mark_converted', purchase_id: data.id }),
          })
        } catch (e) { console.error('PR link failed:', e) }
      }
      setTimeout(async () => {
        try {
          await generateAndPrintPurchaseA4(data, form, items,
            selectedSupplier?.name || 'Unknown',
            subtotal, discountAmount, itemsTotal, form.currency)
        } catch (err) { console.error('Print failed:', err) }
        setTimeout(() => { navigate('/admin/purchases') }, 3000)
      }, 1500)
    } else {
      const err = await res.json()
      alert(err.error)
    }
  }

  const handleCancel = () => {
    const hasData = items.some(i => i.product_id || i.cost_price) || form.supplier_id || form.note || form.bill_number || invoiceFile
    if (hasData && !confirm('ຂໍ້ມູນທີ່ປ້ອນຈະຖືກລ້າງ, ຕ້ອງການຍົກເລີກບໍ?')) return
    navigate('/admin/purchases', { replace: true })
  }

  const inp = "w-full px-2 py-0 h-7 bg-white border border-slate-200 rounded text-[12px] leading-none focus:border-red-400 focus:ring-1 focus:ring-red-200 outline-none transition"
  const numInp = "w-full px-1.5 py-0 h-6 bg-white border border-slate-200 rounded text-[12px] leading-none focus:border-red-400 focus:ring-1 focus:ring-red-200 outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
  const lbl = "block text-[11px] font-medium text-slate-500 mb-1"
  const card = "bg-white rounded-lg border border-slate-200"

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 text-[13px]">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="w-full px-4 py-2.5 flex items-center gap-3">
          <button
            onClick={handleCancel}
            className="text-slate-500 hover:text-slate-800 transition flex items-center gap-1 text-[12px]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            ກັບຄືນ
          </button>
          <div className="h-4 w-px bg-slate-200"></div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
            <h1 className="font-semibold text-slate-800">ໃບສັ່ງຊື້ໃໝ່</h1>
            {form.ref_number && (
              <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{form.ref_number}</span>
            )}
            {pendingInvoice && (
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">SML</span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-md text-[12px] transition"
            >
              ຍົກເລີກ
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || validItems.length === 0 || !form.supplier_id}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-[12px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5"
            >
              {loading ? (
                <div className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin"></div>
              ) : '✓'}
              ຢືນຢັນບັນທຶກ
            </button>
          </div>
        </div>
      </div>

      <div className="w-full px-4 py-4 grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">

        {/* Left column */}
        <div className="space-y-3 min-w-0">

          {/* Top: Supplier & Document - compact 2-col */}
          <div className={`${card} p-3`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Supplier */}
              <div className="md:col-span-2">
                <label className={lbl}>ຜູ້ສະໜອງ <span className="text-red-500">*</span></label>
                <SearchSelect
                  compact
                  value={form.supplier_id}
                  onChange={val => setForm({ ...form, supplier_id: val })}
                  options={suppliers.map(s => ({ value: String(s.id), label: s.name }))}
                  placeholder="ເລືອກຜູ້ສະໜອງ..."
                />
                {selectedSupplier && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-slate-500">
                    {selectedSupplier.phone && <span>☎ {selectedSupplier.phone}</span>}
                    <span>⏳ ເຄຣດິດ {selectedSupplier.credit_days || 0} ວັນ</span>
                    {selectedSupplier.contact_person && <span>👤 {selectedSupplier.contact_person}</span>}
                  </div>
                )}
              </div>

              <div>
                <label className={lbl}>ວັນທີ</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={inp}/>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-slate-500">ເລກທີໃບສັ່ງຊື້</label>
                  <button type="button" onClick={() => { setEditFormat(poFormat); setShowFormatSettings(true) }} className="text-[10px] text-red-600 hover:underline">⚙ ຮູບແບບ</button>
                </div>
                <input type="text" value={form.ref_number} onChange={e => setForm({ ...form, ref_number: e.target.value })} className={`${inp} font-mono`}/>
              </div>
              <div>
                <label className={lbl}>ເລກບິນຈາກຜູ້ສະໜອງ</label>
                <input type="text" value={form.bill_number} onChange={e => setForm({ ...form, bill_number: e.target.value })} placeholder="optional" className={`${inp} font-mono`}/>
              </div>
                        {/* Invoice attachment (left) */}
          <div>
            <label className={lbl}>ແນບເອກະສານ Invoice</label>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFileUpload} className="hidden"/>
            {invoiceFile ? (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span className="text-[12px] text-slate-700 flex-1 truncate">{invoiceName}</span>
                <a href={`/uploads/${invoiceFile}`} target="_blank" rel="noreferrer" className="text-[11px] text-red-600 hover:underline">ເປີດ</a>
                <button onClick={() => { setInvoiceFile(null); setInvoiceName('') }} className="text-slate-400 hover:text-red-500">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-full py-2 border border-dashed border-slate-300 hover:border-red-400 hover:bg-red-50/30 rounded-md text-[11px] text-slate-500 hover:text-red-600 transition flex items-center justify-center gap-1.5">
                {uploading ? (
                  <><div className="w-3 h-3 border border-slate-300 border-t-red-500 rounded-full animate-spin"></div> ກຳລັງອັບໂຫຼດ...</>
                ) : (
                  <>📎 ແນບ PDF ຫຼື ຮູບພາບ</>
                )}
              </button>
            )}
          </div>
              <div>
                <label className={lbl}>ໝາຍເຫດ</label>
                <input type="text" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="ບັນທຶກເພີ່ມເຕີມ..." className={inp}/>
              </div>
            </div>
          </div>

          {/* Currency */}
          <div className={`${card} p-2`}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500 mr-1">ສະກຸນ:</span>
              {currencies.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    const oldRate = exchangeRate
                    const newRate = c.rate
                    setForm({ ...form, currency: c.value })
                    setExchangeRate(newRate)
                    setItems(prev => prev.map(item => {
                      const price = Number(item.cost_price) || 0
                      if (price <= 0) return item
                      const lakPrice = price * oldRate
                      const newPrice = newRate > 0 ? Math.round(lakPrice / newRate) : lakPrice
                      return { ...item, cost_price: newPrice }
                    }))
                  }}
                  className={`px-2 py-0 h-6 rounded text-[11px] font-medium leading-none transition ${
                    form.currency === c.value
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {c.symbol} {c.label}
                </button>
              ))}
              {form.currency !== 'LAK' && (
                <div className="flex items-center gap-1 ml-auto bg-slate-50 px-2 h-6 rounded border border-slate-200">
                  <span className="text-[11px] text-slate-500">1 {cur?.symbol} =</span>
                  <input
                    type="number" min="0" step="0.01" value={exchangeRate}
                    onChange={e => setExchangeRate(Number(e.target.value) || 0)}
                    className="w-20 px-1 py-0 h-5 bg-white border border-slate-200 rounded text-[11px] leading-none text-right font-mono focus:border-red-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-[11px] text-slate-500">₭</span>
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          <div className={`${card} overflow-hidden`}>
            <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700 text-[13px]">ລາຍການສິນຄ້າ</span>
                <span className="text-[11px] text-slate-500 font-mono">{validItems.length}/{items.length}</span>
              </div>
              <button onClick={addItem} className="text-[12px] text-red-600 hover:text-red-800 font-semibold flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                ເພີ່ມ
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[13px]" style={{ minWidth: 920 }}>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/30 text-[13px]">
                    <th className="text-left py-2 px-2 font-medium text-slate-500 w-8">#</th>
                    <th className="text-left py-2 px-2 font-medium text-slate-500 w-28">ລະຫັດ</th>
                    <th className="text-left py-2 px-2 font-medium text-slate-500">ສິນຄ້າ</th>
                    <th className="text-center py-2 px-2 font-medium text-slate-500 w-24">ຈຳນວນ</th>
                    <th className="text-left py-2 px-2 font-medium text-slate-500 w-14">ໜ່ວຍ</th>
                    <th className="text-right py-2 px-2 font-medium text-slate-500" style={{ minWidth: 100, width: 100 }}>ລາຄາ</th>
                    <th className="text-center py-2 px-2 font-medium text-slate-500 w-32">ສ່ວນຫຼຸດ</th>
                    <th className="text-right py-2 px-2 font-medium text-slate-500 w-28 whitespace-nowrap">ລວມ</th>
                    {form.currency !== 'LAK' && (
                      <th className="text-right py-2 px-2 font-medium text-emerald-600 w-28 whitespace-nowrap">ລວມ ₭</th>
                    )}
                    <th className="w-7"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const prod = products.find(p => p.id === Number(item.product_id))
                    const lineNet = calcLineTotal(item)
                    return (
                      <tr key={idx} className="group border-b border-slate-100 hover:bg-slate-50/50 text-[13px] align-middle">
                        <td className="py-0 px-2 text-slate-400 font-mono">{String(idx + 1).padStart(2, '0')}</td>
                        <td className="py-0 px-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => { setProductPicker({ rowIdx: idx }); setPickerSearch('') }}
                            className={`h-6 px-2 rounded border text-[11px] font-mono leading-none transition ${prod?.product_code ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100' : 'bg-white border-dashed border-slate-300 text-slate-400 hover:border-red-400 hover:text-red-500'}`}
                          >
                            {prod?.product_code || '+ ເລືອກ'}
                          </button>
                        </td>
                        <td className="py-0 px-2">
                          <div className="flex items-center gap-2">
                            <span className="flex-1 min-w-0 truncate text-slate-700">{prod?.product_name || <span className="text-slate-300 italic">ຍັງບໍ່ເລືອກ</span>}</span>
                            {prod && lastPrices[Number(item.product_id)] && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100 text-[10px]">ລ່າ.{formatAmount(lastPrices[Number(item.product_id)].last_cost_original, lastPrices[Number(item.product_id)].currency)}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-0 px-2">
                          <input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)}
                            className={`${numInp} text-center font-mono`}/>
                        </td>
                        <td className="py-0 px-2 text-slate-500">{item.unit || prod?.unit || '—'}</td>
                        <td className="py-0 px-2" style={{ minWidth: 100, width: 100 }}>
                          <input type="number" size="1" min="0" step="0.01" value={item.cost_price} onChange={e => updateItem(idx, 'cost_price', e.target.value)}
                            className={`${numInp} text-right font-mono`} style={{ minWidth: 0, width: '100%' }}/>
                        </td>
                        <td className="py-0 px-2">
                          <div className="flex items-center justify-center gap-1">
                            <div className="flex border border-slate-200 rounded overflow-hidden text-[12px]">
                              {[{ k: 'none', l: '—' }, { k: 'percent', l: '%' }, { k: 'fixed', l: cur?.symbol || '₭' }].map(t => (
                                <button key={t.k} type="button" onClick={() => updateItem(idx, 'disc_type', t.k)}
                                  className={`px-2 py-0.5 font-semibold transition ${item.disc_type === t.k ? 'bg-red-600 text-white' : 'text-slate-400 hover:bg-slate-100'}`}>
                                  {t.l}
                                </button>
                              ))}
                            </div>
                            {item.disc_type !== 'none' && (
                              <input type="number" min="0" value={item.disc_value} onChange={e => updateItem(idx, 'disc_value', e.target.value)}
                                className="w-14 px-1.5 py-0 h-6 bg-white border border-slate-200 rounded text-[12px] leading-none text-right font-mono focus:border-red-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"/>
                            )}
                          </div>
                        </td>
                        <td className="py-0 px-2 text-right font-semibold text-slate-800 whitespace-nowrap font-mono">
                          {lineNet > 0 ? formatAmount(lineNet, form.currency) : '—'}
                        </td>
                        {form.currency !== 'LAK' && (
                          <td className="py-0 px-2 text-right font-semibold text-emerald-600 whitespace-nowrap font-mono">
                            {lineNet > 0 ? `${new Intl.NumberFormat('lo-LA').format(Math.round(lineNet * exchangeRate))} ₭` : '—'}
                          </td>
                        )}
                        <td className="py-2 px-1">
                          <button onClick={() => removeItem(idx)} disabled={items.length <= 1}
                            className="w-5 h-5 text-slate-300 hover:text-red-500 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 disabled:opacity-0 transition">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>


        </div>

        {/* Right sidebar: Payment + Summary */}
        <aside className="lg:sticky lg:top-[52px] lg:self-start space-y-3">

          {/* Payment type card */}
          <div className={`${card} p-2`}>
            <label className={lbl}>ປະເພດການຊຳລະ</label>
            <div className="flex gap-1.5 mb-2">
              <button type="button" onClick={() => setForm({ ...form, payment_type: 'cash', paid: '' })}
                className={`flex-1 py-1 h-7 rounded text-[12px] font-semibold border leading-none transition ${form.payment_type === 'cash' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                💵 ຊຳລະສົດ
              </button>
              <button type="button" onClick={() => setForm({ ...form, payment_type: 'debt', paid: '0', payment_method: 'cash' })}
                className={`flex-1 py-1 h-7 rounded text-[12px] font-semibold border leading-none transition ${form.payment_type === 'debt' ? 'bg-amber-50 border-amber-500 text-amber-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                📋 ຕິດໜີ້
              </button>
            </div>

            {form.payment_type === 'cash' && (
              <>
                <label className={lbl}>ວິທີຊຳລະ</label>
                <div className="flex gap-1">
                  {paymentMethods.map(m => (
                    <button key={m.value} type="button" onClick={() => setForm({ ...form, payment_method: m.value })}
                      className={`flex-1 py-0.5 h-6 rounded text-[11px] font-medium border leading-none transition ${form.payment_method === m.value ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                      {m.icon} {m.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {form.payment_type === 'debt' && (() => {
              const creditDays = selectedSupplier?.credit_days || 0
              const due = new Date(form.date || Date.now())
              due.setDate(due.getDate() + creditDays)
              const daysLeft = Math.ceil((due - new Date()) / (1000 * 60 * 60 * 24))
              return (
                <div className="bg-slate-50 rounded-md px-3 py-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-slate-600">ຄົບກຳນົດ: <strong>{due.toLocaleDateString('lo-LA')}</strong></span>
                  <span className={`font-bold ${daysLeft <= 0 ? 'text-red-500' : daysLeft <= 7 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {daysLeft <= 0 ? '⚠ ເກີນ' : `${daysLeft}ວ`}
                  </span>
                </div>
              )
            })()}
          </div>

          {/* Summary card */}
          <div className={`${card} overflow-hidden`}>
            <div className="bg-slate-800 text-white px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">ສະຫຼຸບ</div>
              <div className="text-[11px] text-slate-300 font-mono mt-0.5">{form.ref_number || '—'}</div>
            </div>

            <div className="p-3 space-y-2">
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-500">ຜູ້ສະໜອງ</span>
                <span className="font-medium truncate max-w-[60%]">{selectedSupplier?.name || '—'}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-500">ລາຍການ</span>
                <span className="font-mono">{validItems.length} ສິນຄ້າ</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-500">ລວມກ່ອນຫຼຸດ</span>
                <span className="font-mono">{formatAmount(subtotal, form.currency)}</span>
              </div>

              {/* Discount row */}
              <div className="flex justify-between items-center text-[12px] gap-2">
                <span className="text-slate-500">ສ່ວນຫຼຸດບິນ</span>
                <div className="flex items-center gap-1">
                  <div className="flex border border-slate-200 rounded overflow-hidden text-[10px]">
                    {[{ key: 'none', label: '—' }, { key: 'percent', label: '%' }, { key: 'fixed', label: cur?.symbol || '₭' }].map(t => (
                      <button key={t.key} type="button" onClick={() => setDiscount({ type: t.key, value: '' })}
                        className={`px-1.5 py-0.5 font-semibold transition ${discount.type === t.key ? 'bg-orange-500 text-white' : 'text-slate-400 hover:bg-slate-100'}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {discount.type !== 'none' && (
                    <input type="number" min="0" value={discount.value} onChange={e => setDiscount({ ...discount, value: e.target.value })}
                      className="w-12 px-1 py-0.5 bg-white border border-slate-200 rounded text-[11px] text-right font-mono focus:border-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"/>
                  )}
                </div>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">ຍອດຫຼຸດ</span>
                  <span className="font-mono text-orange-500">−{formatAmount(discountAmount, form.currency)}</span>
                </div>
              )}

              <div className="pt-2 mt-1 border-t border-slate-200">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">ລວມສຸດທ້າຍ</span>
                </div>
                <div className="font-bold text-xl text-red-600 font-mono mt-0.5">
                  {formatAmount(itemsTotal, form.currency)}
                </div>
                {form.currency !== 'LAK' && (
                  <div className="text-[11px] text-emerald-600 font-mono font-semibold">
                    ≈ {new Intl.NumberFormat('lo-LA').format(totalAmountLAK)} ₭
                  </div>
                )}
              </div>

              <div className="pt-2 mt-1 border-t border-slate-200 space-y-1.5">
                <div className="flex justify-between text-[12px]">
                  <span className="text-slate-500">ສະຖານະ</span>
                  <span className={`font-semibold ${paymentStatus === 'paid' ? 'text-emerald-600' : paymentStatus === 'partial' ? 'text-red-600' : 'text-amber-600'}`}>
                    {paymentStatus === 'paid' ? 'ຊຳລະແລ້ວ' : paymentStatus === 'partial' ? 'ຊຳລະບາງສ່ວນ' : 'ຍັງບໍ່ຊຳລະ'}
                  </span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-slate-500">ຍອດຊຳລະ</span>
                  <span className="font-mono font-semibold text-emerald-700">{formatAmount(paidAmountOriginal, form.currency)}</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-slate-500">ຍອດຄ້າງ</span>
                  <span className="font-mono font-semibold text-amber-700">{formatAmount(remainingAmountOriginal, form.currency)}</span>
                </div>
                {form.currency !== 'LAK' && (
                  <>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">ຊຳລະ (₭)</span>
                      <span className="font-mono text-emerald-600">{new Intl.NumberFormat('lo-LA').format(paidAmountLAK)} ₭</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">ຄ້າງ (₭)</span>
                      <span className="font-mono text-amber-600">{new Intl.NumberFormat('lo-LA').format(remainingAmountLAK)} ₭</span>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={handleConfirm}
                disabled={loading || validItems.length === 0 || !form.supplier_id}
                className="w-full mt-2 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-[12px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <div className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin"></div>
                ) : '✓'}
                ຢືນຢັນບັນທຶກ
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Product picker modal */}
      {productPicker && (() => {
        const q = pickerSearch.toLowerCase().trim()
        const list = products.filter(p => !q ||
          String(p.product_code || '').toLowerCase().includes(q) ||
          String(p.product_name || '').toLowerCase().includes(q)
        )
        const close = () => { setProductPicker(null); setPickerSearch('') }
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in" onClick={close}>
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-md"></div>
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-pop-in" onClick={e => e.stopPropagation()}>
              <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-red-50 to-red-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📦</span>
                  <div>
                    <h3 className="font-bold text-slate-800 text-[14px]">ເລືອກສິນຄ້າ</h3>
                    <p className="text-[11px] text-slate-500">ລາຍການ #{productPicker.rowIdx + 1}</p>
                  </div>
                </div>
                <button onClick={close} className="w-7 h-7 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="p-3 border-b border-slate-200">
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  <input
                    autoFocus
                    type="text"
                    value={pickerSearch}
                    onChange={e => setPickerSearch(e.target.value)}
                    placeholder="ຄົ້ນຫາລະຫັດ ຫຼື ຊື່ສິນຄ້າ..."
                    className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-[13px] focus:border-red-400 focus:ring-1 focus:ring-red-200 outline-none"
                  />
                </div>
                <div className="text-[10px] text-slate-400 mt-1">{list.length} / {products.length} ລາຍການ</div>
              </div>
              <div className="overflow-y-auto flex-1">
                {list.length === 0 ? (
                  <div className="text-center py-8 text-[12px] text-slate-400">ບໍ່ພົບສິນຄ້າ</div>
                ) : (
                  <table className="w-full text-[12px]">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr className="text-slate-500 border-b border-slate-200">
                        <th className="text-left py-1.5 px-3 font-medium w-24">ລະຫັດ</th>
                        <th className="text-left py-1.5 px-3 font-medium">ຊື່ສິນຄ້າ</th>
                        <th className="text-left py-1.5 px-3 font-medium w-16">ໜ່ວຍ</th>
                        <th className="text-right py-1.5 px-3 font-medium w-16">ສະຕ໊ອກ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {list.map(p => (
                        <tr key={p.id} onClick={() => { selectProduct(productPicker.rowIdx, p.id); close() }}
                          className="cursor-pointer hover:bg-red-50/50 transition">
                          <td className="py-1.5 px-3 font-mono text-red-600">
                            <span className="bg-red-50 border border-red-100 px-1.5 py-0.5 rounded">{p.product_code || '—'}</span>
                          </td>
                          <td className="py-1.5 px-3 text-slate-700">{p.product_name}</td>
                          <td className="py-1.5 px-3 text-slate-500">{p.unit || '—'}</td>
                          <td className={`py-1.5 px-3 text-right font-mono font-semibold ${p.qty_on_hand <= 0 ? 'text-red-500' : 'text-slate-700'}`}>{p.qty_on_hand}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Success modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"></div>
          <div className="relative bg-white rounded-lg shadow-xl w-80 p-6 text-center">
            <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-white">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h3 className="font-bold text-slate-800 mb-1">ສຳເລັດ</h3>
            <p className="text-[12px] text-slate-500 mb-3">ກຳລັງສົ່ງໄປພິມ...</p>
            <div className="flex justify-center gap-1">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Format settings modal */}
      {showFormatSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowFormatSettings(false)}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"></div>
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-semibold text-slate-800 text-[13px]">ຮູບແບບເລກທີ</h3>
              <button onClick={() => setShowFormatSettings(false)} className="text-slate-400 hover:text-slate-700">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className={lbl}>Pattern</label>
                <input type="text" value={editFormat} onChange={e => setEditFormat(e.target.value)}
                  className={`${inp} font-mono`}/>
              </div>
              <div>
                <label className={lbl}>ຕົວແປ</label>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { tag: '{YYYY}', desc: 'ປີ 4' },
                    { tag: '{YY}', desc: 'ປີ 2' },
                    { tag: '{MM}', desc: 'ເດືອນ' },
                    { tag: '{DD}', desc: 'ວັນ' },
                    { tag: '{NNNN}', desc: 'ລຳ 4' },
                    { tag: '{NNN}', desc: 'ລຳ 3' },
                    { tag: '{NN}', desc: 'ລຳ 2' },
                  ].map(v => (
                    <button key={v.tag} type="button" onClick={() => setEditFormat(f => f + v.tag)}
                      className="flex items-center justify-between px-2 py-1 bg-slate-50 border border-slate-200 rounded hover:border-red-400 transition text-[11px]">
                      <code className="text-red-600 font-mono font-bold">{v.tag}</code>
                      <span className="text-slate-400">{v.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-slate-50 rounded-md p-2">
                <div className="text-[10px] text-slate-400 mb-0.5">ຕົວຢ່າງ</div>
                <div className="font-mono text-[13px] font-bold text-slate-800">
                  {editFormat.replace('{YYYY}', '2026').replace('{YY}', '26').replace('{MM}', '04').replace('{DD}', '17').replace('{NNNN}', '0001').replace('{NNN}', '001').replace('{NN}', '01')}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowFormatSettings(false)}
                  className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-[12px] font-semibold text-slate-700 transition">
                  ຍົກເລີກ
                </button>
                <button onClick={async () => {
                  await fetch(`${API}/admin/settings/po-format`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format: editFormat }) })
                  setPoFormat(editFormat)
                  setShowFormatSettings(false)
                  const res = await fetch(`${API}/admin/purchases/next-number`)
                  const data = await res.json()
                  setForm(f => ({ ...f, ref_number: data.number }))
                }} className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-[12px] font-semibold transition">
                  ບັນທຶກ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in-overlay { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pop-in { from { opacity: 0; transform: scale(0.95) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-fade-in { animation: fade-in-overlay 0.18s ease-out; }
        .animate-pop-in { animation: pop-in 0.22s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  )
}
