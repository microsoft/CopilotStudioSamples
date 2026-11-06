"""Shared delegated MSAL sign-in with an OS-encrypted cache."""

import os
import re
import sys
from pathlib import Path

import requests
from msal import PublicClientApplication
from msal.oauth2cli.oauth2 import BrowserInteractionTimeoutError
from msal_extensions import PersistedTokenCache, build_encrypted_persistence

from config import SampleError, Settings


def safe_identifier(value: object) -> str:
    if isinstance(value, str) and re.fullmatch(r"[a-zA-Z0-9._-]{1,100}", value):
        return value
    return "not-provided"


def create_token_cache(settings: Settings) -> PersistedTokenCache:
    if sys.platform == "darwin":
        root = Path.home() / "Library" / "Caches"
    elif sys.platform.startswith("win"):
        root = Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData" / "Local")))
    elif sys.platform.startswith("linux"):
        root = Path(os.environ.get("XDG_CACHE_HOME", str(Path.home() / ".cache")))
    else:
        raise SampleError("Encrypted token caching requires Windows, macOS, or Linux.")
    if not root.is_absolute():
        raise SampleError("The OS cache directory must be an absolute path.")
    directory = root / "CopilotStudioProtocolClients"
    location = directory / f"{settings.tenant_id}-{settings.client_id}.bin"
    try:
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        persistence = build_encrypted_persistence(str(location))
    except (OSError, ImportError, RuntimeError) as exc:
        raise SampleError(
            "Cannot initialize encrypted token storage. Check macOS Keychain, "
            "Windows DPAPI, or Linux Secret Service/libsecret. Plaintext caching is disabled."
        ) from exc
    if not persistence.is_encrypted:
        raise SampleError("The token cache must use OS-encrypted persistence.")
    return PersistedTokenCache(persistence)


def create_application(settings: Settings) -> PublicClientApplication:
    return PublicClientApplication(
        settings.client_id,
        authority=f"https://login.microsoftonline.com/{settings.tenant_id}",
        enable_pii_log=False,
        token_cache=create_token_cache(settings),
    )


def sign_out(settings: Settings) -> None:
    try:
        app = create_application(settings)
        accounts = app.get_accounts(username=os.environ.get("MCS_LOGIN_HINT"))
        if len(accounts) > 1:
            raise SampleError("Set MCS_LOGIN_HINT to select the cached account to sign out.")
        if accounts:
            app.remove_account(accounts[0])
        print("Cached sign-in cleared for this sample app. Cloud consent is unchanged.")
    except requests.RequestException as exc:
        raise SampleError("Sign-out could not reach the identity service.") from exc
    except OSError as exc:
        raise SampleError("Cannot clear the OS-encrypted token cache; check its availability.") from exc


def acquire_token(settings: Settings) -> str:
    try:
        app = create_application(settings)
        hint = os.environ.get("MCS_LOGIN_HINT")
        accounts = app.get_accounts(username=hint)
        result = (
            app.acquire_token_silent([settings.scope], account=accounts[0])
            if len(accounts) == 1 else None
        )
        if not result or "access_token" not in result:
            print(
                "Opening system-browser sign-in for the sample app. "
                "Use a user who can access the published agent.",
                file=sys.stderr,
            )
            result = app.acquire_token_interactive(
                scopes=[settings.scope],
                timeout=300,
                login_hint=hint,
                prompt="select_account" if len(accounts) > 1 else None,
            )
        else:
            print("Using cached sign-in.", file=sys.stderr)
    except requests.RequestException as exc:
        raise SampleError("Entra sign-in could not reach the identity service.") from exc
    except BrowserInteractionTimeoutError as exc:
        raise SampleError(
            "Browser sign-in timed out. Retry and complete account selection/sign-in "
            "before the 300-second deadline."
        ) from exc
    except OSError as exc:
        raise SampleError(
            "Cannot access the OS-encrypted token cache. Check Keychain, DPAPI, "
            "or Linux Secret Service; no plaintext fallback is used."
        ) from exc
    token = result.get("access_token")
    if not isinstance(token, str) or not token:
        error = safe_identifier(result.get("error"))
        correlation = safe_identifier(result.get("correlation_id"))
        raise SampleError(
            f"Entra sign-in failed: {error}; correlation ID: {correlation}. "
            "Check the tenant, desktop localhost redirect, delegated scope, and consent."
        )
    return token
