import sys
import os
import threading
import webbrowser
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import init_db, apply_recurring_expenses, apply_recurring_incomes
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

app = FastAPI()

_allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    return {"status": "ok"}


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
