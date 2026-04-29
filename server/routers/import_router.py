import csv
import io
import json
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from database import get_connection
from auth import get_current_user

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


def _infer_type(name: str, valid_types: list[str], rules: list[tuple] = []) -> str:
    name_lower = name.lower()
    for pattern, expense_type in rules:
        if pattern.lower() in name_lower:
            matched = _soft_match_type(expense_type, valid_types)
            if matched:
                return matched

    KEYWORDS = {
        "food": ["restaurant", "food", "grocery", "groceries", "cafe", "coffee", "lunch", "dinner",
                 "breakfast", "pizza", "burger", "sushi", "diner", "bakery", "donut", "sandwich"],
        "transport": ["uber", "lyft", "gas", "fuel", "parking", "transit", "metro", "bus", "train",
                      "airline", "flight", "taxi", "toll", "shell", "chevron", "bp", "car"],
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
            matched = _soft_match_type(category, valid_types)
            if not matched:
                matched = next((v for v in valid_types if category in v.lower()), None)
            if matched:
                return matched
    return next((v for v in valid_types if v.lower() == "other"), None) or (valid_types[0] if valid_types else "Other")


INCOME_SIGNALS = {"credit", "cr", "income", "deposit", "refund", "payment received"}
EXPENSE_SIGNALS = {"debit", "dr", "expense", "withdrawal", "purchase", "charge"}


def _determine_record_type(amount_raw: float, record_type_col_val: str) -> str:
    if record_type_col_val:
        val = record_type_col_val.strip().lower()
        if any(s in val for s in INCOME_SIGNALS):
            return "income"
        if any(s in val for s in EXPENSE_SIGNALS):
            return "expense"
    return "expense" if amount_raw < 0 else "income"


def _get_raw_rows(content: bytes, filename: str, sheet_name: Optional[str] = None) -> list[list[str]]:
    lower = filename.lower()
    if lower.endswith(".csv"):
        return _parse_csv(content)
    elif lower.endswith((".xlsx", ".xls")):
        return _parse_xlsx(content, sheet_name)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Upload a .csv or .xlsx file.")


@router.get("/import/infer-type")
def infer_type_endpoint(
    name: str = Query(..., description="Transaction name/description to categorize"),
    user_id: str = Depends(get_current_user),
):
    with get_connection() as conn:
        valid_types = [r["name"] for r in conn.execute(
            "SELECT name FROM expense_types WHERE user_id = %s ORDER BY sort_order", (user_id,)
        ).fetchall()]
        rules = conn.execute(
            "SELECT pattern, expense_type FROM import_rules WHERE user_id = %s", (user_id,)
        ).fetchall()
    if not valid_types:
        return {"type": "Other"}
    return {"type": _infer_type(name, valid_types, rules)}


_DEFAULT_COLORS = [
    "#e8a87c", "#82b4e0", "#c49ee8", "#f0c040", "#80cbc4", "#a0a0a0",
    "#ef9a9a", "#90caf9", "#a5d6a7", "#ffcc80", "#ce93d8", "#f48fb1",
    "#ff8a65", "#4db6ac", "#7986cb", "#aed581",
]
_DEFAULT_ICON = "Category"


@router.post("/import/budgets")
async def import_budgets(
    file: UploadFile = File(...),
    mapping: str = Form(...),
    header_row: int = Form(...),
    sheet_name: Optional[str] = Form(None),
    target_month: Optional[str] = Form(None),
    user_id: str = Depends(get_current_user),
):
    mapping_dict = json.loads(mapping)
    cat_col = mapping_dict.get("category", "")
    limit_col = mapping_dict.get("monthly_limit", "")
    month_col = mapping_dict.get("month", "")

    content = await file.read()
    raw_rows = _get_raw_rows(content, file.filename, sheet_name)
    _, data_rows = _rows_to_dicts(raw_rows, header_row)

    aggregated: dict[tuple, float] = {}
    display_name: dict[str, str] = {}
    errors = []
    skipped = 0

    for i, row in enumerate(data_rows, start=header_row + 2):
        cat_raw = row.get(cat_col, "").strip()
        limit_raw = row.get(limit_col, "").strip().replace(",", "").lstrip("$").lstrip("-").strip()
        month_raw = row.get(month_col, "").strip() if month_col else ""

        if not cat_raw:
            errors.append({"row": i, "reason": "Missing category"})
            skipped += 1
            continue

        try:
            limit_val = float(limit_raw)
        except ValueError:
            errors.append({"row": i, "reason": f"Invalid amount: '{row.get(limit_col, '')}'"})
            skipped += 1
            continue

        if target_month:
            month_key = target_month
        elif month_raw:
            try:
                month_key = _parse_date(month_raw)[:7]
            except ValueError:
                errors.append({"row": i, "reason": f"Invalid month: '{month_raw}'"})
                skipped += 1
                continue
        else:
            month_key = None

        norm = cat_raw.lower()
        display_name.setdefault(norm, cat_raw)
        key = (norm, month_key)
        aggregated[key] = aggregated.get(key, 0.0) + limit_val

    conn = get_connection()
    cursor = conn.cursor()

    existing = {r["name"].lower(): r["name"]
                for r in cursor.execute("SELECT name FROM expense_types WHERE user_id = %s", (user_id,)).fetchall()}
    used_colors = {r["color"] for r in cursor.execute("SELECT color FROM expense_types WHERE user_id = %s", (user_id,)).fetchall()}

    new_categories = {norm for norm, _ in aggregated} - existing.keys()
    available_colors = [c for c in _DEFAULT_COLORS if c not in used_colors] or _DEFAULT_COLORS
    for idx, norm in enumerate(sorted(new_categories)):
        name = display_name[norm]
        color = available_colors[idx % len(available_colors)]
        sort_order = cursor.execute("SELECT COALESCE(MAX(sort_order)+1, 0) AS sort_order FROM expense_types WHERE user_id = %s", (user_id,)).fetchone()["sort_order"]
        cursor.execute(
            "INSERT INTO expense_types (id, name, color, icon, sort_order, user_id) VALUES (%s,%s,%s,%s,%s,%s)",
            (str(uuid.uuid4()), name, color, _DEFAULT_ICON, sort_order, user_id),
        )
        existing[norm] = name

    imported = 0
    for (norm, month_key), total in aggregated.items():
        type_name = existing[norm]
        if month_key:
            cursor.execute(
                "INSERT INTO monthly_budgets (user_id, type, month, monthly_limit) VALUES (%s,%s,%s,%s) ON CONFLICT (user_id, type, month) DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit",
                (user_id, type_name, month_key, total),
            )
        else:
            cursor.execute(
                "INSERT INTO budgets (user_id, type, monthly_limit) VALUES (%s,%s,%s) ON CONFLICT (user_id, type) DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit",
                (user_id, type_name, total),
            )
        imported += 1

    conn.commit()
    conn.close()
    return {"imported": imported, "skipped": skipped, "errors": errors}


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
    user_id: str = Depends(get_current_user),
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
    cursor.execute("SELECT name FROM expense_types WHERE user_id = %s", (user_id,))
    valid_types = [r["name"] for r in cursor.fetchall()]
    cursor.execute("SELECT pattern, expense_type FROM import_rules WHERE user_id = %s", (user_id,))
    rules = [(r["pattern"], r["expense_type"]) for r in cursor.fetchall()]

    imported = 0
    errors = []
    savings_expenses = []

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

            record_type_col_val = row.get(col_map.get("record_type", ""), "") if col_map.get("record_type") else ""
            row_type = _determine_record_type(amount_float, record_type_col_val)

            new_id = str(uuid.uuid4())
            now = datetime.now().isoformat()

            if row_type == "expense":
                raw_type = row.get(col_map.get("type", ""), "").strip() if col_map.get("type") else ""

                if raw_type and raw_type.lower() == "savings":
                    if "Savings" not in valid_types:
                        cursor.execute(
                            "INSERT INTO expense_types (id, name, color, icon, sort_order, is_default, user_id) VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (user_id, name) DO NOTHING",
                            (str(uuid.uuid4()), "Savings", "#8fb996", "Savings", 99, 1, user_id),
                        )
                        valid_types.append("Savings")
                    expense_type = "Savings"
                elif raw_type:
                    expense_type = _soft_match_type(raw_type, valid_types) or _infer_type(name, valid_types, rules)
                else:
                    expense_type = _infer_type(name, valid_types, rules)

                cursor.execute(
                    "INSERT INTO expenses (id, name, amount, type, date, created_at, is_recurring, user_id) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                    (new_id, name, amount, expense_type, date_str, now, is_recurring, user_id),
                )

                if expense_type == "Savings":
                    savings_expenses.append({"id": new_id, "name": name, "amount": amount, "date": date_str})
            else:
                cursor.execute(
                    "INSERT INTO incomes (id, name, amount, date, created_at, is_recurring, user_id) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                    (new_id, name, amount, date_str, now, is_recurring, user_id),
                )

            imported += 1

        except (ValueError, KeyError, TypeError) as e:
            errors.append({"row": i, "reason": str(e)})

    conn.commit()
    conn.close()

    return {"imported": imported, "skipped": len(errors), "errors": errors, "savings_expenses": savings_expenses}
