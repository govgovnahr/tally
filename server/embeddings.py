import os
import uuid
import logging
import threading
from datetime import datetime

from database import get_connection

logger = logging.getLogger("budget_app")

EMBEDDING_MODEL = "text-embedding-3-small"
# 100 texts per OpenAI request — the API allows up to 2048 but 100 keeps payloads
# manageable and still cuts API calls by ~100x vs. one-per-row.
BATCH_SIZE = 100

# Prevents concurrent startup calls (e.g. Render spinning up multiple workers)
# from racing on the embeddings table and double-billing OpenAI.
_backfill_lock = threading.Lock()


def _get_openai_client():
    import openai
    return openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])


def embed_texts_batch(texts):
    """Embed a list of texts in a single API call. Use this for bulk operations."""
    client = _get_openai_client()
    response = client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
    vectors = []
    for item in response.data:
        vectors.append(item.embedding)
    return vectors


def embed_text(text):
    """Embed a single text. Thin wrapper over embed_texts_batch for query-time use."""
    return embed_texts_batch([text])[0]


def _vector_to_sql_str(vector):
    parts = []
    for v in vector:
        parts.append(str(v))
    return "[" + ",".join(parts) + "]"


def _format_expense_content(row):
    return row["name"] + " " + row["type"] + " " + str(round(row["amount"], 2)) + " " + row["date"]


def _format_income_content(row):
    return "income " + row["name"] + " " + str(round(row["amount"], 2)) + " " + row["date"]


def _format_goal_content(row):
    return "savings goal " + row["name"] + " " + row["goal_type"] + " target " + str(round(row["target"], 2))


def upsert_embedding(conn, source_type, source_id, user_id, content, vector):
    """Write a pre-computed embedding to the DB. Embedding happens outside this function
    so callers can batch API calls before writing."""
    vector_str = _vector_to_sql_str(vector)
    now = datetime.now().isoformat()
    new_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO transaction_embeddings "
        "(id, source_type, source_id, user_id, content, embedding, created_at) "
        "VALUES (%s, %s, %s, %s, %s, %s::vector, %s) "
        "ON CONFLICT (source_type, source_id) "
        "DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding",
        (new_id, source_type, source_id, user_id, content, vector_str, now),
    )


def search_similar(conn, user_id, query_text, limit=5):
    query_vector = embed_text(query_text)
    query_vector_str = _vector_to_sql_str(query_vector)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT source_type, source_id, content, "
        "embedding <=> %s::vector AS distance "
        "FROM transaction_embeddings "
        "WHERE user_id = %s "
        "ORDER BY distance ASC "
        "LIMIT %s",
        (query_vector_str, user_id, limit),
    )
    results = []
    for row in cursor.fetchall():
        results.append({
            "source_type": row["source_type"],
            "source_id": row["source_id"],
            "content": row["content"],
            "distance": round(row["distance"], 4),
        })
    return results


def _get_embedded_ids(conn, user_id, source_type):
    cursor = conn.cursor()
    cursor.execute(
        "SELECT source_id FROM transaction_embeddings "
        "WHERE user_id = %s AND source_type = %s",
        (user_id, source_type),
    )
    embedded = set()
    for row in cursor.fetchall():
        embedded.add(row["source_id"])
    return embedded


def _embed_batch(conn, rows, source_type, user_id, format_fn):
    already_embedded = _get_embedded_ids(conn, user_id, source_type)

    pending = []
    for row in rows:
        if row["id"] not in already_embedded:
            pending.append(row)

    count = 0
    idx = 0
    while idx < len(pending):
        batch = pending[idx: idx + BATCH_SIZE]

        # Build all content strings first so we can embed the whole batch in one API call.
        # Before this change: 1 API call per row. Now: 1 call per BATCH_SIZE rows.
        contents = []
        for row in batch:
            contents.append(format_fn(row))

        vectors = embed_texts_batch(contents)

        for j, row in enumerate(batch):
            upsert_embedding(conn, source_type, row["id"], user_id, contents[j], vectors[j])
            count += 1

        conn.commit()
        idx += BATCH_SIZE
    return count


def backfill_embeddings(conn, user_id):
    """Embed all un-embedded expenses, incomes, and savings goals for one user."""
    cursor = conn.cursor()

    cursor.execute("SELECT id, name, amount, type, date FROM expenses WHERE user_id = %s", (user_id,))
    exp_rows = cursor.fetchall()
    exp_count = _embed_batch(conn, exp_rows, "expense", user_id, _format_expense_content)

    cursor.execute("SELECT id, name, amount, date FROM incomes WHERE user_id = %s", (user_id,))
    inc_rows = cursor.fetchall()
    inc_count = _embed_batch(conn, inc_rows, "income", user_id, _format_income_content)

    cursor.execute("SELECT id, name, goal_type, target FROM savings_goals WHERE user_id = %s", (user_id,))
    goal_rows = cursor.fetchall()
    goal_count = _embed_batch(conn, goal_rows, "goal", user_id, _format_goal_content)

    return exp_count + inc_count + goal_count


def delete_user_embeddings(conn, user_id: str) -> int:
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM transaction_embeddings WHERE user_id = %s", (user_id,)
    )
    count = cursor.rowcount
    conn.commit()
    return count


def backfill_all_users(conn):
    """
    Called at startup to embed rows that existed before the AI layer was added.
    Uses a lock so a multi-worker Render deploy doesn't double-embed the same rows.
    Skips users who have opted out of AI features.
    """
    from database import get_user_settings

    with _backfill_lock:
        cursor = conn.cursor()

        user_ids = set()
        for table in ["expenses", "incomes", "savings_goals"]:
            cursor.execute(
                "SELECT DISTINCT user_id FROM " + table + " WHERE user_id IS NOT NULL"
            )
            for row in cursor.fetchall():
                user_ids.add(row["user_id"])

        total = 0
        skipped = 0
        for uid in user_ids:
            user_conn = get_connection()
            try:
                settings = get_user_settings(user_conn, uid)
                if not settings["ai_enabled"]:
                    skipped += 1
                    continue
                count = backfill_embeddings(user_conn, uid)
                total += count
            except Exception as e:
                logger.warning("Backfill failed for user %s: %s", uid, str(e))
            finally:
                user_conn.close()

        logger.info(
            "Embedding backfill complete: %d new embeddings across %d users (%d opted out)",
            total, len(user_ids) - skipped, skipped,
        )
