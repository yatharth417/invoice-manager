import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useInvoices from '../store/useInvoices.js';

export default function DashboardPage() {
  const { invoices, statusCounts, update } = useInvoices();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const filtered = useMemo(() => invoices.filter(inv => inv.caseName.toLowerCase().includes(query.toLowerCase()) || String(inv.id).includes(query)), [invoices, query]);

  const handleStatusChange = (invoiceId, newStatus) => {
    update(invoiceId, { status: newStatus });
  };

  return (
    <div className="content">
      <h1>Cases</h1>
      <div className="grid stats">
        <StatCard label="Total" value={invoices.length} />
        <StatCard label="Done" value={statusCounts.Done || 0} variant="Done" />
        <StatCard label="Exception" value={statusCounts.Exception || 0} variant="Exception" />
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
                    <option value="Done">Done</option>
                    <option value="Exception">Exception</option>
                    <option value="Error">Error</option>
                  </select>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{textAlign:'center', padding:40, color:'#64748b'}}>No cases match your search.</td></tr>
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
