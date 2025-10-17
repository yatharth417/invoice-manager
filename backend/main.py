import os
import pdfplumber
import ollama
import json
import time
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import tempfile

app = FastAPI(title="Invoice Extractor API")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
) 

def extract_text_from_pdf(file_path):
    text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text += page.extract_text() or ""
    return text

def query_invoice_ollama(text, custom_prompt):
    system_prompt = f"""
    You are an expert invoice parser. 
    Given the text of an invoice, extract ALL key details and return them as JSON. 
    
    REQUIRED FIELDS - Extract all of these:
    
    1. invoice_number: The unique invoice/bill identifier (e.g., "INV-123", "F2019-0006224", "Bill #456"). 
       Look for: Invoice Number, Invoice #, Bill Number, Reference Number, Document Number.
       NOT a product/service name or description.
    
    2. invoice_date: The date when the invoice was issued (single date, e.g., "31/07/2019", "2024-01-15", "Jan 15, 2024").
       Look for: Invoice Date, Issue Date, Date, Billing Date.
       NOT a date range, service period, or due date.
    
    3. due_date: The payment due date (e.g., "15/08/2019", "2024-02-15").
       Look for: Due Date, Payment Due, Pay By Date, Payment Deadline.
    
    4. vendor_name: The company/person issuing the invoice (the seller/service provider).
       Look for: From, Vendor, Supplier, Billed By, Company Name (at the top/header).
    
    5. vendor_address: The full address of the vendor/supplier.
       Look for: Address, Street, City, Postal Code, Country (near vendor name).
       Include complete address with street, city, zip/postal code.
    
    6. purchase_order: Purchase Order number if mentioned (e.g., "PO-12345", "PO#456").
       Look for: PO, Purchase Order, PO Number, Order Number, Reference.
    
    7. account_number: Customer account number or client ID if mentioned (e.g., "ACC-789", "12345").
       Look for: Account Number, Customer ID, Client Number, Account #.
    
    8. line_items: List of items/services with descriptions and amounts.
       Extract as an array of objects with: description, quantity, unit_price, amount.
       Example: Array with item objects containing description, quantity, price and total.
       If complex, provide as formatted text with each line item.
    
    9. total_amount: The final TOTAL amount to be paid (numeric value, e.g., "1500.00", "1500").
       Look for: Total, Grand Total, Amount Due, Final Amount, Balance Due.
       Extract ONLY the number, remove currency symbols.
    
    10. currency: The currency code or name (e.g., "USD", "EUR", "GBP", "Dollar", "Euro").
        Look for: Currency symbols ($, €, £), currency codes, or currency names.
    
    CRITICAL RULES:
    - If you cannot find a value for any field, put null (not empty string).
    - Return ONLY valid JSON. No explanation, no markdown code blocks, no extra text!
    - Be precise: invoice_date is NOT the same as due_date or service period.
    - invoice_number is the document ID, NOT a product name.
    - Extract numbers for amounts without currency symbols.
        
    Additional instructions: {custom_prompt}
    """
    response = ollama.chat(model="phi3:mini", messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": text}
    ])
    return response['message']['content']


@app.post("/extract-invoice")
async def extract_invoice(
    file: UploadFile = File(...),
    custom_prompt: str = Form("Extract all invoice fields including invoice number, date, due date, vendor name and address, purchase order, account number, line items, total amount, and currency.")
):
    start_time = time.time()
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
        
    try:
        text = extract_text_from_pdf(tmp_path)
        result = query_invoice_ollama(text, custom_prompt)
        
        # Clean up the result - remove markdown code blocks if present
        cleaned_result = result.strip()
        if cleaned_result.startswith("```json"):
            cleaned_result = cleaned_result[7:]
        elif cleaned_result.startswith("```"):
            cleaned_result = cleaned_result[3:]
        if cleaned_result.endswith("```"):
            cleaned_result = cleaned_result[:-3]
        cleaned_result = cleaned_result.strip()
        
        try: 
            parsed_result = json.loads(cleaned_result)
        except Exception as e:
            parsed_result = {"raw_output": result, "parse_error": str(e)}
            
        elapsed = round(time.time() - start_time, 2)
        parsed_result["execution_time_seconds"] = elapsed
        
        return JSONResponse(content=parsed_result)
    except Exception as ex:
        return JSONResponse(status_code=500, content={"error": str(ex)})
    finally:
        # Clean up temporary file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@app.get("/")
async def root():
    """Root endpoint to check API status"""
    return {"message": "Invoice Extractor API is running", "version": "1.0.0"}