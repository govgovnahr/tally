import sys
import os
import time
import logging
import threading
from collections import defaultdict
from dotenv import load_dotenv

# Walk up from the server/ directory to find the project-root .env
_env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=os.path.abspath(_env_path))
import webbrowser
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from limiter import limiter, get_user_id_key
from database import get_connection, init_db, apply_recurring_expenses, apply_recurring_incomes, close_pool, current_user_id
import auth
from routers.auth_router import router as auth_router
from routers.ai_router import router as ai_router
from routers.expenses_router import router as expenses_router
from routers.budgets_router import router as budgets_router
from routers.types_router import router as types_router
from routers.incomes_router import router as incomes_router
from routers.import_router import router as import_router
from routers.import_rules_router import router as import_rules_router
from routers.macrocategories_router import router as macrocategories_router
from routers.savings_goals_router import router as savings_goals_router
from routers.analysis_router import router as analysis_router
from routers.settings_router import router as settings_router
from routers.dashboard_router import router as dashboard_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("budget_app")

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(GZipMiddleware, minimum_size=1000)

_allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def _cache_hashed_assets(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/assets/"):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return response


@app.middleware("http")
async def _bind_db_identity(request: Request, call_next):
    """
    Binds the requesting user's identity into database.current_user_id for
    the duration of this request, so get_connection() can switch the pooled
    connection to Postgres's `authenticated` role and RLS policies actually
    apply — see auth.resolve_identity_for_db and database.get_connection().
    Must wrap call_next (not run after it): the route's dependencies and the
    endpoint itself are each dispatched to the threadpool via their own
    contextvars.copy_context() snapshot, so the binding has to already be in
    place in this middleware's own context before call_next() triggers those
    dispatches, or none of them will see it.
    """
    user_id = auth.resolve_identity_for_db(request)
    token = current_user_id.set(user_id) if user_id is not None else None
    try:
        return await call_next(request)
    finally:
        if token is not None:
            current_user_id.reset(token)


_ip_fail_times: dict = defaultdict(list)
_ip_blocked_until: dict = {}
_IP_BLOCK_WINDOW = 300      # 5-minute sliding window
_IP_BLOCK_THRESHOLD = 5
_IP_BLOCK_DURATION = 300    # block length in seconds


@app.middleware("http")
async def _track_auth_failures(request: Request, call_next):
    ip = request.client.host if request.client else "unknown"
    now = time.time()

    unblock_at = _ip_blocked_until.get(ip)
    if unblock_at:
        if now < unblock_at:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many failed authentication attempts. Try again later."},
                headers={"Retry-After": str(int(unblock_at - now))},
            )
        del _ip_blocked_until[ip]
        _ip_fail_times.pop(ip, None)

    response = await call_next(request)

    if response.status_code == 401:
        window_start = now - _IP_BLOCK_WINDOW
        _ip_fail_times[ip] = [t for t in _ip_fail_times[ip] if t > window_start]
        _ip_fail_times[ip].append(now)
        if len(_ip_fail_times[ip]) >= _IP_BLOCK_THRESHOLD:
            _ip_blocked_until[ip] = now + _IP_BLOCK_DURATION
            logger.warning(
                "IP %s blocked for %ds after %d auth failures",
                ip, _IP_BLOCK_DURATION, _IP_BLOCK_THRESHOLD,
            )

    return response


_rate_buckets: dict = {}
_last_prune_window: list = [0]
_GET_LIMIT = 300
_WRITE_LIMIT = 100
_RATE_EXEMPT_PATHS = {"/health"}
_RATE_EXEMPT_PREFIXES = ("/assets/", "/docs", "/openapi", "/redoc")


def _check_rate(key: str, limit: int) -> bool:
    """Fixed-window counter. Returns True if the request is within limit."""
    window = int(time.time() // 60)
    bucket = f"{key}:{window}"
    count = _rate_buckets.get(bucket, 0) + 1
    _rate_buckets[bucket] = count
    if window != _last_prune_window[0]:
        _last_prune_window[0] = window
        for k in [k for k in list(_rate_buckets) if not k.endswith(f":{window}")]:
            del _rate_buckets[k]
    return count <= limit


@app.middleware("http")
async def _global_rate_limit(request: Request, call_next):
    path = request.url.path
    if path in _RATE_EXEMPT_PATHS or any(path.startswith(p) for p in _RATE_EXEMPT_PREFIXES):
        return await call_next(request)

    key = get_user_id_key(request)
    limit = _GET_LIMIT if request.method == "GET" else _WRITE_LIMIT

    if not _check_rate(key, limit):
        return JSONResponse(
            status_code=429,
            content={"detail": f"Rate limit exceeded. Max {limit} requests per minute."},
            headers={"Retry-After": str(60 - int(time.time() % 60))},
        )

    return await call_next(request)


@app.middleware("http")
async def _log_requests(request: Request, call_next):
    start = time.monotonic()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("Unhandled error: %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})
    ms = int((time.monotonic() - start) * 1000)
    level = logging.WARNING if response.status_code >= 400 else logging.INFO
    logger.log(level, "%s %s %s %dms", request.method, request.url.path, response.status_code, ms)
    return response

app.include_router(auth_router)
app.include_router(ai_router)
app.include_router(expenses_router)
app.include_router(budgets_router)
app.include_router(types_router)
app.include_router(incomes_router)
app.include_router(import_router)
app.include_router(import_rules_router)
app.include_router(macrocategories_router)
app.include_router(savings_goals_router)
app.include_router(analysis_router)
app.include_router(settings_router)
app.include_router(dashboard_router)


@app.get("/health")
def health():
    try:
        conn = get_connection()
        conn.execute("SELECT 1")
        conn.close()
        db = "ok"
    except Exception:
        logger.exception("Health check: DB unreachable")
        db = "error"
    status = "ok" if db == "ok" else "degraded"
    code = 200 if status == "ok" else 503
    return JSONResponse({"status": status, "db": db}, status_code=code)


def _run_embedding_backfill():
    """
    Runs in a daemon thread so the server starts accepting requests immediately.
    Backfilling can take minutes on large datasets — blocking startup would cause
    health-check timeouts on Render's free tier.
    """
    try:
        from embeddings import backfill_all_users
        conn = get_connection()
        backfill_all_users(conn)
        conn.close()
    except Exception:
        logger.exception("Embedding backfill failed at startup")


@app.on_event("startup")
def startup():
    init_db()
    apply_recurring_expenses()
    apply_recurring_incomes()
    if os.environ.get("OPENAI_API_KEY"):
        threading.Thread(target=_run_embedding_backfill, daemon=True).start()


@app.on_event("shutdown")
def shutdown():
    close_pool()


def _is_bundled():
    return getattr(sys, "frozen", False)


def _static_dir():
    base = sys._MEIPASS if _is_bundled() else os.path.dirname(__file__)
    return os.path.join(base, "static")


_static = _static_dir()
if os.path.isdir(_static):
    app.mount("/", StaticFiles(directory=_static, html=True), name="static")


def _open_browser():
    webbrowser.open("http://localhost:3001")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3001))
    if _is_bundled():
        threading.Timer(1.5, _open_browser).start()
        uvicorn.run(app, host="0.0.0.0", port=port)
    else:
        uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
