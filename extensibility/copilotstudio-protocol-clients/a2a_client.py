"""Copilot Studio A2A chat: discover the card -> send a message -> consume SDK events.

run() is the entry point; connect() and invoke_streaming() contain the SDK calls.
Authentication and terminal formatting are in separate files.
"""

import asyncio
from contextlib import AsyncExitStack
from dataclasses import dataclass

import httpx
from a2a.client import A2ACardResolver, Client, ClientConfig, create_client
from a2a.helpers import new_text_message
from a2a.types import AgentCard, GetExtendedAgentCardRequest, Role, SendMessageRequest, Task, TaskState
from a2a.utils.constants import TransportProtocol

from a2a_output import A2AStreamOutput, completed_text, message_text, show_skills
from config import SampleError, Settings, require_same_origin
from console import input_session, launch, read_prompt

BINDINGS: list[str] = [TransportProtocol.JSONRPC, TransportProtocol.HTTP_JSON]
PENDING = {TaskState.TASK_STATE_SUBMITTED, TaskState.TASK_STATE_WORKING}
HELP = "Commands: /skills, /new, /exit. Ctrl+D exits; Ctrl+C interrupts."


@dataclass(frozen=True)
class Reply:
    text: str
    context_id: str


def validate_card(card: AgentCard, card_url: str) -> None:
    # Restrict authenticated requests to the configured endpoint's origin.
    interfaces = [item for item in card.supported_interfaces if item.protocol_binding in BINDINGS]
    if not interfaces:
        raise SampleError("The agent card advertises no supported HTTP binding.")
    for item in interfaces:
        require_same_origin(item.url, card_url)


async def connect(settings: Settings, token: str, stack: AsyncExitStack) -> tuple[Client, AgentCard]:
    async def guard(request: httpx.Request) -> None:
        require_same_origin(str(request.url), settings.endpoint)

    http = await stack.enter_async_context(httpx.AsyncClient(
        headers={"Authorization": f"Bearer {token}"},
        event_hooks={"request": [guard]}, follow_redirects=False,
        timeout=httpx.Timeout(30, read=settings.timeout),
    ))
    # The SDK handles discovery and wire encoding.
    card = await A2ACardResolver(http, base_url=settings.endpoint).get_agent_card(relative_card_path="/")
    validate_card(card, settings.endpoint)
    config = ClientConfig(
        streaming=True, polling=False, httpx_client=http,
        supported_protocol_bindings=BINDINGS, accepted_output_modes=["text/plain"],
    )
    client = await create_client(card, config)
    stack.push_async_callback(client.close)
    if card.capabilities.extended_agent_card:
        # The authenticated card includes the agent's configured skills.
        card = await client.get_extended_agent_card(GetExtendedAgentCardRequest())
        validate_card(card, settings.endpoint)
        client = await create_client(card, config)
        stack.push_async_callback(client.close)
    if not card.capabilities.streaming:
        raise SampleError("This focused chat sample requires an agent advertising A2A streaming.")
    return client, card


async def invoke_streaming(client: Client, prompt: str, context_id: str | None = None) -> Reply:
    # A message ID identifies one message. The context ID links turns in a conversation.
    request = SendMessageRequest(message=new_text_message(
        prompt, role=Role.ROLE_USER, context_id=context_id,
    ))
    task = Task()
    output = A2AStreamOutput()
    response: Reply | None = None

    def identify(task_id: str, returned_context: str) -> None:
        if not task_id or (task.id and task.id != task_id):
            raise SampleError("A2A stream returned a missing or different task ID.")
        expected = task.context_id or context_id
        if returned_context and expected and returned_context != expected:
            raise SampleError("A2A stream changed the conversation context ID.")
        task.id = task_id
        if returned_context:
            task.context_id = returned_context

    try:
        # The SDK decodes the event stream. Artifacts contain output; task status indicates progress.
        async for event in client.send_message(request):
            if response is not None:
                raise SampleError("A2A stream returned events after an immediate message.")
            if event.HasField("message"):
                if task.id:
                    raise SampleError("A2A stream mixed task and immediate-message responses.")
                response = Reply(message_text(event.message), event.message.context_id)
                output.message(response.text)
            elif event.HasField("task"):
                snapshot = event.task
                identify(snapshot.id, snapshot.context_id)
                task.status.CopyFrom(snapshot.status)
                del task.history[:]
                task.history.extend(snapshot.history)
                for artifact in snapshot.artifacts:
                    output.update(artifact, False)
            elif event.HasField("artifact_update"):
                update = event.artifact_update
                identify(update.task_id, update.context_id)
                output.update(update.artifact, update.append)
            elif event.HasField("status_update"):
                update_status = event.status_update
                identify(update_status.task_id, update_status.context_id)
                task.status.CopyFrom(update_status.status)
            else:
                raise SampleError("A2A stream returned an unknown event.")
            if task.HasField("status") and task.status.state not in PENDING | {TaskState.TASK_STATE_COMPLETED}:
                raise SampleError(f"A2A task did not complete: {TaskState.Name(task.status.state)}.")

        if response is None:
            # A successful task response requires TASK_STATE_COMPLETED before the stream ends.
            if not task.id or task.status.state != TaskState.TASK_STATE_COMPLETED:
                raise SampleError("A2A stream ended before task completion.")
            text = output.text()
            if not text:
                text = completed_text(task)
                output.message(text)
            response = Reply(text, task.context_id)
        if not response.context_id:
            raise SampleError("A2A returned no context ID; cannot continue without replaying history.")
        if context_id and response.context_id != context_id:
            raise SampleError("A2A did not preserve the requested conversation context ID.")
        return response
    finally:
        output.finish_line()


async def run(settings: Settings, token: str) -> None:
    async with AsyncExitStack() as stack:
        async with asyncio.timeout(settings.timeout):
            client, card = await connect(settings, token, stack)
        show_skills(card)
        print(f"Response mode: A2A streaming\n{HELP}")
        prompts = input_session()
        context_id: str | None = None
        while True:
            prompt = await read_prompt(prompts)
            if not prompt:
                continue
            if prompt == "/exit":
                print("Chat ended.")
                return
            if prompt == "/skills":
                show_skills(card)
                continue
            if prompt == "/new":
                context_id = None
                print("The next message starts a new conversation.")
                continue
            if prompt.startswith("/"):
                print(f"Unknown command. {HELP}")
                continue
            # Start the per-turn deadline after the user submits a message.
            async with asyncio.timeout(settings.timeout):
                reply = await invoke_streaming(client, prompt, context_id)
            if context_id is None:
                print(f"Conversation context: {reply.context_id}")
            context_id = reply.context_id


def main(argv: list[str] | None = None) -> int:
    return launch("a2a", run, argv)


if __name__ == "__main__":
    raise SystemExit(main())
