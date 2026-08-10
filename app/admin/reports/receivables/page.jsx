'use client';

import DebtReport from '@/components/admin/DebtReport';

export default function ReceivablesReportPage() {
  return (
    <DebtReport
      endpoint="/admin/reports/receivables"
      tag="Accounts Receivable"
      title="📥 ລາຍງານໜີ້ຄ້າງຮັບ (ລູກຄ້າ)"
      subtitle="ບິນຂາຍຕິດໜີ້ທີ່ຍັງເກັບເງິນບໍ່ຄົບ"
      partyLabel="ລູກຄ້າ"
      refLabel="ເລກທີບິນຂາຍ"
      paidLabel="ຮັບແລ້ວ"
      remainingLabel="ຄ້າງຮັບ"
      fileBase="receivables"
    />
  );
}
