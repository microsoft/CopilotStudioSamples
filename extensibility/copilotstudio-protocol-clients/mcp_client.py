"""Copilot Studio MCP chat: connect -> discover -> call send-message -> repeat."""

import asyncio
from uuid import UUID

import httpx2
from mcp import Client
from mcp.client.streamable_http import streamable_http_client
from mcp.types import Tool

from config import SampleError, Settings, require_same_origin
from console import input_session, launch, read_prompt
from mcp_output import conversation_reply, show_progress, show_tools

HELP = "Commands: /tools, /new, /exit. Ctrl+D exits; Ctrl+C interrupts."


async def discover_tools(client: Client) -> list[Tool]:
    """Discover the server's tools through the SDK."""
    tools: list[Tool] = []
    cursor: str | None = None
    seen: set[str] = set()
    while True:
        page = await client.list_tools(cursor=cursor)
        tools.extend(page.tools)
        if page.next_cursor is None:
            return tools
        if page.next_cursor in seen:
            raise SampleError("MCP server repeated a pagination cursor.")
        seen.add(page.next_cursor)
        cursor = page.next_cursor


async def chat_loop(client: Client, tools: list[Tool], timeout: float) -> None:
    if sum(tool.name == "send-message" for tool in tools) != 1:
        raise SampleError("This sample requires Copilot Studio's send-message tool.")
    prompts = input_session()
    conversation_id: str | None = None
    print(HELP)
    while True:
        prompt = await read_prompt(prompts)
        if not prompt:
            continue
        if prompt == "/exit":
            print("Chat ended.")
            return
        if prompt == "/tools":
            show_tools(tools)
            continue
        if prompt == "/new":
            conversation_id = None
            print("The next message starts a new conversation.")
            continue
        if prompt.startswith("/"):
            print(f"Unknown command. {HELP}")
            continue

        # conversationId identifies the conversation maintained by Copilot Studio.
        # Each request contains the current message. Copilot Studio stores previous turns.
        arguments = {"message": prompt}
        if conversation_id:
            arguments["conversationId"] = conversation_id
        async with asyncio.timeout(timeout):
            result = await client.call_tool("send-message", arguments, progress_callback=show_progress)
        text, returned_id = conversation_reply(result)
        if conversation_id and UUID(returned_id) != UUID(conversation_id):
            raise SampleError("The chat tool did not preserve the requested conversationId.")
        if conversation_id is None:
            print(f"Conversation ID: {returned_id}")
        conversation_id = returned_id
        print(f"Agent> {text}")


async def run(settings: Settings, token: str) -> None:
    async def guard(request: httpx2.Request) -> None:
        require_same_origin(str(request.url), settings.endpoint)

    # The SDK handles initialization, HTTP/SSE transport, and MCP message encoding.
    async with asyncio.timeout(settings.timeout) as discovery, httpx2.AsyncClient(
        headers={"Authorization": f"Bearer {token}"},
        event_hooks={"request": [guard]}, follow_redirects=False,
        timeout=httpx2.Timeout(30, read=settings.timeout),
    ) as http:
        transport = streamable_http_client(settings.endpoint, http_client=http)
        async with Client(transport, read_timeout_seconds=settings.timeout) as client:
            tools = await discover_tools(client)
            discovery.reschedule(None)
            print(f"MCP protocol: {client.protocol_version}")
            print(f"Server: {client.server_info}")
            show_tools(tools)
            # Each turn has its own deadline, starting after the user submits a message.
            await chat_loop(client, tools, settings.timeout)


def main(argv: list[str] | None = None) -> int:
    return launch("mcp", run, argv)


if __name__ == "__main__":
    raise SystemExit(main())
