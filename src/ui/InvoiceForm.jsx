import React, { useState } from 'react';
import useInvoices from '../store/useInvoices.js';

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

  return (
    <div className="form-panel">
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
