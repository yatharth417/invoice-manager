// API service for communicating with the FastAPI backend

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Extract invoice data from a PDF file
 * @param {File} file - PDF file to extract data from
 * @param {string} customPrompt - Custom prompt for the extraction
 * @returns {Promise<Object>} Extracted invoice data
 */
export async function extractInvoice(file, customPrompt = "Extract all invoice fields including invoice number, date, due date, vendor name and address, purchase order, account number, line items, total amount, and currency.") {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('custom_prompt', customPrompt);

    const response = await fetch(`${API_BASE_URL}/extract-invoice`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error extracting invoice:', error);
    throw error;
  }
}

/**
 * Check if the backend API is available
 * @returns {Promise<boolean>}
 */
export async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/`, {
      method: 'GET',
    });
    return response.ok;
  } catch (error) {
    console.error('Backend health check failed:', error);
    return false;
  }
}
