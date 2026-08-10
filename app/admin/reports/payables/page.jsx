'use client';

import DebtReport from '@/components/admin/DebtReport';

export default function PayablesReportPage() {
  return (
    <DebtReport
      endpoint="/admin/reports/payables"
      tag="Accounts Payable"
      title="📤 ລາຍງານໜີ້ຄ້າງສົ່ງ (ຜູ້ສະໜອງ)"
      subtitle="ບິນຊື້ທີ່ຍັງຈ່າຍໃຫ້ຜູ້ສະໜອງບໍ່ຄົບ"
      partyLabel="ຜູ້ສະໜອງ"
      refLabel="ເລກທີບິນຊື້"
      paidLabel="ຈ່າຍແລ້ວ"
      remainingLabel="ຄ້າງສົ່ງ"
      fileBase="payables"
    />
  );
}
