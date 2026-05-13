import CashTransactionsView from '../CashTransactionsView';

export default function ExpensePage() {
  return (
    <CashTransactionsView
      txnType="expense"
      title="ບັນທຶກລາຍຈ່າຍອື່ນໆ"
      subtitle="ລາຍຈ່າຍທີ່ບໍ່ມາຈາກການຊື້ສິນຄ້າ (ຄ່າເຊົ່າ, ນ້ຳ/ໄຟ, ເງິນເດືອນ...)"
      icon="🔴"
      color="rose"
    />
  );
}
