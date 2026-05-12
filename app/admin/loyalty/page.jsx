'use client';

import { useState, useEffect } from 'react';

const API = '/api';

const blank = {
  loyalty_enabled: true,
  points_per_amount: 10000,
  points_redeem_value: 100,
  min_points_to_redeem: 100,
  tier_silver_threshold: 5000000,
  tier_gold_threshold: 20000000,
  tier_platinum_threshold: 50000000,
};

const fmtNum = (n) => new Intl.NumberFormat('lo-LA').format(Number(n) || 0);

export default function LoyaltySettingsPage() {
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    fetch(`${API}/admin/loyalty`)
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === 'object') {
          setForm({ ...blank, ...data, loyalty_enabled: data.loyalty_enabled !== false });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const silver = Number(form.tier_silver_threshold);
    const gold = Number(form.tier_gold_threshold);
    const platinum = Number(form.tier_platinum_threshold);
    if (!(silver <= gold && gold <= platinum)) {
      showToast('Threshold ຕ້ອງເປັນ silver ≤ gold ≤ platinum', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/loyalty`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setForm({ ...blank, ...data, loyalty_enabled: data.loyalty_enabled !== false });
        showToast('ບັນທຶກສຳເລັດ');
      } else {
        showToast(data.error || 'ບັນທຶກບໍ່ສຳເລັດ', 'error');
      }
    } catch {
      showToast('ບັນທຶກບໍ່ສຳເລັດ', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-500">ກຳລັງໂຫຼດ...</div>;
  }

  const perAmount = Math.max(1, Number(form.points_per_amount) || 10000);
  const redeemValue = Math.max(0, Number(form.points_redeem_value) || 0);
  const sampleSpend = 100000;
  const samplePointsEarned = Math.floor(sampleSpend / perAmount);
  const samplePoints = 500;
  const sampleRedeemValue = samplePoints * redeemValue;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">ຕັ້ງຄ່າແຕ້ມສະສົມ</h1>
          <p className="text-xs text-slate-500 mt-0.5">ກຳນົດອັດຕາສະສົມ, ການແລກຄືນ, ແລະ ລະດັບສະມາຊິກ</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg disabled:opacity-50"
        >
          {saving ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}
        </button>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.loyalty_enabled}
            onChange={(e) => upd('loyalty_enabled', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm font-bold text-slate-900">ເປີດໃຊ້ລະບົບແຕ້ມສະສົມ</span>
        </label>
        <p className="text-xs text-slate-500 -mt-2 pl-7">ປິດເພື່ອບໍ່ໃຫ້ POS ສະສົມ/ແລກແຕ້ມ (ຂໍ້ມູນແຕ້ມຂອງສະມາຊິກຍັງຄົງຢູ່)</p>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-extrabold text-slate-900">ການສະສົມແຕ້ມ</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">ຍອດຊື້ຕໍ່ 1 ແຕ້ມ (₭)</label>
            <input
              type="number"
              min="1"
              value={form.points_per_amount}
              onChange={(e) => upd('points_per_amount', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">ຕົວຢ່າງ: 10,000 ₭ = 1 ແຕ້ມ</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">ຕົວຢ່າງ</div>
            <div className="text-sm text-slate-700 mt-1">
              ຊື້ <span className="font-mono font-bold">{fmtNum(sampleSpend)} ₭</span> →
              ໄດ້ <span className="font-mono font-bold text-emerald-700">{fmtNum(samplePointsEarned)} ແຕ້ມ</span>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-extrabold text-slate-900">ການແລກຄືນແຕ້ມ</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">ມູນຄ່າ 1 ແຕ້ມ (₭)</label>
            <input
              type="number"
              min="0"
              value={form.points_redeem_value}
              onChange={(e) => upd('points_redeem_value', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">ຕັ້ງເປັນ 0 ເພື່ອປິດການແລກຄືນ</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">ແຕ້ມຂັ້ນຕ່ຳເພື່ອແລກ</label>
            <input
              type="number"
              min="0"
              value={form.min_points_to_redeem}
              onChange={(e) => upd('min_points_to_redeem', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">ສະມາຊິກຕ້ອງມີຢ່າງໜ້ອຍຈຳນວນນີ້ຈິ່ງແລກໄດ້</p>
          </div>
        </div>
        {redeemValue > 0 && (
          <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-sm text-slate-700">
            <span className="text-[10px] font-bold text-violet-700 uppercase tracking-wider">ຕົວຢ່າງ:</span>
            {' '}ໃຊ້ <span className="font-mono font-bold">{fmtNum(samplePoints)} ແຕ້ມ</span> →
            ສ່ວນຫຼຸດ <span className="font-mono font-bold text-violet-700">{fmtNum(sampleRedeemValue)} ₭</span>
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-extrabold text-slate-900">ລະດັບສະມາຊິກ (ຍອດໃຊ້ຈ່າຍສະສົມ)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">🥈 Silver ≥ (₭)</label>
            <input
              type="number"
              min="0"
              value={form.tier_silver_threshold}
              onChange={(e) => upd('tier_silver_threshold', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">🥇 Gold ≥ (₭)</label>
            <input
              type="number"
              min="0"
              value={form.tier_gold_threshold}
              onChange={(e) => upd('tier_gold_threshold', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">💎 Platinum ≥ (₭)</label>
            <input
              type="number"
              min="0"
              value={form.tier_platinum_threshold}
              onChange={(e) => upd('tier_platinum_threshold', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
            />
          </div>
        </div>
        <p className="text-[11px] text-slate-500">ຕ້ອງເປັນ silver ≤ gold ≤ platinum</p>
      </section>

      {toast && (
        <div
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg text-sm font-bold z-50 ${
            toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
