'use client';


import { useState, useEffect, useMemo } from 'react'

const API = '/api'
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(n || 0)
const fmtPrice = n => fmtNum(Math.round(n || 0)) + ' ກີບ'

const PROMO_TYPES = {
  cart_percent:    { icon: '🛒', color: 'blue',    label: '% ຫຼຸດທັງບິນ',   desc: 'ຫຼຸດເປີເຊັນຂອງຍອດລວມທັງບິນ' },
  item_percent:    { icon: '🏷️', color: 'violet',  label: '% ຫຼຸດລາຍການ',   desc: 'ຫຼຸດເປີເຊັນສະເພາະສິນຄ້າ / ໝວດ / ຍີ່ຫໍ້' },
  price_override:  { icon: '💲', color: 'amber',   label: 'ລາຄາພິເສດ',      desc: 'ຕັ້ງລາຄາໃໝ່ໃຫ້ສິນຄ້າ' },
  buy_n_discount:  { icon: '📦', color: 'emerald', label: 'ຊື້ເກີນ N ຫຼຸດ %', desc: 'ຊື້ ≥ N ຊິ້ນ ຫຼຸດ %' },
  bogo:            { icon: '🎁', color: 'rose',    label: 'ຊື້ N ແຖມ M ຊິ້ນ', desc: 'ຊື້ສິນຄ້ານີ້ແຖມສິນຄ້ານີ້' },
  bogo_cross:      { icon: '🔀', color: 'cyan',    label: 'ຊື້ A ແຖມ B',    desc: 'ຊື້ສິນຄ້າໜຶ່ງ ແຖມສິນຄ້າອື່ນ' },
  bundle_gift:     { icon: '🎀', color: 'pink',    label: 'ຊື້ຊຸດຄົບ N ແຖມ', desc: 'ຊື້ສິນຄ້າໃນຊຸດຄົບ N ຊິ້ນ ແຖມສິນຄ້າ' },
}

const typeColor = {
  blue: 'text-red-600 bg-red-50 border-red-100',
  violet: 'text-violet-600 bg-violet-50 border-violet-100',
  amber: 'text-amber-600 bg-amber-50 border-amber-100',
  emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  rose: 'text-rose-600 bg-rose-50 border-rose-100',
  cyan: 'text-cyan-600 bg-cyan-50 border-cyan-100',
  pink: 'text-pink-600 bg-pink-50 border-pink-100',
  slate: 'text-slate-700 bg-slate-50 border-slate-200',
}
const typeBadge = {
  blue: 'bg-red-500 text-white',
  violet: 'bg-violet-500 text-white',
  amber: 'bg-amber-500 text-white',
  emerald: 'bg-emerald-500 text-white',
  rose: 'bg-rose-500 text-white',
  cyan: 'bg-cyan-500 text-white',
  pink: 'bg-pink-500 text-white',
}

const DAYS = ['ອາ', 'ຈ', 'ຄ', 'ພ', 'ພຫ', 'ສຸ', 'ສ']

const emptyForm = {
  name: '', description: '',
  type: 'cart_percent',
  value: '',
  buy_qty: '', get_qty: '',
  min_purchase: '',
  scope: 'all', scope_ids: [],
  start_date: '', end_date: '',
  start_time: '', end_time: '',
  days_of_week: [],
  priority: 0, max_uses: '',
  stackable: true, active: true,
  gift_product_id: '',
}

