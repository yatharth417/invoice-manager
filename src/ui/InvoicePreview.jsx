import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// Use the local worker that matches pdfjs-dist v5
// In v5, the worker is published as an ES module: pdf.worker.mjs
// Vite will turn this into a URL we can pass to pdf.js
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

export default function InvoicePreview({ invoice, pdfFile }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    // Prefer invoice.fileUrl if available (created at upload time)
    if (invoice?.fileUrl) {
      setPdfUrl(invoice.fileUrl);
      return;
    }
    if (pdfFile) {
      const url = URL.createObjectURL(pdfFile);
      setPdfUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPdfUrl(null);
    }
  }, [invoice?.fileUrl, pdfFile]);

  // Render first page of PDF into canvas using pdf.js
  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!pdfUrl || !canvasRef.current) return;
      try {
        // Configure worker to local bundle to avoid CDN/version mismatch
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport }).promise;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('PDF render error', err);
      }
    }
    render();
    return () => { cancelled = true; };
  }, [pdfUrl]);
  

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
              <strong style={{ color: '#334155' }}>{pdfFile?.name || invoice.file}</strong>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
              <canvas ref={canvasRef} style={{ maxWidth: '100%', height: 'auto', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }} />
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 12, fontSize: 12, color: '#64748b' }}>
            <div style={{ border: '1px dashed #cbd5e1', padding: 30, borderRadius: 8, width: '90%', margin: '0 auto' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>📄</div>
              <p style={{ marginBottom: 12, fontSize: '0.875rem' }}>No PDF selected</p>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Upload a PDF invoice to see the preview here
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
