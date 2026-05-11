'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { calculatePromotions } from '../utils/promotions'
import { useCompanyProfile } from '../utils/useCompanyProfile'
import { connectCashDrawer, isCashDrawerSupported, openCashDrawer } from '../utils/cashDrawer'

const API = '/api'

function formatPrice(price) { return new Intl.NumberFormat('lo-LA').format(price) + ' ₭' }
function formatNumber(n) { return new Intl.NumberFormat('lo-LA').format(n) }

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
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-3xl' }
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

export default function POS({ user, onLogout }) {
  const router = useRouter()
  const company = useCompanyProfile()
  const searchInputRef = useRef(null)
  const lastScannedBarcodeRef = useRef('')
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [search, setSearch] = useState('')
  const [showCheckout, setShowCheckout] = useState(false)
  const [amountPaid, setAmountPaid] = useState('')
  const [showReceipt, setShowReceipt] = useState(null)
  const [showOrders, setShowOrders] = useState(false)
  const [orders, setOrders] = useState([])
  const [toast, setToast] = useState(null)
  const [discount, setDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [customerNote, setCustomerNote] = useState('')
  const [showCatalog, setShowCatalog] = useState(false)
  const [lastScan, setLastScan] = useState(null)
  const [flash, setFlash] = useState(0)
  const [currencies, setCurrencies] = useState([])
  const [payments, setPayments] = useState([]) // [{ currency, amount }]
  const [promotions, setPromotions] = useState([])
  const [dailySummary, setDailySummary] = useState(null)
  const [showDailySummary, setShowDailySummary] = useState(false)
  const [todayHandovers, setTodayHandovers] = useState([])
  const [handoverForm, setHandoverForm] = useState({ actual_cash: '', received_by: '', note: '' })
  const [handoverSaving, setHandoverSaving] = useState(false)
  const [drawerBusy, setDrawerBusy] = useState(false)
  const [drawerReady, setDrawerReady] = useState(false)
  const [cashDrawerSupported, setCashDrawerSupported] = useState(false)
  const customerWinRef = useRef(null)
  const bcRef = useRef(null)

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

  // Refocus scan input ONLY when all modals just closed (no polling to avoid stealing focus from other inputs)
  const anyModalOpen = showCheckout || showOrders || showReceipt || showCatalog || showDailySummary
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
    return source.find(product => normalizeBarcode(product.barcode) === normalizedBarcode) || null
  }, [normalizeBarcode, products])

  const flashScreen = () => {
    setFlash(f => f + 1)
    setTimeout(() => setFlash(f => Math.max(0, f - 1)), 300)
  }

  const handleBarcodeAutoAdd = (product, barcode) => {
    const normalizedBarcode = normalizeBarcode(barcode)
    if (!product || !normalizedBarcode) return
    lastScannedBarcodeRef.current = normalizedBarcode
    addToCart(product)
    setLastScan({ product, at: Date.now() })
    flashScreen()
    setSearch('')
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }

  const addToCart = (product) => {
    if (product.qty_on_hand <= 0) { showToast('ສິນຄ້າໝົດສະຕ໊ອກ', 'error'); return }
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.id)
      if (existing) {
        if (existing.quantity >= product.qty_on_hand) { showToast('ເກີນຈຳນວນສະຕ໊ອກ', 'error'); return prev }
        return prev.map(item => item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...prev, {
        product_id: product.id, name: product.product_name, code: product.product_code,
        price: Number(product.selling_price), unit: product.unit, quantity: 1, stock: product.qty_on_hand,
        category: product.category, brand: product.brand,
      }]
    })
  }

  const updateQuantity = (productId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.product_id !== productId) return item
      const newQty = item.quantity + delta
      if (newQty <= 0) return null
      if (newQty > item.stock) { showToast('ເກີນຈຳນວນສະຕ໊ອກ', 'error'); return item }
      return { ...item, quantity: newQty }
    }).filter(Boolean))
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
  const promoResult = useMemo(() => calculatePromotions(cart, promotions, products), [cart, promotions, products])
  const promoLineDiscTotal = useMemo(() => Object.values(promoResult.lineDiscounts || {}).reduce((a, b) => a + b, 0), [promoResult])
  const promoCartDisc = promoResult.cartDiscount || 0
  const promoTotalDisc = promoLineDiscTotal + promoCartDisc
  const afterPromos = cartTotal - promoTotalDisc
  const manualDiscountAmount = (afterPromos * discount) / 100
  const discountAmount = manualDiscountAmount + promoTotalDisc
  const finalTotal = afterPromos - manualDiscountAmount
  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart])

  // Open BroadcastChannel once per mount
  useEffect(() => {
    try { bcRef.current = new BroadcastChannel('sml-pos') } catch { return }
    return () => {
      try { bcRef.current?.close() } catch {}
      bcRef.current = null
    }
  }, [])

  // Broadcast state to customer display
  useEffect(() => {
    const bc = bcRef.current
    if (!bc) return
    try {
      bc.postMessage({
        type: 'state',
        cart: cart.map(i => ({ product_id: i.product_id, name: i.name, code: i.code, price: i.price, quantity: i.quantity })),
        subtotal: cartTotal,
        discount,
        discountAmount,
        finalTotal,
        cartCount,
      })
    } catch {}
  }, [cart, cartTotal, discount, discountAmount, finalTotal, cartCount])

  const openCustomerDisplay = () => {
    if (customerWinRef.current && !customerWinRef.current.closed) {
      customerWinRef.current.focus(); return
    }
    const w = window.open('/customer', 'sml-customer-display', 'width=1280,height=800')
    if (!w) { showToast('ບໍ່ສາມາດເປີດຈໍລູກຄ້າ — ກະລຸນາອະນຸຍາດ popup', 'error'); return }
    customerWinRef.current = w
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

  const handleCheckout = async () => {
    const useMulti = payments.length > 0
    let paid, paymentsPayload = null
    if (useMulti) {
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
    if (paid < finalTotal) { showToast('ຈຳນວນເງິນບໍ່ພຽງພໍ', 'error'); return }
    // Build items: normal cart + same-product BOGO extras + cross-product bonus lines (all price=0 for stock deduction)
    const checkoutItems = []
    for (const it of cart) {
      checkoutItems.push({ product_id: it.product_id, quantity: it.quantity, price: it.price })
      const freeQty = promoResult.freeItems?.[it.product_id] || 0
      // Only add free if NOT already covered by cross-product bonus (same product from cart)
      const inBonus = (promoResult.bonusLines || []).some(bl => bl.product_id === it.product_id)
      if (freeQty > 0 && !inBonus) {
        checkoutItems.push({ product_id: it.product_id, quantity: freeQty, price: 0 })
      }
    }
    for (const bl of (promoResult.bonusLines || [])) {
      checkoutItems.push({ product_id: bl.product_id, quantity: bl.qty, price: 0 })
    }
    const res = await fetch(`${API}/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: checkoutItems,
        total: finalTotal,
        change_amount: paid - finalTotal,
        payment_method: paymentsPayload && paymentsPayload.length > 1 ? 'mixed' : paymentMethod,
        amount_paid: paid,
        discount: discountAmount,
        note: customerNote,
        payments: paymentsPayload,
      })
    })
    if (res.ok) {
      const order = await res.json()
      showToast('ການຊຳລະສຳເລັດ', 'success')
      const shouldOpenDrawer = paymentMethod === 'cash' || (paymentsPayload && paymentsPayload.length > 0)
      if (shouldOpenDrawer) kickCashDrawer()
      try { bcRef.current?.postMessage({ type: 'complete', order }) } catch {}
      setShowReceipt(order); setCart([]); setAmountPaid(''); setShowCheckout(false)
      setDiscount(0); setCustomerNote(''); setLastScan(null); setPayments([])
      fetchProducts()
    } else { const err = await res.json(); showToast(err.error, 'error') }
  }

  const loadOrders = async () => {
    const [oRes, sRes] = await Promise.all([
      fetch(`${API}/orders`),
      fetch(`${API}/orders/summary`)
    ])
    setOrders(await oRes.json())
    try { setDailySummary(await sRes.json()) } catch { setDailySummary(null) }
    setShowOrders(true)
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

  const printReceipt = (order) => {
    if (!order) return
    const methodText = order.payment_method === 'cash' ? 'ເງິນສົດ' : order.payment_method === 'transfer' ? 'ໂອນ' : order.payment_method === 'qr' ? 'QR' : order.payment_method
    const dt = new Date(order.created_at || Date.now())
    const dateStr = dt.toLocaleString('lo-LA')
    const lines = (order.items || []).map(it => `
      <div class="row">
        <div class="name">${(it.name || it.product_name || '—')}</div>
        <div class="qtyrow">
          <span>${it.quantity} × ${formatNumber(it.price)}</span>
          <span>${formatNumber(Number(it.price) * Number(it.quantity))}</span>
        </div>
      </div>
    `).join('')

    const html = `<!doctype html>
    <html><head><meta charset="utf-8"><title>ໃບບິນ #${order.id}</title>
    <style>
      @page { size: 80mm auto; margin: 0 }
      * { box-sizing: border-box; font-family: 'Noto Sans Lao','Phetsarath OT',system-ui,sans-serif; }
      body { margin: 0; padding: 6mm 4mm; width: 80mm; color: #000; font-size: 12px; line-height: 1.35; }
      .center { text-align: center }
      .bold { font-weight: 800 }
      .xl { font-size: 16px }
      .lg { font-size: 14px }
      .sm { font-size: 11px }
      .xs { font-size: 10px; color: #666 }
      .divider { border-top: 1px dashed #000; margin: 6px 0 }
      .double { border-top: 2px solid #000; margin: 6px 0 }
      .row { margin: 3px 0 }
      .name { font-weight: 700 }
      .qtyrow { display: flex; justify-content: space-between; font-family: monospace; }
      .total { display: flex; justify-content: space-between; margin: 2px 0; font-family: monospace; }
      .total-label { }
      .total-value { font-variant-numeric: tabular-nums }
      .grand { font-size: 16px; font-weight: 800; }
      .note { font-size: 10px; color: #333; margin-top: 4px; padding: 4px; border: 1px dashed #000; }
      @media print { .no-print { display: none } }
    </style></head><body>
      ${company.logo_url ? `<div class="center"><img src="${location.origin}${company.logo_url}" style="max-height:40px;max-width:60mm;margin:0 auto 4px" /></div>` : ''}
      <div class="center bold xl">${company.name || 'POS'}</div>
      ${company.slogan ? `<div class="center xs">${company.slogan}</div>` : ''}
      ${company.address ? `<div class="center xs">${company.address}</div>` : ''}
      ${(company.phone || company.email) ? `<div class="center xs">${[company.phone, company.email].filter(Boolean).join(' · ')}</div>` : ''}
      ${(company.tax_id || company.business_reg_no) ? `<div class="center xs">${[company.tax_id && `TAX: ${company.tax_id}`, company.business_reg_no && `REG: ${company.business_reg_no}`].filter(Boolean).join(' · ')}</div>` : ''}
      <div class="divider"></div>

      <div class="sm"><span class="bold">ໃບບິນ:</span> #${order.id}</div>
      <div class="sm"><span class="bold">ວັນທີ:</span> ${dateStr}</div>
      <div class="sm"><span class="bold">ພະນັກງານ:</span> ${user?.display_name || '—'}</div>
      <div class="sm"><span class="bold">ວິທີຊຳລະ:</span> ${methodText}</div>
      <div class="divider"></div>

      ${lines || '<div class="xs">ບໍ່ມີລາຍການ</div>'}

      <div class="divider"></div>
      <div class="total"><span class="total-label">ລວມຍ່ອຍ</span><span class="total-value">${formatPrice(order.total)}</span></div>
      ${Number(order.discount) > 0 ? `<div class="total"><span class="total-label">ສ່ວນຫຼຸດ</span><span class="total-value">−${formatPrice(order.discount)}</span></div>` : ''}
      <div class="double"></div>
      <div class="total grand"><span>ລວມທັງໝົດ</span><span class="total-value">${formatPrice(order.total)}</span></div>
      <div class="divider"></div>
      <div class="total"><span>ຮັບເງິນ</span><span class="total-value">${formatPrice(order.amount_paid)}</span></div>
      <div class="total bold"><span>ເງິນທອນ</span><span class="total-value">${formatPrice(order.change_amount)}</span></div>

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

    const win = window.open('', '_blank', 'width=360,height=700')
    if (!win) { showToast('ບໍ່ສາມາດເປີດປ່ອງພິມໄດ້', 'error'); return }
    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  const quickAmounts = [5000, 10000, 20000, 50000, 100000]
  const catalogProducts = useMemo(() => products.filter(p => p.qty_on_hand > 0), [products])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-900 text-slate-100 text-[13px]">
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
      ` }} />

      {/* Header slim dark */}
      <header className="min-h-11 bg-slate-950 border-b border-slate-800 flex items-center px-2 sm:px-4 gap-2 sm:gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white font-black text-[11px] overflow-hidden">
            {company.logo_url
              ? <img src={company.logo_url} alt="logo" className="w-full h-full object-contain" />
              : (company.name || 'S').charAt(0).toUpperCase()}
          </div>
          <span className="font-extrabold tracking-wide text-xs">{company.name || 'POS'}</span>
          <span className="hidden md:inline text-[10px] text-slate-500 ml-1">· {user.display_name}</span>
          {promotions.length > 0 && (
            <button onClick={reloadPromotions} title="ໂຫຼດໂປຣໂມຊັ່ນໃໝ່"
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
            className="px-2 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-xs font-bold flex items-center gap-1.5" title="Catalog">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            <span className="hidden md:inline">Catalog</span>
          </button>
          <button onClick={openDailySummary}
            className="px-2 sm:px-3 py-1.5 bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 rounded-md text-xs font-bold flex items-center gap-1.5 shadow" title="ສະຫຼຸບຍອດຂາຍປະຈຳວັນ">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
            <span className="hidden md:inline">ສະຫຼຸບວັນນີ້</span>
          </button>
          <button onClick={loadOrders}
            className="px-2 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-xs font-bold flex items-center gap-1.5" title="ປະຫວັດ">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span className="hidden md:inline">ປະຫວັດ</span>
          </button>
          {user.role === 'admin' && (
            <button onClick={() => router.push('/admin')}
              className="hidden sm:inline-block px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-xs font-bold">
              Admin
            </button>
          )}
          <button onClick={onLogout}
            className="w-8 h-8 rounded-md hover:bg-rose-600 flex items-center justify-center" title="Logout">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </header>

      {/* Scan bar */}
      <div key={flash} className={`bg-slate-900 border-b-2 ${flash > 0 ? 'border-red-400 animate-scan-flash' : 'border-slate-800'} px-4 py-3 shrink-0 relative`}>
        <section className="max-w-6xl mx-auto rounded-xl border border-slate-800 bg-slate-950/70 p-3 shadow-lg shadow-slate-950/30">
          <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-extrabold uppercase tracking-wider">
            <div className="flex items-center gap-2 text-red-300">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400"></span>
              <span>Section 01 · ສະແກນສິນຄ້າ</span>
            </div>
            <span className="text-slate-500">Barcode / Product code / Name</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-full bg-red-500/10 border-2 border-red-500/40 flex items-center justify-center">
                <svg className="text-red-400" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="2" height="10"/><rect x="6" y="7" width="1" height="10"/><rect x="9" y="7" width="3" height="10"/><rect x="14" y="7" width="1" height="10"/><rect x="17" y="7" width="2" height="10"/><rect x="21" y="7" width="1" height="10"/></svg>
              </div>
              <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-pulse-ring pointer-events-none"></span>
            </div>
            <div className="flex-1 relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="ສະແກນ barcode ຫຼື ພິມລະຫັດ / ຊື່..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key !== 'Enter') return
                  const bc = normalizeBarcode(e.currentTarget.value)
                  if (!bc) return
                  const m = findBarcodeMatch(bc)
                  if (!m) { showToast(`ບໍ່ພົບລະຫັດ: ${bc}`, 'error'); setSearch(''); return }
                  e.preventDefault()
                  handleBarcodeAutoAdd(m, bc)
                }}
                autoFocus
                className="w-full h-12 px-4 bg-slate-950 border-2 border-red-500/30 text-red-100 placeholder:text-slate-500 rounded-lg text-base font-mono-t font-bold outline-none focus:border-red-400 focus:ring-4 focus:ring-red-500/20"
              />
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded hover:bg-slate-700 flex items-center justify-center text-slate-400">✕</button>
              )}
            </div>
            <div className="hidden md:flex flex-col text-[10px] text-slate-500 uppercase tracking-wider font-bold gap-0.5">
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
        </section>
      </div>

      {/* Main: Cart invoice (left) + Summary (right) */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden gap-2 md:gap-3 bg-slate-900 p-2 md:p-3">
        {/* Invoice */}
        <main className="flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-lg shadow-slate-950/30">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400 uppercase tracking-wider font-bold">
            <div className="flex items-center gap-3">
              <span className="text-red-300">Section 02 · ໃບບິນ</span>
              <span className="text-slate-600">·</span>
              <span>ໃບບິນ #{new Date().toISOString().split('T')[0].replace(/-/g, '').slice(2)}</span>
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
              <table className="w-full text-[13px] font-mono-t">
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
                              <button onClick={() => updateQuantity(item.product_id, -1)}
                                className="w-7 h-7 hover:bg-slate-700 text-white">−</button>
                              <span className="px-2 font-extrabold text-white w-10 text-center">{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.product_id, 1)}
                                className="w-7 h-7 hover:bg-slate-700 text-white">+</button>
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
        <aside className="w-full md:w-[300px] lg:w-[360px] max-h-[45vh] md:max-h-none shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-lg shadow-slate-950/30 flex flex-col">
          <section className="m-3 mb-0 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-[10px] text-red-300 uppercase tracking-wider font-extrabold mb-3">Section 03 · ສະຫຼຸບຍອດ</div>
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
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-2">
                  <span>ຫຼຸດເພີ່ມ</span>
                  <div className="flex items-center bg-slate-800 rounded border border-slate-700">
                    <input type="number" value={discount}
                      onChange={e => setDiscount(Math.min(100, Math.max(0, Number(e.target.value))))}
                      className="w-12 px-1 py-0.5 bg-transparent text-right font-extrabold text-amber-400 outline-none text-xs" />
                    <span className="px-1 text-[10px] text-amber-500">%</span>
                  </div>
                </span>
                <span className="text-rose-400">{manualDiscountAmount > 0 ? `−${formatPrice(manualDiscountAmount)}` : '0 ₭'}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t-2 border-red-500/30">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">ລວມທັງໝົດ</div>
              <div className="text-4xl font-extrabold text-red-400 font-mono-t tracking-tight leading-none">{formatPrice(finalTotal)}</div>
            </div>
          </section>

          <section className="m-3 mb-0 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-[10px] text-red-300 uppercase tracking-wider font-extrabold mb-2">Section 04 · ວິທີຊຳລະ</div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { key: 'cash', icon: '💵', label: 'ສົດ' },
                { key: 'transfer', icon: '🏦', label: 'ໂອນ' },
                { key: 'qr', icon: '📱', label: 'QR' }
              ].map(m => (
                <button key={m.key} onClick={() => setPaymentMethod(m.key)}
                  className={`py-2 rounded-md text-[11px] font-bold transition border ${
                    paymentMethod === m.key ? 'bg-red-500 text-slate-950 border-red-400' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
                  }`}>
                  <div className="text-base leading-none mb-0.5">{m.icon}</div>
                  <div>{m.label}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="m-3 mt-auto rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-[10px] text-red-300 uppercase tracking-wider font-extrabold mb-3">Section 05 · ດຳເນີນການ</div>
            <button onClick={() => { setAmountPaid(String(finalTotal)); setShowCheckout(true) }}
              disabled={cart.length === 0}
              className="w-full h-20 bg-gradient-to-br from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-white rounded-xl font-extrabold text-xl tracking-wider flex items-center justify-center gap-3 shadow-2xl shadow-red-500/20 disabled:shadow-none transition-all active:scale-[0.98]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M7 12h.01M17 12h.01"/></svg>
              PAY
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button onClick={() => setCart([])} disabled={cart.length === 0}
                className="py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/50 disabled:text-slate-600 text-slate-300 rounded-md text-[11px] font-bold transition">
                ✕ ລ້າງ
              </button>
              <button onClick={() => setShowCatalog(true)}
                className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-[11px] font-bold">
                + ເພີ່ມດ້ວຍມື
              </button>
            </div>
          </section>
        </aside>
      </div>

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
        const amountByCode = {}
        if (payments.length > 0) {
          for (const p of payments) amountByCode[p.currency] = p.amount
        } else if (amountPaid) {
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
          const remLak = Math.max(0, finalTotal - otherLak)
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

        const paidNow = Object.entries(amountByCode).reduce((s, [c, v]) => {
          const r = (currencies.find(x => x.code === c) || { rate: 1 }).rate
          return s + (Number(v) || 0) * (Number(r) || 1)
        }, 0)
        const remaining = Math.max(0, finalTotal - paidNow)
        const change = Math.max(0, paidNow - finalTotal)
        const fullyPaid = paidNow >= finalTotal && finalTotal > 0

        return (
        <Modal onClose={() => setShowCheckout(false)} title="ຊຳລະເງິນ" size="lg">
          <div className="space-y-3">
            {/* HERO — total + live status + progress */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white p-5">
              <div className="absolute -right-16 -top-16 w-48 h-48 bg-red-500/20 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="relative grid grid-cols-2 gap-4 items-end">
                <div>
                  <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">ຍອດຕ້ອງຊຳລະ</div>
                  <div className="text-3xl font-extrabold font-mono-t mt-1 text-red-400">{formatPrice(finalTotal)}</div>
                  {discount > 0 && <div className="text-[10px] text-slate-500 mt-0.5">ຫຼຸດ {discount}% = −{formatPrice(discountAmount)}</div>}
                </div>
                <div className="text-right">
                  {!fullyPaid ? (
                    <>
                      <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">ຍັງຂາດ</div>
                      <div className={`text-3xl font-extrabold font-mono-t mt-1 ${paidNow > 0 ? 'text-amber-400' : 'text-slate-500'}`}>{formatPrice(remaining)}</div>
                    </>
                  ) : (
                    <>
                      <div className="text-[10px] text-amber-200 font-extrabold uppercase tracking-widest">💰 ເງິນທອນ</div>
                      <div className="text-3xl font-extrabold font-mono-t mt-1 text-amber-300">{formatPrice(change)}</div>
                    </>
                  )}
                </div>
              </div>
              <div className="relative mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-200 ${fullyPaid ? 'bg-emerald-400' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, finalTotal > 0 ? (paidNow / finalTotal) * 100 : 0)}%` }}></div>
              </div>
            </div>

            {/* Currency rows — always visible for every enabled currency */}
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">ຮັບເງິນ</label>
              <div className="space-y-2">
                {currencies.map(c => {
                  const val = amountByCode[c.code] || ''
                  const lak = (Number(val) || 0) * (Number(c.rate) || 1)
                  const denoms = denomMap[c.code] || []
                  const active = !!val && Number(val) > 0
                  return (
                    <div key={c.code}
                      className={`rounded-2xl border-2 p-3 transition ${active ? 'border-red-300 bg-red-50/40' : 'border-slate-200 bg-slate-50/50'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center ${active ? 'bg-slate-900 text-white' : 'bg-white border-2 border-slate-200 text-slate-700'}`}>
                          <span className="text-xl font-black leading-none">{c.symbol}</span>
                          <span className="text-[9px] font-mono font-bold mt-0.5 opacity-80">{c.code}</span>
                        </div>
                        <input type="text" inputMode="decimal" pattern="[0-9]*"
                          value={val}
                          onChange={e => setAmountFor(c.code, e.target.value)}
                          placeholder="0"
                          className="flex-1 min-w-0 h-14 px-3 bg-white border-2 border-slate-200 rounded-xl text-right text-2xl font-extrabold font-mono-t text-slate-900 outline-none focus:border-slate-900 placeholder:text-slate-300" />
                        <div className="shrink-0 w-24 text-right">
                          {c.code !== 'LAK' && active && (
                            <>
                              <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">≈ LAK</div>
                              <div className="text-xs font-extrabold font-mono-t text-emerald-700 truncate">{formatNumber(Math.round(lak))}</div>
                            </>
                          )}
                          {c.code === 'LAK' && (
                            <div className="text-[9px] text-slate-400 font-bold">@ 1 ກີບ</div>
                          )}
                        </div>
                        <button onClick={() => fillExact(c.code)} title="ຍອດທີ່ຍັງຂາດ"
                          className="shrink-0 w-12 h-14 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-extrabold flex items-center justify-center">
                          = ພໍດີ
                        </button>
                        {active && (
                          <button onClick={() => setAmountFor(c.code, '')} title="ລ້າງ"
                            className="shrink-0 w-9 h-14 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 flex items-center justify-center">✕</button>
                        )}
                      </div>
                      {denoms.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {denoms.map(d => (
                            <button key={d} onClick={() => addDenomination(c.code, d)}
                              className="px-2.5 py-1 bg-white hover:bg-red-50 hover:text-red-700 text-slate-600 border border-slate-200 hover:border-red-200 rounded-md text-[11px] font-extrabold font-mono-t transition">
                              +{d >= 1000 ? (d / 1000) + 'K' : d}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Payment method */}
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">ວິທີຊຳລະ</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'cash', icon: '💵', label: 'ເງິນສົດ' },
                  { key: 'transfer', icon: '🏦', label: 'ໂອນ' },
                  { key: 'qr', icon: '📱', label: 'QR Code' }
                ].map(m => (
                  <button key={m.key} onClick={() => setPaymentMethod(m.key)}
                    className={`py-2.5 rounded-xl text-xs font-bold transition border-2 ${
                      paymentMethod === m.key ? 'bg-slate-900 text-white border-slate-900 shadow' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                    }`}>
                    <span className="text-base mr-1">{m.icon}</span>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === 'cash' && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-800">Cash drawer</div>
                  <div className={`text-[10px] font-bold ${drawerReady ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {drawerReady ? 'ພ້ອມເປີດອັດຕະໂນມັດ' : 'ເຊື່ອມຕໍ່ກ່ອນໃຊ້ຄັ້ງທຳອິດ'}
                  </div>
                </div>
                <button type="button" onClick={setupCashDrawer} disabled={drawerBusy || !isCashDrawerSupported()}
                  title={cashDrawerSupported ? 'ເຊື່ອມຕໍ່ ແລະ ທົດສອບເປີດ cash drawer' : 'Browser ບໍ່ຮອງຮັບ Web Serial'}
                  className="shrink-0 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-extrabold text-slate-700">
                  {drawerBusy ? 'ກຳລັງເຊື່ອມ...' : drawerReady ? 'ທົດສອບເປີດ' : 'ເຊື່ອມຕໍ່'}
                </button>
              </div>
            )}

            {/* Note */}
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">ໝາຍເຫດ</label>
              <input type="text" value={customerNote} onChange={e => setCustomerNote(e.target.value)}
                placeholder="ຂໍ້ຄວາມເພີ່ມເຕີມ..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:border-red-500 focus:bg-white" />
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex gap-2 mt-5 pt-4 border-t border-slate-200">
            <button onClick={() => setShowCheckout(false)}
              className="flex-1 py-3 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-200 text-sm">
              ຍົກເລີກ
            </button>
            <button onClick={handleCheckout} disabled={!fullyPaid}
              className="flex-[2] py-3 bg-gradient-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl font-extrabold shadow-lg text-sm flex items-center justify-center gap-2">
              {fullyPaid ? (
                <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> ຢືນຢັນການຊຳລະ</>
              ) : (
                <>ຮັບເງິນເພີ່ມ {formatPrice(remaining)}</>
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
            <div className="w-14 h-14 rounded-full bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center mx-auto mb-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#065f46" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">ການຊຳລະສຳເລັດ</h3>
            <div className="text-[11px] text-slate-500 mt-0.5">
              ໃບບິນ #{showReceipt.id} · {new Date(showReceipt.created_at).toLocaleString('lo-LA')}
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
            <div className="flex justify-between font-extrabold text-red-700 pt-2 mt-1 border-t border-slate-200">
              <span>ເງິນທອນ</span><span className="font-mono-t">{formatPrice(showReceipt.change_amount)}</span>
            </div>
          </div>
          {showReceipt.note && (
            <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700">
              <div className="font-bold text-slate-500 mb-0.5 text-[10px] uppercase tracking-wider">ໝາຍເຫດ</div>
              {showReceipt.note}
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button onClick={() => printReceipt(showReceipt)}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              ພິມໃບບິນ
            </button>
            <button onClick={() => setShowReceipt(null)}
              className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-sm">
              ສຳເລັດ
            </button>
          </div>
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
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
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

          {/* Orders list */}
          <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">ບິນຫຼ້າສຸດ · {orders.length} ລາຍການ</div>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {orders.map(order => {
              const isToday = new Date(order.created_at).toDateString() === new Date().toDateString()
              return (
                <div key={order.id} className="bg-white border border-slate-200 rounded-xl p-3 hover:border-slate-400 transition">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono-t bg-red-100 text-red-900 font-extrabold px-2 py-0.5 rounded shrink-0">#{order.id}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900">
                          {order.payment_method === 'cash' ? '💵 ເງິນສົດ' : order.payment_method === 'transfer' ? '🏦 ໂອນ' : '📱 QR'}
                          {isToday && <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">ມື້ນີ້</span>}
                        </div>
                        <div className="text-[10px] text-slate-500">{new Date(order.created_at).toLocaleString('lo-LA')}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-lg font-extrabold text-red-700 font-mono-t">{formatPrice(order.total)}</div>
                      </div>
                      <button onClick={() => printReceipt(order)}
                        className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded flex items-center justify-center" title="ພິມໃບບິນ">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                      </button>
                      <button onClick={() => cancelOrder(order.id)}
                        className="w-7 h-7 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded flex items-center justify-center" title="ຍົກເລີກບິນ">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                      </button>
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
                </div>
              )
            })}
            {orders.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm">ຍັງບໍ່ມີການຂາຍ</div>
            )}
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
