'use client';


import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import SearchSelect from '@/components/SearchSelect'
import { AdminHero } from '@/components/admin/ui/AdminHero'
import { COSTING_METHODS, COSTING_METHOD_LABELS } from '@/lib/costingMethods'

const API = '/api'
const fmtPrice = p => new Intl.NumberFormat('lo-LA').format(p) + ' ກີບ'
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(n)
const fmtCompact = n => {
  const num = Number(n) || 0
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B'
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
  return String(num)
}

const emptyForm = {
  product_code: '', product_name: '', barcode: '', category: '', brand: '',
  cost_price: '', selling_price: '', qty_on_hand: '', min_stock: '5',
  unit: 'ອັນ', expiry_date: '', supplier_name: '', status: true, image_url: '',
  costing_method: '',
}

export default function Products() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [units, setUnits] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [filterStock, setFilterStock] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [viewMode, setViewMode] = useState('table')
  const [viewDetail, setViewDetail] = useState(null)
  const [movements, setMovements] = useState([])
  const [isSyncingSuppliers, setIsSyncingSuppliers] = useState(false)
  const [showSyncMenu, setShowSyncMenu] = useState(false)
  const [defaultCostingMethod, setDefaultCostingMethod] = useState('AVG')

  const openDetail = async (p) => {
    setViewDetail(p)
    const res = await fetch(`${API}/admin/products/${p.id}/movements`)
    setMovements(await res.json())
  }

  const load = () => {
    fetch(`${API}/admin/products`).then(r => r.json()).then(setProducts)
    fetch(`${API}/admin/categories`).then(r => r.json()).then(setCategories)
    fetch(`${API}/admin/brands`).then(r => r.json()).then(setBrands)
    fetch(`${API}/admin/suppliers`).then(r => r.json()).then(setSuppliers)
    fetch(`${API}/admin/units`).then(r => r.json()).then(setUnits)
    fetch(`${API}/admin/company`).then(r => r.json()).then(c => {
      if (c?.default_costing_method) setDefaultCostingMethod(c.default_costing_method)
    }).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const resetForm = () => { setForm(emptyForm); setEditing(null); setShowForm(false) }

  const openEdit = (p) => {
    setForm({
      product_code: p.product_code || '', product_name: p.product_name, barcode: p.barcode || '',
      category: p.category || '', brand: p.brand || '', cost_price: p.cost_price || '',
      selling_price: p.selling_price || '', qty_on_hand: p.qty_on_hand, min_stock: p.min_stock,
      unit: p.unit, expiry_date: p.expiry_date ? p.expiry_date.split('T')[0] : '',
      supplier_name: p.supplier_name || '', status: p.status, image_url: p.image_url || '',
      costing_method: p.costing_method || '',
    })
    setEditing(p.id); setShowForm(true)
  }

  const handleImageUpload = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('ກະລຸນາເລືອກໄຟລ໌ຮູບພາບ'); return }
    if (file.size > 5 * 1024 * 1024) { alert('ຮູບພາບຕ້ອງນ້ອຍກວ່າ 5MB'); return }
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch(`${API}/admin/uploads/product-image`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'ອັບໂຫລດບໍ່ສຳເລັດ'); return }
      setForm(f => ({ ...f, image_url: data.path }))
    } catch (err) {
      alert('ອັບໂຫລດບໍ່ສຳເລັດ')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const url = editing ? `${API}/admin/products/${editing}` : `${API}/admin/products`
    const body = { ...form, cost_price: Number(form.cost_price) || 0, selling_price: Number(form.selling_price) || 0, qty_on_hand: editing ? Number(form.qty_on_hand) || 0 : 0, min_stock: Number(form.min_stock) || 5, expiry_date: form.expiry_date || null }
    const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { load(); resetForm() } else { const err = await res.json(); alert(err.error) }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`ລຶບ "${name}"?`)) return
    const res = await fetch(`${API}/admin/products/${id}`, { method: 'DELETE' })
    if (res.ok) load(); else { const err = await res.json(); alert(err.error) }
  }

  const handleClearAll = async () => {
    if (!confirm('ຕ້ອງການລຶບສິນຄ້າທັງໝົດແທ້ບໍ? (ສິນຄ້າທີ່ຂາຍແລ້ວຈະຖືກຂ້າມ)')) return
    if (!confirm('ຢືນຢັນອີກຄັ້ງ: ການກະທຳນີ້ບໍ່ສາມາດຍ້ອນກັບໄດ້')) return
    const res = await fetch(`${API}/admin/products`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) { load(); alert(data.message || 'ລຶບສຳເລັດ') }
    else { alert(data.error || 'ບໍ່ສາມາດລຶບໄດ້') }
  }

  const handleSyncSuppliers = async (supplierId) => {
    setIsSyncingSuppliers(true)
    setShowSyncMenu(false)
    try {
      const res = await fetch(`${API}/admin/products/sync-suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplierId ? { supplier_id: supplierId } : {})
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'ບໍ່ສາມາດ sync ສິນຄ້າຈາກຜູ້ສະໜອງໄດ້'); return }
      load()
      const extra = []
      if (data.categories_added) extra.push(`ໝວດ +${data.categories_added}`)
      if (data.brands_added) extra.push(`ຍີ່ຫໍ້ +${data.brands_added}`)
      if (data.units_added) extra.push(`ຫົວໜ່ວຍ +${data.units_added}`)
      const extraStr = extra.length > 0 ? `\n(${extra.join(', ')})` : ''
      alert(`sync ສຳເລັດ: ເພີ່ມ ${data.inserted_count || 0} / ອັບເດດ ${data.updated_count || 0} ລາຍການ${extraStr}`)
    } catch (error) {
      alert('ບໍ່ສາມາດ sync ສິນຄ້າຈາກຜູ້ສະໜອງໄດ້')
    } finally { setIsSyncingSuppliers(false) }
  }

  const apiSuppliers = suppliers.filter(s => s.api_enabled && s.api_url && (
    (Array.isArray(s.api_cust_codes) && s.api_cust_codes.length > 0) || s.api_cust_code
  ))

  const addNew = async (endpoint, name) => {
    const res = await fetch(`${API}/admin/${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
    })
    if (res.ok) { load(); return true }
    const err = await res.json(); alert(err.error); return false
  }

  const filtered = products.filter(p => {
    const matchSearch = !search || p.product_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.product_code || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode || '').toLowerCase().includes(search.toLowerCase())
    const matchCat = !filterCat || p.category === filterCat
    const matchBrand = !filterBrand || p.brand === filterBrand
    const matchStock = !filterStock ||
      (filterStock === 'out' && p.qty_on_hand <= 0) ||
      (filterStock === 'low' && p.qty_on_hand > 0 && p.qty_on_hand <= p.min_stock) ||
      (filterStock === 'ok' && p.qty_on_hand > p.min_stock)
    return matchSearch && matchCat && matchBrand && matchStock
  })
  const totalPages = Math.ceil(filtered.length / perPage)
  const paged = filtered.slice((page - 1) * perPage, page * perPage)
  const resetFilters = () => { setFilterCat(''); setFilterBrand(''); setFilterStock(''); setPage(1) }
  const hasFilters = filterCat || filterBrand || filterStock

  const outCount = products.filter(p => p.qty_on_hand <= 0).length
  const lowCount = products.filter(p => p.qty_on_hand > 0 && p.qty_on_hand <= p.min_stock).length
  const okCount = products.length - outCount - lowCount
  const distinctBrands = [...new Set(products.map(p => p.brand).filter(Boolean))]
  const distinctCats = [...new Set(products.map(p => p.category).filter(Boolean))]
  const activeCount = products.filter(p => p.status).length
  const inactiveCount = products.filter(p => !p.status).length
  const totalStockValue = products.reduce((s, p) => s + (parseFloat(p.cost_price) || 0) * (parseFloat(p.qty_on_hand) || 0), 0)
  const totalRetailValue = products.reduce((s, p) => s + (parseFloat(p.selling_price) || 0) * (parseFloat(p.qty_on_hand) || 0), 0)

  const handleExportExcel = () => {
    if (filtered.length === 0) { alert('ບໍ່ມີຂໍ້ມູນສຳລັບ export'); return }
    const rows = filtered.map((p, idx) => {
      const qty = Number(p.qty_on_hand) || 0
      const minStock = Number(p.min_stock) || 0
      const cost = Number(p.cost_price) || 0
      const selling = Number(p.selling_price) || 0
      const stockStatus = qty <= 0 ? 'ໝົດສະຕ໊ອກ' : qty <= minStock ? 'ຕ່ຳກວ່າ min' : 'ປົກກະຕິ'
      const method = p.costing_method || defaultCostingMethod
      return {
        '#': idx + 1,
        'ລະຫັດສິນຄ້າ': p.product_code || '',
        'ຊື່ສິນຄ້າ': p.product_name || '',
        'Barcode': p.barcode || '',
        'ໝວດໝູ່': p.category || '',
        'ຍີ່ຫໍ້': p.brand || '',
        'ຜູ້ສະໜອງ': p.supplier_name || '',
        'ຫົວໜ່ວຍ': p.unit || '',
        'ຈຳນວນຄົງເຫຼືອ': qty,
        'ສະຕ໊ອກຕ່ຳສຸດ': minStock,
        'ສະຖານະສະຕ໊ອກ': stockStatus,
        'ລາຄາຊື້': cost,
        'ລາຄາຂາຍ': selling,
        'ມູນຄ່າຕົ້ນທຶນ': cost * qty,
        'ມູນຄ່າຂາຍ': selling * qty,
        'ວິທີຄຳນວນຕົ້ນທຶນ': COSTING_METHOD_LABELS[method] || method || '',
        'ວັນໝົດອາຍຸ': p.expiry_date ? new Date(p.expiry_date).toLocaleDateString('lo-LA') : '',
        'ສະຖານະ': p.status ? 'ເປີດ' : 'ປິດ',
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 6 }, { wch: 18 }, { wch: 34 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
      { wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 14 },
      { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 24 }, { wch: 16 }, { wch: 10 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Products')
    XLSX.writeFile(wb, `products_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const kpis = [
    { l: 'ທັງໝົດ', v: fmtNum(products.length), sub: `ເປີດ ${activeCount} · ປິດ ${inactiveCount}`, color: 'blue' },
    { l: 'ໝົດສະຕ໊ອກ', v: fmtNum(outCount), sub: 'ຕ້ອງສັ່ງຊື້ເພີ່ມ', color: 'red' },
    { l: 'ຕ່ຳກວ່າ min', v: fmtNum(lowCount), sub: 'ຄວນເຕີມສາງ', color: 'amber' },
    { l: 'ປົກກະຕິ', v: fmtNum(okCount), sub: 'ຢູ່ໃນເກນ', color: 'emerald' },
    { l: 'ໝວດ · ຍີ່ຫໍ້', v: `${fmtNum(distinctCats.length)} · ${fmtNum(distinctBrands.length)}`, sub: `${categories.length} ໝວດ · ${brands.length} ຍີ່ຫໍ້`, color: 'violet' },
    { l: 'ມູນຄ່າສາງ', v: fmtCompact(totalStockValue), sub: `ຂາຍ ${fmtCompact(totalRetailValue)}`, color: 'slate' },
  ]
  const colorMap = {
    blue: 'text-red-600 bg-red-50 border-red-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    violet: 'text-violet-600 bg-violet-50 border-violet-100',
    rose: 'text-rose-600 bg-rose-50 border-rose-100',
    red: 'text-red-600 bg-red-50 border-red-100',
    slate: 'text-slate-700 bg-slate-50 border-slate-200',
  }

  const inputCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10 transition-all placeholder:text-slate-300"
  const labelCls = "block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider"

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        allowOverflow
        tag="Products"
        title="📦 ຈັດການສິນຄ້າ"
        subtitle={`${fmtNum(products.length)} ລາຍການ${outCount > 0 ? ` · ${outCount} ໝົດ` : ''}${lowCount > 0 ? ` · ${lowCount} ຕ່ຳ` : ''}`}
        action={
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowSyncMenu(v => !v)}
              disabled={isSyncingSuppliers}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
              {isSyncingSuppliers ? 'Sync...' : 'Sync ສິນຄ້າ'}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            {showSyncMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSyncMenu(false)} />
                <div className="absolute right-0 mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">ເລືອກຜູ້ສະໜອງ</div>
                  </div>
                  {apiSuppliers.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-slate-400">ຍັງບໍ່ມີຜູ້ສະໜອງທີ່ເປີດ API</div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto">
                      <button onClick={() => handleSyncSuppliers(null)} className="w-full text-left px-3 py-2 hover:bg-red-50 border-b border-slate-100 flex items-center gap-2">
                        <span className="w-6 h-6 bg-red-100 text-red-600 rounded flex items-center justify-center text-[10px]">🌐</span>
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-slate-700">Sync ທັງໝົດ</div>
                          <div className="text-[10px] text-slate-400">{apiSuppliers.length} ຜູ້ສະໜອງ</div>
                        </div>
                      </button>
                      {apiSuppliers.map(s => {
                        const codes = Array.isArray(s.api_cust_codes) && s.api_cust_codes.length > 0 ? s.api_cust_codes : (s.api_cust_code ? [s.api_cust_code] : [])
                        const incomplete = !s.api_url || codes.length === 0
                        return (
                          <button key={s.id} onClick={() => handleSyncSuppliers(s.id)} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2">
                            <span className={`w-6 h-6 rounded flex items-center justify-center text-[10px] ${incomplete ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                              {incomplete ? '⚠' : '📦'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-slate-700 truncate">{s.name}</div>
                              <div className="text-[10px] font-mono text-slate-400 truncate">
                                {incomplete ? 'ຂາດ URL ຫຼື cust_code' : `${codes.length} ຂາ: ${codes.join(', ')}`}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <button onClick={handleExportExcel} disabled={filtered.length === 0}
            className="px-3 py-1.5 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 disabled:opacity-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8M8 9h2"/></svg>
            Excel
          </button>
          <button onClick={handleClearAll} disabled={products.length === 0}
            className="px-3 py-1.5 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            ລ້າງທັງໝົດ
          </button>
          <button onClick={() => { resetForm(); setShowForm(true) }}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            ເພີ່ມສິນຄ້າ
          </button>
        </div>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
        {kpis.map((k, i) => (
          <div key={i} className={`rounded-lg border p-3 ${colorMap[k.color]}`}>
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
          <input type="text" placeholder="ຄົ້ນຫາ ຊື່, ລະຫັດ, ບາໂຄດ..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10" />
        </div>
        <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1) }}
          className={`px-2 py-1.5 rounded-md text-xs font-medium border outline-none cursor-pointer ${filterCat ? 'bg-violet-50 border-violet-300 text-violet-700' : 'bg-white border-slate-200 text-slate-600'}`}>
          <option value="">ທຸກໝວດ</option>
          {distinctCats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterBrand} onChange={e => { setFilterBrand(e.target.value); setPage(1) }}
          className={`px-2 py-1.5 rounded-md text-xs font-medium border outline-none cursor-pointer ${filterBrand ? 'bg-red-50 border-red-300 text-red-700' : 'bg-white border-slate-200 text-slate-600'}`}>
          <option value="">ທຸກຍີ່ຫໍ້</option>
          {distinctBrands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <div className="flex bg-slate-50 border border-slate-200 rounded-md overflow-hidden">
          {[
            { key: '', label: 'ທັງໝົດ' },
            { key: 'out', label: `ໝົດ · ${outCount}`, cls: 'bg-red-500 text-white' },
            { key: 'low', label: `ຕ່ຳ · ${lowCount}`, cls: 'bg-amber-500 text-white' },
            { key: 'ok', label: `ປົກກະຕິ · ${okCount}`, cls: 'bg-emerald-500 text-white' },
          ].map(s => (
            <button key={s.key} onClick={() => { setFilterStock(s.key); setPage(1) }}
              className={`px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${filterStock === s.key ? (s.cls || 'bg-slate-800 text-white') : 'text-slate-500 hover:bg-white'}`}>
              {s.label}
            </button>
          ))}
        </div>
        {hasFilters && (
          <button onClick={resetFilters} className="text-[11px] text-slate-400 hover:text-red-500 flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            ລ້າງ
          </button>
        )}
        <button onClick={handleExportExcel} disabled={filtered.length === 0}
          className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 disabled:opacity-50 text-slate-600 border border-slate-200 rounded-md text-xs font-bold transition-all flex items-center gap-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8M8 9h2"/></svg>
          Export Excel
        </button>
        <div className="flex bg-slate-50 border border-slate-200 rounded-md overflow-hidden ml-auto">
          <button onClick={() => setViewMode('table')} className={`px-2.5 py-1.5 text-xs transition-colors ${viewMode === 'table' ? 'bg-red-600 text-white' : 'text-slate-500 hover:bg-white'}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3h18v18H3z"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
          </button>
          <button onClick={() => setViewMode('grid')} className={`px-2.5 py-1.5 text-xs transition-colors ${viewMode === 'grid' ? 'bg-red-600 text-white' : 'text-slate-500 hover:bg-white'}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </button>
        </div>
        <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1) }}
          className="px-2 py-1.5 bg-white border border-slate-200 rounded-md text-xs outline-none cursor-pointer">
          <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option>
        </select>
        <span className="text-[11px] text-slate-400 font-mono">{filtered.length}/{products.length}</span>
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-340px)] overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                  <th className="text-left py-2 px-3 w-8">#</th>
                  <th className="text-left py-2 px-3 whitespace-nowrap">ລະຫັດ</th>
                  <th className="text-left py-2 px-3">ສິນຄ້າ</th>
                  <th className="text-left py-2 px-3 w-28">ໝວດ</th>
                  <th className="text-left py-2 px-3 w-28">ຍີ່ຫໍ້</th>
                  <th className="text-right py-2 px-3 whitespace-nowrap">ລາຄາຂາຍ</th>
                  <th className="text-right py-2 px-3 whitespace-nowrap">ລາຄາຊື້</th>
                  <th className="text-center py-2 px-3 w-24">ສະຕ໊ອກ</th>
                  <th className="text-center py-2 px-3 w-20">ຂັ້ນຕ່ຳ</th>
                  <th className="text-center py-2 px-3 w-16">ສະຖານະ</th>
                  <th className="text-right py-2 px-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.map((p, i) => {
                  const stockState = p.qty_on_hand <= 0 ? 'out' : p.qty_on_hand <= p.min_stock ? 'low' : 'ok'
                  return (
                    <tr key={p.id} className="group hover:bg-red-50/30 cursor-pointer" onClick={() => openDetail(p)}>
                      <td className="py-1.5 px-3 text-slate-300 font-mono text-[11px]">{(page - 1) * perPage + i + 1}</td>
                      <td className="py-1.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">{p.product_code || <span className="text-slate-300">-</span>}</td>
                      <td className="py-1.5 px-3">
                        <div className="flex items-center gap-2">
                          {p.image_url ? (
                            <img src={p.image_url} alt="" className="w-7 h-7 rounded object-cover border border-slate-200 shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center text-slate-300 text-xs shrink-0">📦</div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800 truncate">{p.product_name}</div>
                            {p.barcode && <div className="font-mono text-[10px] text-slate-300">{p.barcode}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="py-1.5 px-3 text-slate-500 truncate">{p.category || <span className="text-slate-300">-</span>}</td>
                      <td className="py-1.5 px-3 text-slate-500 truncate">{p.brand || <span className="text-slate-300">-</span>}</td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold text-red-600 whitespace-nowrap">{p.selling_price > 0 ? fmtNum(p.selling_price) : <span className="text-slate-300">-</span>}</td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-500 whitespace-nowrap">{p.cost_price > 0 ? fmtNum(p.cost_price) : <span className="text-slate-300">-</span>}</td>
                      <td className="py-1.5 px-3 text-center">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          stockState === 'out' ? 'bg-red-100 text-red-700' :
                          stockState === 'low' ? 'bg-amber-100 text-amber-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {fmtNum(p.qty_on_hand)} {p.unit}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-center font-mono text-[11px] text-slate-500">
                        {fmtNum(p.min_stock)} <span className="text-slate-300">{p.unit}</span>
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        <span className={`inline-block w-2 h-2 rounded-full ${p.status ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                      </td>
                      <td className="py-1.5 px-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a href={`/admin/products/${p.id}/variants`} title="Variants"
                             className="w-6 h-6 bg-violet-50 hover:bg-violet-100 text-violet-600 rounded flex items-center justify-center text-[11px]">🎨</a>
                          <button onClick={() => openEdit(p)} className="w-6 h-6 bg-red-50 hover:bg-red-100 text-red-600 rounded flex items-center justify-center">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button onClick={() => handleDelete(p.id, p.product_name)} className="w-6 h-6 bg-red-50 hover:bg-red-100 text-red-500 rounded flex items-center justify-center">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {paged.length === 0 && (
                  <tr><td colSpan="11" className="text-center text-slate-300 py-12 text-xs">ບໍ່ພົບສິນຄ້າ</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
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
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {paged.map(p => {
              const stockState = p.qty_on_hand <= 0 ? 'out' : p.qty_on_hand <= p.min_stock ? 'low' : 'ok'
              return (
                <div key={p.id} onClick={() => openDetail(p)}
                  className={`bg-white rounded-lg border border-slate-200 p-2 cursor-pointer hover:border-red-300 hover:shadow-sm transition-all group ${!p.status ? 'opacity-60' : ''}`}>
                  {p.image_url ? (
                    <img src={p.image_url} alt="" className="w-full aspect-square rounded object-cover bg-slate-50 mb-2" />
                  ) : (
                    <div className="w-full aspect-square rounded bg-slate-50 flex items-center justify-center text-2xl mb-2">📦</div>
                  )}
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-mono text-[9px] text-slate-400 truncate">{p.product_code || '-'}</span>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1 ${p.status ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                  </div>
                  <div className="text-[12px] font-bold text-slate-800 leading-tight line-clamp-2 min-h-[30px]">{p.product_name}</div>
                  <div className="text-[10px] text-slate-400 mt-1 truncate">{p.category || '-'}</div>
                  <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-slate-100">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      stockState === 'out' ? 'bg-red-100 text-red-700' :
                      stockState === 'low' ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>{p.qty_on_hand} {p.unit}</span>
                    <span className="text-[11px] font-extrabold text-red-600 font-mono">{p.selling_price > 0 ? fmtCompact(p.selling_price) : '-'}</span>
                  </div>
                </div>
              )
            })}
            {paged.length === 0 && (
              <div className="col-span-full text-center text-slate-300 py-16 text-xs">ບໍ່ພົບສິນຄ້າ</div>
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center gap-1 mt-3">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-7 h-7 text-[11px] rounded font-semibold ${page === p ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-600'}`}>{p}</button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Detail Slide-in */}
      {viewDetail && !showForm && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setViewDetail(null)}>
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" />
          <div className="relative w-[480px] h-full bg-white shadow-[-8px_0_30px_rgba(0,0,0,0.1)] flex flex-col text-[13px]" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-3">
              {viewDetail.image_url ? (
                <img src={viewDetail.image_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
              ) : (
                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-xl">📦</div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-extrabold text-slate-900 truncate">{viewDetail.product_name}</h2>
                <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                  {viewDetail.product_code && <span className="font-mono text-slate-500 bg-slate-100 px-1.5 rounded">{viewDetail.product_code}</span>}
                  {viewDetail.category && <span className="text-slate-400">{viewDetail.category}</span>}
                  {viewDetail.brand && <span className="text-slate-400">· {viewDetail.brand}</span>}
                </div>
              </div>
              <button onClick={() => { setViewDetail(null); openEdit(viewDetail) }}
                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-xs font-bold">ແກ້ໄຂ</button>
              <button onClick={() => setViewDetail(null)}
                className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded flex items-center justify-center text-slate-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className={`rounded-lg p-2.5 text-center border ${
                  viewDetail.qty_on_hand <= 0 ? 'bg-red-50 border-red-100' :
                  viewDetail.qty_on_hand <= viewDetail.min_stock ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'
                }`}>
                  <div className={`text-lg font-extrabold ${
                    viewDetail.qty_on_hand <= 0 ? 'text-red-600' :
                    viewDetail.qty_on_hand <= viewDetail.min_stock ? 'text-amber-600' : 'text-emerald-600'
                  }`}>{fmtNum(viewDetail.qty_on_hand)}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">ຄົງເຫຼືອ ({viewDetail.unit})</div>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-extrabold text-red-600 font-mono">{fmtCompact(viewDetail.selling_price)}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">ລາຄາຂາຍ</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-extrabold text-slate-700 font-mono">{viewDetail.cost_price > 0 ? fmtCompact(viewDetail.cost_price) : '-'}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">ລາຄາຊື້</div>
                </div>
              </div>

              {/* Details table */}
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">ຂໍ້ມູນລາຍລະອຽດ</div>
                <table className="w-full text-[12px]">
                  <tbody className="divide-y divide-slate-100">
                    {viewDetail.barcode && (
                      <tr><td className="py-1.5 text-slate-500">ບາໂຄດ</td><td className="py-1.5 text-right font-mono text-slate-700">{viewDetail.barcode}</td></tr>
                    )}
                    <tr><td className="py-1.5 text-slate-500">ສະຕ໊ອກຕ່ຳສຸດ</td><td className="py-1.5 text-right font-mono text-slate-700">{viewDetail.min_stock} {viewDetail.unit}</td></tr>
                    <tr><td className="py-1.5 text-slate-500">ມູນຄ່າສາງ</td><td className="py-1.5 text-right font-extrabold text-red-600 font-mono">{fmtPrice((viewDetail.cost_price || 0) * (viewDetail.qty_on_hand || 0))}</td></tr>
                    <tr><td className="py-1.5 text-slate-500">ມູນຄ່າຂາຍ</td><td className="py-1.5 text-right font-extrabold text-emerald-600 font-mono">{fmtPrice((viewDetail.selling_price || 0) * (viewDetail.qty_on_hand || 0))}</td></tr>
                    {viewDetail.supplier_name && (
                      <tr><td className="py-1.5 text-slate-500">ຜູ້ສະໜອງ</td><td className="py-1.5 text-right text-slate-700">{viewDetail.supplier_name}</td></tr>
                    )}
                    <tr>
                      <td className="py-1.5 text-slate-500">ວິທີຄຳນວນຕົ້ນທຶນ</td>
                      <td className="py-1.5 text-right">
                        <span className="inline-flex items-center gap-1.5 rounded bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 border border-red-200">
                          {COSTING_METHOD_LABELS[viewDetail.costing_method || defaultCostingMethod] || (viewDetail.costing_method || defaultCostingMethod)}
                          {!viewDetail.costing_method && <span className="text-[9px] font-bold text-slate-400">(ຮ້ານ)</span>}
                        </span>
                      </td>
                    </tr>
                    {viewDetail.expiry_date && (
                      <tr><td className="py-1.5 text-slate-500">ວັນໝົດອາຍຸ</td><td className="py-1.5 text-right text-slate-700">{new Date(viewDetail.expiry_date).toLocaleDateString('lo-LA')}</td></tr>
                    )}
                    <tr><td className="py-1.5 text-slate-500">ສະຖານະ</td><td className="py-1.5 text-right">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${viewDetail.status ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {viewDetail.status ? 'ເປີດ' : 'ປິດ'}
                      </span>
                    </td></tr>
                  </tbody>
                </table>
              </div>

              {/* Movements */}
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ການເຄື່ອນໄຫວສະຕ໊ອກ</div>
                  <span className="text-[10px] text-slate-400 font-mono">{movements.length} ລາຍການ</span>
                </div>
                {movements.length === 0 ? (
                  <p className="text-center text-slate-400 text-xs py-4">ຍັງບໍ່ມີການເຄື່ອນໄຫວ</p>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-[12px]">
                      <thead className="sticky top-0 bg-white">
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                          <th className="text-left py-1">ວັນທີ</th>
                          <th className="text-left py-1">ປະເພດ</th>
                          <th className="text-right py-1">ຈຳນວນ</th>
                          <th className="text-right py-1">ລາຄາ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {movements.map((m, i) => (
                          <tr key={i}>
                            <td className="py-1 text-[11px] text-slate-500">{new Date(m.created_at).toLocaleDateString('lo-LA')}</td>
                            <td className="py-1 text-[11px]">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${m.type === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {m.type === 'in' ? '↓ ເຂົ້າ' : '↑ ອອກ'}
                              </span>
                              <div className="text-[10px] text-slate-400 mt-0.5 truncate">{m.ref_name || '-'}</div>
                            </td>
                            <td className={`py-1 text-right font-mono font-bold ${m.type === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
                              {m.type === 'in' ? '+' : '-'}{fmtNum(m.quantity)}
                            </td>
                            <td className="py-1 text-right font-mono text-slate-500 text-[11px]">{fmtCompact(m.price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={resetForm}>
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" />
          <div className="relative w-[560px] h-full bg-white shadow-[-8px_0_30px_rgba(0,0,0,0.12)] flex flex-col text-[13px]" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${editing ? 'bg-amber-100' : 'bg-red-100'}`}>
                  {editing ? '✏️' : '📦'}
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">{editing ? 'ແກ້ໄຂສິນຄ້າ' : 'ເພີ່ມສິນຄ້າໃໝ່'}</h2>
                  <p className="text-[11px] text-slate-400">{editing ? `ID #${editing}` : 'ກອກຂໍ້ມູນລາຍລະອຽດ'}</p>
                </div>
              </div>
              <button onClick={resetForm} className="w-7 h-7 bg-white hover:bg-red-50 hover:text-red-500 border border-slate-200 rounded flex items-center justify-center text-slate-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Section 1: ຂໍ້ມູນພື້ນຖານ */}
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                  <span className="w-5 h-5 bg-red-500 text-white rounded text-[10px] font-bold flex items-center justify-center">1</span>
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">ຂໍ້ມູນພື້ນຖານ</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>ຮູບພາບ</label>
                    <div className="flex items-center gap-2">
                      <label className="relative w-16 h-16 rounded-lg bg-slate-50 border-2 border-dashed border-slate-200 hover:border-red-400 cursor-pointer flex items-center justify-center overflow-hidden">
                        {form.image_url ? (
                          <img src={form.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-slate-300"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                        )}
                        <input type="file" accept="image/*" onChange={e => handleImageUpload(e.target.files[0])} className="hidden" />
                      </label>
                      <div className="flex-1 flex flex-col gap-1">
                        <label className="inline-flex cursor-pointer items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[11px] font-semibold w-fit">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                          {form.image_url ? 'ປ່ຽນ' : 'ອັບໂຫລດ'}
                          <input type="file" accept="image/*" onChange={e => handleImageUpload(e.target.files[0])} className="hidden" />
                        </label>
                        {form.image_url && (
                          <button type="button" onClick={() => setForm({ ...form, image_url: '' })} className="text-[10px] text-red-500 hover:text-red-600 font-medium w-fit">ລຶບຮູບ</button>
                        )}
                        <p className="text-[9px] text-slate-400">JPG/PNG ≤ 5MB</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>ຊື່ສິນຄ້າ <span className="text-red-400">*</span></label>
                    <input type="text" required value={form.product_name} onChange={e => setForm({ ...form, product_name: e.target.value })}
                      placeholder="ເຊັ່ນ: ທໍ່ PVC 1/2 ນິ້ວ" className={inputCls} autoFocus />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>ລະຫັດ</label>
                      <input type="text" value={form.product_code} onChange={e => setForm({ ...form, product_code: e.target.value })}
                        placeholder="PVC-001" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>ບາໂຄດ</label>
                      <input type="text" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })}
                        placeholder="8851234567890" className={inputCls} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: ການຈັດໝວດ */}
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                  <span className="w-5 h-5 bg-violet-500 text-white rounded text-[10px] font-bold flex items-center justify-center">2</span>
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">ການຈັດໝວດ</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>ໝວດໝູ່</label>
                    <SearchSelect value={form.category} onChange={val => setForm({ ...form, category: val })}
                      options={categories.map(c => ({ value: c.name, label: c.name }))} placeholder="-- ເລືອກ --"
                      onAdd={name => addNew('categories', name)} />
                  </div>
                  <div>
                    <label className={labelCls}>ຍີ່ຫໍ້</label>
                    <SearchSelect value={form.brand} onChange={val => setForm({ ...form, brand: val })}
                      options={brands.map(b => ({ value: b.name, label: b.name }))} placeholder="-- ເລືອກ --"
                      onAdd={name => addNew('brands', name)} />
                  </div>
                </div>
              </div>

              {/* Section 3: ລາຍລະອຽດ */}
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                  <span className="w-5 h-5 bg-emerald-500 text-white rounded text-[10px] font-bold flex items-center justify-center">3</span>
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">ລາຍລະອຽດ</h3>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className={labelCls}>ສະຕ໊ອກຕ່ຳສຸດ</label>
                    <input type="number" min="0" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>ຫົວໜ່ວຍ</label>
                    <SearchSelect value={form.unit} onChange={val => setForm({ ...form, unit: val })}
                      options={units.map(u => ({ value: u.name, label: u.name }))} placeholder="-- ເລືອກ --"
                      onAdd={name => addNew('units', name)} />
                  </div>
                  <div>
                    <label className={labelCls}>ວັນໝົດອາຍຸ</label>
                    <input type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} className={inputCls} />
                  </div>
                </div>
              </div>

              {/* Section 4: ຜູ້ສະໜອງ */}
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                  <span className="w-5 h-5 bg-amber-500 text-white rounded text-[10px] font-bold flex items-center justify-center">4</span>
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">ຜູ້ສະໜອງ</h3>
                </div>
                <SearchSelect value={form.supplier_name} onChange={val => setForm({ ...form, supplier_name: val })}
                  options={suppliers.map(s => ({ value: s.name, label: s.name }))} placeholder="-- ເລືອກ --"
                  onAdd={name => addNew('suppliers', name)} />
              </div>

              {/* Section 4b: ວິທີຄຳນວນຕົ້ນທຶນ */}
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                  <span className="w-5 h-5 bg-red-500 text-white rounded text-[10px] font-bold flex items-center justify-center">5</span>
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">ວິທີຄຳນວນຕົ້ນທຶນ</h3>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button type="button"
                    onClick={() => setForm({ ...form, costing_method: '' })}
                    className={`rounded-lg border p-2 text-center transition ${
                      !form.costing_method ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'
                    }`}>
                    <div className={`text-[11px] font-extrabold ${!form.costing_method ? 'text-red-700' : 'text-slate-600'}`}>ຄ່າເລີ່ມ</div>
                    <div className="text-[9px] text-slate-400">ໃຊ້ຄ່າຮ້ານ</div>
                  </button>
                  {COSTING_METHODS.map(m => {
                    const active = form.costing_method === m.value
                    return (
                      <button key={m.value} type="button"
                        onClick={() => setForm({ ...form, costing_method: m.value })}
                        className={`rounded-lg border p-2 text-center transition ${
                          active ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'
                        }`}
                        title={m.desc}>
                        <div className={`text-[11px] font-extrabold ${active ? 'text-red-700' : 'text-slate-600'}`}>{m.label}</div>
                        <div className="text-[9px] text-slate-400">{m.sub}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Section 5: Status */}
              {editing && (
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                    <span className="w-5 h-5 bg-slate-500 text-white rounded text-[10px] font-bold flex items-center justify-center">5</span>
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">ສະຖານະ</h3>
                  </div>
                  <label className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100">
                    <div className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-all ${form.status ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow transition-all ${form.status ? 'translate-x-4' : 'translate-x-0'}`}></div>
                    </div>
                    <input type="checkbox" checked={form.status} onChange={e => setForm({ ...form, status: e.target.checked })} className="hidden" />
                    <div>
                      <div className={`text-[12px] font-bold ${form.status ? 'text-emerald-700' : 'text-slate-500'}`}>{form.status ? 'ເປີດໃຊ້ງານ' : 'ປິດໃຊ້ງານ'}</div>
                      <div className="text-[10px] text-slate-400">{form.status ? 'ສະແດງໃນ POS' : 'ບໍ່ສະແດງໃນ POS'}</div>
                    </div>
                  </label>
                </div>
              )}
            </form>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex gap-2">
              <button type="button" onClick={resetForm}
                className="flex-1 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100">
                ຍົກເລີກ
              </button>
              <button onClick={handleSubmit}
                className="flex-[2] py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5">
                {editing ? (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg> ບັນທຶກ</>
                ) : (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg> ເພີ່ມສິນຄ້າ</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
