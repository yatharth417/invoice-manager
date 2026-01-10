import os
import pdfplumber
import ollama
import json
import time
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import tempfile

# -----------------------------------------------------------------------------
# PDF utilities
# -----------------------------------------------------------------------------

def extract_pdf_content(file_path):
    """Return extracted text plus per-page words and dimensions for box mapping."""
    pages = []
    full_text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            words = page.extract_words() or []
            pages.append({
                "text": text,
                "words": words,
                "width": page.width,
                "height": page.height,
            })
            full_text += text
    return full_text, pages


def _to_scalar_text(value):
    """Convert lists/dicts/numbers to a searchable string."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float)):
        return str(value)
    # Flatten list/dict to a space-joined string
    try:
        if isinstance(value, list):
            return " ".join(_to_scalar_text(v) for v in value)
        if isinstance(value, dict):
            return " ".join(_to_scalar_text(v) for v in value.values())
    except Exception:
        pass
    return str(value)


def _normalize_token(tok: str) -> str:
    """Lowercase, strip punctuation, remove currency symbols and commas for matching."""
    if not tok:
        return ""
    cleaned = tok.lower().strip()
    # Remove common punctuation and currency symbols
    for ch in [',', '.', ';', ':', '$', '€', '£', '₹']:  # keep hyphen for dates
        cleaned = cleaned.replace(ch, '')
    return cleaned


def _normalize_for_compare(text: str) -> str:
    """Normalize strings for loose comparison (dates/amounts)."""
    if text is None:
        return ""
    s = str(text).lower().strip()
    # If this looks like a date/number, drop non-digits to allow 2026-01-25 vs 01/25/2016
    digits = ''.join(ch for ch in s if ch.isdigit())
    return digits if len(digits) >= 4 else s


def find_address_tokens(words, address_text):
    """
    Find address tokens with noise filtering, horizontal filtering, and vertical clustering.
    Filters tokens <3 chars, keeps tokens near median X, clusters by vertical proximity (<50px), returns largest cluster.
    """
    import re
    
    # Filter noise: only keep address parts with 3+ characters
    address_parts = [p for p in re.findall(r'\S+', address_text) if len(p) > 2]
    
    if not address_parts:
        return []
    
    candidate_tokens = []
    
    for word in words:
        word_text = word['text'].strip()
        
        # Filter noise: ignore tokens shorter than 3 characters
        if len(word_text) <= 2:
            continue
            
        for part in address_parts:
            if part.lower() in word_text.lower() or word_text.lower() in part.lower():
                candidate_tokens.append(word)
                break
    
    if not candidate_tokens:
        return []
    
    # Horizontal filtering: calculate median X and discard outliers
    x_positions = sorted([t['x0'] for t in candidate_tokens])
    n = len(x_positions)
    
    if n % 2 == 0:
        median_x = (x_positions[n // 2 - 1] + x_positions[n // 2]) / 2
    else:
        median_x = x_positions[n // 2]
    
    # Keep only tokens within 150px of median X
    horizontally_filtered = [
        t for t in candidate_tokens
        if abs(t['x0'] - median_x) <= 150
    ]
    
    if not horizontally_filtered:
        return []
    
    # Sort by position (top to bottom, left to right)
    horizontally_filtered.sort(key=lambda w: (w['top'], w['x0']))
    
    # Vertical clustering: group tokens with <50px vertical gap
    clusters = []
    current_cluster = [horizontally_filtered[0]]
    
    for i in range(1, len(horizontally_filtered)):
        prev_token = horizontally_filtered[i - 1]
        curr_token = horizontally_filtered[i]
        
        # Calculate vertical gap
        vertical_gap = curr_token['top'] - prev_token['top']
        
        if vertical_gap > 50:
            # Start new cluster
            clusters.append(current_cluster)
            current_cluster = [curr_token]
        else:
            # Add to current cluster
            current_cluster.append(curr_token)
    
    # Don't forget the last cluster
    clusters.append(current_cluster)
    
    # Selection: return the largest cluster (most words)
    if clusters:
        largest_cluster = max(clusters, key=len)
        return largest_cluster
    
    return []


def find_boxes_for_fields(parsed_result, pages):
    """
    Find bounding boxes for extracted field values.
    FIXED: Filters out label words and only matches the VALUE, not labels before it.
    """
    import re
    
    if not isinstance(parsed_result, dict):
        return []
    
    def normalize(text):
        """Normalize text for comparison - keep important punctuation"""
        text = str(text).strip()
        return text.lower()
    
    def tokenize(text):
        """Split into tokens"""
        return re.findall(r'\S+', str(text))
    
    def is_label_word(word_text, field_name=None):
        """Check if this word is likely a field label, not the value"""
        
        # Special case: For account_number, "ACC" and "BSB" are part of the value!
        if field_name == 'account_number' and word_text.upper() in ['ACC', 'BSB', 'A.C.C', 'B.S.B']:
            return False  # Keep it!
        
        label_keywords = [
            'invoice', 'number', 'date', 'due', 'total', 'amount',
            'vendor', 'address', 'customer', 'bill', 'order',
            'subtotal', 'tax', 'from', 'to', 'purchase',
            'po', 'currency', 'balance'
        ]
        
        word_lower = word_text.lower()
        
        # Only mark as label if it's an EXACT match or very close
        return any(keyword == word_lower or keyword in word_lower for keyword in label_keywords)
    
    field_map = {
        "invoice_number": "invoiceNumber",
        "invoice_date": "invoiceDate",
        "due_date": "dueDate",
        "vendor_name": "vendor",
        "vendor_address": "vendorAddress",
        "purchase_order": "purchaseOrder",
        "account_number": "accountNumber",
        "total_amount": "total",
        "currency": "currency",
    }
    
    boxes = []
    
    # Diagnostic output
    print("="*60, flush=True)
    print("🔍 DIAGNOSTIC OUTPUT:", flush=True)
    total_words = sum(len(page.get("words", [])) for page in pages)
    print(f"Total pages: {len(pages)}", flush=True)
    print(f"Total words extracted: {total_words}", flush=True)
    print(f"Fields from LLM: {list(parsed_result.keys())}", flush=True)
    for page_idx, page in enumerate(pages):
        print(f"  Page {page_idx + 1}: {page.get('width', '?')} x {page.get('height', '?')} px, {len(page.get('words', []))} words", flush=True)
    print("="*60, flush=True)
    
    # Fields to skip for bounding boxes
    SKIP_FIELDS = ['currency', 'line_items', 'email_from', 'email_to', 'additional_info']
    
    for api_field, front_field in field_map.items():
        # Skip certain fields
        if api_field in SKIP_FIELDS:
            continue
        
        raw_value = parsed_result.get(api_field)
        field_value_str = _to_scalar_text(raw_value).strip()
        
        if not field_value_str:
            continue
        
        # Skip currency if it's just a symbol (will be in total_amount anyway)
        if api_field == 'currency' and len(field_value_str) <= 1:
            continue
        
        field_tokens = tokenize(field_value_str)
        
        if not field_tokens:
            continue
        
        print(f"🔍 Looking for {api_field}: '{field_value_str}'", flush=True)
        
        found = False
        
        for page_index, page in enumerate(pages):
            words = page.get("words", [])
            if not words:
                continue
            
            page_w = max(page.get("width", 1), 1)
            page_h = max(page.get("height", 1), 1)
            
            # Special handling for address fields using address finder
            if api_field in ['vendor_address', 'customer_address', 'billing_address', 'shipping_address']:
                matched_tokens = find_address_tokens(words, field_value_str)
                
                if matched_tokens:
                    print(f"   ✓ FOUND address on page {page_index + 1}: {len(matched_tokens)} tokens", flush=True)
                    print(f"     Tokens: {[t['text'] for t in matched_tokens]}", flush=True)
                    
                    # Create bounding box from address tokens
                    xs0, xs1, ys0, ys1 = [], [], [], []
                    
                    for t in matched_tokens:
                        x0 = t.get('x0', 0)
                        x1 = t.get('x1', 0)
                        if "y0" in t and "y1" in t:
                            y0 = t.get("y0", 0)
                            y1 = t.get("y1", 0)
                        else:
                            top_val = t.get("top", 0)
                            bottom_val = t.get("bottom", 0)
                            y1 = page_h - top_val
                            y0 = page_h - bottom_val
                        xs0.append(x0)
                        xs1.append(x1)
                        ys0.append(y0)
                        ys1.append(y1)
                    
                    x0 = min(xs0)
                    x1 = max(xs1)
                    y0 = min(ys0)
                    y1 = max(ys1)
                    
                    # Add padding
                    padding_x = (x1 - x0) * 0.05
                    padding_y = (y1 - y0) * 0.1
                    
                    x0 = max(0, x0 - padding_x)
                    y0 = max(0, y0 - padding_y)
                    x1 = min(page_w, x1 + padding_x)
                    y1 = min(page_h, y1 + padding_y)
                    
                    # Convert to top-left origin
                    y_canvas = page_h - y1
                    
                    box = {
                        'field': front_field,
                        'page': page_index + 1,
                        'x': x0 / page_w,
                        'y': y_canvas / page_h,
                        'width': (x1 - x0) / page_w,
                        'height': (y1 - y0) / page_h,
                        'normalized': True
                    }
                    
                    boxes.append(box)
                    print(f"     Box: x={box['x']:.3f}, y={box['y']:.3f}, w={box['width']:.3f}, h={box['height']:.3f}", flush=True)
                    found = True
                    break
            
            if found:
                break
            
            best_match = None
            best_match_score = 0
            
            # Search for matching tokens (for non-address fields)
            for i in range(len(words)):
                matched_tokens = []
                value_only_tokens = []  # Track tokens that are VALUE, not labels
                
                # Try to match consecutive tokens
                for j, field_token in enumerate(field_tokens):
                    if i + j >= len(words):
                        break
                    
                    word = words[i + j]
                    word_text = word.get('text', '')
                    
                    # Check if this word matches the field token
                    if normalize(field_token) in normalize(word_text) or \
                       normalize(word_text) in normalize(field_token):
                        
                        matched_tokens.append(word)
                        
                        # Only include if it's NOT a label word (pass field name for special handling)
                        if not is_label_word(word_text, api_field):
                            value_only_tokens.append(word)
                    else:
                        break
                
                # Score this match (prefer more VALUE tokens, fewer total tokens)
                if value_only_tokens:
                    # Score = (value tokens found) - (label tokens penalty)
                    value_token_count = len(value_only_tokens)
                    label_token_count = len(matched_tokens) - len(value_only_tokens)
                    score = value_token_count - (label_token_count * 0.5)
                    
                    if score > best_match_score:
                        best_match_score = score
                        best_match = {
                            'all_tokens': matched_tokens,
                            'value_tokens': value_only_tokens,  # USE ONLY THESE!
                            'start_idx': i
                        }
            
            # If we found a match, create bounding box from VALUE tokens only
            if best_match and best_match['value_tokens']:
                value_tokens = best_match['value_tokens']
                
                print(f"   ✓ FOUND on page {page_index + 1}: '{' '.join([t['text'] for t in best_match['all_tokens']])}'", flush=True)
                print(f"     VALUE tokens only: {[t['text'] for t in value_tokens]}", flush=True)
                
                # Merge bounding boxes of VALUE tokens only (not labels!)
                xs0 = []
                xs1 = []
                ys0 = []
                ys1 = []
                
                for t in value_tokens:
                    x0 = t.get('x0', 0)
                    x1 = t.get('x1', 0)
                    if "y0" in t and "y1" in t:
                        y0 = t.get("y0", 0)
                        y1 = t.get("y1", 0)
                    else:
                        top_val = t.get("top", 0)
                        bottom_val = t.get("bottom", 0)
                        y1 = page_h - top_val
                        y0 = page_h - bottom_val
                    xs0.append(x0)
                    xs1.append(x1)
                    ys0.append(y0)
                    ys1.append(y1)
                
                x0 = min(xs0)
                x1 = max(xs1)
                y0 = min(ys0)
                y1 = max(ys1)
                
                # Add padding
                padding_x = (x1 - x0) * 0.05
                padding_y = (y1 - y0) * 0.1
                
                x0 = max(0, x0 - padding_x)
                y0 = max(0, y0 - padding_y)
                x1 = min(page_w, x1 + padding_x)
                y1 = min(page_h, y1 + padding_y)
                
                # Convert to top-left origin for canvas
                y_canvas = page_h - y1
                
                # Normalize to 0-1 coordinates
                box = {
                    'field': front_field,
                    'page': page_index + 1,
                    'x': x0 / page_w,
                    'y': y_canvas / page_h,
                    'width': (x1 - x0) / page_w,
                    'height': (y1 - y0) / page_h,
                    'normalized': True
                }
                
                boxes.append(box)
                print(f"     Box: x={box['x']:.3f}, y={box['y']:.3f}, w={box['width']:.3f}, h={box['height']:.3f}", flush=True)
                found = True
                break
        
        if not found:
            print(f"   ✗ NOT FOUND: {api_field} = '{field_value_str}'", flush=True)
    
    print(f"[extract] boxes={len(boxes)}", flush=True)
    return boxes



app = FastAPI(title="Invoice Extractor API")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
) 

def query_invoice_ollama(text, custom_prompt):
    safe_text = text[:10000]
    print(f"🔍 Ollama input: {len(safe_text)} chars (truncated from {len(text)})", flush=True)
    system_prompt = f"""
    You are an expert invoice parser. 
    Given the text of an invoice, extract ALL key details and return them as JSON.
    
    CRITICAL RULES - READ CAREFULLY:
    1. Return values EXACTLY as they appear in the PDF text - do not reformat or change anything
    2. For dates: Copy the EXACT format shown (e.g., "January 25, 2016" NOT "2016-01-25")
    3. For addresses: Only include address lines, NOT other fields mixed in
    4. For amounts: Include currency symbol if present (e.g., "$93.50" not "93.50")
    5. Do NOT include field labels in the values (e.g., "Invoice Number: INV-123" should return "INV-123" only)
    6. If you cannot find a value for any field, return null (not empty string)
    
    REQUIRED FIELDS - Extract all of these:
    
    1. invoice_number: The unique invoice/bill identifier (e.g., "INV-123", "F2019-0006224", "Bill #456"). 
       Look for: Invoice Number, Invoice #, Bill Number, Reference Number, Document Number.
       Return ONLY the number, NOT the label.
    
    2. invoice_date: The date when the invoice was issued (EXACTLY as shown in PDF).
       Look for: Invoice Date, Issue Date, Date, Billing Date.
       Return the date in the EXACT format found in PDF (e.g., "January 25, 2016").
       NOT a date range, service period, or due date.
    
    3. due_date: The payment due date (EXACTLY as shown in PDF).
       Look for: Due Date, Payment Due, Pay By Date, Payment Deadline.
       Return in the EXACT format found in PDF (e.g., "January 31, 2016").
    
    4. vendor_name: The company/person issuing the invoice (the seller/service provider). Name ONLY.
       Look for: From, Vendor, Supplier, Billed By, Company Name (at the top/header).
       Do NOT include order numbers or other information.
    
    5. vendor_address: The FULL address of the vendor/supplier (address lines ONLY).
       Look for: Address, Street, City, Postal Code, Country (near vendor name).
       Include complete address with street, city, zip/postal code.
       Do NOT include dates, invoice numbers, or other fields mixed in.
    
    6. purchase_order: Purchase Order number if mentioned (e.g., "PO-12345", "PO#456").
       Look for: PO, Purchase Order, PO Number, Order Number, Reference.
       Return ONLY the number, NOT the label.
    
    7. account_number: Customer account number or bank account if mentioned (e.g., "ACC # 1234 1234 BSB # 4321 432").
       Look for: Account Number, Customer ID, Client Number, Account #, ACC #, BSB #.
       Return the COMPLETE account info including "ACC" and "BSB" labels.
    
    8. line_items: List of items/services with descriptions and amounts.
       Extract as an array of objects with: description, quantity, unit_price, amount.
    
    9. total_amount: The final TOTAL amount to be paid (with currency symbol if present, e.g., "$1500.00").
       Look for: Total, Grand Total, Amount Due, Final Amount, Balance Due.
       Include currency symbol if shown.
    
    10. currency: The currency symbol (e.g., "$", "€", "£") or code if explicitly written.
        Look for: Currency symbols or currency codes.
        Return ONLY the symbol or code.
        
    Additional instructions: {custom_prompt}
    """

    response = ollama.chat(
        model="qwen2.5:3b", 
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": safe_text}
        ],
        format="json",        # <--- Forces valid JSON (prevents "I can't do that" chat responses)
        keep_alive="5m",      # <--- Keeps model loaded so 2nd invoice is fast
        options={
            "num_ctx": 4096,     # <--- CRITICAL: Doubles memory capacity
            "temperature": 0.1,  # <--- CRITICAL: Forces factual/consistent extraction
            "num_predict": 1000  # <--- CRITICAL: Prevents cutting off halfway
        }
    )
    return response['message']['content']


def clean_llm_extraction(fields, pdf_text):
    """
    Clean up LLM output to ensure values match PDF text exactly.
    Fixes common LLM errors like reformatted dates, mixed fields, arrays, etc.
    """
    import re
    import ast
    
    cleaned = {}
    
    for field_name, field_value in fields.items():
        if not field_value:
            cleaned[field_name] = field_value
            continue
        
        value = str(field_value).strip()
        
        # Handle address arrays from Mistral (e.g., ['Suite 5A-1204', '123 Somewhere Street'])
        if field_name in ['vendor_address', 'customer_address', 'billing_address', 'shipping_address']:
            if value.startswith('['):
                try:
                    addr_list = ast.literal_eval(value)
                    value = ' '.join([str(part).strip() for part in addr_list if part])
                except:
                    value = value.replace('[', '').replace(']', '').replace("'", '').replace('"', '')
                    value = re.sub(r',\s*', ' ', value)
        
        # Fix 1: Remove field labels from values
        label_patterns = [
            r'^invoice\s+number\s*:?\s*',
            r'^order\s+number\s*:?\s*',
            r'^bill\s+number\s*:?\s*',
            r'^invoice\s+date\s*:?\s*',
            r'^due\s+date\s*:?\s*',
            r'^total\s*:?\s*',
            r'^vendor\s*:?\s*',
            r'^from\s*:?\s*',
            r'^address\s*:?\s*',
            r'^purchase\s+order\s*:?\s*',
            r'^account\s+number\s*:?\s*',
            r'^currency\s*:?\s*',
        ]
        for pattern in label_patterns:
            value = re.sub(pattern, '', value, flags=re.IGNORECASE).strip()
        
        # Fix 2: For dates, try to find the actual date format in PDF
        if field_name in ['invoice_date', 'due_date']:
            # If LLM returned "2016-01-25" but PDF has "January 25, 2016", fix it
            date_matches = re.findall(r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}', pdf_text)
            if date_matches and not re.match(r'\w+ \d+,? \d{4}', value):
                # LLM didn't return proper date format, use from PDF
                if field_name == 'invoice_date' and len(date_matches) >= 1:
                    value = date_matches[0]
                elif field_name == 'due_date' and len(date_matches) >= 2:
                    value = date_matches[1]
                elif len(date_matches) >= 1:
                    value = date_matches[0]
        
        # Fix 3: Clean vendor name - remove order number if mistakenly included
        if field_name == 'vendor_name':
            value = re.sub(r'\s+order\s+number\s+\d+.*$', '', value, flags=re.IGNORECASE)
            value = re.sub(r'\s+po\s*#?\s*\d+.*$', '', value, flags=re.IGNORECASE)
        
        # Fix 4: Clean vendor address - remove dates and other fields
        if field_name == 'vendor_address':
            # Remove dates
            value = re.sub(r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}', '', value, flags=re.IGNORECASE)
            # Remove "Invoice Date", "Due Date" labels and their content
            value = re.sub(r'invoice\s+date|due\s+date|due', '', value, flags=re.IGNORECASE)
            # Remove PO numbers if mixed in
            value = re.sub(r'p\.o\.|po\s*#?\s*\d+', '', value, flags=re.IGNORECASE)
            # Clean up extra spaces
            value = re.sub(r'\s+', ' ', value).strip()
        
        # Fix 5: Currency - if LLM returned text but PDF has symbol, extract symbol
        if field_name == 'currency':
            if value and len(value) > 1 and value.upper() in ['USD', 'EUR', 'GBP', 'AUD', 'CAD']:
                # LLM returned currency code but PDF might have symbol
                if '$' in pdf_text:
                    value = '$'
                elif '€' in pdf_text:
                    value = '€'
                elif '£' in pdf_text:
                    value = '£'
        
        cleaned[field_name] = value if value else None
    
    return cleaned


@app.post("/extract-invoice")
async def extract_invoice(
    file: UploadFile = File(...),
    custom_prompt: str = Form("Extract all invoice fields including invoice number, date, due date, vendor name and address, purchase order, account number, line items, total amount, and currency.")
):
    start_time = time.time()
    print(f"\n{'='*60}", flush=True)
    print(f"📄 NEW EXTRACTION REQUEST", flush=True)
    print(f"{'='*60}", flush=True)
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
        
    try:
        print(f"📂 Extracting text from PDF: {tmp_path}", flush=True)
        text, pages = extract_pdf_content(tmp_path)
        print(f"✅ Extracted {len(text)} characters from {len(pages)} pages", flush=True)
        print(f"📝 First 200 chars: {text[:200]}", flush=True)
        
        print(f"🤖 Calling Ollama with mistral:7b...", flush=True)
        result = query_invoice_ollama(text, custom_prompt)
        print(f"✅ Ollama returned {len(result)} characters", flush=True)
        print(f"📝 Raw result: {result[:500]}", flush=True)
        
        # Clean up the result - remove markdown code blocks if present
        cleaned_result = result.strip()
        if cleaned_result.startswith("```json"):
            cleaned_result = cleaned_result[7:]
        elif cleaned_result.startswith("```"):
            cleaned_result = cleaned_result[3:]
        if cleaned_result.endswith("```"):
            cleaned_result = cleaned_result[:-3]
        cleaned_result = cleaned_result.strip()
        
        print(f"🧹 Cleaned result: {cleaned_result[:500]}", flush=True)
        
        try: 
            parsed_result = json.loads(cleaned_result)
            print(f"✅ JSON parsed successfully. Fields: {list(parsed_result.keys())}", flush=True)
        except Exception as e:
            print(f"❌ JSON parse error: {e}", flush=True)
            parsed_result = {"raw_output": result, "parse_error": str(e)}

        # 👇 CLEAN UP LLM OUTPUT before finding boxes
        if "parse_error" not in parsed_result:
            parsed_result = clean_llm_extraction(parsed_result, text)

        # Derive bounding boxes for extracted fields (best-effort)
        boxes = find_boxes_for_fields(parsed_result, pages)
        words_per_page = [len(p.get("words", [])) for p in pages]
        print(f"[extract] boxes={len(boxes)} words_per_page={words_per_page} fields={list(parsed_result.keys())}")

        elapsed = round(time.time() - start_time, 2)
        parsed_result["execution_time_seconds"] = elapsed
        parsed_result["boxes"] = boxes
        parsed_result["boxes_count"] = len(boxes)
        parsed_result["words_per_page"] = words_per_page
        
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