import os
import logging
from fastapi import Header, HTTPException
from jose import JWTError, jwt

logger = logging.getLogger("budget_app.auth")

SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")
if not SUPABASE_JWT_SECRET:
    logger.error("SUPABASE_JWT_SECRET is not set — all authenticated requests will fail")


def get_current_user(authorization: str = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not SUPABASE_JWT_SECRET:
        raise HTTPException(status_code=401, detail="Server misconfiguration: JWT secret not set")
    token = authorization.removeprefix("Bearer ")
    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError as e:
        logger.warning("JWT decode failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid or expired token")
