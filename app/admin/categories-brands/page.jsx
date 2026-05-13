'use client';


import { useState, useEffect, useMemo } from 'react'
import { AdminHero } from '@/components/admin/ui/AdminHero'

const API = '/api'
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(n)

const TABS = [
  { key: 'categories', label: 'ໝວດໝູ່', color: 'violet' },
  { key: 'brands', label: 'ຍີ່ຫໍ້', color: 'blue' },
  { key: 'units', label: 'ຫົວໜ່ວຍ', color: 'emerald' },
]

const kpiColors = {
  violet: 'text-violet-600 bg-violet-50 border-violet-100',
  blue: 'text-red-600 bg-red-50 border-red-100',
  emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  slate: 'text-slate-700 bg-slate-50 border-slate-200',
}
const kpiRing = {
  violet: 'ring-2 ring-offset-1 ring-violet-400 shadow-sm',
  blue: 'ring-2 ring-offset-1 ring-red-400 shadow-sm',
  emerald: 'ring-2 ring-offset-1 ring-emerald-400 shadow-sm',
  slate: 'ring-2 ring-offset-1 ring-slate-400 shadow-sm',
}
const tabActive = {
  violet: 'bg-violet-600 text-white shadow-sm',
  blue: 'bg-red-600 text-white shadow-sm',
  emerald: 'bg-emerald-600 text-white shadow-sm',
}
const countBadge = {
  violet: 'bg-violet-50 text-violet-700 border-violet-100',
  blue: 'bg-red-50 text-red-700 border-red-100',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
}

