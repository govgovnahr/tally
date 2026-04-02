import csv
import io
import json
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from database import get_connection

router = APIRouter()

HEADER_KEYWORDS = {
    "date", "amount", "description", "name", "total", "balance",
    "debit", "credit", "memo", "category", "type", "note", "notes",
    "payee", "merchant", "transaction", "reference",
}


def _cell_str(val) -> str:
    if val is None:
        return ""
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%d")
    return str(val).strip()


def _parse_csv(content: bytes) -> list[list[str]]:
    text = content.decode("utf-8-sig")
    reader = csv.reader(io.StringIO(text))
    return [[cell.strip() for cell in row] for row in reader]


def _xlsx_sheet_names(content: bytes) -> list[str]:
    from openpyxl import load_workbook
    wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    names = wb.sheetnames
    wb.close()
    return names


def _parse_xlsx(content: bytes, sheet_name: Optional[str] = None) -> list[list[str]]:
    from openpyxl import load_workbook
    wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb[sheet_name] if sheet_name and sheet_name in wb.sheetnames else wb.active
    rows = []
    for row in ws.iter_rows():
        rows.append([_cell_str(cell.value) for cell in row])
    wb.close()
    return rows


def _detect_header_row(rows: list[list[str]]) -> int:
    best_idx = 0
    best_score = -1
    for i, row in enumerate(rows):
        score = 0
        for cell in row:
            lower = cell.lower().replace(" ", "").replace("_", "").replace(".", "")
            if lower in HEADER_KEYWORDS:
                score += 3
            elif cell and not _is_numeric(cell):
                score += 1
        if score > best_score:
            best_score = score
            best_idx = i
    return best_idx


def _is_numeric(s: str) -> bool:
    try:
        float(s.replace(",", "").replace("$", "").replace("-", "").replace("(", "").replace(")", ""))
        return True
    except ValueError:
        return bool(not s)


def _rows_to_dicts(rows: list[list[str]], header_row: int) -> tuple[list[str], list[dict]]:
    if header_row >= len(rows):
        return [], []
    headers = rows[header_row]
    data_rows = rows[header_row + 1:]
    dicts = []
    for row in data_rows:
        if not any(cell for cell in row):
            continue
        padded = row + [""] * (len(headers) - len(row))
        dicts.append({headers[i]: padded[i] for i in range(len(headers))})
    return headers, dicts


def _parse_date(raw: str) -> str:
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%m-%d-%Y", "%d-%m-%Y", "%Y/%m/%d", "%m/%d/%y"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    raise ValueError(f"Invalid date: '{raw}'. Accepted formats: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY")


def _soft_match_type(raw: str, valid: list[str]) -> Optional[str]:
    for v in valid:
        if v.lower() == raw.lower():
            return v
    return None


def _infer_type(name: str, valid_types: list[str]) -> str:
    """Try to match a transaction name to an expense type by keyword, then fall back to 'Other' or first type."""
    KEYWORDS = {
        "food": ["restaurant", "food", "grocery", "groceries", "cafe", "coffee", "lunch", "dinner",
                 "breakfast", "pizza", "burger", "sushi", "diner", "bakery", "donut", "sandwich"],
        "transport": ["uber", "lyft", "gas", "fuel", "parking", "transit", "metro", "bus", "train",
                      "airline", "flight", "taxi", "toll", "shell", "chevron", "bp"],
        "housing": ["rent", "mortgage", "electric", "electricity", "water", "internet", "cable",
                    "utilities", "utility", "hoa", "insurance"],
        "health": ["pharmacy", "cvs", "walgreens", "doctor", "hospital", "medical", "dental",
                   "health", "gym", "fitness", "clinic", "optician"],
        "entertainment": ["netflix", "spotify", "hulu", "disney", "apple tv", "movie", "cinema",
                          "theater", "concert", "game", "steam", "xbox", "playstation"],
        "shopping": ["amazon", "walmart", "target", "costco", "store", "shop", "mall", "ebay"],
    }
    name_lower = name.lower()
    for category, keywords in KEYWORDS.items():
        if any(kw in name_lower for kw in keywords):
            # Try to find a valid type whose name contains this category word
            matched = _soft_match_type(category, valid_types)
            if not matched:
                matched = next((v for v in valid_types if category in v.lower()), None)
            if matched:
                return matched
    # Fall back to "Other" if it exists, else first type
    return next((v for v in valid_types if v.lower() == "other"), None) or (valid_types[0] if valid_types else "Other")


