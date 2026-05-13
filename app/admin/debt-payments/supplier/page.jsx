import DebtPaymentsView from '../DebtPaymentsView';

export default function SupplierDebtPaymentsPage() {
  return (
    <DebtPaymentsView
      debtType="supplier"
      title="ລາຍການຊຳລະໃຫ້ເຈົ້າໜີ້"
      subtitle="ໜີ້ຮ້ານຕ້ອງຊຳລະຜູ້ສະໜອງ (Accounts Payable)"
      icon="\u{1F4B3}"
      nameLabel="ຜູ້ສະໜອງ"
      color="red"
    />
  );
}
