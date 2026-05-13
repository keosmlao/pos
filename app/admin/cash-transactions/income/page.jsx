import CashTransactionsView from '../CashTransactionsView';

export default function IncomePage() {
  return (
    <CashTransactionsView
      txnType="income"
      title="ບັນທຶກລາຍຮັບອື່ນໆ"
      subtitle="ລາຍຮັບທີ່ບໍ່ມາຈາກການຂາຍ POS (ທຶນ, ດອກເບ້ຍ, ຄ່າເຊົ່າ...)"
      icon="🟢"
      color="emerald"
    />
  );
}
