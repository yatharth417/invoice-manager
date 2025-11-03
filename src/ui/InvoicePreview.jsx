import { useEffect, useState } from 'react';

export default function InvoicePreview({ invoice, pdfFile }) {
  const [pdfUrl, setPdfUrl] = useState(null);

  useEffect(() => {
    if (pdfFile) {
      // Create object URL for the PDF file
      const url = URL.createObjectURL(pdfFile);
      setPdfUrl(url);

      // Cleanup: revoke the object URL when component unmounts or file changes
      return () => URL.revokeObjectURL(url);
    } else {
      setPdfUrl(null);
    }
  }, [pdfFile]);

  return (
    <div className="preview-panel">
      <div className="scroll">
        {pdfUrl ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ 
              padding: '0.75rem', 
              backgroundColor: '#f8fafc', 
              borderBottom: '1px solid #e2e8f0',
              fontSize: '0.875rem',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span>📄</span>
              <strong style={{ color: '#334155' }}>{pdfFile.name}</strong>
            </div>
            <iframe
              src={pdfUrl}
              style={{
                width: '100%',
                height: 'calc(100% - 50px)',
                border: 'none',
                backgroundColor: '#ffffff'
              }}
              title="PDF Preview"
            />
          </div>
        ) : (
          <div style={{textAlign:'center', padding:12, fontSize:12, color:'#64748b'}}>
            <div style={{border:'1px dashed #cbd5e1', padding:30, borderRadius:8, width:'90%', margin:'0 auto'}}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>📄</div>
              <p style={{marginBottom:12, fontSize: '0.875rem'}}>No PDF selected</p>
              <p style={{fontSize: '0.75rem', color: '#94a3b8'}}>
                Upload a PDF invoice to see the preview here
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