function describeRule(p) {
  const v = Number(p.value) || 0
  switch (p.type) {
    case 'cart_percent':
      return `ຫຼຸດ ${v}% ທັງບິນ${p.min_purchase > 0 ? ` (ຂັ້ນຕ່ຳ ${fmtPrice(p.min_purchase)})` : ''}`
    case 'cart_fixed':
    case 'percent':
      return p.type === 'percent' ? `ຫຼຸດ ${v}%` : `ຫຼຸດ ${fmtPrice(v)} ທັງບິນ`
    case 'item_percent': return `ຫຼຸດ ${v}% ຕໍ່ລາຍການ`
    case 'item_fixed':
    case 'fixed': return `ຫຼຸດ ${fmtPrice(v)} ຕໍ່ຊິ້ນ`
    case 'price_override': return `ລາຄາພິເສດ ${fmtPrice(v)}`
    case 'buy_n_discount': return `ຊື້ ≥${p.buy_qty} ຊິ້ນ ຫຼຸດ ${v}%`
    case 'bogo': return `ຊື້ ${p.buy_qty} ຊິ້ນ → ແຖມ ${p.get_qty} ຊິ້ນ (ສິນຄ້າດຽວກັນ)`
    case 'bogo_cross': return `ຊື້ ${p.buy_qty} ຊິ້ນ → ແຖມ ${p.get_qty} ຊິ້ນ (ສິນຄ້າຕ່າງກັນ)`
    case 'bundle_gift': return `ຊື້ຊຸດຄົບ ${p.buy_qty} ຊິ້ນ → ແຖມ ${p.get_qty} ຊິ້ນ`
    default: return p.type
  }
}

function scopeChips(p, products, categories, brands) {
  if (p.scope === 'all' || !p.scope) return [{ label: 'ທຸກສິນຄ້າ', tint: 'bg-slate-100 text-slate-600' }]
  const ids = Array.isArray(p.scope_ids) ? p.scope_ids : []
  if (p.scope === 'product') {
    const names = ids.map(id => products.find(x => x.id === Number(id))?.product_name).filter(Boolean)
    return names.slice(0, 3).map(n => ({ label: n, tint: 'bg-red-50 text-red-700 border-red-100' }))
      .concat(names.length > 3 ? [{ label: `+${names.length - 3}`, tint: 'bg-slate-100 text-slate-500' }] : [])
  }
  if (p.scope === 'category') return ids.slice(0, 4).map(c => ({ label: c, tint: 'bg-violet-50 text-violet-700 border-violet-100' }))
  if (p.scope === 'brand') return ids.slice(0, 4).map(b => ({ label: b, tint: 'bg-blue-50 text-blue-700 border-blue-100' }))
  return []
}

function hasValidTime(t) {
  if (!t) return false
  const s = String(t).slice(0, 5)
  return s !== '00:00' && s !== ''
}

function describeScope(p, products, categories, brands) {
  if (p.scope === 'all' || !p.scope) return 'ທຸກສິນຄ້າ'
  const ids = Array.isArray(p.scope_ids) ? p.scope_ids : []
  if (p.scope === 'product') {
    const names = ids.map(id => products.find(x => x.id === Number(id))?.product_name).filter(Boolean)
    return `ສິນຄ້າ: ${names.slice(0, 2).join(', ') || '—'}${names.length > 2 ? ` +${names.length - 2}` : ''}`
  }
  if (p.scope === 'category') return `ໝວດ: ${ids.slice(0, 2).join(', ') || '—'}${ids.length > 2 ? ` +${ids.length - 2}` : ''}`
  if (p.scope === 'brand') return `ຍີ່ຫໍ້: ${ids.slice(0, 2).join(', ') || '—'}${ids.length > 2 ? ` +${ids.length - 2}` : ''}`
  return ''
}

