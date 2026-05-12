import { redirect } from 'next/navigation';

export default function DebtPaymentsIndex() {
  redirect('/admin/debt-payments/customer');
}
