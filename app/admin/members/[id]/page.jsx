'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtPrice = n => `${fmtNum(n)} ₭`;
const fmtDate = s => s ? new Date(s).toLocaleDateString('lo-LA') : '—';
const fmtDateTime = s => s ? new Date(s).toLocaleString('lo-LA') : '—';

const METHOD_LABEL = { cash: '💵', transfer: '🏦', qr: '📱', credit: '🧾', mixed: '🎯' };
const TIER_COLOR = {
  standard: 'bg-slate-100 text-slate-700',
  silver: 'bg-slate-300 text-slate-800',
  gold: 'bg-amber-100 text-amber-800',
  platinum: 'bg-violet-100 text-violet-800',
};

export default function MemberHistoryPage({ params }) {
  const { id } = use(params);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/admin/members/${id}/history`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-slate-400 text-center py-12">ກຳລັງໂຫຼດ...</div>;
  if (!data || data.error) return <div className="text-rose-600 text-center py-12">{data?.error || 'ບໍ່ພົບສະມາຊິກ'}</div>;

  const { member, stats, orders, top_products, monthly } = data;
  const maxMonthly = Math.max(1, ...(monthly || []).map(m => Number(m.revenue) || 0));

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/admin/members" className="text-slate-500 hover:text-slate-900">← ກັບສະມາຊິກ</Link>
      </div>

      {/* Header card */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 shadow-lg">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-extrabold">{member.name}</h1>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${TIER_COLOR[member.tier] || TIER_COLOR.standard}`}>
                {String(member.tier || 'standard').toUpperCase()}
              </span>
              {member.active === false && <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-200">ປິດ</span>}
            </div>
            <div className="mt-1 text-sm font-mono text-slate-300">{member.member_code}</div>
            {member.phone && <div className="text-sm text-slate-300 mt-1">📞 {member.phone}</div>}
            {[member.village, member.district, member.province].filter(Boolean).length > 0 && (
              <div className="text-xs text-slate-400 mt-1">📍 {[member.village, member.district, member.province].filter(Boolean).join(', ')}</div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-right">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ແຕ້ມສະສົມ</div>
              <div className="text-xl font-extrabold text-amber-300">⭐ {fmtNum(member.points)}</div>
              {member.points_expires_at && (
                <div className="text-[10px] text-amber-400/80 mt-0.5">ໝົດອາຍຸ {fmtDate(member.points_expires_at)}</div>
              )}
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ວົງເງິນຕິດໜີ້</div>
              <div className="text-xl font-extrabold text-emerald-300">
                {Number(member.credit_limit) > 0 ? fmtPrice(member.credit_limit) : '—'}
              </div>
              {Number(stats.outstanding) > 0 && (
                <div className="text-[10px] text-rose-300 mt-0.5">ຄ້າງ {fmtPrice(stats.outstanding)}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="ບີນທັງໝົດ" value={fmtNum(stats.orders)} />
        <Kpi label="ຍອດຊື້ລວມ" value={fmtPrice(stats.revenue)} accent="emerald" />
        <Kpi label="ບີນເສລ່ຍ" value={fmtPrice(stats.avg_order)} />
        <Kpi label="ບີນທຳອິດ" value={fmtDate(stats.first_order)} />
        <Kpi label="ບີນລ່າສຸດ" value={fmtDate(stats.last_order)} />
      </div>

      {/* Monthly */}
      {monthly?.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="font-bold text-slate-900 mb-3">ຍອດຊື້ລາຍເດືອນ</div>
          <div className="space-y-1.5">
            {monthly.map(m => (
              <div key={m.month} className="flex items-center gap-3 text-xs">
                <div className="w-16 font-mono font-bold text-slate-600">{m.month}</div>
                <div className="flex-1 h-5 bg-slate-50 rounded relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-emerald-500/30 rounded" style={{ width: `${(Number(m.revenue) / maxMonthly) * 100}%` }} />
                </div>
                <div className="w-24 text-right font-mono font-extrabold text-slate-900">{fmtPrice(m.revenue)}</div>
                <div className="w-16 text-right font-mono text-slate-500">{fmtNum(m.orders)} ບີນ</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top products */}
      {top_products?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 font-bold text-slate-900">ສິນຄ້າທີ່ຊື້ປະຈຳ ({top_products.length})</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1 p-3">
            {top_products.map((p, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-50 rounded">
                <span className="text-sm font-bold text-slate-900 truncate flex-1">{p.product_name || '—'}</span>
                <span className="text-xs font-mono text-slate-500 ml-2">×{fmtNum(p.qty)}</span>
                <span className="text-xs font-mono font-bold text-emerald-700 ml-3 w-24 text-right">{fmtPrice(p.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-bold text-slate-900">
          ປະຫວັດການຊື້ ({orders.length})
        </div>
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left">
                <th className="px-3 py-2 font-bold text-slate-600">ບີນ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ວັນທີ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ຊຳລະ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ລາຍການ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ສ່ວນຫຼຸດ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">VAT</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ລວມ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ສະຖານະ</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">ບໍ່ມີການຊື້</td></tr>
              ) : orders.map(o => (
                <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-1.5 font-mono font-bold">{o.bill_number || `#${o.id}`}</td>
                  <td className="px-3 py-1.5 text-slate-600">{fmtDateTime(o.created_at)}</td>
                  <td className="px-3 py-1.5">{METHOD_LABEL[o.payment_method] || o.payment_method}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmtNum(o.item_count)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-amber-700">{Number(o.discount) > 0 ? `−${fmtPrice(o.discount)}` : '—'}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-cyan-700">{Number(o.vat_amount) > 0 ? fmtPrice(o.vat_amount) : '—'}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-extrabold">{fmtPrice(o.total)}</td>
                  <td className="px-3 py-1.5">
                    {o.credit_status === 'outstanding' && <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-bold">ຄ້າງ</span>}
                    {o.credit_status === 'partial' && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold">ບາງສ່ວນ</span>}
                    {o.credit_status === 'paid' && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold">ຊຳລະ</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }) {
  const cls = accent === 'emerald' ? 'text-emerald-700' : 'text-slate-900';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-extrabold ${cls}`}>{value}</div>
    </div>
  );
}
