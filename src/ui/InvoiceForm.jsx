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

export default function InvoiceForm({ invoice, onFileSelect }) {
  const { update } = useInvoices();
  const [form, setForm] = useState(()=> ({ ...fields.reduce((a,[k]) => ({...a, [k]: invoice.data?.[k] || ''}), {} ) }));
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

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

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setExtractError(null);
      // Notify parent component about the selected file
      if (onFileSelect) {
        onFileSelect(file);
      }
    } else if (file) {
      setExtractError('Please select a PDF file');
      setSelectedFile(null);
      if (onFileSelect) {
        onFileSelect(null);
      }
    }
  }

  async function handleExtract() {
    if (!selectedFile) {
      setExtractError('Please select a PDF file first');
      return;
    }

    setExtracting(true);
    setExtractError(null);

    try {
      const result = await extractInvoice(selectedFile);
      
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
      {/* PDF Upload Section */}
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
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileSelect}
            disabled={extracting}
            style={{ flex: '1', minWidth: '200px' }}
          />
          <button 
            className="button primary" 
            onClick={handleExtract}
            disabled={!selectedFile || extracting}
            style={{ whiteSpace: 'nowrap' }}
          >
            {extracting ? 'Extracting...' : '🔍 Extract Data'}
          </button>
        </div>
        {selectedFile && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
            Selected: {selectedFile.name}
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
