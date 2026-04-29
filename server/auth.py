import os
import logging
import requests as http_requests
from fastapi import Header, HTTPException
from jose import JWTError, jwt

logger = logging.getLogger("budget_app.auth")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")

_jwks_cache = None


def _get_jwks():
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    if not SUPABASE_URL:
        logger.error("SUPABASE_URL is not set — cannot fetch JWKS for RS256 verification")
        return None
    try:
        resp = http_requests.get(f"{SUPABASE_URL}/.well-known/jwks.json", timeout=5)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        logger.info("JWKS fetched and cached from %s", SUPABASE_URL)
        return _jwks_cache
    except Exception as e:
        logger.error("Failed to fetch JWKS: %s", e)
        return None


def get_current_user(authorization: str = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
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
                algorithms=["RS256"],
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
