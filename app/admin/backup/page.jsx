'use client';

import { AdminHero } from '@/components/admin/ui/AdminHero';

const TABLES = [
  { key: 'products', label: 'ສິນຄ້າ', icon: '📦' },
  { key: 'categories', label: 'ໝວດໝູ່', icon: '🏷' },
  { key: 'brands', label: 'ຍີ່ຫໍ້', icon: '🏢' },
  { key: 'units', label: 'ຫົວໜ່ວຍ', icon: '📏' },
  { key: 'suppliers', label: 'ຜູ້ສະໜອງ', icon: '🚚' },
  { key: 'members', label: 'ສະມາຊິກ', icon: '⭐' },
  { key: 'orders', label: 'ບີນຂາຍ', icon: '🧾' },
  { key: 'order_items', label: 'ລາຍການຂາຍ', icon: '📋' },
  { key: 'returns', label: 'ການຮັບຄືນ', icon: '↩' },
  { key: 'return_items', label: 'ລາຍການຮັບຄືນ', icon: '↩' },
  { key: 'purchases', label: 'ການຊື້', icon: '🛒' },
  { key: 'purchase_items', label: 'ລາຍການຊື້', icon: '📋' },
  { key: 'customer_debt_payments', label: 'ການຊຳລະໜີ້ລູກຄ້າ', icon: '💵' },
  { key: 'quotations', label: 'ໃບສະເໜີລາຄາ', icon: '📜' },
  { key: 'quotation_items', label: 'ລາຍການເສນີລາຄາ', icon: '📋' },
  { key: 'cash_transactions', label: 'ການເຄື່ອນຍ້າຍເງິນສົດ', icon: '💰' },
  { key: 'cash_handovers', label: 'ການມອບເງິນ', icon: '🤝' },
  { key: 'promotions', label: 'ໂປຣໂມຊັນ', icon: '🎁' },
  { key: 'currencies', label: 'ສະກຸນເງິນ', icon: '💱' },
  { key: 'company_profile', label: 'ຂໍ້ມູນບໍລິສັດ', icon: '🏢' },
];

export default function BackupPage() {
  const downloadFull = () => {
    window.location.href = '/api/admin/backup';
  };

  const downloadTable = (table) => {
    window.location.href = `/api/admin/backup?table=${encodeURIComponent(table)}`;
  };

  return (
    <div className="space-y-4 pb-6 max-w-5xl">
      <AdminHero
        tag="Backup / export"
        title="💾 ສຳຮອງ / ສົ່ງອອກຂໍ້ມູນ"
        subtitle="ດາວໂຫຼດຂໍ້ມູນລະບົບເພື່ອເກັບຮັກສາ ຫຼື ນຳໄປວິເຄາະຕໍ່"
      />

      {/* Full backup */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-6 shadow-lg">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="text-4xl">💾</div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-extrabold">ສຳຮອງທັງໝົດ (JSON)</div>
            <div className="text-sm text-slate-300 mt-1">
              ດາວໂຫຼດທຸກຕາຕະລາງເປັນໄຟລ໌ JSON ດຽວ ສຳລັບການສຳຮອງຄົບຖ້ວນ.
              ໝາຍເຫດ: ໄຟລ໌ນີ້ບໍ່ມີ password ຂອງຜູ້ໃຊ້.
            </div>
          </div>
          <button
            onClick={downloadFull}
            className="px-5 py-2.5 bg-white text-slate-900 hover:bg-slate-100 rounded-lg font-extrabold text-sm shadow"
          >
            ⬇ ດາວໂຫຼດ JSON
          </button>
        </div>
      </div>

      {/* Per-table export */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-bold text-slate-900">
          ສົ່ງອອກລາຍຕາຕະລາງ (CSV)
        </div>
        <div className="divide-y divide-slate-100">
          {TABLES.map(t => (
            <div key={t.key} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50">
              <span className="text-lg">{t.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-900">{t.label}</div>
                <div className="text-[10px] font-mono text-slate-400">{t.key}</div>
              </div>
              <button
                onClick={() => downloadTable(t.key)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold transition"
              >
                CSV
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <b>⚠ ຄຳແນະນຳ:</b> ສຳຮອງຂໍ້ມູນຢ່າງໜ້ອຍ 1 ຄັ້ງຕໍ່ອາທິດ ແລະ ເກັບໄວ້ໃນບ່ອນປອດໄພ (ເຊັ່ນ Google Drive). ບໍ່ມີ password ໃນໄຟລ໌ສຳຮອງ.
      </div>
    </div>
  );
}
