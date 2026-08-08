'use client';


import { useState, useEffect, useMemo } from 'react'
import { AdminHero } from '@/components/admin/ui/AdminHero'
import { usePagePermission } from '@/utils/adminPermissions'
import { formatDate, formatDateTime } from '@/utils/formatDate';
import { downloadWorkbookMulti } from '@/utils/excelClient'
import { printReportA4 } from '@/utils/reportPrint'

const API = '/api'
// ວັນທີແບບທ້ອງຖິ່ນ — toISOString() ຈະແປງເປັນ UTC ແລ້ວບິນຕອນແລງຈະຕົກໄປວັນກ່ອນໜ້າ
const dateKey = (v) => {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const fmtPrice = n => new Intl.NumberFormat('lo-LA').format(Math.round(n || 0)) + ' ກີບ'
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(n || 0)
const fmtCompact = n => {
  const num = Number(n) || 0
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B'
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
  return String(num)
}
const fmtDT = (s) => formatDateTime(s)

const methodMeta = {
  cash: { icon: '💵', label: 'ສົດ', color: 'emerald' },
  transfer: { icon: '🏦', label: 'ໂອນ', color: 'blue' },
  qr: { icon: '📱', label: 'QR', color: 'violet' },
  mixed: { icon: '🎯', label: 'ປະສົມ', color: 'amber' },
  credit: { icon: '🧾', label: 'ຕິດໜີ້', color: 'rose' },
}

export default function Sales() {
  const perm = usePagePermission('/admin/sales')
  const [orders, setOrders] = useState([])
  const [branches, setBranches] = useState([])
  const [branchFilter, setBranchFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [perPage, setPerPage] = useState(50)
  const [page, setPage] = useState(1)
  const [deletingId, setDeletingId] = useState(null)
  const [company, setCompany] = useState({})
  // ຄຳຄົ້ນທີ່ "ສົ່ງໄປເຊີບເວີແລ້ວ" — ວ່າງ = ກຳລັງເບິ່ງຕາມຊ່ວງວັນທີປົກກະຕິ
  const [serverSearch, setServerSearch] = useState('')

  // ຮັບຄ່າຊັດເຈນເຂົ້າມາໄດ້ — ຖ້າອາໄສ state ຢ່າງດຽວ ປຸ່ມຊ່ວງດ່ວນຈະໃຊ້ຄ່າເກົ່າ
  // ເພາະ setFrom/setTo ຍັງບໍ່ທັນມີຜົນຕອນເອີ້ນ load
  const load = async (opts = {}) => {
    const q = opts.search !== undefined ? opts.search : serverSearch
    const f = opts.from !== undefined ? opts.from : from
    const t = opts.to !== undefined ? opts.to : to
    setLoading(true)
    try {
      const params = new URLSearchParams()
      // ຄົ້ນຫາເລກບິນ = ຄົ້ນທົ່ວປະຫວັດ ຈຶ່ງບໍ່ສົ່ງຊ່ວງວັນທີໄປ
      if (q) params.set('search', q)
      else {
        if (f) params.set('start', f)
        if (t) params.set('end', t)
      }
      if (branchFilter) params.set('branch_id', branchFilter)
      const res = await fetch(`${API}/admin/sales?${params}`)
      const data = await res.json()
      setOrders(Array.isArray(data) ? data : [])
      setPage(1)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    fetch(`${API}/admin/branches`).then(r => r.json()).then(d => setBranches(Array.isArray(d) ? d : [])).catch(() => {})
    fetch(`${API}/company`).then(r => r.json()).then(setCompany).catch(() => {})
  }, [])
  useEffect(() => { load() }, [branchFilter])

  // ຄົ້ນຫາເລກບິນທົ່ວປະຫວັດ (ຂ້າມຕົວກອງວັນທີ)
  const runBillSearch = () => {
    const q = search.trim()
    setServerSearch(q)
    load({ search: q })
  }
  const clearBillSearch = () => {
    setSearch('')
    setServerSearch('')
    load({ search: '' })
  }

  // ເລືອກຊ່ວງວັນທີ = ອອກຈາກໂໝດຄົ້ນຫາເລກບິນ
  const applyRange = (start, end) => {
    setFrom(start); setTo(end)
    setSearch(''); setServerSearch('')
    load({ from: start, to: end, search: '' })
  }
  const quickRange = (days) => {
    const d = new Date()
    applyRange(dateKey(new Date(d.getTime() - (days - 1) * 86400000)), dateKey(d))
  }
  const thisMonth = () => {
    const d = new Date()
    applyRange(dateKey(new Date(d.getFullYear(), d.getMonth(), 1)), dateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0)))
  }
  const lastMonth = () => {
    const d = new Date()
    applyRange(dateKey(new Date(d.getFullYear(), d.getMonth() - 1, 1)), dateKey(new Date(d.getFullYear(), d.getMonth(), 0)))
  }

  const filtered = useMemo(() => {
    return orders.filter(o => {
      const q = search.toLowerCase().trim()
      if (q) {
        const items = Array.isArray(o.items) ? o.items : []
        // ຕ້ອງມີ bill_number ນຳ — ບໍ່ດັ່ງນັ້ນຄົ້ນຫາດ້ວຍເລກບິນຈະບໍ່ພົບ
        const hay = `${o.bill_number || ''} ${o.id} ${items.map(i => i?.product_name || '').join(' ')} ${o.note || ''} ${o.customer_name || ''} ${o.customer_phone || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (methodFilter && o.payment_method !== methodFilter) return false
      return true
    })
  }, [orders, search, methodFilter])

  const netTotalOf = (o) => Math.max(0, (Number(o.total) || 0) - (Number(o.refund_total) || 0))
  const netQtyOf = (it) => Math.max(0, (Number(it?.quantity) || 0) - (Number(it?.returned_qty) || 0))

  const stats = useMemo(() => {
    const total = filtered.reduce((s, o) => s + netTotalOf(o), 0)
    const refundTotal = filtered.reduce((s, o) => s + (Number(o.refund_total) || 0), 0)
    const discount = filtered.reduce((s, o) => s + (Number(o.discount) || 0), 0)
    const count = filtered.length
    const avg = count > 0 ? total / count : 0
    const methods = {}
    for (const m of ['cash', 'transfer', 'qr', 'mixed', 'credit']) {
      const items = filtered.filter(o => (o.payment_method || 'cash') === m)
      methods[m] = { count: items.length, total: items.reduce((s, o) => s + netTotalOf(o), 0) }
    }
    const creditRemaining = filtered
      .filter(o => o.payment_method === 'credit')
      .reduce((s, o) => s + Math.max(0, (Number(o.total) || 0) - (Number(o.amount_paid) || 0) - (Number(o.refund_total) || 0)), 0)
    const itemsCount = filtered.reduce((s, o) => s + (Array.isArray(o.items) ? o.items.reduce((ss, it) => ss + netQtyOf(it), 0) : 0), 0)
    return { total, refundTotal, discount, count, avg, methods, itemsCount, creditRemaining }
  }, [filtered])

  // Top products (net of returns)
  const topProducts = useMemo(() => {
    const byProd = {}
    for (const o of filtered) {
      for (const it of (o.items || [])) {
        const name = it?.product_name || '—'
        const qty = netQtyOf(it)
        if (qty <= 0) continue
        if (!byProd[name]) byProd[name] = { qty: 0, revenue: 0 }
        byProd[name].qty += qty
        byProd[name].revenue += (Number(it.price) || 0) * qty
      }
    }
    return Object.entries(byProd)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
  }, [filtered])

  // ສະຫຼຸບຕໍ່ວັນ (ສຸດທິຫຼັງຫັກຮັບຄືນ) — ໃຊ້ທັງກຣາຟ ແລະ ລາຍງານປະຈຳວັນ
  const dailyBreakdown = useMemo(() => {
    const by = {}
    for (const o of filtered) {
      const d = dateKey(o.created_at)
      if (!d) continue
      if (!by[d]) by[d] = {
        date: d, count: 0, total: 0, gross: 0, discount: 0, refund: 0, qty: 0,
        cash: 0, transfer: 0, qr: 0, mixed: 0, credit: 0, creditRemaining: 0,
      }
      const row = by[d]
      const net = netTotalOf(o)
      row.count++
      row.total += net
      row.gross += Number(o.total) || 0
      row.discount += Number(o.discount) || 0
      row.refund += Number(o.refund_total) || 0
      row.qty += (Array.isArray(o.items) ? o.items.reduce((s, it) => s + netQtyOf(it), 0) : 0)
      const method = o.payment_method || 'cash'
      if (row[method] !== undefined) row[method] += net
      if (method === 'credit') {
        row.creditRemaining += Math.max(0,
          (Number(o.total) || 0) - (Number(o.amount_paid) || 0) - (Number(o.refund_total) || 0))
      }
    }
    return Object.values(by).sort((a, b) => a.date.localeCompare(b.date))
  }, [filtered])

  const maxDaily = Math.max(...dailyBreakdown.map(d => d.total), 1)

  const kpis = [
    { l: 'ຈຳນວນບິນ', v: fmtNum(stats.count), sub: `${fmtNum(stats.itemsCount)} ຊິ້ນ (ສຸດທິ)`, color: 'blue' },
    { l: 'ລາຍຮັບສຸດທິ', v: fmtCompact(stats.total), sub: `ສະເລ່ຍ ${fmtCompact(stats.avg)}/ບິນ`, color: 'emerald' },
    { l: '💵 ສົດ', v: fmtNum(stats.methods.cash.count), sub: fmtCompact(stats.methods.cash.total), color: 'emerald' },
    { l: '🏦 ໂອນ', v: fmtNum(stats.methods.transfer.count), sub: fmtCompact(stats.methods.transfer.total), color: 'blue' },
    { l: '📱 QR', v: fmtNum(stats.methods.qr.count), sub: fmtCompact(stats.methods.qr.total), color: 'violet' },
    { l: '🧾 ຕິດໜີ້', v: fmtNum(stats.methods.credit.count), sub: `ຄ້າງ ${fmtCompact(stats.creditRemaining)}`, color: 'rose' },
    { l: '↩ ຮັບຄືນ', v: fmtCompact(stats.refundTotal), sub: stats.total + stats.refundTotal > 0 ? `${(stats.refundTotal / (stats.total + stats.refundTotal) * 100).toFixed(1)}% ຂອງລວມ` : '—', color: 'rose' },
    { l: 'ສ່ວນຫຼຸດ', v: fmtCompact(stats.discount), sub: stats.total > 0 ? `${(stats.discount / stats.total * 100).toFixed(1)}% ຂອງລວມ` : '—', color: 'amber' },
  ]
  const kpiColor = {
    blue: 'text-red-600 bg-red-50 border-red-100',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    violet: 'text-violet-600 bg-violet-50 border-violet-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    rose: 'text-rose-600 bg-rose-50 border-rose-100',
  }

  const totalPages = Math.ceil(filtered.length / perPage) || 1
  const paged = filtered.slice((page - 1) * perPage, page * perPage)
  useEffect(() => { setPage(1) }, [search, methodFilter, perPage])

  const exportCSV = () => {
    const headers = ['id', 'datetime', 'payment_method', 'customer_name', 'customer_phone', 'credit_due_date', 'credit_remaining', 'items_count', 'subtotal', 'discount', 'total', 'refund_total', 'net_total', 'amount_paid', 'change']
    const lines = [headers.join(',')]
    for (const o of filtered) {
      const items = Array.isArray(o.items) ? o.items : []
      const itemsCount = items.reduce((s, it) => s + netQtyOf(it), 0)
      const subtotal = (Number(o.total) || 0) + (Number(o.discount) || 0)
      const refund = Number(o.refund_total) || 0
      const net = netTotalOf(o)
      lines.push([
        o.id, `"${formatDateTime(o.created_at)}"`, o.payment_method || 'cash',
        `"${o.customer_name || ''}"`, `"${o.customer_phone || ''}"`, o.credit_due_date || '',
        o.payment_method === 'credit' ? Math.max(0, (Number(o.total) || 0) - (Number(o.amount_paid) || 0) - refund) : 0,
        itemsCount, subtotal, o.discount || 0, o.total, refund, net, o.amount_paid || 0, o.change_amount || 0
      ].join(','))
    }
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales_${from || 'all'}_${to || 'now'}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  // ── ລາຍງານການຂາຍປະຈຳວັນ ────────────────────────────────────────────────────
  const rangeLabel = serverSearch
    ? `ຄົ້ນຫາ “${serverSearch}” (ທົ່ວປະຫວັດ)`
    : (from || to ? `${from || 'ເລີ່ມຕົ້ນ'} ຫາ ${to || 'ປັດຈຸບັນ'}` : 'ທຸກຊ່ວງເວລາ')
  const branchLabel = branchFilter
    ? (branches.find(b => String(b.id) === String(branchFilter))?.name || '—')
    : 'ທຸກສາຂາ'
  const fileStamp = `${from || 'all'}_${to || 'now'}`

  const exportDailyExcel = async () => {
    const num = { numFmt: '#,##0' }
    await downloadWorkbookMulti({
      fileName: `sales_daily_${fileStamp}.xlsx`,
      sheets: [
        {
          name: 'ສະຫຼຸບປະຈຳວັນ',
          title: `ລາຍງານການຂາຍປະຈຳວັນ · ${rangeLabel} · ${branchLabel}`,
          columns: [
            { header: 'ວັນທີ', key: 'date', width: 14 },
            { header: 'ຈຳນວນບິນ', key: 'count', width: 12, ...num },
            { header: 'ຈຳນວນຊິ້ນ', key: 'qty', width: 12, ...num },
            { header: 'ຍອດກ່ອນຫຼຸດ', key: 'gross', width: 16, ...num },
            { header: 'ສ່ວນຫຼຸດ', key: 'discount', width: 14, ...num },
            { header: 'ຮັບຄືນ', key: 'refund', width: 14, ...num },
            { header: 'ລາຍຮັບສຸດທິ', key: 'total', width: 16, ...num },
            { header: '💵 ສົດ', key: 'cash', width: 14, ...num },
            { header: '🏦 ໂອນ', key: 'transfer', width: 14, ...num },
            { header: '📱 QR', key: 'qr', width: 14, ...num },
            { header: '🎯 ປະສົມ', key: 'mixed', width: 14, ...num },
            { header: '🧾 ຕິດໜີ້', key: 'credit', width: 14, ...num },
            { header: 'ຍອດຄ້າງຕິດໜີ້', key: 'creditRemaining', width: 16, ...num },
            { header: 'ສະເລ່ຍ/ບິນ', key: 'avg', width: 14, ...num },
          ],
          rows: [
            ...dailyBreakdown.map(d => ({
              date: formatDate(d.date), count: d.count, qty: Math.round(d.qty),
              gross: Math.round(d.gross), discount: Math.round(d.discount), refund: Math.round(d.refund),
              total: Math.round(d.total), cash: Math.round(d.cash), transfer: Math.round(d.transfer),
              qr: Math.round(d.qr), mixed: Math.round(d.mixed), credit: Math.round(d.credit),
              creditRemaining: Math.round(d.creditRemaining),
              avg: d.count > 0 ? Math.round(d.total / d.count) : 0,
            })),
            {
              date: 'ລວມທັງໝົດ',
              count: stats.count, qty: Math.round(stats.itemsCount),
              gross: Math.round(stats.total + stats.discount + stats.refundTotal),
              discount: Math.round(stats.discount), refund: Math.round(stats.refundTotal),
              total: Math.round(stats.total),
              cash: Math.round(stats.methods.cash.total), transfer: Math.round(stats.methods.transfer.total),
              qr: Math.round(stats.methods.qr.total), mixed: Math.round(stats.methods.mixed.total),
              credit: Math.round(stats.methods.credit.total),
              creditRemaining: Math.round(stats.creditRemaining),
              avg: Math.round(stats.avg),
            },
          ],
        },
        {
          name: 'ລາຍລະອຽດບິນ',
          title: `ລາຍລະອຽດບິນຂາຍ · ${rangeLabel}`,
          columns: [
            { header: 'ເລກບິນ', key: 'bill', width: 20 },
            { header: 'ວັນທີ/ເວລາ', key: 'dt', width: 20 },
            { header: 'ວິທີຊຳລະ', key: 'method', width: 12 },
            { header: 'ລູກຄ້າ', key: 'customer', width: 24 },
            { header: 'ເບີໂທ', key: 'phone', width: 14 },
            { header: 'ຈຳນວນຊິ້ນ', key: 'qty', width: 12, ...num },
            { header: 'ຍອດກ່ອນຫຼຸດ', key: 'gross', width: 16, ...num },
            { header: 'ສ່ວນຫຼຸດ', key: 'discount', width: 14, ...num },
            { header: 'ຮັບຄືນ', key: 'refund', width: 14, ...num },
            { header: 'ຍອດສຸດທິ', key: 'net', width: 16, ...num },
            { header: 'ຮັບເງິນ', key: 'paid', width: 14, ...num },
            { header: 'ທອນ', key: 'change', width: 12, ...num },
            { header: 'ຍອດຄ້າງ', key: 'due', width: 14, ...num },
            { header: 'ໝາຍເຫດ', key: 'note', width: 28 },
          ],
          rows: filtered.map(o => {
            const refund = Number(o.refund_total) || 0
            const gross = Number(o.total) || 0
            return {
              bill: o.bill_number || `#${o.id}`,
              dt: formatDateTime(o.created_at),
              method: (methodMeta[o.payment_method || 'cash'] || methodMeta.cash).label,
              customer: o.customer_name || '', phone: o.customer_phone || '',
              qty: Math.round((o.items || []).reduce((s, it) => s + netQtyOf(it), 0)),
              gross: Math.round(gross + (Number(o.discount) || 0)),
              discount: Math.round(Number(o.discount) || 0),
              refund: Math.round(refund),
              net: Math.round(netTotalOf(o)),
              paid: Math.round(Number(o.amount_paid) || 0),
              change: Math.round(Number(o.change_amount) || 0),
              due: o.payment_method === 'credit'
                ? Math.round(Math.max(0, gross - (Number(o.amount_paid) || 0) - refund)) : 0,
              note: o.note || '',
            }
          }),
        },
        {
          name: 'ສິນຄ້າຂາຍດີ',
          title: `ສິນຄ້າຂາຍດີ · ${rangeLabel}`,
          columns: [
            { header: 'ອັນດັບ', key: 'rank', width: 10 },
            { header: 'ຊື່ສິນຄ້າ', key: 'name', width: 42 },
            { header: 'ຈຳນວນ (ສຸດທິ)', key: 'qty', width: 16, ...num },
            { header: 'ລາຍຮັບ', key: 'revenue', width: 18, ...num },
          ],
          rows: topProducts.map((p, i) => ({
            rank: i + 1, name: p.name, qty: Math.round(p.qty), revenue: Math.round(p.revenue),
          })),
        },
      ],
    })
  }

  const exportDailyPdf = () => {
    const dailyTable = {
      title: `ສະຫຼຸບຕໍ່ວັນ (${dailyBreakdown.length} ວັນ)`,
      columns: [
        { header: 'ວັນທີ', align: 'left', width: '10%' },
        { header: 'ບິນ', align: 'right', width: '6%' },
        { header: 'ຊິ້ນ', align: 'right', width: '6%' },
        { header: 'ຍອດກ່ອນຫຼຸດ', align: 'right' },
        { header: 'ສ່ວນຫຼຸດ', align: 'right' },
        { header: 'ຮັບຄືນ', align: 'right' },
        { header: '💵 ສົດ', align: 'right' },
        { header: '🏦 ໂອນ', align: 'right' },
        { header: '📱 QR', align: 'right' },
        { header: '🧾 ຕິດໜີ້', align: 'right' },
        { header: 'ລາຍຮັບສຸດທິ', align: 'right' },
      ],
      rows: dailyBreakdown.map(d => [
        formatDate(d.date), fmtNum(d.count), fmtNum(Math.round(d.qty)),
        fmtNum(Math.round(d.gross)), fmtNum(Math.round(d.discount)), fmtNum(Math.round(d.refund)),
        fmtNum(Math.round(d.cash)), fmtNum(Math.round(d.transfer)), fmtNum(Math.round(d.qr)),
        fmtNum(Math.round(d.credit)), fmtNum(Math.round(d.total)),
      ]),
      totals: dailyBreakdown.length ? [
        'ລວມ', fmtNum(stats.count), fmtNum(Math.round(stats.itemsCount)),
        fmtNum(Math.round(stats.total + stats.discount + stats.refundTotal)),
        fmtNum(Math.round(stats.discount)), fmtNum(Math.round(stats.refundTotal)),
        fmtNum(Math.round(stats.methods.cash.total)), fmtNum(Math.round(stats.methods.transfer.total)),
        fmtNum(Math.round(stats.methods.qr.total)), fmtNum(Math.round(stats.methods.credit.total)),
        fmtNum(Math.round(stats.total)),
      ] : null,
    }
    const topTable = {
      title: `ສິນຄ້າຂາຍດີ (Top ${topProducts.length})`,
      columns: [
        { header: 'ອັນດັບ', align: 'left', width: '8%' },
        { header: 'ຊື່ສິນຄ້າ', align: 'left' },
        { header: 'ຈຳນວນ (ສຸດທິ)', align: 'right', width: '18%' },
        { header: 'ລາຍຮັບ', align: 'right', width: '20%' },
      ],
      rows: topProducts.map((p, i) => [
        String(i + 1), p.name, fmtNum(Math.round(p.qty)), fmtNum(Math.round(p.revenue)),
      ]),
    }
    printReportA4({
      company,
      landscape: true,
      title: 'ລາຍງານການຂາຍປະຈຳວັນ',
      subtitle: 'ຍອດສຸດທິຫຼັງຫັກສ່ວນຫຼຸດ ແລະ ການຮັບຄືນສິນຄ້າ',
      meta: [
        { label: 'ຊ່ວງວັນທີ', value: rangeLabel },
        { label: 'ສາຂາ', value: branchLabel },
        { label: 'ຈຳນວນບິນ', value: `${fmtNum(stats.count)} ບິນ` },
        ...(methodFilter ? [{ label: 'ວິທີຊຳລະ', value: (methodMeta[methodFilter] || {}).label || methodFilter }] : []),
      ],
      kpis: [
        { label: 'ຈຳນວນບິນ', value: fmtNum(stats.count) },
        { label: 'ລາຍຮັບສຸດທິ', value: fmtNum(Math.round(stats.total)), accent: 'emerald' },
        { label: 'ສະເລ່ຍ/ບິນ', value: fmtNum(Math.round(stats.avg)), accent: 'cyan' },
        { label: 'ສ່ວນຫຼຸດ', value: fmtNum(Math.round(stats.discount)), accent: 'amber' },
        { label: 'ຮັບຄືນ', value: fmtNum(Math.round(stats.refundTotal)), accent: 'rose' },
      ],
      tables: topProducts.length ? [dailyTable, topTable] : [dailyTable],
    })
  }

  const handleDelete = async (order) => {
    if (!confirm(`ລົບບິນ ${order.bill_number || `#${order.id}`}?\nສະຕ໊ອກສິນຄ້າໃນບິນນີ້ຈະຖືກຄືນ.`)) return
    setDeletingId(order.id)
    try {
      const res = await fetch(`${API}/orders/${order.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'ບໍ່ສາມາດລົບບິນໄດ້')
        return
      }
      if (expandedId === order.id) setExpandedId(null)
      await load()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Sales history"
        title="📋 ປະຫວັດການຂາຍ"
        subtitle={from || to ? `${from || '...'} → ${to || '...'} · ${fmtNum(filtered.length)} ບິນ` : `ທຸກຊ່ວງເວລາ · ${fmtNum(filtered.length)} ບິນ`}
        action={
          <div className="flex gap-2 flex-wrap">
            <button onClick={exportDailyExcel} disabled={filtered.length === 0}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-emerald-950/20"
              title="ລາຍງານການຂາຍປະຈຳວັນ (Excel)">
              ⬇ Excel
            </button>
            <button onClick={exportDailyPdf} disabled={filtered.length === 0}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-rose-950/20"
              title="ລາຍງານການຂາຍປະຈຳວັນ (PDF)">
              🖨 PDF
            </button>
            <button onClick={exportCSV} disabled={filtered.length === 0}
              className="rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 disabled:opacity-50 px-4 py-3 text-sm font-extrabold text-white">
              📥 CSV
            </button>
            <button onClick={() => load()}
              className="rounded-xl bg-red-600 hover:bg-red-700 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-red-950/20">
              ↻ ໂຫຼດໃໝ່
            </button>
          </div>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
        {kpis.map((k, i) => (
          <div key={i} className={`rounded-lg border p-3 ${kpiColor[k.color]}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{k.l}</div>
            <div className="text-xl font-extrabold mt-1 leading-tight">{k.v}</div>
            <div className="text-[10px] opacity-70 mt-0.5 truncate">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Date filter + quick ranges */}
      <div className="bg-white border border-slate-200 rounded-lg p-2 mb-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase">ຈາກ</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs outline-none focus:border-red-500" />
          <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">ຫາ</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs outline-none focus:border-red-500" />
          <button onClick={() => applyRange(from, to)}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-[11px] font-bold">
            ຄົ້ນຫາ
          </button>
        </div>
        <div className="flex bg-slate-50 border border-slate-200 rounded-md overflow-hidden">
          <button onClick={() => quickRange(1)} className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-white">ມື້ນີ້</button>
          <button onClick={() => quickRange(7)} className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-white border-l border-slate-200">7ວັນ</button>
          <button onClick={() => quickRange(30)} className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-white border-l border-slate-200">30ວັນ</button>
          <button onClick={thisMonth} className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-white border-l border-slate-200">ເດືອນນີ້</button>
          <button onClick={lastMonth} className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-white border-l border-slate-200">ເດືອນກ່ອນ</button>
        </div>
        {(from || to) && (
          <button onClick={() => applyRange('', '')}
            className="text-[11px] text-slate-400 hover:text-rose-500 flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            ລ້າງ
          </button>
        )}
      </div>

      {serverSearch && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">
          🔎 ກຳລັງຄົ້ນຫາ “{serverSearch}” ທົ່ວປະຫວັດການຂາຍ (ບໍ່ຈຳກັດຊ່ວງວັນທີ) · ພົບ {fmtNum(filtered.length)} ບິນ
          <button onClick={clearBillSearch}
            className="ml-auto px-2 py-1 rounded bg-white border border-amber-200 hover:bg-amber-100 text-amber-700">
            ✕ ອອກຈາກການຄົ້ນຫາ
          </button>
        </div>
      )}

      {/* Daily chart + top products */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
          {/* Daily chart */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">📊 ລາຍຮັບລາຍວັນ</h3>
              <span className="text-[10px] text-slate-400 font-mono">{dailyBreakdown.length} ວັນ</span>
            </div>
            <div className="flex items-end gap-0.5 h-32">
              {dailyBreakdown.map(d => {
                const pct = (d.total / maxDaily) * 100
                const isMax = d.total === maxDaily
                return (
                  <div key={d.date} className="flex-1 min-w-0 flex flex-col items-center group relative">
                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 bg-slate-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none">
                      <div className="font-mono">{d.date}</div>
                      <div className="font-bold">{fmtPrice(d.total)}</div>
                      <div className="text-slate-400">{d.count} ບິນ</div>
                    </div>
                    <div className={`w-full rounded-t transition-all ${isMax ? 'bg-red-500' : 'bg-slate-300 group-hover:bg-red-400'}`}
                      style={{ height: `${Math.max(pct, 2)}%` }}></div>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between mt-1 text-[9px] text-slate-400 font-mono">
              <span>{dailyBreakdown[0]?.date || ''}</span>
              <span>{dailyBreakdown[dailyBreakdown.length - 1]?.date || ''}</span>
            </div>
          </div>

          {/* Top products */}
          <div className="bg-white border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">🏆 ສິນຄ້າຂາຍດີ</h3>
              <span className="text-[10px] text-slate-400 font-mono">Top {topProducts.length}</span>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-[12px]">
                  <span className={`shrink-0 w-5 h-5 rounded text-[10px] font-extrabold flex items-center justify-center ${
                    i === 0 ? 'bg-yellow-100 text-yellow-700' :
                    i === 1 ? 'bg-slate-200 text-slate-700' :
                    i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                  }`}>{i + 1}</span>
                  <span className="flex-1 truncate text-slate-700 font-semibold">{p.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{fmtNum(p.qty)}×</span>
                  <span className="text-[11px] text-emerald-700 font-extrabold font-mono">{fmtCompact(p.revenue)}</span>
                </div>
              ))}
              {topProducts.length === 0 && <div className="text-center text-slate-400 text-xs py-4">ບໍ່ມີຂໍ້ມູນ</div>}
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-2 mb-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[300px] flex items-center gap-1.5">
          <div className="relative flex-1">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="text" placeholder="ຄົ້ນຫາເລກບິນ, ID, ຊື່ສິນຄ້າ, ລູກຄ້າ, ໝາຍເຫດ... (ກົດ Enter ຄົ້ນທົ່ວປະຫວັດ)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') runBillSearch() }}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs outline-none focus:border-red-500" />
          </div>
          <button onClick={runBillSearch} disabled={loading}
            className="shrink-0 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-md text-[11px] font-bold"
            title="ຄົ້ນຫາທົ່ວປະຫວັດ ບໍ່ຈຳກັດຊ່ວງວັນທີ">
            ຄົ້ນທົ່ວປະຫວັດ
          </button>
        </div>
        <div className="flex bg-slate-50 border border-slate-200 rounded-md overflow-hidden">
          {[
            { key: '', label: 'ທັງໝົດ' },
            { key: 'cash', label: `💵 ສົດ · ${stats.methods.cash.count}`, cls: 'bg-emerald-500 text-white' },
            { key: 'transfer', label: `🏦 ໂອນ · ${stats.methods.transfer.count}`, cls: 'bg-red-500 text-white' },
            { key: 'qr', label: `📱 QR · ${stats.methods.qr.count}`, cls: 'bg-violet-500 text-white' },
            { key: 'credit', label: `🧾 ຕິດໜີ້ · ${stats.methods.credit.count}`, cls: 'bg-rose-500 text-white' },
            ...(stats.methods.mixed.count > 0 ? [{ key: 'mixed', label: `🎯 ປະສົມ · ${stats.methods.mixed.count}`, cls: 'bg-amber-500 text-white' }] : []),
          ].map(s => (
            <button key={s.key} onClick={() => setMethodFilter(s.key)}
              className={`px-2.5 py-1.5 text-[11px] font-semibold ${methodFilter === s.key ? (s.cls || 'bg-slate-800 text-white') : 'text-slate-500 hover:bg-white'}`}>
              {s.label}
            </button>
          ))}
        </div>
        {branches.length > 1 && (
          <select
            value={branchFilter}
            onChange={e => setBranchFilter(e.target.value)}
            className="px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-md text-xs font-bold outline-none cursor-pointer"
            title="ສາຂາ"
          >
            <option value="">🏬 ທຸກສາຂາ</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <select value={perPage} onChange={e => setPerPage(Number(e.target.value))}
          className="px-2 py-1.5 bg-white border border-slate-200 rounded-md text-xs outline-none cursor-pointer">
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
        </select>
        <span className="text-[11px] text-slate-400 font-mono ml-auto">{filtered.length}/{orders.length}</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-red-600 rounded-full animate-spin"></div>
          <p className="mt-3 text-xs text-slate-400">ກຳລັງໂຫຼດ...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-550px)] overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                  <th className="w-8"></th>
                  <th className="text-left py-2 px-3 whitespace-nowrap">ID</th>
                  <th className="text-left py-2 px-3 whitespace-nowrap">ວັນທີ/ເວລາ</th>
                  <th className="text-center py-2 px-3 whitespace-nowrap">ວິທີ</th>
                  <th className="text-left py-2 px-3 whitespace-nowrap">ລູກຄ້າ</th>
                  <th className="text-right py-2 px-3 w-16">ຊິ້ນ</th>
                  <th className="text-right py-2 px-3 whitespace-nowrap">ຫຼຸດ</th>
                  <th className="text-right py-2 px-3 whitespace-nowrap">ຍອດລວມ</th>
                  <th className="text-right py-2 px-3 whitespace-nowrap">ຮັບ</th>
                  <th className="text-right py-2 px-3 whitespace-nowrap">ທອນ</th>
                  <th className="text-right py-2 px-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.map(o => {
                  const m = methodMeta[o.payment_method || 'cash'] || methodMeta.cash
                  const itemsCount = (o.items || []).reduce((s, it) => s + netQtyOf(it), 0)
                  const isExpanded = expandedId === o.id
                  return (
                    <Row key={o.id} o={o} m={m} itemsCount={itemsCount} isExpanded={isExpanded}
                      deleting={deletingId === o.id}
                      canDelete={perm.delete}
                      onToggle={() => setExpandedId(isExpanded ? null : o.id)}
                      onDelete={() => handleDelete(o)} />
                  )
                })}
                {paged.length === 0 && (
                  <tr><td colSpan="11" className="text-center text-slate-300 py-12 text-xs">ບໍ່ມີຂໍ້ມູນການຂາຍ</td></tr>
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot className="sticky bottom-0 bg-slate-50 border-t-2 border-slate-200">
                  <tr className="text-[11px] font-extrabold">
                    <td colSpan="6" className="py-2 px-3 text-right text-slate-500 uppercase tracking-wider">ລວມ ({filtered.length} ບິນ)</td>
                    <td className="py-2 px-3 text-right font-mono text-amber-700">{fmtPrice(stats.discount)}</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-700">{fmtPrice(stats.total)}</td>
                    <td colSpan="3"></td>
                  </tr>
                </tfoot>
              )}
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
    </div>
  )
}

function Row({ o, m, itemsCount, isExpanded, deleting, canDelete, onToggle, onDelete }) {
  const refundTotal = Number(o.refund_total) || 0
  const grossTotal = Number(o.total) || 0
  const netTotal = Math.max(0, grossTotal - refundTotal)
  const hasReturn = refundTotal > 0
  return (
    <>
      <tr className="hover:bg-red-50/20 cursor-pointer" onClick={onToggle}>
        <td className="py-1.5 px-2 text-center">
          <span className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▸</span>
        </td>
        <td className="py-1.5 px-3 whitespace-nowrap">
          <span className="inline-block font-mono text-[11px] font-extrabold bg-red-50 text-red-700 px-1.5 py-0.5 rounded whitespace-nowrap">{o.bill_number || `#${o.id}`}</span>
        </td>
        <td className="py-1.5 px-3 text-[11px] font-mono text-slate-500 whitespace-nowrap">{fmtDT(o.created_at)}</td>
        <td className="py-1.5 px-3 text-center whitespace-nowrap">
          <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded whitespace-nowrap bg-${m.color}-50 text-${m.color}-700 border border-${m.color}-100`}>
            {m.icon} {m.label}
          </span>
        </td>
        <td className="py-1.5 px-3 text-[11px] text-slate-600">
          {o.payment_method === 'credit' ? (
            <div className="leading-tight">
              <div className="font-bold text-rose-700 truncate max-w-[160px]">{o.customer_name || '—'}</div>
              <div className="text-[10px] text-slate-400">
                {o.credit_due_date ? `ຄົບ ${formatDate(o.credit_due_date)}` : 'ບໍ່ມີວັນຄົບ'}
              </div>
            </div>
          ) : (
            <span className="text-slate-300">—</span>
          )}
        </td>
        <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-700">{fmtNum(itemsCount)}</td>
        <td className="py-1.5 px-3 text-right font-mono text-amber-700">
          {Number(o.discount) > 0 ? `−${fmtNum(o.discount)}` : <span className="text-slate-300">—</span>}
        </td>
        <td className="py-1.5 px-3 text-right font-mono">
          <div className="font-extrabold text-emerald-700">{fmtNum(netTotal)}</div>
          {hasReturn && (
            <div className="text-[10px] text-rose-600 font-bold leading-tight">↩ {fmtNum(refundTotal)}</div>
          )}
        </td>
        <td className="py-1.5 px-3 text-right font-mono text-slate-500">{fmtNum(o.amount_paid)}</td>
        <td className={`py-1.5 px-3 text-right font-mono ${o.payment_method === 'credit' ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
          {o.payment_method === 'credit' ? fmtNum(Math.max(0, grossTotal - (Number(o.amount_paid) || 0) - refundTotal)) : fmtNum(o.change_amount)}
        </td>
        <td className="py-1.5 px-3 text-right">
          {canDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            disabled={deleting}
            className="inline-flex h-7 w-7 items-center justify-center rounded bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:cursor-wait disabled:opacity-50"
            title="ລົບບິນ"
          >
            {deleting
              ? <span className="h-3 w-3 rounded-full border-2 border-rose-200 border-t-rose-600 animate-spin"></span>
              : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>}
          </button>
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-slate-50/50">
          <td colSpan="11" className="px-3 py-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">ລາຍການໃນບິນ ({(o.items || []).length})</div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-[10px] text-slate-400 border-b border-slate-200">
                  <th className="text-left py-1 px-2">ສິນຄ້າ</th>
                  <th className="text-right py-1 px-2 w-16">ຈຳນວນ</th>
                  <th className="text-right py-1 px-2 w-24">ລາຄາ</th>
                  <th className="text-right py-1 px-2 w-24">ລວມ</th>
                </tr>
              </thead>
              <tbody>
                {(o.items || []).map((it, i) => {
                  const qty = Number(it?.quantity) || 0
                  const returned = Number(it?.returned_qty) || 0
                  const net = Math.max(0, qty - returned)
                  return (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-1 px-2 text-slate-700">{it?.product_name || '—'}</td>
                      <td className="py-1 px-2 text-right font-mono">
                        {fmtNum(net)}
                        {returned > 0 && <span className="ml-1 text-[10px] text-rose-600">(↩{fmtNum(returned)}/{fmtNum(qty)})</span>}
                      </td>
                      <td className="py-1 px-2 text-right font-mono text-slate-500">{fmtNum(it?.price)}</td>
                      <td className="py-1 px-2 text-right font-mono font-bold text-emerald-700">{fmtNum((Number(it?.price) || 0) * net)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {o.note && (
              <div className="mt-2 text-[11px] text-slate-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                📝 {o.note}
              </div>
            )}
            {hasReturn && (
              <div className="mt-2 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1">
                ↩ ມີການຮັບຄືນ · ກ່ອນ {fmtPrice(grossTotal)} − ຮັບຄືນ {fmtPrice(refundTotal)} = ສຸດທິ {fmtPrice(netTotal)}
              </div>
            )}
            {o.payment_method === 'credit' && (
              <div className="mt-2 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1">
                🧾 ບິນຕິດໜີ້ · {o.customer_name || '—'}{o.customer_phone ? ` · ${o.customer_phone}` : ''} · ຍອດຄ້າງ {fmtPrice(Math.max(0, grossTotal - (Number(o.amount_paid) || 0) - refundTotal))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
