'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AdminHero } from '@/components/admin/ui/AdminHero';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtPrice = n => `${fmtNum(n)} ₭`;
const fmtCompact = n => {
  const num = Number(n) || 0;
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return sign + (abs / 1_000_000_000).toFixed(2) + 'B';
  if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(2) + 'M';
  if (abs >= 1_000) return sign + (abs / 1_000).toFixed(1) + 'K';
  return sign + String(abs);
};
const fmtDT = s => s ? new Date(s).toLocaleString('lo-LA', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—';

const METHOD_META = {
  cash: { label: 'ເງິນສົດ', icon: '💵', color: 'emerald' },
  transfer: { label: 'ໂອນ', icon: '🏦', color: 'blue' },
  qr: { label: 'QR', icon: '📱', color: 'violet' },
  credit: { label: 'ຕິດໜີ້', icon: '🧾', color: 'amber' },
  mixed: { label: 'ປະສົມ', icon: '🪙', color: 'slate' },
};

function pctChange(current, previous) {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`${API}/admin/dashboard`);
      setData(await res.json());
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000); // refresh every minute
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-red-600 rounded-full animate-spin"></div>
        <p className="mt-3 text-xs text-slate-400">ກຳລັງໂຫລດຂໍ້ມູນ...</p>
      </div>
    );
  }
  if (!data) return null;

  const today = data.periods?.today || {};
  const yesterday = data.periods?.yesterday || {};
  const week = data.periods?.week || {};
  const month = data.periods?.month || {};
  const lastMonth = data.periods?.last_month || {};
  const all = data.periods?.all || {};
  const ar = data.ar || {};
  const ap = data.ap || {};
  const inv = data.inventory || {};
  const cf = data.cash_flow_month || {};
  const profit = data.profit_month || { revenue: 0, cogs: 0 };
  const profitAmount = (profit.revenue || 0) - (profit.cogs || 0);
  const profitMargin = profit.revenue > 0 ? (profitAmount / profit.revenue) * 100 : 0;
  const weekCmp = data.week_compare || {};
  const weekDelta = pctChange(weekCmp.this_week, weekCmp.last_week);
  const returnsStats = data.returns_stats || {};
  const quotePipeline = data.quotation_pipeline || [];

  const todayVsYesterday = pctChange(today.revenue, yesterday.revenue);
  const monthVsLastMonth = pctChange(month.revenue, lastMonth.revenue);
  const avgOrderToday = today.orders > 0 ? today.revenue / today.orders : 0;

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Executive dashboard"
        title="📊 ແຜງຄວບຄຸມຜູ້ບໍລິຫານ"
        subtitle={`${new Date().toLocaleDateString('lo-LA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · LIVE · ອັບເດດ ${new Date().toLocaleTimeString('lo-LA', { hour: '2-digit', minute: '2-digit' })}`}
        action={
          <button onClick={load} disabled={refreshing}
            className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-3 text-sm font-extrabold shadow-lg shadow-red-950/20 disabled:opacity-50">
            {refreshing ? '🔄 ກຳລັງໂຫຼດ...' : '🔄 ໂຫຼດໃໝ່'}
          </button>
        }
      />

      {/* HERO — Revenue today vs yesterday */}
      <section className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white p-5 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-red-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-red-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-center">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">ລາຍຮັບມື້ນີ້</div>
            <div className="text-4xl md:text-5xl font-extrabold font-mono-t tracking-tight mt-1 text-red-400">{fmtPrice(today.revenue)}</div>
            <div className="flex items-center gap-3 mt-2 text-xs">
              <span className="text-slate-400">{fmtNum(today.orders)} ບິນ · ສະເລ່ຍ {fmtCompact(avgOrderToday)}/ບິນ</span>
              <span className="text-slate-600">·</span>
              <span className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                todayVsYesterday >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {todayVsYesterday >= 0 ? '↑' : '↓'} {Math.abs(todayVsYesterday).toFixed(1)}% ທຽບກັບມື້ວານ
              </span>
            </div>
            <div className="mt-1 text-[10px] text-slate-500">
              ມື້ວານ: {fmtPrice(yesterday.revenue)} · {fmtNum(yesterday.orders)} ບິນ
            </div>
          </div>
          <HourlyChart data={data.hourly || []} />
        </div>
      </section>

      {/* Period strip + Comparison */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <PeriodCard label="ມື້ນີ້" revenue={today.revenue} orders={today.orders} accent="red" />
        <PeriodCard label="ອາທິດນີ້" revenue={week.revenue} orders={week.orders} accent="blue" />
        <PeriodCard label="ເດືອນນີ້" revenue={month.revenue} orders={month.orders} accent="emerald"
          delta={monthVsLastMonth} deltaLabel={`vs ເດືອນແລ້ວ ${fmtCompact(lastMonth.revenue)}`} />
        <PeriodCard label="ທັງໝົດ" revenue={all.revenue} orders={all.orders} accent="violet" />
      </div>

      {/* Profit + Week compare + Returns + Customers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-widest">💎 ກຳໄລຂັ້ນຕົ້ນ</span>
            <span className="text-[9px] font-bold text-emerald-600">ເດືອນນີ້</span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-emerald-800 mt-1">{fmtCompact(profitAmount)}</div>
          <div className="text-[11px] font-bold text-emerald-700 mt-0.5">
            {profitMargin.toFixed(1)}% margin · COGS {fmtCompact(profit.cogs)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">📅 ອາທິດນີ້</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${weekDelta >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {weekDelta >= 0 ? '↑' : '↓'} {Math.abs(weekDelta).toFixed(1)}%
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-slate-800 mt-1">{fmtCompact(weekCmp.this_week || 0)}</div>
          <div className="text-[11px] font-bold text-slate-500 mt-0.5">
            {fmtNum(weekCmp.this_week_orders || 0)} ບິນ · ອາທິດແລ້ວ {fmtCompact(weekCmp.last_week || 0)}
          </div>
        </div>
        <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-widest">↩ ຮັບຄືນເງິນ</span>
            <Link href="/admin/returns" className="text-rose-600 hover:text-rose-700 text-xs font-bold">→</Link>
          </div>
          <div className="text-2xl font-extrabold font-mono text-rose-800 mt-1">{fmtCompact(returnsStats.month_amount || 0)}</div>
          <div className="text-[11px] font-bold text-rose-700 mt-0.5">
            ມື້ນີ້ {fmtNum(returnsStats.today_count || 0)} · ເດືອນນີ້ {fmtNum(returnsStats.month_count || 0)}
          </div>
        </div>
        <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-violet-700 uppercase tracking-widest">👥 ສະມາຊິກ</span>
            <Link href="/admin/members" className="text-violet-600 hover:text-violet-700 text-xs font-bold">→</Link>
          </div>
          <div className="text-2xl font-extrabold font-mono text-violet-800 mt-1">{fmtNum(data.counts?.customers || 0)}</div>
          <div className="text-[11px] font-bold text-violet-700 mt-0.5">
            {fmtNum(data.counts?.products || 0)} ສິນຄ້າ active
          </div>
        </div>
      </div>

      {/* Trend chart */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-extrabold text-slate-900">📈 ແນວໂນ້ມລາຍຮັບ 30 ວັນ</h2>
          <span className="text-[10px] text-slate-400">ສະເລ່ຍ {fmtCompact(month.revenue / Math.max(1, new Date().getDate()))}/ວັນ</span>
        </div>
        <TrendChart data={data.trend || []} />
      </section>

      {/* Cash position + Inventory + Payment methods */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Cash position */}
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-extrabold text-slate-900 mb-3">💰 ສະຖານະທາງການເງິນ</h2>
          <div className="space-y-2">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">💵 ລາຍຮັບອື່ນ (ເດືອນນີ້)</div>
                  <div className="text-lg font-extrabold font-mono text-emerald-800 mt-0.5">{fmtPrice(cf.income || 0)}</div>
                </div>
                <Link href="/admin/cash-transactions/income" className="text-emerald-600 hover:text-emerald-700 text-xs font-bold">→</Link>
              </div>
            </div>
            <div className="rounded-lg border border-rose-100 bg-rose-50/50 p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider">💸 ລາຍຈ່າຍອື່ນ (ເດືອນນີ້)</div>
                  <div className="text-lg font-extrabold font-mono text-rose-800 mt-0.5">{fmtPrice(cf.expense || 0)}</div>
                </div>
                <Link href="/admin/cash-transactions/expense" className="text-rose-600 hover:text-rose-700 text-xs font-bold">→</Link>
              </div>
            </div>
            <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-extrabold text-red-700 uppercase tracking-wider">📊 ສຸດທິ (ເດືອນນີ້)</div>
                  <div className={`text-lg font-extrabold font-mono mt-0.5 ${(cf.income - cf.expense) >= 0 ? 'text-red-800' : 'text-rose-800'}`}>
                    {fmtPrice((cf.income || 0) - (cf.expense || 0))}
                  </div>
                </div>
                <Link href="/admin/cash-flow" className="text-red-600 hover:text-red-700 text-xs font-bold">→ ລາຍລະອຽດ</Link>
              </div>
            </div>
          </div>
        </section>

        {/* AR / AP */}
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-extrabold text-slate-900 mb-3">🧾 ໜີ້ສິນ</h2>
          <div className="space-y-2">
            <Link href="/admin/customer-debts" className="block rounded-lg border border-emerald-100 bg-emerald-50/50 p-2.5 hover:bg-emerald-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">📥 ລູກໜີ້ (ຄ້າງຮັບ)</span>
                <span className="text-[10px] font-bold text-emerald-600">{fmtNum(ar.open_count)} ບິນ</span>
              </div>
              <div className="text-lg font-extrabold font-mono text-emerald-800">{fmtPrice(ar.open_amount)}</div>
              {ar.overdue_count > 0 && (
                <div className="text-[10px] font-bold text-rose-600 mt-0.5">⚠ ເກີນກຳນົດ {fmtNum(ar.overdue_count)} ບິນ · {fmtPrice(ar.overdue_amount)}</div>
              )}
            </Link>
            <Link href="/admin/debts" className="block rounded-lg border border-red-100 bg-red-50/50 p-2.5 hover:bg-red-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-extrabold text-red-700 uppercase tracking-wider">📤 ເຈົ້າໜີ້ (ຄ້າງຈ່າຍ)</span>
                <span className="text-[10px] font-bold text-red-600">{fmtNum(ap.open_count)} ບິນ</span>
              </div>
              <div className="text-lg font-extrabold font-mono text-red-800">{fmtPrice(ap.open_amount)}</div>
            </Link>
            <div className="rounded-lg border-2 border-slate-200 bg-slate-50 p-2.5">
              <div className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">⚖ ສຸດທິ</div>
              <div className={`text-lg font-extrabold font-mono mt-0.5 ${(ar.open_amount - ap.open_amount) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {fmtPrice(ar.open_amount - ap.open_amount)}
              </div>
              <div className="text-[10px] text-slate-500">{(ar.open_amount - ap.open_amount) >= 0 ? 'ຮ້ານໄດ້ຮັບເພີ່ມ' : 'ຮ້ານຕ້ອງຈ່າຍເພີ່ມ'}</div>
            </div>
          </div>
        </section>

        {/* Inventory health */}
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-extrabold text-slate-900 mb-3">📦 ສະຖານະສາງສິນຄ້າ</h2>
          <div className="space-y-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
              <div className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">ມູນຄ່າສາງ (ຕົ້ນທຶນ)</div>
              <div className="text-lg font-extrabold font-mono text-slate-800 mt-0.5">{fmtPrice(inv.cost_value)}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{fmtNum(inv.total_qty)} ຊິ້ນ</div>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-2.5">
              <div className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">ມູນຄ່າຂາຍ</div>
              <div className="text-lg font-extrabold font-mono text-emerald-800 mt-0.5">{fmtPrice(inv.retail_value)}</div>
              <div className="text-[10px] text-emerald-700 mt-0.5">
                ກຳໄລຄາດໝາຍ: {fmtPrice(inv.retail_value - inv.cost_value)}
              </div>
            </div>
            <Link href="/admin/products" className="block rounded-lg border border-rose-100 bg-rose-50/50 p-2.5 hover:bg-rose-50">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider">⚠ ສິນຄ້າໃກ້ໝົດ</div>
                  <div className="text-lg font-extrabold text-rose-800 mt-0.5">{fmtNum((data.low_stock || []).length)}</div>
                </div>
                <span className="text-rose-600 text-xs font-bold">→</span>
              </div>
            </Link>
          </div>
        </section>
      </div>

      {/* Payment methods + Top products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-extrabold text-slate-900 mb-3">💳 ການຊຳລະ (ເດືອນນີ້)</h2>
          <PaymentMethodChart data={data.by_method || []} total={month.revenue} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-extrabold text-slate-900">🏆 ສິນຄ້າຂາຍດີ (ເດືອນນີ້)</h2>
            <Link href="/admin/products" className="text-xs font-bold text-slate-500 hover:text-slate-700">ເບິ່ງທັງໝົດ →</Link>
          </div>
          <TopProducts items={data.top_products || []} />
        </section>
      </div>

      {/* Top customers + Recent orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-extrabold text-slate-900">⭐ ລູກຄ້າຫຼັກ (ເດືອນນີ້)</h2>
            <Link href="/admin/members" className="text-xs font-bold text-slate-500 hover:text-slate-700">ເບິ່ງທັງໝົດ →</Link>
          </div>
          <TopCustomers items={data.top_customers || []} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-extrabold text-slate-900">🕐 ບິນຫຼ້າສຸດ</h2>
            <Link href="/admin/sales" className="text-xs font-bold text-slate-500 hover:text-slate-700">ປະຫວັດການຂາຍ →</Link>
          </div>
          <RecentOrders items={data.recent_orders || []} />
        </section>
      </div>

      {/* Categories pie + Member tiers + Quotation pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-extrabold text-slate-900 mb-3">📁 ຂາຍຕາມໝວດໝູ່ (ເດືອນນີ້)</h2>
          <CategoryBreakdown items={data.by_category || []} />
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-extrabold text-slate-900 mb-3">🏷 ລະດັບສະມາຊິກ</h2>
          <MemberTiers items={data.member_tiers || []} />
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-extrabold text-slate-900 mb-3">📜 ໃບສະເໜີລາຄາ (ເດືອນນີ້)</h2>
          <QuotationPipeline items={quotePipeline} />
        </section>
      </div>

      {/* Slow-moving inventory */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-extrabold text-slate-900">🐢 ສິນຄ້າຂາຍຊ້າ (ບໍ່ມີຂາຍໃນ 30 ວັນ)</h2>
          <Link href="/admin/products" className="text-xs font-bold text-slate-500 hover:text-slate-700">ເບິ່ງທັງໝົດ →</Link>
        </div>
        <SlowMoving items={data.slow_moving || []} />
      </section>

      {/* Quick actions */}
      <section className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
        <h2 className="text-sm font-extrabold text-slate-900 mb-3">⚡ ການເຮັດວຽກດ່ວນ</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          <QuickAction href="/admin/quotations/new" icon="📜" label="ສ້າງໃບສະເໜີລາຄາ" />
          <QuickAction href="/admin/credit-sales/new" icon="🧾" label="ສ້າງບິນຕິດໜີ້" />
          <QuickAction href="/admin/purchases/create" icon="🛒" label="ສັ່ງຊື້" />
          <QuickAction href="/admin/products" icon="📦" label="ຈັດການສິນຄ້າ" />
          <QuickAction href="/admin/cash-transactions/expense" icon="💸" label="ບັນທຶກລາຍຈ່າຍ" />
          <QuickAction href="/admin/cash-flow" icon="📈" label="ລາຍງານເງິນສົດ" />
        </div>
      </section>
    </div>
  );
}

function PeriodCard({ label, revenue, orders, accent = 'slate', delta, deltaLabel }) {
  const tones = {
    red: 'border-red-200 bg-red-50',
    blue: 'border-blue-200 bg-blue-50',
    emerald: 'border-emerald-200 bg-emerald-50',
    violet: 'border-violet-200 bg-violet-50',
    slate: 'border-slate-200 bg-white',
  };
  const text = {
    red: 'text-red-700', blue: 'text-red-700', emerald: 'text-emerald-700', violet: 'text-violet-700', slate: 'text-slate-800',
  };
  return (
    <div className={`rounded-xl border p-3 ${tones[accent]}`}>
      <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`text-2xl font-extrabold font-mono mt-1 ${text[accent]}`}>{fmtCompact(revenue)}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{fmtNum(orders)} ບິນ</div>
      {delta != null && (
        <div className={`mt-1 text-[10px] font-bold ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}% · {deltaLabel}
        </div>
      )}
    </div>
  );
}

