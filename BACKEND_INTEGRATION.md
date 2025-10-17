# Backend Integration Guide

## Setup Instructions

### 1. Install Backend Dependencies

Navigate to the backend folder and install the required packages:

```powershell
cd backend
pip install -r requirements.txt
```

### 2. Start the Backend Server

Run the FastAPI server:

```powershell
cd backend
python run.py
```

Or using uvicorn directly:

```powershell
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at: `http://localhost:8000`
API documentation will be at: `http://localhost:8000/docs`

### 3. Start the Frontend

In a separate terminal, run the frontend:

```powershell
npm run dev
```

## Using the API in Your Frontend

The API service is now available in `src/services/api.js`. You can import and use it in your components:

```javascript
import { extractInvoice, checkBackendHealth } from '../services/api.js';

// Example: Extract invoice from PDF file
const handleFileUpload = async (file) => {
  try {
    const result = await extractInvoice(file);
    console.log('Extracted data:', result);
    // Result contains: invoice_number, invoice_date, total_amount, 
    // vendor_name, currency, execution_time_seconds
  } catch (error) {
    console.error('Extraction failed:', error);
  }
};

// Example: Check if backend is running
const checkAPI = async () => {
  const isHealthy = await checkBackendHealth();
  console.log('Backend is', isHealthy ? 'running' : 'not available');
};
```

## API Endpoints

### POST /extract-invoice
Extracts invoice data from a PDF file.

**Request:**
- `file` (form-data): PDF file
- `custom_prompt` (form-data): Custom extraction prompt (optional)

**Response:**
```json
{
  "invoice_number": "INV-123",
  "invoice_date": "2025-10-17",
  "total_amount": "1500.00",
  "vendor_name": "ABC Company",
  "currency": "USD",
  "execution_time_seconds": 2.5
}
```

### GET /
Health check endpoint.

**Response:**
```json
{
  "message": "Invoice Extractor API is running",
  "version": "1.0.0"
}
```

## Example Integration

Here's how you can integrate the API into your existing components:

```javascript
// In your InvoiceForm or Dashboard component
import { extractInvoice } from '../services/api.js';

const handlePDFUpload = async (event) => {
  const file = event.target.files[0];
  
  if (file && file.type === 'application/pdf') {
    try {
      const extractedData = await extractInvoice(file);
      
      // Update your invoice data with the extracted information
      update(invoiceId, {
        data: {
          invoiceNumber: extractedData.invoice_number,
          invoiceDate: extractedData.invoice_date,
          total: extractedData.total_amount,
          vendor: extractedData.vendor_name,
          currency: extractedData.currency,
          // ... other fields
        }
      });
      
      alert(`Successfully extracted invoice in ${extractedData.execution_time_seconds}s`);
    } catch (error) {
      alert('Failed to extract invoice: ' + error.message);
    }
  }
};
```

## CORS Configuration

The backend is configured to accept requests from:
- `http://localhost:5173` (Vite default)
- `http://localhost:3000` (Alternative port)
- `http://127.0.0.1:5173`

If you need to add more origins, edit `backend/main.py` and update the `allow_origins` list.

## Troubleshooting

1. **Backend not starting**: Make sure all Python dependencies are installed
2. **CORS errors**: Check that your frontend URL is in the `allow_origins` list
3. **Connection refused**: Ensure the backend is running on port 8000
4. **Import errors**: Make sure FastAPI and all dependencies are installed
