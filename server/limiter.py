import base64
import json
import logging

from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger("budget_app")


def get_user_id_key(request) -> str:
    """
    Rate-limit key for authenticated endpoints. Extracts `sub` from the JWT
    payload via base64-decode (no signature verification — get_current_user
    still verifies the signature). Falls back to IP if no valid bearer token.
    """
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        parts = auth.removeprefix("Bearer ").split(".")
        if len(parts) == 3:
            try:
                payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=="))
                sub = payload.get("sub")
                if sub:
                    return f"user:{sub}"
            except Exception:
                logger.debug("get_user_id_key: JWT decode failed, falling back to IP")
    return get_remote_address(request)


# Keeps app.state.limiter wiring in server.py working unchanged
limiter = Limiter(key_func=get_remote_address)

# Per-user limiter for AI endpoints
user_limiter = Limiter(key_func=get_user_id_key)
