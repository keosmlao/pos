import DebtPaymentsView from '../DebtPaymentsView';

export default function CustomerDebtPaymentsPage() {
  return (
    <DebtPaymentsView
      debtType="customer"
      title="ລາຍການຊຳລະຈາກລູກໜີ້"
      subtitle="ລູກຄ້າຄ້າງຊຳລະ (Accounts Receivable)"
      icon="\u{1F9FE}"
      nameLabel="ລູກຄ້າ"
      color="emerald"
    />
  );
}
