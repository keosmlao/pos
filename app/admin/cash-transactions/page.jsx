import { redirect } from 'next/navigation';

export default function CashTransactionsIndex() {
  redirect('/admin/cash-transactions/income');
}
