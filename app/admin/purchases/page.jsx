'use client';

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { generateAndPrintPurchaseA4, generateAndPrintPaymentReceipt } from '@/utils/receiptPdfGenerator'

const API = '/api'

function formatPrice(p) {
  return new Intl.NumberFormat('lo-LA').format(p) + ' ₭'
}

const curSymbol = { LAK: '₭', THB: '฿', USD: '$', CNY: '¥', VND: '₫' }

function pickNum(obj, keys) {
  if (!obj) return 0
  for (const k of keys) {
    const v = Number(obj[k])
    if (!isNaN(v) && v !== 0) return v
  }
  return 0
}
const getItemPrice = (it) => pickNum(it, ['price', 'unit_price', 'item_price', 'price_2'])
const getItemDiscount = (it) => pickNum(it, ['sum_discount', 'discount_amount', 'discount_amt', 'line_discount'])
const getItemLineTotal = (it) => {
  const d = pickNum(it, ['sum_amount', 'net_amount', 'amount', 'total_amount'])
  if (d) return d
  return getItemPrice(it) * (pickNum(it, ['qty', 'quantity']) || 0) - getItemDiscount(it)
}
const getHeaderTotal = (h, items) => pickNum(h, ['total_amount', 'net_amount', 'grand_total', 'sum_amount']) || (items || []).reduce((s, it) => s + getItemLineTotal(it), 0)
const getHeaderDiscount = (h, items) => pickNum(h, ['sum_discount', 'discount_amount', 'total_discount']) || (items || []).reduce((s, it) => s + getItemDiscount(it), 0)

