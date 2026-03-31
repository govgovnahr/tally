import sys
import os
import threading
import webbrowser
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import init_db, apply_recurring_expenses
from routers.expenses_router import router as expenses_router
from routers.budgets_router import router as budgets_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(expenses_router)
app.include_router(budgets_router)


@app.on_event("startup")
def startup():
    init_db()
    apply_recurring_expenses()


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
    if _is_bundled():
        threading.Timer(1.5, _open_browser).start()
        uvicorn.run(app, host="0.0.0.0", port=3001)
    else:
        uvicorn.run("server:app", host="0.0.0.0", port=3001, reload=True)
