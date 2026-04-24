import uuid
import os
import re
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from database import get_connection, _DEFAULT_TYPES
from auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth")

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterBody(BaseModel):
    email: str
    password: str


class LoginBody(BaseModel):
    email: str
    password: str


def _seed_default_types(cursor, user_id: str):
    for name, color, icon, sort_order in _DEFAULT_TYPES:
        cursor.execute(
            "INSERT OR IGNORE INTO expense_types (id, name, color, icon, sort_order, is_default, user_id) VALUES (?,?,?,?,?,1,?)",
            (str(uuid.uuid4()), name, color, icon, sort_order, user_id),
        )


def _set_auth_cookie(response: Response, token: str):
    _secure = os.environ.get("SECURE_COOKIES", "true").lower() == "true"
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=_secure,
        samesite="lax",
        path="/",
        max_age=604800,
    )


@router.post("/register", status_code=201)
def register(body: RegisterBody, response: Response):
    if os.environ.get("REGISTRATION_OPEN", "true").lower() != "true":
        raise HTTPException(status_code=403, detail="Registration is currently closed")
    email = body.email.strip().lower()
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Invalid email address")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=409, detail="Email already registered")

    user_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO users (id, email, hashed_password, created_at) VALUES (?,?,?,?)",
        (user_id, email, hash_password(body.password), datetime.now().isoformat()),
    )
    _seed_default_types(cursor, user_id)
    conn.commit()
    conn.close()

    _set_auth_cookie(response, create_access_token(user_id))
    return {"id": user_id, "email": email}


@router.post("/login")
def login(body: LoginBody, response: Response):
    email = body.email.strip().lower()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, hashed_password FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    conn.close()
    if not user or not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    _set_auth_cookie(response, create_access_token(user["id"]))
    return {"id": user["id"], "email": email}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@router.get("/me")
def me(user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    conn.close()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": user["id"], "email": user["email"]}
