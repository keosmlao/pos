// Promotion calculator — applies promotions to a cart and returns line+cart discounts

const todayStr = () => new Date().toISOString().split('T')[0]

function isScheduleActive(promo) {
  if (promo.active === false) { console.log('[promo]', promo.name, 'skip: not active'); return false }
  const now = new Date()
  const today = todayStr()
  if (promo.start_date && String(promo.start_date).split('T')[0] > today) { console.log('[promo]', promo.name, 'skip: not started'); return false }
  if (promo.end_date && String(promo.end_date).split('T')[0] < today) { console.log('[promo]', promo.name, 'skip: expired'); return false }
  if (promo.start_time || promo.end_time) {
    const toMin = (t) => {
      if (!t) return null
      const [h, m] = String(t).split(':').map(Number)
      return (h || 0) * 60 + (m || 0)
    }
    const cur = now.getHours() * 60 + now.getMinutes()
    const s = toMin(promo.start_time), e = toMin(promo.end_time)
    if (s != null && cur < s) { console.log('[promo]', promo.name, 'skip: outside time window'); return false }
    if (e != null && cur > e) { console.log('[promo]', promo.name, 'skip: outside time window'); return false }
  }
  if (Array.isArray(promo.days_of_week) && promo.days_of_week.length > 0 && promo.days_of_week.length < 7) {
    if (!promo.days_of_week.includes(now.getDay())) { console.log('[promo]', promo.name, 'skip: wrong day of week'); return false }
  }
  return true
}

function itemMatchesScope(item, promo) {
  const scope = promo.scope || 'all'
  if (scope === 'all') return true
  const ids = Array.isArray(promo.scope_ids) ? promo.scope_ids : []
  if (ids.length === 0) {
    // backward compat: product_id / category field
    if (scope === 'product' && promo.product_id) return Number(item.product_id) === Number(promo.product_id)
    if (scope === 'category' && promo.category) return item.category === promo.category
    return false
  }
  if (scope === 'product') return ids.map(Number).includes(Number(item.product_id))
  if (scope === 'category') return ids.includes(item.category)
  if (scope === 'brand') return ids.includes(item.brand)
  return false
}

/**
 * Calculate all promotion effects for a cart.
 * @param {Array} cart - [{ product_id, name, price, quantity, category, brand, ... }]
 * @param {Array} promotions - raw promo list from API
 * @param {Array} products - all products for looking up gift product info
 * @returns {{
 *   lineDiscounts: {product_id: number},
 *   priceOverrides: {product_id: number},
 *   freeItems: {product_id: number}, // gift qty keyed by product
 *   bonusLines: [{product_id, qty, name, code, price, promo_name}], // extra rows to render
 *   cartDiscount: number,
 *   appliedPromos: [{id, name, type, amount}]
 * }}
 */
