export default function InvoicePreview({ invoice }) {
  return (
    <div className="preview-panel">
      <div className="scroll">
        <div style={{textAlign:'center', padding:12, fontSize:12, color:'#64748b'}}>
          <div style={{border:'1px dashed #cbd5e1', padding:30, borderRadius:8, width:'90%', margin:'0 auto'}}>
            <p style={{marginBottom:12}}>Preview for file:</p>
            <strong>{invoice.file}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
