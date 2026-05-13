'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { calculatePromotions } from '../utils/promotions'
import { useCompanyProfile } from '../utils/useCompanyProfile'
import { connectCashDrawer, isCashDrawerSupported, openCashDrawer } from '../utils/cashDrawer'
import { useLocations } from '../utils/useLocations'
import { useBranches } from '../utils/useBranches'
import { firstAccessibleAdminPath } from '../utils/adminPermissions'
import { normalizeVatSettings, applyVat } from '../lib/vat'
import { applyRounding } from '../lib/rounding'
import SearchSelect from './SearchSelect'
import ThemeToggle from './admin/ThemeToggle'

const API = '/api'
const POS_DRAFT_KEY = 'pos_sale_draft_v1'

function formatPrice(price) { return new Intl.NumberFormat('lo-LA').format(price) + ' ₭' }
function formatNumber(n) { return new Intl.NumberFormat('lo-LA').format(n) }
function dateAfterDays(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}
function daysUntilDate(dateText) {
  if (!dateText) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateText)
  if (Number.isNaN(due.getTime())) return ''
  due.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86400000)
}

function readPosDraft() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(POS_DRAFT_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw)
    return draft && typeof draft === 'object' ? draft : null
  } catch {
    return null
  }
}

function clearPosDraft() {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(POS_DRAFT_KEY) } catch {}
}

