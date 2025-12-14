import React, { useState } from 'react';
import useInvoices from '../store/useInvoices.js';
import { extractInvoice } from '../services/api.js';

const fields = [
  ['invoiceNumber','Invoice Number'],
  ['invoiceDate','Invoice Date'],
  ['dueDate','Due Date'],
  ['vendor','Vendor'],
  ['vendorAddress','Vendor Address'],
  ['purchaseOrder','Purchase Order'],
  ['accountNumber','Account Number'],
  ['lineItems','Line Items', 'textarea'],
  ['total','Total'],
  ['currency','Currency'],
];

export default function InvoiceForm({ invoice }) {
  const { update } = useInvoices();
  const [form, setForm] = useState(()=> ({ ...fields.reduce((a,[k]) => ({...a, [k]: invoice.data?.[k] || ''}), {} ) }));
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState(null);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  function handleSave() {
    setSaving(true);
    setTimeout(()=>{
      update(invoice.id, { data: form });
      setSaving(false);
    }, 400);
  }

  async function handleExtract() {
    let sourceFile = invoice.pdfFile;
    // Fallback: if pdfFile missing but we have a blob URL, fetch and reconstruct a File
    if (!sourceFile && invoice.fileUrl) {
      try {
        const res = await fetch(invoice.fileUrl);
        const blob = await res.blob();
        sourceFile = new File([blob], invoice.file || 'invoice.pdf', { type: blob.type || 'application/pdf' });
      } catch (e) {
        setExtractError('Could not access PDF from preview URL. Please re-upload from the dashboard.');
        return;
      }
    }

    if (!sourceFile) {
      setExtractError('No PDF file found. Please upload a PDF from the dashboard first.');
      return;
    }

    setExtracting(true);
    setExtractError(null);

    try {
      const result = await extractInvoice(sourceFile);
      
      // Map API response to form fields
      const extractedData = {
        invoiceNumber: result.invoice_number || '',
        invoiceDate: result.invoice_date || '',
        dueDate: result.due_date || '',
        vendor: result.vendor_name || '',
        vendorAddress: result.vendor_address || '',
        purchaseOrder: result.purchase_order || '',
        accountNumber: result.account_number || '',
        lineItems: result.line_items ? (typeof result.line_items === 'string' ? result.line_items : JSON.stringify(result.line_items, null, 2)) : '',
        total: result.total_amount || '',
        currency: result.currency || '',
      };

      setForm(extractedData);
      setExtractError(null);
      
      // Show success message
      alert(`Invoice extracted successfully in ${result.execution_time_seconds}s! Review and save the data.`);
    } catch (error) {
      setExtractError(error.message || 'Failed to extract invoice. Please ensure the backend is running.');
      console.error('Extraction error:', error);
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="form-panel">
      {/* PDF Info & Extract Section */}
      <div style={{ 
        marginBottom: '1.5rem', 
        padding: '1rem', 
        backgroundColor: '#f8fafc', 
        borderRadius: '0.5rem',
        border: '1px solid #e2e8f0'
      }}>
        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: '600', color: '#334155' }}>
          Extract from PDF
        </h3>
        
        {invoice.pdfFile || invoice.fileUrl ? (
          <div style={{ 
            marginBottom: '0.75rem', 
            padding: '0.5rem', 
            backgroundColor: '#dcfce7', 
            border: '1px solid #86efac',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            color: '#15803d',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>✓ PDF ready: <strong>{invoice.file}</strong></span>
            <button 
              className="button primary" 
              onClick={handleExtract}
              disabled={extracting}
              style={{ whiteSpace: 'nowrap', marginLeft: '1rem' }}
            >
              {extracting ? 'Extracting...' : '🔍 Extract Data'}
            </button>
          </div>
        ) : (
          <div style={{ 
            padding: '0.75rem', 
            backgroundColor: '#fef3c7', 
            border: '1px solid #fde047',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            color: '#92400e'
          }}>
            No PDF uploaded yet. Please upload a PDF from the dashboard first.
          </div>
        )}
        
        {extractError && (
          <div style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '0.375rem',
            color: '#dc2626',
            fontSize: '0.875rem'
          }}>
            {extractError}
          </div>
        )}
      </div>

      <div className="form-grid">
        {fields.map(([name,label,type]) => (
          <div className="field" key={name} style={type==='textarea'?{gridColumn:'1/-1'}:undefined}>
            <label htmlFor={name}>{label}</label>
            {type==='textarea' ? (
              <textarea id={name} name={name} value={form[name]} onChange={handleChange} />
            ) : (
              <input id={name} name={name} value={form[name]} onChange={handleChange} />
            )}
          </div>
        ))}
      </div>
      <div className="actions-row">
        <button className="button" onClick={()=>setForm(fields.reduce((a,[k])=>({...a, [k]:''}), {}))}>Reset</button>
        <button className="button primary" onClick={handleSave} disabled={saving}>{saving? 'Saving...' : 'Save'}</button>
      </div>
    </div>
  );
}
