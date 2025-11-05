import React, { useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useInvoices from '../store/useInvoices.js';

export default function DashboardPage() {
  const { invoices, statusCounts, update, addInvoice, deleteInvoice } = useInvoices();
  const [query, setQuery] = useState('');
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const filtered = useMemo(() => invoices.filter(inv => inv.caseName.toLowerCase().includes(query.toLowerCase()) || String(inv.id).includes(query)), [invoices, query]);

  const handleStatusChange = (invoiceId, newStatus) => {
    update(invoiceId, { status: newStatus });
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    
    files.forEach(file => {
      if (file.type === 'application/pdf') {
        const invoiceData = {
          caseName: file.name,
          file: file.name,
          pages: 1 // Default, can be updated after extraction
        };
        
        addInvoice(invoiceData, file);
      }
    });
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleDelete = (invoiceId, e) => {
    e.stopPropagation();
    deleteInvoice(invoiceId);
  };

  return (
    <div className="content">
      <h1>Cases</h1>
      
      {/* Hidden file input */}
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".pdf"
        multiple
        style={{ display: 'none' }}
      />
      
      {/* Upload button */}
      <button 
        className="button primary" 
        onClick={handleUploadClick}
        style={{ marginBottom: '20px' }}
      >
        📄 Upload PDF Invoices
      </button>
      
      <div className="grid stats">
        <StatCard label="Total" value={invoices.length} />
        <StatCard label="Pending" value={statusCounts.Pending || 0} variant="Pending" />
        <StatCard label="Done" value={statusCounts.Done || 0} variant="Done" />
        <StatCard label="Error" value={statusCounts.Error || 0} variant="Error" />
      </div>
      <div className="table-wrapper">
        <div className="search-row">
          <input placeholder="Search by case id or name" value={query} onChange={e=>setQuery(e.target.value)} />
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Case ID</th>
              <th>Case Name</th>
              <th>Pages</th>
              <th>Uploaded At</th>
              <th>Modified At</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(inv => (
              <tr key={inv.id}>
                <td onClick={()=>navigate(`/invoices/${inv.id}`)} style={{cursor:'pointer'}}>{inv.id}</td>
                <td onClick={()=>navigate(`/invoices/${inv.id}`)} style={{cursor:'pointer'}}>{inv.caseName}</td>
                <td onClick={()=>navigate(`/invoices/${inv.id}`)} style={{cursor:'pointer'}}>{inv.pages}</td>
                <td onClick={()=>navigate(`/invoices/${inv.id}`)} style={{cursor:'pointer'}}>{inv.uploadedAt}</td>
                <td onClick={()=>navigate(`/invoices/${inv.id}`)} style={{cursor:'pointer'}}>{inv.modifiedAt}</td>
                <td>
                  <select 
                    value={inv.status} 
                    onChange={(e) => handleStatusChange(inv.id, e.target.value)}
                    className="status-dropdown"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Done">Done</option>
                    <option value="Error">Error</option>
                  </select>
                </td>
                <td>
                  <button 
                    onClick={(e) => handleDelete(inv.id, e)}
                    style={{
                      padding: '0.375rem 0.5rem',
                      backgroundColor: 'transparent',
                      color: '#94a3b8',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.color = '#ef4444';
                      e.currentTarget.style.borderColor = '#ef4444';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.color = '#94a3b8';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }}
                    title="Delete invoice"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{textAlign:'center', padding:40, color:'#64748b'}}>
                {invoices.length === 0 ? '📄 No invoices yet. Click "Upload PDF Invoices" to get started!' : 'No cases match your search.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, variant }) {
  return (
    <div className="card">
      <h3>{label}</h3>
      <div className="value">{value}</div>
      {variant && <span className={`badge status-${variant}`}>{variant}</span>}
    </div>
  );
}
