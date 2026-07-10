import os
from cryptography.fernet import Fernet


def _fernet() -> Fernet:
    key = os.environ.get("PLAID_ENCRYPTION_KEY")
    if not key:
        # Fail closed, checked lazily at first use (not import time) so the server
        # still starts and non-Plaid features work fine when Plaid isn't configured
        # at all (e.g. the desktop/PyInstaller build) — this only blocks the Plaid
        # code paths that actually need to read/write an access token.
        raise RuntimeError(
            "PLAID_ENCRYPTION_KEY is not set. Generate one with: "
            "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    try:
        return Fernet(key.encode())
    except ValueError as e:
        raise RuntimeError(f"PLAID_ENCRYPTION_KEY is not a valid Fernet key: {e}") from e


def encrypt_token(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    return _fernet().decrypt(ciphertext.encode()).decode()
