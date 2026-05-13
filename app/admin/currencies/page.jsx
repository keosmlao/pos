'use client';

import { useState, useEffect } from 'react'
import { AdminHero } from '@/components/admin/ui/AdminHero'

const API = '/api'
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(n || 0)
const fmtRate = n => new Intl.NumberFormat('lo-LA', { maximumFractionDigits: 4 }).format(n || 0)

const emptyNew = { code: '', symbol: '', name: '', rate: '', enabled: true }

export default function Currencies() {
  const [rows, setRows] = useState([])
  const [editing, setEditing] = useState({})
  const [showAdd, setShowAdd] = useState(false)
  const [newRow, setNewRow] = useState(emptyNew)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/admin/currencies`)
      setRows(await res.json())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const startEdit = (c) => {
    setEditing({ ...editing, [c.code]: { symbol: c.symbol || '', name: c.name || '', rate: String(c.rate), enabled: c.enabled } })
  }
  const cancelEdit = (code) => {
    const next = { ...editing }; delete next[code]; setEditing(next)
  }
  const saveEdit = async (code) => {
    const body = editing[code]
    const res = await fetch(`${API}/admin/currencies/${code}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, rate: Number(body.rate) || 0 })
    })
    if (res.ok) { load(); cancelEdit(code) }
    else { const e = await res.json(); alert(e.error || 'ເກີດຂໍ້ຜິດພາດ') }
  }
  const toggleEnabled = async (c) => {
    const res = await fetch(`${API}/admin/currencies/${c.code}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !c.enabled })
    })
    if (res.ok) load()
  }
  const addCurrency = async () => {
    if (!newRow.code.trim()) { alert('ກະລຸນາປ້ອນລະຫັດສະກຸນ'); return }
    const res = await fetch(`${API}/admin/currencies`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newRow, rate: Number(newRow.rate) || 1 })
    })
    if (res.ok) { setShowAdd(false); setNewRow(emptyNew); load() }
    else { const e = await res.json(); alert(e.error || 'ເກີດຂໍ້ຜິດພາດ') }
  }
  const removeCurrency = async (code) => {
    if (!confirm(`ລຶບສະກຸນ "${code}"?`)) return
    const res = await fetch(`${API}/admin/currencies/${code}`, { method: 'DELETE' })
    if (res.ok) load()
    else { const e = await res.json(); alert(e.error || 'ເກີດຂໍ້ຜິດພາດ') }
  }

  const enabledCount = rows.filter(r => r.enabled).length
  const disabledCount = rows.length - enabledCount

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Currencies"
        title="💱 ສະກຸນເງິນ / ອັດຕາແລກປ່ຽນ"
        subtitle={`${fmtNum(rows.length)} ສະກຸນ · ${enabledCount} ເປີດ${disabledCount > 0 ? ` · ${disabledCount} ປິດ` : ''}`}
        action={
          <button onClick={() => setShowAdd(v => !v)}
            className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-3 text-sm font-extrabold shadow-lg shadow-red-950/20">
            + ເພີ່ມສະກຸນ
          </button>
        }
      />

      {/* Info note */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-800 flex items-start gap-2">
        <span className="text-base">💡</span>
        <div>
          <div className="font-bold mb-0.5">ກ່ຽວກັບອັດຕາເເລກປ່ຽນ</div>
          <div>ອັດຕາແມ່ນ <span className="font-mono font-bold">1 [UNIT] = N ກີບ</span> (ເຊັ່ນ: 1 USD = 21,500 ກີບ). LAK ແມ່ນສະກຸນຫຼັກ (rate = 1, ລຶບບໍ່ໄດ້).</div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-red-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50">
              <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                <th className="text-left py-2 px-3 w-20">ລະຫັດ</th>
                <th className="text-left py-2 px-3 w-14">ສັນຍາລັກ</th>
                <th className="text-left py-2 px-3">ຊື່</th>
                <th className="text-right py-2 px-3 w-40">ອັດຕາ (1 ຫົວໜ່ວຍ = ? ກີບ)</th>
                <th className="text-center py-2 px-3 w-20">ສະຖານະ</th>
                <th className="text-left py-2 px-3 w-36">ອັບເດດລ່າສຸດ</th>
                <th className="text-right py-2 px-3 w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {showAdd && (
                <tr className="bg-red-50/40">
                  <td className="py-1.5 px-3">
                    <input type="text" value={newRow.code}
                      onChange={e => setNewRow({ ...newRow, code: e.target.value.toUpperCase() })}
                      maxLength={5} placeholder="CODE"
                      className="w-16 px-2 py-1 bg-white border border-red-300 rounded text-xs font-mono font-bold uppercase outline-none focus:ring-2 focus:ring-red-500/20" />
                  </td>
                  <td className="py-1.5 px-3">
                    <input type="text" value={newRow.symbol}
                      onChange={e => setNewRow({ ...newRow, symbol: e.target.value })}
                      maxLength={3} placeholder="¥"
                      className="w-12 px-2 py-1 bg-white border border-slate-200 rounded text-sm text-center outline-none focus:border-red-500" />
                  </td>
                  <td className="py-1.5 px-3">
                    <input type="text" value={newRow.name}
                      onChange={e => setNewRow({ ...newRow, name: e.target.value })}
                      placeholder="ຊື່ສະກຸນ"
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs outline-none focus:border-red-500" />
                  </td>
                  <td className="py-1.5 px-3 text-right">
                    <input type="number" value={newRow.rate}
                      onChange={e => setNewRow({ ...newRow, rate: e.target.value })}
                      placeholder="1"
                      className="w-28 px-2 py-1 bg-white border border-slate-200 rounded text-right font-mono-t font-bold outline-none focus:border-red-500" />
                  </td>
                  <td className="py-1.5 px-3 text-center">
                    <button type="button" onClick={() => setNewRow({ ...newRow, enabled: !newRow.enabled })}
                      className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${newRow.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                      <span className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${newRow.enabled ? 'translate-x-4' : 'translate-x-0'}`}></span>
                    </button>
                  </td>
                  <td className="py-1.5 px-3 text-[11px] text-slate-400">ໃໝ່</td>
                  <td className="py-1.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={addCurrency}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold">ບັນທຶກ</button>
                      <button onClick={() => { setShowAdd(false); setNewRow(emptyNew) }}
                        className="w-6 h-6 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded flex items-center justify-center">✕</button>
                    </div>
                  </td>
                </tr>
              )}

              {rows.map(c => {
                const isEditing = !!editing[c.code]
                const isLAK = c.code === 'LAK'
                return (
                  <tr key={c.code} className={`hover:bg-slate-50 ${!c.enabled ? 'opacity-60' : ''}`}>
                    <td className="py-2 px-3 font-mono font-extrabold text-slate-800">
                      {c.code}
                      {isLAK && <span className="ml-1.5 text-[9px] bg-red-100 text-red-700 font-bold px-1 py-0.5 rounded">HOME</span>}
                    </td>
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <input type="text" value={editing[c.code].symbol}
                          onChange={e => setEditing({ ...editing, [c.code]: { ...editing[c.code], symbol: e.target.value } })}
                          maxLength={3}
                          className="w-12 px-2 py-1 border border-slate-200 rounded text-sm text-center outline-none focus:border-red-500" />
                      ) : (
                        <span className="text-base font-bold text-slate-700">{c.symbol || '—'}</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <input type="text" value={editing[c.code].name}
                          onChange={e => setEditing({ ...editing, [c.code]: { ...editing[c.code], name: e.target.value } })}
                          className="w-full px-2 py-1 border border-slate-200 rounded text-xs outline-none focus:border-red-500" />
                      ) : (
                        <span className="font-semibold text-slate-700">{c.name || '—'}</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {isEditing && !isLAK ? (
                        <input type="number" value={editing[c.code].rate}
                          onChange={e => setEditing({ ...editing, [c.code]: { ...editing[c.code], rate: e.target.value } })}
                          className="w-32 px-2 py-1 border-2 border-red-400 rounded text-right font-mono-t font-bold outline-none focus:ring-2 focus:ring-red-500/20" />
                      ) : (
                        <span className={`font-mono-t font-extrabold ${isLAK ? 'text-slate-400' : 'text-red-700'}`}>{fmtRate(c.rate)}</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {isEditing ? (
                        <button type="button" onClick={() => setEditing({ ...editing, [c.code]: { ...editing[c.code], enabled: !editing[c.code].enabled } })}
                          className={`w-9 h-5 rounded-full flex items-center px-0.5 mx-auto transition-colors ${editing[c.code].enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                          <span className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${editing[c.code].enabled ? 'translate-x-4' : 'translate-x-0'}`}></span>
                        </button>
                      ) : (
                        <button onClick={() => toggleEnabled(c)} disabled={isLAK}
                          className={`w-9 h-5 rounded-full flex items-center px-0.5 mx-auto transition-colors ${c.enabled ? 'bg-emerald-500' : 'bg-slate-300'} ${isLAK ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <span className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${c.enabled ? 'translate-x-4' : 'translate-x-0'}`}></span>
                        </button>
                      )}
                    </td>
                    <td className="py-2 px-3 text-[11px] text-slate-500 font-mono-t">
                      {c.updated_at ? new Date(c.updated_at).toLocaleString('lo-LA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isEditing ? (
                          <>
                            <button onClick={() => saveEdit(c.code)}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold">ບັນທຶກ</button>
                            <button onClick={() => cancelEdit(c.code)}
                              className="w-6 h-6 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded flex items-center justify-center">✕</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(c)}
                              className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[11px] font-bold">ແກ້ໄຂ</button>
                            {!isLAK && (
                              <button onClick={() => removeCurrency(c.code)}
                                className="w-6 h-6 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded flex items-center justify-center" title="ລຶບ">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && !showAdd && (
                <tr><td colSpan="7" className="text-center text-slate-300 py-12 text-xs">ຍັງບໍ່ມີສະກຸນເງິນ</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}