INCOME_SIGNALS = {"credit", "cr", "income", "deposit", "refund", "payment received"}
EXPENSE_SIGNALS = {"debit", "dr", "expense", "withdrawal", "purchase", "charge"}


def _determine_record_type(amount_raw: float, record_type_col_val: str) -> str:
    """Determine whether a row is 'expense' or 'income'."""
    if record_type_col_val:
        val = record_type_col_val.strip().lower()
        if any(s in val for s in INCOME_SIGNALS):
            return "income"
        if any(s in val for s in EXPENSE_SIGNALS):
            return "expense"
    # Fall back to sign: negative = expense, positive = income
    return "expense" if amount_raw < 0 else "income"


def _get_raw_rows(content: bytes, filename: str, sheet_name: Optional[str] = None) -> list[list[str]]:
    lower = filename.lower()
    if lower.endswith(".csv"):
        return _parse_csv(content)
    elif lower.endswith((".xlsx", ".xls")):
        return _parse_xlsx(content, sheet_name)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Upload a .csv or .xlsx file.")


@router.post("/import/preview")
async def preview_import(
    file: UploadFile = File(...),
    header_row: Optional[int] = Form(None),
    sheet_name: Optional[str] = Form(None),
):
    content = await file.read()
    lower = file.filename.lower()

    sheet_names = []
    if lower.endswith((".xlsx", ".xls")):
        sheet_names = _xlsx_sheet_names(content)

    raw_rows = _get_raw_rows(content, file.filename, sheet_name)
    detected = header_row if header_row is not None else _detect_header_row(raw_rows)
    headers, data_rows = _rows_to_dicts(raw_rows, detected)

    return {
        "headers": headers,
        "preview": data_rows[:3],
        "header_row": detected,
        "sheet_names": sheet_names,
    }


@router.post("/import")
async def import_records(
    file: UploadFile = File(...),
    mapping: str = Form(...),
    header_row: int = Form(...),
    sheet_name: Optional[str] = Form(None),
):
    try:
        col_map = json.loads(mapping)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid mapping JSON")

    content = await file.read()
    raw_rows = _get_raw_rows(content, file.filename, sheet_name)
    headers, data_rows = _rows_to_dicts(raw_rows, header_row)

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM expense_types")
    valid_types = [r["name"] for r in cursor.fetchall()]

    imported = 0
    errors = []

    for i, row in enumerate(data_rows, start=header_row + 2):
        try:
            name = row.get(col_map.get("name", ""), "").strip()
            if not name:
                raise ValueError("Name is empty")

            raw_amt = row.get(col_map.get("amount", ""), "")
            amount_float = float(str(raw_amt).replace(",", "").replace("$", "").replace("(", "-").replace(")", "").strip())
            if amount_float == 0:
                raise ValueError("Amount is zero")
            amount = round(abs(amount_float), 2)

            raw_date = row.get(col_map.get("date", ""), "").strip()
            date_str = _parse_date(raw_date)

            is_recurring = 0
            if col_map.get("is_recurring"):
                val = row.get(col_map["is_recurring"], "").strip().lower()
                is_recurring = 1 if val in ("1", "true", "yes", "y") else 0

            # Determine expense vs income per row
            record_type_col_val = row.get(col_map.get("record_type", ""), "") if col_map.get("record_type") else ""
            row_type = _determine_record_type(amount_float, record_type_col_val)

            new_id = str(uuid.uuid4())
            now = datetime.now().isoformat()

            if row_type == "expense":
                # Resolve expense type
                raw_type = row.get(col_map.get("type", ""), "").strip() if col_map.get("type") else ""
                if raw_type:
                    expense_type = _soft_match_type(raw_type, valid_types) or _infer_type(name, valid_types)
                else:
                    expense_type = _infer_type(name, valid_types)
                cursor.execute(
                    "INSERT INTO expenses (id, name, amount, type, date, created_at, is_recurring) VALUES (?,?,?,?,?,?,?)",
                    (new_id, name, amount, expense_type, date_str, now, is_recurring),
                )
            else:
                cursor.execute(
                    "INSERT INTO incomes (id, name, amount, date, created_at, is_recurring) VALUES (?,?,?,?,?,?)",
                    (new_id, name, amount, date_str, now, is_recurring),
                )

            imported += 1

        except (ValueError, KeyError, TypeError) as e:
            errors.append({"row": i, "reason": str(e)})

    conn.commit()
    conn.close()

    return {"imported": imported, "skipped": len(errors), "errors": errors}
