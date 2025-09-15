import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage.jsx';
import InvoiceDetailPage from './pages/InvoiceDetailPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/invoices" replace />} />
      <Route path="/invoices" element={<DashboardPage />} />
      <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
      <Route path="*" element={<div style={{padding:32}}>Not Found</div>} />
    </Routes>
  );
}