export function calculatePromotions(cart, promotions, products = []) {
  const result = {
    lineDiscounts: {},
    priceOverrides: {},
    freeItems: {},
    bonusLines: [],
    cartDiscount: 0,
    appliedPromos: [],
  }
  if (!Array.isArray(cart) || cart.length === 0) return result
  if (!Array.isArray(promotions) || promotions.length === 0) return result

  const productMap = {}
  for (const p of products) productMap[p.id] = p

  const addBonus = (giftProductId, qty, promoName) => {
    if (!giftProductId || qty <= 0) return
    const gp = productMap[giftProductId]
    if (!gp) { console.warn('[promo] gift product not found', giftProductId); return }
    result.freeItems[giftProductId] = (result.freeItems[giftProductId] || 0) + qty
    result.bonusLines.push({
      product_id: giftProductId,
      qty,
      name: gp.product_name,
      code: gp.product_code,
      price: Number(gp.selling_price) || 0,
      promo_name: promoName,
    })
  }

  // Sort by priority desc (higher first), then by most restrictive first
  const active = promotions
    .filter(isScheduleActive)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))

  // Track which promo ids were applied exclusively to avoid stacking
  let exclusiveApplied = false

  for (const promo of active) {
    if (exclusiveApplied) break
    if (promo.stackable === false && result.appliedPromos.length > 0) continue

    let applied = 0 // amount this promo contributes

    switch (promo.type) {
      case 'price_override': {
        const newPrice = Number(promo.value) || 0
        for (const item of cart) {
          if (!itemMatchesScope(item, promo)) continue
          const oldPrice = Number(item.price) || 0
          if (newPrice < oldPrice) {
            const existing = result.priceOverrides[item.product_id]
            // Keep lowest override
            if (existing == null || newPrice < existing) {
              result.priceOverrides[item.product_id] = newPrice
            }
            applied += (oldPrice - newPrice) * (Number(item.quantity) || 0)
          }
        }
        break
      }

      case 'item_percent': {
        const pct = Number(promo.value) || 0
        if (pct <= 0) break
        for (const item of cart) {
          if (!itemMatchesScope(item, promo)) continue
          const price = result.priceOverrides[item.product_id] ?? Number(item.price) ?? 0
          const lineTotal = price * (Number(item.quantity) || 0)
          const already = result.lineDiscounts[item.product_id] || 0
          const lineRemaining = Math.max(0, lineTotal - already)
          const disc = Math.round((lineRemaining * pct) / 100)
          result.lineDiscounts[item.product_id] = already + disc
          applied += disc
        }
        break
      }

      case 'item_fixed':
      case 'fixed': {
        const per = Number(promo.value) || 0
        if (per <= 0) break
        for (const item of cart) {
          if (!itemMatchesScope(item, promo)) continue
          const price = result.priceOverrides[item.product_id] ?? Number(item.price) ?? 0
          const qty = Number(item.quantity) || 0
          const lineTotal = price * qty
          const already = result.lineDiscounts[item.product_id] || 0
          const disc = Math.min(Math.max(0, lineTotal - already), per * qty)
          result.lineDiscounts[item.product_id] = already + disc
          applied += disc
        }
        break
      }

      case 'buy_n_discount': {
        const n = Number(promo.buy_qty) || 0
        const pct = Number(promo.value) || 0
        if (n <= 0 || pct <= 0) break
        for (const item of cart) {
          if (!itemMatchesScope(item, promo)) continue
          const qty = Number(item.quantity) || 0
          if (qty < n) continue
          const price = result.priceOverrides[item.product_id] ?? Number(item.price) ?? 0
          const lineTotal = price * qty
          const already = result.lineDiscounts[item.product_id] || 0
          const lineRemaining = Math.max(0, lineTotal - already)
          const disc = Math.round((lineRemaining * pct) / 100)
          result.lineDiscounts[item.product_id] = already + disc
          applied += disc
        }
        break
      }

      case 'bogo': {
        // Same-product: Buy N → Get M free extras (rendered inline in cart row)
        const buy = Number(promo.buy_qty) || 0
        const get = Number(promo.get_qty) || 0
        if (buy <= 0 || get <= 0) break
        for (const item of cart) {
          if (!itemMatchesScope(item, promo)) continue
          const qty = Number(item.quantity) || 0
          if (qty < buy) continue
          const groups = Math.floor(qty / buy)
          const freeQty = groups * get
          if (freeQty <= 0) continue
          result.freeItems[item.product_id] = (result.freeItems[item.product_id] || 0) + freeQty
          applied += 1
        }
        break
      }

      case 'bogo_cross': {
        // Buy A → Get B (different product) free
        const buy = Number(promo.buy_qty) || 0
        const get = Number(promo.get_qty) || 0
        const giftId = promo.gift_product_id
        if (buy <= 0 || get <= 0 || !giftId) break
        let triggeredGroups = 0
        for (const item of cart) {
          if (!itemMatchesScope(item, promo)) continue
          const qty = Number(item.quantity) || 0
          if (qty < buy) continue
          triggeredGroups += Math.floor(qty / buy)
        }
        if (triggeredGroups > 0) {
          addBonus(giftId, triggeredGroups * get, promo.name)
          applied += 1
        }
        break
      }

      case 'bundle_gift': {
        // Buy N across bundle (any scope product) → Get gift product free
        const buy = Number(promo.buy_qty) || 0
        const get = Number(promo.get_qty) || 0
        const giftId = promo.gift_product_id
        if (buy <= 0 || get <= 0 || !giftId) break
        const totalMatchingQty = cart.reduce((s, it) => {
          return itemMatchesScope(it, promo) ? s + (Number(it.quantity) || 0) : s
        }, 0)
        if (totalMatchingQty < buy) break
        const groups = Math.floor(totalMatchingQty / buy)
        addBonus(giftId, groups * get, promo.name)
        applied += 1
        break
      }

      case 'cart_percent':
      case 'percent': {
        // Cart percent applies AFTER line discounts
        const pct = Number(promo.value) || 0
        if (pct <= 0) break
        const subtotal = cart.reduce((s, i) => {
          const price = result.priceOverrides[i.product_id] ?? Number(i.price) ?? 0
          return s + price * (Number(i.quantity) || 0)
        }, 0)
        const lineDiscTotal = Object.values(result.lineDiscounts).reduce((a, b) => a + b, 0)
        const afterLineDisc = subtotal - lineDiscTotal
        const minPurchase = Number(promo.min_purchase) || 0
        if (afterLineDisc < minPurchase) break
        const disc = Math.round((afterLineDisc * pct) / 100)
        result.cartDiscount += disc
        applied += disc
        break
      }

      case 'cart_fixed': {
        const subtotal = cart.reduce((s, i) => {
          const price = result.priceOverrides[i.product_id] ?? Number(i.price) ?? 0
          return s + price * (Number(i.quantity) || 0)
        }, 0)
        const lineDiscTotal = Object.values(result.lineDiscounts).reduce((a, b) => a + b, 0)
        const afterLineDisc = subtotal - lineDiscTotal
        const minPurchase = Number(promo.min_purchase) || 0
        if (afterLineDisc < minPurchase) break
        const disc = Math.min(afterLineDisc, Number(promo.value) || 0)
        result.cartDiscount += disc
        applied += disc
        break
      }

      default:
        break
    }

    if (applied > 0) {
      result.appliedPromos.push({ id: promo.id, name: promo.name, type: promo.type, amount: applied })
      if (promo.stackable === false) exclusiveApplied = true
    }
  }

  return result
}

export function describePromoType(type) {
  const map = {
    cart_percent: '% ຫຼຸດທັງບິນ',
    cart_fixed: 'ຫຼຸດເງິນທັງບິນ',
    item_percent: '% ຫຼຸດລາຍການ',
    item_fixed: 'ຫຼຸດເງິນລາຍການ',
    price_override: 'ລາຄາພິເສດ',
    buy_n_discount: 'ຊື້ເກີນ N ຫຼຸດ %',
    bogo: 'Buy N Get M',
    percent: '% ຫຼຸດ',
    fixed: 'ຫຼຸດເງິນ',
  }
  return map[type] || type
}
