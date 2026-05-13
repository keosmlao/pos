'use client';

import { useState, useEffect } from 'react'
import { AdminHero } from '@/components/admin/ui/AdminHero'

const API = '/api'
const curSymbol = { LAK: '₭', THB: '฿', USD: '$', CNY: '¥', VND: '₫' }
function formatPrice(p) { return new Intl.NumberFormat('lo-LA').format(p) + ' ₭' }

export default function Debts() {
  const [debts, setDebts] = useState([])
  const [allPayments, setAllPayments] = useState([])
  const [tab, setTab] = useState('outstanding') // 'outstanding' | 'paid'
  const [search, setSearch] = useState('')
  const [showPay, setShowPay] = useState(null)
  const [payments, setPayments] = useState([])
  const [payForm, setPayForm] = useState({
    payment_number: '', payment_date: '', amount: '',
    currency: 'LAK', exchange_rate: '1', payment_method: 'transfer',
    note: '', attachment: null
  })
  const [uploading, setUploading] = useState(false)
  const [busyMessage, setBusyMessage] = useState(null)
  const [confirmState, setConfirmState] = useState(null)

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

  const load = () => {
    fetch(`${API}/admin/debts`).then(r => r.json()).then(setDebts)
    fetch(`${API}/admin/debts/all-payments`).then(r => r.json()).then(setAllPayments)
  }
  useEffect(() => { load() }, [])

  const openPay = async (debt) => {
    setShowPay(debt)
    const [numRes, payRes] = await Promise.all([
      fetch(`${API}/admin/payments/next-number`),
      fetch(`${API}/admin/debts/${debt.id}/payments`)
    ])
    const { number } = await numRes.json()
    setPayments(await payRes.json())
    const remainingLAK = parseFloat(debt.remaining)
    const billCurrency = debt.currency || 'LAK'
    const billRate = parseFloat(debt.exchange_rate) || 1
    const remainingOriginal = billCurrency !== 'LAK' ? Math.round(remainingLAK / billRate) : remainingLAK
    setPayForm({
      payment_number: number,
      payment_date: new Date().toISOString().split('T')[0],
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
      message: 'ຍອດຈະຖືກຫັກຄືນອອກຈາກໃບສັ່ງຊື້. ແນ່ໃຈບໍ?',
      confirmLabel: 'ລຶບ', variant: 'danger'
    })
    if (!ok) return
    setBusyMessage('ກຳລັງລຶບ...')
    await new Promise(r => setTimeout(r, 800))
    try {
      const res = await fetch(`${API}/admin/debts/payments/${paymentId}`, { method: 'DELETE' })
      if (res.ok) {
        load()
        if (showPay) {
          const pRes = await fetch(`${API}/admin/debts/${showPay.id}/payments`)
          setPayments(await pRes.json())
        }
      } else { const err = await res.json(); alert(err.error) }
    } finally { setBusyMessage(null) }
  }

  const handlePay = async (e) => {
    e.preventDefault()
    let attachmentPath = null
    if (payForm.attachment) attachmentPath = await handleUploadAttachment(payForm.attachment)
    const res = await fetch(`${API}/admin/debts/${showPay.id}/payments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Number(payForm.amount),
        note: payForm.note,
        payment_number: payForm.payment_number,
        payment_date: payForm.payment_date,
        currency: payForm.currency,
        exchange_rate: Number(payForm.exchange_rate),
        payment_method: payForm.payment_method,
        attachment: attachmentPath
      })
    })
    if (res.ok) {
      load()
      setShowPay(null)
    } else { const err = await res.json(); alert(err.error) }
  }

  const totalDebt = debts.reduce((sum, d) => sum + parseFloat(d.remaining || 0), 0)
  const totalPaid = allPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
  const overdueCount = debts.filter(d => d.due_date && new Date(d.due_date).getTime() + 86400000 < Date.now()).length

  // Group by currency: sum remaining in each bill's own currency
  const debtByCurrency = {}
  for (const d of debts) {
    const cur = d.currency || 'LAK'
    const rate = parseFloat(d.exchange_rate) || 1
    const remLAK = parseFloat(d.remaining || 0)
    const remOriginal = cur !== 'LAK' ? remLAK / rate : remLAK
    if (!debtByCurrency[cur]) debtByCurrency[cur] = { count: 0, remainingOriginal: 0, remainingLAK: 0 }
    debtByCurrency[cur].count += 1
    debtByCurrency[cur].remainingOriginal += remOriginal
    debtByCurrency[cur].remainingLAK += remLAK
  }
  const currencyGroups = Object.entries(debtByCurrency).sort((a, b) => b[1].remainingLAK - a[1].remainingLAK)

  const searchQ = search.toLowerCase().trim()
  const filteredDebts = searchQ
    ? debts.filter(d =>
        String(d.id).includes(searchQ) ||
        (d.ref_number && d.ref_number.toLowerCase().includes(searchQ)) ||
        (d.supplier_name && d.supplier_name.toLowerCase().includes(searchQ))
      )
    : debts
  const filteredPayments = searchQ
    ? allPayments.filter(p =>
        (p.payment_number && p.payment_number.toLowerCase().includes(searchQ)) ||
        (p.supplier_name && p.supplier_name.toLowerCase().includes(searchQ)) ||
        String(p.purchase_id).includes(searchQ)
      )
    : allPayments

  const fmtNum = n => new Intl.NumberFormat('lo-LA').format(n)
  const fmtCompact = n => {
    const num = Number(n) || 0
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B'
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M'
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
    return String(num)
  }
  const dueSoonCount = debts.filter(d => {
    if (!d.due_date) return false
    const days = Math.ceil((new Date(d.due_date).getTime() + 86400000 - Date.now()) / 86400000)
    return days >= 0 && days <= 7
  }).length
  const avgDebt = debts.length ? totalDebt / debts.length : 0

  const kpis = [
    { l: 'ໜີ້ຄ້າງ', v: fmtNum(debts.length), sub: overdueCount > 0 ? `⚠ ${overdueCount} ເກີນ · ${dueSoonCount} ໃກ້ຄົບ` : `${dueSoonCount} ໃກ້ຄົບ ≤7ວ`, color: overdueCount > 0 ? 'rose' : 'amber' },
    { l: 'ໜີ້ລວມ', v: fmtCompact(totalDebt), sub: `ສະເລ່ຍ ${fmtCompact(avgDebt)}/ໃບ`, color: 'red' },
    { l: 'ຊຳລະແລ້ວ', v: fmtCompact(totalPaid), sub: `${allPayments.length} ໃບຊຳລະ`, color: 'emerald' },
    { l: 'ເກີນກຳນົດ', v: fmtNum(overdueCount), sub: overdueCount > 0 ? 'ຕ້ອງຮີບຊຳລະ' : 'ຄົບທຸກໃບ', color: overdueCount > 0 ? 'rose' : 'slate' },
    { l: 'ໃກ້ຄົບ ≤7ວ', v: fmtNum(dueSoonCount), sub: dueSoonCount > 0 ? 'ວາງແຜນຊຳລະ' : 'ບໍ່ມີ', color: dueSoonCount > 0 ? 'amber' : 'slate' },
    { l: 'ສະກຸນເງິນ', v: fmtNum(currencyGroups.length), sub: currencyGroups.map(([c]) => c).join(' · ') || 'LAK', color: 'violet' },
  ]
  const kpiColor = {
    red: 'text-red-600 bg-red-50 border-red-100',
    rose: 'text-rose-600 bg-rose-50 border-rose-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    violet: 'text-violet-600 bg-violet-50 border-violet-100',
    slate: 'text-slate-700 bg-slate-50 border-slate-200',
  }

  const methodBadge = (method) => {
    const map = {
      transfer: { label: 'ໂອນ', icon: '🏦', cls: 'bg-red-50 text-red-600 border-red-200' },
      cash: { label: 'ສົດ', icon: '💵', cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
      cheque: { label: 'ເຊັກ', icon: '📝', cls: 'bg-amber-50 text-amber-600 border-amber-200' },
    }
    const m = map[method] || { label: method || '—', icon: '', cls: 'bg-slate-50 text-slate-500 border-slate-200' }
    return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${m.cls}`}>{m.icon} {m.label}</span>
  }

  const formatDate = (str) => {
    if (!str) return '—'
    const d = new Date(str)
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
  }

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Supplier debts"
        title="💳 ໜີ້ເຈົ້າໜີ້ (ຜູ້ສະໜອງ)"
        subtitle={`${fmtNum(debts.length)} ຄ້າງ / ${fmtNum(allPayments.length)} ໃບຊຳລະ${overdueCount > 0 ? ` · ⚠ ${overdueCount} ເກີນ` : ''}${dueSoonCount > 0 ? ` · ${dueSoonCount} ໃກ້ຄົບ` : ''}`}
      />

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

        {/* Tabs + Search */}
        <div className="bg-white border border-slate-200 rounded-lg p-2 flex flex-wrap items-center gap-2">
          <div className="flex bg-slate-100 rounded-md p-0.5">
            <button
              onClick={() => setTab('outstanding')}
              className={`px-3 py-1.5 rounded text-[12px] font-semibold transition ${tab === 'outstanding' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              📋 ຄ້າງຊຳລະ <span className="ml-1 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{debts.length}</span>
            </button>
            <button
              onClick={() => setTab('paid')}
              className={`px-3 py-1.5 rounded text-[12px] font-semibold transition ${tab === 'paid' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              ✅ ຊຳລະແລ້ວ <span className="ml-1 text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full">{allPayments.length}</span>
            </button>
          </div>
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              type="text"
              placeholder={tab === 'outstanding' ? 'ຄົ້ນຫາ ID, ເລກອ້າງອີງ, ຜູ້ສະໜອງ...' : 'ຄົ້ນຫາເລກໃບຊຳລະ, ຜູ້ສະໜອງ...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-7 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-[12px] focus:border-red-400 focus:ring-1 focus:ring-red-200 outline-none"
            />
          </div>
          {search && (
            <button onClick={() => setSearch('')} className="px-2 py-1.5 text-[12px] text-red-600 hover:bg-red-50 rounded-md">✕ ລ້າງ</button>
          )}
        </div>

        {/* Per-currency breakdown (outstanding only) */}
        {tab === 'outstanding' && currencyGroups.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-500 mr-1">ໜີ້ແຍກຕາມສະກຸນ:</span>
              {currencyGroups.map(([cur, g]) => {
                const sym = curSymbol[cur] || cur
                const isForeign = cur !== 'LAK'
                return (
                  <div key={cur} className={`flex items-center gap-2 px-2.5 py-1 rounded border ${isForeign ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isForeign ? 'bg-red-600 text-white' : 'bg-slate-600 text-white'}`}>{cur}</span>
                    <span className="text-[11px] text-slate-500">{g.count} ໃບ</span>
                    <span className="text-[11px] text-slate-300">•</span>
                    <span className="text-[12px] font-bold font-mono text-red-600 whitespace-nowrap">
                      {sym} {new Intl.NumberFormat('lo-LA').format(Math.round(g.remainingOriginal))}
                    </span>
                    {isForeign && (
                      <span className="text-[10px] font-mono text-slate-400">≈ {new Intl.NumberFormat('lo-LA').format(Math.round(g.remainingLAK))} ₭</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Outstanding table */}
        {tab === 'outstanding' && (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]" style={{ minWidth: 900 }}>
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px]">
                    <th className="text-left py-2 px-3 font-medium whitespace-nowrap">ເລກທີ</th>
                    <th className="text-left py-2 px-3 font-medium w-28">ວັນທີ</th>
                    <th className="text-left py-2 px-3 font-medium">ຜູ້ສະໜອງ</th>
                    <th className="text-center py-2 px-2 font-medium w-14">ສະກຸນ</th>
                    <th className="text-left py-2 px-3 font-medium w-28 whitespace-nowrap">ຄົບກຳນົດ</th>
                    <th className="text-right py-2 px-3 font-medium w-32 whitespace-nowrap">ຍອດລວມ</th>
                    <th className="text-right py-2 px-3 font-medium w-32 whitespace-nowrap">ຊຳລະແລ້ວ</th>
                    <th className="text-right py-2 px-3 font-medium w-32 whitespace-nowrap">ຄ້າງ</th>
                    <th className="text-right py-2 px-2 font-medium w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDebts.map(d => {
                    const overdue = d.due_date && new Date(d.due_date).getTime() + 86400000 < Date.now()
                    const daysLeft = d.due_date ? Math.ceil((new Date(d.due_date).getTime() + 86400000 - Date.now()) / 86400000) : null
                    return (
                      <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="py-2 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-mono font-bold text-red-600">#{d.id}</span>
                            {d.ref_number && <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1 rounded">{d.ref_number}</span>}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-500 font-mono whitespace-nowrap">{formatDate(d.created_at)}</td>
                        <td className="py-2 px-3 font-medium text-slate-700 whitespace-nowrap">{d.supplier_name || '—'}</td>
                        <td className="py-2 px-2 text-center">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${(d.currency && d.currency !== 'LAK') ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-slate-100 text-slate-500'}`}>{d.currency || 'LAK'}</span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {d.due_date ? (
                            <div className="text-[11px]">
                              <div className="text-slate-500">{formatDate(d.due_date)}</div>
                              <div className={`font-mono font-semibold ${overdue ? 'text-red-600' : daysLeft <= 3 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {overdue ? `⚠ ເກີນ ${Math.abs(daysLeft)}ວ` : `${daysLeft}ວ`}
                              </div>
                            </div>
                          ) : <span className="text-[11px] text-slate-300">—</span>}
                        </td>
                        {(() => {
                          const cur = d.currency || 'LAK'
                          const sym = curSymbol[cur] || cur
                          const rate = parseFloat(d.exchange_rate) || 1
                          const isForeign = cur !== 'LAK'
                          const fmtOrig = (v) => `${new Intl.NumberFormat('lo-LA').format(Math.round(isForeign ? (parseFloat(v) || 0) / rate : parseFloat(v) || 0))} ${sym}`
                          return (
                            <>
                              <td className="py-2 px-3 text-right whitespace-nowrap">
                                <div className="font-mono font-semibold text-slate-700">{fmtOrig(d.total)}</div>
                                {isForeign && <div className="text-[10px] font-mono text-slate-400">{formatPrice(d.total)}</div>}
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap">
                                <div className="font-mono font-semibold text-emerald-600">{fmtOrig(d.paid)}</div>
                                {isForeign && <div className="text-[10px] font-mono text-emerald-500/60">{formatPrice(d.paid)}</div>}
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap">
                                <div className="font-mono font-bold text-red-600">{fmtOrig(d.remaining)}</div>
                                {isForeign && <div className="text-[10px] font-mono text-red-400">{formatPrice(d.remaining)}</div>}
                              </td>
                            </>
                          )
                        })()}
                        <td className="py-2 px-2 text-right">
                          <button onClick={() => openPay(d)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition">
                            💰 ຊຳລະ
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredDebts.length === 0 && (
                    <tr>
                      <td colSpan="9" className="text-center py-12">
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <span className="text-3xl">📭</span>
                          <p className="text-[12px]">{searchQ ? 'ບໍ່ພົບຂໍ້ມູນ' : 'ຍັງບໍ່ມີໜີ້ຄ້າງ'}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Paid history */}
        {tab === 'paid' && (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]" style={{ minWidth: 1000 }}>
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px]">
                    <th className="text-left py-2 px-3 font-medium whitespace-nowrap">ເລກໃບຊຳລະ</th>
                    <th className="text-left py-2 px-3 font-medium w-28">ວັນທີ</th>
                    <th className="text-left py-2 px-3 font-medium">ຜູ້ສະໜອງ / ໃບສັ່ງຊື້</th>
                    <th className="text-center py-2 px-3 font-medium w-20">ວິທີ</th>
                    <th className="text-right py-2 px-3 font-medium w-32 whitespace-nowrap">ຈຳນວນ</th>
                    <th className="text-left py-2 px-3 font-medium">ໝາຍເຫດ</th>
                    <th className="text-center py-2 px-2 font-medium w-20">ເອກະສານ</th>
                    <th className="text-right py-2 px-2 font-medium w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map(p => (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-2 px-3 whitespace-nowrap">
                        {p.payment_number ? (
                          <span className="text-[11px] font-mono font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">{p.payment_number}</span>
                        ) : <span className="text-slate-300 text-[11px]">—</span>}
                      </td>
                      <td className="py-2 px-3 text-[11px] text-slate-500 font-mono whitespace-nowrap">{formatDate(p.payment_date || p.created_at)}</td>
                      <td className="py-2 px-3">
                        <div className="font-medium text-slate-700 truncate">{p.supplier_name || '—'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">#{p.purchase_id} {p.ref_number && `• ${p.ref_number}`}</div>
                      </td>
                      <td className="py-2 px-3 text-center">{methodBadge(p.payment_method)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">{formatPrice(p.amount)}</td>
                      <td className="py-2 px-3 text-slate-500 text-[11px] truncate max-w-[200px]">{p.note || '—'}</td>
                      <td className="py-2 px-2 text-center">
                        {p.attachment ? (
                          <a href={p.attachment} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-red-600 hover:underline text-[11px] font-semibold">
                            📎 ເປີດ
                          </a>
                        ) : <span className="text-slate-300 text-[11px]">—</span>}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <button onClick={() => handleDeletePayment(p.id)} className="w-6 h-6 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded flex items-center justify-center" title="ລຶບ">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredPayments.length === 0 && (
                    <tr>
                      <td colSpan="8" className="text-center py-12">
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <span className="text-3xl">📭</span>
                          <p className="text-[12px]">{searchQ ? 'ບໍ່ພົບຂໍ້ມູນ' : 'ຍັງບໍ່ມີໃບຊຳລະ'}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

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
                    <div className="text-[12px] font-bold font-mono text-red-700">{fmtOriginal(showPay.remaining)}</div>
                  </div>
                </div>
              )
            })()}

            <div className="overflow-y-auto flex-1 p-3 space-y-3">
              {payments.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">ປະຫວັດການຊຳລະ</div>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {payments.map(pay => (
                      <div key={pay.id} className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          {pay.payment_number && <span className="font-semibold text-red-600 font-mono text-[10px]">{pay.payment_number}</span>}
                          <span className="font-medium text-slate-700">{formatPrice(pay.amount)}</span>
                          {methodBadge(pay.payment_method)}
                          {pay.note && <span className="text-slate-400 text-[10px]">{pay.note}</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 text-[10px]">{formatDate(pay.payment_date || pay.created_at)}</span>
                          <button onClick={() => handleDeletePayment(pay.id)} className="w-4 h-4 bg-red-100 hover:bg-red-200 text-red-500 rounded flex items-center justify-center" title="ລຶບ">
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                          </button>
                        </div>
                      </div>
                    ))}
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
                    <input type="number" required min="1" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
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
                      const remainingLAK = parseFloat(showPay.remaining)
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
                    <input type="file" accept="image/*,.pdf,.doc,.docx" onChange={e => setPayForm({ ...payForm, attachment: e.target.files[0] || null })} className="hidden" id="debt-pay-attachment"/>
                    <label htmlFor="debt-pay-attachment" className="flex items-center gap-2 px-2.5 py-2 bg-slate-50 border border-dashed border-slate-300 rounded text-[11px] cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition">
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
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"></div>
          <div className="relative bg-white rounded-2xl shadow-2xl px-8 py-6 flex flex-col items-center gap-3">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-4 border-red-100"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-red-600 animate-spin"></div>
            </div>
            <div className="text-[13px] font-semibold text-slate-700">{busyMessage}</div>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirmState && (() => {
        const v = confirmState.variant
        const theme = v === 'danger'
          ? { accent: 'from-red-500 to-rose-600', btn: 'bg-red-600 hover:bg-red-700', iconBg: 'bg-red-100', iconColor: 'text-red-600' }
          : { accent: 'from-red-500 to-red-600', btn: 'bg-red-600 hover:bg-red-700', iconBg: 'bg-red-100', iconColor: 'text-red-600' }
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={() => confirmState.onDone(false)}>
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"></div>
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className={`h-1 bg-gradient-to-r ${theme.accent}`}></div>
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`shrink-0 w-12 h-12 ${theme.iconBg} rounded-full flex items-center justify-center`}>
                    <svg className={`w-6 h-6 ${theme.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.76-2.94L13.76 4.06a2 2 0 00-3.52 0L3.31 16.06A2 2 0 005.07 19z"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[16px] text-slate-900">{confirmState.title}</h3>
                    <p className="text-[13px] text-slate-500 mt-2">{confirmState.message}</p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end mt-6">
                  <button onClick={() => confirmState.onDone(false)} className="px-5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[13px] font-semibold">{confirmState.cancelLabel}</button>
                  <button onClick={() => confirmState.onDone(true)} autoFocus className={`px-5 py-2 text-white rounded-lg text-[13px] font-bold shadow-lg ${theme.btn}`}>{confirmState.confirmLabel}</button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}