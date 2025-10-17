# Quick Start Guide

## 🚀 Setup Instructions

### Step 1: Install Backend Dependencies

Open PowerShell and navigate to your project:

```powershell
cd c:\Users\91886\invoice_\invoice-manager\backend
pip install -r requirements.txt
```

### Step 2: Start the Backend Server

```powershell
# Option 1: Using the helper script
python run.py

# Option 2: Using uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

You should see output like:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### Step 3: Test the Backend

Open your browser and go to:
- API Documentation: http://localhost:8000/docs
- Health Check: http://localhost:8000/

### Step 4: Start the Frontend

In a **new** PowerShell terminal:

```powershell
cd c:\Users\91886\invoice_\invoice-manager
npm run dev
```

## 🔌 Using the API in Your Frontend

The API service is ready to use in `src/services/api.js`:

```javascript
import { extractInvoice } from './services/api.js';

// Example usage in your component:
const handleFileUpload = async (file) => {
  try {
    const data = await extractInvoice(file);
    console.log('Extracted invoice data:', data);
    // Use the data: invoice_number, invoice_date, total_amount, vendor_name, currency
  } catch (error) {
    console.error('Error:', error.message);
  }
};
```

## 📝 Available API Functions

### `extractInvoice(file, customPrompt)`
Uploads a PDF and extracts invoice data using AI.

**Parameters:**
- `file`: PDF File object
- `customPrompt` (optional): Custom extraction instructions

**Returns:**
```javascript
{
  invoice_number: "INV-123",
  invoice_date: "2025-10-17",
  total_amount: "1500.00",
  vendor_name: "ABC Corp",
  currency: "USD",
  execution_time_seconds: 2.5
}
```

### `checkBackendHealth()`
Checks if the backend API is running.

**Returns:** `true` or `false`

## 🎯 Integration Example

Here's how to add a file upload to your existing components:

```javascript
// Add this to your component
const [file, setFile] = useState(null);

const handleFileChange = (e) => {
  setFile(e.target.files[0]);
};

const handleExtract = async () => {
  if (!file) return;
  
  try {
    const result = await extractInvoice(file);
    
    // Update your invoice with extracted data
    update(invoiceId, {
      data: {
        invoiceNumber: result.invoice_number,
        invoiceDate: result.invoice_date,
        total: result.total_amount,
        vendor: result.vendor_name,
        currency: result.currency,
      }
    });
    
    alert('Invoice extracted successfully!');
  } catch (error) {
    alert('Error: ' + error.message);
  }
};

// In your JSX:
<input type="file" accept=".pdf" onChange={handleFileChange} />
<button onClick={handleExtract}>Extract Invoice</button>
```

## ⚠️ Troubleshooting

### Backend won't start
- Make sure you're in the `backend` folder
- Install dependencies: `pip install -r requirements.txt`
- Check Python version: `python --version` (should be 3.8+)

### CORS errors
- Make sure backend is running on port 8000
- Frontend should be on port 5173 (Vite default)

### Import errors
The backend needs Python packages. Install them:
```powershell
pip install fastapi uvicorn pdfplumber ollama
```

### Connection refused
- Check backend is running: http://localhost:8000/
- Check .env file has correct URL: `VITE_API_URL=http://localhost:8000`

## 📚 API Documentation

Once the backend is running, visit http://localhost:8000/docs for interactive API documentation.
