'use client';


import { useState, useEffect, useMemo } from 'react'
import { useLocations } from '@/utils/useLocations'
import SearchSelect from '@/components/SearchSelect'

const API = '/api'
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(n)

const emptyForm = {
  name: '', phone: '', province: '', district: '', village: '', address: '',
  contact_person: '', contact_phone: '', credit_days: '',
  api_enabled: false, api_url: '', api_cust_codes: [''], api_hashkey: ''
}

export default function Suppliers() {
  const laoLocations = useLocations()
  const [suppliers, setSuppliers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [contactHistory, setContactHistory] = useState([])
  const [viewDetail, setViewDetail] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const load = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`${API}/admin/suppliers`)
      setSuppliers(await res.json())
    } catch (err) { console.error(err) }
    finally { setIsLoading(false) }
  }
  useEffect(() => { load() }, [])

  const resetForm = () => {
    setForm(emptyForm); setEditing(null); setShowForm(false); setContactHistory([])
  }

  const openEdit = async (s) => {
    setForm({
      name: s.name, phone: s.phone || '',
      province: s.province || '', district: s.district || '', village: s.village || '',
      address: s.address || '',
      contact_person: s.contact_person || '', contact_phone: s.contact_phone || '',
      credit_days: s.credit_days || '',
      api_enabled: !!s.api_enabled,
      api_url: s.api_url || '',
      api_cust_codes: (() => {
        const arr = Array.isArray(s.api_cust_codes) ? s.api_cust_codes : []
        const cleaned = arr.map(c => String(c || '').trim()).filter(Boolean)
        if (cleaned.length > 0) return cleaned
        if (s.api_cust_code) return [s.api_cust_code]
        return ['']
      })(),
      api_hashkey: s.api_hashkey || ''
    })
    setEditing(s.id)
    setShowForm(true)
    try {
      const res = await fetch(`${API}/admin/suppliers/${s.id}/contacts`)
      setContactHistory(await res.json())
    } catch (err) { console.error(err) }
  }

  const openDetail = async (s) => {
    setViewDetail(s)
    try {
      const res = await fetch(`${API}/admin/suppliers/${s.id}/contacts`)
      setContactHistory(await res.json())
    } catch (err) { console.error(err) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const url = editing ? `${API}/admin/suppliers/${editing}` : `${API}/admin/suppliers`
    const method = editing ? 'PUT' : 'POST'
    const payload = {
      ...form,
      api_cust_codes: (form.api_cust_codes || []).map(c => String(c || '').trim()).filter(Boolean)
    }
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.ok) { load(); resetForm() }
      else { const err = await res.json(); alert(err.error || 'ເກີດຂໍ້ຜິດພາດ') }
    } catch (err) { alert('ເກີດຂໍ້ຜິດພາດ') }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`ລຶບ "${name}" ແທ້ບໍ່?`)) return
    try {
      const res = await fetch(`${API}/admin/suppliers/${id}`, { method: 'DELETE' })
      if (res.ok) { load(); if (viewDetail?.id === id) setViewDetail(null) }
      else { const err = await res.json(); alert(err.error || 'ບໍ່ສາມາດລຶບໄດ້') }
    } catch (err) { alert('ເກີດຂໍ້ຜິດພາດ') }
  }

  const filtered = useMemo(() => {
    return suppliers.filter(s => {
      const matchSearch = !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.phone || '').includes(search) ||
        (s.contact_person || '').toLowerCase().includes(search.toLowerCase())
      const matchType =
        !filterType ||
        (filterType === 'api' && s.api_enabled && s.api_url) ||
        (filterType === 'contact' && s.contact_person) ||
        (filterType === 'credit' && s.credit_days) ||
        (filterType === 'incomplete' && (!s.phone || !s.province))
      return matchSearch && matchType
    })
  }, [suppliers, search, filterType])

  const provinces = Object.keys(laoLocations)
  const districts = form.province ? Object.keys(laoLocations[form.province] || {}) : []
  const villages = form.province && form.district ? (laoLocations[form.province]?.[form.district] || []) : []
  const setProvince = (val) => setForm({ ...form, province: val, district: '', village: '' })
  const setDistrict = (val) => setForm({ ...form, district: val, village: '' })
  const fmtLoc = (s) => [s.village, s.district, s.province].filter(Boolean).join(', ')

  const stats = useMemo(() => ({
    total: suppliers.length,
    withContact: suppliers.filter(s => s.contact_person).length,
    withLocation: suppliers.filter(s => s.province).length,
    withApi: suppliers.filter(s => s.api_enabled && s.api_url).length,
    withCredit: suppliers.filter(s => s.credit_days).length,
    avgCredit: (() => {
      const arr = suppliers.filter(s => s.credit_days).map(s => Number(s.credit_days))
      return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
    })(),
  }), [suppliers])

  const kpis = [
    { l: 'ທັງໝົດ', v: fmtNum(stats.total), sub: `ມີເບີໂທ ${fmtNum(suppliers.filter(s => s.phone).length)}`, color: 'blue' },
    { l: 'ມີຜູ້ປະສານງານ', v: fmtNum(stats.withContact), sub: `${stats.total ? Math.round(stats.withContact / stats.total * 100) : 0}% ຂອງທັງໝົດ`, color: 'violet' },
    { l: 'ມີທີ່ຢູ່', v: fmtNum(stats.withLocation), sub: `${stats.total ? Math.round(stats.withLocation / stats.total * 100) : 0}% ຄົບທີ່ຢູ່`, color: 'emerald' },
    { l: 'ໃຫ້ສິນເຊື່ອ', v: fmtNum(stats.withCredit), sub: `ສະເລ່ຍ ${stats.avgCredit} ວັນ`, color: 'amber' },
    { l: 'API Sync', v: fmtNum(stats.withApi), sub: stats.withApi > 0 ? 'ພ້ອມໃຊ້ງານ' : 'ຍັງບໍ່ໄດ້ຕັ້ງ', color: 'cyan' },
    { l: 'ຂໍ້ມູນບໍ່ຄົບ', v: fmtNum(suppliers.filter(s => !s.phone || !s.province).length), sub: 'ຂາດເບີ/ທີ່ຢູ່', color: 'rose' },
  ]
  const colorMap = {
    blue: 'text-red-600 bg-red-50 border-red-100',
    violet: 'text-violet-600 bg-violet-50 border-violet-100',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    cyan: 'text-cyan-600 bg-cyan-50 border-cyan-100',
    rose: 'text-rose-600 bg-rose-50 border-rose-100',
  }

  const inputCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10 transition-all placeholder:text-slate-300"
  const labelCls = "block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider"

  return (
    <div className="text-[13px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-extrabold text-slate-900">ຜູ້ສະໜອງ</h2>
          <span className="text-[11px] text-slate-400">·</span>
          <span className="text-xs text-slate-500">{fmtNum(suppliers.length)} ຜູ້ສະໜອງ</span>
          {stats.withApi > 0 && <span className="text-[11px] font-bold px-2 py-0.5 bg-cyan-50 text-cyan-700 rounded">{stats.withApi} API</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { resetForm(); setShowForm(true) }}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            ເພີ່ມຜູ້ສະໜອງ
          </button>
        </div>
      </div>

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
          <input type="text" placeholder="ຄົ້ນຫາ ຊື່, ເບີໂທ, ຜູ້ປະສານງານ..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10" />
        </div>
        <div className="flex bg-slate-50 border border-slate-200 rounded-md overflow-hidden">
          {[
            { key: '', label: 'ທັງໝົດ' },
            { key: 'api', label: `API · ${stats.withApi}`, cls: 'bg-cyan-500 text-white' },
            { key: 'contact', label: `ມີຜູ້ປະສານ · ${stats.withContact}`, cls: 'bg-violet-500 text-white' },
            { key: 'credit', label: `ສິນເຊື່ອ · ${stats.withCredit}`, cls: 'bg-amber-500 text-white' },
            { key: 'incomplete', label: `ບໍ່ຄົບ · ${suppliers.filter(s => !s.phone || !s.province).length}`, cls: 'bg-rose-500 text-white' },
          ].map(s => (
            <button key={s.key} onClick={() => setFilterType(s.key)}
              className={`px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${filterType === s.key ? (s.cls || 'bg-slate-800 text-white') : 'text-slate-500 hover:bg-white'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-slate-400 font-mono ml-auto">{filtered.length}/{suppliers.length}</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-red-600 rounded-full animate-spin"></div>
          <p className="mt-3 text-xs text-slate-400">ກຳລັງໂຫຼດ...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-340px)] overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                  <th className="text-left py-2 px-3 w-12">#</th>
                  <th className="text-left py-2 px-3">ຜູ້ສະໜອງ</th>
                  <th className="text-left py-2 px-3 w-32 whitespace-nowrap">ເບີໂທ</th>
                  <th className="text-left py-2 px-3">ຜູ້ປະສານງານ</th>
                  <th className="text-center py-2 px-3 w-20 whitespace-nowrap">ສິນເຊື່ອ</th>
                  <th className="text-left py-2 px-3">ທີ່ຢູ່</th>
                  <th className="text-center py-2 px-3 w-16">API</th>
                  <th className="text-right py-2 px-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(s => (
                  <tr key={s.id} className="group hover:bg-red-50/30 cursor-pointer" onClick={() => openDetail(s)}>
                    <td className="py-1.5 px-3 font-mono text-[11px] text-slate-400">#{s.id}</td>
                    <td className="py-1.5 px-3">
                      <div className="font-semibold text-slate-800 truncate">{s.name}</div>
                    </td>
                    <td className="py-1.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {s.phone || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-1.5 px-3">
                      {s.contact_person ? (
                        <div>
                          <div className="text-slate-700 font-medium truncate">{s.contact_person}</div>
                          {s.contact_phone && <div className="text-[10px] font-mono text-slate-400">{s.contact_phone}</div>}
                        </div>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      {s.credit_days ? (
                        <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100 font-mono">
                          {s.credit_days} ວັນ
                        </span>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-1.5 px-3 text-slate-500 text-[11px] truncate max-w-[240px]">
                      {fmtLoc(s) || s.address || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      {s.api_enabled && s.api_url ? (
                        <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-700">ON</span>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-1.5 px-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(s)} className="w-6 h-6 bg-red-50 hover:bg-red-100 text-red-600 rounded flex items-center justify-center">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onClick={() => handleDelete(s.id, s.name)} className="w-6 h-6 bg-red-50 hover:bg-red-100 text-red-500 rounded flex items-center justify-center">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan="8" className="text-center text-slate-300 py-12 text-xs">
                    {search || filterType ? 'ບໍ່ພົບຂໍ້ມູນ' : 'ຍັງບໍ່ມີຜູ້ສະໜອງ · ກົດ "ເພີ່ມຜູ້ສະໜອງ"'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Slide-in Panel */}
      {viewDetail && !showForm && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setViewDetail(null)}>
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" />
          <div className="relative w-[480px] h-full bg-white shadow-[-8px_0_30px_rgba(0,0,0,0.1)] flex flex-col text-[13px]" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-red-500 to-violet-600 flex items-center justify-center text-white text-lg font-bold shrink-0">
                {viewDetail.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-extrabold text-slate-900 truncate">{viewDetail.name}</h2>
                <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                  <span className="font-mono text-slate-400">#{viewDetail.id}</span>
                  {viewDetail.phone && <><span className="text-slate-300">·</span><span className="text-slate-500 font-mono">{viewDetail.phone}</span></>}
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
              {/* Summary */}
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">ຂໍ້ມູນສະຫຼຸບ</div>
                <table className="w-full text-[12px]">
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-1.5 text-slate-500">ເບີໂທ</td>
                      <td className="py-1.5 text-right font-mono text-slate-700">{viewDetail.phone || <span className="text-slate-300">-</span>}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-slate-500">ຜູ້ປະສານງານ</td>
                      <td className="py-1.5 text-right text-slate-700">
                        {viewDetail.contact_person || <span className="text-slate-300">-</span>}
                        {viewDetail.contact_phone && <div className="text-[10px] font-mono text-slate-400">{viewDetail.contact_phone}</div>}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-slate-500">ເງື່ອນໄຂຊຳລະ</td>
                      <td className="py-1.5 text-right">
                        {viewDetail.credit_days ? (
                          <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">
                            {viewDetail.credit_days} ວັນ
                          </span>
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-slate-500">ທີ່ຢູ່</td>
                      <td className="py-1.5 text-right text-slate-700 text-[11px]">
                        {fmtLoc(viewDetail) || viewDetail.address || <span className="text-slate-300">-</span>}
                      </td>
                    </tr>
                    {viewDetail.address && fmtLoc(viewDetail) && (
                      <tr>
                        <td className="py-1.5 text-slate-500">ເພີ່ມເຕີມ</td>
                        <td className="py-1.5 text-right text-slate-500 text-[11px]">{viewDetail.address}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* API */}
              {(viewDetail.api_enabled || viewDetail.api_url) && (() => {
                const codes = Array.isArray(viewDetail.api_cust_codes) && viewDetail.api_cust_codes.length > 0
                  ? viewDetail.api_cust_codes
                  : (viewDetail.api_cust_code ? [viewDetail.api_cust_code] : [])
                return (
                  <div className="bg-white border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Supplier API</div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${viewDetail.api_enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {viewDetail.api_enabled ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    {viewDetail.api_url && codes.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] text-slate-400 font-mono">{codes.length} endpoint</div>
                        {codes.map((code, i) => (
                          <div key={i} className="font-mono text-[10px] text-slate-700 break-all bg-slate-50 border border-slate-100 rounded px-2 py-1">
                            GET {viewDetail.api_url.replace(/\/+$/, '')}/{code}{viewDetail.api_hashkey ? `?hashkey=${viewDetail.api_hashkey}` : ''}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Contact History */}
              {contactHistory.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ປະຫວັດຜູ້ປະສານງານ</div>
                    <span className="text-[10px] text-slate-400 font-mono">{contactHistory.length} ລາຍການ</span>
                  </div>
                  <div className="max-h-[240px] overflow-y-auto">
                    <table className="w-full text-[12px]">
                      <thead className="sticky top-0 bg-white">
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                          <th className="text-left py-1">ຊື່</th>
                          <th className="text-left py-1 w-24">ເບີ</th>
                          <th className="text-right py-1 w-20">ວັນທີ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {contactHistory.map((h, i) => (
                          <tr key={h.id}>
                            <td className="py-1.5 font-semibold text-slate-700">
                              {h.contact_person}
                              {i === 0 && <span className="ml-1.5 text-[9px] font-bold px-1 py-0.5 bg-violet-100 text-violet-700 rounded">ປັດຈຸບັນ</span>}
                              {h.note && <div className="text-[10px] text-slate-400 italic">"{h.note}"</div>}
                            </td>
                            <td className="py-1.5 font-mono text-[11px] text-slate-500">{h.contact_phone || '-'}</td>
                            <td className="py-1.5 text-right text-[10px] text-slate-400 font-mono">
                              {new Date(h.created_at).toLocaleDateString('lo-LA')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Form Slide-in Panel */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={resetForm}>
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" />
          <div className="relative w-[560px] h-full bg-white shadow-[-8px_0_30px_rgba(0,0,0,0.12)] flex flex-col text-[13px]" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${editing ? 'bg-amber-100' : 'bg-red-100'}`}>
                  {editing ? '✏️' : '🚚'}
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">{editing ? 'ແກ້ໄຂຜູ້ສະໜອງ' : 'ເພີ່ມຜູ້ສະໜອງໃໝ່'}</h2>
                  <p className="text-[11px] text-slate-400">{editing ? `ID #${editing}` : 'ປ້ອນຂໍ້ມູນໃຫ້ຄົບຖ້ວນ'}</p>
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
                    <label className={labelCls}>ຊື່ຜູ້ສະໜອງ <span className="text-red-400">*</span></label>
                    <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                      autoFocus placeholder="ເຊັ່ນ: ບໍລິສັດ ທໍ່ໄທ ຈຳກັດ" className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>ເບີໂທ</label>
                      <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                        placeholder="020 XXXX XXXX" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>ເງື່ອນໄຂຊຳລະ (ວັນ)</label>
                      <input type="number" min="0" value={form.credit_days}
                        onChange={e => setForm({ ...form, credit_days: e.target.value })}
                        placeholder="30" className={inputCls} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[7, 15, 30, 45, 60, 90].map(d => (
                      <button key={d} type="button" onClick={() => setForm({ ...form, credit_days: String(d) })}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                          Number(form.credit_days) === d ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}>{d} ວັນ</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section 2: ຜູ້ປະສານງານ */}
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                  <span className="w-5 h-5 bg-violet-500 text-white rounded text-[10px] font-bold flex items-center justify-center">2</span>
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">ຜູ້ປະສານງານ</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>ຊື່-ນາມສະກຸນ</label>
                    <input type="text" value={form.contact_person}
                      onChange={e => setForm({ ...form, contact_person: e.target.value })}
                      placeholder="ທ. ສົມສັກ ແກ້ວມະນີ" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>ເບີໂທ</label>
                    <input type="tel" value={form.contact_phone}
                      onChange={e => setForm({ ...form, contact_phone: e.target.value })}
                      placeholder="020 XXXX XXXX" className={inputCls} />
                  </div>
                </div>
                {editing && contactHistory.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">ປະຫວັດ ({contactHistory.length})</div>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {contactHistory.map(h => (
                        <div key={h.id} className="flex items-center gap-2 text-[11px] p-1.5 bg-slate-50 rounded">
                          <span className="w-1 h-1 bg-violet-400 rounded-full shrink-0" />
                          <span className="font-medium text-slate-700 truncate">{h.contact_person}</span>
                          {h.contact_phone && <span className="text-slate-400 font-mono">{h.contact_phone}</span>}
                          <span className="text-slate-300 ml-auto text-[10px] font-mono">
                            {new Date(h.created_at).toLocaleDateString('lo-LA')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: ທີ່ຢູ່ */}
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                  <span className="w-5 h-5 bg-emerald-500 text-white rounded text-[10px] font-bold flex items-center justify-center">3</span>
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">ທີ່ຢູ່</h3>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className={labelCls}>ແຂວງ</label>
                    <SearchSelect value={form.province} onChange={setProvince}
                      options={provinces.map(p => ({ value: p, label: p }))} placeholder="-- ເລືອກແຂວງ --" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>ເມືອງ</label>
                      <SearchSelect value={form.district} onChange={setDistrict}
                        options={districts.map(d => ({ value: d, label: d }))}
                        placeholder={form.province ? '-- ເລືອກ --' : 'ເລືອກແຂວງກ່ອນ'} />
                    </div>
                    <div>
                      <label className={labelCls}>ບ້ານ</label>
                      <SearchSelect value={form.village} onChange={val => setForm({ ...form, village: val })}
                        options={villages.map(v => ({ value: v, label: v }))}
                        placeholder={form.district ? '-- ເລືອກ --' : 'ເລືອກເມືອງກ່ອນ'} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>ທີ່ຢູ່ເພີ່ມເຕີມ</label>
                    <input type="text" value={form.address}
                      onChange={e => setForm({ ...form, address: e.target.value })}
                      placeholder="ເລກທີ, ຖະໜົນ..." className={inputCls} />
                  </div>
                </div>
              </div>

              {/* Section 4: Supplier API */}
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-cyan-500 text-white rounded text-[10px] font-bold flex items-center justify-center">4</span>
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Supplier API Sync</h3>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${form.api_enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${form.api_enabled ? 'translate-x-4' : 'translate-x-0'}`}></div>
                    </div>
                    <input type="checkbox" checked={form.api_enabled}
                      onChange={e => setForm({ ...form, api_enabled: e.target.checked })} className="hidden" />
                    <span className={`text-[11px] font-bold ${form.api_enabled ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {form.api_enabled ? 'ON' : 'OFF'}
                    </span>
                  </label>
                </div>
                {form.api_enabled ? (
                  <div className="space-y-2">
                    <div>
                      <label className={labelCls}>API URL</label>
                      <input type="url" value={form.api_url}
                        onChange={e => setForm({ ...form, api_url: e.target.value })}
                        placeholder="http://localhost:5000/api/product" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Hashkey</label>
                      <input type="text" value={form.api_hashkey}
                        onChange={e => setForm({ ...form, api_hashkey: e.target.value })}
                        placeholder="sml123secret" className={inputCls} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className={labelCls + ' mb-0'}>Cust Codes</label>
                        <button type="button"
                          onClick={() => setForm({ ...form, api_cust_codes: [...form.api_cust_codes, ''] })}
                          className="text-[10px] font-semibold text-cyan-600 hover:text-cyan-700 flex items-center gap-0.5">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                          ເພີ່ມຂາ
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {form.api_cust_codes.map((code, idx) => (
                          <div key={idx} className="flex gap-1.5">
                            <input type="text" value={code}
                              onChange={e => {
                                const next = [...form.api_cust_codes]
                                next[idx] = e.target.value
                                setForm({ ...form, api_cust_codes: next })
                              }}
                              placeholder={`01-3343 (ຂາທີ ${idx + 1})`}
                              className={inputCls + ' flex-1'} />
                            {form.api_cust_codes.length > 1 && (
                              <button type="button"
                                onClick={() => setForm({
                                  ...form,
                                  api_cust_codes: form.api_cust_codes.filter((_, i) => i !== idx)
                                })}
                                className="w-8 flex items-center justify-center text-slate-400 hover:text-red-500 bg-white border border-slate-200 rounded-lg">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    {form.api_url && form.api_cust_codes.some(c => c.trim()) && (
                      <div className="pt-2 border-t border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Preview · {form.api_cust_codes.filter(c => c.trim()).length} endpoint
                        </div>
                        <div className="space-y-1">
                          {form.api_cust_codes.filter(c => c.trim()).map((code, i) => (
                            <div key={i} className="font-mono text-[10px] text-slate-700 break-all bg-cyan-50 border border-cyan-100 rounded px-2 py-1">
                              GET {form.api_url.replace(/\/+$/, '')}/{code.trim()}{form.api_hashkey ? `?hashkey=${form.api_hashkey}` : ''}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 text-center py-2">ເປີດ toggle ດ້ານເທິງເພື່ອຕັ້ງຄ່າ API sync</p>
                )}
              </div>
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
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg> ເພີ່ມຜູ້ສະໜອງ</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
