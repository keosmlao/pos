import { redirect } from 'next/navigation';

export default function CreditSalesIndex() {
  // The list of credit sales lives in /admin/customer-debts; this index goes straight to create.
  redirect('/admin/credit-sales/new');
}
