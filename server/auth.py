import os
import logging
import requests as http_requests
from fastapi import Header, HTTPException
from jose import JWTError, jwt

logger = logging.getLogger("budget_app.auth")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")
DEV_MODE = os.environ.get("DEV_MODE", "").lower() in ("1", "true", "yes")
DEV_USER_ID = "dev-user-00000000-0000-0000-0000-000000000001"

_jwks_cache = None


def _get_jwks():
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    if not SUPABASE_URL:
        logger.error("SUPABASE_URL is not set — cannot fetch JWKS for RS256 verification")
        return None
    try:
        resp = http_requests.get(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json", timeout=5)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        logger.info("JWKS fetched and cached from %s", SUPABASE_URL)
        return _jwks_cache
    except Exception as e:
        logger.error("Failed to fetch JWKS: %s", e)
        return None


def _verify_bearer_token(authorization: str) -> str:
    """Raises HTTPException on any failure. Single source of truth for JWT
    verification, shared by get_current_user (auth enforcement) and
    resolve_identity_for_db (best-effort DB-identity binding, see below)."""
    token = authorization.removeprefix("Bearer ")

    try:
        header = jwt.get_unverified_header(token)
    except JWTError as e:
        logger.warning("JWT header decode failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid token")

    alg = header.get("alg", "HS256")
    try:
        if alg == "HS256":
            if not SUPABASE_JWT_SECRET:
                raise HTTPException(status_code=401, detail="Server misconfiguration: JWT secret not set")
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
        else:
            jwks = _get_jwks()
            if not jwks:
                raise HTTPException(status_code=401, detail="Server misconfiguration: JWKS unavailable")
            payload = jwt.decode(
                token,
                jwks,
                algorithms=["RS256", "ES256"],
                options={"verify_aud": False},
            )
    except JWTError as e:
        logger.warning("JWT decode failed (alg=%s): %s", alg, e)
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    aud = payload.get("aud")
    if isinstance(aud, str) and aud != "authenticated":
        raise HTTPException(status_code=401, detail="Invalid token audience")
    if isinstance(aud, list) and "authenticated" not in aud:
        raise HTTPException(status_code=401, detail="Invalid token audience")

    user_id: str = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user_id


def get_current_user(authorization: str = Header(default=None)) -> str:
    if DEV_MODE:
        return DEV_USER_ID
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return _verify_bearer_token(authorization)


def resolve_identity_for_db(request) -> str:
    """
    Best-effort request -> user_id, used only by server.py's _bind_db_identity
    middleware to select which Postgres identity a request's queries run
    under (see database.py's current_user_id / get_connection()).

    Deliberately NOT the same code path as get_current_user, and not merely a
    wrapper around it: FastAPI dispatches every sync dependency (including
    get_current_user) to the threadpool via its own separate
    contextvars.copy_context() snapshot, independent of the route handler's
    own dispatch — a contextvar mutated inside a dependency's body never
    becomes visible inside the endpoint body (or get_connection(), called
    from deep inside it). Only code running in the ASGI middleware layer,
    before call_next() triggers those downstream dispatches, shares a context
    with the endpoint — so identity binding has to happen there instead.

    Auth enforcement itself is untouched and still entirely get_current_user's
    job. This returns None (never raises) for any request it can't resolve;
    such requests simply keep running on the app's own bypass-RLS connection
    role, same as before this existed, until/unless get_current_user
    separately rejects them with a 401.

    Tests monkeypatch this name directly (tests/conftest.py) rather than via
    app.dependency_overrides, which only affects FastAPI's own dependency
    resolution and has no effect on this middleware-time call.
    """
    if DEV_MODE:
        return DEV_USER_ID
    authorization = request.headers.get("authorization")
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        return _verify_bearer_token(authorization)
    except HTTPException:
        return None
