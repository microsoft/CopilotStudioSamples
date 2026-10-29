"""Shared command-line options, terminal input, and error reporting."""

import argparse
import asyncio
import sys
from collections.abc import Callable, Coroutine
from typing import Any

import httpx
import httpx2
import requests
from a2a.client.errors import A2AClientError
from mcp.shared.exceptions import MCPError
from prompt_toolkit import PromptSession
from prompt_toolkit.history import DummyHistory

from auth import acquire_token, sign_out
from config import Protocol, SampleError, Settings


def input_session() -> PromptSession[str]:
    # Async input keeps the MCP connection alive; DummyHistory disables input history.
    return PromptSession(history=DummyHistory())


async def read_prompt(session: PromptSession[str]) -> str:
    try:
        return (await session.prompt_async("\nYou> ")).strip()
    except EOFError:
        return "/exit"


def error_messages(error: BaseException) -> list[str]:
    if isinstance(error, BaseExceptionGroup):
        return [text for child in error.exceptions for text in error_messages(child)]
    if isinstance(error, TimeoutError):
        return ["Protocol deadline exceeded. Check agent activity or increase --timeout."]
    return [f"{type(error).__name__}: {error}"]


def launch(
    protocol: Protocol,
    run: Callable[[Settings, str], Coroutine[Any, Any, None]],
    argv: list[str] | None = None,
) -> int:
    parser = argparse.ArgumentParser(description=f"Chat with Copilot Studio over {protocol.upper()}.")
    parser.add_argument("--timeout", type=float, default=120, help="Discovery/per-turn deadline.")
    parser.add_argument("--sign-out", action="store_true", help="Clear the sample's cached sign-in.")
    args = parser.parse_args(argv)
    token = ""
    exit_code = 0
    try:
        settings = Settings.from_env(protocol, None, args.timeout)
        if args.sign_out:
            sign_out(settings)
        else:
            token = acquire_token(settings)
            asyncio.run(run(settings, token))
    except* KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        exit_code = 130
    except* (
        SampleError, ValueError, TimeoutError, A2AClientError, MCPError,
        httpx.HTTPError, httpx2.HTTPError, requests.RequestException,
    ) as errors:
        for text in error_messages(errors):
            print(
                f"{protocol.upper()} failed: {text.replace(token, '[redacted]') if token else text}",
                file=sys.stderr,
            )
        exit_code = 1
    return exit_code
