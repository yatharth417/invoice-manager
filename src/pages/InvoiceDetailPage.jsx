import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import useInvoices from '../store/useInvoices.js';
import InvoiceForm from '../ui/InvoiceForm.jsx';
import InvoicePreview from '../ui/InvoicePreview.jsx';

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getById, update } = useInvoices();
  const invoice = getById(Number(id));
  const [selectedField, setSelectedField] = useState(null);

  if(!invoice) return <div style={{padding:40}}>Invoice not found. <button onClick={()=>navigate('/invoices')}>Back</button></div>;

  return (
    <div className="content">
      <h1>Invoice #{invoice.id}</h1>
      {/* Diagnostics to help trace PDF preview issues */}
      <div style={{
        marginBottom: '12px',
        padding: '8px 12px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        color: '#334155',
        fontSize: 12
      }}>
        <strong>Debug:</strong>
        <span style={{ marginLeft: 8 }}>id={invoice.id}</span>
        <span style={{ marginLeft: 8 }}>file={invoice.file || 'N/A'}</span>
        <span style={{ marginLeft: 8 }}>fileUrl={invoice.fileUrl ? 'yes' : 'no'}</span>
        <span style={{ marginLeft: 8 }}>pdfFile={invoice.pdfFile ? 'yes' : 'no'}</span>
      </div>
      <div className="detail-layout">
        <InvoicePreview invoice={invoice} pdfFile={invoice.pdfFile || null} selectedField={selectedField} onFieldSelect={setSelectedField} />
        <InvoiceForm invoice={invoice} update={update} selectedField={selectedField} />
      </div>
    </div>
  );
}
