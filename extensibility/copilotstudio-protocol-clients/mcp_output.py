"""Copilot Studio's tool-result envelope and plain terminal output."""

import json
from uuid import UUID

from mcp.types import CallToolResult, TextContent, Tool

from config import SampleError


def conversation_reply(result: CallToolResult) -> tuple[str, str]:
    # Copilot Studio's send-message tool returns this JSON envelope.
    if result.is_error or result.result_type != "complete":
        raise SampleError("MCP tool failed or requires additional input.")
    payload = result.structured_content
    if payload is None:
        text = "\n".join(block.text for block in result.content if isinstance(block, TextContent))
        try:
            payload = json.loads(text)
        except ValueError as exc:
            raise SampleError("The chat tool did not return JSON.") from exc
    if not isinstance(payload, dict):
        raise SampleError("The chat tool did not return a conversation object.")
    conversation_id = payload.get("conversationId")
    try:
        if not isinstance(conversation_id, str):
            raise ValueError("Missing ID")
        UUID(conversation_id)
    except ValueError as exc:
        raise SampleError("The chat tool returned a missing or invalid conversationId.") from exc
    replies = payload.get("response")
    if not isinstance(replies, list) or not replies or not all(
        isinstance(reply, str) and reply.strip() for reply in replies
    ):
        raise SampleError("The chat tool returned no nonempty response strings.")
    return "\n".join(replies), conversation_id


def show_tools(tools: list[Tool]) -> None:
    print("Advertised tools:")
    for tool in tools:
        print(f"  {tool.name}: {tool.description or ''}")
        print(f"    Input schema: {json.dumps(tool.input_schema)}")


async def show_progress(progress: float, total: float | None, message: str | None) -> None:
    # Display progress notifications as server-reported status.
    amount = f"{progress:g}" if total is None else f"{progress:g}/{total:g}"
    print(f"\n--- MCP progress {amount}: {message or 'Working'} ---\n", flush=True)
