import { useParams, useNavigate } from 'react-router-dom';
import useInvoices from '../store/useInvoices.js';
import InvoiceForm from '../ui/InvoiceForm.jsx';
import InvoicePreview from '../ui/InvoicePreview.jsx';

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getById } = useInvoices();
  const invoice = getById(Number(id));

  if(!invoice) return <div style={{padding:40}}>Invoice not found. <button onClick={()=>navigate('/invoices')}>Back</button></div>;

  return (
    <div className="content">
      <h1>Invoice #{invoice.id}</h1>
      <div className="detail-layout">
        <InvoicePreview invoice={invoice} pdfFile={invoice.pdfFile || null} />
        <InvoiceForm invoice={invoice} />
      </div>
    </div>
  );
}