function PromoCard({ promo, products }) {
  const TYPE_META = {
    price_override:   { label: 'ກຳນົດລາຄາໃໝ່',   icon: '💲', tint: 'bg-sky-100 text-sky-700' },
    item_percent:     { label: 'ຫຼຸດ %',          icon: '%',  tint: 'bg-emerald-100 text-emerald-700' },
    item_fixed:       { label: 'ຫຼຸດເງິນ',         icon: '₭',  tint: 'bg-emerald-100 text-emerald-700' },
    fixed:            { label: 'ຫຼຸດເງິນ',         icon: '₭',  tint: 'bg-emerald-100 text-emerald-700' },
    buy_n_discount:   { label: 'ຊື້ N ຫຼຸດ %',    icon: '🛒', tint: 'bg-amber-100 text-amber-700' },
    bogo:             { label: 'ຊື້ N ແຖມ M',     icon: '🎁', tint: 'bg-violet-100 text-violet-700' },
    bogo_cross:       { label: 'ຊື້ A ແຖມ B',     icon: '🎁', tint: 'bg-violet-100 text-violet-700' },
    bundle_gift:      { label: 'ຊື້ຄົບ ແຖມ',      icon: '🎀', tint: 'bg-rose-100 text-rose-700' },
    cart_percent:     { label: 'ຫຼຸດ % ທັງບິນ',   icon: '%',  tint: 'bg-blue-100 text-blue-700' },
    cart_fixed:       { label: 'ຫຼຸດເງິນທັງບິນ',  icon: '₭',  tint: 'bg-blue-100 text-blue-700' },
  }
  const meta = TYPE_META[promo.type] || { label: promo.type, icon: '🎁', tint: 'bg-slate-100 text-slate-700' }
  const fmtN = n => new Intl.NumberFormat('lo-LA').format(Number(n) || 0)
  const fmtK = n => `${fmtN(Math.round(Number(n) || 0))} ₭`
  const fmtDate = s => s ? String(s).split('T')[0] : null
  const today = new Date().toISOString().split('T')[0]

  // Build a human-readable effect line
  const effect = (() => {
    switch (promo.type) {
      case 'price_override': return `ປ່ຽນລາຄາເປັນ ${fmtK(promo.value)}`
      case 'item_percent': return `ຫຼຸດ ${fmtN(promo.value)}%`
      case 'item_fixed':
      case 'fixed': return `ຫຼຸດ ${fmtK(promo.value)}/ຊິ້ນ`
      case 'buy_n_discount': return `ຊື້ ${fmtN(promo.buy_qty)} → ຫຼຸດ ${fmtN(promo.value)}%`
      case 'bogo': return `ຊື້ ${fmtN(promo.buy_qty)} → ແຖມ ${fmtN(promo.get_qty)} (ສິນຄ້າດຽວກັນ)`
      case 'bogo_cross':
      case 'bundle_gift': {
        const gift = products?.find?.(p => Number(p.id) === Number(promo.gift_product_id))
        const giftName = gift?.product_name || `#${promo.gift_product_id || '—'}`
        return `ຊື້ ${fmtN(promo.buy_qty)} → ແຖມ ${fmtN(promo.get_qty)} × ${giftName}`
      }
      case 'cart_percent': return `ຫຼຸດ ${fmtN(promo.value)}% ທັງບິນ`
      case 'cart_fixed': return `ຫຼຸດ ${fmtK(promo.value)} ທັງບິນ`
      default: return ''
    }
  })()

  // Scope summary
  const scopeText = (() => {
    const s = promo.scope || 'all'
    if (s === 'all') return 'ສິນຄ້າທັງໝົດ'
    const ids = Array.isArray(promo.scope_ids) ? promo.scope_ids : []
    if (s === 'product') {
      const names = ids.map(id => products?.find?.(p => Number(p.id) === Number(id))?.product_name).filter(Boolean)
      if (names.length === 0) return 'ສິນຄ້າທີ່ກຳນົດ'
      if (names.length <= 2) return names.join(', ')
      return `${names.slice(0, 2).join(', ')} +${names.length - 2}`
    }
    if (s === 'category') return `ໝວດ: ${ids.join(', ') || '—'}`
    if (s === 'brand')    return `ຍີ່ຫໍ້: ${ids.join(', ') || '—'}`
    return s
  })()

  const expired = promo.end_date && fmtDate(promo.end_date) < today
  const notStarted = promo.start_date && fmtDate(promo.start_date) > today
  const couponGated = !!promo.require_coupon_code

  return (
    <div className="border border-slate-200 rounded-xl p-3 bg-white hover:border-violet-300 transition">
      <div className="flex items-start gap-2">
        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-base ${meta.tint}`}>{meta.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-extrabold text-slate-900 text-sm leading-tight">{promo.name || '—'}</span>
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${meta.tint}`}>{meta.label}</span>
            {promo.stackable === false && (
              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">ບໍ່ stack</span>
            )}
            {couponGated && (
              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">ໃຊ້ coupon: {promo.require_coupon_code}</span>
            )}
            {expired && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">ໝົດອາຍຸ</span>}
            {notStarted && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">ຍັງບໍ່ເລີ່ມ</span>}
          </div>
          <div className="mt-1 text-[12px] text-slate-700 font-semibold">{effect}</div>
          <div className="mt-1 text-[11px] text-slate-500">ກັບ: {scopeText}</div>
          {(promo.start_date || promo.end_date) && (
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              {fmtDate(promo.start_date) || '—'} → {fmtDate(promo.end_date) || '—'}
              {(promo.start_time || promo.end_time) && ` · ${promo.start_time || '—'}–${promo.end_time || '—'}`}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function QtyInput({ value, max, onCommit }) {
  const [v, setV] = useState(String(value))
  useEffect(() => { setV(String(value)) }, [value])
  const commit = () => {
    let n = parseInt(v, 10)
    if (!Number.isFinite(n) || n < 1) n = 1
    if (max && n > max) n = max
    setV(String(n))
    if (n !== value) onCommit(n)
  }
  return (
    <input
      type="number"
      inputMode="numeric"
      min="1"
      max={max || undefined}
      value={v}
      onChange={e => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
      onFocus={e => e.currentTarget.select()}
      className="px-1 w-12 h-7 text-center bg-slate-900 text-slate-100 font-extrabold outline-none border-x border-slate-700 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  )
}

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2500)
    return () => clearTimeout(timer)
  }, [onClose])
  const styles = { success: 'bg-emerald-600', error: 'bg-rose-600', info: 'bg-slate-800' }
  const icons = { success: '✓', error: '✕', info: 'ⓘ' }
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 ${styles[type]} text-white px-5 py-2.5 rounded-full shadow-2xl z-[60] flex items-center gap-2.5 animate-toast text-sm font-semibold`}>
      <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">{icons[type]}</span>
      {message}
    </div>
  )
}

function Modal({ children, onClose, title, size = 'md' }) {
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-3xl', '2xl': 'max-w-3xl' }
  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur flex items-center justify-center z-50 p-4 animate-fade-in text-slate-900" onClick={onClose}>
      <div className={`bg-white text-slate-900 rounded-2xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] overflow-hidden flex flex-col animate-scale-in`} onClick={e => e.stopPropagation()}>
        {title && (
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">{title}</h2>
            <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500">✕</button>
          </div>
        )}
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

const categoryMeta = {
  'ທໍ່ນ້ຳ': { icon: '🔧', tint: 'bg-amber-100 text-amber-900 border-amber-200' },
  'ກັອກນ້ຳ': { icon: '🚰', tint: 'bg-sky-100 text-sky-900 border-sky-200' },
  'ຂໍ້ຕໍ່': { icon: '🔗', tint: 'bg-violet-100 text-violet-900 border-violet-200' },
  'ວາວ': { icon: '⚙️', tint: 'bg-stone-200 text-stone-800 border-stone-300' },
  'ປັ໊ມນ້ຳ': { icon: '💧', tint: 'bg-teal-100 text-teal-900 border-teal-200' },
  'ອຸປະກອນອື່ນໆ': { icon: '🛠️', tint: 'bg-rose-100 text-rose-900 border-rose-200' }
}

const DEFAULT_MEMBER = {
  id: null,
  member_code: 'GENERAL',
  name: 'ລູກຄ້າທົ່ວໄປ',
  phone: '',
  points: 0,
  isDefault: true,
}

export default function POS({ user, onLogout }) {
  const router = useRouter()
  const company = useCompanyProfile()
  const laoLocations = useLocations()
  const { branches, activeBranch, activeBranchId, setActiveBranchId } = useBranches()
  const initialDraftRef = useRef(null)
  if (initialDraftRef.current === null) initialDraftRef.current = readPosDraft() || {}
  const initialDraft = initialDraftRef.current
  const searchInputRef = useRef(null)
  const lastScannedBarcodeRef = useRef('')
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState(() => Array.isArray(initialDraft.cart) ? initialDraft.cart : [])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [search, setSearch] = useState('')
  const [showCheckout, setShowCheckout] = useState(false)
  const [amountPaid, setAmountPaid] = useState(() => initialDraft.amountPaid || '')
  const [showReceipt, setShowReceipt] = useState(null)
  const [showOrders, setShowOrders] = useState(false)
  const [orders, setOrders] = useState([])
  const [returnsHistory, setReturnsHistory] = useState([])
  const [ordersTab, setOrdersTab] = useState('sales') // 'sales' | 'returns'
  const [showReturn, setShowReturn] = useState(false)
  const [returnSearch, setReturnSearch] = useState('')
  const [returnLookup, setReturnLookup] = useState(null)
  const [returnQty, setReturnQty] = useState({})
  const [returnMethod, setReturnMethod] = useState('cash')
  const [returnNote, setReturnNote] = useState('')
  const [returnBusy, setReturnBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const [discount, setDiscount] = useState(() => Number(initialDraft.discount) || 0)
  const [discountMode, setDiscountMode] = useState(() => initialDraft.discountMode === 'amount' ? 'amount' : 'percent') // 'percent' | 'amount'
  const [paymentMethod, setPaymentMethod] = useState(() => initialDraft.paymentMethod || 'cash')
  const [customerNote, setCustomerNote] = useState(() => initialDraft.customerNote || '')
  const [creditCustomer, setCreditCustomer] = useState(() => ({
    name: '',
    phone: '',
    dueDate: dateAfterDays(30),
    ...(initialDraft.creditCustomer || {}),
  }))
  const [members, setMembers] = useState([])
  const [memberSearch, setMemberSearch] = useState('')
  const [selectedMember, setSelectedMember] = useState(() => initialDraft.selectedMember || DEFAULT_MEMBER)
  const [memberForm, setMemberForm] = useState({ name: '', phone: '', province: '', district: '', village: '' })
  const [creatingMember, setCreatingMember] = useState(false)
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [showCatalog, setShowCatalog] = useState(false)
  const [showPromoList, setShowPromoList] = useState(false)
  const [lastScan, setLastScan] = useState(null)
  const [flash, setFlash] = useState(0)
  const [currencies, setCurrencies] = useState([])
  const [payments, setPayments] = useState(() => Array.isArray(initialDraft.payments) ? initialDraft.payments : []) // [{ currency, amount }]
  const [promotions, setPromotions] = useState([])
  const [dailySummary, setDailySummary] = useState(null)
  const [showDailySummary, setShowDailySummary] = useState(false)
  const [todayHandovers, setTodayHandovers] = useState([])
  const [handoverForm, setHandoverForm] = useState({ actual_cash: '', received_by: '', note: '' })
  const [handoverSaving, setHandoverSaving] = useState(false)
  const [drawerBusy, setDrawerBusy] = useState(false)
  const [drawerReady, setDrawerReady] = useState(false)
  const [cashDrawerSupported, setCashDrawerSupported] = useState(false)
  const [loyaltySettings, setLoyaltySettings] = useState({
    loyalty_enabled: true,
    points_per_amount: 10000,
    points_redeem_value: 0,
    min_points_to_redeem: 0,
  })
  const [pointsToRedeem, setPointsToRedeem] = useState(() => Number(initialDraft.pointsToRedeem) || 0)
  const [activeCurrencyCode, setActiveCurrencyCode] = useState('LAK')
  const [receiptSize, setReceiptSize] = useState(() => {
    if (typeof window === 'undefined') return '80mm'
    return localStorage.getItem('pos_receipt_size') || '80mm'
  })
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('pos_receipt_size', receiptSize)
  }, [receiptSize])
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (cart.length === 0) {
      clearPosDraft()
      return
    }
    try {
      localStorage.setItem(POS_DRAFT_KEY, JSON.stringify({
        cart,
        amountPaid,
        discount,
        discountMode,
        paymentMethod,
        customerNote,
        creditCustomer,
        selectedMember,
        payments,
        pointsToRedeem,
        savedAt: new Date().toISOString(),
      }))
    } catch {}
  }, [cart, amountPaid, discount, discountMode, paymentMethod, customerNote, creditCustomer, selectedMember, payments, pointsToRedeem])
  const [debtAlerts, setDebtAlerts] = useState(null)
  const [showDebtAlerts, setShowDebtAlerts] = useState(false)
  const customerWinRef = useRef(null)
  const bcRef = useRef(null)
  const customerStateRef = useRef(null)

  const fetchProducts = useCallback(async () => {
    const params = new URLSearchParams()
    if (selectedCategory) params.set('category', selectedCategory)
    if (search && showCatalog) params.set('search', search)
    const res = await fetch(`${API}/products?${params}`)
    const data = await res.json()
    setProducts(Array.isArray(data) ? data : [])
  }, [selectedCategory, search, showCatalog])

  useEffect(() => {
    fetch(`${API}/categories`).then(r => r.json()).then(list => {
      setCategories(Array.isArray(list) ? list : [])
    }).catch(() => setCategories([]))
  }, [])
  useEffect(() => {
    fetch(`${API}/currencies`).then(r => r.json()).then(list => {
      setCurrencies(Array.isArray(list) ? list.filter(c => c.enabled) : [])
    }).catch(() => setCurrencies([]))
  }, [])
  const loadMembers = useCallback((q = '') => {
    const params = new URLSearchParams()
    if (q.trim()) params.set('search', q.trim())
    fetch(`${API}/members?${params}`).then(r => r.json()).then(list => {
      setMembers(Array.isArray(list) ? list : [])
    }).catch(() => setMembers([]))
  }, [])
  useEffect(() => {
    const t = setTimeout(() => loadMembers(memberSearch), 180)
    return () => clearTimeout(t)
  }, [loadMembers, memberSearch])
  const reloadPromotions = useCallback(() => {
    fetch(`${API}/admin/promotions`).then(r => r.json()).then(list => {
      const active = Array.isArray(list) ? list.filter(p => p.active !== false) : []
      setPromotions(active)
      console.log(`[POS] Loaded ${active.length} active promotions:`, active.map(p => `${p.name} (${p.type})`))
    }).catch(err => {
      console.error('[POS] Failed to fetch promotions:', err)
      setPromotions([])
    })
  }, [])
  useEffect(() => { reloadPromotions() }, [reloadPromotions])
  // Auto-refresh promotions every 2 minutes (catches admin edits)
  useEffect(() => {
    const t = setInterval(reloadPromotions, 120000)
    return () => clearInterval(t)
  }, [reloadPromotions])
  useEffect(() => { fetchProducts() }, [fetchProducts])
  useEffect(() => { setCashDrawerSupported(isCashDrawerSupported()) }, [])
  useEffect(() => {
    fetch(`${API}/loyalty`).then(r => r.json()).then(data => {
      if (data && typeof data === 'object') setLoyaltySettings(s => ({ ...s, ...data }))
    }).catch(() => {})
  }, [])
  useEffect(() => { setPointsToRedeem(0) }, [selectedMember?.id])
  useEffect(() => {
    if (selectedMember?.isDefault && paymentMethod === 'credit') {
      setPaymentMethod('cash')
    }
  }, [selectedMember?.isDefault, paymentMethod])
  useEffect(() => {
    if (paymentMethod !== 'credit') return
    setCreditCustomer(c => c.dueDate ? c : { ...c, dueDate: dateAfterDays(30) })
  }, [paymentMethod])

  const loadDebtAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/customer-debts/alerts`)
      const data = await res.json()
      setDebtAlerts(data)
      return data
    } catch {
      setDebtAlerts(null)
      return null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const data = await loadDebtAlerts()
      if (cancelled || !data) return
      const overdue = data.counts?.overdue || 0
      const today = data.counts?.today || 0
      const upcoming = data.counts?.upcoming || 0
      if (overdue + today + upcoming === 0) return
      const todayKey = new Date().toISOString().slice(0, 10)
      const shownKey = localStorage.getItem('pos_debt_alerts_shown')
      if (shownKey !== todayKey) {
        localStorage.setItem('pos_debt_alerts_shown', todayKey)
        setShowDebtAlerts(true)
      }
    })()
    const t = setInterval(loadDebtAlerts, 5 * 60 * 1000)
    return () => { cancelled = true; clearInterval(t) }
  }, [loadDebtAlerts])

  // Layby state (declared here so anyModalOpen can reference showLaybyPicker)
  const [showLaybyPicker, setShowLaybyPicker] = useState(false)
  const [openLaybys, setOpenLaybys] = useState([])
  const [laybySearch, setLaybySearch] = useState('')
  const [loadedLayby, setLoadedLayby] = useState(null) // { id, layby_number, total, paid, balance, customer_name, customer_phone, member_id, discount, note }
  const [laybyBusy, setLaybyBusy] = useState(false)

  // Refocus scan input ONLY when all modals just closed (no polling to avoid stealing focus from other inputs)
  const anyModalOpen = showCheckout || showOrders || showReceipt || showCatalog || showDailySummary || showMemberModal || showDebtAlerts || showReturn || showPromoList || showLaybyPicker
  useEffect(() => {
    if (anyModalOpen) return
    const tmr = setTimeout(() => {
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return
      searchInputRef.current?.focus()
    }, 150)
    return () => clearTimeout(tmr)
  }, [anyModalOpen])

  const showToast = (message, type = 'info') => setToast({ message, type })
  const normalizeBarcode = useCallback(value => String(value || '').replace(/\s+/g, '').trim(), [])
  const findBarcodeMatch = useCallback((barcode, source = products) => {
    const normalizedBarcode = normalizeBarcode(barcode)
    if (!normalizedBarcode) return null
    // First: product-level barcode
    const product = source.find(p => normalizeBarcode(p.barcode) === normalizedBarcode)
    if (product) return { product, variant: null }
    // Then: variant barcode
    for (const p of source) {
      const variants = Array.isArray(p.variants) ? p.variants : []
      const v = variants.find(x => normalizeBarcode(x.barcode) === normalizedBarcode)
      if (v) return { product: p, variant: v }
    }
    return null
  }, [normalizeBarcode, products])

  const flashScreen = () => {
    setFlash(f => f + 1)
    setTimeout(() => setFlash(f => Math.max(0, f - 1)), 300)
  }

  const handleBarcodeAutoAdd = (match, barcode) => {
    const normalizedBarcode = normalizeBarcode(barcode)
    if (!match || !normalizedBarcode) return
    lastScannedBarcodeRef.current = normalizedBarcode
    if (match.variant) {
      addVariantToCart(match.product, match.variant)
    } else {
      addToCart(match.product)
    }
    setLastScan({ product: match.product, variant: match.variant, at: Date.now() })
    flashScreen()
    setSearch('')
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }

  const addToCart = (product) => {
    if (product.qty_on_hand <= 0) { showToast('ສິນຄ້າໝົດສະຕ໊ອກ', 'error'); return }
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.id && !item.variant_id)
      if (existing) {
        if (existing.quantity >= product.qty_on_hand) { showToast('ເກີນຈຳນວນສະຕ໊ອກ', 'error'); return prev }
        return prev.map(item => item === existing ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...prev, {
        product_id: product.id, name: product.product_name, code: product.product_code,
        price: Number(product.selling_price), unit: product.unit, quantity: 1, stock: product.qty_on_hand,
        category: product.category, brand: product.brand,
        variant_id: null, variant_name: null,
      }]
    })
  }

  const addVariantToCart = (product, variant) => {
    if (variant.qty_on_hand <= 0) { showToast(`ສິນຄ້າ "${variant.variant_name}" ໝົດ`, 'error'); return }
    const price = variant.selling_price != null ? Number(variant.selling_price) : Number(product.selling_price)
    setCart(prev => {
      const existing = prev.find(item => item.variant_id === variant.id)
      if (existing) {
        if (existing.quantity >= variant.qty_on_hand) { showToast('ເກີນຈຳນວນສະຕ໊ອກ', 'error'); return prev }
        return prev.map(item => item === existing ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...prev, {
        product_id: product.id, name: `${product.product_name} · ${variant.variant_name}`,
        code: variant.variant_code || product.product_code,
        price, unit: product.unit, quantity: 1, stock: variant.qty_on_hand,
        category: product.category, brand: product.brand,
        variant_id: variant.id, variant_name: variant.variant_name,
      }]
    })
  }

  const updateQuantity = (productId, delta, variantId = null) => {
    setCart(prev => prev.map(item => {
      const matches = item.product_id === productId && (item.variant_id || null) === (variantId || null)
      if (!matches) return item
      const newQty = item.quantity + delta
      if (newQty <= 0) return null
      if (newQty > item.stock) { showToast('ເກີນຈຳນວນສະຕ໊ອກ', 'error'); return item }
      return { ...item, quantity: newQty }
    }).filter(Boolean))
  }

  const setQuantity = (productId, qty, variantId = null) => {
    let n = Math.floor(Number(qty))
    if (!Number.isFinite(n) || n < 1) n = 1
    setCart(prev => prev.map(item => {
      const matches = item.product_id === productId && (item.variant_id || null) === (variantId || null)
      if (!matches) return item
      if (n > item.stock) { showToast('ເກີນຈຳນວນສະຕ໊ອກ', 'error'); return { ...item, quantity: item.stock } }
      return { ...item, quantity: n }
    }))
  }

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.product_id !== productId))
  }

  useEffect(() => {
    if (showCatalog) return
    const normalizedSearch = normalizeBarcode(search)
    if (!normalizedSearch) { lastScannedBarcodeRef.current = ''; return }
    const matchedProduct = findBarcodeMatch(normalizedSearch)
    if (!matchedProduct || lastScannedBarcodeRef.current === normalizedSearch) return
    handleBarcodeAutoAdd(matchedProduct, normalizedSearch)
  }, [search, products, findBarcodeMatch, normalizeBarcode, showCatalog])

  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.quantity, 0), [cart])
  const [activeCoupons, setActiveCoupons] = useState([]) // [{ code, name, id }]
  const [couponInput, setCouponInput] = useState('')
  const [couponBusy, setCouponBusy] = useState(false)
  const activeCouponCodes = useMemo(() => activeCoupons.map(c => c.code), [activeCoupons])

  const applyCoupon = useCallback(async (raw) => {
    const code = String(raw || couponInput || '').trim().toUpperCase()
    if (!code) return
    if (activeCoupons.some(c => c.code === code)) { showToast('Coupon ນີ້ໃຊ້ແລ້ວ', 'error'); return }
    setCouponBusy(true)
    try {
      const res = await fetch(`${API}/coupons/lookup?code=${encodeURIComponent(code)}`)
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'ບໍ່ພົບ Coupon', 'error'); setCouponBusy(false); return }
      setActiveCoupons(prev => [...prev, { id: data.id, code, name: data.name }])
      setCouponInput('')
      showToast(`✓ ໃຊ້ ${data.name}`, 'success')
    } catch {
      showToast('ບໍ່ສາມາດກວດສອບ Coupon', 'error')
    }
    setCouponBusy(false)
  }, [couponInput, activeCoupons])

  const removeCoupon = useCallback((code) => {
    setActiveCoupons(prev => prev.filter(c => c.code !== code))
  }, [])

  // Park & Recall ----------------------------------------------------------
  const [showParkedModal, setShowParkedModal] = useState(false)
  const [parkedCarts, setParkedCarts] = useState([])

  const loadParkedCarts = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (activeBranchId) params.set('branch_id', activeBranchId)
      const res = await fetch(`${API}/parked-carts?${params}`)
      const data = await res.json()
      setParkedCarts(Array.isArray(data) ? data : [])
    } catch {
      setParkedCarts([])
    }
  }, [activeBranchId])

  useEffect(() => { loadParkedCarts() }, [loadParkedCarts])

  const parkCurrentCart = useCallback(async () => {
    if (cart.length === 0) { showToast('ກະຣຸນາເພີ່ມສິນຄ້າກ່ອນ', 'error'); return }
    const defaultName = selectedMember && !selectedMember.isDefault
      ? selectedMember.name
      : `Park ${new Date().toLocaleTimeString('lo-LA', { hour: '2-digit', minute: '2-digit' })}`
    const name = window.prompt('ຊື່ບີນພັກ (ສຳລັບອ້າງອີງ)', defaultName)
    if (name === null) return
    try {
      const res = await fetch(`${API}/parked-carts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || defaultName,
          cart,
          discount,
          discount_mode: discountMode,
          member_id: selectedMember?.id || null,
          branch_id: activeBranchId || null,
          note: customerNote || null,
        })
      })
      if (res.ok) {
        showToast('ພັກບີນແລ້ວ', 'success')
        setCart([]); setDiscount(0); setCustomerNote('')
        loadParkedCarts()
      } else {
        showToast('ພັກບີນບໍ່ສຳເລັດ', 'error')
      }
    } catch {
      showToast('ພັກບີນບໍ່ສຳເລັດ', 'error')
    }
  }, [cart, discount, discountMode, selectedMember, activeBranchId, customerNote, loadParkedCarts])

  const recallParkedCart = useCallback(async (p) => {
    if (cart.length > 0 && !window.confirm('ບີນປະຈຸບັນຍັງມີສິນຄ້າ — ໂຫຼດບີນພັກຈະທົດແທນ. ດຳເນີນຕໍ່?')) return
    setCart(Array.isArray(p.cart) ? p.cart : [])
    setDiscount(Number(p.discount) || 0)
    setDiscountMode(p.discount_mode === 'amount' ? 'amount' : 'percent')
    if (p.note) setCustomerNote(p.note)
    try { await fetch(`${API}/parked-carts/${p.id}`, { method: 'DELETE' }) } catch {}
    setShowParkedModal(false)
    loadParkedCarts()
    showToast('ໂຫຼດບີນພັກສຳເລັດ', 'success')
  }, [cart, loadParkedCarts])

  const deleteParkedCart = useCallback(async (id) => {
    if (!window.confirm('ລົບບີນພັກນີ້?')) return
    try { await fetch(`${API}/parked-carts/${id}`, { method: 'DELETE' }) } catch {}
    loadParkedCarts()
  }, [loadParkedCarts])

  // Layby (ມັດຈຳ) — callbacks; state declared earlier near other modal flags --
  const loadOpenLaybys = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/laybys?status=open`)
      const data = await res.json()
      setOpenLaybys(Array.isArray(data) ? data : [])
    } catch {
      setOpenLaybys([])
    }
  }, [])

  const openLaybyPicker = useCallback(() => {
    if (cart.length > 0 && !loadedLayby) {
      if (!window.confirm('ບີນປະຈຸບັນຍັງມີສິນຄ້າ — ໂຫຼດ Layby ຈະທົດແທນ. ດຳເນີນຕໍ່?')) return
    }
    loadOpenLaybys()
    setLaybySearch('')
    setShowLaybyPicker(true)
  }, [cart.length, loadedLayby, loadOpenLaybys])

  const loadLaybyToCart = useCallback(async (lid) => {
    setLaybyBusy(true)
    try {
      const res = await fetch(`${API}/admin/laybys/${lid}`)
      const data = await res.json()
      if (!res.ok || !data?.id) { showToast(data?.error || 'ໂຫຼດ Layby ບໍ່ສຳເລັດ', 'error'); setLaybyBusy(false); return }
      const items = Array.isArray(data.items) ? data.items : []
      const newCart = items.map(it => ({
        product_id: it.product_id,
        variant_id: it.variant_id || null,
        name: it.variant_name ? `${it.product_name} · ${it.variant_name}` : (it.product_name || `#${it.product_id}`),
        code: it.product_code || '',
        price: Number(it.price) || 0,
        unit: it.unit || '',
        quantity: Number(it.quantity) || 0,
        stock: 9999999, // already reserved at layby creation
        variant_name: it.variant_name || null,
        _laybyItemId: it.id,
        _layby: true,
      }))
      setCart(newCart)
      setLoadedLayby({
        id: data.id,
        layby_number: data.layby_number,
        total: Number(data.total) || 0,
        paid: Number(data.paid) || 0,
        balance: Number(data.balance) || 0,
        customer_name: data.customer_name || '',
        customer_phone: data.customer_phone || '',
        member_id: data.member_id || null,
        discount: Number(data.discount) || 0,
        note: data.note || '',
      })
      // Reset modifiers that don't apply to a layby (prices already negotiated)
      setDiscount(Number(data.discount) || 0); setDiscountMode('amount')
      setActiveCoupons([]); setCouponInput('')
      setPointsToRedeem(0)
      setPayments([])
      setPaymentMethod('cash')
      setAmountPaid('')
      setCustomerNote(data.note || '')
      setShowLaybyPicker(false)
      showToast(`ໂຫຼດ ${data.layby_number} ສຳເລັດ · ຄ້າງ ${formatPrice(Number(data.balance) || 0)}`, 'success')
    } catch {
      showToast('ໂຫຼດ Layby ບໍ່ສຳເລັດ', 'error')
    }
    setLaybyBusy(false)
  }, [])

  const clearLoadedLayby = useCallback(() => {
    setLoadedLayby(null)
    setCart([])
    setAmountPaid('')
    setPayments([])
    setCustomerNote('')
  }, [])

  const promoResult = useMemo(() => calculatePromotions(cart, promotions, products, activeCouponCodes), [cart, promotions, products, activeCouponCodes])
  const promoLineDiscTotal = useMemo(() => Object.values(promoResult.lineDiscounts || {}).reduce((a, b) => a + b, 0), [promoResult])
  const promoCartDisc = promoResult.cartDiscount || 0
  const promoTotalDisc = promoLineDiscTotal + promoCartDisc
  const afterPromos = cartTotal - promoTotalDisc
  const manualDiscountAmount = Math.max(0, Math.min(
    afterPromos,
    discountMode === 'amount' ? (Number(discount) || 0) : (afterPromos * (Number(discount) || 0)) / 100
  ))
  const afterManualDisc = afterPromos - manualDiscountAmount
  const redeemValue = Math.max(0, Number(loyaltySettings.points_redeem_value) || 0)
  const memberPointsAvail = Number(selectedMember?.points) || 0
  const maxRedeemByPrice = redeemValue > 0 ? Math.floor(afterManualDisc / redeemValue) : 0
  const maxRedeemable = Math.min(memberPointsAvail, maxRedeemByPrice)
  const pointsUsed = Math.max(0, Math.min(Number(pointsToRedeem) || 0, maxRedeemable))
  const pointsDiscountAmount = pointsUsed * redeemValue
  const discountAmount = manualDiscountAmount + promoTotalDisc + pointsDiscountAmount
  const netBeforeVat = Math.max(0, afterManualDisc - pointsDiscountAmount)
  const vatSettings = useMemo(() => normalizeVatSettings(company), [company])
  const vatBreakdown = useMemo(() => applyVat(netBeforeVat, vatSettings), [netBeforeVat, vatSettings])
  const vatAmount = vatBreakdown.vatAmount
  const subtotalExVat = vatBreakdown.subtotalExVat
  const rounding = useMemo(() => applyRounding(vatBreakdown.total, company), [vatBreakdown.total, company])
  const roundingAdjustment = rounding.adjustment
  const finalTotal = rounding.rounded
  const laybyDeposit = loadedLayby ? Math.min(Number(loadedLayby.paid) || 0, finalTotal) : 0
  const amountDue = Math.max(0, finalTotal - laybyDeposit)
  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart])

  // Global keyboard shortcuts: F2 = Catalog, F12 = Pay
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F2') {
        e.preventDefault()
        if (!anyModalOpen) setShowCatalog(true)
        return
      }
      if (e.key === 'F12') {
        e.preventDefault()
        if (anyModalOpen || cart.length === 0) return
        setAmountPaid(String(amountDue))
        setShowCheckout(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [anyModalOpen, cart.length, amountDue])
  const selectedReturnItems = useMemo(() => {
    return (returnLookup?.items || []).map(item => {
      const qty = Math.max(0, Math.min(Number(returnQty[item.order_item_id]) || 0, Number(item.returnable_qty) || 0))
      return {
        ...item,
        selected_qty: qty,
        selected_amount: qty * (Number(item.price) || 0),
      }
    }).filter(item => item.selected_qty > 0)
  }, [returnLookup, returnQty])
  const returnRefundTotal = useMemo(() => {
    return selectedReturnItems.reduce((sum, item) => sum + item.selected_amount, 0)
  }, [selectedReturnItems])
  const customerDisplayState = useMemo(() => ({
    type: 'state',
    cart: cart.map(i => ({ product_id: i.product_id, name: i.name, code: i.code, price: i.price, quantity: i.quantity })),
    subtotal: cartTotal,
    discount,
    discountAmount,
    finalTotal,
    cartCount,
  }), [cart, cartTotal, discount, discountAmount, finalTotal, cartCount])

  useEffect(() => {
    customerStateRef.current = customerDisplayState
  }, [customerDisplayState])

  const postCustomerState = useCallback(() => {
    const bc = bcRef.current
    const state = customerStateRef.current
    if (!bc || !state) return
    try { bc.postMessage(state) } catch {}
  }, [])

  // Open BroadcastChannel once per mount
  useEffect(() => {
    try { bcRef.current = new BroadcastChannel('sml-pos') } catch { return }
    bcRef.current.onmessage = (e) => {
      const msg = e.data
      if (!msg || !msg.type) return
      if (msg.type === 'hello' || msg.type === 'ping') {
        postCustomerState()
      }
    }
    return () => {
      try { bcRef.current?.close() } catch {}
      bcRef.current = null
    }
  }, [postCustomerState])

  // Broadcast state to customer display
  useEffect(() => {
    postCustomerState()
  }, [customerDisplayState, postCustomerState])

  const openCustomerDisplay = async () => {
    const customerUrl = `${window.location.origin}/customer`
    const isLocalHost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
    if (!window.isSecureContext && !isLocalHost) {
      showToast('ຕ້ອງເປີດຜ່ານ localhost ຫຼື HTTPS ກ່ອນຈຶ່ງໃຊ້ຫຼາຍຈໍໄດ້', 'error')
      return
    }
    if (!('getScreenDetails' in window)) {
      showToast('Browser ນີ້ບໍ່ຮອງຮັບ — ກະລຸນາໃຊ້ Chrome ຫຼື Edge', 'error')
      return
    }

    if (navigator.permissions?.query) {
      try {
        const perm = await navigator.permissions.query({ name: 'window-management' })
        if (perm.state === 'denied') {
          showToast('ສິດ Window Management ຖືກ block — ກົດ icon ໃນ URL bar ເພື່ອອະນຸຍາດ', 'error')
          return
        }
      } catch {}
    }

    let details
    try {
      details = await window.getScreenDetails()
    } catch {
      showToast('ກະລຸນາອະນຸຍາດສິດ "Manage windows on all your displays"', 'error')
      return
    }

    const current = details.currentScreen
    const otherScreens = details.screens.filter(s => s !== current)
    const secondary =
      otherScreens.find(s => !s.isInternal && !s.isPrimary) ||
      otherScreens.find(s => !s.isInternal) ||
      otherScreens[0] ||
      null

    if (!secondary) {
      showToast('ບໍ່ພົບຈໍທີ່ 2 — ກວດ Extended display mode ໃນລະບົບ', 'error')
      return
    }

    const bounds = {
      left: Math.round(Number(secondary.availLeft ?? secondary.left ?? 0)),
      top: Math.round(Number(secondary.availTop ?? secondary.top ?? 0)),
      width: Math.round(Number(secondary.availWidth ?? secondary.width ?? 1280)),
      height: Math.round(Number(secondary.availHeight ?? secondary.height ?? 800)),
    }

    if (customerWinRef.current && !customerWinRef.current.closed) {
      try { customerWinRef.current.close() } catch {}
      customerWinRef.current = null
    }

    const features = `popup=yes,toolbar=no,location=no,status=no,menubar=no,scrollbars=no,resizable=yes,left=${bounds.left},top=${bounds.top},width=${bounds.width},height=${bounds.height}`
    const w = window.open(customerUrl, `sml-customer-display-${Date.now()}`, features)
    if (!w) { showToast('ບໍ່ສາມາດເປີດ popup — ກະລຸນາອະນຸຍາດ popup ໃນ browser', 'error'); return }
    customerWinRef.current = w

    const positionAndFullscreen = () => {
      try {
        if (w.screenX !== bounds.left || w.screenY !== bounds.top) {
          w.moveTo(bounds.left, bounds.top)
          w.resizeTo(bounds.width, bounds.height)
        }
        const el = w.document?.documentElement
        if (el?.requestFullscreen) {
          el.requestFullscreen({ screen: secondary }).catch(() => {
            try { el.requestFullscreen().catch(() => {}) } catch {}
          })
        }
      } catch {}
    }

    try { w.addEventListener('load', positionAndFullscreen, { once: true }) } catch {}
    setTimeout(positionAndFullscreen, 200)
    setTimeout(positionAndFullscreen, 700)
    setTimeout(positionAndFullscreen, 1500)

    const label = secondary.label || `ຈໍທີ່ 2 (${bounds.width}×${bounds.height})`
    showToast(`ເປີດຈໍລູກຄ້າຢູ່ ${label}`, 'success')
    setTimeout(postCustomerState, 400)
    setTimeout(postCustomerState, 1200)
  }

  const setupCashDrawer = async () => {
    if (!cashDrawerSupported) {
      showToast('Browser ນີ້ບໍ່ຮອງຮັບ Web Serial', 'error')
      return
    }

    setDrawerBusy(true)
    try {
      const result = await connectCashDrawer()
      if (result.ok) {
        setDrawerReady(true)
        showToast('ເຊື່ອມ cash drawer ສຳເລັດ', 'success')
      } else if (result.reason === 'not_configured') {
        showToast('ຍັງບໍ່ໄດ້ເລືອກ cash drawer', 'error')
      } else {
        showToast('ບໍ່ສາມາດເຊື່ອມ cash drawer ໄດ້', 'error')
      }
    } finally {
      setDrawerBusy(false)
    }
  }

  const kickCashDrawer = async () => {
    if (!cashDrawerSupported) return

    const result = await openCashDrawer()
    if (result.ok) {
      setDrawerReady(true)
    } else if (drawerReady) {
      setDrawerReady(false)
      showToast('ເປີດ cash drawer ບໍ່ສຳເລັດ', 'error')
    }
  }

  const createMemberQuick = async () => {
    const name = memberForm.name.trim()
    if (!name) { showToast('ກະລຸນາປ້ອນຊື່ສະມາຊິກ', 'error'); return }
    if (!memberForm.province || !memberForm.district || !memberForm.village) { showToast('ກະລຸນາເລືອກແຂວງ/ເມືອງ/ບ້ານ', 'error'); return }
    setCreatingMember(true)
    try {
      const res = await fetch(`${API}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone: memberForm.phone.trim(),
          province: memberForm.province,
          district: memberForm.district,
          village: memberForm.village,
        })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'ສ້າງສະມາຊິກບໍ່ສຳເລັດ', 'error')
        return
      }
      setSelectedMember(data)
      setMemberSearch('')
      setMemberForm({ name: '', phone: '', province: '', district: '', village: '' })
      setShowMemberModal(false)
      loadMembers('')
      showToast('ສ້າງສະມາຊິກສຳເລັດ', 'success')
    } finally {
      setCreatingMember(false)
    }
  }

  const handleCheckout = async () => {
    // Layby completion path: bypass /api/orders and call /api/admin/laybys/[id]/complete
    if (loadedLayby) {
      if (paymentMethod === 'credit') { showToast('Layby ບໍ່ຮອງຮັບການຕິດໜີ້', 'error'); return }
      const useMultiL = payments.length > 0
      let paidL, paymentsPayloadL = null
      if (useMultiL) {
        paymentsPayloadL = payments.map(p => {
          const cur = currencies.find(c => c.code === p.currency) || { rate: 1 }
          const amount = Number(p.amount) || 0
          const rate = Number(cur.rate) || 1
          return { currency: p.currency, amount, rate, amount_lak: amount * rate }
        }).filter(p => p.amount > 0)
        paidL = paymentsPayloadL.reduce((s, p) => s + p.amount_lak, 0)
      } else {
        paidL = Number(amountPaid) || amountDue
      }
      if (paidL + 0.5 < amountDue) { showToast('ຈຳນວນເງິນບໍ່ພຽງພໍ', 'error'); return }
      const res = await fetch(`${API}/admin/laybys/${loadedLayby.id}/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: paymentsPayloadL && paymentsPayloadL.length > 1 ? 'mixed' : paymentMethod,
          amount_paid: paidL,
          change_amount: Math.max(0, paidL - amountDue),
          payments: paymentsPayloadL,
          note: customerNote || null,
        })
      })
      if (res.ok) {
        const { order } = await res.json()
        showToast(`ປິດ Layby ສຳເລັດ · ${order?.bill_number || ''}`, 'success')
        if (paymentMethod === 'cash' || (paymentsPayloadL && paymentsPayloadL.length > 0)) kickCashDrawer()
        try { bcRef.current?.postMessage({ type: 'complete', order }) } catch {}
        clearPosDraft()
        setShowReceipt(order); setCart([]); setAmountPaid(''); setShowCheckout(false)
        setDiscount(0); setDiscountMode('percent'); setCustomerNote('')
        setLastScan(null); setPayments([])
        setLoadedLayby(null)
        fetchProducts()
      } else {
        const err = await res.json().catch(() => ({}))
        showToast(err.error || 'ປິດ Layby ບໍ່ສຳເລັດ', 'error')
      }
      return
    }

    if (!selectedMember) { showToast('ກະລຸນາເລືອກສະມາຊິກກ່ອນອອກບິນ', 'error'); return }
    const isCredit = paymentMethod === 'credit'
    if (isCredit && selectedMember?.isDefault) { showToast('ກະລຸນາເລືອກສະມາຊິກກ່ອນຂາຍຕິດໜີ້', 'error'); return }
    const creditName = creditCustomer.name.trim() || selectedMember?.name || ''
    if (isCredit && !creditName) { showToast('ກະລຸນາປ້ອນຊື່ລູກຄ້າສຳລັບບິນຕິດໜີ້', 'error'); return }
    if (isCredit && !creditCustomer.dueDate) { showToast('ກະລຸນາກຳນົດວັນຄົບກຳນົດຊຳລະ', 'error'); return }
    const useMulti = payments.length > 0
    let paid, paymentsPayload = null
    if (isCredit) {
      paid = 0
    } else if (useMulti) {
      paymentsPayload = payments.map(p => {
        const cur = currencies.find(c => c.code === p.currency) || { rate: 1 }
        const amount = Number(p.amount) || 0
        const rate = Number(cur.rate) || 1
        return { currency: p.currency, amount, rate, amount_lak: amount * rate }
      }).filter(p => p.amount > 0)
      paid = paymentsPayload.reduce((s, p) => s + p.amount_lak, 0)
    } else {
      paid = Number(amountPaid) || finalTotal
    }
    if (!isCredit && paid < finalTotal) { showToast('ຈຳນວນເງິນບໍ່ພຽງພໍ', 'error'); return }
    const minRedeem = Number(loyaltySettings.min_points_to_redeem) || 0
    if (pointsUsed > 0 && pointsUsed < minRedeem) { showToast(`ໃຊ້ແຕ້ມຂັ້ນຕ່ຳ ${formatNumber(minRedeem)}`, 'error'); return }
    // Build items: normal cart + same-product BOGO extras + cross-product bonus lines (all price=0 for stock deduction)
    const checkoutItems = []
    for (const it of cart) {
      checkoutItems.push({ product_id: it.product_id, variant_id: it.variant_id || null, quantity: it.quantity, price: it.price })
      const freeQty = promoResult.freeItems?.[it.product_id] || 0
      const inBonus = (promoResult.bonusLines || []).some(bl => bl.product_id === it.product_id)
      if (freeQty > 0 && !inBonus) {
        checkoutItems.push({ product_id: it.product_id, variant_id: null, quantity: freeQty, price: 0 })
      }
    }
    for (const bl of (promoResult.bonusLines || [])) {
      checkoutItems.push({ product_id: bl.product_id, variant_id: null, quantity: bl.qty, price: 0 })
    }
    const res = await fetch(`${API}/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: checkoutItems,
        total: finalTotal,
        change_amount: isCredit ? 0 : paid - finalTotal,
        payment_method: isCredit ? 'credit' : (paymentsPayload && paymentsPayload.length > 1 ? 'mixed' : paymentMethod),
        amount_paid: paid,
        discount: discountAmount,
        note: customerNote,
        payments: isCredit ? null : paymentsPayload,
        customer_name: isCredit ? creditName : null,
        customer_phone: isCredit ? (creditCustomer.phone || selectedMember?.phone || '') : null,
        credit_due_date: isCredit ? creditCustomer.dueDate : null,
        member_id: selectedMember?.id || null,
        points_used: pointsUsed,
        coupon_codes: activeCouponCodes,
        applied_promo_ids: (promoResult.appliedPromos || []).map(p => p.id),
        branch_id: activeBranchId || null,
      })
    })
    if (res.ok) {
      const order = await res.json()
      showToast(isCredit ? 'ອອກບິນຕິດໜີ້ສຳເລັດ' : 'ການຊຳລະສຳເລັດ', 'success')
      const shouldOpenDrawer = !isCredit && (paymentMethod === 'cash' || (paymentsPayload && paymentsPayload.length > 0))
      if (shouldOpenDrawer) kickCashDrawer()
      try { bcRef.current?.postMessage({ type: 'complete', order }) } catch {}
      clearPosDraft()
      setShowReceipt(order); setCart([]); setAmountPaid(''); setShowCheckout(false)
      setDiscount(0); setDiscountMode('percent'); setCustomerNote(''); setCreditCustomer({ name: '', phone: '', dueDate: dateAfterDays(30) }); setLastScan(null); setPayments([]); setSelectedMember(DEFAULT_MEMBER); setPointsToRedeem(0); setActiveCoupons([]); setCouponInput('')
      loadMembers('')
      fetchProducts()
    } else { const err = await res.json(); showToast(err.error, 'error') }
  }

  const loadOrders = async () => {
    const [oRes, sRes, rRes] = await Promise.all([
      fetch(`${API}/orders`),
      fetch(`${API}/orders/summary`),
      fetch(`${API}/returns`),
    ])
    setOrders(await oRes.json())
    try { setDailySummary(await sRes.json()) } catch { setDailySummary(null) }
    try {
      const data = await rRes.json()
      setReturnsHistory(Array.isArray(data) ? data : [])
    } catch { setReturnsHistory([]) }
    setShowOrders(true)
  }

  const deleteReturn = async (ret) => {
    const label = ret.return_number || `#${ret.id}`
    if (!confirm(`ຍົກເລີກການຮັບຄືນ ${label}?\nສະຕັອກສິນຄ້າທີ່ຄືນຈະຖືກລົບກັບ.`)) return
    const res = await fetch(`${API}/returns/${ret.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      showToast(data.error || 'ລົບບໍ່ສຳເລັດ', 'error')
      return
    }
    showToast(`ຍົກເລີກແລ້ວ ${label}`)
    loadOrders()
    fetchProducts()
  }

  const lookupReturnOrder = async (term = returnSearch) => {
    const q = String(term || '').trim()
    if (!q) { showToast('ກະລຸນາປ້ອນເລກບິນ', 'error'); return }
    setReturnBusy(true)
    try {
      const res = await fetch(`${API}/returns/lookup?q=${encodeURIComponent(q)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setReturnLookup(null)
        setReturnQty({})
        showToast(data.error || 'ບໍ່ພົບບິນ', 'error')
        return
      }
      setReturnLookup(data)
      setReturnQty({})
    } finally {
      setReturnBusy(false)
    }
  }

  const openReturnModal = (order = null) => {
    const bill = order ? (order.bill_number || String(order.id)) : ''
    setShowReturn(true)
    setReturnLookup(null)
    setReturnQty({})
    setReturnMethod('cash')
    setReturnNote('')
    setReturnSearch(bill)
    if (bill) setTimeout(() => lookupReturnOrder(bill), 0)
  }

  const submitReturn = async () => {
    if (!returnLookup?.order?.id) { showToast('ກະລຸນາຄົ້ນຫາບິນກ່ອນ', 'error'); return }
    if (selectedReturnItems.length === 0) { showToast('ກະລຸນາໃສ່ຈຳນວນສິນຄ້າທີ່ຮັບຄືນ', 'error'); return }
    setReturnBusy(true)
    try {
      const res = await fetch(`${API}/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: returnLookup.order.id,
          refund_method: returnMethod,
          note: returnNote,
          created_by: user?.display_name || user?.username || null,
          items: selectedReturnItems.map(item => ({ order_item_id: item.order_item_id, quantity: item.selected_qty })),
        })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'ບັນທຶກການຮັບຄືນບໍ່ສຳເລັດ', 'error')
        return
      }
      showToast(`ຮັບຄືນສຳເລັດ ${data.return_number || ''}`, 'success')
      fetchProducts()
      if (showOrders) loadOrders()
      setReturnLookup(null)
      setReturnQty({})
      setReturnSearch('')
      setReturnNote('')
      setShowReturn(false)
    } finally {
      setReturnBusy(false)
    }
  }

  const openDailySummary = async () => {
    try {
      const [sRes, hRes] = await Promise.all([
        fetch(`${API}/orders/summary`),
        fetch(`${API}/cash-handovers/today`)
      ])
      setDailySummary(await sRes.json())
      try { setTodayHandovers(await hRes.json()) } catch { setTodayHandovers([]) }
    } catch { setDailySummary(null); setTodayHandovers([]) }
    setHandoverForm({ actual_cash: '', received_by: '', note: '' })
    setShowDailySummary(true)
  }

  const submitHandover = async () => {
    if (!handoverForm.actual_cash) { showToast('ກະລຸນາປ້ອນຈຳນວນເງິນ', 'error'); return }
    setHandoverSaving(true)
    try {
      const expected = Number(dailySummary?.today?.cash_revenue) || 0
      const res = await fetch(`${API}/cash-handovers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashier_name: user?.display_name || null,
          expected_cash: expected,
          actual_cash: Number(handoverForm.actual_cash) || 0,
          received_by: handoverForm.received_by || null,
          note: handoverForm.note || null,
        })
      })
      if (res.ok) {
        showToast('ບັນທຶກການສົ່ງເງິນສຳເລັດ', 'success')
        const hRes = await fetch(`${API}/cash-handovers/today`)
        setTodayHandovers(await hRes.json())
        setHandoverForm({ actual_cash: '', received_by: '', note: '' })
      } else {
        const err = await res.json().catch(() => ({}))
        showToast(err.error || 'ບັນທຶກບໍ່ສຳເລັດ', 'error')
      }
    } finally { setHandoverSaving(false) }
  }

  const cancelOrder = async (orderId) => {
    if (!confirm(`ຍົກເລີກບິນ #${orderId}?\nສະຕ໊ອກຈະຖືກຄືນ.`)) return
    const res = await fetch(`${API}/orders/${orderId}`, { method: 'DELETE' })
    if (res.ok) {
      showToast(`ຍົກເລີກບິນ #${orderId} ສຳເລັດ`, 'success')
      fetchProducts()
      loadOrders()
    } else {
      const err = await res.json().catch(() => ({}))
      showToast(err.error || 'ບໍ່ສາມາດຍົກເລີກໄດ້', 'error')
    }
  }

  const printReceipt = (order, sizeOverride) => {
    if (!order) return
    const size = sizeOverride || receiptSize || '80mm'
    const isPaper = size === 'a4' || size === 'a5'
    const methodText = order.payment_method === 'cash' ? 'ເງິນສົດ' : order.payment_method === 'transfer' ? 'ໂອນ' : order.payment_method === 'qr' ? 'QR' : order.payment_method === 'credit' ? 'ຂາຍຕິດໜີ້' : order.payment_method
    const isCreditOrder = order.payment_method === 'credit'
    const dt = new Date(order.created_at || Date.now())
    const dateStr = dt.toLocaleString('lo-LA')
    const orderPayments = Array.isArray(order.payments)
      ? order.payments
      : typeof order.payments === 'string'
        ? (() => { try { return JSON.parse(order.payments) } catch { return [] } })()
        : []

    const itemsArr = order.items || []
    const billLabel = order.bill_number || `#${order.id}`

    const orderVatAmount = Number(order.vat_amount) || 0
    const orderVatRate = Number(order.vat_rate) || 0
    const orderDiscount = Number(order.discount) || 0
    const orderTotalNum = Number(order.total) || 0
    const orderSubtotalEx = Number(order.subtotal) || 0
    const isVatInclusive = order.vat_mode === 'inclusive'
    const hasVat = orderVatAmount > 0 && orderVatRate > 0
    const itemsGross = hasVat
      ? (isVatInclusive ? orderTotalNum + orderDiscount : orderSubtotalEx + orderDiscount)
      : (orderSubtotalEx > 0 ? orderSubtotalEx + orderDiscount : orderTotalNum + orderDiscount)
    const vatLabelText = hasVat
      ? `${company.vat_label || 'VAT'} ${orderVatRate}%${isVatInclusive ? ' (ລວມໃນ)' : ''}`
      : ''
    const vatInfo = { hasVat, vatAmount: orderVatAmount, vatLabelText, itemsGross, isVatInclusive }

    const html = isPaper
      ? buildPaperReceipt({ order, size, company, user, methodText, isCreditOrder, dateStr, orderPayments, itemsArr, billLabel, vatInfo })
      : buildThermalReceipt({ order, company, user, methodText, isCreditOrder, dateStr, orderPayments, itemsArr, billLabel, vatInfo })

    const winSize = size === 'a4' ? 'width=900,height=1100'
      : size === 'a5' ? 'width=720,height=900'
      : 'width=360,height=700'
    const win = window.open('', '_blank', winSize)
    if (!win) { showToast('ບໍ່ສາມາດເປີດປ່ອງພິມໄດ້', 'error'); return }
    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  const buildThermalReceipt = ({ order, company, user, methodText, isCreditOrder, dateStr, orderPayments, itemsArr, billLabel, vatInfo }) => {
    const paymentLines = orderPayments.map(p => {
      const currency = p.currency || 'LAK'
      const rate = Number(p.rate) || 1
      const amount = Number(p.amount) || 0
      const amountLak = Number(p.amount_lak) || amount * rate
      return `
        <div class="payrow">
          <span>${currency} ${formatNumber(amount)}</span>
          <span>@ ${formatNumber(rate)} = ${formatPrice(amountLak)}</span>
        </div>
      `
    }).join('')
    const lines = itemsArr.map(it => `
      <div class="row">
        <div class="name">${(it.name || it.product_name || '—')}</div>
        <div class="qtyrow">
          <span>${it.quantity} × ${formatNumber(it.price)}</span>
          <span>${formatNumber(Number(it.price) * Number(it.quantity))}</span>
        </div>
      </div>
    `).join('')

    return `<!doctype html>
    <html><head><meta charset="utf-8"><title>ໃບບິນ ${billLabel}</title>
    <style>
      @page { size: 80mm auto; margin: 0 }
      * { box-sizing: border-box; font-family: 'Noto Sans Lao','Phetsarath OT',system-ui,sans-serif; }
      html, body { margin: 0; padding: 0; width: 80mm; }
      body { padding: 4mm 3mm; width: 72mm; max-width: 72mm; color: #000; font-size: 11px; line-height: 1.3; overflow: hidden; }
      img { max-width: 52mm !important; height: auto; object-fit: contain; }
      .center { text-align: center }
      .bold { font-weight: 800 }
      .xl { font-size: 14px }
      .lg { font-size: 12px }
      .sm { font-size: 10px }
      .xs { font-size: 9px; color: #666 }
      .divider { border-top: 1px dashed #000; margin: 6px 0 }
      .double { border-top: 2px solid #000; margin: 6px 0 }
      .row { margin: 2px 0; break-inside: avoid; }
      .name { font-weight: 700; overflow-wrap: anywhere; word-break: break-word; }
      .qtyrow { display: flex; justify-content: space-between; gap: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; }
      .qtyrow span:first-child { min-width: 0; overflow-wrap: anywhere; }
      .qtyrow span:last-child { flex-shrink: 0; text-align: right; }
      .total { display: flex; justify-content: space-between; gap: 6px; margin: 2px 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; }
      .total span:first-child { min-width: 0; overflow-wrap: anywhere; }
      .total span:last-child { flex-shrink: 0; text-align: right; }
      .total-value { font-variant-numeric: tabular-nums }
      .payrow { display: flex; justify-content: space-between; gap: 4px; margin: 2px 0; font-size: 9px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      .grand { font-size: 13px; font-weight: 800; }
      .note { font-size: 9px; color: #333; margin-top: 4px; padding: 4px; border: 1px dashed #000; overflow-wrap: anywhere; }
    </style></head><body>
      ${company.logo_url ? `<div class="center"><img src="${location.origin}${company.logo_url}" style="max-height:40px;max-width:52mm;margin:0 auto 4px" /></div>` : ''}
      <div class="center bold xl">${company.name || 'POS'}</div>
      ${company.slogan ? `<div class="center xs">${company.slogan}</div>` : ''}
      ${company.address ? `<div class="center xs">${company.address}</div>` : ''}
      ${(company.phone || company.email) ? `<div class="center xs">${[company.phone, company.email].filter(Boolean).join(' · ')}</div>` : ''}
      ${(company.tax_id || company.business_reg_no) ? `<div class="center xs">${[company.tax_id && `TAX: ${company.tax_id}`, company.business_reg_no && `REG: ${company.business_reg_no}`].filter(Boolean).join(' · ')}</div>` : ''}
      <div class="divider"></div>

      <div class="sm"><span class="bold">ໃບບິນ:</span> ${billLabel}</div>
      <div class="sm"><span class="bold">ວັນທີ:</span> ${dateStr}</div>
      <div class="sm"><span class="bold">ພະນັກງານ:</span> ${user?.display_name || '—'}</div>
      <div class="sm"><span class="bold">ວິທີຊຳລະ:</span> ${methodText}</div>
      ${order.member_id ? `
        <div class="sm"><span class="bold">ສະມາຊິກ:</span> ${order.customer_name || '—'}</div>
        ${Number(order.member_points_used) > 0 ? `<div class="sm"><span class="bold">ໃຊ້ແຕ້ມ:</span> −${formatNumber(order.member_points_used)} (${formatPrice(order.member_points_discount || 0)})</div>` : ''}
        ${Number(order.member_points_earned) > 0 ? `<div class="sm"><span class="bold">ຄະແນນໄດ້ຮັບ:</span> +${formatNumber(order.member_points_earned)}</div>` : ''}
      ` : ''}
      ${isCreditOrder ? `
        <div class="sm"><span class="bold">ລູກຄ້າ:</span> ${order.customer_name || '—'}</div>
        ${order.customer_phone ? `<div class="sm"><span class="bold">ເບີໂທ:</span> ${order.customer_phone}</div>` : ''}
        ${order.credit_due_date ? `<div class="sm"><span class="bold">ກຳນົດຊຳລະ:</span> ${new Date(order.credit_due_date).toLocaleDateString('lo-LA')}</div>` : ''}
      ` : ''}
      <div class="divider"></div>

      ${lines || '<div class="xs">ບໍ່ມີລາຍການ</div>'}

      <div class="divider"></div>
      <div class="total"><span>ລວມຍ່ອຍ</span><span class="total-value">${formatPrice(vatInfo.itemsGross)}</span></div>
      ${Number(order.discount) > 0 ? `<div class="total"><span>ສ່ວນຫຼຸດ</span><span class="total-value">−${formatPrice(order.discount)}</span></div>` : ''}
      ${vatInfo.hasVat ? `<div class="total"><span>${vatInfo.vatLabelText}</span><span class="total-value">${vatInfo.isVatInclusive ? '' : '+'}${formatPrice(vatInfo.vatAmount)}</span></div>` : ''}
      <div class="double"></div>
      <div class="total grand"><span>ລວມທັງໝົດ</span><span class="total-value">${formatPrice(order.total)}</span></div>
      <div class="divider"></div>
      <div class="total"><span>${isCreditOrder ? 'ຮັບແລ້ວ' : 'ຮັບເງິນ'}</span><span class="total-value">${formatPrice(order.amount_paid)}</span></div>
      ${paymentLines ? `
        <div class="xs bold" style="margin-top:4px;">ລາຍລະອຽດການຮັບເງິນ / Rate</div>
        ${paymentLines}
      ` : ''}
      <div class="total bold"><span>${isCreditOrder ? 'ຍອດຄ້າງ' : 'ເງິນທອນ'}</span><span class="total-value">${formatPrice(isCreditOrder ? Number(order.total) - Number(order.amount_paid || 0) : order.change_amount)}</span></div>

      ${order.note ? `<div class="note">📝 ${order.note}</div>` : ''}

      ${Array.isArray(company.bank_accounts) && company.bank_accounts.length > 0 ? `
      <div class="divider"></div>
      <div class="xs bold center">ບັນຊີຊຳລະ</div>
      ${company.bank_accounts.map(a => `<div class="xs">• ${[a.bank_name, a.account_name].filter(Boolean).join(' — ')}${a.account_number ? `: ${a.account_number}` : ''}</div>`).join('')}
      ` : ''}

      <div class="divider"></div>
      <div class="center sm bold">★ ຂໍຂອບໃຈ ★</div>
      <div class="center xs">ກະລຸນາຮັກສາໃບບິນໄວ້</div>
      <div style="height: 20mm"></div>
      <script>
        window.onload = () => { window.print(); setTimeout(() => window.close(), 400); }
      </script>
    </body></html>`
  }

  const buildPaperReceipt = ({ order, size, company, user, methodText, isCreditOrder, dateStr, orderPayments, itemsArr, billLabel, vatInfo }) => {
    const isA4 = size === 'a4'
    const itemRows = itemsArr.map((it, i) => {
      const qty = Number(it.quantity) || 0
      const price = Number(it.price) || 0
      const total = qty * price
      return `
        <tr>
          <td class="num">${i + 1}</td>
          <td class="prod">${(it.name || it.product_name || '—')}</td>
          <td class="qty">${formatNumber(qty)}</td>
          <td class="money">${formatNumber(price)}</td>
          <td class="money">${formatNumber(total)}</td>
        </tr>
      `
    }).join('')
    const paymentRows = orderPayments.map(p => {
      const currency = p.currency || 'LAK'
      const rate = Number(p.rate) || 1
      const amount = Number(p.amount) || 0
      const amountLak = Number(p.amount_lak) || amount * rate
      return `<tr><td>${currency}</td><td class="money">${formatNumber(amount)}</td><td>@ ${formatNumber(rate)}</td><td class="money">${formatPrice(amountLak)}</td></tr>`
    }).join('')
    const outstanding = isCreditOrder ? Math.max(0, Number(order.total) - Number(order.amount_paid || 0)) : Number(order.change_amount || 0)

    return `<!doctype html>
    <html><head><meta charset="utf-8"><title>ໃບບິນ ${billLabel}</title>
    <style>
      @page { size: ${isA4 ? 'A4' : 'A5'} portrait; margin: ${isA4 ? '12mm' : '8mm'} }
      * { box-sizing: border-box; font-family: 'Noto Sans Lao','Phetsarath OT',system-ui,sans-serif; }
      html, body { margin: 0; padding: 0; color: #111; font-size: ${isA4 ? '12px' : '11px'}; line-height: 1.45 }
      .receipt { width: 100% }
      header.top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 12px }
      .brand { display: flex; align-items: center; gap: 12px; min-width: 0 }
      .brand img { max-height: ${isA4 ? '64px' : '52px'}; max-width: ${isA4 ? '120px' : '90px'}; object-fit: contain }
      .brand .name { font-size: ${isA4 ? '20px' : '16px'}; font-weight: 800; letter-spacing: .2px }
      .brand .info { font-size: ${isA4 ? '11px' : '10px'}; color: #444; line-height: 1.4 }
      .doc { text-align: right }
      .doc h1 { margin: 0; font-size: ${isA4 ? '22px' : '18px'}; font-weight: 900; letter-spacing: 1px; color: #b91c1c }
      .doc .meta { margin-top: 4px; font-size: ${isA4 ? '11px' : '10px'}; color: #444 }
      .doc .meta b { color: #111 }
      .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 12px; font-size: ${isA4 ? '11px' : '10px'} }
      .meta-grid .row { display: flex; gap: 6px; align-items: baseline }
      .meta-grid .label { color: #64748b; font-weight: 700; min-width: ${isA4 ? '70px' : '60px'} }
      .meta-grid .value { color: #111; font-weight: 600; word-break: break-word }
      table.items { width: 100%; border-collapse: collapse; margin: 8px 0 }
      table.items thead th { background: #111; color: #fff; padding: 6px 8px; font-size: ${isA4 ? '11px' : '10px'}; font-weight: 700; text-align: left; letter-spacing: .3px }
      table.items thead th.qty, table.items thead th.money { text-align: right }
      table.items tbody td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: ${isA4 ? '12px' : '11px'} }
      table.items td.num { width: 28px; color: #64748b; font-variant-numeric: tabular-nums }
      table.items td.prod { font-weight: 600 }
      table.items td.qty, table.items td.money { text-align: right; font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, monospace }
      .totals { display: grid; grid-template-columns: 1fr ${isA4 ? '220px' : '180px'}; gap: 16px; margin-top: 10px }
      .totals .left { font-size: ${isA4 ? '11px' : '10px'}; color: #475569 }
      .totals .bank b { color: #111 }
      .totals .right { border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden }
      .totals .right .row { display: flex; justify-content: space-between; gap: 12px; padding: 6px 10px; font-size: ${isA4 ? '12px' : '11px'} }
      .totals .right .row + .row { border-top: 1px dashed #e2e8f0 }
      .totals .right .row .v { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums }
      .totals .right .grand { background: #fef2f2; color: #991b1b; font-weight: 900; font-size: ${isA4 ? '14px' : '13px'}; border-top: 2px solid #fca5a5 }
      .totals .right .outstanding { background: #fffbeb; color: #92400e; font-weight: 800 }
      .totals .right .change { background: #f0fdf4; color: #166534; font-weight: 800 }
      .payments { margin-top: 12px; font-size: ${isA4 ? '11px' : '10px'} }
      .payments h4 { margin: 0 0 6px; font-size: ${isA4 ? '11px' : '10px'}; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: .5px }
      .payments table { width: 100%; border-collapse: collapse }
      .payments td { padding: 4px 8px; border-bottom: 1px dotted #cbd5e1; font-family: ui-monospace, SFMono-Regular, Menlo, monospace }
      .payments td.money { text-align: right }
      .note { margin-top: 12px; padding: 8px 12px; border: 1px dashed #94a3b8; border-radius: 6px; font-size: ${isA4 ? '11px' : '10px'}; color: #334155 }
      .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: ${isA4 ? '40px' : '30px'} }
      .sign .box { text-align: center; font-size: ${isA4 ? '11px' : '10px'}; color: #475569 }
      .sign .line { margin-bottom: 6px; height: 28px; border-bottom: 1px solid #94a3b8 }
      footer.bottom { margin-top: ${isA4 ? '24px' : '16px'}; padding-top: 8px; border-top: 1px solid #cbd5e1; text-align: center; font-size: ${isA4 ? '11px' : '10px'}; color: #475569 }
    </style></head><body>
      <div class="receipt">
        <header class="top">
          <div class="brand">
            ${company.logo_url ? `<img src="${location.origin}${company.logo_url}" alt="logo" />` : ''}
            <div>
              <div class="name">${company.name || 'POS'}</div>
              ${company.slogan ? `<div class="info">${company.slogan}</div>` : ''}
              ${company.address ? `<div class="info">${company.address}</div>` : ''}
              ${(company.phone || company.email) ? `<div class="info">${[company.phone, company.email].filter(Boolean).join(' · ')}</div>` : ''}
              ${(company.tax_id || company.business_reg_no) ? `<div class="info">${[company.tax_id && `TAX: ${company.tax_id}`, company.business_reg_no && `REG: ${company.business_reg_no}`].filter(Boolean).join(' · ')}</div>` : ''}
            </div>
          </div>
          <div class="doc">
            <h1>${isCreditOrder ? 'ໃບບິນຕິດໜີ້' : 'ໃບບິນຂາຍ'}</h1>
            <div class="meta"><b>ເລກບິນ:</b> ${billLabel}</div>
            <div class="meta"><b>ວັນທີ:</b> ${dateStr}</div>
          </div>
        </header>

        <div class="meta-grid">
          <div class="row"><span class="label">ພະນັກງານ</span><span class="value">${user?.display_name || '—'}</span></div>
          <div class="row"><span class="label">ວິທີຊຳລະ</span><span class="value">${methodText}</span></div>
          ${order.member_id ? `<div class="row"><span class="label">ສະມາຊິກ</span><span class="value">${order.customer_name || '—'}</span></div>` : ''}
          ${order.member_id && Number(order.member_points_earned) > 0 ? `<div class="row"><span class="label">ໄດ້ແຕ້ມ</span><span class="value">+${formatNumber(order.member_points_earned)}</span></div>` : ''}
          ${isCreditOrder ? `<div class="row"><span class="label">ລູກຄ້າ</span><span class="value">${order.customer_name || '—'}</span></div>` : ''}
          ${isCreditOrder && order.customer_phone ? `<div class="row"><span class="label">ເບີໂທ</span><span class="value">${order.customer_phone}</span></div>` : ''}
          ${isCreditOrder && order.credit_due_date ? `<div class="row"><span class="label">ກຳນົດຊຳລະ</span><span class="value">${new Date(order.credit_due_date).toLocaleDateString('lo-LA')}</span></div>` : ''}
        </div>

        <table class="items">
          <thead>
            <tr>
              <th>#</th>
              <th>ສິນຄ້າ</th>
              <th class="qty">ຈຳນວນ</th>
              <th class="money">ລາຄາ</th>
              <th class="money">ລວມ</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:12px">ບໍ່ມີລາຍການ</td></tr>'}
          </tbody>
        </table>

        <div class="totals">
          <div class="left">
            ${order.member_id && Number(order.member_points_used) > 0 ? `<div>ໃຊ້ແຕ້ມ: <b>−${formatNumber(order.member_points_used)}</b> (${formatPrice(order.member_points_discount || 0)})</div>` : ''}
            ${Array.isArray(company.bank_accounts) && company.bank_accounts.length > 0 ? `
              <div class="bank" style="margin-top:8px">
                <b>ບັນຊີຊຳລະ:</b>
                ${company.bank_accounts.map(a => `<div>• ${[a.bank_name, a.account_name].filter(Boolean).join(' — ')}${a.account_number ? `: ${a.account_number}` : ''}</div>`).join('')}
              </div>
            ` : ''}
          </div>
          <div class="right">
            <div class="row"><span>ລວມຍ່ອຍ</span><span class="v">${formatPrice(vatInfo.itemsGross)}</span></div>
            ${Number(order.discount) > 0 ? `<div class="row"><span>ສ່ວນຫຼຸດ</span><span class="v">−${formatPrice(order.discount)}</span></div>` : ''}
            ${vatInfo.hasVat ? `<div class="row"><span>${vatInfo.vatLabelText}</span><span class="v">${vatInfo.isVatInclusive ? '' : '+'}${formatPrice(vatInfo.vatAmount)}</span></div>` : ''}
            <div class="row grand"><span>ລວມທັງໝົດ</span><span class="v">${formatPrice(order.total)}</span></div>
            <div class="row"><span>${isCreditOrder ? 'ຮັບແລ້ວ' : 'ຮັບເງິນ'}</span><span class="v">${formatPrice(order.amount_paid)}</span></div>
            <div class="row ${isCreditOrder ? 'outstanding' : 'change'}"><span>${isCreditOrder ? 'ຍອດຄ້າງ' : 'ເງິນທອນ'}</span><span class="v">${formatPrice(outstanding)}</span></div>
          </div>
        </div>

        ${paymentRows ? `
          <div class="payments">
            <h4>ລາຍລະອຽດການຮັບເງິນ</h4>
            <table>${paymentRows}</table>
          </div>
        ` : ''}

        ${order.note ? `<div class="note"><b>ໝາຍເຫດ:</b> ${order.note}</div>` : ''}

        ${isA4 ? `
          <div class="sign">
            <div class="box"><div class="line"></div>ລາຍເຊັນຜູ້ຮັບເງິນ</div>
            <div class="box"><div class="line"></div>ລາຍເຊັນລູກຄ້າ</div>
          </div>
        ` : ''}

        <footer class="bottom">★ ຂໍຂອບໃຈທີ່ໃຊ້ບໍລິການ ★ · ກະລຸນາຮັກສາໃບບິນໄວ້ເພື່ອປ່ຽນ/ຄືນສິນຄ້າ</footer>
      </div>
      <script>
        window.onload = () => { window.print(); setTimeout(() => window.close(), 400); }
      </script>
    </body></html>`
  }

  const quickAmounts = [5000, 10000, 20000, 50000, 100000]
  const catalogProducts = useMemo(() => products.filter(p => p.qty_on_hand > 0), [products])
  const memberProvinces = Object.keys(laoLocations)
  const memberDistricts = memberForm.province ? Object.keys(laoLocations[memberForm.province] || {}) : []
  const memberVillages = memberForm.province && memberForm.district ? (laoLocations[memberForm.province]?.[memberForm.district] || []) : []
  const setMemberProvince = (province) => setMemberForm({ ...memberForm, province, district: '', village: '' })
  const setMemberDistrict = (district) => setMemberForm({ ...memberForm, district, village: '' })

  return (
    <div className="pos-root flex flex-col h-screen overflow-hidden bg-slate-900 text-slate-100 text-[13px]">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes scale-in { from { opacity: 0; transform: scale(.95) } to { opacity: 1; transform: scale(1) } }
        @keyframes toast { from { opacity: 0; transform: translate(-50%, 20px) } to { opacity: 1; transform: translate(-50%, 0) } }
        @keyframes scan-flash { 0% { box-shadow: inset 0 0 0 0 rgba(239,68,68,0); } 20% { box-shadow: inset 0 0 80px 10px rgba(239,68,68,.35); } 100% { box-shadow: inset 0 0 0 0 rgba(239,68,68,0); } }
        @keyframes pulse-ring { 0% { transform: scale(1); opacity: 1 } 100% { transform: scale(2.2); opacity: 0 } }
        @keyframes slide-in-top { from { transform: translateY(-10px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        .animate-fade-in { animation: fade-in .2s ease-out }
        .animate-scale-in { animation: scale-in .25s cubic-bezier(.16,1,.3,1) }
        .animate-toast { animation: toast .3s cubic-bezier(.16,1,.3,1) }
        .animate-scan-flash { animation: scan-flash .8s ease-out }
        .animate-pulse-ring { animation: pulse-ring 1.5s cubic-bezier(.16,1,.3,1) infinite }
        .animate-slide-in-top { animation: slide-in-top .25s cubic-bezier(.16,1,.3,1) }
        .font-mono-t { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' }
        ::-webkit-scrollbar { width: 6px; height: 6px }
        ::-webkit-scrollbar-thumb { background: rgba(100, 116, 139, .3); border-radius: 3px }
        @media (max-width: 1100px) and (max-height: 820px) {
          .pos-root { font-size: 12px; }
          .pos-header { min-height: 38px; padding-left: 8px; padding-right: 8px; gap: 6px; }
          .pos-header button { padding: 4px 8px; }
          .pos-header .pos-admin-button { padding: 4px 10px; }
          .pos-scan { padding: 5px 8px; }
          .pos-scan-panel { padding: 6px 8px; border-radius: 10px; }
          .pos-scan-title { display: none; }
          .pos-scan-input { height: 34px; font-size: 13px; border-width: 1px; }
          .pos-scan-icon { display: none; }
          .pos-shell { gap: 6px; padding: 6px; }
          .pos-invoice-header { padding: 7px 10px; }
          .pos-cart-table th { padding-top: 6px; padding-bottom: 6px; }
          .pos-cart-table td { padding-top: 6px; padding-bottom: 6px; }
          .pos-summary { width: 260px; max-height: none; }
          .pos-summary-card { margin: 6px 6px 0; padding: 8px; border-radius: 10px; }
          .pos-summary-card:last-child { margin-bottom: 6px; }
          .pos-summary-card .text-\\[10px\\] { font-size: 9px; }
          .pos-summary-card .text-\\[11px\\] { font-size: 10px; }
          .pos-discount-box { padding: 8px; gap: 6px; }
          .pos-discount-box .space-y-3 { gap: 6px; }
          .pos-discount-box input { height: 34px; font-size: 16px; padding-top: 4px; padding-bottom: 4px; }
          .pos-discount-box button { height: 34px; }
          .pos-discount-box .grid button { height: 30px; font-size: 11px; }
          .pos-total-display { font-size: 24px; }
          .pos-pay-method { padding-top: 5px; padding-bottom: 5px; font-size: 10px; }
          .pos-pay-method .text-base { font-size: 13px; }
          .pos-checkout-button { height: 48px; font-size: 15px; border-radius: 10px; }
        }
      ` }} />

      {/* Header slim dark */}
      <header className="pos-header min-h-11 bg-slate-950 border-b border-slate-800 flex items-center px-2 sm:px-4 gap-2 sm:gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white font-black text-[11px] overflow-hidden">
            {company.logo_url
              ? <img src={company.logo_url} alt="logo" className="w-full h-full object-contain" />
              : (company.name || 'S').charAt(0).toUpperCase()}
          </div>
          <span className="font-extrabold tracking-wide text-xs">{company.name || 'POS'}</span>
          <span className="hidden md:inline text-[10px] text-slate-500 ml-1">· {user.display_name}</span>
          {branches.length > 1 && (
            <select
              value={activeBranchId || ''}
              onChange={e => setActiveBranchId(Number(e.target.value) || null)}
              title="ສາຂາ"
              className="ml-2 h-6 px-2 bg-amber-500/10 border border-amber-500/40 rounded text-[11px] font-bold text-amber-200 outline-none focus:border-amber-300"
            >
              {branches.filter(b => b.active !== false).map(b => (
                <option key={b.id} value={b.id} className="bg-slate-900">🏬 {b.name}</option>
              ))}
            </select>
          )}
          {branches.length === 1 && activeBranch && (
            <span className="ml-2 hidden md:inline text-[10px] font-bold text-amber-300/80">🏬 {activeBranch.name}</span>
          )}
          {promotions.length > 0 && (
            <button onClick={() => setShowPromoList(true)} title="ເບິ່ງໂປຣໂມຊັ່ນທີ່ໃຊ້ໄດ້"
              className="hidden md:flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 bg-violet-500/20 text-violet-300 border border-violet-500/40 rounded hover:bg-violet-500/30">
              🎁 {promotions.length} ໂປຣ
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={openCustomerDisplay}
            className="px-2 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-xs font-bold flex items-center gap-1.5" title="ເປີດຈໍລູກຄ້າ">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            <span className="hidden md:inline">ຈໍລູກຄ້າ</span>
          </button>
          <button onClick={() => setShowCatalog(true)}
            className="px-2 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-xs font-bold flex items-center gap-1.5" title="Catalog (F2)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            <span className="hidden md:inline">Catalog</span>
            <kbd className="hidden lg:inline px-1 py-0.5 bg-slate-950 border border-slate-700 rounded text-[9px] font-mono text-slate-400">F2</kbd>
          </button>
          <button onClick={openDailySummary}
            className="px-2 sm:px-3 py-1.5 bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 rounded-md text-xs font-bold flex items-center gap-1.5 shadow" title="ສະຫຼຸບຍອດຂາຍປະຈຳວັນ">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
            <span className="hidden md:inline">ສະຫຼຸບວັນນີ້</span>
          </button>
          {(() => {
            const c = debtAlerts?.counts || { overdue: 0, today: 0, upcoming: 0, later: 0, undated: 0 }
            const alertCount = (c.overdue || 0) + (c.today || 0)
            const hasUrgent = (c.overdue || 0) > 0
            const total = c.total || (alertCount + (c.upcoming || 0) + (c.later || 0) + (c.undated || 0))
            return (
              <button onClick={async () => { await loadDebtAlerts(); setShowDebtAlerts(true) }}
                className={`relative px-2 sm:px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 ${
                  hasUrgent ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse' :
                  alertCount > 0 ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' :
                  'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
                title="ໜີ້ຄ້າງສຳລະ">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                <span className="hidden md:inline">ໜີ້ຄ້າງ</span>
                {total > 0 && (
                  <span className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold flex items-center justify-center ${
                    hasUrgent ? 'bg-white text-rose-600 ring-2 ring-rose-600' :
                    alertCount > 0 ? 'bg-slate-950 text-amber-300 ring-2 ring-amber-500' :
                    'bg-slate-950 text-slate-300 ring-2 ring-slate-700'
                  }`}>{total > 99 ? '99+' : total}</span>
                )}
              </button>
            )
          })()}
          {user.role === 'admin' && (
            <button onClick={() => openReturnModal()}
              className="px-2 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-xs font-bold flex items-center gap-1.5" title="ຮັບຄືນສິນຄ້າ / ຄືນເງິນ">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-1"/></svg>
              <span className="hidden md:inline">ຮັບຄືນ</span>
            </button>
          )}
          <button onClick={loadOrders}
            className="px-2 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-xs font-bold flex items-center gap-1.5" title="ປະຫວັດ">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span className="hidden md:inline">ປະຫວັດ</span>
          </button>
          {(user.role === 'admin' || firstAccessibleAdminPath(user)) && (
            <button onClick={() => router.push(firstAccessibleAdminPath(user) || '/admin')}
              className="pos-admin-button hidden sm:inline-block px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-xs font-bold">
              Admin
            </button>
          )}
          <ThemeToggle compact />
          <button onClick={onLogout}
            className="w-8 h-8 rounded-md hover:bg-rose-600 flex items-center justify-center" title="Logout">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </header>

      {/* Scan bar */}
      <div key={flash} className={`pos-scan bg-slate-900 border-b ${flash > 0 ? 'border-red-400 animate-scan-flash' : 'border-slate-800'} px-2 py-2 shrink-0 relative`}>
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-11 shrink-0"></div>
          <div className="flex-1 flex items-center justify-between gap-3 text-[10px] font-extrabold uppercase tracking-wider">
            <div className="flex items-center gap-2 text-red-300">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400"></span>
              <span>Section 01 · ສະແກນສິນຄ້າ</span>
            </div>
            <span className="text-slate-500">Barcode / Product code / Name</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative shrink-0">
            <div className="pos-scan-icon w-11 h-11 rounded-full bg-red-500/10 border-2 border-red-500/40 flex items-center justify-center">
              <svg className="text-red-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="2" height="10"/><rect x="6" y="7" width="1" height="10"/><rect x="9" y="7" width="3" height="10"/><rect x="14" y="7" width="1" height="10"/><rect x="17" y="7" width="2" height="10"/><rect x="21" y="7" width="1" height="10"/></svg>
            </div>
            <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-pulse-ring pointer-events-none"></span>
          </div>
          <div className="flex-1 relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="ສະແກນ barcode / ພິມລະຫັດ / ຊື່..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key !== 'Enter') return
                const bc = normalizeBarcode(e.currentTarget.value)
                if (!bc) return
                e.preventDefault()
                // Guard against the auto-add useEffect having already handled this barcode
                // (scanners type chars + send Enter — both paths would otherwise trigger).
                if (lastScannedBarcodeRef.current === bc) { setSearch(''); return }
                const m = findBarcodeMatch(bc)
                if (!m) { showToast(`ບໍ່ພົບລະຫັດ: ${bc}`, 'error'); setSearch(''); return }
                handleBarcodeAutoAdd(m, bc)
              }}
              autoFocus
              className="pos-scan-input w-full h-11 px-3 bg-slate-950 border-2 border-red-500/30 text-red-100 placeholder:text-slate-500 rounded-lg text-sm font-mono-t font-bold outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/20"
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded hover:bg-slate-700 flex items-center justify-center text-slate-400 text-xs">✕</button>
            )}
          </div>
          <div className="hidden md:flex flex-col text-[10px] text-slate-500 uppercase tracking-wider font-bold gap-0.5 shrink-0">
            <span>← Enter</span>
            <span>ເພື່ອເພີ່ມ</span>
          </div>
        </div>

        {lastScan && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 animate-slide-in-top">
          <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">ລ່າສຸດ</span>
          <span className="text-[11px] font-bold text-red-400 truncate">{lastScan.product.product_name}</span>
          <span className="text-[10px] text-slate-500 font-mono-t">× {cart.find(i => i.product_id === lastScan.product.id)?.quantity || 1}</span>
          <span className="ml-auto text-[11px] font-extrabold text-red-400 font-mono-t">+{formatPrice(lastScan.product.selling_price)}</span>
        </div>
        )}
      </div>

      {/* Main: Cart invoice (left) + Summary (right) */}
      <div className="pos-shell flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden gap-2 md:gap-3 bg-slate-900 p-2 md:p-3">
        {/* Invoice */}
        <main className="flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-lg shadow-slate-950/30">
          <div className="pos-invoice-header px-4 py-3 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400 uppercase tracking-wider font-bold">
            <div className="flex items-center gap-3">
              <span className="text-red-300">Section 02 · ໃບບິນ</span>
              <span className="text-slate-600">·</span>
              <span>ວັນທີ {new Date().toLocaleDateString('lo-LA')}</span>
              <span className="text-slate-600">·</span>
              <span>ລາຍການ <span className="text-white">{cart.length}</span></span>
              <span className="text-slate-600">·</span>
              <span>ຊິ້ນ <span className="text-white">{cartCount}</span></span>
            </div>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-rose-400 hover:text-rose-300 font-bold">ລ້າງທັງໝົດ</button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 px-8 text-center">
              <div className="relative mb-5">
                <div className="w-24 h-24 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-600"><rect x="2" y="7" width="2" height="10"/><rect x="6" y="7" width="1" height="10"/><rect x="9" y="7" width="3" height="10"/><rect x="14" y="7" width="1" height="10"/><rect x="17" y="7" width="2" height="10"/><rect x="21" y="7" width="1" height="10"/></svg>
                </div>
              </div>
              <div className="text-base font-bold text-slate-400 mb-1">ລໍຖ້າການສະແກນ</div>
              <div className="text-xs text-slate-500 leading-relaxed">ສະແກນ barcode ສິນຄ້າເພື່ອເລີ່ມຕົ້ນ<br/>ຫຼື ກົດ <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono">Catalog</kbd> ເພື່ອເພີ່ມດ້ວຍມື</div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <table className="pos-cart-table w-full text-[13px] font-mono-t">
                <thead>
                  <tr className="sticky top-0 bg-slate-950/95 backdrop-blur border-b border-slate-800 text-[10px] text-slate-500 uppercase tracking-wider">
                    <th className="text-left py-2 px-3 w-10">#</th>
                    <th className="text-left py-2 px-2">ສິນຄ້າ</th>
                    <th className="text-right py-2 px-2 w-28">ຈຳນວນ</th>
                    <th className="text-right py-2 px-2 w-24">ລາຄາ</th>
                    <th className="text-right py-2 px-3 w-28">ລວມ</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let lineNumber = 0
                    return cart.flatMap((item) => {
                      const isLast = lastScan && item.product_id === lastScan.product.id && Date.now() - lastScan.at < 3000
                      const overridePrice = promoResult.priceOverrides[item.product_id]
                      const effectivePrice = overridePrice != null ? overridePrice : item.price
                      const lineDisc = promoResult.lineDiscounts[item.product_id] || 0
                      const freeQty = promoResult.freeItems[item.product_id] || 0
                      const hasPromo = lineDisc > 0 || overridePrice != null || freeQty > 0
                      const lineTotal = effectivePrice * item.quantity - lineDisc
                      const originalTotal = item.price * item.quantity
                      lineNumber += 1
                      const paidIdx = lineNumber
                      const rows = [
                        <tr key={`paid-${item.product_id}`}
                          className={`border-b border-slate-800/60 transition-colors ${isLast ? 'bg-red-500/10' : hasPromo ? 'bg-violet-500/5' : 'hover:bg-slate-900/80'}`}>
                          <td className="py-2 px-3 text-slate-600 font-bold">{String(paidIdx).padStart(2, '0')}</td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-slate-100 font-bold leading-tight">{item.name}</span>
                              {hasPromo && <span className="text-[8px] font-extrabold px-1 py-0.5 bg-violet-500 text-white rounded">🎁 PROMO</span>}
                            </div>
                            {item.code && <div className="text-[10px] text-slate-500 font-normal">{item.code}</div>}
                          </td>
                          <td className="py-2 px-2 text-right">
                            <div className="inline-flex items-center bg-slate-800 rounded border border-slate-700 overflow-hidden">
                              <button onClick={() => updateQuantity(item.product_id, -1, item.variant_id)}
                                className="w-7 h-7 hover:bg-slate-700 text-slate-100">−</button>
                              <QtyInput
                                value={item.quantity}
                                max={item.stock}
                                onCommit={n => setQuantity(item.product_id, n, item.variant_id)}
                              />
                              <button onClick={() => updateQuantity(item.product_id, 1, item.variant_id)}
                                className="w-7 h-7 hover:bg-slate-700 text-slate-100">+</button>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right">
                            {overridePrice != null ? (
                              <div>
                                <div className="text-[10px] text-slate-500 line-through">{formatNumber(item.price)}</div>
                                <div className="text-violet-400 font-bold">{formatNumber(effectivePrice)}</div>
                              </div>
                            ) : (
                              <span className="text-slate-400">{formatNumber(item.price)}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {lineDisc > 0 && !overridePrice ? (
                              <div>
                                <div className="text-[10px] text-slate-500 line-through">{formatNumber(originalTotal)}</div>
                                <div className="font-extrabold text-red-400">{formatNumber(lineTotal)}</div>
                              </div>
                            ) : (
                              <div className={`font-extrabold ${isLast ? 'text-red-300' : 'text-red-400'}`}>{formatNumber(lineTotal)}</div>
                            )}
                          </td>
                          <td className="pr-3 text-right">
                            <button onClick={() => removeFromCart(item.product_id)}
                              className="w-6 h-6 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 flex items-center justify-center text-xs">✕</button>
                          </td>
                        </tr>
                      ]
                      // Separate FREE row if BOGO granted extras
                      if (freeQty > 0) {
                        lineNumber += 1
                        const freeIdx = lineNumber
                        rows.push(
                          <tr key={`free-${item.product_id}`}
                            className="border-b border-slate-800/60 bg-emerald-500/10 hover:bg-emerald-500/15">
                            <td className="py-2 px-3 text-emerald-400 font-bold">{String(freeIdx).padStart(2, '0')}</td>
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-emerald-200 font-bold leading-tight">{item.name}</span>
                                <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-emerald-500 text-white rounded">🎁 ແຖມຟຣີ</span>
                              </div>
                              {item.code && <div className="text-[10px] text-emerald-500/60 font-normal">{item.code}</div>}
                            </td>
                            <td className="py-2 px-2 text-right">
                              <div className="inline-flex items-center bg-emerald-800/60 rounded border border-emerald-700/60 px-3 h-7">
                                <span className="font-extrabold text-emerald-200">{freeQty}</span>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-right">
                              <div>
                                <div className="text-[10px] text-slate-500 line-through">{formatNumber(item.price)}</div>
                                <div className="text-emerald-400 font-extrabold text-[11px] uppercase">ຟຣີ</div>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <div className="font-extrabold text-emerald-400">0</div>
                            </td>
                            <td className="pr-3 text-right text-emerald-500/50">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/></svg>
                            </td>
                          </tr>
                        )
                      }
                      return rows
                    })
                  })()}
                  {/* Bonus lines (cross-product gifts from bogo_cross / bundle_gift) */}
                  {(promoResult.bonusLines || []).map((bl, i) => (
                    <tr key={`bonus-${bl.product_id}-${i}`}
                      className="border-b border-slate-800/60 bg-emerald-500/10 hover:bg-emerald-500/15">
                      <td className="py-2 px-3 text-emerald-400 font-bold">{String(cart.length + Object.keys(promoResult.freeItems).filter(k => promoResult.freeItems[k] > 0).length + i + 1).padStart(2, '0')}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-emerald-200 font-bold leading-tight">{bl.name}</span>
                          <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-emerald-500 text-white rounded">🎁 ແຖມຟຣີ</span>
                          {bl.promo_name && <span className="text-[9px] text-emerald-300/80 italic">({bl.promo_name})</span>}
                        </div>
                        {bl.code && <div className="text-[10px] text-emerald-500/60 font-normal">{bl.code}</div>}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <div className="inline-flex items-center bg-emerald-800/60 rounded border border-emerald-700/60 px-3 h-7">
                          <span className="font-extrabold text-emerald-200">{bl.qty}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <div>
                          <div className="text-[10px] text-slate-500 line-through">{formatNumber(bl.price)}</div>
                          <div className="text-emerald-400 font-extrabold text-[11px] uppercase">ຟຣີ</div>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="font-extrabold text-emerald-400">0</div>
                      </td>
                      <td className="pr-3 text-right text-emerald-500/50">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/></svg>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>

        {/* Right: summary + actions */}
        <aside className="pos-summary w-full md:w-[300px] lg:w-[360px] max-h-[43vh] md:max-h-none shrink-0 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 shadow-lg shadow-slate-950/30 flex flex-col">
          <section className="pos-summary-card m-2 mb-0 rounded-xl border-2 border-red-500/30 bg-gradient-to-br from-red-500/10 to-red-600/5 p-4">
            <div className="text-[10px] text-red-300 uppercase tracking-widest font-extrabold mb-1">
              {loadedLayby ? 'ຄ້າງຊຳລະ (Layby)' : 'ມູນຄ່າລວມ'}
            </div>
            <div className="text-5xl font-extrabold text-red-400 font-mono-t tracking-tight leading-none">{formatPrice(amountDue)}</div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 font-bold">
              {discountAmount > 0 && <span className="text-rose-300">−{formatPrice(discountAmount)}</span>}
            </div>
            {loadedLayby && (
              <div className="mt-2 pt-2 border-t border-red-500/20 space-y-0.5">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
                  <span>ມູນຄ່າລວມ</span>
                  <span className="font-mono">{formatPrice(finalTotal)}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold text-emerald-300">
                  <span>ມັດຈຳແລ້ວ</span>
                  <span className="font-mono">−{formatPrice(laybyDeposit)}</span>
                </div>
              </div>
            )}
          </section>

          {loadedLayby && (
            <section className="pos-summary-card m-2 mb-0 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] font-extrabold text-amber-300 uppercase tracking-wider">📦 Layby</div>
                <button type="button" onClick={clearLoadedLayby}
                  className="text-[10px] font-extrabold px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded hover:bg-rose-500/30">
                  ✕ ຍົກເລີກໂຫຼດ
                </button>
              </div>
              <div className="text-xs font-extrabold text-amber-100 font-mono">{loadedLayby.layby_number}</div>
              <div className="text-[11px] text-amber-200/80 truncate">{loadedLayby.customer_name}{loadedLayby.customer_phone ? ` · ${loadedLayby.customer_phone}` : ''}</div>
            </section>
          )}

          <section className="pos-summary-card m-2 mb-0 rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
            <div className="text-[10px] text-red-300 uppercase tracking-wider font-extrabold mb-2">ລູກຄ້າ / ສະມາຊິກ</div>
            <button type="button" onClick={() => { setShowMemberModal(true); loadMembers(memberSearch) }}
              className={`w-full rounded-md border px-2.5 py-2 text-left transition flex items-center gap-2 ${
                selectedMember?.isDefault
                  ? 'border-slate-700 bg-slate-950/70 hover:border-slate-600'
                  : 'border-emerald-500/40 bg-emerald-500/10 hover:border-emerald-400/70'
              }`} title="ເລືອກສະມາຊິກ">
              <span className="text-base leading-none">{selectedMember?.isDefault ? '👤' : '🧑'}</span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className={`truncate text-xs font-extrabold ${selectedMember?.isDefault ? 'text-slate-100' : 'text-emerald-100'}`}>
                  {selectedMember?.name || DEFAULT_MEMBER.name}
                </div>
                <div className={`truncate text-[10px] font-mono ${selectedMember?.isDefault ? 'text-slate-500' : 'text-emerald-300'}`}>
                  {selectedMember?.isDefault ? 'GENERAL' : `★ ${formatNumber(selectedMember?.points || 0)} ແຕ້ມ`}
                </div>
              </div>
              {!selectedMember?.isDefault && (
                <span onClick={(e) => { e.stopPropagation(); setSelectedMember(DEFAULT_MEMBER) }}
                  className="w-6 h-6 rounded hover:bg-rose-500/20 text-rose-300 flex items-center justify-center text-xs cursor-pointer"
                  title="ກັບຄ່າເລີ່ມ">✕</span>
              )}
            </button>
          </section>

          <section className="pos-summary-card m-2 mb-0 rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
            <div className="text-[10px] text-red-300 uppercase tracking-wider font-extrabold mb-2">Section 03 · ສະຫຼຸບຍອດ</div>
            <div className="space-y-1.5 text-[13px] font-mono-t">
              <div className="flex justify-between text-slate-400">
                <span>ລວມຍ່ອຍ</span>
                <span>{formatPrice(cartTotal)}</span>
              </div>
              {promoResult.appliedPromos.length > 0 && (
                <div className="space-y-0.5 bg-violet-500/10 rounded p-2 border border-violet-500/30">
                  <div className="flex items-center justify-between text-[10px] font-extrabold text-violet-300 uppercase tracking-wider">
                    <span>🎁 ໂປຣໂມຊັ່ນ ({promoResult.appliedPromos.length})</span>
                    <span>−{formatPrice(promoTotalDisc)}</span>
                  </div>
                  {promoResult.appliedPromos.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-[10px] text-violet-400">
                      <span className="truncate max-w-[180px]">• {p.name}</span>
                      <span className="font-mono">−{formatPrice(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className={`pos-discount-box rounded-lg border ${manualDiscountAmount > 0 ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-800 bg-slate-950/40'} p-2 space-y-1.5`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col gap-0 min-w-0">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300">ຫຼຸດເພີ່ມ</span>
                    {discount > 0 ? (
                      <span className="text-[9px] text-slate-400 truncate">
                        {discountMode === 'percent'
                          ? `${discount}% ຂອງ ${formatPrice(afterPromos)}`
                          : afterPromos > 0 ? `≈ ${((discount / afterPromos) * 100).toFixed(1)}% ຂອງຍອດ` : ''}
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-600">ບໍ່ມີສ່ວນຫຼຸດເພີ່ມ</span>
                    )}
                  </div>
                  <span className={`font-mono-t text-sm font-extrabold ${manualDiscountAmount > 0 ? 'text-rose-400' : 'text-slate-600'}`}>
                    {manualDiscountAmount > 0 ? `−${formatPrice(manualDiscountAmount)}` : '0 ₭'}
                  </span>
                </div>

                <div className="flex items-stretch gap-1.5">
                  <div className="flex bg-slate-900 rounded-md border border-slate-700 overflow-hidden shrink-0">
                    {[
                      { key: 'percent', label: '%' },
                      { key: 'amount', label: '₭' },
                    ].map(m => (
                      <button key={m.key} type="button"
                        onClick={() => { if (discountMode !== m.key) { setDiscountMode(m.key); setDiscount(0) } }}
                        className={`w-8 h-8 text-xs font-extrabold transition ${
                          discountMode === m.key
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 relative">
                    <input type="number"
                      value={discount || ''}
                      min="0"
                      max={discountMode === 'percent' ? 100 : afterPromos}
                      step={discountMode === 'percent' ? 1 : 1000}
                      onChange={e => {
                        const v = Number(e.target.value)
                        const max = discountMode === 'percent' ? 100 : afterPromos
                        setDiscount(Math.max(0, Math.min(max, isFinite(v) ? v : 0)))
                      }}
                      onBlur={() => {
                        if (discountMode === 'amount' && discount > 0) {
                          const rounded = Math.ceil(discount / 1000) * 1000
                          const max = afterPromos
                          setDiscount(Math.min(max, rounded))
                        }
                      }}
                      placeholder="0"
                      className="w-full h-8 px-2 pr-7 bg-slate-900 border border-slate-700 rounded-md text-right font-mono-t font-extrabold text-amber-300 text-sm outline-none focus:border-amber-400" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 pointer-events-none">
                      {discountMode === 'percent' ? '%' : '₭'}
                    </span>
                  </div>
                  {discount > 0 && (
                    <button type="button" onClick={() => setDiscount(0)}
                      className="w-8 h-8 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md text-xs font-bold shrink-0"
                      title="ລ້າງ">✕</button>
                  )}
                </div>

                {discountMode === 'percent' ? (
                  <div className="grid grid-cols-4 gap-1">
                    {[5, 10, 15, 20].map(p => (
                      <button key={p} type="button"
                        onClick={() => setDiscount(p)}
                        className={`h-6 rounded text-[10px] font-extrabold transition ${
                          discount === p
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-inner'
                            : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-700/50'
                        }`}>
                        {p}%
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-1">
                    {[1000, 5000, 10000, 50000].map(v => (
                      <button key={v} type="button"
                        onClick={() => setDiscount(Math.min(afterPromos, discount + v))}
                        disabled={afterPromos <= 0}
                        className={`h-6 rounded text-[10px] font-extrabold transition bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-amber-300 border border-slate-700/50 disabled:opacity-40`}>
                        +{v >= 1000 ? `${v / 1000}K` : v}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className={`rounded-lg border ${activeCoupons.length > 0 ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-800 bg-slate-950/40'} p-2 space-y-1.5`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300">🎟 Coupon</span>
                  {activeCoupons.length > 0 && (
                    <span className="text-[9px] font-bold text-amber-400/80">{activeCoupons.length} ໃຊ້ງານ</span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={e => setCouponInput(e.target.value.toUpperCase())}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon() } }}
                    placeholder="ປ້ອນ code..."
                    className="flex-1 h-7 px-2 bg-slate-900 border border-slate-700 rounded text-amber-200 placeholder:text-slate-500 text-xs font-mono font-bold outline-none focus:border-amber-400"
                    disabled={couponBusy}
                  />
                  <button
                    type="button"
                    onClick={() => applyCoupon()}
                    disabled={couponBusy || !couponInput.trim()}
                    className="px-2.5 h-7 bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 rounded text-amber-200 text-[10px] font-extrabold transition"
                  >ໃຊ້</button>
                </div>
                {activeCoupons.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {activeCoupons.map(c => (
                      <span key={c.code} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/15 border border-amber-500/30 rounded text-[10px] font-bold text-amber-200">
                        <span className="font-mono">{c.code}</span>
                        <button onClick={() => removeCoupon(c.code)} className="text-amber-400 hover:text-rose-400">✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {vatSettings.enabled && (
                <div className="rounded-md border border-cyan-500/30 bg-cyan-500/5 px-2 py-1.5 space-y-0.5">
                  <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-cyan-300">
                    <span>{vatSettings.label} {vatSettings.rate}% {vatSettings.mode === 'inclusive' ? '· ລວມໃນ' : '· ແຍກນອກ'}</span>
                    <span className="font-mono text-cyan-200">{formatPrice(vatAmount)}</span>
                  </div>
                  {vatSettings.mode === 'exclusive' && subtotalExVat > 0 && (
                    <div className="flex items-center justify-between text-[9px] text-cyan-400/80">
                      <span>ກ່ອນ VAT</span>
                      <span className="font-mono">{formatPrice(subtotalExVat)}</span>
                    </div>
                  )}
                </div>
              )}
              {roundingAdjustment !== 0 && (
                <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  <span>ປັດສະຕັງ</span>
                  <span className="font-mono">{roundingAdjustment > 0 ? '+' : ''}{formatPrice(roundingAdjustment)}</span>
                </div>
              )}
              {loyaltySettings.loyalty_enabled !== false && redeemValue > 0 && !selectedMember?.isDefault && memberPointsAvail > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
                    <span>⭐ ໃຊ້ແຕ້ມສະສົມ</span>
                    <span className="font-mono">ມີ {formatNumber(memberPointsAvail)} ແຕ້ມ</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" max={maxRedeemable} value={pointsToRedeem}
                      onChange={e => {
                        const v = Math.max(0, Math.min(maxRedeemable, parseInt(e.target.value, 10) || 0))
                        setPointsToRedeem(v)
                      }}
                      placeholder="0"
                      className="flex-1 px-2 py-1 bg-slate-900 border border-amber-500/30 rounded text-amber-200 font-mono-t text-sm font-extrabold text-right outline-none focus:border-amber-400" />
                    <button type="button" onClick={() => setPointsToRedeem(maxRedeemable)}
                      className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 rounded text-amber-200 text-[10px] font-extrabold">MAX</button>
                    {pointsUsed > 0 && (
                      <button type="button" onClick={() => setPointsToRedeem(0)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 text-[10px] font-extrabold">ລ້າງ</button>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-amber-400/80">1 ແຕ້ມ = {formatPrice(redeemValue)}</span>
                    <span className="text-rose-400 font-mono-t font-extrabold">{pointsDiscountAmount > 0 ? `−${formatPrice(pointsDiscountAmount)}` : '0 ₭'}</span>
                  </div>
                  {Number(loyaltySettings.min_points_to_redeem) > 0 && pointsUsed > 0 && pointsUsed < Number(loyaltySettings.min_points_to_redeem) && (
                    <div className="text-[10px] text-rose-400">ຂັ້ນຕ່ຳ {formatNumber(loyaltySettings.min_points_to_redeem)} ແຕ້ມ</div>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="pos-summary-card m-2 mt-auto rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] text-red-300 uppercase tracking-wider font-extrabold">Section 05 · ດຳເນີນການ</div>
              {parkedCarts.length > 0 && (
                <button
                  onClick={() => setShowParkedModal(true)}
                  className="text-[10px] font-extrabold px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded hover:bg-amber-500/30"
                >
                  🅿️ {parkedCarts.length}
                </button>
              )}
            </div>
            <button onClick={() => {
                setAmountPaid(String(amountDue)); setShowCheckout(true)
              }}
              disabled={cart.length === 0}
              title="ຮັບເງິນ (F12)"
              className="pos-checkout-button w-full h-12 bg-gradient-to-br from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-white rounded-lg font-extrabold text-base tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 disabled:shadow-none transition-all active:scale-[0.98]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M7 12h.01M17 12h.01"/></svg>
              PAY
              <kbd className="ml-1 px-1.5 py-0.5 bg-black/25 border border-white/25 rounded text-[10px] font-mono">F12</kbd>
            </button>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <button onClick={openLaybyPicker} disabled={!!loadedLayby}
                className="py-2 bg-emerald-500/15 hover:bg-emerald-500/25 disabled:bg-slate-800/50 disabled:text-slate-600 text-emerald-200 border border-emerald-500/30 rounded-md text-[11px] font-extrabold transition">
                📦 Layby
              </button>
              <button onClick={parkCurrentCart} disabled={cart.length === 0 || !!loadedLayby}
                className="py-2 bg-amber-500/15 hover:bg-amber-500/25 disabled:bg-slate-800/50 disabled:text-slate-600 text-amber-200 border border-amber-500/30 rounded-md text-[11px] font-extrabold transition">
                🅿️ ພັກບີນ
              </button>
              <button onClick={() => { if (loadedLayby) clearLoadedLayby(); else setCart([]) }} disabled={cart.length === 0}
                className="py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/50 disabled:text-slate-600 text-slate-300 rounded-md text-[11px] font-bold transition">
                ✕ ລ້າງ
              </button>
            </div>
          </section>
        </aside>
      </div>

      {/* Member Modal */}
      {showMemberModal && (
        <Modal onClose={() => setShowMemberModal(false)} title="ເລືອກສະມາຊິກ" size="lg">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-4">
            <div className="space-y-3">
              <button type="button" onClick={() => { setSelectedMember(DEFAULT_MEMBER); setShowMemberModal(false) }}
                className={`w-full rounded-xl border p-3 text-left transition ${selectedMember?.isDefault ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50 hover:border-slate-400'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">ລູກຄ້າທົ່ວໄປ</div>
                    <div className="text-[11px] text-slate-500 font-mono">GENERAL</div>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">Default</span>
                </div>
              </button>
              <input type="text" value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                placeholder="ຄົ້ນຫາດ້ວຍ ຊື່, ເບີໂທ, ລະຫັດ..."
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-red-500" />
              <div className="max-h-[420px] overflow-y-auto space-y-2">
                {members.map(m => (
                  <button key={m.id} onClick={() => { setSelectedMember(m); setMemberSearch(''); setShowMemberModal(false) }}
                    className={`w-full rounded-xl border p-3 text-left transition ${selectedMember?.id === m.id ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-400'}`}>
                    <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold text-slate-900">{m.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{m.member_code}{m.phone ? ` · ${m.phone}` : ''}</div>
                        <div className="text-[10px] text-slate-400 truncate">{[m.village, m.district, m.province].filter(Boolean).join(', ')}</div>
                    </div>
                    <div className="shrink-0 text-right">
                        <div className="text-[10px] text-emerald-600 font-bold">Points</div>
                        <div className="font-mono-t text-sm font-extrabold text-emerald-700">{formatNumber(m.points || 0)}</div>
                    </div>
                  </div>
                  </button>
                ))}
                {members.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
                    ບໍ່ພົບສະມາຊິກ. ເພີ່ມໃໝ່ດ້ານຂວາ.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-3">ເພີ່ມສະມາຊິກໃໝ່</div>
              <div className="space-y-2">
                <input type="text" value={memberForm.name}
                  onChange={e => setMemberForm({ ...memberForm, name: e.target.value })}
                  placeholder="ຊື່ສະມາຊິກ *"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-red-500" />
                <input type="text" value={memberForm.phone}
                  onChange={e => setMemberForm({ ...memberForm, phone: e.target.value })}
                  placeholder="ເບີໂທ"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-red-500" />
                <SearchSelect value={memberForm.province} onChange={setMemberProvince}
                  options={memberProvinces.map(p => ({ value: p, label: p }))}
                  placeholder="ແຂວງ *" />
                <SearchSelect value={memberForm.district} onChange={setMemberDistrict}
                  options={memberDistricts.map(d => ({ value: d, label: d }))}
                  placeholder={memberForm.province ? 'ເມືອງ *' : 'ເລືອກແຂວງກ່ອນ'} />
                <SearchSelect value={memberForm.village} onChange={village => setMemberForm({ ...memberForm, village })}
                  options={memberVillages.map(v => ({ value: v, label: v }))}
                  placeholder={memberForm.district ? 'ບ້ານ *' : 'ເລືອກເມືອງກ່ອນ'} />
                <button onClick={createMemberQuick} disabled={creatingMember || !memberForm.name.trim()}
                  className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-extrabold">
                  {creatingMember ? 'ກຳລັງບັນທຶກ...' : '+ ເພີ່ມ ແລະ ເລືອກ'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Parked Carts Modal */}
      {showParkedModal && (
        <Modal onClose={() => setShowParkedModal(false)} title="🅿️ ບີນພັກໄວ້" size="xl">
          <div className="space-y-2">
            {parkedCarts.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">ບໍ່ມີບີນພັກ</div>
            ) : (
              parkedCarts.map(p => {
                const itemsArr = Array.isArray(p.cart) ? p.cart : []
                const total = itemsArr.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0)
                const itemCount = itemsArr.reduce((s, it) => s + (Number(it.quantity) || 0), 0)
                return (
                  <div key={p.id} className="border border-slate-200 rounded-lg p-3 hover:border-amber-400 hover:bg-amber-50/30 transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-extrabold text-slate-900 truncate">{p.name || 'ບໍ່ມີຊື່'}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {p.username && <span className="mr-2">👤 {p.username}</span>}
                          <span className="mr-2">📦 {itemCount} ຊິ້ນ</span>
                          <span>{new Date(p.updated_at || p.created_at).toLocaleString('lo-LA')}</span>
                        </div>
                        <div className="text-sm font-mono font-extrabold text-red-600 mt-1">{formatPrice(total)}</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {itemsArr.slice(0, 6).map((it, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">
                              {it.name} ×{it.quantity}
                            </span>
                          ))}
                          {itemsArr.length > 6 && <span className="text-[10px] text-slate-400">+{itemsArr.length - 6}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button
                          onClick={() => recallParkedCart(p)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded"
                        >ໂຫຼດ</button>
                        <button
                          onClick={() => deleteParkedCart(p.id)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded"
                        >ລົບ</button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Modal>
      )}

      {/* Promotion list modal */}
      {showPromoList && (
        <Modal onClose={() => setShowPromoList(false)} title="🎁 ໂປຣໂມຊັ່ນທີ່ໃຊ້ໄດ້" size="lg">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] text-slate-500">ທັງໝົດ {promotions.length} ລາຍການ</div>
            <button onClick={reloadPromotions}
              className="text-[11px] font-bold px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded">
              ↻ ໂຫຼດຄືນ
            </button>
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {promotions.map(p => <PromoCard key={p.id} promo={p} products={products} />)}
            {promotions.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm">ບໍ່ມີໂປຣໂມຊັ່ນ</div>
            )}
          </div>
        </Modal>
      )}

      {/* Layby picker */}
      {showLaybyPicker && (
        <Modal onClose={() => setShowLaybyPicker(false)} title="📦 ໂຫຼດ Layby (ມັດຈຳ)" size="xl">
          <div className="space-y-3">
            <input
              type="text"
              value={laybySearch}
              onChange={e => setLaybySearch(e.target.value)}
              placeholder="ຄົ້ນຫາ Layby #, ຊື່ລູກຄ້າ, ເບີໂທ..."
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-emerald-500" />
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {(() => {
                const term = laybySearch.trim().toLowerCase()
                const list = !term ? openLaybys : openLaybys.filter(l =>
                  String(l.layby_number || '').toLowerCase().includes(term) ||
                  String(l.customer_name || '').toLowerCase().includes(term) ||
                  String(l.customer_phone || '').toLowerCase().includes(term)
                )
                if (list.length === 0) {
                  return <div className="text-center py-12 text-slate-400 text-sm">ບໍ່ມີ Layby ເປີດຢູ່</div>
                }
                return list.map(l => (
                  <button key={l.id} type="button" onClick={() => loadLaybyToCart(l.id)} disabled={laybyBusy}
                    className="w-full text-left border border-slate-200 rounded-lg p-3 hover:border-emerald-400 hover:bg-emerald-50/30 transition disabled:opacity-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-extrabold text-slate-900 font-mono">{l.layby_number}</div>
                        <div className="text-sm font-bold text-slate-700 truncate">{l.customer_name}</div>
                        <div className="text-[11px] text-slate-500">
                          {l.customer_phone && <span className="mr-2">📞 {l.customer_phone}</span>}
                          <span className="mr-2">📦 {l.item_count || 0} ລາຍການ</span>
                          {l.due_date && <span>📅 {new Date(l.due_date).toLocaleDateString('lo-LA')}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-slate-500 font-bold">ລວມ</div>
                        <div className="text-sm font-mono font-extrabold text-slate-900">{formatPrice(l.total)}</div>
                        <div className="text-[10px] text-emerald-600 font-bold mt-1">ມັດຈຳ {formatPrice(l.paid)}</div>
                        <div className="text-[11px] font-mono font-extrabold text-amber-700">ຄ້າງ {formatPrice(l.balance)}</div>
                      </div>
                    </div>
                  </button>
                ))
              })()}
            </div>
          </div>
        </Modal>
      )}

      {/* Catalog overlay */}
      {showCatalog && (
        <div className="fixed inset-0 z-40 flex" onClick={() => setShowCatalog(false)}>
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />
          <div className="relative ml-auto w-full max-w-3xl h-full bg-white text-slate-800 flex flex-col shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Catalog</h3>
                <p className="text-[11px] text-slate-400">ເພີ່ມສິນຄ້າດ້ວຍມື ສຳລັບສິນຄ້າທີ່ບໍ່ມີ barcode</p>
              </div>
              <button onClick={() => setShowCatalog(false)}
                className="ml-auto w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-600">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-3 border-b border-slate-200 space-y-2">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input type="text" placeholder="ຄົ້ນຫາ..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-md text-[13px] outline-none focus:border-red-500" />
              </div>
              <div className="flex gap-1.5 overflow-x-auto">
                <button onClick={() => setSelectedCategory(null)}
                  className={`shrink-0 px-3 h-7 rounded text-[11px] font-bold border transition ${
                    selectedCategory === null ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}>
                  ທັງໝົດ · {catalogProducts.length}
                </button>
                {categories.map(cat => {
                  const meta = categoryMeta[cat] || { icon: '📦' }
                  const active = selectedCategory === cat
                  return (
                    <button key={cat} onClick={() => setSelectedCategory(cat)}
                      className={`shrink-0 px-3 h-7 rounded text-[11px] font-bold whitespace-nowrap border flex items-center gap-1.5 ${
                        active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}>
                      <span>{meta.icon}</span>
                      {cat}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {catalogProducts.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">ບໍ່ພົບສິນຄ້າ</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {catalogProducts.map(p => {
                    const meta = categoryMeta[p.category] || { icon: '📦', tint: 'bg-slate-100 text-slate-700 border-slate-200' }
                    const low = p.qty_on_hand > 0 && p.qty_on_hand <= p.min_stock
                    const inCart = cart.some(i => i.product_id === p.id)
                    return (
                      <button key={p.id} onClick={() => { addToCart(p); setShowCatalog(false) }}
                        className={`relative text-left bg-white border rounded-lg p-2 transition ${
                          inCart ? 'border-red-400 ring-2 ring-red-100' :
                          'border-slate-200 hover:border-slate-900 active:scale-[0.98]'
                        }`}>
                        <div className={`aspect-square rounded ${meta.tint} border flex items-center justify-center text-3xl mb-1.5 relative`}>
                          <span>{meta.icon}</span>
                          {low && <div className="absolute top-1 right-1 bg-amber-500 text-white text-[8px] font-bold px-1 rounded">LOW</div>}
                          {inCart && <div className="absolute top-1 left-1 bg-red-500 text-white text-[9px] font-extrabold px-1.5 rounded">× {cart.find(i => i.product_id === p.id)?.quantity}</div>}
                        </div>
                        {p.product_code && <div className="text-[9px] font-mono text-slate-400 truncate">{p.product_code}</div>}
                        <div className="text-[12px] font-bold text-slate-900 leading-tight line-clamp-2 min-h-[30px]">{p.product_name}</div>
                        <div className="flex items-end justify-between mt-1 pt-1 border-t border-slate-100">
                          <div className="font-extrabold text-[12px] text-red-700 font-mono-t">{formatNumber(p.selling_price)}</div>
                          <div className={`text-[9px] font-bold px-1 rounded ${low ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {p.qty_on_hand}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal — redesigned */}
      {showCheckout && (() => {
        const isCredit = paymentMethod === 'credit'
        const targetTotal = loadedLayby ? amountDue : finalTotal
        const amountByCode = {}
        if (!isCredit && payments.length > 0) {
          for (const p of payments) amountByCode[p.currency] = p.amount
        } else if (!isCredit && amountPaid) {
          amountByCode['LAK'] = amountPaid
        }

        const setAmountFor = (code, value) => {
          const clean = String(value || '').replace(/[^\d.]/g, '')
          const next = { ...amountByCode, [code]: clean }
          if (clean === '') delete next[code]
          const keys = Object.keys(next)
          if (keys.length === 0) {
            setPayments([]); setAmountPaid(''); return
          }
          if (keys.length === 1 && keys[0] === 'LAK') {
            setPayments([]); setAmountPaid(clean); return
          }
          setPayments(keys.map(k => ({ currency: k, amount: next[k] })))
          setAmountPaid('')
        }

        const addDenomination = (code, denom) => {
          const cur = (amountByCode[code] && Number(amountByCode[code])) || 0
          setAmountFor(code, String(cur + denom))
        }

        const fillExact = (code) => {
          const cur = currencies.find(c => c.code === code) || { rate: 1 }
          const otherLak = Object.entries(amountByCode).reduce((s, [c, v]) => {
            if (c === code) return s
            const r = (currencies.find(x => x.code === c) || { rate: 1 }).rate
            return s + (Number(v) || 0) * (Number(r) || 1)
          }, 0)
          const remLak = Math.max(0, targetTotal - otherLak)
          const amt = code === 'LAK' ? remLak : Math.ceil(remLak / (Number(cur.rate) || 1))
          setAmountFor(code, String(amt))
        }

        const denomMap = {
          LAK: [1000, 2000, 5000, 10000, 20000, 50000, 100000],
          THB: [20, 50, 100, 500, 1000],
          USD: [1, 5, 10, 20, 50, 100],
          CNY: [10, 20, 50, 100],
          VND: [10000, 20000, 50000, 100000, 200000, 500000],
        }

        const paidNow = isCredit ? 0 : Object.entries(amountByCode).reduce((s, [c, v]) => {
          const r = (currencies.find(x => x.code === c) || { rate: 1 }).rate
          return s + (Number(v) || 0) * (Number(r) || 1)
        }, 0)
        const remaining = Math.max(0, targetTotal - paidNow)
        const change = Math.max(0, paidNow - targetTotal)
        const fullyPaid = isCredit ? (creditCustomer.name.trim().length > 0 || !!selectedMember) && !!creditCustomer.dueDate : paidNow >= targetTotal && targetTotal > 0
        const creditDueDays = daysUntilDate(creditCustomer.dueDate)

        const progress = isCredit ? 100 : Math.min(100, targetTotal > 0 ? (paidNow / targetTotal) * 100 : 0)
        const activeCur = currencies.find(c => c.code === activeCurrencyCode) || currencies[0] || { code: 'LAK', symbol: '₭', rate: 1 }
        const activeVal = amountByCode[activeCur.code] || ''
        const activeLak = (Number(activeVal) || 0) * (Number(activeCur.rate) || 1)
        const denoms = denomMap[activeCur.code] || []

        const numpadPress = (digit) => {
          const cur = String(amountByCode[activeCur.code] || '')
          let next = cur
          if (digit === 'C') next = ''
          else if (digit === '⌫') next = cur.slice(0, -1)
          else if (digit === '00') next = (cur === '' || cur === '0') ? '0' : cur + '00'
          else if (digit === '.') { if (!cur.includes('.')) next = cur === '' ? '0.' : cur + '.' }
          else next = (cur === '0') ? String(digit) : cur + String(digit)
          setAmountFor(activeCur.code, next)
        }

        return (
        <Modal onClose={() => setShowCheckout(false)} title={isCredit ? 'ອອກບິນຕິດໜີ້' : 'ຊຳລະເງິນ'} size="2xl">
          <div className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-3">
            {/* LEFT: info + tenders + method */}
            <div className="space-y-2">
              {/* HERO */}
              <div className={`rounded-lg border p-2 ${
                fullyPaid ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-slate-50'
              }`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider">{loadedLayby ? 'ຮັບເພີ່ມ (ຫຼັງຫັກມັດຈຳ)' : 'ຕ້ອງຊຳລະ'}</span>
                  <span className="text-2xl font-extrabold font-mono-t text-slate-900 tracking-tight">{formatPrice(targetTotal)}</span>
                </div>
                {loadedLayby && (
                  <div className="text-[9px] text-slate-500 text-right">
                    ລວມ {formatPrice(finalTotal)} · <span className="text-emerald-600 font-bold">ມັດຈຳແລ້ວ −{formatPrice(laybyDeposit)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="text-[9px] font-bold text-rose-600 text-right">✂️ ຫຼຸດ −{formatPrice(discountAmount)}</div>
                )}
                <div className="mt-1.5 h-1 bg-slate-200/70 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-300 ${fullyPaid ? 'bg-emerald-500' : 'bg-amber-400'}`}
                    style={{ width: `${progress}%` }}></div>
                </div>
                <div className="grid grid-cols-3 gap-1 mt-1.5 text-center">
                  <div>
                    <div className="text-[8px] text-slate-400 font-extrabold uppercase leading-none">ຮັບແລ້ວ</div>
                    <div className="text-[11px] font-extrabold font-mono-t text-slate-800 mt-0.5">{formatPrice(paidNow)}</div>
                  </div>
                  <div>
                    <div className="text-[8px] text-slate-400 font-extrabold uppercase leading-none">{isCredit ? 'ຄ້າງຮັບ' : 'ຍັງຂາດ'}</div>
                    <div className={`text-[11px] font-extrabold font-mono-t mt-0.5 ${!fullyPaid ? 'text-amber-600' : 'text-slate-400'}`}>{formatPrice(!fullyPaid || isCredit ? remaining || targetTotal : 0)}</div>
                  </div>
                  <div>
                    <div className={`text-[8px] font-extrabold uppercase leading-none ${change > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{change > 0 ? '💰 ທອນ' : 'ເງິນທອນ'}</div>
                    <div className={`text-[11px] font-extrabold font-mono-t mt-0.5 ${change > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{formatPrice(change)}</div>
                  </div>
                </div>
              </div>

              {/* Payment method */}
              <div className="grid grid-cols-4 gap-1">
                {[
                  { key: 'cash', icon: '💵', label: 'ສົດ', color: 'emerald' },
                  { key: 'transfer', icon: '🏦', label: 'ໂອນ', color: 'blue' },
                  { key: 'qr', icon: '📱', label: 'QR', color: 'violet' },
                  { key: 'credit', icon: '🧾', label: 'ຕິດໜີ້', color: 'amber' }
                ].map(m => {
                  const active = paymentMethod === m.key
                  const isCreditDisabled = m.key === 'credit' && !!selectedMember?.isDefault
                  const activeClasses = {
                    emerald: 'border-emerald-500 bg-emerald-50 text-emerald-800',
                    blue: 'border-blue-500 bg-blue-50 text-blue-800',
                    violet: 'border-violet-500 bg-violet-50 text-violet-800',
                    amber: 'border-amber-500 bg-amber-50 text-amber-800',
                  }
                  return (
                    <button key={m.key}
                      disabled={isCreditDisabled}
                      title={isCreditDisabled ? 'ກະລຸນາເລືອກສະມາຊິກກ່ອນ (ຕິດໜີ້ບໍ່ໄດ້ສຳລັບລູກຄ້າທົ່ວໄປ)' : ''}
                      onClick={() => {
                        if (isCreditDisabled) return
                        setPaymentMethod(m.key)
                        if (m.key === 'credit') {
                          setPayments([])
                          setAmountPaid('')
                          setCreditCustomer(c => c.dueDate ? c : { ...c, dueDate: dateAfterDays(30) })
                        }
                      }}
                      className={`py-1.5 rounded-md text-[10px] font-extrabold transition border ${
                        isCreditDisabled
                          ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-60'
                          : active
                            ? activeClasses[m.color]
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}>
                      <span className="text-sm mr-1">{m.icon}</span>{m.label}
                      {isCreditDisabled && <span className="ml-1 text-[9px]">🔒</span>}
                    </button>
                  )
                })}
              </div>

              {/* Currency tabs + active display */}
              {!isCredit && (
                <div className="rounded-lg border border-slate-200 bg-white p-2">
                  <div className="flex items-center gap-1 mb-1.5 overflow-x-auto">
                    {currencies.map(c => {
                      const v = Number(amountByCode[c.code]) || 0
                      const isActive = c.code === activeCur.code
                      const hasVal = v > 0
                      return (
                        <button key={c.code} type="button"
                          onClick={() => setActiveCurrencyCode(c.code)}
                          className={`shrink-0 px-2 py-1 rounded text-[11px] font-extrabold transition border flex items-center gap-1 ${
                            isActive
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : hasVal
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}>
                          <span className="text-sm">{c.symbol}</span>
                          <span>{c.code}</span>
                          {hasVal && <span className={`text-[8px] font-mono px-1 rounded ${isActive ? 'bg-white/20' : 'bg-emerald-200 text-emerald-800'}`}>{formatNumber(v)}</span>}
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-lg font-black text-slate-700 leading-none">{activeCur.symbol}</span>
                      <div className="leading-tight">
                        <div className="text-[8px] font-extrabold text-slate-400 uppercase">ປ້ອນ ({activeCur.code})</div>
                        {activeCur.code !== 'LAK' && Number(activeVal) > 0 && (
                          <div className="text-[9px] font-bold text-emerald-700 font-mono-t">≈ {formatPrice(Math.round(activeLak))}</div>
                        )}
                        {activeCur.code !== 'LAK' && !Number(activeVal) && (
                          <div className="text-[9px] font-bold text-slate-400">@ {formatNumber(activeCur.rate)}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-lg font-extrabold font-mono-t text-slate-900 tracking-tight">
                      {activeVal ? formatNumber(activeVal) : <span className="text-slate-300">0</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1 mt-1.5">
                    <button onClick={() => fillExact(activeCur.code)}
                      className="h-7 rounded bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-extrabold">
                      ⚡ ພໍດີ
                    </button>
                    <button onClick={() => setAmountFor(activeCur.code, '')}
                      disabled={!activeVal}
                      className="h-7 rounded bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-[10px] font-extrabold disabled:opacity-40">
                      ✕ ລ້າງ
                    </button>
                  </div>
                  {denoms.length > 0 && (
                    <div className="grid grid-cols-4 gap-1 mt-1">
                      {denoms.slice(0, 8).map(d => (
                        <button key={d} onClick={() => addDenomination(activeCur.code, d)}
                          className="h-6 rounded text-[9px] font-extrabold font-mono-t bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-300 transition">
                          +{d >= 1000 ? (d / 1000) + 'K' : d}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT: numpad */}
            {!isCredit && (
              <div className="rounded-lg border border-slate-200 bg-white p-2 flex flex-col">
                <div className="grid grid-cols-3 gap-1.5 flex-1">
                  {['7','8','9','4','5','6','1','2','3','00','0','⌫'].map(k => (
                    <button key={k} type="button" onClick={() => numpadPress(k)}
                      className={`h-14 rounded-xl font-extrabold transition active:scale-95 shadow-sm ${
                        k === '⌫'
                          ? 'bg-amber-100 hover:bg-amber-200 text-amber-700 text-xl'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-900 text-2xl'
                      }`}>
                      {k}
                    </button>
                  ))}
                  <button type="button" onClick={() => numpadPress('C')}
                    className="col-span-3 h-9 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-extrabold transition">
                    C  ລ້າງທັງໝົດ
                  </button>
                </div>
              </div>
            )}
          </div>

            {isCredit && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5">
                <label className="block text-[10px] font-extrabold text-amber-700 uppercase tracking-widest mb-2">ຂໍ້ມູນລູກຄ້າຕິດໜີ້</label>
                {selectedMember && (
                  <div className="mb-2 rounded-lg border border-amber-200 bg-white/70 px-2 py-1.5 text-xs font-bold text-amber-800">
                    ໃຊ້ຂໍ້ມູນສະມາຊິກ: {selectedMember.name}{selectedMember.phone ? ` · ${selectedMember.phone}` : ''}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <input type="text" value={creditCustomer.name}
                    onChange={e => setCreditCustomer({ ...creditCustomer, name: e.target.value })}
                    placeholder={selectedMember ? 'ຊື່ລູກຄ້າ (ຖ້າຕ້ອງການປ່ຽນ)' : 'ຊື່ລູກຄ້າ *'}
                    className="p-2 bg-white border border-amber-200 rounded-lg text-sm text-slate-900 outline-none focus:border-amber-500" />
                  <input type="text" value={creditCustomer.phone}
                    onChange={e => setCreditCustomer({ ...creditCustomer, phone: e.target.value })}
                    placeholder="ເບີໂທ"
                    className="p-2 bg-white border border-amber-200 rounded-lg text-sm text-slate-900 outline-none focus:border-amber-500" />
                  <div>
                    <label className="mb-1 block text-[9px] font-extrabold uppercase tracking-widest text-amber-700">ຈຳນວນວັນ *</label>
                    <input type="number" min="0" step="1" value={creditDueDays}
                      onChange={e => {
                        const days = Math.max(0, Number(e.target.value) || 0)
                        setCreditCustomer({ ...creditCustomer, dueDate: dateAfterDays(days) })
                      }}
                      className="w-full p-2 bg-white border border-amber-300 rounded-lg text-sm font-extrabold text-slate-900 outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[9px] font-extrabold uppercase tracking-widest text-amber-700">ວັນຄົບກຳນົດ *</label>
                    <input type="date" value={creditCustomer.dueDate}
                      onChange={e => setCreditCustomer({ ...creditCustomer, dueDate: e.target.value })}
                      className="w-full p-2 bg-white border border-amber-300 rounded-lg text-sm font-extrabold text-slate-900 outline-none focus:border-amber-500" />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {[7, 15, 30].map(days => (
                    <button key={days} type="button"
                      onClick={() => setCreditCustomer({ ...creditCustomer, dueDate: dateAfterDays(days) })}
                      className="rounded-md border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-extrabold text-amber-800 hover:bg-amber-100">
                      +{days} ມື້
                    </button>
                  ))}
                  <button type="button"
                    onClick={() => setCreditCustomer({ ...creditCustomer, dueDate: dateAfterDays(0) })}
                    className="rounded-md border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-extrabold text-amber-800 hover:bg-amber-100">
                    ມື້ນີ້
                  </button>
                </div>
              </div>
            )}

            {paymentMethod === 'cash' && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-3 py-2.5">
                <div className="min-w-0 flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${drawerReady ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>💴</div>
                  <div>
                    <div className="text-xs font-extrabold text-slate-800">Cash drawer</div>
                    <div className={`text-[10px] font-bold ${drawerReady ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {drawerReady ? 'ພ້ອມເປີດອັດຕະໂນມັດ' : 'ເຊື່ອມຕໍ່ກ່ອນໃຊ້ຄັ້ງທຳອິດ'}
                    </div>
                  </div>
                </div>
                <button type="button" onClick={setupCashDrawer} disabled={drawerBusy || !isCashDrawerSupported()}
                  title={cashDrawerSupported ? 'ເຊື່ອມຕໍ່ ແລະ ທົດສອບເປີດ cash drawer' : 'Browser ບໍ່ຮອງຮັບ Web Serial'}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-extrabold text-slate-700">
                  {drawerBusy ? 'ກຳລັງເຊື່ອມ...' : drawerReady ? 'ທົດສອບເປີດ' : 'ເຊື່ອມຕໍ່'}
                </button>
              </div>
            )}

            {/* Note */}
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1">ໝາຍເຫດ</label>
              <input type="text" value={customerNote} onChange={e => setCustomerNote(e.target.value)}
                placeholder="ຂໍ້ຄວາມເພີ່ມເຕີມ..."
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:border-red-500 focus:bg-white" />
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex gap-2 mt-4 pt-3 border-t border-slate-200 sticky bottom-0 bg-white">
            <button onClick={() => setShowCheckout(false)}
              className="flex-1 py-3 bg-slate-100 border border-slate-200 rounded-xl font-extrabold text-slate-700 hover:bg-slate-200 text-sm">
              ✕ ຍົກເລີກ
            </button>
            <button onClick={handleCheckout} disabled={!fullyPaid}
              className={`flex-[2] py-3 rounded-xl font-extrabold shadow-lg text-sm flex items-center justify-center gap-2 transition ${
                !fullyPaid ? 'bg-slate-200 text-slate-400 cursor-not-allowed' :
                isCredit ? 'bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-amber-500/30' :
                'bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-emerald-500/30'
              }`}>
              {isCredit ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  ຢືນຢັນອອກບິນຕິດໜີ້ · {formatPrice(finalTotal)}
                </>
              ) : fullyPaid ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  {loadedLayby ? 'ປິດ Layby' : 'ຊຳລະ'} {formatPrice(targetTotal)}{change > 0 ? ` · ທອນ ${formatPrice(change)}` : ''}
                </>
              ) : (
                <>ຍັງຂາດ {formatPrice(remaining)}</>
              )}
            </button>
          </div>
        </Modal>
        )
      })()}

      {/* Daily Summary + Handover Modal */}
      {showDailySummary && (() => {
        const today = dailySummary?.today
        const expectedCash = Number(today?.cash_revenue) || 0
        const totalHandedOver = todayHandovers.reduce((s, h) => s + (Number(h.actual_cash) || 0), 0)
        const remainingToHand = Math.max(0, expectedCash - totalHandedOver)
        const actualNum = Number(handoverForm.actual_cash) || 0
        const diff = actualNum - remainingToHand
        return (
        <Modal onClose={() => setShowDailySummary(false)} title="ສະຫຼຸບການຂາຍ ແລະ ສົ່ງເງິນ" size="xl">
          <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">
            ວັນທີ: {new Date().toLocaleDateString('lo-LA', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </div>

          {/* Sales hero */}
          {today ? (
            <>
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white p-5 mb-4">
                <div className="absolute -right-16 -top-16 w-48 h-48 bg-red-500/20 rounded-full blur-3xl pointer-events-none"></div>
                <div className="relative grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">ຈຳນວນບິນ</div>
                    <div className="text-2xl font-extrabold font-mono-t mt-1 text-white">{formatNumber(today.count)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">ລາຍຮັບລວມ</div>
                    <div className="text-2xl font-extrabold font-mono-t mt-1 text-emerald-400">{formatPrice(today.revenue)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">ສະເລ່ຍ/ບິນ</div>
                    <div className="text-2xl font-extrabold font-mono-t mt-1 text-amber-300">{formatPrice(today.avg_order)}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-700 mb-1"><span className="text-base">💵</span> ເງິນສົດ</div>
                  <div className="text-lg font-extrabold text-emerald-800 font-mono-t">{formatPrice(today.cash_revenue)}</div>
                  <div className="text-[10px] text-emerald-600 font-mono-t">{today.cash_count} ບິນ</div>
                </div>
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-red-700 mb-1"><span className="text-base">🏦</span> ໂອນ</div>
                  <div className="text-lg font-extrabold text-red-800 font-mono-t">{formatPrice(today.transfer_revenue)}</div>
                  <div className="text-[10px] text-red-600 font-mono-t">{today.transfer_count} ບິນ</div>
                </div>
                <div className="bg-violet-50 border-2 border-violet-200 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-violet-700 mb-1"><span className="text-base">📱</span> QR</div>
                  <div className="text-lg font-extrabold text-violet-800 font-mono-t">{formatPrice(today.qr_revenue)}</div>
                  <div className="text-[10px] text-violet-600 font-mono-t">{today.qr_count} ບິນ</div>
                </div>
              </div>

              {dailySummary.top_items?.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4">
                  <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">🏆 ສິນຄ້າຂາຍດີວັນນີ້</div>
                  <div className="space-y-1">
                    {dailySummary.top_items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between text-[12px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-5 h-5 rounded text-[10px] font-extrabold flex items-center justify-center ${
                            i === 0 ? 'bg-yellow-100 text-yellow-700' :
                            i === 1 ? 'bg-slate-200 text-slate-700' :
                            i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                          }`}>{i + 1}</span>
                          <span className="font-semibold text-slate-800 truncate">{it.name || '—'}</span>
                        </div>
                        <div className="text-right shrink-0 font-mono-t">
                          <span className="text-slate-600">{formatNumber(it.qty)} ຊິ້ນ</span>
                          <span className="ml-2 text-emerald-700 font-extrabold">{formatPrice(it.revenue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-10 text-slate-400">ຍັງບໍ່ມີຂໍ້ມູນການຂາຍວັນນີ້</div>
          )}

          {/* Cash handover section */}
          <div className="pt-4 mt-4 border-t-2 border-dashed border-slate-300">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 10v4M18 10v4"/></svg>
              </span>
              <h3 className="text-sm font-extrabold text-slate-900">ການສົ່ງເງິນປະຈຳວັນ</h3>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-3">
                <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">ເງິນສົດຈາກການຂາຍ</div>
                <div className="text-lg font-extrabold text-slate-800 font-mono-t">{formatPrice(expectedCash)}</div>
              </div>
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-3">
                <div className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-widest">ສົ່ງແລ້ວ</div>
                <div className="text-lg font-extrabold text-emerald-800 font-mono-t">{formatPrice(totalHandedOver)}</div>
                <div className="text-[10px] text-emerald-600">{todayHandovers.length} ຄັ້ງ</div>
              </div>
              <div className={`rounded-xl p-3 border-2 ${remainingToHand > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-[10px] font-extrabold uppercase tracking-widest ${remainingToHand > 0 ? 'text-amber-700' : 'text-slate-500'}`}>ຍັງຕ້ອງສົ່ງ</div>
                <div className={`text-lg font-extrabold font-mono-t ${remainingToHand > 0 ? 'text-amber-800' : 'text-slate-500'}`}>{formatPrice(remainingToHand)}</div>
              </div>
            </div>

            <div className="bg-white border-2 border-slate-200 rounded-xl p-3 space-y-2 mb-3">
              <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">ບັນທຶກການສົ່ງເງິນໃໝ່</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">ຈຳນວນທີ່ສົ່ງ (ກີບ)</label>
                  <input type="text" inputMode="decimal" pattern="[0-9]*"
                    value={handoverForm.actual_cash}
                    onChange={e => setHandoverForm({ ...handoverForm, actual_cash: e.target.value.replace(/[^\d.]/g, '') })}
                    placeholder={String(remainingToHand)}
                    className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-200 rounded-lg text-right text-xl font-extrabold font-mono-t text-slate-900 outline-none focus:border-red-500 focus:bg-white" />
                  <button onClick={() => setHandoverForm({ ...handoverForm, actual_cash: String(remainingToHand) })}
                    className="mt-1 w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-bold">
                    = ສົ່ງເທົ່າທີ່ຍັງຄ້າງ ({formatPrice(remainingToHand)})
                  </button>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">ຜູ້ຮັບເງິນ</label>
                  <input type="text" value={handoverForm.received_by}
                    onChange={e => setHandoverForm({ ...handoverForm, received_by: e.target.value })}
                    placeholder="ຊື່ຜູ້ຮັບ"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:border-red-500" />
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 mt-2">ໝາຍເຫດ</label>
                  <input type="text" value={handoverForm.note}
                    onChange={e => setHandoverForm({ ...handoverForm, note: e.target.value })}
                    placeholder="ຂໍ້ຄວາມເພີ່ມເຕີມ..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:border-red-500" />
                </div>
              </div>

              {handoverForm.actual_cash && (
                <div className={`rounded-lg p-2 text-[12px] font-bold flex items-center justify-between ${
                  Math.abs(diff) < 1 ? 'bg-emerald-50 text-emerald-700' :
                  diff > 0 ? 'bg-red-50 text-red-700' : 'bg-rose-50 text-rose-700'
                }`}>
                  <span>{Math.abs(diff) < 1 ? '✓ ພໍດີ' : diff > 0 ? '▲ ເກີນ' : '▼ ຂາດ'}</span>
                  <span className="font-mono-t">{formatPrice(Math.abs(diff))}</span>
                </div>
              )}

              <button onClick={submitHandover} disabled={handoverSaving || !handoverForm.actual_cash}
                className="w-full py-2.5 bg-gradient-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 disabled:from-slate-300 disabled:to-slate-300 text-white rounded-lg font-extrabold text-sm flex items-center justify-center gap-2">
                {handoverSaving ? (
                  <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div> ກຳລັງບັນທຶກ...</>
                ) : (
                  <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg> ບັນທຶກການສົ່ງເງິນ</>
                )}
              </button>
            </div>

            {todayHandovers.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-3">
                <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">ປະຫວັດການສົ່ງເງິນວັນນີ້</div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {todayHandovers.map(h => {
                    const hdiff = Number(h.diff) || 0
                    return (
                      <div key={h.id} className="flex items-center gap-2 text-[12px] bg-slate-50 rounded-lg p-2 border border-slate-100">
                        <div className="shrink-0 w-8 h-8 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-800 font-mono-t">{formatPrice(h.actual_cash)}</div>
                          <div className="text-[10px] text-slate-500">
                            {new Date(h.created_at).toLocaleTimeString('lo-LA', { hour: '2-digit', minute: '2-digit' })}
                            {h.received_by && ` · ຮັບ: ${h.received_by}`}
                            {h.note && ` · ${h.note}`}
                          </div>
                        </div>
                        {Math.abs(hdiff) >= 1 && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${hdiff > 0 ? 'bg-red-100 text-red-700' : 'bg-rose-100 text-rose-700'}`}>
                            {hdiff > 0 ? '▲' : '▼'} {formatPrice(Math.abs(hdiff))}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 flex justify-end">
            <button onClick={() => setShowDailySummary(false)}
              className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-sm">
              ປິດ
            </button>
          </div>
        </Modal>
        )
      })()}

      {/* Receipt Modal */}
      {showReceipt && (
        <Modal onClose={() => setShowReceipt(null)} size="sm">
          <div className="text-center">
            <div className={`w-14 h-14 rounded-full ${showReceipt.payment_method === 'credit' ? 'bg-amber-100 border-amber-300' : 'bg-emerald-100 border-emerald-300'} border-2 flex items-center justify-center mx-auto mb-3`}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={showReceipt.payment_method === 'credit' ? '#b45309' : '#065f46'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">{showReceipt.payment_method === 'credit' ? 'ອອກບິນຕິດໜີ້ສຳເລັດ' : 'ການຊຳລະສຳເລັດ'}</h3>
            <div className="text-[11px] text-slate-500 mt-0.5">
              ໃບບິນ {showReceipt.bill_number || `#${showReceipt.id}`} · {new Date(showReceipt.created_at).toLocaleString('lo-LA')}
            </div>
          </div>
          <div className="my-4 py-3 border-y border-dashed border-slate-300 space-y-1">
            {(showReceipt.items || []).map((item, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-slate-700 flex-1">
                  {item.name}<span className="text-slate-400 ml-1">× {item.quantity}</span>
                </span>
                <span className="font-medium text-slate-800 font-mono-t">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-slate-500"><span>ລວມຍ່ອຍ</span><span className="font-mono-t">{formatPrice(showReceipt.total)}</span></div>
            {showReceipt.discount > 0 && <div className="flex justify-between text-rose-700"><span>ຫຼຸດ</span><span className="font-mono-t">−{formatPrice(showReceipt.discount)}</span></div>}
            <div className="flex justify-between text-slate-500"><span>ຮັບເງິນ</span><span className="font-mono-t">{formatPrice(showReceipt.amount_paid)}</span></div>
            <div className={`flex justify-between font-extrabold ${showReceipt.payment_method === 'credit' ? 'text-amber-700' : 'text-red-700'} pt-2 mt-1 border-t border-slate-200`}>
              <span>{showReceipt.payment_method === 'credit' ? 'ຍອດຄ້າງ' : 'ເງິນທອນ'}</span>
              <span className="font-mono-t">{formatPrice(showReceipt.payment_method === 'credit' ? Number(showReceipt.total) - Number(showReceipt.amount_paid || 0) : showReceipt.change_amount)}</span>
            </div>
          </div>
          {showReceipt.payment_method === 'credit' && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-900">
              <div className="font-bold text-amber-700 mb-0.5 text-[10px] uppercase tracking-wider">ລູກຄ້າຕິດໜີ້</div>
              <div>{showReceipt.customer_name || '—'}{showReceipt.customer_phone ? ` · ${showReceipt.customer_phone}` : ''}</div>
              {showReceipt.credit_due_date && <div className="mt-0.5">ກຳນົດຊຳລະ: {new Date(showReceipt.credit_due_date).toLocaleDateString('lo-LA')}</div>}
            </div>
          )}
          {showReceipt.member_id && (
            <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs text-emerald-900">
              <div className="font-bold text-emerald-700 mb-0.5 text-[10px] uppercase tracking-wider">ສະມາຊິກ</div>
              <div>{showReceipt.customer_name || '—'}</div>
              {Number(showReceipt.member_points_used) > 0 && (
                <div className="mt-0.5 text-amber-700">ໃຊ້ແຕ້ມ: −{formatNumber(showReceipt.member_points_used)} ({formatPrice(showReceipt.member_points_discount || 0)})</div>
              )}
              <div className="mt-0.5">ຄະແນນບິນນີ້: +{formatNumber(showReceipt.member_points_earned || 0)}</div>
            </div>
          )}
          {showReceipt.note && (
            <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700">
              <div className="font-bold text-slate-500 mb-0.5 text-[10px] uppercase tracking-wider">ໝາຍເຫດ</div>
              {showReceipt.note}
            </div>
          )}
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1">
              <span className="px-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">ຂະຫນາດ</span>
              {[
                { key: '80mm', label: '80mm', sub: 'Thermal' },
                { key: 'a5', label: 'A5', sub: 'ກະດາດ' },
                { key: 'a4', label: 'A4', sub: 'Invoice' },
              ].map(s => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setReceiptSize(s.key)}
                  className={`flex-1 rounded-md py-1.5 text-center text-xs font-bold transition ${
                    receiptSize === s.key
                      ? 'bg-red-600 text-white shadow'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className="leading-none">{s.label}</div>
                  <div className={`mt-0.5 text-[9px] font-semibold leading-none ${receiptSize === s.key ? 'text-red-100' : 'text-slate-400'}`}>{s.sub}</div>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => printReceipt(showReceipt)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                ພິມໃບບິນ ({receiptSize === '80mm' ? '80mm' : receiptSize.toUpperCase()})
              </button>
              <button onClick={() => setShowReceipt(null)}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-sm">
                ສຳເລັດ
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Debt Alerts Modal */}
      {showDebtAlerts && (
        <Modal onClose={() => setShowDebtAlerts(false)} title="ແຈ້ງເຕືອນໜີ້ຄ້າງສຳລະ" size="lg">
          {(() => {
            const a = debtAlerts || { counts: {}, totals: {}, overdue: [], today: [], upcoming: [], undated: [] }
            const fmt = formatPrice
            const fmtN = formatNumber
            const daysText = (d) => {
              if (d == null) return 'ບໍ່ມີວັນຄົບກຳນົດ'
              if (d < 0) return `ເກີນ ${fmtN(Math.abs(d))} ວັນ`
              if (d === 0) return 'ກຳນົດມື້ນີ້'
              return `ເຫຼືອ ${fmtN(d)} ວັນ`
            }
            const sections = [
              { key: 'overdue', title: '🔴 ເກີນກຳນົດ', items: a.overdue || [], total: a.totals?.overdue || 0, tone: 'rose' },
              { key: 'today', title: '🟠 ກຳນົດມື້ນີ້', items: a.today || [], total: a.totals?.today || 0, tone: 'amber' },
              { key: 'upcoming', title: `🟡 ໃກ້ຄົບກຳນົດ (≤${a.upcoming_days || 7} ວັນ)`, items: a.upcoming || [], total: a.totals?.upcoming || 0, tone: 'yellow' },
              { key: 'later', title: `🔵 ກຳນົດໃນອະນາຄົດ (>${a.upcoming_days || 7} ວັນ)`, items: a.later || [], total: a.totals?.later || 0, tone: 'blue' },
              { key: 'undated', title: '⚪ ບໍ່ມີວັນຄົບກຳນົດ', items: a.undated || [], total: a.totals?.undated || 0, tone: 'slate' },
            ]
            const tones = {
              rose: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', amount: 'text-rose-700', badge: 'bg-rose-600 text-white' },
              amber: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', amount: 'text-amber-700', badge: 'bg-amber-500 text-white' },
              yellow: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-800', amount: 'text-yellow-700', badge: 'bg-yellow-500 text-white' },
              blue: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', amount: 'text-blue-700', badge: 'bg-blue-500 text-white' },
              slate: { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700', amount: 'text-slate-700', badge: 'bg-slate-500 text-white' },
            }
            const grandTotal = sections.reduce((s, sec) => s + sec.total, 0)
            const grandCount = a.counts?.total || 0
            if (grandCount === 0) {
              return (
                <div className="text-center py-10">
                  <div className="text-4xl mb-2">✅</div>
                  <div className="text-base font-extrabold text-emerald-700">ບໍ່ມີໜີ້ຄ້າງສຳລະ</div>
                  <div className="text-xs text-slate-500 mt-1">ລູກຄ້າທຸກຄົນຊຳລະຄົບແລ້ວ</div>
                </div>
              )
            }
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {sections.map(s => {
                    const t = tones[s.tone]
                    return (
                      <div key={s.key} className={`rounded-xl border p-2.5 ${t.bg}`}>
                        <div className={`text-[10px] font-extrabold uppercase tracking-wider ${t.text}`}>{s.title}</div>
                        <div className={`mt-1 text-xl font-extrabold ${t.amount}`}>{fmtN(s.items.length)}</div>
                        <div className={`text-[11px] font-bold font-mono-t ${t.amount}`}>{fmt(s.total)}</div>
                      </div>
                    )
                  })}
                </div>
                <div className="rounded-lg bg-slate-900 text-white px-3 py-2 flex items-center justify-between text-sm">
                  <span className="font-extrabold">ລວມໜີ້ຄ້າງທັງໝົດ</span>
                  <span className="font-mono-t font-extrabold">{fmtN(grandCount)} ບິນ · {fmt(grandTotal)}</span>
                </div>
                {sections.filter(s => s.items.length > 0).map(s => {
                  const t = tones[s.tone]
                  return (
                    <div key={s.key} className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className={`px-3 py-2 flex items-center justify-between text-xs font-extrabold ${t.bg} ${t.text}`}>
                        <span>{s.title} · {fmtN(s.items.length)} ບິນ</span>
                        <span className="font-mono-t">{fmt(s.total)}</span>
                      </div>
                      <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                        {s.items.map(it => (
                          <div key={it.id} className="px-3 py-2 flex items-center gap-3 hover:bg-slate-50">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] font-extrabold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{it.bill_number || `#${it.id}`}</span>
                                <span className="font-bold text-slate-900 truncate">{it.customer_name}</span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {it.customer_phone ? `${it.customer_phone} · ` : ''}
                                {it.credit_due_date ? `ກຳນົດ ${new Date(it.credit_due_date).toLocaleDateString('lo-LA')}` : '—'}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className={`text-sm font-extrabold font-mono-t ${t.amount}`}>{fmt(it.remaining)}</div>
                              <div className={`mt-0.5 inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold ${t.badge}`}>{daysText(it.days_until_due)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
                <div className="flex gap-2 pt-2">
                  <button onClick={() => { router.push('/admin/customer-debts'); setShowDebtAlerts(false) }}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm">
                    ໄປໜ້າຈັດການໜີ້ລູກຄ້າ
                  </button>
                  <button onClick={() => setShowDebtAlerts(false)}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-sm">
                    ປິດ
                  </button>
                </div>
              </div>
            )
          })()}
        </Modal>
      )}

      {/* Orders Modal */}
      {showOrders && (
        <Modal onClose={() => setShowOrders(false)} title="ປະຫວັດການຂາຍ" size="xl">
          {/* Daily summary */}
          {dailySummary?.today && (
            <div className="mb-4">
              <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">ສະຫຼຸບການຂາຍປະຈຳວັນ · {new Date().toLocaleDateString('lo-LA')}</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                  <div className="text-[10px] font-bold text-red-500 uppercase tracking-wider">ຈຳນວນບິນ</div>
                  <div className="text-xl font-extrabold text-red-700 font-mono-t">{formatNumber(dailySummary.today.count)}</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                  <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">ລາຍຮັບລວມ</div>
                  <div className="text-xl font-extrabold text-emerald-700 font-mono-t">{formatPrice(dailySummary.today.revenue)}</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ສະເລ່ຍ/ບິນ</div>
                  <div className="text-xl font-extrabold text-slate-800 font-mono-t">{formatPrice(dailySummary.today.avg_order)}</div>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                  <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">ສ່ວນຫຼຸດລວມ</div>
                  <div className="text-xl font-extrabold text-amber-700 font-mono-t">{formatPrice(dailySummary.today.discount)}</div>
                </div>
              </div>
              {/* Payment method breakdown */}
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                <div className="bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-between">
                  <span className="font-bold text-slate-600">💵 ສົດ</span>
                  <span className="font-mono-t"><span className="font-extrabold">{dailySummary.today.cash_count}</span> · <span className="text-emerald-700">{formatPrice(dailySummary.today.cash_revenue)}</span></span>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-between">
                  <span className="font-bold text-slate-600">🏦 ໂອນ</span>
                  <span className="font-mono-t"><span className="font-extrabold">{dailySummary.today.transfer_count}</span> · <span className="text-emerald-700">{formatPrice(dailySummary.today.transfer_revenue)}</span></span>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-between">
                  <span className="font-bold text-slate-600">📱 QR</span>
                  <span className="font-mono-t"><span className="font-extrabold">{dailySummary.today.qr_count}</span> · <span className="text-emerald-700">{formatPrice(dailySummary.today.qr_revenue)}</span></span>
                </div>
                <div className="bg-white border border-amber-200 rounded-lg p-2 flex items-center justify-between">
                  <span className="font-bold text-amber-700">🧾 ຕິດໜີ້</span>
                  <span className="font-mono-t"><span className="font-extrabold">{dailySummary.today.credit_count || 0}</span> · <span className="text-amber-700">{formatPrice(dailySummary.today.credit_revenue || 0)}</span></span>
                </div>
              </div>
              {/* Top items today */}
              {dailySummary.top_items?.length > 0 && (
                <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">🏆 ສິນຄ້າຂາຍດີວັນນີ້</div>
                  <div className="space-y-1">
                    {dailySummary.top_items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between text-[12px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-5 h-5 rounded text-[10px] font-extrabold flex items-center justify-center ${
                            i === 0 ? 'bg-yellow-100 text-yellow-700' :
                            i === 1 ? 'bg-slate-200 text-slate-700' :
                            i === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-slate-100 text-slate-500'
                          }`}>{i + 1}</span>
                          <span className="font-semibold text-slate-800 truncate">{it.name || '—'}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono-t font-bold text-slate-700">{formatNumber(it.qty)} ຊິ້ນ</span>
                          <span className="ml-2 font-mono-t text-emerald-700 font-extrabold">{formatPrice(it.revenue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab switcher */}
          <div className="flex gap-1 mb-3 p-1 bg-slate-100 rounded-lg w-fit">
            <button onClick={() => setOrdersTab('sales')}
              className={`px-3 py-1.5 rounded-md text-[11px] font-extrabold transition ${ordersTab === 'sales' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700'}`}>
              ບິນຂາຍ · {orders.length}
            </button>
            <button onClick={() => setOrdersTab('returns')}
              className={`px-3 py-1.5 rounded-md text-[11px] font-extrabold transition ${ordersTab === 'returns' ? 'bg-white text-rose-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}>
              ↩ ບິນຮັບຄືນ · {returnsHistory.length}
            </button>
          </div>

          {ordersTab === 'returns' && (
            <div className="space-y-2 max-h-[55vh] overflow-y-auto">
              {returnsHistory.map(r => (
                <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-3 hover:border-slate-400 transition">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono-t bg-rose-100 text-rose-900 font-extrabold px-2 py-0.5 rounded shrink-0">{r.return_number || `#${r.id}`}</span>
                        <span className="text-[10px] font-mono-t bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">ບິນ {r.bill_number || `#${r.order_id}`}</span>
                        <span className="text-[10px] text-slate-500">{new Date(r.created_at).toLocaleString('lo-LA')}</span>
                      </div>
                      <div className="mt-1.5 text-[11px] text-slate-600">
                        {(r.items || []).map((it, i) => (
                          <span key={i}>{i > 0 && ', '}{it.product_name || '—'} × {it.quantity}</span>
                        ))}
                      </div>
                      {r.customer_name && <div className="text-[10px] text-slate-500 mt-0.5">ລູກຄ້າ: {r.customer_name}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider">ຍອດຄືນ</div>
                        <div className="text-lg font-extrabold text-rose-700 font-mono-t">{formatPrice(r.refund_amount)}</div>
                      </div>
                      {user.role === 'admin' && (
                        <button onClick={() => deleteReturn(r)}
                          className="w-7 h-7 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded flex items-center justify-center" title="ຍົກເລີກການຮັບຄືນ (ສະຕັອກກັບ)">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {returnsHistory.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-sm">ຍັງບໍ່ມີການຮັບຄືນ</div>
              )}
            </div>
          )}

          {ordersTab === 'sales' && (
          <>
          {/* Orders list */}
          <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">ບິນຫຼ້າສຸດ · {orders.length} ລາຍການ</div>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {orders.map(order => {
              const isToday = new Date(order.created_at).toDateString() === new Date().toDateString()
              return (
                <div key={order.id} className="bg-white border border-slate-200 rounded-xl p-3 hover:border-slate-400 transition">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono-t bg-red-100 text-red-900 font-extrabold px-2 py-0.5 rounded shrink-0">{order.bill_number || `#${order.id}`}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900">
                          {order.payment_method === 'cash' ? '💵 ເງິນສົດ' : order.payment_method === 'transfer' ? '🏦 ໂອນ' : order.payment_method === 'credit' ? '🧾 ຂາຍຕິດໜີ້' : '📱 QR'}
                          {order.member_id && <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">ສະມາຊິກ</span>}
                          {isToday && <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">ມື້ນີ້</span>}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(order.created_at).toLocaleString('lo-LA')}
                          {order.payment_method === 'credit' && order.customer_name ? ` · ${order.customer_name}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-lg font-extrabold text-red-700 font-mono-t">{formatPrice(order.total)}</div>
                      </div>
                      <div className="flex items-center overflow-hidden rounded border border-slate-200 bg-slate-50" title="Reprint">
                        {[
                          { key: '80mm', label: '80' },
                          { key: 'a5', label: 'A5' },
                          { key: 'a4', label: 'A4' },
                        ].map(size => (
                          <button key={size.key} onClick={() => printReceipt(order, size.key)}
                            className="h-7 px-2 border-r last:border-r-0 border-slate-200 hover:bg-slate-200 text-[10px] font-extrabold text-slate-700">
                            {size.label}
                          </button>
                        ))}
                      </div>
                      {user.role === 'admin' && (
                        <button onClick={() => openReturnModal(order)}
                          className="w-7 h-7 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded flex items-center justify-center" title="ຮັບຄືນ / ຄືນເງິນ">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-1"/></svg>
                        </button>
                      )}
                      {user.role === 'admin' && (
                        <button onClick={() => cancelOrder(order.id)}
                          className="w-7 h-7 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded flex items-center justify-center" title="ຍົກເລີກບິນ">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 space-y-0.5">
                    {(order.items || []).map((item, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-slate-600">{item.name || item.product_name}<span className="text-slate-400 ml-1">× {item.quantity}</span></span>
                        <span className="font-medium text-slate-700 font-mono-t">{formatPrice(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  {order.note && (
                    <div className="mt-2 text-[11px] text-slate-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      📝 {order.note}
                    </div>
                  )}
                  {order.payment_method === 'credit' && (
                    <div className="mt-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      ຍອດຄ້າງ {formatPrice(Number(order.total) - Number(order.amount_paid || 0))}
                      {order.credit_due_date ? ` · ກຳນົດ ${new Date(order.credit_due_date).toLocaleDateString('lo-LA')}` : ''}
                    </div>
                  )}
                </div>
              )
            })}
            {orders.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm">ຍັງບໍ່ມີການຂາຍ</div>
            )}
          </div>
          </>
          )}
        </Modal>
      )}

      {showReturn && (
        <Modal onClose={() => !returnBusy && setShowReturn(false)} title="ຮັບຄືນສິນຄ້າ / ຄືນເງິນ" size="xl">
          <div className="space-y-3">
            {/* Search bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input
                  value={returnSearch}
                  onChange={e => setReturnSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') lookupReturnOrder() }}
                  className="w-full h-11 pl-9 pr-3 border-2 border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  placeholder="ປ້ອນເລກບິນ ຫຼື Order ID..."
                  disabled={returnBusy}
                  autoFocus
                />
              </div>
              <button
                onClick={() => lookupReturnOrder()}
                disabled={returnBusy || !returnSearch.trim()}
                className="px-5 h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-sm font-extrabold flex items-center gap-1.5"
              >
                {returnBusy ? (
                  <><div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"></div> ກຳລັງຄົ້ນ...</>
                ) : 'ຄົ້ນຫາ'}
              </button>
            </div>

            {!returnLookup?.order && !returnBusy && (
              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center">
                <div className="text-3xl mb-1">🧾</div>
                <div className="text-sm font-bold text-slate-500">ປ້ອນເລກບິນເພື່ອເລີ່ມຮັບຄືນ</div>
                <div className="text-[11px] text-slate-400 mt-0.5">ເຊັ່ນ: INV-202605-00006</div>
              </div>
            )}

            {returnLookup?.order && (
              <>
                {/* Order info card */}
                <div className="rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">ບິນອ້າງອີງ</div>
                      <div className="font-mono text-xl font-extrabold text-slate-900 mt-0.5">{returnLookup.order.bill_number || `#${returnLookup.order.id}`}</div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                        <span>{new Date(returnLookup.order.created_at).toLocaleString('lo-LA')}</span>
                        <span className="text-slate-300">·</span>
                        <span className="font-bold">👤 {returnLookup.order.customer_name || 'ລູກຄ້າທົ່ວໄປ'}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">ຍອດບິນ</div>
                      <div className="font-mono-t text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">{formatPrice(returnLookup.order.total || 0)}</div>
                    </div>
                  </div>
                </div>

                {/* Items as cards */}
                <div className="rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">ສິນຄ້າທີ່ສາມາດຮັບຄືນ</div>
                    <span className="text-[10px] font-bold text-slate-400">{(returnLookup.items || []).length} ລາຍການ</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {(returnLookup.items || []).map((item, idx) => {
                      const maxQty = Number(item.returnable_qty) || 0
                      const selectedQty = Math.max(0, Math.min(Number(returnQty[item.order_item_id]) || 0, maxQty))
                      const setQ = (n) => setReturnQty(prev => ({
                        ...prev,
                        [item.order_item_id]: Math.max(0, Math.min(Number(n) || 0, maxQty))
                      }))
                      const isSelected = selectedQty > 0
                      const disabled = returnBusy || maxQty <= 0
                      return (
                        <div key={item.order_item_id} className={`p-3 ${maxQty <= 0 ? 'bg-slate-50/60 opacity-60' : isSelected ? 'bg-blue-50/40' : ''}`}>
                          <div className="flex items-start gap-3">
                            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-extrabold ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                              {idx + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-slate-900 text-sm truncate">{item.product_name || '—'}</div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                                <span>ຂາຍ <b className="text-slate-700">{formatNumber(item.sold_qty || 0)}</b></span>
                                <span>ຄືນໄດ້ <b className={maxQty > 0 ? 'text-emerald-600' : 'text-slate-400'}>{formatNumber(maxQty)}</b></span>
                                <span className="text-slate-300">·</span>
                                <span>ລາຄາ <b className="text-slate-700 font-mono">{formatNumber(item.price || 0)}</b> ₭</span>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className={`font-mono text-base font-extrabold ${isSelected ? 'text-blue-700' : 'text-slate-300'}`}>
                                {formatPrice(selectedQty * (Number(item.price) || 0))}
                              </div>
                            </div>
                          </div>
                          {maxQty > 0 && (
                            <div className="mt-2 flex items-center gap-2 pl-10">
                              <div className="flex items-stretch rounded-md border border-slate-200 overflow-hidden">
                                <button type="button" onClick={() => setQ(selectedQty - 1)} disabled={disabled || selectedQty <= 0}
                                  className="w-8 h-8 bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-30 text-sm font-extrabold">−</button>
                                <input type="number" min="0" max={maxQty} step="1"
                                  value={returnQty[item.order_item_id] ?? ''}
                                  onChange={e => setQ(e.target.value)}
                                  disabled={disabled}
                                  placeholder="0"
                                  className="w-14 h-8 text-center font-mono font-bold text-slate-800 outline-none border-x border-slate-200" />
                                <button type="button" onClick={() => setQ(selectedQty + 1)} disabled={disabled || selectedQty >= maxQty}
                                  className="w-8 h-8 bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-30 text-sm font-extrabold">+</button>
                              </div>
                              <button type="button" onClick={() => setQ(maxQty)} disabled={disabled}
                                className="h-8 px-2.5 rounded-md bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-[10px] font-extrabold text-slate-600 disabled:opacity-30">
                                MAX
                              </button>
                              {selectedQty > 0 && (
                                <button type="button" onClick={() => setQ(0)} disabled={returnBusy}
                                  className="h-8 px-2 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs">✕</button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {returnLookup.returns?.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <div className="text-[10px] font-extrabold text-amber-700 uppercase tracking-widest mb-1">ເຄີຍຮັບຄືນແລ້ວ · {returnLookup.returns.length}</div>
                    <div className="space-y-0.5">
                      {returnLookup.returns.map(ret => (
                        <div key={ret.id} className="flex justify-between gap-3 text-[11px] text-amber-900">
                          <span className="font-mono">{ret.return_number} · {new Date(ret.created_at).toLocaleString('lo-LA')}</span>
                          <span className="font-mono-t font-extrabold">{formatPrice(ret.refund_amount || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Refund method + note */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5">ວິທີຄືນເງິນ</div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { key: 'cash', icon: '💵', label: 'ເງິນສົດ' },
                        { key: 'transfer', icon: '🏦', label: 'ໂອນ' },
                        { key: 'qr', icon: '📱', label: 'QR' },
                        { key: 'store_credit', icon: '🎟️', label: 'ເຄຣດິດ' },
                      ].map(m => {
                        const active = returnMethod === m.key
                        return (
                          <button key={m.key} type="button" onClick={() => setReturnMethod(m.key)}
                            disabled={returnBusy}
                            className={`py-2 rounded-lg text-[11px] font-extrabold transition border-2 ${
                              active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                            }`}>
                            <div className="text-lg leading-none mb-0.5">{m.icon}</div>
                            <div>{m.label}</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1">ໝາຍເຫດ / ເຫດຜົນ</div>
                    <textarea
                      value={returnNote}
                      onChange={e => setReturnNote(e.target.value)}
                      disabled={returnBusy}
                      rows={2}
                      placeholder="ສິນຄ້າຊຳລຸດ, ບໍ່ຖືກໃຈ, ສິນຄ້າຜິດ..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 resize-none"
                    />
                  </div>
                </div>

                {/* Sticky summary bar */}
                <div className="sticky bottom-0 z-10 rounded-xl border-2 border-blue-500 bg-gradient-to-r from-blue-600 to-blue-700 p-3 shadow-xl shadow-blue-500/20">
                  <div className="flex items-center justify-between gap-3 text-white">
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-widest text-blue-100">ຍອດຕ້ອງຄືນເງິນ</div>
                      <div className="mt-0.5 text-2xl font-extrabold font-mono tracking-tight">{formatPrice(returnRefundTotal)}</div>
                      <div className="text-[10px] font-bold text-blue-200 mt-0.5">
                        {selectedReturnItems.length > 0
                          ? `${formatNumber(selectedReturnItems.reduce((s, x) => s + Number(x.quantity || 0), 0))} ຊິ້ນ · ${selectedReturnItems.length} ລາຍການ`
                          : 'ຍັງບໍ່ໄດ້ເລືອກສິນຄ້າ'}
                      </div>
                    </div>
                    <button
                      onClick={submitReturn}
                      disabled={returnBusy || selectedReturnItems.length === 0}
                      className="rounded-xl bg-white px-5 py-2.5 text-sm font-extrabold text-blue-700 shadow-lg hover:bg-blue-50 disabled:bg-blue-500 disabled:text-blue-200 disabled:cursor-not-allowed transition flex items-center gap-2"
                    >
                      {returnBusy ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-blue-300 border-t-blue-700 rounded-full animate-spin"></div>
                          ກຳລັງບັນທຶກ...
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>
                          ບັນທຶກຮັບຄືນ
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
