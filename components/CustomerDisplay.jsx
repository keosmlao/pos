'use client';

import { useEffect, useRef, useState } from 'react'
import { useCompanyProfile } from '../utils/useCompanyProfile'

const fmt = n => new Intl.NumberFormat('lo-LA').format(n || 0) + ' ₭'
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(n || 0)

export default function CustomerDisplay() {
  const company = useCompanyProfile()
  const [state, setState] = useState({ cart: [], subtotal: 0, discount: 0, discountAmount: 0, finalTotal: 0, cartCount: 0 })
  const [lastOrder, setLastOrder] = useState(null)
  const [clock, setClock] = useState(new Date())
  const lastOrderTimer = useRef(null)

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const bc = new BroadcastChannel('sml-pos')
    bc.onmessage = (e) => {
      const msg = e.data
      if (!msg || !msg.type) return
      if (msg.type === 'state') {
        setState({
          cart: msg.cart || [],
          subtotal: msg.subtotal || 0,
          discount: msg.discount || 0,
          discountAmount: msg.discountAmount || 0,
          finalTotal: msg.finalTotal || 0,
          cartCount: msg.cartCount || 0,
        })
      } else if (msg.type === 'complete') {
        setLastOrder(msg.order)
        clearTimeout(lastOrderTimer.current)
        lastOrderTimer.current = setTimeout(() => setLastOrder(null), 15000)
      } else if (msg.type === 'reset') {
        setLastOrder(null)
        setState({ cart: [], subtotal: 0, discount: 0, discountAmount: 0, finalTotal: 0, cartCount: 0 })
      } else if (msg.type === 'ping') {
        bc.postMessage({ type: 'pong' })
      }
    }
    bc.postMessage({ type: 'hello' })
    return () => bc.close()
  }, [])

  const hasCart = state.cart.length > 0
  const dateStr = clock.toLocaleDateString('lo-LA', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const timeStr = clock.toLocaleTimeString('lo-LA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white flex flex-col">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fade-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes bounce-in { 0% { transform: scale(.3); opacity: 0 } 50% { transform: scale(1.15) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes pulse-slow { 0%, 100% { opacity: .3 } 50% { opacity: .5 } }
        .animate-fade-in { animation: fade-in .25s cubic-bezier(.16,1,.3,1) }
        .animate-bounce-in { animation: bounce-in .5s cubic-bezier(.16,1,.3,1) }
        .animate-pulse-slow { animation: pulse-slow 4s ease-in-out infinite }
        .font-mono-t { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' }
        ::-webkit-scrollbar { width: 10px }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); border-radius: 5px }
      ` }} />

      {/* Decorative glow */}
      <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-red-500/20 rounded-full blur-3xl pointer-events-none animate-pulse-slow"></div>
      <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] bg-red-600/10 rounded-full blur-3xl pointer-events-none animate-pulse-slow"></div>

      {/* Header */}
      <header className="shrink-0 relative px-4 md:px-8 py-3 md:py-6 border-b border-white/10 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-red-500/30 overflow-hidden">
              {company.logo_url
                ? <img src={company.logo_url} alt="logo" className="w-full h-full object-contain" />
                : (company.name || 'S').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-2xl font-extrabold tracking-tight">{company.name || 'POS'}</div>
              <div className="text-xs text-slate-400 uppercase tracking-widest font-bold">ຍິນດີຕ້ອນຮັບ</div>
            </div>
          </div>
          <div className="text-right font-mono-t">
            <div className="text-xs text-slate-400" suppressHydrationWarning>{dateStr}</div>
            <div className="text-2xl font-extrabold" suppressHydrationWarning>{timeStr}</div>
          </div>
        </div>
      </header>

      {/* Thank-you overlay (on checkout complete) */}
      {lastOrder && (
        <div className="absolute inset-0 z-20 bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 flex items-center justify-center animate-fade-in">
          <div className="text-center max-w-2xl px-10">
            <div className="w-32 h-32 rounded-full bg-white/20 border-4 border-white flex items-center justify-center mx-auto mb-8 animate-bounce-in shadow-2xl">
              <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div className="text-6xl font-extrabold mb-4 tracking-tight">ຂໍຂອບໃຈ!</div>
            <div className="text-xl text-emerald-100 mb-10">ການຊຳລະເງິນສຳເລັດແລ້ວ</div>
            <div className="bg-white/10 backdrop-blur rounded-3xl p-8 border-2 border-white/20">
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <div className="text-xs text-emerald-200 uppercase tracking-wider font-bold mb-1">ຍອດຊຳລະ</div>
                  <div className="text-2xl font-extrabold font-mono-t">{fmt(lastOrder.total)}</div>
                </div>
                <div>
                  <div className="text-xs text-emerald-200 uppercase tracking-wider font-bold mb-1">ຮັບເງິນ</div>
                  <div className="text-2xl font-extrabold font-mono-t">{fmt(lastOrder.amount_paid)}</div>
                </div>
                <div>
                  <div className="text-xs text-emerald-200 uppercase tracking-wider font-bold mb-1">ເງິນທອນ</div>
                  <div className="text-2xl font-extrabold font-mono-t text-amber-300">{fmt(lastOrder.change_amount)}</div>
                </div>
              </div>
              <div className="text-sm text-emerald-200 mt-6 font-mono-t">ໃບບິນ #{lastOrder.id}</div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col md:flex-row relative">
        {/* Cart list */}
        <section className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 lg:p-10">
          {!hasCart ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-40 h-40 rounded-full bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center text-8xl mb-8">
                🛒
              </div>
              <div className="text-4xl font-extrabold text-slate-300 mb-3">ຍິນດີຕ້ອນຮັບ</div>
              <div className="text-lg text-slate-500 max-w-md">ກະລຸນາຮໍພະນັກງານສະແກນສິນຄ້າຂອງທ່ານ — ລາຍການຈະສະແດງຢູ່ທີ່ນີ້</div>
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-3 mb-5">
                <div className="text-xl font-extrabold text-slate-300">ລາຍການຂອງທ່ານ</div>
                <div className="text-sm text-slate-500 font-mono-t">{state.cart.length} ລາຍການ · {state.cartCount} ຊິ້ນ</div>
              </div>
              <div className="space-y-2">
                {state.cart.map((item, idx) => (
                  <div key={item.product_id} className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-4 flex items-center gap-4 animate-fade-in">
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-white/10 flex items-center justify-center font-mono-t text-slate-400 font-bold">{String(idx + 1).padStart(2, '0')}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-lg font-extrabold text-white truncate">{item.name}</div>
                      {item.code && <div className="text-xs text-slate-500 font-mono">{item.code}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm text-slate-400 font-mono-t">{item.quantity} × {fmtNum(item.price)}</div>
                      <div className="text-xl font-extrabold text-red-400 font-mono-t">{fmtNum(item.price * item.quantity)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Total panel */}
        <aside className="w-full md:w-[320px] lg:w-[440px] shrink-0 border-t md:border-t-0 md:border-l border-white/10 bg-gradient-to-b from-slate-900/50 to-slate-950/50 backdrop-blur p-4 md:p-6 lg:p-8 flex flex-col">
          <div className="text-xs text-slate-400 uppercase tracking-widest font-extrabold mb-6">ສະຫຼຸບການຊື້</div>

          <div className="space-y-3 text-base flex-1">
            <div className="flex justify-between text-slate-400 font-mono-t">
              <span>ລວມຍ່ອຍ</span>
              <span>{fmt(state.subtotal)}</span>
            </div>
            {state.discount > 0 && (
              <div className="flex justify-between text-amber-400 font-mono-t">
                <span>ສ່ວນຫຼຸດ {state.discount}%</span>
                <span>−{fmt(state.discountAmount)}</span>
              </div>
            )}
          </div>

          <div className="mt-6 pt-6 border-t-2 border-red-500/40">
            <div className="text-xs text-slate-400 uppercase tracking-widest font-extrabold mb-2">ລວມທັງໝົດ</div>
            <div className="text-6xl font-extrabold text-red-400 font-mono-t tracking-tight leading-none break-words">{fmt(state.finalTotal)}</div>
          </div>

          <div className="mt-6 text-center text-xs text-slate-500 font-semibold">
            ຂໍ້ມູນແບບ real-time · sync ຈາກ cashier
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="shrink-0 px-8 py-3 border-t border-white/10 text-center text-xs text-slate-500">
        ★ ຂອບໃຈທີ່ໃຊ້ບໍລິການ {company.name || 'POS'} ★
      </footer>
    </div>
  )
}