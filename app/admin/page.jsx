'use client';


import { useState, useEffect } from 'react'

const API = '/api'
const fmtPrice = p => new Intl.NumberFormat('lo-LA').format(Math.round(p)) + ' ກີບ'
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(n)
const fmtCompact = n => {
  const num = Number(n) || 0
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B'
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
  return String(num)
}

const fmtDate = d => d ? new Date(d).toLocaleDateString('lo-LA') : '-'
const thbFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function pickNum(obj, keys) {
  if (!obj) return 0
  for (const k of keys) {
    const v = Number(obj[k])
    if (!isNaN(v) && v !== 0) return v
  }
  return 0
}
const getItemPrice = it => pickNum(it, ['price', 'unit_price', 'item_price', 'price_2'])
const getItemDiscount = it => pickNum(it, ['sum_discount', 'discount_amount', 'discount_amt', 'line_discount'])
const getItemLineTotal = it => {
  const d = pickNum(it, ['sum_amount', 'net_amount', 'amount', 'total_amount'])
  if (d) return d
  return getItemPrice(it) * (pickNum(it, ['qty', 'quantity']) || 0) - getItemDiscount(it)
}
const getHeaderTotal = (h, items) => pickNum(h, ['total_amount', 'net_amount', 'grand_total', 'sum_amount']) || (items || []).reduce((s, it) => s + getItemLineTotal(it), 0)

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [debts, setDebts] = useState([])
  const [pendingInvoices, setPendingInvoices] = useState([])
  useEffect(() => {
    fetch(`${API}/admin/dashboard`).then(r => r.json()).then(setData)
    fetch(`${API}/admin/debts`).then(r => r.json()).then(d => setDebts(Array.isArray(d) ? d : []))
    fetch(`${API}/admin/purchases/pending-invoices`).then(r => r.json()).then(d => setPendingInvoices(Array.isArray(d) ? d : []))
  }, [])

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-red-600 rounded-full animate-spin"></div>
        <p className="mt-3 text-xs text-slate-400">ກຳລັງໂຫລດຂໍ້ມູນ...</p>
      </div>
    )
  }

  const today = new Date()
  const dateStr = today.toLocaleDateString('lo-LA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = today.toLocaleTimeString('lo-LA', { hour: '2-digit', minute: '2-digit' })

  const avgToday = data.today_orders > 0 ? data.today_revenue / data.today_orders : 0
  const avgAll = data.all_orders > 0 ? data.all_revenue / data.all_orders : 0
  const todayShare = data.all_revenue > 0 ? (data.today_revenue / data.all_revenue) * 100 : 0
  const outOfStock = data.low_stock.filter(p => p.qty_on_hand === 0).length
  const criticalStock = data.low_stock.length - outOfStock
  const top = data.top_products || []
  const topSoldTotal = top.reduce((s, p) => s + parseInt(p.total_sold || 0), 0)
  const topRevTotal = top.reduce((s, p) => s + parseFloat(p.total_revenue || 0), 0)
  const topRevShare = data.all_revenue > 0 ? (topRevTotal / data.all_revenue) * 100 : 0
  const maxRev = Math.max(...top.map(p => parseFloat(p.total_revenue || 0)), 1)
  const maxSold = Math.max(...top.map(p => parseInt(p.total_sold || 0)), 1)

  const pendingTotalThb = pendingInvoices.reduce((s, inv) => s + getHeaderTotal(inv.header, Array.isArray(inv.items) ? inv.items : []), 0)
  const pendingItemsCount = pendingInvoices.reduce((s, inv) => s + (Array.isArray(inv.items) ? inv.items.length : 0), 0)

  const totalDebt = debts.reduce((s, d) => s + parseFloat(d.remaining || 0), 0)
  const overdueDebts = debts.filter(d => d.due_date && new Date(d.due_date).getTime() + 86400000 < Date.now())
  const dueSoonDebts = debts.filter(d => {
    if (!d.due_date) return false
    const days = Math.ceil((new Date(d.due_date).getTime() + 86400000 - Date.now()) / 86400000)
    return days >= 0 && days <= 7
  })
  const overdueAmount = overdueDebts.reduce((s, d) => s + parseFloat(d.remaining || 0), 0)

  const kpis = [
    { l: 'ສິນຄ້າ', v: fmtNum(data.total_products), sub: 'ລາຍການທັງໝົດ', color: 'blue' },
    { l: 'ບິນມື້ນີ້', v: fmtNum(data.today_orders), sub: `ສະເລ່ຍ ${fmtCompact(avgToday)}/ບິນ`, color: 'amber' },
    { l: 'ລາຍຮັບມື້ນີ້', v: fmtCompact(data.today_revenue), sub: `${todayShare.toFixed(1)}% ຂອງທັງໝົດ`, color: 'emerald' },
    { l: 'ລາຍຮັບທັງໝົດ', v: fmtCompact(data.all_revenue), sub: `${fmtNum(data.all_orders)} ບິນ`, color: 'violet' },
    { l: 'ສິນຄ້າໃກ້ໝົດ', v: fmtNum(data.low_stock.length), sub: `${outOfStock} ໝົດ · ${criticalStock} ຕໍ່າ`, color: 'red' },
    { l: 'ສິນຄ້າຄ້າງຮັບ', v: fmtNum(pendingInvoices.length), sub: `${fmtNum(pendingItemsCount)} ລາຍການ · ฿${fmtCompact(pendingTotalThb)}`, color: pendingInvoices.length ? 'amber' : 'slate' },
    { l: 'ໜີ້ຄ້າງຊຳລະ', v: fmtCompact(totalDebt), sub: `${fmtNum(debts.length)} ໃບ${overdueDebts.length ? ` · ${overdueDebts.length} ເກີນ` : ''}`, color: overdueDebts.length ? 'rose' : 'slate' },
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
  const barColor = {
    blue: 'bg-red-500', amber: 'bg-amber-500', emerald: 'bg-emerald-500',
    violet: 'bg-violet-500', rose: 'bg-rose-500', red: 'bg-red-500',
  }

  return (
    <div className="text-[13px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-extrabold text-slate-900">Dashboard</h2>
          <span className="text-[11px] text-slate-400">·</span>
          <span className="text-xs text-slate-500 capitalize">{dateStr}</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-500 font-mono">{timeStr}</span>
          <span className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-semibold text-emerald-700">LIVE</span>
          </span>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
        {kpis.map((k, i) => (
          <div key={i} className={`rounded-lg border p-3 ${colorMap[k.color]}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{k.l}</div>
            <div className="text-xl font-extrabold mt-1 leading-tight">{k.v}</div>
            <div className="text-[10px] opacity-70 mt-0.5 truncate">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Summary rows */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        {/* Today snapshot */}
        <div className="bg-white rounded-lg border border-slate-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">ສະຫຼຸບມື້ນີ້</h3>
            <span className="text-[10px] text-slate-400">{today.toLocaleDateString('lo-LA')}</span>
          </div>
          <table className="w-full text-[12px]">
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-1.5 text-slate-500">ລາຍຮັບ</td>
                <td className="py-1.5 text-right font-extrabold text-emerald-600">{fmtPrice(data.today_revenue)}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-slate-500">ຈຳນວນບິນ</td>
                <td className="py-1.5 text-right font-bold text-slate-800">{fmtNum(data.today_orders)}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-slate-500">ສະເລ່ຍ/ບິນ</td>
                <td className="py-1.5 text-right font-bold text-slate-800">{fmtPrice(avgToday)}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-slate-500">% ຂອງລາຍຮັບທັງໝົດ</td>
                <td className="py-1.5 text-right font-bold text-red-600">{todayShare.toFixed(2)}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* All-time */}
        <div className="bg-white rounded-lg border border-slate-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">ລວມທັງໝົດ</h3>
            <span className="text-[10px] text-slate-400">ທຸກຊ່ວງເວລາ</span>
          </div>
          <table className="w-full text-[12px]">
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-1.5 text-slate-500">ລາຍຮັບລວມ</td>
                <td className="py-1.5 text-right font-extrabold text-rose-600">{fmtPrice(data.all_revenue)}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-slate-500">ບິນລວມ</td>
                <td className="py-1.5 text-right font-bold text-slate-800">{fmtNum(data.all_orders)}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-slate-500">ສະເລ່ຍ/ບິນ</td>
                <td className="py-1.5 text-right font-bold text-slate-800">{fmtPrice(avgAll)}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-slate-500">ສິນຄ້າທັງໝົດ</td>
                <td className="py-1.5 text-right font-bold text-slate-800">{fmtNum(data.total_products)} ລາຍການ</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Inventory health */}
        <div className="bg-white rounded-lg border border-slate-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">ສະພາບສາງ</h3>
            <span className="text-[10px] text-slate-400">{fmtNum(data.total_products)} ລາຍການ</span>
          </div>
          {(() => {
            const total = data.total_products || 1
            const ok = Math.max(total - data.low_stock.length, 0)
            const okPct = (ok / total) * 100
            const criticalPct = (criticalStock / total) * 100
            const outPct = (outOfStock / total) * 100
            return (
              <>
                <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 mb-3">
                  <div className="bg-emerald-500" style={{ width: `${okPct}%` }}></div>
                  <div className="bg-amber-500" style={{ width: `${criticalPct}%` }}></div>
                  <div className="bg-red-500" style={{ width: `${outPct}%` }}></div>
                </div>
                <table className="w-full text-[12px]">
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-1.5"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>ປົກກະຕິ</td>
                      <td className="py-1.5 text-right font-bold text-emerald-600">{fmtNum(ok)} <span className="text-slate-400 font-normal">({okPct.toFixed(1)}%)</span></td>
                    </tr>
                    <tr>
                      <td className="py-1.5"><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-2"></span>ຕໍ່າ</td>
                      <td className="py-1.5 text-right font-bold text-amber-600">{fmtNum(criticalStock)} <span className="text-slate-400 font-normal">({criticalPct.toFixed(1)}%)</span></td>
                    </tr>
                    <tr>
                      <td className="py-1.5"><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-2"></span>ໝົດ</td>
                      <td className="py-1.5 text-right font-bold text-red-600">{fmtNum(outOfStock)} <span className="text-slate-400 font-normal">({outPct.toFixed(1)}%)</span></td>
                    </tr>
                  </tbody>
                </table>
              </>
            )
          })()}
        </div>
      </div>

      {/* Top products chart */}
      <div className="bg-white rounded-lg border border-slate-200 p-3 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">ສິນຄ້າຂາຍດີ · Top {top.length}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">ລວມ {fmtNum(topSoldTotal)} ລາຍການ · {fmtPrice(topRevTotal)} · {topRevShare.toFixed(1)}% ຂອງລາຍຮັບທັງໝົດ</p>
          </div>
        </div>
        {top.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-xs">ຍັງບໍ່ມີຂໍ້ມູນການຂາຍ</p>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                <th className="text-left py-1.5 w-8">#</th>
                <th className="text-left py-1.5">ຊື່ສິນຄ້າ</th>
                <th className="text-right py-1.5 w-20">ຈຳນວນ</th>
                <th className="text-right py-1.5 w-28">ລາຍຮັບ</th>
                <th className="text-left py-1.5 pl-3 w-[30%]">ສັດສ່ວນຍອດຂາຍ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {top.map((p, i) => {
                const soldPct = (parseInt(p.total_sold) / maxSold) * 100
                const revPct = (parseFloat(p.total_revenue) / maxRev) * 100
                return (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-2">
                      <span className={`inline-flex w-5 h-5 rounded text-[10px] font-extrabold items-center justify-center ${
                        i === 0 ? 'bg-yellow-100 text-yellow-700' :
                        i === 1 ? 'bg-slate-200 text-slate-700' :
                        i === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>{i + 1}</span>
                    </td>
                    <td className="py-2 font-semibold text-slate-800 truncate">{p.product_name || p.name}</td>
                    <td className="py-2 text-right font-bold text-slate-700 font-mono">{fmtNum(p.total_sold)}</td>
                    <td className="py-2 text-right font-extrabold text-emerald-600 font-mono">{fmtCompact(p.total_revenue)}</td>
                    <td className="py-2 pl-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full" style={{ width: `${soldPct}%` }}></div>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono w-10 text-right">{soldPct.toFixed(0)}%</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${revPct}%` }}></div>
                        </div>
                        <span className="text-[9px] text-slate-300 font-mono w-10 text-right">{revPct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Low stock table */}
      <div className="bg-white rounded-lg border border-slate-200 p-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              ສິນຄ້າໃກ້ໝົດ / ໝົດ · {fmtNum(data.low_stock.length)} ລາຍການ
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              <span className="text-red-600 font-semibold">{outOfStock} ໝົດ</span> ·
              <span className="text-amber-600 font-semibold"> {criticalStock} ຕໍ່າກວ່າ min</span>
            </p>
          </div>
        </div>
        {data.low_stock.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-emerald-600 text-xs font-semibold">✓ ສິນຄ້າທຸກລາຍການຢູ່ໃນລະດັບປົກກະຕິ</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-white">
                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                  <th className="text-left py-1.5">ລະຫັດ</th>
                  <th className="text-left py-1.5">ຊື່ສິນຄ້າ</th>
                  <th className="text-right py-1.5 w-20">ຄົງເຫຼືອ</th>
                  <th className="text-right py-1.5 w-16">Min</th>
                  <th className="text-right py-1.5 w-16">ຫົວໜ່ວຍ</th>
                  <th className="text-center py-1.5 w-20">ສະຖານະ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.low_stock.map(p => {
                  const out = p.qty_on_hand === 0
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-1.5 font-mono text-slate-500 text-[11px]">{p.product_code}</td>
                      <td className="py-1.5 font-semibold text-slate-800 truncate">{p.product_name}</td>
                      <td className={`py-1.5 text-right font-extrabold font-mono ${out ? 'text-red-600' : 'text-amber-600'}`}>{fmtNum(p.qty_on_hand)}</td>
                      <td className="py-1.5 text-right text-slate-500 font-mono">{fmtNum(p.min_stock)}</td>
                      <td className="py-1.5 text-right text-slate-500">{p.unit}</td>
                      <td className="py-1.5 text-center">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${out ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {out ? 'ໝົດ' : 'ຕໍ່າ'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending invoices (receivable goods) table */}
      <div className="bg-white rounded-lg border border-slate-200 p-3 mt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              ສິນຄ້າຄ້າງຮັບ · {fmtNum(pendingInvoices.length)} ໃບ
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ໃບບິນຈາກຜູ້ສະໜອງທີ່ຍັງບໍ່ໄດ້ນຳເຂົ້າ · ລວມ <span className="text-amber-600 font-semibold">฿{thbFmt.format(pendingTotalThb)}</span> · {fmtNum(pendingItemsCount)} ລາຍການ
            </p>
          </div>
        </div>
        {pendingInvoices.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-emerald-600 text-xs font-semibold">✓ ບໍ່ມີສິນຄ້າຄ້າງຮັບ</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-white">
                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                  <th className="text-left py-1.5">ເລກທີ່ເອກະສານ</th>
                  <th className="text-left py-1.5 w-28">ວັນທີ</th>
                  <th className="text-left py-1.5">ຜູ້ສະໜອງ</th>
                  <th className="text-left py-1.5 w-24">ລະຫັດລູກຄ້າ</th>
                  <th className="text-right py-1.5 w-20">ລາຍການ</th>
                  <th className="text-right py-1.5 w-28">ຍອດ (THB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingInvoices.map(inv => {
                  const items = Array.isArray(inv.items) ? inv.items : []
                  const total = getHeaderTotal(inv.header, items)
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="py-1.5 font-mono text-slate-700 text-[11px]">{inv.doc_no || '-'}</td>
                      <td className="py-1.5 text-slate-500 text-[11px]">{fmtDate(inv.doc_date)}</td>
                      <td className="py-1.5 font-semibold text-slate-800 truncate">{inv.supplier_name || '-'}</td>
                      <td className="py-1.5 font-mono text-slate-500 text-[11px]">{inv.cust_code || '-'}</td>
                      <td className="py-1.5 text-right font-bold text-slate-700 font-mono">{fmtNum(items.length)}</td>
                      <td className="py-1.5 text-right font-extrabold text-amber-600 font-mono">
                        {total > 0 ? `฿${thbFmt.format(total)}` : <span className="text-slate-300">-</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending debts table */}
      <div className="bg-white rounded-lg border border-slate-200 p-3 mt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              ໜີ້ຄ້າງຊຳລະ · {fmtNum(debts.length)} ໃບ
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ລວມ <span className="text-rose-600 font-semibold">{fmtPrice(totalDebt)}</span>
              {overdueDebts.length > 0 && <> · <span className="text-red-600 font-semibold">{overdueDebts.length} ໃບເກີນກຳນົດ ({fmtPrice(overdueAmount)})</span></>}
              {dueSoonDebts.length > 0 && <> · <span className="text-amber-600 font-semibold">{dueSoonDebts.length} ໃບໃກ້ຄົບ ≤7ວ</span></>}
            </p>
          </div>
        </div>
        {debts.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-emerald-600 text-xs font-semibold">✓ ບໍ່ມີໜີ້ຄ້າງຊຳລະ</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-white">
                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                  <th className="text-left py-1.5">ເລກທີ່</th>
                  <th className="text-left py-1.5">ຜູ້ສະໜອງ</th>
                  <th className="text-right py-1.5 w-28">ລວມ</th>
                  <th className="text-right py-1.5 w-28">ຊຳລະແລ້ວ</th>
                  <th className="text-right py-1.5 w-28">ຄົງເຫຼືອ</th>
                  <th className="text-center py-1.5 w-24">ກຳນົດຊຳລະ</th>
                  <th className="text-center py-1.5 w-20">ສະຖານະ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {debts.map(d => {
                  const overdue = d.due_date && new Date(d.due_date).getTime() + 86400000 < Date.now()
                  const daysLeft = d.due_date ? Math.ceil((new Date(d.due_date).getTime() + 86400000 - Date.now()) / 86400000) : null
                  const dueSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7
                  const paidPct = d.total > 0 ? (parseFloat(d.paid) / parseFloat(d.total)) * 100 : 0
                  return (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-1.5 font-mono text-slate-600 text-[11px]">{d.ref_number || '-'}</td>
                      <td className="py-1.5 font-semibold text-slate-800 truncate">{d.supplier_name || '-'}</td>
                      <td className="py-1.5 text-right font-bold text-slate-700 font-mono">{fmtCompact(d.total)}</td>
                      <td className="py-1.5 text-right text-emerald-600 font-mono">
                        {fmtCompact(d.paid)}
                        <div className="h-1 mt-0.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${paidPct}%` }}></div>
                        </div>
                      </td>
                      <td className="py-1.5 text-right font-extrabold text-rose-600 font-mono">{fmtCompact(d.remaining)}</td>
                      <td className="py-1.5 text-center text-[11px]">
                        {d.due_date ? (
                          <>
                            <div className="text-slate-500">{fmtDate(d.due_date)}</div>
                            <div className={`font-mono font-semibold ${overdue ? 'text-red-600' : dueSoon ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {overdue ? `ເກີນ ${Math.abs(daysLeft)}ວ` : `${daysLeft}ວ`}
                            </div>
                          </>
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="py-1.5 text-center">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${overdue ? 'bg-red-100 text-red-700' : dueSoon ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                          {overdue ? 'ເກີນກຳນົດ' : dueSoon ? 'ໃກ້ຄົບ' : 'ຄ້າງ'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}