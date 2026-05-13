import QuotationBuilder from '../QuotationBuilder';

export default async function EditQuotationPage({ params }) {
  const { id } = await params;
  return <QuotationBuilder quotationId={id} />;
}
