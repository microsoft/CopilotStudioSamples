import math
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit
from uuid import UUID

from dotenv import load_dotenv

Protocol = Literal["mcp", "a2a"]
ENV_FILE = Path(__file__).with_name(".env")

SCOPES = {
    "mcp": "https://api.powerplatform.com/copilotstudio-mcp/MCS.InvokeAsMCP",
    "a2a": "https://api.powerplatform.com/copilotstudio-a2a/MCS.InvokeAsA2A",
}


class SampleError(Exception):
    """An actionable configuration or invocation failure."""


def https_origin(url: str) -> tuple[str, str, int]:
    try:
        parsed = urlsplit(url)
        port = parsed.port
    except ValueError as exc:
        raise SampleError("Endpoint URL has an invalid host or port.") from exc
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.fragment
        or any(character.isspace() or ord(character) < 32 for character in url)
    ):
        raise SampleError("Use an HTTPS URL without user information or a fragment.")
    return parsed.scheme, parsed.hostname, port if port is not None else 443


def require_same_origin(url: str, trusted_url: str) -> None:
    if https_origin(url) != https_origin(trusted_url):
        raise SampleError(
            "Refusing to send credentials to a different origin. "
            "Verify the channel/card URL and advertised interfaces."
        )


def required_id(name: str) -> str:
    value = os.environ.get(name, "")
    try:
        if str(UUID(value)) != value.lower():
            raise ValueError("Not a canonical GUID")
    except ValueError as exc:
        raise SampleError(f"Set {name} to the GUID from your app registration.") from exc
    return value


@dataclass(frozen=True)
class Settings:
    tenant_id: str
    client_id: str
    endpoint: str
    scope: str
    timeout: float

    @classmethod
    def from_env(
        cls, protocol: Protocol, endpoint: str | None, timeout: float
    ) -> "Settings":
        # Load the sample's .env; existing environment variables take precedence.
        try:
            load_dotenv(ENV_FILE, override=False)
        except OSError as exc:
            raise SampleError(f"Unable to read {ENV_FILE}. Check file permissions.") from exc
        if not math.isfinite(timeout) or timeout <= 0:
            raise SampleError("--timeout must be a positive, finite number of seconds.")
        name = "MCS_MCP_URL" if protocol == "mcp" else "MCS_A2A_CARD_URL"
        url = endpoint or os.environ.get(name, "")
        if not url:
            raise SampleError(f"Set {name} in the sample's .env file.")
        https_origin(url)
        scope = os.environ.get(f"MCS_{protocol.upper()}_SCOPE", SCOPES[protocol])
        https_origin(scope)
        expected_suffix = (
            "/copilotstudio-mcp/MCS.InvokeAsMCP"
            if protocol == "mcp"
            else "/copilotstudio-a2a/MCS.InvokeAsA2A"
        )
        parsed_scope = urlsplit(scope)
        if not parsed_scope.path.endswith(expected_suffix) or parsed_scope.query:
            raise SampleError(f"The {protocol.upper()} scope must end in {expected_suffix}.")
        return cls(
            required_id("MCS_TENANT_ID"),
            required_id("MCS_CLIENT_ID"),
            url,
            scope,
            timeout,
        )
