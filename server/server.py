import sys
import os
import time
import logging
import threading
import webbrowser
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from limiter import limiter
from database import get_connection, init_db, apply_recurring_expenses, apply_recurring_incomes
from routers.auth_router import router as auth_router
from routers.expenses_router import router as expenses_router
from routers.budgets_router import router as budgets_router
from routers.types_router import router as types_router
from routers.incomes_router import router as incomes_router
from routers.import_router import router as import_router
from routers.import_rules_router import router as import_rules_router
from routers.macrocategories_router import router as macrocategories_router
from routers.savings_goals_router import router as savings_goals_router
from routers.analysis_router import router as analysis_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("budget_app")

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
app.include_router(expenses_router)
app.include_router(budgets_router)
app.include_router(types_router)
app.include_router(incomes_router)
app.include_router(import_router)
app.include_router(import_rules_router)
app.include_router(macrocategories_router)
app.include_router(savings_goals_router)
app.include_router(analysis_router)


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


@app.on_event("startup")
def startup():
    init_db()
    apply_recurring_expenses()
    apply_recurring_incomes()


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
