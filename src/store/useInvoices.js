import { useCallback, useEffect, useState, useRef } from 'react';

const KEY = 'invoice-demo-data-v1';
const pdfFilesStorage = {}; // Global storage for PDF files

export default function useInvoices() {
  const [invoices, setInvoices] = useState(() => {
    const cached = localStorage.getItem(KEY);
    if (cached) return JSON.parse(cached);
    return [];
  });

  const [pdfFiles, setPdfFiles] = useState(pdfFilesStorage);

  useEffect(()=>{ localStorage.setItem(KEY, JSON.stringify(invoices)); }, [invoices]);

  const update = useCallback((id, partial) => {
    setInvoices(list => list.map(inv => inv.id === id ? { ...inv, ...partial, modifiedAt: new Date().toISOString().slice(0,16).replace('T',' ') } : inv));
  }, []);

  const addInvoice = useCallback((invoiceData, pdfFile) => {
    let newId;
    let newInvoice;
    
    setInvoices(prev => {
      newId = prev.length > 0 ? Math.max(...prev.map(i => i.id)) + 1 : 1;
      const now = new Date().toISOString().slice(0,16).replace('T',' ');
      
      // Create a blob URL for runtime preview (not persisted across reloads)
      const fileUrl = pdfFile ? URL.createObjectURL(pdfFile) : '';

      newInvoice = {
        id: newId,
        caseName: invoiceData.caseName || 'Unnamed Invoice',
        pages: invoiceData.pages || 1,
        uploadedAt: now,
        modifiedAt: now,
        status: 'Pending',
        file: invoiceData.file || '',
        fileUrl,
        data: {}
      };
      
      return [...prev, newInvoice];
    });
    
    if (pdfFile && newId) {
      // Store the File in module-level storage so all hook instances can access it
      pdfFilesStorage[newId] = pdfFile;
      // Update local state for components using this hook instance
      setPdfFiles({ ...pdfFilesStorage });
    }
    
    return newId;
  }, []);

  const deleteInvoice = useCallback((id) => {
    setInvoices(list => list.filter(inv => inv.id !== id));
    // Also remove PDF file from storage
    delete pdfFilesStorage[id];
    setPdfFiles({...pdfFilesStorage});
  }, []);

  const getById = useCallback((id) => {
    const invoice = invoices.find(i => i.id === id);
    // Always read the latest from module-level storage to avoid stale state across hook instances
    const pdfFile = pdfFilesStorage[id];
    if (invoice && pdfFile) {
      return { ...invoice, pdfFile };
    }
    return invoice;
  }, [invoices]);

  const statusCounts = useMemoCounts(invoices);

  return { invoices, update, addInvoice, deleteInvoice, getById, statusCounts };
}

function useMemoCounts(invoices) {
  const [counts, setCounts] = useState({});
  useEffect(()=>{
    const c = {};
    for (const inv of invoices) c[inv.status] = (c[inv.status]||0)+1;
    setCounts(c);
  }, [invoices]);
  return counts;
}
