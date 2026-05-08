'use client';

import { useState, useEffect, useMemo } from 'react'

const API = '/api'
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(n || 0)
const fmtPrice = n => new Intl.NumberFormat('lo-LA').format(Math.round(n || 0)) + ' ກີບ'
const fmtCompact = n => {
  const num = Number(n) || 0
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B'
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
  return String(num)
}

export default function CashHandovers() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  const [filterDiff, setFilterDiff] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/cash-handovers?limit=500`)
      setRows(await res.json())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!confirm(`ລຶບລາຍການ #${id}?`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`${API}/cash-handovers/${id}`, { method: 'DELETE' })
      if (res.ok) await load()
      else { const e = await res.json().catch(() => ({})); alert(e.error || 'ບໍ່ສາມາດລຶບໄດ້') }
    } finally {
      setDeletingId(null)
    }
  }

  const handleReceive = async (id) => {
    const name = prompt('ຊື່ຜູ້ຮັບເງິນ (ຖ້າວ່າງຈະຮັບໃນນາມ admin):', '')
    if (name === null) return
    const res = await fetch(`${API}/cash-handovers/${id}/receive`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ received_by: name || null })
    })
    if (res.ok) load()
    else { const e = await res.json().catch(() => ({})); alert(e.error || 'ບໍ່ສາມາດຮັບເງິນໄດ້') }
  }

  const handleUnreceive = async (id) => {
    if (!confirm(`ຍົກເລີກການຮັບເງິນ #${id}?`)) return
    const res = await fetch(`${API}/cash-handovers/${id}/unreceive`, { method: 'POST' })
    if (res.ok) load()
  }

  const filtered = useMemo(() => {
    const fromTime = from ? new Date(from).setHours(0, 0, 0, 0) : null
    const toTime = to ? new Date(to).setHours(23, 59, 59, 999) : null
    return rows.filter(r => {
      const dt = new Date(r.handover_date || r.created_at).getTime()
      if (fromTime && dt < fromTime) return false
      if (toTime && dt > toTime) return false
      const q = search.toLowerCase().trim()
      if (q) {
        const hay = `${r.cashier_name || ''} ${r.received_by || ''} ${r.note || ''} ${r.id}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      const d = Number(r.diff) || 0
      if (filterDiff === 'match' && Math.abs(d) >= 1) return false
      if (filterDiff === 'over' && d <= 0) return false
      if (filterDiff === 'short' && d >= 0) return false
      if (filterStatus === 'pending' && r.received_at) return false
      if (filterStatus === 'received' && !r.received_at) return false
      return true
    })
  }, [rows, from, to, search, filterDiff, filterStatus])

  const stats = useMemo(() => {
    const today = new Date().toDateString()
    const isToday = r => new Date(r.handover_date || r.created_at).toDateString() === today
    const todayRows = rows.filter(isToday)
    const todayActual = todayRows.reduce((s, r) => s + (Number(r.actual_cash) || 0), 0)
    const todayExpected = todayRows.reduce((s, r) => s + (Number(r.expected_cash) || 0), 0)
    const totalActual = filtered.reduce((s, r) => s + (Number(r.actual_cash) || 0), 0)
    const totalExpected = filtered.reduce((s, r) => s + (Number(r.expected_cash) || 0), 0)
    const totalDiff = filtered.reduce((s, r) => s + (Number(r.diff) || 0), 0)
    const overCount = filtered.filter(r => (Number(r.diff) || 0) > 0).length
    const shortCount = filtered.filter(r => (Number(r.diff) || 0) < 0).length
    const matchCount = filtered.length - overCount - shortCount
    const pendingCount = rows.filter(r => !r.received_at).length
    const pendingAmount = rows.filter(r => !r.received_at).reduce((s, r) => s + (Number(r.actual_cash) || 0), 0)
    return { todayRows: todayRows.length, todayActual, todayExpected, totalActual, totalExpected, totalDiff, overCount, shortCount, matchCount, pendingCount, pendingAmount }
  }, [rows, filtered])

  const kpis = [
    { l: 'ລໍຮັບ', v: fmtNum(stats.pendingCount), sub: stats.pendingCount > 0 ? `${fmtCompact(stats.pendingAmount)}` : 'ບໍ່ມີ', color: stats.pendingCount > 0 ? 'amber' : 'slate' },
    { l: 'ມື້ນີ້', v: fmtNum(stats.todayRows), sub: `ສົ່ງ ${fmtCompact(stats.todayActual)}`, color: 'blue' },
    { l: 'ສົ່ງແລ້ວ', v: fmtCompact(stats.totalActual), sub: `ຄາດໄວ້ ${fmtCompact(stats.totalExpected)}`, color: 'emerald' },
    { l: 'ພໍດີ', v: fmtNum(stats.matchCount), sub: `${filtered.length > 0 ? Math.round(stats.matchCount / filtered.length * 100) : 0}%`, color: 'emerald' },
    { l: 'ເກີນ', v: fmtNum(stats.overCount), sub: stats.totalDiff > 0 ? `+${fmtCompact(Math.abs(stats.totalDiff))}` : '—', color: stats.overCount > 0 ? 'amber' : 'slate' },
    { l: 'ຂາດ', v: fmtNum(stats.shortCount), sub: stats.totalDiff < 0 ? `−${fmtCompact(Math.abs(stats.totalDiff))}` : '—', color: stats.shortCount > 0 ? 'rose' : 'slate' },
  ]
  const kpiColor = {
    blue: 'text-red-600 bg-red-50 border-red-100',
    slate: 'text-slate-700 bg-slate-50 border-slate-200',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    rose: 'text-rose-600 bg-rose-50 border-rose-100',
  }

  return (
    <div className="text-[13px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-extrabold text-slate-900">ລາຍການສົ່ງເງິນປະຈຳວັນ</h2>
          <span className="text-[11px] text-slate-400">·</span>
          <span className="text-xs text-slate-500">{fmtNum(rows.length)} ລາຍການ</span>
          {stats.pendingCount > 0 && <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-500 text-white rounded animate-pulse">⏳ {stats.pendingCount} ລໍຮັບ</span>}
          {stats.overCount > 0 && <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-50 text-amber-600 rounded">{stats.overCount} ເກີນ</span>}
          {stats.shortCount > 0 && <span className="text-[11px] font-bold px-2 py-0.5 bg-rose-50 text-rose-600 rounded">{stats.shortCount} ຂາດ</span>}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
        {kpis.map((k, i) => (
          <div key={i} className={`rounded-lg border p-3 ${kpiColor[k.color]}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{k.l}</div>
            <div className="text-xl font-extrabold mt-1 leading-tight">{k.v}</div>
            <div className="text-[10px] opacity-70 mt-0.5 truncate">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-2 mb-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" placeholder="ຄົ້ນຫາ ຊື່, ຜູ້ຮັບ, ໝາຍເຫດ..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10" />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-[10px] text-slate-500 font-bold">ຈາກ</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="px-2 py-1.5 bg-white border border-slate-200 rounded-md text-xs outline-none focus:border-red-500" />
          <label className="text-[10px] text-slate-500 font-bold ml-1">ຫາ</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="px-2 py-1.5 bg-white border border-slate-200 rounded-md text-xs outline-none focus:border-red-500" />
        </div>
        <div className="flex bg-slate-50 border border-slate-200 rounded-md overflow-hidden">
          {[
            { key: '', label: 'ທຸກສະຖານະ' },
            { key: 'pending', label: `⏳ ລໍຮັບ · ${stats.pendingCount}`, cls: 'bg-amber-500 text-white' },
            { key: 'received', label: '✓ ຮັບແລ້ວ', cls: 'bg-emerald-500 text-white' },
          ].map(s => (
            <button key={s.key} onClick={() => setFilterStatus(s.key)}
              className={`px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${filterStatus === s.key ? (s.cls || 'bg-slate-800 text-white') : 'text-slate-500 hover:bg-white'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex bg-slate-50 border border-slate-200 rounded-md overflow-hidden">
          {[
            { key: '', label: 'ທັງໝົດ' },
            { key: 'match', label: 'ພໍດີ', cls: 'bg-emerald-500 text-white' },
            { key: 'over', label: 'ເກີນ', cls: 'bg-amber-500 text-white' },
            { key: 'short', label: 'ຂາດ', cls: 'bg-rose-500 text-white' },
          ].map(s => (
            <button key={s.key} onClick={() => setFilterDiff(s.key)}
              className={`px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${filterDiff === s.key ? (s.cls || 'bg-slate-800 text-white') : 'text-slate-500 hover:bg-white'}`}>
              {s.label}
            </button>
          ))}
        </div>
        {(from || to || search || filterDiff || filterStatus) && (
          <button onClick={() => { setFrom(''); setTo(''); setSearch(''); setFilterDiff(''); setFilterStatus('') }}
            className="text-[11px] text-slate-400 hover:text-rose-500 flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            ລ້າງ
          </button>
        )}
        <span className="text-[11px] text-slate-400 font-mono ml-auto">{filtered.length}/{rows.length}</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-red-600 rounded-full animate-spin"></div>
          <p className="mt-3 text-xs text-slate-400">ກຳລັງໂຫຼດ...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-360px)] overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                  <th className="text-left py-2 px-3 w-12">#</th>
                  <th className="text-left py-2 px-3 w-32">ວັນທີ / ເວລາ</th>
                  <th className="text-left py-2 px-3">ພະນັກງານ</th>
                  <th className="text-right py-2 px-3 whitespace-nowrap">ຄາດໄວ້</th>
                  <th className="text-right py-2 px-3 whitespace-nowrap">ສົ່ງຈິງ</th>
                  <th className="text-right py-2 px-3 whitespace-nowrap">ຕ່າງ</th>
                  <th className="text-center py-2 px-3 w-28">ສະຖານະ</th>
                  <th className="text-left py-2 px-3">ຜູ້ຮັບ</th>
                  <th className="text-left py-2 px-3">ໝາຍເຫດ</th>
                  <th className="text-right py-2 px-3 w-28"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(r => {
                  const diff = Number(r.diff) || 0
                  const hasDiff = Math.abs(diff) >= 1
                  const dt = new Date(r.handover_date || r.created_at)
                  const time = new Date(r.created_at)
                  const received = !!r.received_at
                  return (
                    <tr key={r.id} className={`hover:bg-slate-50 ${!received ? 'bg-amber-50/30' : ''}`}>
                      <td className="py-1.5 px-3 font-mono text-[11px] text-slate-400">#{r.id}</td>
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-700">{dt.toLocaleDateString('lo-LA')}</div>
                        <div className="text-[10px] font-mono text-slate-400">{time.toLocaleTimeString('lo-LA', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="py-1.5 px-3 font-semibold text-slate-700">{r.cashier_name || <span className="text-slate-300">-</span>}</td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-500">{fmtPrice(r.expected_cash)}</td>
                      <td className="py-1.5 px-3 text-right font-mono font-extrabold text-emerald-700">{fmtPrice(r.actual_cash)}</td>
                      <td className="py-1.5 px-3 text-right whitespace-nowrap">
                        {hasDiff ? (
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded font-mono ${diff > 0 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                            {diff > 0 ? '▲' : '▼'} {fmtPrice(Math.abs(diff))}
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">✓ ພໍດີ</span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        {received ? (
                          <div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓ ຮັບແລ້ວ</span>
                            <div className="text-[9px] text-slate-400 font-mono mt-0.5">{new Date(r.received_at).toLocaleString('lo-LA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 animate-pulse">⏳ ລໍຮັບ</span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-slate-600">{r.received_by || <span className="text-slate-300">-</span>}</td>
                      <td className="py-1.5 px-3 text-slate-500 text-[11px] truncate max-w-[200px]">{r.note || <span className="text-slate-300">-</span>}</td>
                      <td className="py-1.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!received ? (
                            <button onClick={() => handleReceive(r.id)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold flex items-center gap-1"
                              title="ຢືນຢັນຮັບເງິນ">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                              ຮັບເງິນ
                            </button>
                          ) : (
                            <button onClick={() => handleUnreceive(r.id)}
                              className="w-6 h-6 bg-slate-100 hover:bg-amber-100 text-slate-500 hover:text-amber-700 rounded flex items-center justify-center" title="ຍົກເລີກການຮັບ">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                            </button>
                          )}
                          <button onClick={() => handleDelete(r.id)}
                            disabled={deletingId === r.id}
                            className="w-6 h-6 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 disabled:cursor-wait text-rose-600 rounded flex items-center justify-center" title="ລຶບ">
                            {deletingId === r.id
                              ? <span className="h-3 w-3 rounded-full border-2 border-rose-200 border-t-rose-600 animate-spin"></span>
                              : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan="10" className="text-center text-slate-300 py-12 text-xs">ບໍ່ມີລາຍການ</td></tr>
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot className="sticky bottom-0 bg-slate-50 border-t-2 border-slate-200">
                  <tr className="text-[11px] font-extrabold">
                    <td colSpan="3" className="py-2 px-3 text-right text-slate-500 uppercase tracking-wider">ລວມ</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">{fmtPrice(stats.totalExpected)}</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-700">{fmtPrice(stats.totalActual)}</td>
                    <td className="py-2 px-3 text-right font-mono">
                      <span className={stats.totalDiff > 0 ? 'text-amber-700' : stats.totalDiff < 0 ? 'text-rose-700' : 'text-emerald-700'}>
                        {stats.totalDiff > 0 ? '+' : ''}{fmtPrice(stats.totalDiff)}
                      </span>
                    </td>
                    <td colSpan="4"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
