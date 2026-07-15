import logging
import threading
from fastapi import APIRouter, Depends, HTTPException, Query
from database import get_connection, get_user_settings, save_user_settings, cycle_bounds, current_user_id
from models import SettingsUpdate
from auth import get_current_user

router = APIRouter()
logger = logging.getLogger("budget_app")


@router.get("/settings")
def get_settings(user_id: str = Depends(get_current_user)):
    conn = get_connection()
    try:
        return get_user_settings(conn, user_id)
    finally:
        conn.close()


@router.get("/settings/period-bounds")
def get_period_bounds(month: str, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    try:
        cycle_start_day = get_user_settings(conn, user_id)["cycle_start_day"]
    finally:
        conn.close()
    period_start, period_end = cycle_bounds(month, cycle_start_day)
    return {"month": month, "period_start": period_start, "period_end": period_end, "period_label": month}


@router.get("/settings/period-bounds-bulk")
def get_period_bounds_bulk(months: str = Query(...), user_id: str = Depends(get_current_user)):
    conn = get_connection()
    try:
        cycle_start_day = get_user_settings(conn, user_id)["cycle_start_day"]
    finally:
        conn.close()
    return [
        {"month": m, "period_start": ps, "period_end": pe}
        for m in months.split(",")
        for ps, pe in [cycle_bounds(m, cycle_start_day)]
    ]


@router.put("/settings")
def update_settings(body: SettingsUpdate, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    try:
        current = get_user_settings(conn, user_id)
        ai_enabled = body.ai_enabled if body.ai_enabled is not None else current["ai_enabled"]
        cycle_start_day = body.cycle_start_day if body.cycle_start_day is not None else current["cycle_start_day"]
        seen_category_migration_notice = (
            body.seen_category_migration_notice
            if body.seen_category_migration_notice is not None
            else current["seen_category_migration_notice"]
        )
        save_user_settings(conn, user_id, ai_enabled, cycle_start_day, seen_category_migration_notice)
        result = get_user_settings(conn, user_id)
    finally:
        conn.close()
    if body.ai_enabled is not None:
        if not body.ai_enabled:
            _delete_ai_data(user_id)
        else:
            threading.Thread(target=_backfill_user, args=(user_id,), daemon=True).start()
    return result


@router.delete("/settings/ai-data")
def delete_ai_data(user_id: str = Depends(get_current_user)):
    deleted = _delete_ai_data(user_id)
    return {"deleted": deleted}


def _backfill_user(user_id: str):
    # Runs in a plain background thread (threading.Thread, not an asyncio/
    # anyio task), which does NOT inherit the caller's contextvars.Context —
    # current_user_id would otherwise be unset here, so this thread's
    # get_connection() calls would run on the bypass-RLS role instead of
    # being scoped to `authenticated` for this user. backfill_embeddings
    # already takes user_id explicitly, so writes were always correctly
    # scoped even without this — this just restores the RLS backstop for
    # this one write path, consistent with every request-driven one.
    current_user_id.set(user_id)
    try:
        from embeddings import backfill_embeddings
        conn = get_connection()
        try:
            count = backfill_embeddings(conn, user_id)
            logger.info("Re-embedded %d records for user %s after AI re-enable", count, user_id)
        finally:
            conn.close()
    except Exception as e:
        logger.warning("Re-embed failed for user %s: %s", user_id, str(e))


def _delete_ai_data(user_id: str) -> int:
    try:
        from embeddings import delete_user_embeddings
        conn = get_connection()
        try:
            count = delete_user_embeddings(conn, user_id)
            logger.info("Deleted %d embeddings for user %s", count, user_id)
            return count
        finally:
            conn.close()
    except Exception as e:
        logger.warning("Failed to delete embeddings for user %s: %s", user_id, str(e))
        return 0