function TrendChart({ data }) {
  if (!data || data.length === 0) return <div className="py-10 text-center text-xs text-slate-400">ບໍ່ມີຂໍ້ມູນ</div>;
  const max = Math.max(...data.map(d => Number(d.revenue) || 0), 1);
  const W = 800, H = 160, padX = 30, padY = 10;
  const points = data.map((d, i) => {
    const x = padX + (i / (data.length - 1 || 1)) * (W - padX * 2);
    const y = H - padY - ((Number(d.revenue) || 0) / max) * (H - padY * 2);
    return { x, y, ...d };
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${path} L ${points[points.length - 1].x.toFixed(1)} ${H - padY} L ${padX} ${H - padY} Z`;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 600 }}>
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dc2626" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#trendGrad)" />
        <path d={path} fill="none" stroke="#dc2626" strokeWidth="2" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={p.date === today ? 4 : 2.5} fill={p.date === today ? '#dc2626' : '#ef4444'} stroke="#fff" strokeWidth="1.5" />
            <title>{p.date}: {fmtPrice(p.revenue)} ({fmtNum(p.orders)} ບິນ)</title>
          </g>
        ))}
        {data.length > 1 && [0, Math.floor(data.length / 2), data.length - 1].map(i => (
          <text key={i} x={points[i].x} y={H - 2} fontSize="9" fill="#94a3b8" textAnchor="middle">
            {new Date(data[i].date).toLocaleDateString('lo-LA', { month: '2-digit', day: '2-digit' })}
          </text>
        ))}
      </svg>
    </div>
  );
}

function HourlyChart({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => Number(d.revenue) || 0), 1);
  const currentHour = new Date().getHours();
  return (
    <div className="hidden md:flex items-end gap-0.5 h-20 w-72">
      {data.map(d => {
        const h = ((Number(d.revenue) || 0) / max) * 100;
        const isCurrent = d.hour === currentHour;
        return (
          <div key={d.hour} className="flex-1 flex flex-col items-center justify-end group relative" title={`${d.hour}:00 — ${fmtPrice(d.revenue)} (${d.orders} ບິນ)`}>
            <div className={`w-full rounded-t transition-all ${isCurrent ? 'bg-red-400' : 'bg-red-500/40 group-hover:bg-red-400'}`}
              style={{ height: `${h}%`, minHeight: d.revenue > 0 ? '2px' : '0' }}></div>
          </div>
        );
      })}
    </div>
  );
}

function PaymentMethodChart({ data, total }) {
  if (!data || data.length === 0) return <div className="py-6 text-center text-xs text-slate-400">ບໍ່ມີຂໍ້ມູນ</div>;
  return (
    <div className="space-y-2">
      {data.map(m => {
        const meta = METHOD_META[m.payment_method] || { label: m.payment_method, icon: '💱', color: 'slate' };
        const pct = total > 0 ? (Number(m.revenue) / total) * 100 : 0;
        const bar = {
          emerald: 'bg-emerald-500', blue: 'bg-red-500', violet: 'bg-violet-500', amber: 'bg-amber-500', slate: 'bg-slate-500',
        }[meta.color];
        return (
          <div key={m.payment_method}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-slate-700">{meta.icon} {meta.label}</span>
              <span className="font-mono">
                <span className="font-extrabold text-slate-800">{fmtPrice(m.revenue)}</span>
                <span className="text-slate-400 ml-2">{fmtNum(m.orders)} ບິນ · {pct.toFixed(1)}%</span>
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full ${bar} transition-all`} style={{ width: `${pct}%` }}></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TopProducts({ items }) {
  if (!items || items.length === 0) return <div className="py-6 text-center text-xs text-slate-400">ບໍ່ມີຂໍ້ມູນ</div>;
  const max = Math.max(...items.map(p => Number(p.total_revenue) || 0), 1);
  return (
    <div className="space-y-1.5">
      {items.map((p, i) => {
        const pct = (Number(p.total_revenue) / max) * 100;
        return (
          <div key={i}>
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="font-bold text-slate-800 truncate flex items-center gap-2">
                <span className={`text-[10px] font-extrabold rounded px-1 ${i < 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>#{i + 1}</span>
                <span className="truncate max-w-[260px]">{p.product_name}</span>
              </span>
              <span className="font-mono text-[11px] text-slate-700 shrink-0">{fmtCompact(p.total_revenue)}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: `${pct}%` }}></div>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">{fmtNum(p.total_sold)} ຊິ້ນ</div>
          </div>
        );
      })}
    </div>
  );
}

function TopCustomers({ items }) {
  if (!items || items.length === 0) return <div className="py-6 text-center text-xs text-slate-400">ບໍ່ມີຂໍ້ມູນ</div>;
  return (
    <div className="space-y-1">
      {items.map((c, i) => (
        <div key={i} className="flex items-center gap-3 py-1.5 border-b border-slate-100 last:border-0">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
            i === 0 ? 'bg-amber-100 text-amber-700' :
            i === 1 ? 'bg-slate-200 text-slate-700' :
            i === 2 ? 'bg-orange-100 text-orange-700' :
            'bg-slate-100 text-slate-500'
          }`}>
            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-slate-800 truncate">{c.name}</div>
            <div className="text-[10px] text-slate-400">{c.member_code || '—'} · {fmtNum(c.orders)} ບິນ</div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono font-extrabold text-slate-800">{fmtPrice(c.revenue)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentOrders({ items }) {
  if (!items || items.length === 0) return <div className="py-6 text-center text-xs text-slate-400">ບໍ່ມີຂໍ້ມູນ</div>;
  return (
    <div className="space-y-1">
      {items.map(o => {
        const meta = METHOD_META[o.payment_method] || { label: o.payment_method, icon: '💱', color: 'slate' };
        return (
          <div key={o.id} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0 text-xs">
            <span className="font-mono text-[10px] font-extrabold bg-red-50 text-red-700 px-1.5 py-0.5 rounded shrink-0">
              {o.bill_number || `#${o.id}`}
            </span>
            <span className="text-slate-500 shrink-0">{fmtDT(o.created_at)}</span>
            <span className="text-slate-700 truncate flex-1">{o.customer_name || 'ລູກຄ້າທົ່ວໄປ'}</span>
            <span className="shrink-0">{meta.icon}</span>
            <span className="font-mono font-extrabold text-slate-800 shrink-0">{fmtPrice(o.total)}</span>
          </div>
        );
      })}
    </div>
  );
}

function QuickAction({ href, icon, label }) {
  return (
    <Link href={href}
      className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 bg-white p-3 hover:border-red-300 hover:bg-red-50/30 hover:shadow-sm transition">
      <span className="text-2xl">{icon}</span>
      <span className="text-[11px] font-extrabold text-slate-700 text-center leading-tight">{label}</span>
    </Link>
  );
}

function CategoryBreakdown({ items }) {
  if (!items || items.length === 0) return <div className="py-6 text-center text-xs text-slate-400">ບໍ່ມີຂໍ້ມູນ</div>;
  const total = items.reduce((s, c) => s + (Number(c.revenue) || 0), 0);
  const palette = ['bg-red-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-slate-500'];
  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
        {items.map((c, i) => {
          const pct = total > 0 ? (Number(c.revenue) / total) * 100 : 0;
          return <div key={c.category} className={palette[i % palette.length]} style={{ width: `${pct}%` }} title={`${c.category}: ${fmtPrice(c.revenue)}`}></div>;
        })}
      </div>
      <div className="space-y-1">
        {items.slice(0, 6).map((c, i) => {
          const pct = total > 0 ? (Number(c.revenue) / total) * 100 : 0;
          return (
            <div key={c.category} className="flex items-center gap-2 text-[11px]">
              <span className={`w-3 h-3 rounded-sm shrink-0 ${palette[i % palette.length]}`}></span>
              <span className="font-bold text-slate-700 truncate flex-1">{c.category}</span>
              <span className="font-mono text-slate-600 shrink-0">{fmtCompact(c.revenue)}</span>
              <span className="text-slate-400 shrink-0 w-12 text-right">{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MemberTiers({ items }) {
  if (!items || items.length === 0) return <div className="py-6 text-center text-xs text-slate-400">ບໍ່ມີຂໍ້ມູນ</div>;
  const meta = {
    standard: { label: '⚪ ມາດຕະຖານ', color: 'bg-slate-100 text-slate-700' },
    silver: { label: '🥈 Silver', color: 'bg-slate-200 text-slate-800' },
    gold: { label: '🥇 Gold', color: 'bg-amber-100 text-amber-700' },
    platinum: { label: '💎 Platinum', color: 'bg-violet-100 text-violet-700' },
  };
  const total = items.reduce((s, t) => s + (Number(t.count) || 0), 0);
  return (
    <div className="space-y-1.5">
      {items.map(t => {
        const m = meta[t.tier] || { label: t.tier, color: 'bg-slate-100 text-slate-700' };
        const pct = total > 0 ? (Number(t.count) / total) * 100 : 0;
        return (
          <div key={t.tier} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
            <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded ${m.color}`}>{m.label}</span>
            <div className="flex-1 min-w-0">
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-400 to-violet-600" style={{ width: `${pct}%` }}></div>
              </div>
            </div>
            <span className="font-mono font-extrabold text-slate-800 text-sm shrink-0">{fmtNum(t.count)}</span>
            <span className="text-[10px] text-slate-400 shrink-0 w-16 text-right">{fmtCompact(t.total_spent)}</span>
          </div>
        );
      })}
    </div>
  );
}

function QuotationPipeline({ items }) {
  if (!items || items.length === 0) return <div className="py-6 text-center text-xs text-slate-400">ບໍ່ມີໃບສະເໜີລາຄາໃນເດືອນນີ້</div>;
  const meta = {
    draft: { label: '📝 ສະບັບຮ່າງ', color: 'bg-slate-100 text-slate-700' },
    sent: { label: '📤 ສົ່ງແລ້ວ', color: 'bg-blue-100 text-red-700' },
    accepted: { label: '✓ ຍອມຮັບ', color: 'bg-emerald-100 text-emerald-700' },
    rejected: { label: '✕ ປະຕິເສດ', color: 'bg-rose-100 text-rose-700' },
    expired: { label: '⏱ ໝົດອາຍຸ', color: 'bg-amber-100 text-amber-700' },
    converted: { label: '🧾 ອອກບິນແລ້ວ', color: 'bg-violet-100 text-violet-700' },
  };
  const order = ['draft', 'sent', 'accepted', 'converted', 'rejected', 'expired'];
  const sorted = [...items].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  return (
    <div className="space-y-1.5">
      {sorted.map(it => {
        const m = meta[it.status] || { label: it.status, color: 'bg-slate-100 text-slate-700' };
        return (
          <div key={it.status} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0">
            <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded ${m.color}`}>{m.label}</span>
            <div className="text-right">
              <div className="font-mono font-extrabold text-slate-800">{fmtCompact(it.amount)}</div>
              <div className="text-[10px] text-slate-500">{fmtNum(it.count)} ບິນ</div>
            </div>
          </div>
        );
      })}
      <Link href="/admin/quotations" className="block text-center text-[11px] font-bold text-slate-500 hover:text-slate-700 pt-1">
        ເບິ່ງທັງໝົດ →
      </Link>
    </div>
  );
}

function SlowMoving({ items }) {
  if (!items || items.length === 0) return <div className="py-6 text-center text-xs text-slate-400">✅ ບໍ່ມີສິນຄ້າຂາຍຊ້າ — ສິນຄ້າທຸກລາຍການເຄື່ອນໄຫວດີ</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-left">
        <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">ສິນຄ້າ</th>
            <th className="px-3 py-2">ລະຫັດ</th>
            <th className="px-3 py-2 text-right">ສະຕ໊ອກ</th>
            <th className="px-3 py-2 text-right">ມູນຄ່າຄ້າງ</th>
            <th className="px-3 py-2">ຂາຍຄັ້ງລ່າສຸດ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map(p => {
            const lastSold = p.last_sold_at ? new Date(p.last_sold_at) : null;
            const daysAgo = lastSold ? Math.floor((Date.now() - lastSold.getTime()) / 86400000) : null;
            return (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-bold text-slate-800 max-w-[280px] truncate">{p.product_name}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{p.product_code || '—'}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtNum(p.qty_on_hand)}</td>
                <td className="px-3 py-2 text-right font-mono font-extrabold text-amber-700">{fmtPrice(p.stuck_value)}</td>
                <td className="px-3 py-2 text-[11px]">
                  {lastSold
                    ? <span className="text-rose-600 font-bold">{daysAgo} ວັນກ່ອນ</span>
                    : <span className="text-slate-400">ບໍ່ເຄີຍຂາຍ</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