const statusMap = {
  pending: { label: 'ຍັງບໍ່ຊຳລະ', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  partial: { label: 'ບາງສ່ວນ', cls: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  paid: { label: 'ຊຳລະແລ້ວ', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
}

function effectiveTotal(p) {
  if (!p) return 0
  const t = parseFloat(p.total) || 0
  if (t > 0) return t
  const ot = parseFloat(p.original_total) || 0
  const r = parseFloat(p.exchange_rate) || 1
  return ot * r
}

function effectivePaid(p) {
  if (!p) return 0
  const paid = parseFloat(p.paid) || 0
  if (paid > 0) return paid
  if (p.payment_type === 'cash') return effectiveTotal(p)
  return 0
}

function effectiveStatus(p) {
  if (!p) return 'pending'
  if (p.payment_type === 'cash') return 'paid'
  const total = effectiveTotal(p)
  const paid = effectivePaid(p)
  if (paid >= total && total > 0) return 'paid'
  if (paid > 0) return 'partial'
  return p.status || 'pending'
}

function formatCountdown(dueDate) {
  if (!dueDate) return null
  const diff = new Date(dueDate).getTime() + 86400000 - Date.now()
  if (diff <= 0) return { expired: true, days: Math.ceil(Math.abs(diff) / 86400000) }
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return { expired: false, days: d, text: `${d}ວ ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` }
}

const fmtBill = (p) => {
  const isForeign = p.currency && p.currency !== 'LAK'
  const rate = parseFloat(p.exchange_rate) || 1
  const sym = curSymbol[p.currency] || '₭'
  const totalLAK = effectiveTotal(p)
  const paidLAK = effectivePaid(p)
  return {
    isForeign, rate, sym,
    total: isForeign ? `${new Intl.NumberFormat('lo-LA').format(Math.round(totalLAK / rate))} ${sym}` : formatPrice(totalLAK),
    totalLAK: formatPrice(totalLAK),
    totalLAKNum: totalLAK,
    paidLAKNum: paidLAK,
    remaining: totalLAK - paidLAK,
  }
}

function PurchaseRow({ purchase: p, handlePrint, handleDelete, setViewDetail, openPay }) {
  const effStatus = effectiveStatus(p)
  const st = statusMap[effStatus] || statusMap.pending
  const remaining = effectiveTotal(p) - effectivePaid(p)
  const isDebt = p.payment_type === 'debt'
  const f = fmtBill(p)

  return (
    <tr
      className="group border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer"
      onClick={() => setViewDetail(p)}
    >
        <td className="py-2 px-3 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono font-bold text-indigo-600">#{p.id}</span>
            {p.ref_number && <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1 rounded">{p.ref_number}</span>}
            {p.sml_doc_no && <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1 rounded">SML {p.sml_doc_no}</span>}
          </div>
        </td>
        <td className="py-2 px-3 text-[11px] text-slate-500 font-mono whitespace-nowrap">
          {(() => {
            const d = new Date(p.created_at)
            const dd = String(d.getDate()).padStart(2, '0')
            const mm = String(d.getMonth() + 1).padStart(2, '0')
            const yyyy = d.getFullYear()
            const HH = String(d.getHours()).padStart(2, '0')
            const MM = String(d.getMinutes()).padStart(2, '0')
            return `${dd}-${mm}-${yyyy} ${HH}:${MM}`
          })()}
        </td>
        <td className="py-2 px-3 text-[12px] font-medium text-slate-700 whitespace-nowrap">{p.supplier_name || '—'}</td>
        <td className="py-2 px-3 whitespace-nowrap">
          {isDebt ? (
            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold border bg-amber-50 text-amber-700 border-amber-200">
              📋 ຕິດໜີ້
            </span>
          ) : (
            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
              {p.payment_method === 'transfer' ? '🏦 ໂອນ' : p.payment_method === 'cheque' ? '📝 ເຊັກ' : '💵 ສົດ'}
            </span>
          )}
        </td>
        <td className="py-2 px-3 whitespace-nowrap">
          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${st.cls}`}>
            {st.label}
          </span>
        </td>
        <td className="py-2 px-3 whitespace-nowrap">
          {isDebt && effStatus !== 'paid' && p.due_date ? (() => {
            const cd = formatCountdown(p.due_date)
            return (
              <div className="text-[11px] leading-tight">
                <div className="text-slate-500">{new Date(p.due_date).toLocaleDateString('lo-LA')}</div>
                {cd && (
                  <div className={`font-mono font-semibold ${cd.expired ? 'text-red-600' : cd.days <= 3 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {cd.expired ? `⚠ ເກີນ ${cd.days}ວ` : cd.text}
                  </div>
                )}
              </div>
            )
          })() : <span className="text-[11px] text-slate-300">—</span>}
        </td>
        <td className="py-2 px-3 text-center">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${f.isForeign ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'bg-slate-100 text-slate-500'}`}>
            {p.currency || 'LAK'}
          </span>
        </td>
        <td className="py-2 px-3 text-right">
          <div className="font-bold text-slate-800 font-mono whitespace-nowrap">{f.total}</div>
        </td>
        <td className="py-2 px-3 text-right">
          <div className="font-semibold text-emerald-600 font-mono whitespace-nowrap text-[11px]">{f.totalLAK}</div>
        </td>
        <td className="py-2 px-3 text-right">
          {remaining > 0 ? (
            <div className="font-semibold text-red-500 font-mono whitespace-nowrap text-[11px]">
              {f.isForeign ? `${new Intl.NumberFormat('lo-LA').format(Math.round(remaining / f.rate))} ${f.sym}` : formatPrice(remaining)}
            </div>
          ) : <span className="text-[11px] text-slate-300">—</span>}
        </td>
        <td className="py-2 px-2 text-right" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-0.5">
            <button onClick={() => handlePrint(p)} className="w-7 h-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition" title="ພິມ">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
              </svg>
            </button>
            {isDebt && effStatus !== 'paid' && (
              <button onClick={() => openPay(p)} className="w-7 h-7 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition" title="ຊຳລະ">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto">
                  <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M12 8v8M8 12h8"/>
                </svg>
              </button>
            )}
            <button onClick={() => handleDelete(p.id)} className="w-7 h-7 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition" title="ລຶບ">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              </svg>
            </button>
          </div>
        </td>
    </tr>
  )
}

export default function Purchases() {
  const router = useRouter()
  const navigate = (path, opts = {}) => {
    if (opts.state) sessionStorage.setItem('navState', JSON.stringify(opts.state))
    else sessionStorage.removeItem('navState')
    router.push(path)
  }
  const [purchases, setPurchases] = useState([])
  const [viewDetail, setViewDetail] = useState(null)
  const [detailPayments, setDetailPayments] = useState([])

  useEffect(() => {
    if (viewDetail?.id) {
      fetch(`${API}/admin/debts/${viewDetail.id}/payments`)
        .then(r => r.ok ? r.json() : [])
        .then(setDetailPayments)
        .catch(() => setDetailPayments([]))
    } else {
      setDetailPayments([])
    }
  }, [viewDetail?.id])
  const [showPendingModal, setShowPendingModal] = useState(false)
  const [expandedPendingId, setExpandedPendingId] = useState(null)
  const [confirmState, setConfirmState] = useState(null) // { title, message, variant, onConfirm }
  const [busyMessage, setBusyMessage] = useState(null)
  const [, setTick] = useState(0)

  const confirmDialog = (opts) => new Promise(resolve => {
    setConfirmState({
      title: opts.title || 'ຢືນຢັນ',
      message: opts.message || '',
      confirmLabel: opts.confirmLabel || 'ຢືນຢັນ',
      cancelLabel: opts.cancelLabel || 'ຍົກເລີກ',
      variant: opts.variant || 'danger',
      onDone: (ok) => { setConfirmState(null); resolve(ok) }
    })
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('')
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [sortBy, setSortBy] = useState('date_desc')
  const [showPay, setShowPay] = useState(null)
  const [payments, setPayments] = useState([])
  const [payForm, setPayForm] = useState({
    payment_number: '', payment_date: '', bill_number: '',
    amount: '', currency: 'LAK', exchange_rate: '1',
    payment_method: 'transfer', note: '', attachment: null
  })
  const [uploading, setUploading] = useState(false)
  const [pendingInvoices, setPendingInvoices] = useState([])
  const [newPendingCount, setNewPendingCount] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  const load = () => {
    fetch(`${API}/admin/purchases`).then(r => r.json()).then(setPurchases)
    fetch(`${API}/admin/purchases/pending-invoices`).then(r => r.json()).then(setPendingInvoices)
  }

  const autoSyncInvoices = async () => {
    try {
      const res = await fetch(`${API}/admin/purchases/sync-invoices`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      if (res.ok) {
        const data = await res.json()
        setNewPendingCount(data.inserted_count || 0)
      }
    } catch {}
    try {
      const pendingRes = await fetch(`${API}/admin/purchases/pending-invoices`)
      if (pendingRes.ok) setPendingInvoices(await pendingRes.json())
    } catch {}
  }

  useEffect(() => { load(); autoSyncInvoices() }, [])

  const withMinLoading = async (message, fn, preDelayMs = 3000) => {
    setBusyMessage(message)
    await new Promise(r => setTimeout(r, preDelayMs))
    try {
      await fn()
    } finally {
      setBusyMessage(null)
    }
  }

  const dismissPending = async (id) => {
    const ok = await confirmDialog({
      title: 'ລຶບບິນ Pending',
      message: 'ຕ້ອງການລຶບບິນ pending ນີ້ອອກຈາກລາຍການບໍ?',
      confirmLabel: 'ລຶບ', variant: 'danger'
    })
    if (!ok) return
    await withMinLoading('ກຳລັງລຶບບິນ pending...', async () => {
      await fetch(`${API}/admin/purchases/pending-invoices/${id}`, { method: 'DELETE' })
      load()
    })
  }

  const handleDelete = async (id) => {
    const ok = await confirmDialog({
      title: `ລຶບໃບສັ່ງຊື້ #${id}`,
      message: 'ສະຕ໊ອກຈະຖືກຫັກຄືນ ແລະ ບິນ pending ຈະກັບມາລໍຖ້າອີກ. ແນ່ໃຈບໍ?',
      confirmLabel: 'ລຶບ', variant: 'danger'
    })
    if (!ok) return
    await withMinLoading('ກຳລັງລຶບໃບສັ່ງຊື້...', async () => {
      const res = await fetch(`${API}/admin/purchases/${id}`, { method: 'DELETE' })
      if (res.ok) {
        load()
        if (viewDetail?.id === id) setViewDetail(null)
      } else {
        const err = await res.json()
        alert(err.error)
      }
    })
  }

  const openPay = async (purchase) => {
    setShowPay(purchase)
    const [numRes, payRes] = await Promise.all([
      fetch(`${API}/admin/payments/next-number`),
      fetch(`${API}/admin/debts/${purchase.id}/payments`)
    ])
    const { number } = await numRes.json()
    setPayments(await payRes.json())
    const remainingLAK = parseFloat(purchase.total) - parseFloat(purchase.paid)
    const billCurrency = purchase.currency || 'LAK'
    const billRate = parseFloat(purchase.exchange_rate) || 1
    const remainingOriginal = billCurrency !== 'LAK' ? Math.round(remainingLAK / billRate) : remainingLAK
    setPayForm({
      payment_number: number,
      payment_date: new Date().toISOString().split('T')[0],
      bill_number: purchase.ref_number || '',
      amount: String(remainingOriginal),
      currency: billCurrency,
      exchange_rate: billCurrency !== 'LAK' ? String(billRate) : '1',
      payment_method: 'transfer', note: '', attachment: null
    })
  }

  const handleUploadAttachment = async (file) => {
    if (!file) return null
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${API}/admin/uploads/invoice`, { method: 'POST', body: fd })
      return (await res.json()).path
    } finally { setUploading(false) }
  }

  const handleDeletePayment = async (paymentId) => {
    const ok = await confirmDialog({
      title: 'ລຶບລາຍການຊຳລະ',
      message: 'ຕ້ອງການລຶບລາຍການຊຳລະນີ້ບໍ? ຍອດຈະຖືກຫັກຄືນອອກຈາກໃບສັ່ງຊື້.',
      confirmLabel: 'ລຶບ', variant: 'danger'
    })
    if (!ok) return
    await withMinLoading('ກຳລັງລຶບລາຍການຊຳລະ...', async () => {
      const res = await fetch(`${API}/admin/debts/payments/${paymentId}`, { method: 'DELETE' })
      if (res.ok) {
        load()
        const pRes = await fetch(`${API}/admin/debts/${showPay.id}/payments`)
        setPayments(await pRes.json())
        const purchaseRes = await fetch(`${API}/admin/purchases`)
        const all = await purchaseRes.json()
        const updated = all.find(p => p.id === showPay.id)
        if (updated) setShowPay(updated)
      } else {
        const err = await res.json()
        alert(err.error)
      }
    })
  }

  const handlePay = async (e) => {
    e.preventDefault()
    let attachmentPath = null
    if (payForm.attachment) attachmentPath = await handleUploadAttachment(payForm.attachment)
    const res = await fetch(`${API}/admin/debts/${showPay.id}/payments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Number(payForm.amount), note: payForm.note,
        payment_number: payForm.payment_number, payment_date: payForm.payment_date,
        bill_number: payForm.bill_number, currency: payForm.currency,
        exchange_rate: Number(payForm.exchange_rate),
        payment_method: payForm.payment_method, attachment: attachmentPath
      })
    })
    if (res.ok) {
      const paymentData = await res.json()
      const purchaseForReceipt = {
        ...showPay,
        paid: Number(showPay.paid) + Number(paymentData.amount || 0),
      }
      generateAndPrintPaymentReceipt({
        ...paymentData,
        payment_number: payForm.payment_number,
        payment_date: payForm.payment_date,
        currency: payForm.currency,
        exchange_rate: Number(payForm.exchange_rate),
        payment_method: payForm.payment_method,
        note: payForm.note,
      }, purchaseForReceipt)
      load()
      setShowPay(null)
    } else { const err = await res.json(); alert(err.error) }
  }

  const handlePrint = async (purchase) => {
    try {
      await generateAndPrintPurchaseA4(
        purchase,
        {
          ref_number: purchase.ref_number,
          date: purchase.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          currency: purchase.currency || 'LAK',
          payment_type: purchase.payment_type,
          payment_method: purchase.payment_method || 'cash',
          note: purchase.note || ''
        },
        purchase.items,
        purchase.supplier_name || 'Unknown',
        parseFloat(purchase.subtotal || purchase.total),
        parseFloat(purchase.discount_amount || 0),
        parseFloat(purchase.total),
        purchase.currency || 'LAK'
      )
    } catch (err) { alert('ບໍ່ສາມາດພິມໄດ້: ' + err.message) }
  }

  const filteredPurchases = purchases
    .filter(p => {
      const m = p.id.toString().includes(searchTerm) || (p.ref_number && p.ref_number.toLowerCase().includes(searchTerm.toLowerCase())) || (p.supplier_name && p.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()))
      const ms = statusFilter === '' || effectiveStatus(p) === statusFilter
      const mp = paymentTypeFilter === '' || p.payment_type === paymentTypeFilter
      let md = true
      if (dateRange.from) md = new Date(p.created_at).setHours(0,0,0,0) >= new Date(dateRange.from).setHours(0,0,0,0)
      if (dateRange.to && md) md = new Date(p.created_at).setHours(0,0,0,0) <= new Date(dateRange.to).setHours(0,0,0,0)
      return m && ms && mp && md
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date_desc': return new Date(b.created_at) - new Date(a.created_at)
        case 'date_asc': return new Date(a.created_at) - new Date(b.created_at)
        case 'total_desc': return parseFloat(b.total) - parseFloat(a.total)
        case 'total_asc': return parseFloat(a.total) - parseFloat(b.total)
        default: return 0
      }
    })

  const totalAll = purchases.reduce((s, p) => s + effectiveTotal(p), 0)
  const totalPaid = purchases.reduce((s, p) => s + effectivePaid(p), 0)
  const totalRemaining = totalAll - totalPaid
  const debtCount = purchases.filter(p => p.payment_type === 'debt' && effectiveStatus(p) !== 'paid').length
  const overdueCount = purchases.filter(p => p.payment_type === 'debt' && effectiveStatus(p) !== 'paid' && p.due_date && new Date(p.due_date).getTime() + 86400000 < Date.now()).length
  const paidCount = purchases.filter(p => effectiveStatus(p) === 'paid').length
  const todayCount = purchases.filter(p => new Date(p.created_at).toDateString() === new Date().toDateString()).length
  const fmtCompact = n => {
    const num = Number(n) || 0
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B'
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M'
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
    return String(num)
  }

  const kpis = [
    { l: 'ໃບສັ່ງຊື້', v: new Intl.NumberFormat('lo-LA').format(purchases.length), sub: `ມື້ນີ້ ${todayCount} · ຊຳລະແລ້ວ ${paidCount}`, color: 'blue' },
    { l: 'ຍອດຊື້ລວມ', v: fmtCompact(totalAll), sub: 'ທຸກຊ່ວງເວລາ', color: 'slate' },
    { l: 'ຊຳລະແລ້ວ', v: fmtCompact(totalPaid), sub: `${totalAll > 0 ? Math.round(totalPaid / totalAll * 100) : 0}% ຂອງລວມ`, color: 'emerald' },
    { l: 'ຍັງຄ້າງ', v: fmtCompact(totalRemaining), sub: totalRemaining > 0 ? `${totalAll > 0 ? Math.round(totalRemaining / totalAll * 100) : 0}% ຄ້າງ` : 'ຄົບທຸກບິນ', color: totalRemaining > 0 ? 'rose' : 'slate' },
    { l: 'ຕິດໜີ້', v: new Intl.NumberFormat('lo-LA').format(debtCount), sub: overdueCount > 0 ? `⚠ ${overdueCount} ເກີນກຳນົດ` : 'ໃນກຳນົດ', color: overdueCount > 0 ? 'amber' : 'violet' },
    { l: 'ບິນ Pending', v: new Intl.NumberFormat('lo-LA').format(pendingInvoices.length), sub: pendingInvoices.length > 0 ? 'ລໍຖ້ານຳເຂົ້າ' : 'ບໍ່ມີ', color: pendingInvoices.length > 0 ? 'amber' : 'slate' },
  ]
  const kpiColor = {
    blue: 'text-red-600 bg-red-50 border-red-100',
    slate: 'text-slate-700 bg-slate-50 border-slate-200',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    rose: 'text-rose-600 bg-rose-50 border-rose-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    violet: 'text-violet-600 bg-violet-50 border-violet-100',
  }

  const filtersActive = searchTerm || statusFilter || paymentTypeFilter || dateRange.from || dateRange.to

  return (
    <div className="text-[13px]">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-extrabold text-slate-900">ລະບົບຊື້ເຂົ້າ</h2>
          <span className="text-[11px] text-slate-400">·</span>
          <span className="text-xs text-slate-500">{new Intl.NumberFormat('lo-LA').format(purchases.length)} ໃບ</span>
          {debtCount > 0 && <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-50 text-amber-600 rounded">{debtCount} ຕິດໜີ້</span>}
          {overdueCount > 0 && <span className="text-[11px] font-bold px-2 py-0.5 bg-red-50 text-red-600 rounded">{overdueCount} ເກີນ</span>}
        </div>
        <div className="flex items-center gap-2">
          {pendingInvoices.length > 0 && (
            <button
              onClick={() => { setShowPendingModal(true); setNewPendingCount(0) }}
              className="relative px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
            >
              {newPendingCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold items-center justify-center">+{newPendingCount}</span>
                </span>
              )}
              Pending
              <span className="bg-amber-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">{pendingInvoices.length}</span>
            </button>
          )}
          <button
            onClick={() => navigate('/admin/purchases/create')}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            ສ້າງໃບສັ່ງຊື້
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {kpis.map((k, i) => (
            <div key={i} className={`rounded-lg border p-3 ${kpiColor[k.color]}`}>
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{k.l}</div>
              <div className="text-xl font-extrabold mt-1 leading-tight">{k.v}</div>
              <div className="text-[10px] opacity-70 mt-0.5 truncate">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-lg p-2 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              type="text"
              placeholder="ຄົ້ນຫາ ID, ເລກອ້າງອີງ, ຜູ້ສະໜອງ..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-7 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-[12px] focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none"
            />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-[12px] focus:border-indigo-400 outline-none">
            <option value="">ທຸກສະຖານະ</option>
            <option value="pending">⏳ ຍັງບໍ່ຊຳລະ</option>
            <option value="partial">🔄 ບາງສ່ວນ</option>
            <option value="paid">✅ ຊຳລະແລ້ວ</option>
          </select>
          <select value={paymentTypeFilter} onChange={e => setPaymentTypeFilter(e.target.value)} className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-[12px] focus:border-indigo-400 outline-none">
            <option value="">ທຸກປະເພດ</option>
            <option value="cash">💵 ເງິນສົດ</option>
            <option value="debt">📋 ຕິດໜີ້</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-[12px] focus:border-indigo-400 outline-none">
            <option value="date_desc">📅 ລ້າສຸດ</option>
            <option value="date_asc">📅 ເກົ່າສຸດ</option>
            <option value="total_desc">💰 ຍອດສູງ</option>
            <option value="total_asc">💰 ຍອດຕ່ຳ</option>
          </select>
          <input type="date" value={dateRange.from} onChange={e => setDateRange({ ...dateRange, from: e.target.value })} className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-[12px] focus:border-indigo-400 outline-none"/>
          <input type="date" value={dateRange.to} onChange={e => setDateRange({ ...dateRange, to: e.target.value })} className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-[12px] focus:border-indigo-400 outline-none"/>
          {filtersActive && (
            <button
              onClick={() => { setSearchTerm(''); setStatusFilter(''); setPaymentTypeFilter(''); setDateRange({ from: '', to: '' }); setSortBy('date_desc') }}
              className="px-2 py-1.5 text-[12px] text-red-600 hover:bg-red-50 rounded-md transition"
            >
              ✕ ລ້າງ
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]" style={{ minWidth: 1200 }}>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px]">
                  <th className="text-left py-2 px-3 font-medium">ເລກທີ</th>
                  <th className="text-left py-2 px-3 font-medium w-28">ວັນທີ</th>
                  <th className="text-left py-2 px-3 font-medium">ຜູ້ສະໜອງ</th>
                  <th className="text-left py-2 px-3 font-medium w-28">ປະເພດ</th>
                  <th className="text-left py-2 px-3 font-medium w-28">ສະຖານະ</th>
                  <th className="text-left py-2 px-3 font-medium w-32">ກຳນົດຊຳລະ</th>
                  <th className="text-center py-2 px-3 font-medium w-16">ສະກຸນ</th>
                  <th className="text-right py-2 px-3 font-medium w-28">ຍອດລວມ</th>
                  <th className="text-right py-2 px-3 font-medium w-28">ລວມ (₭)</th>
                  <th className="text-right py-2 px-3 font-medium w-28">ຄ້າງ</th>
                  <th className="text-right py-2 px-2 font-medium w-24"></th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map(p => (
                  <PurchaseRow
                    key={p.id}
                    purchase={p}
                    handlePrint={handlePrint}
                    handleDelete={handleDelete}
                    setViewDetail={setViewDetail}
                    openPay={openPay}
                  />
                ))}
                {filteredPurchases.length === 0 && (
                  <tr>
                    <td colSpan="11" className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <span className="text-3xl">📦</span>
                        <p className="text-[12px]">{filtersActive ? 'ບໍ່ພົບຂໍ້ມູນ' : 'ຍັງບໍ່ມີໃບສັ່ງຊື້'}</p>
                        {!filtersActive && (
                          <button onClick={() => navigate('/admin/purchases/create')} className="mt-1 px-3 py-1.5 bg-indigo-600 text-white rounded-md text-[12px] font-semibold">+ ສ້າງໃບສັ່ງຊື້ທຳອິດ</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pending Invoices Modal */}
      {showPendingModal && pendingInvoices.length > 0 && (() => {
        const thbFmt = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        const grandTotal = pendingInvoices.reduce((s, inv) => s + getHeaderTotal(inv.header, Array.isArray(inv.items) ? inv.items : []), 0)
        return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowPendingModal(false)}>
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden animate-pop-in" onClick={e => e.stopPropagation()}>

            {/* Gradient header */}
            <div className="relative shrink-0 bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 text-white px-6 py-5 overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-12 -left-10 w-36 h-36 bg-white/10 rounded-full blur-3xl"></div>
              <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-2xl shadow-lg ring-1 ring-white/30">
                    ⏳
                  </div>
                  <div>
                    <h3 className="font-bold text-[18px] leading-tight">ບິນ Pending ຈາກຜູ້ສະໜອງ</h3>
                    <p className="text-[12px] text-amber-50 mt-0.5">
                      <span className="font-semibold">{pendingInvoices.length}</span> ໃບລໍຖ້ານຳເຂົ້າ
                      {grandTotal > 0 && <span className="ml-2">• ລວມ <span className="font-semibold text-white">฿ {thbFmt.format(grandTotal)}</span></span>}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowPendingModal(false)} className="w-9 h-9 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition active:scale-95">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1 p-4 space-y-2 bg-gradient-to-b from-amber-50/30 via-slate-50 to-slate-50">
              {pendingInvoices.map(inv => {
                const items = Array.isArray(inv.items) ? inv.items : []
                const billTotal = getHeaderTotal(inv.header, items)
                const billDiscount = getHeaderDiscount(inv.header, items)
                const isOpen = expandedPendingId === inv.id
                const hasDetails = items.length > 0 && items.some(it => getItemPrice(it) > 0)
                return (
                  <div key={inv.id} className={`bg-white rounded-xl border transition-all ${isOpen ? 'border-amber-300 shadow-md shadow-amber-500/10' : 'border-slate-200 hover:border-amber-200 hover:shadow-sm'}`}>
                    <div onClick={() => setExpandedPendingId(isOpen ? null : inv.id)} className="p-3 flex items-center gap-3 cursor-pointer">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-base shrink-0 transition ${isOpen ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/30' : 'bg-amber-100 text-amber-600'}`}>📄</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-slate-800 text-[13px]">{inv.doc_no}</span>
                          {inv.doc_date && <span className="text-[11px] text-slate-400 font-mono">{new Date(inv.doc_date).toLocaleDateString('lo-LA')}</span>}
                          {billTotal > 0 && (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              ฿ {thbFmt.format(billTotal)}
                            </span>
                          )}
                          {billDiscount > 0 && (
                            <span className="text-[11px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                              ຫຼຸດ ฿ {thbFmt.format(billDiscount)}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5">
                          <span className="flex items-center gap-1">🏭 <span className="font-medium text-slate-700">{inv.supplier_name}</span></span>
                          <span className="flex items-center gap-1">🏷 <span className="font-mono">{inv.cust_code}</span></span>
                          <span className="flex items-center gap-1">📦 {items.length} ລາຍການ</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => { setShowPendingModal(false); navigate('/admin/purchases/create', { state: { pendingInvoice: inv } }) }}
                          className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-lg text-[11px] font-semibold shadow-sm shadow-indigo-600/30 transition active:scale-95 flex items-center gap-1"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                          ສ້າງ
                        </button>
                        <button onClick={() => dismissPending(inv.id)} className="w-7 h-7 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg flex items-center justify-center transition" title="ລຶບ">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${isOpen ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
                        </div>
                      </div>
                    </div>
                    {isOpen && hasDetails && (
                      <div className="px-3 pb-3 pt-0">
                        <div className="ml-13 border border-slate-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto bg-slate-50/50">
                          <table className="w-full text-[11px]">
                            <thead className="bg-slate-100/80 backdrop-blur sticky top-0">
                              <tr className="text-slate-500 border-b border-slate-200">
                                <th className="text-left py-1.5 px-2 font-semibold w-8">#</th>
                                <th className="text-left py-1.5 px-2 font-semibold w-24">ລະຫັດ</th>
                                <th className="text-left py-1.5 px-2 font-semibold">ຊື່ສິນຄ້າ</th>
                                <th className="text-center py-1.5 px-2 font-semibold w-14">ຈຳນວນ</th>
                                <th className="text-left py-1.5 px-2 font-semibold w-14">ໜ່ວຍ</th>
                                <th className="text-right py-1.5 px-2 font-semibold w-20">ລາຄາ/ໜ່ວຍ</th>
                                <th className="text-right py-1.5 px-2 font-semibold w-24">ກ່ອນຫຼຸດ</th>
                                <th className="text-right py-1.5 px-2 font-semibold w-20">ຫຼຸດ</th>
                                <th className="text-right py-1.5 px-2 font-semibold w-24">ຫຼັງຫຼຸດ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {items.map((it, i) => {
                                const code = it.item_code || ''
                                const name = it.item_name || ''
                                const unit = it.unit_code || it.unit_name || it.unit || ''
                                const qty = pickNum(it, ['qty', 'quantity']) || 0
                                const price = getItemPrice(it)
                                const disc = getItemDiscount(it)
                                const net = getItemLineTotal(it)
                                const gross = price * qty
                                const discPct = gross > 0 && disc > 0 ? (disc / gross) * 100 : 0
                                return (
                                  <tr key={i} className="hover:bg-amber-50/30 transition">
                                    <td className="py-1.5 px-2 text-slate-400 font-mono">{i + 1}</td>
                                    <td className="py-1.5 px-2 font-mono text-indigo-600 whitespace-nowrap">
                                      <span className="bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">{code || '—'}</span>
                                    </td>
                                    <td className="py-1.5 px-2 text-slate-700 truncate max-w-[240px]">{name || '—'}</td>
                                    <td className="py-1.5 px-2 text-center font-mono text-slate-700 font-semibold">{qty}</td>
                                    <td className="py-1.5 px-2 text-slate-500 whitespace-nowrap">{unit || '—'}</td>
                                    <td className="py-1.5 px-2 text-right font-mono text-slate-500 whitespace-nowrap">฿{thbFmt.format(price)}</td>
                                    <td className="py-1.5 px-2 text-right font-mono whitespace-nowrap">
                                      <span className={disc > 0 ? 'text-slate-400 line-through' : 'text-slate-700 font-semibold'}>฿{thbFmt.format(gross)}</span>
                                    </td>
                                    <td className="py-1.5 px-2 text-right font-mono whitespace-nowrap">
                                      {disc > 0 ? (
                                        <div className="flex flex-col items-end leading-tight">
                                          <span className="text-orange-600 font-semibold">-฿{thbFmt.format(disc)}</span>
                                          <span className="text-[9px] text-orange-400">({discPct.toFixed(1)}%)</span>
                                        </div>
                                      ) : <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="py-1.5 px-2 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">฿{thbFmt.format(net)}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                              {(() => {
                                const grossSum = items.reduce((s, it) => s + (getItemPrice(it) * (pickNum(it, ['qty', 'quantity']) || 0)), 0)
                                const discSum = items.reduce((s, it) => s + getItemDiscount(it), 0)
                                return (
                                  <>
                                    {grossSum > 0 && (
                                      <tr>
                                        <td colSpan="6" className="py-1 px-2 text-right text-[10px] text-slate-500">ລວມກ່ອນຫຼຸດ</td>
                                        <td className="py-1 px-2 text-right font-mono text-slate-600">฿{thbFmt.format(grossSum)}</td>
                                        <td className="py-1 px-2 text-right font-mono text-orange-500">{discSum > 0 ? `-฿${thbFmt.format(discSum)}` : '—'}</td>
                                        <td className="py-1 px-2"></td>
                                      </tr>
                                    )}
                                    <tr>
                                      <td colSpan="8" className="py-1.5 px-2 text-right text-[11px] font-bold text-slate-600">ຫຼັງຫຼຸດ (ລວມທັງໝົດ)</td>
                                      <td className="py-1.5 px-2 text-right font-mono font-bold text-emerald-700 text-[12px]">฿{thbFmt.format(billTotal)}</td>
                                    </tr>
                                  </>
                                )
                              })()}
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}
                    {isOpen && !hasDetails && (
                      <div className="px-3 pb-3 text-center text-[11px] text-slate-400 italic">ບໍ່ມີຂໍ້ມູນລາຍການ — ຕ້ອງ sync ໃໝ່</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        )
      })()}

      {/* Detail slide-in */}
      {viewDetail && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setViewDetail(null)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"></div>
          <div className="relative w-full max-w-md h-full bg-white shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-800 text-white px-4 py-3 flex items-start justify-between shrink-0">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">ໃບສັ່ງຊື້</div>
                <h2 className="text-[15px] font-bold">#{viewDetail.id} {viewDetail.ref_number && <span className="text-[11px] font-mono text-slate-300 ml-1">{viewDetail.ref_number}</span>}</h2>
                <div className="text-[11px] text-slate-300 mt-0.5">🏭 {viewDetail.supplier_name || '—'} · 📅 {new Date(viewDetail.created_at).toLocaleDateString('lo-LA')}</div>
              </div>
              <div className="flex items-center gap-1">
                {viewDetail.payment_type === 'debt' && effectiveStatus(viewDetail) !== 'paid' && (
                  <button onClick={() => { setViewDetail(null); openPay(viewDetail) }} className="w-7 h-7 bg-emerald-500 hover:bg-emerald-600 rounded text-white flex items-center justify-center" title="ຊຳລະ">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M12 8v8M8 12h8"/></svg>
                  </button>
                )}
                <button onClick={() => handlePrint(viewDetail)} className="w-7 h-7 bg-slate-700 hover:bg-slate-600 rounded text-white flex items-center justify-center" title="ພິມ">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                </button>
                <button onClick={() => handleDelete(viewDetail.id)} className="w-7 h-7 bg-slate-700 hover:bg-red-500 rounded text-white flex items-center justify-center" title="ລຶບ">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </button>
                <button onClick={() => setViewDetail(null)} className="w-7 h-7 bg-slate-700 hover:bg-slate-600 rounded text-white flex items-center justify-center">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Totals mini */}
              {(() => {
                const f = fmtBill(viewDetail)
                const paidText = f.isForeign ? `${new Intl.NumberFormat('lo-LA').format(Math.round(viewDetail.paid / f.rate))} ${f.sym}` : formatPrice(viewDetail.paid)
                const remText = f.isForeign ? `${new Intl.NumberFormat('lo-LA').format(Math.round(f.remaining / f.rate))} ${f.sym}` : formatPrice(f.remaining)
                return (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-50 border border-slate-200 rounded-md p-2 text-center">
                      <div className="text-[9px] text-slate-500">ລວມ</div>
                      <div className="text-[13px] font-bold font-mono text-slate-800">{f.total}</div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-md p-2 text-center">
                      <div className="text-[9px] text-emerald-600">ຊຳລະ</div>
                      <div className="text-[13px] font-bold font-mono text-emerald-700">{paidText}</div>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-md p-2 text-center">
                      <div className="text-[9px] text-red-600">ຄ້າງ</div>
                      <div className="text-[13px] font-bold font-mono text-red-700">{remText}</div>
                    </div>
                  </div>
                )
              })()}

              {/* Info rows */}
              <div className="bg-slate-50 border border-slate-200 rounded-md p-3 space-y-1.5 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">ປະເພດການຊຳລະ</span>
                  <span className={`font-semibold ${viewDetail.payment_type === 'debt' ? 'text-red-600' : 'text-emerald-600'}`}>
                    {viewDetail.payment_type === 'debt' ? '📋 ຕິດໜີ້' : '💵 ເງິນສົດ'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ສະຖານະ</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${(statusMap[effectiveStatus(viewDetail)] || statusMap.pending).cls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${(statusMap[effectiveStatus(viewDetail)] || statusMap.pending).dot}`}></span>
                    {(statusMap[effectiveStatus(viewDetail)] || statusMap.pending).label}
                  </span>
                </div>
                {viewDetail.payment_type === 'debt' && viewDetail.due_date && (() => {
                  const cd = formatCountdown(viewDetail.due_date)
                  return (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">ຄົບກຳນົດ</span>
                      <div className="text-right">
                        <div className="font-semibold text-slate-700">{new Date(viewDetail.due_date).toLocaleDateString('lo-LA')}</div>
                        {cd && <div className={`text-[10px] font-mono ${cd.expired ? 'text-red-600' : cd.days <= 3 ? 'text-amber-600' : 'text-emerald-600'}`}>{cd.expired ? `⚠ ເກີນ ${cd.days}ວ` : `⏳ ${cd.text}`}</div>}
                      </div>
                    </div>
                  )
                })()}
                {viewDetail.currency && viewDetail.currency !== 'LAK' && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">ອັດຕາ</span>
                    <span className="font-mono text-indigo-600">1 {curSymbol[viewDetail.currency]} = {new Intl.NumberFormat('lo-LA').format(parseFloat(viewDetail.exchange_rate))} ₭</span>
                  </div>
                )}
                {viewDetail.note && (
                  <div className="pt-1.5 border-t border-slate-200">
                    <div className="text-[10px] text-slate-500 mb-0.5">ໝາຍເຫດ</div>
                    <div className="text-[11px] text-slate-700">{viewDetail.note}</div>
                  </div>
                )}
              </div>

              {/* Payment history */}
              {detailPayments.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <span>💰 ລາຍການຊຳລະ</span>
                    <span className="bg-emerald-100 text-emerald-600 font-bold px-1.5 py-0.5 rounded text-[9px]">{detailPayments.length}</span>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                      {detailPayments.map(pay => {
                        const method = pay.payment_method === 'transfer' ? '🏦 ໂອນ' : pay.payment_method === 'cash' ? '💵 ສົດ' : pay.payment_method === 'cheque' ? '📝 ເຊັກ' : pay.payment_method
                        const payCur = pay.currency || 'LAK'
                        const paySym = curSymbol[payCur] || '₭'
                        const payRate = Number(pay.exchange_rate) || 1
                        const isForeign = payCur !== 'LAK'
                        const amountOrig = isForeign ? Math.round(Number(pay.amount) / payRate) : Number(pay.amount)
                        return (
                          <div key={pay.id} className="p-2 text-[11px] hover:bg-slate-50/50">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {pay.payment_number && <span className="font-mono font-bold text-emerald-600 text-[10px] bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded shrink-0">{pay.payment_number}</span>}
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">{method}</span>
                                <span className={`text-[9px] font-bold px-1 py-0.5 rounded shrink-0 ${isForeign ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>{payCur}</span>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-mono font-bold text-emerald-600">{paySym} {new Intl.NumberFormat('lo-LA').format(amountOrig)}</div>
                                {isForeign && <div className="text-[9px] text-slate-400 font-mono">≈ {formatPrice(pay.amount)}</div>}
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                              <span>{new Date(pay.payment_date || pay.created_at).toLocaleDateString('lo-LA')}{isForeign && ` • 1 ${paySym} = ${new Intl.NumberFormat('lo-LA').format(payRate)} ₭`}</span>
                              <div className="flex items-center gap-1">
                                {pay.note && <span className="truncate max-w-[120px]">📝 {pay.note}</span>}
                                {pay.attachment && <a href={pay.attachment} target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">📎</a>}
                                <button onClick={() => generateAndPrintPaymentReceipt(pay, viewDetail)} className="w-5 h-5 text-indigo-500 hover:bg-indigo-50 rounded flex items-center justify-center" title="ພິມ">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="border-t-2 border-slate-200 px-2 py-1.5 bg-slate-50 flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-500">ລວມຊຳລະ ({detailPayments.length} ລາຍການ)</span>
                      <span className="font-mono font-bold text-emerald-600">{formatPrice(detailPayments.reduce((s, p) => s + Number(p.amount || 0), 0))}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Items */}
              <div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">ລາຍການສິນຄ້າ ({viewDetail.items?.length || 0})</div>
                <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {(viewDetail.items || []).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 text-[11px]">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-800 truncate">{item.product_name}</div>
                          <div className="text-[10px] text-slate-400">{item.quantity} {item.unit_name || 'ໜ່ວຍ'} × {formatPrice(item.cost_price)}</div>
                        </div>
                        <div className="font-bold text-slate-700 font-mono">{formatPrice(item.cost_price * item.quantity)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 space-y-2 shrink-0">
              {viewDetail.payment_type === 'debt' && effectiveStatus(viewDetail) !== 'paid' && (
                <button onClick={() => { setViewDetail(null); openPay(viewDetail) }} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[12px] font-semibold transition">
                  💰 ຊຳລະໜີ້
                </button>
              )}
              <button onClick={() => handleDelete(viewDetail.id)} className="w-full py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-md text-[12px] font-semibold transition">
                🗑 ລຶບໃບສັ່ງຊື້
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {showPay && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setShowPay(null)}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"></div>
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-200 bg-emerald-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-[14px]">💰 ສ້າງເອກະສານຊຳລະ</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">ໃບສັ່ງຊື້ #{showPay.id} — {showPay.supplier_name || '—'}</p>
              </div>
              <button onClick={() => setShowPay(null)} className="w-7 h-7 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Mini summary */}
            {(() => {
              const sym = curSymbol[showPay.currency] || '₭'
              const rate = parseFloat(showPay.exchange_rate) || 1
              const isForeign = showPay.currency && showPay.currency !== 'LAK'
              const fmtOriginal = (v) => sym + ' ' + new Intl.NumberFormat('lo-LA').format(isForeign ? Math.round(parseFloat(v) / rate) : parseFloat(v))
              return (
                <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 border-b border-slate-200 shrink-0">
                  <div className="bg-white rounded border border-slate-200 p-2 text-center">
                    <div className="text-[9px] text-slate-500">ຍອດລວມ</div>
                    <div className="text-[12px] font-bold font-mono">{fmtOriginal(showPay.total)}</div>
                  </div>
                  <div className="bg-white rounded border border-emerald-200 p-2 text-center">
                    <div className="text-[9px] text-emerald-600">ຊຳລະແລ້ວ</div>
                    <div className="text-[12px] font-bold font-mono text-emerald-700">{fmtOriginal(showPay.paid)}</div>
                  </div>
                  <div className="bg-white rounded border border-red-200 p-2 text-center">
                    <div className="text-[9px] text-red-600">ຍັງເຫຼືອ</div>
                    <div className="text-[12px] font-bold font-mono text-red-700">{fmtOriginal(parseFloat(showPay.total) - parseFloat(showPay.paid))}</div>
                  </div>
                </div>
              )
            })()}

            <div className="overflow-y-auto flex-1 p-3 space-y-3">
              {payments.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">ປະຫວັດການຊຳລະ</div>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {payments.map(pay => {
                      const payCur = pay.currency || 'LAK'
                      const paySym = curSymbol[payCur] || '₭'
                      const payRate = Number(pay.exchange_rate) || 1
                      const isForeign = payCur !== 'LAK'
                      const amountOrig = isForeign ? Math.round(Number(pay.amount) / payRate) : Number(pay.amount)
                      return (
                      <div key={pay.id} className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {pay.payment_number && <span className="font-semibold text-indigo-600 font-mono text-[10px] shrink-0">{pay.payment_number}</span>}
                          <span className={`text-[9px] font-bold px-1 py-0.5 rounded shrink-0 ${isForeign ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>{payCur}</span>
                          <span className="font-bold font-mono text-slate-700 whitespace-nowrap">{paySym} {new Intl.NumberFormat('lo-LA').format(amountOrig)}</span>
                          {isForeign && <span className="text-[9px] text-slate-400 font-mono whitespace-nowrap">≈ {formatPrice(pay.amount)}</span>}
                          {pay.payment_method && <span className="text-[9px] bg-slate-200 text-slate-500 px-1 py-0.5 rounded shrink-0">{pay.payment_method === 'transfer' ? 'ໂອນ' : pay.payment_method === 'cash' ? 'ສົດ' : pay.payment_method}</span>}
                          {pay.note && <span className="text-slate-400 text-[10px] truncate">{pay.note}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-slate-400 text-[10px]">{new Date(pay.created_at).toLocaleDateString('lo-LA')}</span>
                          <button onClick={() => generateAndPrintPaymentReceipt(pay, showPay)} className="w-4 h-4 bg-indigo-100 hover:bg-indigo-200 text-indigo-600 rounded flex items-center justify-center" title="ພິມໃບຊຳລະ">
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                          </button>
                          <button onClick={() => handleDeletePayment(pay.id)} className="w-4 h-4 bg-red-100 hover:bg-red-200 text-red-500 rounded flex items-center justify-center" title="ລຶບ">
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                          </button>
                        </div>
                      </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <form onSubmit={handlePay} className="space-y-3">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">ເອກະສານຊຳລະໃໝ່</div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-1">ເລກທີເອກະສານ</label>
                    <input type="text" value={payForm.payment_number} readOnly
                      className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded text-[12px] font-mono text-slate-700 cursor-not-allowed outline-none"/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-1">ວັນທີ</label>
                    <input type="date" required value={payForm.payment_date} onChange={e => setPayForm({ ...payForm, payment_date: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-[12px] focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none"/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-1">ຈຳນວນເງິນ</label>
                    <input type="number" required min="1" max={parseFloat(showPay.total) - parseFloat(showPay.paid)} value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-[12px] text-right font-mono focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0"/>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-1">ສະກຸນເງິນ</label>
                    <select value={payForm.currency} onChange={e => {
                      const newCur = e.target.value
                      const billCur = showPay.currency || 'LAK'
                      const billRate = parseFloat(showPay.exchange_rate) || 1
                      const remainingLAK = parseFloat(showPay.total) - parseFloat(showPay.paid)
                      let newRate, newAmount
                      if (newCur === billCur) { newRate = String(billRate); newAmount = String(billCur !== 'LAK' ? Math.round(remainingLAK / billRate) : remainingLAK) }
                      else if (newCur === 'LAK') { newRate = '1'; newAmount = String(remainingLAK) }
                      else { newRate = payForm.exchange_rate; newAmount = payForm.amount }
                      setPayForm({ ...payForm, currency: newCur, exchange_rate: newRate, amount: newAmount })
                    }} className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-[12px] focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none">
                      <option value="LAK">₭ ກີບ</option>
                      <option value="THB">฿ ບາດ</option>
                      <option value="USD">$ ໂດລາ</option>
                      <option value="CNY">¥ ຫຍວນ</option>
                      <option value="VND">₫ ດົງ</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-1">ອັດຕາ (1 {payForm.currency} = ? ₭)</label>
                    <input type="number" min="0" step="any" value={payForm.exchange_rate} onChange={e => setPayForm({ ...payForm, exchange_rate: e.target.value })} disabled={payForm.currency === 'LAK'}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-[12px] font-mono focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="1"/>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">ວິທີຊຳລະ</label>
                  <div className="flex gap-1.5">
                    {[
                      { value: 'transfer', label: 'ເງິນໂອນ', icon: '🏦' },
                      { value: 'cash', label: 'ເງິນສົດ', icon: '💵' },
                      { value: 'cheque', label: 'ເຊັກ', icon: '📝' }
                    ].map(m => (
                      <button key={m.value} type="button" onClick={() => setPayForm({ ...payForm, payment_method: m.value })}
                        className={`flex-1 py-1.5 rounded text-[11px] font-semibold border transition ${payForm.payment_method === m.value ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                        {m.icon} {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">ແນບເອກະສານ</label>
                  <div className="relative">
                    <input type="file" accept="image/*,.pdf,.doc,.docx" onChange={e => setPayForm({ ...payForm, attachment: e.target.files[0] || null })} className="hidden" id="pay-attachment"/>
                    <label htmlFor="pay-attachment" className="flex items-center gap-2 px-2.5 py-2 bg-slate-50 border border-dashed border-slate-300 rounded text-[11px] cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition">
                      <span className="text-base">📎</span>
                      {payForm.attachment ? (
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-700 truncate">{payForm.attachment.name}</div>
                          <div className="text-[9px] text-slate-400">{(payForm.attachment.size / 1024).toFixed(1)} KB</div>
                        </div>
                      ) : (
                        <div className="flex-1 text-slate-500">ເລືອກໄຟລ໌ (ຮູບ, PDF, Word)</div>
                      )}
                    </label>
                    {payForm.attachment && (
                      <button type="button" onClick={() => setPayForm({ ...payForm, attachment: null })} className="absolute top-1 right-1 w-5 h-5 bg-red-100 hover:bg-red-200 text-red-500 rounded-full flex items-center justify-center text-[10px]">✕</button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">ໝາຍເຫດ</label>
                  <input type="text" value={payForm.note} onChange={e => setPayForm({ ...payForm, note: e.target.value })} placeholder="ບັນທຶກເພີ່ມເຕີມ..."
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-[12px] focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none"/>
                </div>

                <button type="submit" disabled={uploading}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[12px] font-bold transition disabled:opacity-50">
                  {uploading ? 'ກຳລັງອັບໂຫຼດ...' : '💰 ຢືນຢັນການຊຳລະ'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {busyMessage && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"></div>
          <div className="relative bg-white rounded-2xl shadow-2xl px-8 py-6 flex flex-col items-center gap-3 animate-pop-in">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-600 animate-spin"></div>
            </div>
            <div className="text-[13px] font-semibold text-slate-700">{busyMessage}</div>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirmState && (() => {
        const v = confirmState.variant
        const theme = v === 'danger'
          ? { accent: 'from-red-500 to-rose-600', glow: 'shadow-red-500/40', iconBg: 'bg-red-100', iconColor: 'text-red-600', btn: 'bg-red-600 hover:bg-red-700', ring: 'ring-red-500/30' }
          : v === 'warning'
          ? { accent: 'from-amber-500 to-orange-600', glow: 'shadow-amber-500/40', iconBg: 'bg-amber-100', iconColor: 'text-amber-600', btn: 'bg-amber-600 hover:bg-amber-700', ring: 'ring-amber-500/30' }
          : { accent: 'from-indigo-500 to-red-600', glow: 'shadow-indigo-500/40', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600', btn: 'bg-indigo-600 hover:bg-indigo-700', ring: 'ring-indigo-500/30' }
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-fade-in" onClick={() => confirmState.onDone(false)}>
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"></div>
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-pop-in" onClick={e => e.stopPropagation()}>
              {/* Top colored bar */}
              <div className={`h-1 bg-gradient-to-r ${theme.accent}`}></div>

              <div className="p-6">
                <div className="flex items-start gap-4">
                  {/* Icon circle */}
                  <div className={`relative shrink-0 w-12 h-12 ${theme.iconBg} rounded-full flex items-center justify-center`}>
                    <div className={`absolute inset-0 ${theme.iconBg} rounded-full animate-ping opacity-40`}></div>
                    <svg className={`relative w-6 h-6 ${theme.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      {v === 'danger' ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.76-2.94L13.76 4.06a2 2 0 00-3.52 0L3.31 16.06A2 2 0 005.07 19z"/>
                      ) : v === 'warning' ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      )}
                    </svg>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[16px] text-slate-900 leading-tight">{confirmState.title}</h3>
                    <p className="text-[13px] text-slate-500 leading-relaxed mt-2">{confirmState.message}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end mt-6">
                  <button
                    onClick={() => confirmState.onDone(false)}
                    className="px-5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[13px] font-semibold transition active:scale-95"
                  >
                    {confirmState.cancelLabel}
                  </button>
                  <button
                    onClick={() => confirmState.onDone(true)}
                    autoFocus
                    className={`px-5 py-2 text-white rounded-lg text-[13px] font-bold transition active:scale-95 shadow-lg ${theme.btn} ${theme.glow} focus:outline-none focus:ring-4 ${theme.ring}`}
                  >
                    {confirmState.confirmLabel}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      <style>{`
        @keyframes fade-in-overlay {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pop-in {
          from { opacity: 0; transform: scale(0.92) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-fade-in { animation: fade-in-overlay 0.2s ease-out; }
        .animate-pop-in { animation: pop-in 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  )
}
