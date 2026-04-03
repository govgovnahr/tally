import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from database import get_connection
from models import NewMacrocategory

router = APIRouter()


@router.get("/macrocategories")
def get_macrocategories():
    conn = get_connection()
    rows = conn.execute("SELECT * FROM macrocategories ORDER BY name").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/macrocategories", status_code=201)
def create_macrocategory(body: NewMacrocategory):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    conn = get_connection()
    if conn.execute("SELECT id FROM macrocategories WHERE name = ?", (name,)).fetchone():
        conn.close()
        raise HTTPException(status_code=409, detail="A macrocategory with that name already exists.")
    new_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO macrocategories (id, name, color, budget_limit) VALUES (?,?,?,?)",
        (new_id, name, body.color, body.budget_limit),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM macrocategories WHERE id = ?", (new_id,)).fetchone()
    conn.close()
    return dict(row)


# Named routes must come before /{macro_id} to avoid param collision
@router.get("/macrocategories/summary")
def get_macrocategory_summary(month: Optional[str] = Query(None)):
    conn = get_connection()
    macros = {r["id"]: dict(r) for r in conn.execute("SELECT * FROM macrocategories").fetchall()}
    if not macros:
        conn.close()
        return []

    if month:
        rows = conn.execute("""
            SELECT et.macrocategory_id, SUM(e.amount) as total, COUNT(*) as count
            FROM expenses e
            JOIN expense_types et ON e.type = et.name
            WHERE et.macrocategory_id IS NOT NULL
              AND strftime('%Y-%m', e.date) = ?
            GROUP BY et.macrocategory_id
        """, (month,)).fetchall()
    else:
        rows = conn.execute("""
            SELECT et.macrocategory_id, SUM(e.amount) as total, COUNT(*) as count
            FROM expenses e
            JOIN expense_types et ON e.type = et.name
            WHERE et.macrocategory_id IS NOT NULL
            GROUP BY et.macrocategory_id
        """).fetchall()
    conn.close()

    spending = {r["macrocategory_id"]: {"total": r["total"], "count": r["count"]} for r in rows}
    return [
        {
            **macros[mid],
            "total": round(spending.get(mid, {}).get("total", 0), 2),
            "count": spending.get(mid, {}).get("count", 0),
        }
        for mid in macros
    ]


@router.put("/macrocategories/{macro_id}")
def update_macrocategory(macro_id: str, body: NewMacrocategory):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    conn = get_connection()
    if not conn.execute("SELECT id FROM macrocategories WHERE id = ?", (macro_id,)).fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Macrocategory not found.")
    dup = conn.execute(
        "SELECT id FROM macrocategories WHERE name = ? AND id != ?", (name, macro_id)
    ).fetchone()
    if dup:
        conn.close()
        raise HTTPException(status_code=409, detail="A macrocategory with that name already exists.")
    conn.execute(
        "UPDATE macrocategories SET name = ?, color = ?, budget_limit = ? WHERE id = ?",
        (name, body.color, body.budget_limit, macro_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM macrocategories WHERE id = ?", (macro_id,)).fetchone()
    conn.close()
    return dict(row)


@router.delete("/macrocategories/{macro_id}")
def delete_macrocategory(macro_id: str):
    conn = get_connection()
    if not conn.execute("SELECT id FROM macrocategories WHERE id = ?", (macro_id,)).fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Macrocategory not found.")
    conn.execute("UPDATE expense_types SET macrocategory_id = NULL WHERE macrocategory_id = ?", (macro_id,))
    conn.execute("DELETE FROM macrocategories WHERE id = ?", (macro_id,))
    conn.commit()
    conn.close()
    return {"id": macro_id}