export default function CategoriesBrands() {
  const [tab, setTab] = useState('categories')
  const [data, setData] = useState({ categories: [], brands: [], units: [], products: [] })
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('name')
  const [sortDirection, setSortDirection] = useState('asc')

  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [addValue, setAddValue] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const endpoints = ['categories', 'brands', 'units', 'products']
      const responses = await Promise.all(endpoints.map(ep => fetch(`${API}/admin/${ep}`)))
      const [categories, brands, units, products] = await Promise.all(responses.map(r => r.json()))
      setData({ categories, brands, units, products })
    } catch (err) {
      console.error('Failed to load:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const stats = useMemo(() => {
    const counts = { categories: {}, brands: {}, units: {} }
    data.products.forEach(p => {
      if (p.category) counts.categories[p.category] = (counts.categories[p.category] || 0) + 1
      if (p.brand) counts.brands[p.brand] = (counts.brands[p.brand] || 0) + 1
      if (p.unit) counts.units[p.unit] = (counts.units[p.unit] || 0) + 1
    })
    return counts
  }, [data.products])

  const handleApi = async (method, id = null, body = null) => {
    const endpoint = id ? `${API}/admin/${tab}/${id}` : `${API}/admin/${tab}`
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      })
      if (!res.ok) throw new Error('ເກີດຂໍ້ຜິດພາດ')
      await loadData()
      return true
    } catch (e) {
      alert(e.message)
      return false
    }
  }

  const saveAdd = async () => {
    if (!addValue.trim()) { setIsAdding(false); return }
    if (await handleApi('POST', null, { name: addValue })) {
      setIsAdding(false); setAddValue('')
    }
  }

  const saveEdit = async (id) => {
    if (!editValue.trim() || editValue === data[tab].find(i => i.id === id).name) {
      setEditingId(null); return
    }
    if (await handleApi('PUT', id, { name: editValue })) setEditingId(null)
  }

  const togglePosVisible = async (id, current) => {
    try {
      const res = await fetch(`${API}/admin/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pos_visible: !current })
      })
      if (!res.ok) throw new Error('ເກີດຂໍ້ຜິດພາດ')
      await loadData()
    } catch (e) { alert(e.message) }
  }

  const remove = async (id, name) => {
    if (confirm(`ລຶບ "${name}" ແທ້ບໍ່?`)) {
      setDeleteId(id)
      const success = await handleApi('DELETE', id)
      setDeleteId(null)
      if (success) setEditingId(null)
    }
  }

  const handleSort = (field) => {
    if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDirection('asc') }
  }

  const activeInfo = TABS.find(t => t.key === tab)

  const filteredItems = useMemo(() => {
    let items = data[tab].filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    items.sort((a, b) => {
      let aVal = a[sortField], bVal = b[sortField]
      if (sortField === 'id') { aVal = parseInt(aVal); bVal = parseInt(bVal) }
      if (sortField === 'count') { aVal = stats[tab][a.name] || 0; bVal = stats[tab][b.name] || 0 }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
    return items
  }, [data, tab, search, sortField, sortDirection, stats])

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage)
  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  useEffect(() => { setCurrentPage(1) }, [tab, search])

  const totalLinkedProducts = useMemo(() => {
    return Object.values(stats[tab]).reduce((s, n) => s + n, 0)
  }, [stats, tab])

  const unusedCount = data[tab].filter(i => !(stats[tab][i.name] || 0)).length

  const kpis = [
    { l: 'ໝວດໝູ່', v: fmtNum(data.categories.length), sub: `ຜູກ ${fmtNum(Object.keys(stats.categories).length)} ລາຍການ`, color: 'violet', key: 'categories' },
    { l: 'ຍີ່ຫໍ້', v: fmtNum(data.brands.length), sub: `ຜູກ ${fmtNum(Object.keys(stats.brands).length)} ລາຍການ`, color: 'blue', key: 'brands' },
    { l: 'ຫົວໜ່ວຍ', v: fmtNum(data.units.length), sub: `ຜູກ ${fmtNum(Object.keys(stats.units).length)} ລາຍການ`, color: 'emerald', key: 'units' },
    { l: 'ສິນຄ້າທັງໝົດ', v: fmtNum(data.products.length), sub: 'ເຊື່ອມກັບຂໍ້ມູນນີ້', color: 'slate' },
  ]

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Catalog basics"
        title="🏷 ໝວດໝູ່ / ຍີ່ຫໍ້ / ຫົວໜ່ວຍ"
        subtitle="ຂໍ້ມູນພື້ນຖານສຳລັບການຈັດການສິນຄ້າ"
        action={
          <button onClick={() => { setIsAdding(true); setAddValue(''); setEditingId(null) }}
            className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-3 text-sm font-extrabold shadow-lg shadow-red-950/20">
            + ເພີ່ມ {activeInfo.label}
          </button>
        }
      />

      <div className="bg-white border border-slate-200 rounded-lg p-2 flex items-center gap-2 flex-wrap">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" placeholder="ຄົ້ນຫາ..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 w-52 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10" />
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {kpis.map((k, i) => (
          <button
            key={i}
            onClick={() => k.key && setTab(k.key)}
            className={`rounded-lg border p-3 text-left transition-all ${kpiColors[k.color]} ${k.key === tab ? kpiRing[k.color] : k.key ? 'hover:shadow-sm' : 'cursor-default'}`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{k.l}</div>
            <div className="text-xl font-extrabold mt-1 leading-tight">{k.v}</div>
            <div className="text-[10px] opacity-70 mt-0.5 truncate">{k.sub}</div>
          </button>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-3 bg-white border border-slate-200 rounded-lg p-1">
        {TABS.map(t => {
          const isActive = tab === t.key
          const count = data[t.key].length
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setEditingId(null); setIsAdding(false); setSearch('') }}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                isActive ? tabActive[t.color] : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span>{t.label}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isActive ? 'bg-white/25' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Info bar */}
      <div className="flex items-center justify-between mb-3 text-[11px] text-slate-500">
        <div className="flex items-center gap-3">
          <span>ທັງໝົດ <span className="font-bold text-slate-700">{fmtNum(data[tab].length)}</span></span>
          <span className="text-slate-300">·</span>
          <span>ມີສິນຄ້າ <span className="font-bold text-emerald-600">{fmtNum(data[tab].length - unusedCount)}</span></span>
          <span className="text-slate-300">·</span>
          <span>ບໍ່ໄດ້ໃຊ້ <span className="font-bold text-slate-400">{fmtNum(unusedCount)}</span></span>
          <span className="text-slate-300">·</span>
          <span>ສິນຄ້າທີ່ຜູກ <span className="font-bold text-slate-700">{fmtNum(totalLinkedProducts)}</span></span>
        </div>
        {search && <span className="font-mono">ຜົນ {fmtNum(filteredItems.length)}/{fmtNum(data[tab].length)}</span>}
      </div>

      {/* Table */}
      {isLoading ? (
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
                  <th className="text-left py-2 px-3 w-16">
                    <button onClick={() => handleSort('id')} className="hover:text-slate-700 flex items-center gap-1">
                      ID {sortField === 'id' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                    </button>
                  </th>
                  <th className="text-left py-2 px-3">
                    <button onClick={() => handleSort('name')} className="hover:text-slate-700 flex items-center gap-1">
                      ຊື່ {activeInfo.label} {sortField === 'name' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                    </button>
                  </th>
                  <th className="text-right py-2 px-3 w-28">
                    <button onClick={() => handleSort('count')} className="hover:text-slate-700 flex items-center gap-1 ml-auto">
                      ຈຳນວນສິນຄ້າ {sortField === 'count' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                    </button>
                  </th>
                  {tab === 'categories' && <th className="text-center py-2 px-3 w-24">POS</th>}
                  <th className="text-right py-2 px-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Inline add row */}
                {isAdding && (
                  <tr className="bg-red-50/40">
                    <td className="py-1.5 px-3 font-mono text-[11px] text-red-600">ໃໝ່</td>
                    <td className="py-1.5 px-3" colSpan={tab === 'categories' ? 3 : 2}>
                      <input type="text" value={addValue}
                        onChange={e => setAddValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveAdd(); if (e.key === 'Escape') setIsAdding(false) }}
                        onBlur={saveAdd}
                        placeholder={`ປ້ອນຊື່ ${activeInfo.label}...`}
                        className="w-full px-2 py-1 border border-red-400 bg-white rounded text-xs outline-none focus:ring-2 focus:ring-red-500/20"
                        autoFocus />
                    </td>
                    <td className="py-1.5 px-3 text-right">
                      <button onClick={() => setIsAdding(false)}
                        className="w-6 h-6 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded flex items-center justify-center ml-auto">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </td>
                  </tr>
                )}

                {paginatedItems.map(item => {
                  const itemCount = stats[tab][item.name] || 0
                  const isDeleting = deleteId === item.id
                  const isEditing = editingId === item.id
                  return (
                    <tr key={item.id} className="group hover:bg-slate-50">
                      <td className="py-1.5 px-3 font-mono text-[11px] text-slate-400">#{item.id}</td>
                      <td className="py-1.5 px-3">
                        {isEditing ? (
                          <input type="text" value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(item.id); if (e.key === 'Escape') setEditingId(null) }}
                            onBlur={() => saveEdit(item.id)}
                            className="w-full px-2 py-1 border border-red-400 rounded text-xs outline-none focus:ring-2 focus:ring-red-500/20"
                            autoFocus />
                        ) : (
                          <span className="font-semibold text-slate-800">{item.name}</span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded font-mono border ${
                          itemCount > 0 ? countBadge[activeInfo.color] : 'bg-slate-50 text-slate-400 border-slate-100'
                        }`}>
                          {fmtNum(itemCount)}
                        </span>
                      </td>
                      {tab === 'categories' && (
                        <td className="py-1.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => togglePosVisible(item.id, item.pos_visible !== false)}
                            className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${item.pos_visible !== false ? 'bg-emerald-500' : 'bg-slate-300'}`}
                            title={item.pos_visible !== false ? 'ສະແດງໃນ POS' : 'ເຊື່ອງຈາກ POS'}
                          >
                            <span className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${item.pos_visible !== false ? 'translate-x-4' : 'translate-x-0'}`}></span>
                          </button>
                        </td>
                      )}
                      <td className="py-1.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!isEditing && (
                            <>
                              <button onClick={() => { setEditingId(item.id); setEditValue(item.name) }}
                                className="w-6 h-6 bg-red-50 hover:bg-red-100 text-red-600 rounded flex items-center justify-center" title="ແກ້ໄຂ">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button onClick={() => remove(item.id, item.name)} disabled={isDeleting}
                                className="w-6 h-6 bg-red-50 hover:bg-red-100 text-red-500 rounded flex items-center justify-center disabled:opacity-50" title="ລຶບ">
                                {isDeleting ? (
                                  <div className="w-3 h-3 border-2 border-red-300 border-t-red-600 rounded-full animate-spin"></div>
                                ) : (
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {paginatedItems.length === 0 && !isAdding && (
                  <tr>
                    <td colSpan={tab === 'categories' ? 5 : 4} className="text-center text-slate-300 py-12 text-xs">
                      {search ? `ບໍ່ພົບ "${search}"` : `ຍັງບໍ່ມີ${activeInfo.label} · ກົດ "ເພີ່ມ" ເພື່ອເລີ່ມຕົ້ນ`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredItems.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 bg-slate-50 text-[11px]">
              <div className="flex items-center gap-2">
                <select value={itemsPerPage} onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1) }}
                  className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] outline-none cursor-pointer">
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-slate-400 font-mono">
                  {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredItems.length)} / {filteredItems.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                  className="w-7 h-7 border border-slate-200 bg-white rounded hover:bg-slate-50 disabled:opacity-30 flex items-center justify-center">«</button>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="w-7 h-7 border border-slate-200 bg-white rounded hover:bg-slate-50 disabled:opacity-30 flex items-center justify-center">‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce((acc, p, i, arr) => { if (i > 0 && p - arr[i - 1] > 1) acc.push('...'); acc.push(p); return acc }, [])
                  .map((p, i) =>
                    p === '...' ? <span key={`d${i}`} className="px-1 text-slate-300">...</span> :
                    <button key={p} onClick={() => setCurrentPage(p)}
                      className={`w-7 h-7 rounded font-semibold ${currentPage === p ? 'bg-red-600 text-white' : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-600'}`}>{p}</button>
                  )}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="w-7 h-7 border border-slate-200 bg-white rounded hover:bg-slate-50 disabled:opacity-30 flex items-center justify-center">›</button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                  className="w-7 h-7 border border-slate-200 bg-white rounded hover:bg-slate-50 disabled:opacity-30 flex items-center justify-center">»</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}