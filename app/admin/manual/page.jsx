'use client';

import { AdminHero } from '@/components/admin/ui/AdminHero';

const PDF_URL = '/manual/POS_User_Manual_Lao.pdf?v=20260513-full-manual-56-pages';

const QUICK_SECTIONS = [
  {
    title: 'ໜ້າ POS',
    text: 'ຂາຍສິນຄ້າ, ສະແກນ barcode, ເລືອກສະມາຊິກ, ໃຊ້ສ່ວນຫຼຸດ ແລະ ພິມໃບບິນ.',
  },
  {
    title: 'Admin Console',
    text: 'ຈັດການສິນຄ້າ, stock, ການຊື້, ຫນີ້, ລາຍງານ, ຜູ້ໃຊ້ ແລະ ການຕັ້ງຄ່າ.',
  },
  {
    title: 'ການເງິນ',
    text: 'ບັນທຶກລາຍຮັບ/ລາຍຈ່າຍ, ສົ່ງເງິນ, VAT, COGS ແລະ KPI ພະນັກງານ.',
  },
  {
    title: 'ລູກຄ້າ',
    text: 'ຈັດການສະມາຊິກ, ແຕ້ມສະສົມ, ການຂາຍຕິດໜີ້ ແລະ ການຮັບຊຳລະ.',
  },
];

export default function ManualPage() {
  const openPdf = () => {
    window.open(PDF_URL, '_blank', 'noopener,noreferrer');
  };

  const downloadPdf = () => {
    const a = document.createElement('a');
    a.href = PDF_URL;
    a.download = 'POS_User_Manual_Lao.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="User manual"
        title="📘 ຄູ່ມືການໃຊ້ງານ"
        subtitle="ເປີດອ່ານ ຫຼື ດາວໂຫຼດຄູ່ມື POS ສຳລັບພະນັກງານ ແລະ Admin"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openPdf}
              className="rounded-xl bg-white text-slate-900 hover:bg-slate-100 px-4 py-3 text-sm font-extrabold shadow-lg shadow-red-950/10"
            >
              ເປີດ PDF
            </button>
            <button
              onClick={downloadPdf}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-3 text-sm font-extrabold shadow-lg shadow-red-950/20"
            >
              ດາວໂຫຼດ
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {QUICK_SECTIONS.map(section => (
          <div key={section.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-extrabold text-slate-900">{section.title}</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{section.text}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">ຕົວຢ່າງເອກະສານ</h2>
            <p className="text-xs text-slate-500 mt-0.5">ຖ້າ Browser ບໍ່ສະແດງ PDF ໃຫ້ກົດ “ເປີດ PDF” ຫຼື “ດາວໂຫຼດ”.</p>
          </div>
          <a
            href={PDF_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-2 text-xs font-extrabold text-slate-700"
          >
            ເບິ່ງເຕັມໜ້າ
          </a>
        </div>
        <div className="h-[72vh] min-h-[520px] bg-slate-100">
          <iframe
            title="POS user manual PDF"
            src={PDF_URL}
            className="h-full w-full border-0"
          />
        </div>
      </section>
    </div>
  );
}
