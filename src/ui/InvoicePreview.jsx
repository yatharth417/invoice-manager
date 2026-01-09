import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// Use the local worker that matches pdfjs-dist v5
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Expected bounding box shape (from backend):
// { field: 'invoiceNumber', x: 0.1, y: 0.2, width: 0.3, height: 0.05, page: 1, normalized: true }
// Coordinates are assumed normalized (0-1) relative to page width/height.

export default function InvoicePreview({ invoice, pdfFile }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [boxes, setBoxes] = useState([]);
  const [showBoxes, setShowBoxes] = useState(true);
  const [scale, setScale] = useState(1);
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

  // Keep boxes in sync with invoice data
  useEffect(() => {
    setBoxes(invoice?.boxes || []);
  }, [invoice?.boxes]);

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
        setPageSize({ width: viewport.width, height: viewport.height });
        await page.render({ canvasContext: context, viewport }).promise;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('PDF render error', err);
      }
    }
    render();
    return () => { cancelled = true; };
  }, [pdfUrl]);

  // Recompute scale of displayed canvas vs intrinsic page size
  useEffect(() => {
    if (!canvasRef.current || !pageSize.width) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nextScale = rect.width ? rect.width / pageSize.width : 1;
    setScale(nextScale || 1);
  }, [pageSize.width, pageSize.height, pdfUrl]);

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
              justifyContent: 'space-between',
              gap: '0.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📄</span>
                <strong style={{ color: '#334155' }}>{pdfFile?.name || invoice.file}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Boxes: {boxes.length}</span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Auto boxes</span>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                  <input type="checkbox" checked={showBoxes} onChange={e=>setShowBoxes(e.target.checked)} />
                  Show
                </label>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', position:'relative', overflow:'auto' }}>
              <div style={{ position:'relative', display:'inline-block' }}>
                <canvas
                  ref={canvasRef}
                  style={{
                    maxWidth: '100%',
                    height: 'auto',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                    display: 'block',
                    background: '#fff'
                  }}
                />
                {/* Overlay layer for backend-provided bounding boxes */}
                {showBoxes && pageSize.width > 0 && pageSize.height > 0 && (
                  <div
                    style={{
                      position:'absolute',
                      top:0,
                      left:0,
                      width: `${pageSize.width}px`,
                      height: `${pageSize.height}px`,
                      pointerEvents:'none',
                      transform: `scale(${scale})`,
                      transformOrigin: 'top left'
                    }}
                  >
                    {boxes.map((box, idx) => {
                      if (!box) return null;
                      const normalized = box.normalized !== false; // default true
                      const pxWidth = normalized ? box.width * pageSize.width : box.width;
                      const pxHeight = normalized ? box.height * pageSize.height : box.height;
                      const pxLeft = normalized ? box.x * pageSize.width : box.x;
                      const pxTop = normalized ? box.y * pageSize.height : box.y;
                      return (
                        <div
                          key={box.id || idx}
                          style={{
                            position:'absolute',
                            left: `${pxLeft}px`,
                            top: `${pxTop}px`,
                            width: `${pxWidth}px`,
                            height: `${pxHeight}px`,
                            border:'2px solid #3b82f6',
                            background:'rgba(59,130,246,0.12)',
                            borderRadius:4,
                            boxShadow:'0 4px 12px rgba(0,0,0,0.08)',
                            pointerEvents:'none'
                          }}
                        >
                          {box.field && (
                            <div style={{
                              position:'absolute',
                              top:-22,
                              left:0,
                              background:'#1e293b',
                              color:'#fff',
                              padding:'2px 8px',
                              borderRadius:4,
                              fontSize:'10px',
                              fontWeight:600,
                              whiteSpace:'nowrap'
                            }}>
                              {box.field}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