export default function Promotions() {
  const [promotions, setPromotions] = useState([])
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const load = () => {
    fetch(`${API}/admin/promotions`).then(r => r.json()).then(setPromotions)
    fetch(`${API}/admin/products`).then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : []))
    fetch(`${API}/admin/categories`).then(r => r.json()).then(d => setCategories(Array.isArray(d) ? d.map(c => c.name || c) : []))
    fetch(`${API}/admin/brands`).then(r => r.json()).then(d => setBrands(Array.isArray(d) ? d.map(b => b.name || b) : []))
  }
  useEffect(() => { load() }, [])

  const resetForm = () => { setForm(emptyForm); setEditing(null); setShowForm(false) }

  const openEdit = (p) => {
    setForm({
      name: p.name || '',
      description: p.description || '',
      type: p.type || 'cart_percent',
      value: p.value || '',
      buy_qty: p.buy_qty || '',
      get_qty: p.get_qty || '',
      min_purchase: p.min_purchase || '',
      scope: p.scope || 'all',
      scope_ids: Array.isArray(p.scope_ids) ? p.scope_ids : [],
      start_date: p.start_date ? p.start_date.split('T')[0] : '',
      end_date: p.end_date ? p.end_date.split('T')[0] : '',
      start_time: p.start_time || '',
      end_time: p.end_time || '',
      days_of_week: Array.isArray(p.days_of_week) ? p.days_of_week : [],
      priority: p.priority || 0,
      max_uses: p.max_uses || '',
      stackable: p.stackable !== false,
      active: p.active !== false,
      gift_product_id: p.gift_product_id || '',
    })
    setEditing(p.id)
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    if (!form.name.trim()) { alert('ກະລຸນາໃສ່ຊື່ໂປຣໂມຊັ່ນ'); return }
    const url = editing ? `${API}/admin/promotions/${editing}` : `${API}/admin/promotions`
    const body = {
      ...form,
      value: Number(form.value) || 0,
      buy_qty: Number(form.buy_qty) || 0,
      get_qty: Number(form.get_qty) || 0,
      min_purchase: Number(form.min_purchase) || 0,
      priority: Number(form.priority) || 0,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      scope_ids: form.scope === 'product'
        ? form.scope_ids.map(Number).filter(x => !Number.isNaN(x))
        : form.scope_ids,
      gift_product_id: form.gift_product_id ? Number(form.gift_product_id) : null,
    }
    const res = await fetch(url, {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) { load(); resetForm() } else { const err = await res.json(); alert(err.error || 'ເກີດຂໍ້ຜິດພາດ') }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`ລຶບ "${name}"?`)) return
    await fetch(`${API}/admin/promotions/${id}`, { method: 'DELETE' })
    load()
  }

  const toggleActive = async (p) => {
    await fetch(`${API}/admin/promotions/${p.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...p, active: !p.active }),
    })
    load()
  }

  const today = new Date().toISOString().split('T')[0]
  const isExpired = (p) => p.end_date && String(p.end_date).split('T')[0] < today

  const filtered = useMemo(() => {
    return promotions.filter(p => {
      const matchSearch = !search ||
        (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(search.toLowerCase())
      const matchType = !filterType || p.type === filterType
      const expired = isExpired(p)
      const matchStatus =
        !filterStatus ||
        (filterStatus === 'active' && p.active && !expired) ||
        (filterStatus === 'inactive' && !p.active) ||
        (filterStatus === 'expired' && expired)
      return matchSearch && matchType && matchStatus
    })
  }, [promotions, search, filterType, filterStatus])

  const stats = useMemo(() => {
    const activeCount = promotions.filter(p => p.active && !isExpired(p)).length
    const expiredCount = promotions.filter(p => isExpired(p)).length
    const inactiveCount = promotions.filter(p => !p.active).length
    const byType = {}
    for (const t of Object.keys(PROMO_TYPES)) byType[t] = promotions.filter(p => p.type === t).length
    return { activeCount, expiredCount, inactiveCount, byType }
  }, [promotions])

  const kpis = [
    { l: 'ທັງໝົດ', v: fmtNum(promotions.length), sub: `ເປີດ ${stats.activeCount} · ໝົດ ${stats.expiredCount}`, color: 'blue' },
    ...Object.entries(PROMO_TYPES).map(([key, t]) => ({
      l: t.label, v: fmtNum(stats.byType[key] || 0), sub: t.desc, color: t.color,
    })),
  ]

  const inputCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10 transition-all"
  const labelCls = "block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider"

  const scopeOptions = form.scope === 'product' ? products.map(p => ({ value: p.id, label: `${p.product_name}${p.product_code ? ` (${p.product_code})` : ''}` }))
    : form.scope === 'category' ? categories.map(c => ({ value: c, label: c }))
    : form.scope === 'brand' ? brands.map(b => ({ value: b, label: b }))
    : []

  const toggleScopeId = (id) => {
    const ids = form.scope_ids.map(String).includes(String(id))
      ? form.scope_ids.filter(x => String(x) !== String(id))
      : [...form.scope_ids, id]
    setForm({ ...form, scope_ids: ids })
  }

  const t = PROMO_TYPES[form.type] || PROMO_TYPES.cart_percent

  return (
    <div className="text-[13px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-extrabold text-slate-900">ໂປຣໂມຊັ່ນ</h2>
          <span className="text-[11px] text-slate-400">·</span>
          <span className="text-xs text-slate-500">{fmtNum(promotions.length)} ລາຍການ</span>
          {stats.activeCount > 0 && <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded">{stats.activeCount} ເປີດ</span>}
          {stats.expiredCount > 0 && <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded">{stats.expiredCount} ໝົດ</span>}
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }}
          className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
          ເພີ່ມໂປຣໂມຊັ່ນ
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
        {kpis.map((k, i) => (
          <div key={i} className={`rounded-lg border p-3 ${typeColor[k.color]}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-70 truncate">{k.l}</div>
            <div className="text-xl font-extrabold mt-1 leading-tight">{k.v}</div>
            <div className="text-[10px] opacity-70 mt-0.5 truncate">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-2 mb-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" placeholder="ຄົ້ນຫາຊື່..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs outline-none focus:border-red-500" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-2 py-1.5 bg-white border border-slate-200 rounded-md text-xs outline-none cursor-pointer">
          <option value="">ທຸກປະເພດ</option>
          {Object.entries(PROMO_TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        <div className="flex bg-slate-50 border border-slate-200 rounded-md overflow-hidden">
          {[
            { key: '', label: 'ທັງໝົດ' },
            { key: 'active', label: `ເປີດ · ${stats.activeCount}`, cls: 'bg-emerald-500 text-white' },
            { key: 'inactive', label: `ປິດ · ${stats.inactiveCount}`, cls: 'bg-slate-600 text-white' },
            { key: 'expired', label: `ໝົດ · ${stats.expiredCount}`, cls: 'bg-rose-500 text-white' },
          ].map(s => (
            <button key={s.key} onClick={() => setFilterStatus(s.key)}
              className={`px-2.5 py-1.5 text-[11px] font-semibold ${filterStatus === s.key ? (s.cls || 'bg-slate-800 text-white') : 'text-slate-500 hover:bg-white'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-slate-400 font-mono ml-auto">{filtered.length}/{promotions.length}</span>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.map(p => {
          const meta = PROMO_TYPES[p.type] || { icon: '🎯', color: 'slate', label: p.type }
          const expired = isExpired(p)
          const inactive = !p.active || expired
          const chips = scopeChips(p, products, categories, brands)
          const giftProduct = p.gift_product_id ? products.find(x => x.id === Number(p.gift_product_id)) : null
          const showTime = hasValidTime(p.start_time) || hasValidTime(p.end_time)
          const isCross = p.type === 'bogo_cross' || p.type === 'bundle_gift'

          return (
            <div key={p.id}
              className={`bg-white border rounded-lg hover:shadow-sm transition-all ${inactive ? 'opacity-60 border-slate-200' : 'border-slate-200'}`}>
              {/* Top row: icon + name + type + actions */}
              <div className="flex items-start gap-3 p-3">
                <div className={`w-11 h-11 rounded-lg flex items-center justify-center text-xl shrink-0 ${typeBadge[meta.color] || 'bg-slate-500 text-white'}`}>
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-slate-900">{p.name}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${typeColor[meta.color] || typeColor.slate}`}>
                      {meta.icon} {meta.label}
                    </span>
                    {expired && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">ໝົດອາຍຸ</span>}
                    {p.priority > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">P{p.priority}</span>}
                    {p.stackable === false && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Exclusive</span>}
                    {p.max_uses && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">🎯 {p.used_count || 0}/{p.max_uses}</span>}
                  </div>
                  {p.description && <div className="text-[11px] text-slate-500 italic mt-0.5">{p.description}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleActive(p)}
                    className={`w-10 h-5 rounded-full flex items-center px-0.5 transition-colors ${p.active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    title={p.active ? 'ປິດ' : 'ເປີດ'}>
                    <span className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${p.active ? 'translate-x-5' : 'translate-x-0'}`}></span>
                  </button>
                  <button onClick={() => openEdit(p)}
                    className="w-7 h-7 bg-red-50 hover:bg-red-100 text-red-600 rounded flex items-center justify-center" title="ແກ້ໄຂ">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button onClick={() => handleDelete(p.id, p.name)}
                    className="w-7 h-7 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded flex items-center justify-center" title="ລຶບ">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                  </button>
                </div>
              </div>

              {/* Rule & products panel */}
              <div className="px-3 pb-2 -mt-1">
                <div className={`rounded-md p-2.5 ${isCross ? 'bg-gradient-to-r from-slate-50 via-slate-50 to-emerald-50 border border-slate-100' : 'bg-slate-50 border border-slate-100'}`}>
                  <div className="flex items-start gap-3">
                    {/* Trigger side */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">
                        {isCross ? '🛒 ຊື້' : '📦 ຂອບເຂດ'}
                      </div>
                      <div className="text-[12px] font-bold text-slate-800 mb-1">{describeRule(p)}</div>
                      <div className="flex flex-wrap gap-1">
                        {chips.length > 0 ? chips.map((c, i) => (
                          <span key={i} className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${c.tint}`}>{c.label}</span>
                        )) : (
                          <span className="text-[10px] text-slate-400">ບໍ່ໄດ້ກຳນົດ</span>
                        )}
                      </div>
                    </div>
                    {/* Arrow */}
                    {isCross && (
                      <div className="flex items-center justify-center pt-4 shrink-0">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500">
                          <path d="M5 12h14M13 5l7 7-7 7"/>
                        </svg>
                      </div>
                    )}
                    {/* Gift side */}
                    {isCross && (
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-widest mb-1">🎁 ແຖມຟຣີ</div>
                        {giftProduct ? (
                          <div className="bg-emerald-100 border border-emerald-200 rounded px-2 py-1.5">
                            <div className="text-[11px] font-extrabold text-emerald-800 truncate">{giftProduct.product_name}</div>
                            {giftProduct.product_code && <div className="text-[9px] font-mono text-emerald-600">{giftProduct.product_code}</div>}
                            <div className="text-[10px] text-emerald-700 mt-0.5">× {p.get_qty} ຊິ້ນ</div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-rose-500">⚠ ຍັງບໍ່ໄດ້ເລືອກສິນຄ້າແຖມ</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Schedule row */}
              {((p.start_date || p.end_date) || showTime || (Array.isArray(p.days_of_week) && p.days_of_week.length > 0 && p.days_of_week.length < 7)) && (
                <div className="px-3 pb-3 flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
                  {(p.start_date || p.end_date) && (
                    <span className="inline-flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                      {p.start_date ? new Date(p.start_date).toLocaleDateString('lo-LA') : '—'} → {p.end_date ? new Date(p.end_date).toLocaleDateString('lo-LA') : '—'}
                    </span>
                  )}
                  {showTime && (
                    <span className="inline-flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                      🕐 {(p.start_time || '').slice(0, 5)}–{(p.end_time || '').slice(0, 5)}
                    </span>
                  )}
                  {Array.isArray(p.days_of_week) && p.days_of_week.length > 0 && p.days_of_week.length < 7 && (
                    <span className="inline-flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                      📆 {p.days_of_week.map(d => DAYS[d]).join(' · ')}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
            <div className="text-3xl mb-2">🎁</div>
            <div className="text-slate-400 text-sm">{promotions.length === 0 ? 'ຍັງບໍ່ມີໂປຣໂມຊັ່ນ' : 'ບໍ່ພົບຜົນຕາມການຄົ້ນຫາ'}</div>
          </div>
        )}
      </div>

      {/* Form slide-in */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={resetForm}>
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" />
          <div className="relative w-[640px] max-w-full h-full bg-white shadow-[-8px_0_30px_rgba(0,0,0,0.12)] flex flex-col text-[13px]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg ${typeBadge[t.color]}`}>{t.icon}</div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">{editing ? 'ແກ້ໄຂໂປຣໂມຊັ່ນ' : 'ເພີ່ມໂປຣໂມຊັ່ນໃໝ່'}</h2>
                  <p className="text-[11px] text-slate-400">{t.label}</p>
                </div>
              </div>
              <button onClick={resetForm} className="w-7 h-7 bg-white hover:bg-red-50 hover:text-red-500 border border-slate-200 rounded flex items-center justify-center text-slate-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Type picker */}
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                  <span className="w-5 h-5 bg-red-500 text-white rounded text-[10px] font-bold flex items-center justify-center">1</span>
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">ປະເພດໂປຣໂມຊັ່ນ</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(PROMO_TYPES).map(([k, v]) => {
                    const active = form.type === k
                    return (
                      <button key={k} type="button" onClick={() => setForm({ ...form, type: k })}
                        className={`text-left p-2.5 rounded-lg border-2 transition-all ${active ? `${typeColor[v.color]} border-current` : 'bg-slate-50 border-slate-200 hover:border-slate-400'}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{v.icon}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold">{v.label}</div>
                            <div className="text-[10px] opacity-70 truncate">{v.desc}</div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Basic info */}
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                  <span className="w-5 h-5 bg-slate-600 text-white rounded text-[10px] font-bold flex items-center justify-center">2</span>
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">ຂໍ້ມູນພື້ນຖານ</h3>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className={labelCls}>ຊື່ <span className="text-red-400">*</span></label>
                    <input type="text" required value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      placeholder="ເຊັ່ນ: ຫຼຸດ 10% ທໍ່ PVC"
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>ລາຍລະອຽດ</label>
                    <input type="text" value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
                      placeholder="ລາຍລະອຽດເພີ່ມເຕີມ..."
                      className={inputCls} />
                  </div>
                </div>
              </div>

              {/* Rule (type-specific) */}
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                  <span className={`w-5 h-5 ${typeBadge[t.color]} rounded text-[10px] font-bold flex items-center justify-center`}>3</span>
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">ເງື່ອນໄຂການຫຼຸດ</h3>
                </div>

                {(form.type === 'cart_percent' || form.type === 'item_percent') && (
                  <div>
                    <label className={labelCls}>ເປີເຊັນຫຼຸດ (%) <span className="text-red-400">*</span></label>
                    <div className="relative">
                      <input type="number" required min="0" max="100" step="0.01" value={form.value}
                        onChange={e => setForm({ ...form, value: e.target.value })}
                        placeholder="10" className={inputCls + ' pr-8'} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                    </div>
                  </div>
                )}

                {form.type === 'price_override' && (
                  <div>
                    <label className={labelCls}>ລາຄາພິເສດ (ກີບ) <span className="text-red-400">*</span></label>
                    <input type="number" required min="0" value={form.value}
                      onChange={e => setForm({ ...form, value: e.target.value })}
                      placeholder="10000" className={inputCls} />
                    <p className="text-[10px] text-amber-600 mt-1">⚠ ລາຄາຂາຍຈະຖືກແທນດ້ວຍລາຄານີ້ສຳລັບສິນຄ້າໃນ scope</p>
                  </div>
                )}

                {form.type === 'buy_n_discount' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>ຊື້ຢ່າງໜ້ອຍ (ຊິ້ນ) <span className="text-red-400">*</span></label>
                      <input type="number" required min="1" value={form.buy_qty}
                        onChange={e => setForm({ ...form, buy_qty: e.target.value })}
                        placeholder="3" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>ຫຼຸດ (%) <span className="text-red-400">*</span></label>
                      <input type="number" required min="0" max="100" value={form.value}
                        onChange={e => setForm({ ...form, value: e.target.value })}
                        placeholder="10" className={inputCls} />
                    </div>
                  </div>
                )}

                {form.type === 'bogo' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>ຊື້ (ຊິ້ນ) <span className="text-red-400">*</span></label>
                      <input type="number" required min="1" value={form.buy_qty}
                        onChange={e => setForm({ ...form, buy_qty: e.target.value })}
                        placeholder="1" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>ແຖມຟຣີ (ຊິ້ນ) <span className="text-red-400">*</span></label>
                      <input type="number" required min="1" value={form.get_qty}
                        onChange={e => setForm({ ...form, get_qty: e.target.value })}
                        placeholder="1" className={inputCls} />
                    </div>
                  </div>
                )}

                {form.type === 'bogo_cross' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>ຊື້ A (ຊິ້ນ) <span className="text-red-400">*</span></label>
                        <input type="number" required min="1" value={form.buy_qty}
                          onChange={e => setForm({ ...form, buy_qty: e.target.value })}
                          placeholder="1" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>ແຖມ B ຈຳນວນ (ຊິ້ນ) <span className="text-red-400">*</span></label>
                        <input type="number" required min="1" value={form.get_qty}
                          onChange={e => setForm({ ...form, get_qty: e.target.value })}
                          placeholder="1" className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>ສິນຄ້າແຖມ (B) <span className="text-red-400">*</span></label>
                      <select required value={form.gift_product_id}
                        onChange={e => setForm({ ...form, gift_product_id: e.target.value })}
                        className={inputCls}>
                        <option value="">-- ເລືອກສິນຄ້າແຖມ --</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.product_name}{p.product_code ? ` (${p.product_code})` : ''}</option>)}
                      </select>
                    </div>
                    <p className="text-[10px] text-cyan-700 bg-cyan-50 border border-cyan-200 rounded p-2">
                      💡 ລູກຄ້າຕ້ອງມີ <b>A</b> ໃນ cart ≥ {form.buy_qty || '?'} ຊິ້ນ ຈຶ່ງຈະໄດ້ <b>B</b> ແຖມຟຣີ {form.get_qty || '?'} ຊິ້ນ.
                      A = ເລືອກໃນ "ຂອບເຂດ" ຂ້າງລຸ່ມ (scope=ສິນຄ້າ)
                    </p>
                  </div>
                )}

                {form.type === 'bundle_gift' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>ຄົບ N ຊິ້ນ (ລວມໃນຊຸດ) <span className="text-red-400">*</span></label>
                        <input type="number" required min="1" value={form.buy_qty}
                          onChange={e => setForm({ ...form, buy_qty: e.target.value })}
                          placeholder="3" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>ແຖມ (ຊິ້ນ) <span className="text-red-400">*</span></label>
                        <input type="number" required min="1" value={form.get_qty}
                          onChange={e => setForm({ ...form, get_qty: e.target.value })}
                          placeholder="1" className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>ສິນຄ້າແຖມ <span className="text-red-400">*</span></label>
                      <select required value={form.gift_product_id}
                        onChange={e => setForm({ ...form, gift_product_id: e.target.value })}
                        className={inputCls}>
                        <option value="">-- ເລືອກສິນຄ້າແຖມ --</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.product_name}{p.product_code ? ` (${p.product_code})` : ''}</option>)}
                      </select>
                    </div>
                    <p className="text-[10px] text-pink-700 bg-pink-50 border border-pink-200 rounded p-2">
                      💡 ລູກຄ້າຊື້ສິນຄ້າໃດກໍ່ໄດ້ຈາກ "ຂອບເຂດ" (A,B,C...) ລວມກັນຄົບ {form.buy_qty || '?'} ຊິ້ນ → ໄດ້ແຖມຟຣີ {form.get_qty || '?'} ຊິ້ນ.
                      ເລືອກສິນຄ້າໃນຊຸດຜ່ານ "ຂອບເຂດ" ດ້ານລຸ່ມ
                    </p>
                  </div>
                )}

                {form.type === 'cart_percent' && (
                  <div className="mt-2">
                    <label className={labelCls}>ຍອດຂັ້ນຕ່ຳ (ຖ້າມີ)</label>
                    <input type="number" min="0" value={form.min_purchase}
                      onChange={e => setForm({ ...form, min_purchase: e.target.value })}
                      placeholder="500000" className={inputCls} />
                  </div>
                )}
              </div>

              {/* Scope */}
              {form.type !== 'cart_percent' && (
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                    <span className="w-5 h-5 bg-violet-500 text-white rounded text-[10px] font-bold flex items-center justify-center">4</span>
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">ຂອບເຂດ (ໃຊ້ກັບສິນຄ້າໃດ)</h3>
                  </div>
                  <div className="flex gap-1.5 mb-2">
                    {[
                      { key: 'all', label: 'ທຸກສິນຄ້າ' },
                      { key: 'product', label: 'ສິນຄ້າ' },
                      { key: 'category', label: 'ໝວດ' },
                      { key: 'brand', label: 'ຍີ່ຫໍ້' },
                    ].filter(o => form.type !== 'price_override' || o.key === 'product').map(o => (
                      <button key={o.key} type="button"
                        onClick={() => setForm({ ...form, scope: o.key, scope_ids: [] })}
                        className={`flex-1 py-1.5 rounded text-[11px] font-bold border transition ${
                          form.scope === o.key ? 'bg-violet-500 text-white border-violet-500' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                        }`}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {form.scope !== 'all' && scopeOptions.length > 0 && (
                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded p-2 space-y-1">
                      {scopeOptions.map(o => {
                        const checked = form.scope_ids.map(String).includes(String(o.value))
                        return (
                          <label key={o.value}
                            className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs ${checked ? 'bg-violet-50 text-violet-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}>
                            <input type="checkbox" checked={checked}
                              onChange={() => toggleScopeId(o.value)} className="accent-violet-500" />
                            <span className="truncate">{o.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                  {form.scope !== 'all' && form.scope_ids.length > 0 && (
                    <div className="text-[10px] text-slate-500 mt-1">ເລືອກແລ້ວ: {form.scope_ids.length}</div>
                  )}
                </div>
              )}

              {/* Schedule */}
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                  <span className="w-5 h-5 bg-amber-500 text-white rounded text-[10px] font-bold flex items-center justify-center">5</span>
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">ຕາຕະລາງເວລາ</h3>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>ວັນເລີ່ມ</label>
                      <input type="date" value={form.start_date}
                        onChange={e => setForm({ ...form, start_date: e.target.value })}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>ວັນສິ້ນສຸດ</label>
                      <input type="date" value={form.end_date}
                        onChange={e => setForm({ ...form, end_date: e.target.value })}
                        className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>ເວລາເລີ່ມ</label>
                      <input type="time" value={form.start_time}
                        onChange={e => setForm({ ...form, start_time: e.target.value })}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>ເວລາສິ້ນສຸດ</label>
                      <input type="time" value={form.end_time}
                        onChange={e => setForm({ ...form, end_time: e.target.value })}
                        className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>ວັນໃນອາທິດ (ຫາຍ: ທຸກວັນ)</label>
                    <div className="flex gap-1">
                      {DAYS.map((d, idx) => {
                        const active = form.days_of_week.includes(idx)
                        return (
                          <button key={idx} type="button"
                            onClick={() => setForm({
                              ...form,
                              days_of_week: active ? form.days_of_week.filter(x => x !== idx) : [...form.days_of_week, idx],
                            })}
                            className={`flex-1 h-8 rounded text-[11px] font-extrabold ${active ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                            {d}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Policy */}
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                  <span className="w-5 h-5 bg-emerald-500 text-white rounded text-[10px] font-bold flex items-center justify-center">6</span>
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">ນະໂຍບາຍ</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>ຄວາມສຳຄັນ (priority)</label>
                    <input type="number" value={form.priority}
                      onChange={e => setForm({ ...form, priority: e.target.value })}
                      placeholder="0" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>ຈຳນວນຄັ້ງຫຼາຍສຸດ</label>
                    <input type="number" value={form.max_uses}
                      onChange={e => setForm({ ...form, max_uses: e.target.value })}
                      placeholder="∞" className={inputCls} />
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.stackable}
                      onChange={e => setForm({ ...form, stackable: e.target.checked })}
                      className="accent-red-500" />
                    <span className="text-xs font-bold text-slate-700">ນຳໃຊ້ຄູ່ກັບໂປຣອື່ນໄດ້</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.active}
                      onChange={e => setForm({ ...form, active: e.target.checked })}
                      className="accent-emerald-500" />
                    <span className="text-xs font-bold text-slate-700">ເປີດໃຊ້ງານ</span>
                  </label>
                </div>
              </div>
            </form>

            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex gap-2">
              <button type="button" onClick={resetForm}
                className="flex-1 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100">
                ຍົກເລີກ
              </button>
              <button onClick={handleSubmit}
                className="flex-[2] py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold">
                {editing ? '💾 ບັນທຶກ' : '✨ ເພີ່ມ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}