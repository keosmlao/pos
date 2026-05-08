'use client';


import { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'

const API = '/api'
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(n || 0)
const fmtCompact = n => {
  const num = Number(n) || 0
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B'
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
  return String(num)
}

export default function Pricing() {
  const [products, setProducts] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ cost_price: '', selling_price: '' })
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterMargin, setFilterMargin] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [perPage, setPerPage] = useState(30)
  const [page, setPage] = useState(1)
  const [uploading, setUploading] = useState(false)
  const [historyFor, setHistoryFor] = useState(null)
  const [historyRows, setHistoryRows] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showRecent, setShowRecent] = useState(false)
  const [recentRows, setRecentRows] = useState([])

  const load = () => { fetch(`${API}/admin/pricing`).then(r => r.json()).then(setProducts) }
  useEffect(() => { load() }, [])

  const openHistory = async (p) => {
    setHistoryFor(p)
    setHistoryLoading(true)
    setHistoryRows([])
    try {
      const res = await fetch(`${API}/admin/pricing/${p.id}/history`)
      setHistoryRows(await res.json())
    } catch (e) { console.error(e) }
    finally { setHistoryLoading(false) }
  }

  const openRecent = async () => {
    setShowRecent(true)
    setHistoryLoading(true)
    setRecentRows([])
    try {
      const res = await fetch(`${API}/admin/pricing/history?limit=300`)
      setRecentRows(await res.json())
    } catch (e) { console.error(e) }
    finally { setHistoryLoading(false) }
  }

  const downloadTemplate = () => {
    const rows = products.map(p => ({
      id: p.id,
      product_code: p.product_code || '',
      barcode: p.barcode || '',
      product_name: p.product_name,
      category: p.category || '',
      unit: p.unit || '',
      cost_price: Number(p.cost_price) || 0,
      selling_price: Number(p.selling_price) || 0,
    }))
    const ws = XLSX.utils.json_to_sheet(rows, {
      header: ['id', 'product_code', 'barcode', 'product_name', 'category', 'unit', 'cost_price', 'selling_price']
    })
    ws['!cols'] = [
      { wch: 6 }, { wch: 14 }, { wch: 18 }, { wch: 38 }, { wch: 16 },
      { wch: 10 }, { wch: 14 }, { wch: 14 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Pricing')
    XLSX.writeFile(wb, `pricing_template_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const handleUpload = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      if (!sheet) { alert('ບໍ່ພົບ sheet ໃນໄຟລ໌'); return }
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true })
      if (rows.length === 0) { alert('ໄຟລ໌ບໍ່ມີຂໍ້ມູນ'); return }
      const norm = (k) => String(k || '').trim().toLowerCase().replace(/\s+/g, '_')
      const updates = []
      for (const r of rows) {
        const map = {}
        for (const k of Object.keys(r)) map[norm(k)] = r[k]
        const id = map.id ? Number(map.id) : null
        const code = map.product_code ? String(map.product_code).trim() : null
        const cost = Number(String(map.cost_price ?? '').toString().replace(/,/g, '').trim())
        const sell = Number(String(map.selling_price ?? '').toString().replace(/,/g, '').trim())
        if (!isFinite(cost) || !isFinite(sell)) continue
        if (!id && !code) continue
        const entry = { cost_price: cost, selling_price: sell }
        if (id) entry.id = id
        if (code) entry.product_code = code
        updates.push(entry)
      }
      if (updates.length === 0) {
        alert('ບໍ່ພົບຂໍ້ມູນທີ່ໃຊ້ໄດ້\nຕ້ອງມີຄໍລຳ: id ຫຼື product_code + cost_price + selling_price')
        return
      }
      const res = await fetch(`${API}/admin/pricing/bulk`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      })
      if (!res.ok) { const e = await res.json(); alert(e.error || 'ເກີດຂໍ້ຜິດພາດ'); return }
      const data = await res.json()
      alert(`ອັບໂຫລດສຳເລັດ\nອັບເດດ: ${data.updated}\nບໍ່ພົບ: ${data.notFound}\nຂ້າມ: ${data.skipped}\nລວມ: ${data.total}`)
      load()
    } catch (err) {
      alert('ອ່ານໄຟລ໌ບໍ່ໄດ້: ' + err.message)
    } finally { setUploading(false) }
  }

  const openEdit = (p) => { setEditing(p.id); setForm({ cost_price: p.cost_price || '', selling_price: p.selling_price || '' }) }
  const handleSave = async () => {
    const res = await fetch(`${API}/admin/pricing/${editing}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cost_price: Number(form.cost_price) || 0, selling_price: Number(form.selling_price) || 0 })
    })
    if (res.ok) { load(); setEditing(null) } else { const err = await res.json(); alert(err.error) }
  }

  const calcMarginPct = (cost, sell) => {
    const c = Number(cost), s = Number(sell)
    if (!c || c <= 0) return null
    return ((s - c) / c) * 100
  }
  const calcProfit = (cost, sell) => {
    const c = Number(cost) || 0, s = Number(sell) || 0
    return s - c
  }

  const distinctCats = useMemo(() => [...new Set(products.map(p => p.category).filter(Boolean))], [products])

  const filtered = useMemo(() => {
    let items = products.filter(p => {
      const q = search.toLowerCase().trim()
      const normalizedQ = q.replace(/\s+/g, '')
      const matchSearch = !q ||
        (p.product_name || '').toLowerCase().includes(q) ||
        (p.product_code || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().replace(/\s+/g, '').includes(normalizedQ)
      const matchCat = !filterCat || p.category === filterCat
      const m = calcMarginPct(p.cost_price, p.selling_price)
      const matchMargin =
        !filterMargin ||
        (filterMargin === 'missing' && (!p.cost_price || !p.selling_price)) ||
        (filterMargin === 'loss' && m !== null && m < 0) ||
        (filterMargin === 'low' && m !== null && m >= 0 && m < 10) ||
        (filterMargin === 'good' && m !== null && m >= 10 && m < 30) ||
        (filterMargin === 'high' && m !== null && m >= 30)
      return matchSearch && matchCat && matchMargin
    })
    items.sort((a, b) => {
      switch (sortBy) {
        case 'name': return (a.product_name || '').localeCompare(b.product_name || '')
        case 'margin_desc': {
          const ma = calcMarginPct(a.cost_price, a.selling_price) ?? -Infinity
          const mb = calcMarginPct(b.cost_price, b.selling_price) ?? -Infinity
          return mb - ma
        }
        case 'margin_asc': {
          const ma = calcMarginPct(a.cost_price, a.selling_price) ?? Infinity
          const mb = calcMarginPct(b.cost_price, b.selling_price) ?? Infinity
          return ma - mb
        }
        case 'sell_desc': return (Number(b.selling_price) || 0) - (Number(a.selling_price) || 0)
        case 'sell_asc': return (Number(a.selling_price) || 0) - (Number(b.selling_price) || 0)
        default: return 0
      }
    })
    return items
  }, [products, search, filterCat, filterMargin, sortBy])

  const totalPages = Math.ceil(filtered.length / perPage) || 1
  const paged = filtered.slice((page - 1) * perPage, page * perPage)
  useEffect(() => { setPage(1) }, [search, filterCat, filterMargin, perPage])

  const stats = useMemo(() => {
    let missing = 0, loss = 0, low = 0, good = 0, high = 0
    let sumMargin = 0, cntMargin = 0
    for (const p of products) {
      if (!p.cost_price || !p.selling_price) { missing++; continue }
      const m = calcMarginPct(p.cost_price, p.selling_price)
      if (m === null) { missing++; continue }
      sumMargin += m; cntMargin++
      if (m < 0) loss++
      else if (m < 10) low++
      else if (m < 30) good++
      else high++
    }
    return {
      missing, loss, low, good, high,
      avgMargin: cntMargin > 0 ? sumMargin / cntMargin : 0,
      priced: products.length - missing,
    }
  }, [products])

  const kpis = [
    { l: 'ສິນຄ້າທັງໝົດ', v: fmtNum(products.length), sub: `ຕັ້ງລາຄາແລ້ວ ${fmtNum(stats.priced)}`, color: 'blue' },
    { l: 'ຍັງບໍ່ຄົບ', v: fmtNum(stats.missing), sub: stats.missing > 0 ? 'ຂາດລາຄາຊື້/ຂາຍ' : 'ຄົບທຸກລາຍການ', color: stats.missing > 0 ? 'amber' : 'slate' },
    { l: 'ຂາດທຶນ', v: fmtNum(stats.loss), sub: stats.loss > 0 ? 'ຂາຍ < ຊື້' : 'ບໍ່ມີ', color: stats.loss > 0 ? 'rose' : 'slate' },
    { l: 'ກຳໄລຕ່ຳ <10%', v: fmtNum(stats.low), sub: 'ຄວນພິຈາລະນາ', color: 'amber' },
    { l: 'ກຳໄລພໍໃຊ້ <30%', v: fmtNum(stats.good), sub: '10 ~ 30%', color: 'emerald' },
    { l: 'ກຳໄລສູງ ≥30%', v: fmtNum(stats.high), sub: `ສະເລ່ຍລວມ ${stats.avgMargin.toFixed(1)}%`, color: 'violet' },
  ]
  const kpiColor = {
    blue: 'text-red-600 bg-red-50 border-red-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    rose: 'text-rose-600 bg-rose-50 border-rose-100',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    violet: 'text-violet-600 bg-violet-50 border-violet-100',
    slate: 'text-slate-700 bg-slate-50 border-slate-200',
  }

  return (
    <div className="text-[13px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-extrabold text-slate-900">ກຳນົດລາຄາຂາຍ</h2>
          <span className="text-[11px] text-slate-400">·</span>
          <span className="text-xs text-slate-500">{fmtNum(products.length)} ລາຍການ</span>
          {stats.missing > 0 && <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-50 text-amber-600 rounded">{stats.missing} ບໍ່ຄົບ</span>}
          {stats.loss > 0 && <span className="text-[11px] font-bold px-2 py-0.5 bg-rose-50 text-rose-600 rounded">{stats.loss} ຂາດທຶນ</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openRecent}
            className="px-3 py-1.5 bg-white hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/></svg>
            ປະຫວັດລາຄາ
          </button>
          <button onClick={downloadTemplate} disabled={products.length === 0}
            className="px-3 py-1.5 bg-white hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 disabled:opacity-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            ດາວໂຫຼດ Template
          </button>
          <label className={`px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${uploading ? 'opacity-60 cursor-wait' : ''}`}>
            {uploading ? (
              <>
                <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                ກຳລັງອັບໂຫຼດ...
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                ອັບໂຫຼດລາຄາ
              </>
            )}
            <input type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={e => { handleUpload(e.target.files[0]); e.target.value = '' }}
              className="hidden" disabled={uploading} />
          </label>
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
        <div className="relative flex-1 min-w-[240px]">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" placeholder="ຄົ້ນຫາຊື່, ລະຫັດ ຫຼື barcode..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10" />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className={`px-2 py-1.5 rounded-md text-xs font-medium border outline-none cursor-pointer ${filterCat ? 'bg-violet-50 border-violet-300 text-violet-700' : 'bg-white border-slate-200 text-slate-600'}`}>
          <option value="">ທຸກໝວດ</option>
          {distinctCats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex bg-slate-50 border border-slate-200 rounded-md overflow-hidden">
          {[
            { key: '', label: 'ທັງໝົດ' },
            { key: 'missing', label: `ບໍ່ຄົບ · ${stats.missing}`, cls: 'bg-amber-500 text-white' },
            { key: 'loss', label: `ຂາດທຶນ · ${stats.loss}`, cls: 'bg-rose-500 text-white' },
            { key: 'low', label: `ຕ່ຳ · ${stats.low}`, cls: 'bg-amber-500 text-white' },
            { key: 'good', label: `ດີ · ${stats.good}`, cls: 'bg-emerald-500 text-white' },
            { key: 'high', label: `ສູງ · ${stats.high}`, cls: 'bg-violet-500 text-white' },
          ].map(s => (
            <button key={s.key} onClick={() => setFilterMargin(s.key)}
              className={`px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${filterMargin === s.key ? (s.cls || 'bg-slate-800 text-white') : 'text-slate-500 hover:bg-white'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="px-2 py-1.5 bg-white border border-slate-200 rounded-md text-xs outline-none cursor-pointer">
          <option value="name">ຊື່ A-Z</option>
          <option value="margin_desc">ກຳໄລສູງ→ຕ່ຳ</option>
          <option value="margin_asc">ກຳໄລຕ່ຳ→ສູງ</option>
          <option value="sell_desc">ລາຄາສູງ→ຕ່ຳ</option>
          <option value="sell_asc">ລາຄາຕ່ຳ→ສູງ</option>
        </select>
        <select value={perPage} onChange={e => setPerPage(Number(e.target.value))}
          className="px-2 py-1.5 bg-white border border-slate-200 rounded-md text-xs outline-none cursor-pointer">
          <option value={20}>20</option>
          <option value={30}>30</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <span className="text-[11px] text-slate-400 font-mono ml-auto">{filtered.length}/{products.length}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-340px)] overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                <th className="text-left py-2 px-3 w-12">#</th>
                <th className="text-left py-2 px-3 whitespace-nowrap">ລະຫັດ</th>
                <th className="text-left py-2 px-3 whitespace-nowrap">Barcode</th>
                <th className="text-left py-2 px-3">ສິນຄ້າ</th>
                <th className="text-left py-2 px-3 w-28">ໝວດ</th>
                <th className="text-right py-2 px-3 whitespace-nowrap">ລາຄາຊື້</th>
                <th className="text-right py-2 px-3 whitespace-nowrap">ລາຄາຂາຍ</th>
                <th className="text-right py-2 px-3 whitespace-nowrap">ກຳໄລ/ໜ່ວຍ</th>
                <th className="text-right py-2 px-3 w-24">Margin %</th>
                <th className="text-right py-2 px-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.map((p, i) => {
                const isEditing = editing === p.id
                const cost = isEditing ? Number(form.cost_price) : Number(p.cost_price)
                const sell = isEditing ? Number(form.selling_price) : Number(p.selling_price)
                const margin = calcMarginPct(cost, sell)
                const profit = calcProfit(cost, sell)
                const marginColor =
                  margin === null ? 'text-slate-300' :
                  margin < 0 ? 'bg-rose-100 text-rose-700' :
                  margin < 10 ? 'bg-amber-100 text-amber-700' :
                  margin < 30 ? 'bg-emerald-100 text-emerald-700' :
                  'bg-violet-100 text-violet-700'
                return (
                  <tr key={p.id} className="group hover:bg-red-50/30">
                    <td className="py-1.5 px-3 font-mono text-[11px] text-slate-300">{(page - 1) * perPage + i + 1}</td>
                    <td className="py-1.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">{p.product_code || <span className="text-slate-300">-</span>}</td>
                    <td className="py-1.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">{p.barcode || <span className="text-slate-300">-</span>}</td>
                    <td className="py-1.5 px-3 font-semibold text-slate-800 truncate max-w-[280px]">{p.product_name}</td>
                    <td className="py-1.5 px-3 text-slate-500 truncate">{p.category || <span className="text-slate-300">-</span>}</td>
                    {isEditing ? (
                      <>
                        <td className="py-1 px-3 text-right">
                          <input type="number" value={form.cost_price}
                            onChange={e => setForm({ ...form, cost_price: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(null) }}
                            autoFocus
                            className="w-24 px-2 py-1 bg-red-50 border border-red-400 rounded text-right font-mono text-[12px] outline-none focus:ring-2 focus:ring-red-500/20" />
                        </td>
                        <td className="py-1 px-3 text-right">
                          <input type="number" value={form.selling_price}
                            onChange={e => setForm({ ...form, selling_price: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(null) }}
                            className="w-24 px-2 py-1 bg-red-50 border border-red-400 rounded text-right font-mono text-[12px] outline-none focus:ring-2 focus:ring-red-500/20" />
                        </td>
                        <td className={`py-1.5 px-3 text-right font-mono ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {profit !== 0 ? fmtNum(profit) : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded ${marginColor}`}>
                            {margin !== null ? `${margin.toFixed(1)}%` : '-'}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={handleSave}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold">
                              ✓ ບັນທຶກ
                            </button>
                            <button onClick={() => setEditing(null)}
                              className="w-6 h-6 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded flex items-center justify-center">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-1.5 px-3 text-right font-mono text-slate-500 whitespace-nowrap">
                          {p.cost_price > 0 ? fmtNum(p.cost_price) : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-red-600 whitespace-nowrap">
                          {p.selling_price > 0 ? fmtNum(p.selling_price) : <span className="text-slate-300">-</span>}
                        </td>
                        <td className={`py-1.5 px-3 text-right font-mono whitespace-nowrap ${profit > 0 ? 'text-emerald-600 font-semibold' : profit < 0 ? 'text-rose-600 font-semibold' : 'text-slate-300'}`}>
                          {cost > 0 && sell > 0 ? fmtNum(profit) : '-'}
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          {margin !== null ? (
                            <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded ${marginColor}`}>
                              {margin.toFixed(1)}%
                            </span>
                          ) : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openHistory(p)}
                              className="w-6 h-6 bg-violet-50 hover:bg-violet-100 text-violet-600 rounded flex items-center justify-center" title="ປະຫວັດລາຄາ">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/></svg>
                            </button>
                            <button onClick={() => openEdit(p)}
                              className="px-2 py-0.5 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[11px] font-bold">
                              ແກ້ໄຂ
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
              {paged.length === 0 && (
                <tr><td colSpan="10" className="text-center text-slate-300 py-12 text-xs">
                  {search || filterCat || filterMargin ? 'ບໍ່ພົບຂໍ້ມູນ' : 'ຍັງບໍ່ມີສິນຄ້າ'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Product price history panel */}
        {historyFor && (
          <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setHistoryFor(null)}>
            <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" />
            <div className="relative w-[520px] h-full bg-white shadow-[-8px_0_30px_rgba(0,0,0,0.1)] flex flex-col text-[13px]" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ປະຫວັດລາຄາ</div>
                  <h3 className="text-sm font-extrabold text-slate-900 truncate">{historyFor.product_name}</h3>
                  {historyFor.product_code && <div className="text-[11px] font-mono text-slate-400">{historyFor.product_code}</div>}
                </div>
                <button onClick={() => setHistoryFor(null)}
                  className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded flex items-center justify-center text-slate-500">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ລາຄາຊື້ປັດຈຸບັນ</div>
                    <div className="text-base font-extrabold font-mono text-slate-700 mt-0.5">{historyFor.cost_price > 0 ? fmtNum(historyFor.cost_price) : '-'}</div>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-lg p-2.5">
                    <div className="text-[10px] font-bold text-red-500 uppercase tracking-wider">ລາຄາຂາຍປັດຈຸບັນ</div>
                    <div className="text-base font-extrabold font-mono text-red-700 mt-0.5">{historyFor.selling_price > 0 ? fmtNum(historyFor.selling_price) : '-'}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ການປ່ຽນແປງ</div>
                  <span className="text-[10px] text-slate-400 font-mono">{historyRows.length} ຄັ້ງ</span>
                </div>

                {historyLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-violet-600 rounded-full animate-spin"></div>
                  </div>
                ) : historyRows.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center text-xs text-slate-400">
                    ຍັງບໍ່ມີການປ່ຽນແປງລາຄາ
                  </div>
                ) : (
                  <div className="space-y-2">
                    {historyRows.map((h, i) => {
                      const costBefore = Number(h.cost_price_before) || 0
                      const costAfter = Number(h.cost_price_after) || 0
                      const sellBefore = Number(h.selling_price_before) || 0
                      const sellAfter = Number(h.selling_price_after) || 0
                      const costChanged = costBefore !== costAfter
                      const sellChanged = sellBefore !== sellAfter
                      const dt = new Date(h.changed_at)
                      return (
                        <div key={h.id} className="bg-white border border-slate-200 rounded-lg p-3 text-[12px]">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {i === 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded">ລ່າສຸດ</span>}
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded uppercase">{h.source || 'manual'}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {dt.toLocaleDateString('lo-LA')} {String(dt.getHours()).padStart(2, '0')}:{String(dt.getMinutes()).padStart(2, '0')}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className={`rounded p-2 ${costChanged ? 'bg-amber-50 border border-amber-100' : 'bg-slate-50 border border-slate-100'}`}>
                              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">ລາຄາຊື້</div>
                              <div className="flex items-baseline gap-1.5 font-mono text-[11px]">
                                <span className="text-slate-400 line-through">{fmtNum(costBefore)}</span>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={costChanged ? 'text-amber-600' : 'text-slate-300'}><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                                <span className={`font-bold ${costChanged ? 'text-amber-700' : 'text-slate-500'}`}>{fmtNum(costAfter)}</span>
                              </div>
                              {costChanged && costBefore > 0 && (
                                <div className={`text-[10px] font-mono mt-0.5 ${costAfter > costBefore ? 'text-rose-600' : 'text-emerald-600'}`}>
                                  {costAfter > costBefore ? '▲' : '▼'} {Math.abs(((costAfter - costBefore) / costBefore) * 100).toFixed(1)}%
                                </div>
                              )}
                            </div>
                            <div className={`rounded p-2 ${sellChanged ? 'bg-red-50 border border-red-100' : 'bg-slate-50 border border-slate-100'}`}>
                              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">ລາຄາຂາຍ</div>
                              <div className="flex items-baseline gap-1.5 font-mono text-[11px]">
                                <span className="text-slate-400 line-through">{fmtNum(sellBefore)}</span>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={sellChanged ? 'text-red-600' : 'text-slate-300'}><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                                <span className={`font-bold ${sellChanged ? 'text-red-700' : 'text-slate-500'}`}>{fmtNum(sellAfter)}</span>
                              </div>
                              {sellChanged && sellBefore > 0 && (
                                <div className={`text-[10px] font-mono mt-0.5 ${sellAfter > sellBefore ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {sellAfter > sellBefore ? '▲' : '▼'} {Math.abs(((sellAfter - sellBefore) / sellBefore) * 100).toFixed(1)}%
                                </div>
                              )}
                            </div>
                          </div>
                          {h.note && <div className="mt-2 text-[11px] text-slate-500 italic">"{h.note}"</div>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recent history modal */}
        {showRecent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowRecent(false)}>
            <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" />
            <div className="relative w-full max-w-5xl max-h-[88vh] bg-white rounded-lg shadow-xl flex flex-col text-[13px]" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/></svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">ປະຫວັດລາຄາ (ລ່າສຸດ)</h3>
                    <p className="text-[11px] text-slate-400">ການປ່ຽນລາຄາທັງໝົດຂອງລະບົບ · {recentRows.length} ລາຍການ</p>
                  </div>
                </div>
                <button onClick={() => setShowRecent(false)}
                  className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded flex items-center justify-center text-slate-500">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-slate-200 border-t-violet-600 rounded-full animate-spin"></div>
                  </div>
                ) : recentRows.length === 0 ? (
                  <div className="text-center py-20 text-slate-400 text-xs">ຍັງບໍ່ມີປະຫວັດ</div>
                ) : (
                  <table className="w-full text-[12px]">
                    <thead className="sticky top-0 bg-slate-50 z-10">
                      <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                        <th className="text-left py-2 px-3 w-36">ເວລາ</th>
                        <th className="text-left py-2 px-3 w-24">ລະຫັດ</th>
                        <th className="text-left py-2 px-3">ສິນຄ້າ</th>
                        <th className="text-right py-2 px-3 whitespace-nowrap">ລາຄາຊື້</th>
                        <th className="text-right py-2 px-3 whitespace-nowrap">ລາຄາຂາຍ</th>
                        <th className="text-center py-2 px-3 w-20">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentRows.map(h => {
                        const costB = Number(h.cost_price_before) || 0
                        const costA = Number(h.cost_price_after) || 0
                        const sellB = Number(h.selling_price_before) || 0
                        const sellA = Number(h.selling_price_after) || 0
                        const costDiff = costA - costB
                        const sellDiff = sellA - sellB
                        const dt = new Date(h.changed_at)
                        return (
                          <tr key={h.id} className="hover:bg-slate-50">
                            <td className="py-1.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {dt.toLocaleDateString('lo-LA')} {String(dt.getHours()).padStart(2, '0')}:{String(dt.getMinutes()).padStart(2, '0')}
                            </td>
                            <td className="py-1.5 px-3 font-mono text-[11px] text-slate-600">{h.product_code || '-'}</td>
                            <td className="py-1.5 px-3 font-semibold text-slate-800 truncate max-w-[280px]">{h.product_name || '-'}</td>
                            <td className="py-1.5 px-3 text-right whitespace-nowrap">
                              {costDiff !== 0 ? (
                                <div className="flex items-center justify-end gap-1.5 font-mono text-[11px]">
                                  <span className="text-slate-400">{fmtNum(costB)}</span>
                                  <span className={costDiff > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                                    {costDiff > 0 ? '→' : '→'} {fmtNum(costA)}
                                  </span>
                                </div>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="py-1.5 px-3 text-right whitespace-nowrap">
                              {sellDiff !== 0 ? (
                                <div className="flex items-center justify-end gap-1.5 font-mono text-[11px]">
                                  <span className="text-slate-400">{fmtNum(sellB)}</span>
                                  <span className={sellDiff > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                    → {fmtNum(sellA)}
                                  </span>
                                </div>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="py-1.5 px-3 text-center">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded uppercase">{h.source || 'manual'}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pagination */}
        {filtered.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 bg-slate-50 text-[11px]">
            <div className="text-slate-400 font-mono">
              {(page - 1) * perPage + 1}-{Math.min(page * perPage, filtered.length)} / {filtered.length}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={page === 1}
                className="w-7 h-7 border border-slate-200 bg-white rounded hover:bg-slate-50 disabled:opacity-30 flex items-center justify-center">«</button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-7 h-7 border border-slate-200 bg-white rounded hover:bg-slate-50 disabled:opacity-30 flex items-center justify-center">‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce((acc, p, i, arr) => { if (i > 0 && p - arr[i - 1] > 1) acc.push('...'); acc.push(p); return acc }, [])
                .map((p, i) =>
                  p === '...' ? <span key={`d${i}`} className="px-1 text-slate-300">...</span> :
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded font-semibold ${page === p ? 'bg-red-600 text-white' : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-600'}`}>{p}</button>
                )}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="w-7 h-7 border border-slate-200 bg-white rounded hover:bg-slate-50 disabled:opacity-30 flex items-center justify-center">›</button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                className="w-7 h-7 border border-slate-200 bg-white rounded hover:bg-slate-50 disabled:opacity-30 flex items-center justify-center">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
