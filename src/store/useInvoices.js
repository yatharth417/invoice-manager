import { useCallback, useEffect, useState } from 'react';

const seed = [
  { id:1, caseName:'image01.jpg', pages:1, uploadedAt:'2025-09-10 ', modifiedAt:'2025-09-10 ', status:'Done', file:'image01.jpg', data:{}},
  { id:2, caseName:'image2.jpg', pages:1, uploadedAt:'2025-09-10 ', modifiedAt:'2025-09-10 ', status:'Done', file:'image2.jpg', data:{} },
  { id:3, caseName:'image3.jpg', pages:1, uploadedAt:'2025-09-10 ', modifiedAt:'2025-09-10 ', status:'Done', file:'image3.jpg', data:{} },
  { id:4, caseName:'image4.jpg', pages:1, uploadedAt:'2025-09-10 ', modifiedAt:'2025-09-10 ', status:'Done', file:'image4.jpg', data:{} },
  { id:5, caseName:'image5.png', pages:1, uploadedAt:'2025-09-10 ', modifiedAt:'2025-09-10 ', status:'Done', file:'image5.png', data:{} },
  { id:6, caseName:'image6.jpg', pages:1, uploadedAt:'2025-09-10 ', modifiedAt:'2025-09-10 ', status:'Exception', file:'image6.jpg', data:{} },
  { id:7, caseName:'image7.jpeg', pages:1, uploadedAt:'2025-09-10 ', modifiedAt:'2025-09-10 ', status:'Error', file:'image9.jpeg', data:{} },
];

const KEY = 'invoice-demo-data-v1'; 

export default function useInvoices() {
  const [invoices, setInvoices] = useState(() => {
    const cached = localStorage.getItem(KEY);
    if (cached) return JSON.parse(cached);
    return seed;
  });

  useEffect(()=>{ localStorage.setItem(KEY, JSON.stringify(invoices)); }, [invoices]);

  const update = useCallback((id, partial) => {
    setInvoices(list => list.map(inv => inv.id === id ? { ...inv, ...partial, modifiedAt: new Date().toISOString().slice(0,16).replace('T',' ') } : inv));
  }, []);

  const getById = useCallback((id) => invoices.find(i=>i.id===id), [invoices]);

  const statusCounts = useMemoCounts(invoices);

  return { invoices, update, getById, statusCounts };
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
