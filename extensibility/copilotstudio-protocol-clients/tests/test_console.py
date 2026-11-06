import asyncio
import contextlib
import io
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import AsyncMock, Mock, patch

import httpx
import httpx2
from a2a.helpers import new_text_message
from a2a.types import AgentCard, AgentInterface, Role, StreamResponse, TaskState
from mcp.types import CallToolResult, ListToolsResult, Tool

import a2a_client
import mcp_client
from chat import main
from config import SampleError, Settings, SCOPES
from console import error_messages
from mcp_output import conversation_reply

GUID = "11111111-1111-4111-8111-111111111111"
URL = "https://agent.example/channel"
ENV = {
    "MCS_TENANT_ID": GUID, "MCS_CLIENT_ID": GUID,
    "MCS_MCP_URL": URL, "MCS_A2A_CARD_URL": URL,
}


class EntryPointTests(unittest.TestCase):
    def setUp(self):
        directory = self.enterContext(TemporaryDirectory())
        self.env_file = Path(directory) / ".env"
        self.enterContext(patch("config.ENV_FILE", self.env_file))

    def test_both_clients_start_with_dotenv_only(self):
        self.env_file.write_text("\n".join(f"{key}='{value}'" for key, value in ENV.items()))
        for module in (mcp_client, a2a_client):
            with (
                self.subTest(module=module.__name__),
                patch.dict(os.environ, {}, clear=True),
                patch("console.acquire_token", return_value="secret-token") as auth,
                patch.object(module, "run", AsyncMock()) as run,
            ):
                self.assertEqual(module.main([]), 0)
                settings = auth.call_args.args[0]
                self.assertEqual(settings.tenant_id, GUID)
                self.assertEqual(settings.endpoint, URL)
                run.assert_awaited_once_with(settings, "secret-token")

    def test_launcher_selects_client_and_forwards_options(self):
        for protocol, module in (("mcp", mcp_client), ("a2a", a2a_client)):
            with self.subTest(protocol=protocol), patch.object(module, "main", return_value=0) as run:
                self.assertEqual(main(["--protocol", protocol, "--timeout", "7.5"]), 0)
                run.assert_called_once_with(["--timeout", "7.5"])

    def test_timeouts_are_actionable_and_redacted(self):
        for module in (mcp_client, a2a_client):
            with (
                self.subTest(module=module.__name__),
                patch.dict(os.environ, ENV, clear=True),
                patch("console.acquire_token", return_value="secret-token"),
                patch.object(module, "run", AsyncMock(side_effect=TimeoutError)),
                contextlib.redirect_stderr(io.StringIO()) as stderr,
            ):
                self.assertEqual(module.main([]), 1)
                self.assertIn("Protocol deadline exceeded", stderr.getvalue())
                self.assertNotIn("secret-token", stderr.getvalue())

    def test_group_errors_and_signout(self):
        self.assertIn("Protocol deadline exceeded", error_messages(
            ExceptionGroup("transport", [TimeoutError()])
        )[0])
        with patch.dict(os.environ, ENV, clear=True), patch("console.sign_out") as signout:
            self.assertEqual(main(["--protocol", "mcp", "--sign-out"]), 0)
            signout.assert_called_once()

    def test_unauthorized_is_a_nonzero_exit(self):
        for module, transport in ((a2a_client, httpx), (mcp_client, httpx2)):
            original = transport.AsyncClient

            def factory(**kwargs):
                return original(transport=transport.MockTransport(
                    lambda request: transport.Response(401)
                ), **kwargs)

            with (
                self.subTest(module=module.__name__),
                patch.dict(os.environ, ENV, clear=True),
                patch("console.acquire_token", return_value="secret-token"),
                patch.object(transport, "AsyncClient", side_effect=factory),
                contextlib.redirect_stderr(io.StringIO()) as stderr,
            ):
                self.assertEqual(module.main([]), 1)
                self.assertIn("failed", stderr.getvalue())
                self.assertNotIn("secret-token", stderr.getvalue())

    def test_old_generic_options_are_rejected_before_auth(self):
        for module, args in (
            (a2a_client, ["--message", "Hi"]),
            (mcp_client, ["--tool", "other"]),
        ):
            with (
                patch("console.acquire_token") as auth,
                contextlib.redirect_stderr(io.StringIO()),
                self.assertRaises(SystemExit),
            ):
                module.main(args)
            auth.assert_not_called()


class DiscoveryTests(unittest.IsolatedAsyncioTestCase):
    async def test_mcp_pagination(self):
        tool = Tool(name="send-message", input_schema={"type": "object"})
        client = Mock(list_tools=AsyncMock(side_effect=[
            ListToolsResult(tools=[], next_cursor="next"), ListToolsResult(tools=[tool]),
        ]))
        self.assertEqual(await mcp_client.discover_tools(client), [tool])
        client.list_tools.assert_any_await(cursor="next")
        client.list_tools = AsyncMock(return_value=ListToolsResult(tools=[], next_cursor="same"))
        with self.assertRaisesRegex(SampleError, "pagination"):
            await mcp_client.discover_tools(client)

    async def test_missing_tool_and_error_results_are_explicit(self):
        with self.assertRaisesRegex(SampleError, "send-message"):
            await mcp_client.chat_loop(Mock(), [], 1)
        for result in (
            CallToolResult(content=[], is_error=True),
            CallToolResult(content=[], result_type="input_required"),
            CallToolResult(content=[]),
        ):
            with self.assertRaises(SampleError):
                conversation_reply(result)

    def test_a2a_card_origin_guard(self):
        card = AgentCard(supported_interfaces=[
            AgentInterface(url="https://other.example/a2a", protocol_binding="JSONRPC"),
        ])
        with self.assertRaisesRegex(SampleError, "different origin"):
            a2a_client.validate_card(card, URL)
        with self.assertRaises(SampleError):
            a2a_client.validate_card(AgentCard(), URL)


class A2aChatTests(unittest.IsolatedAsyncioTestCase):
    async def exercise(self, prompts, contexts, *, extended=True, streaming=True, timeout=1, delay=0):
        public = AgentCard(
            name="Public",
            capabilities={"streaming": streaming, "extended_agent_card": extended},
            supported_interfaces=[AgentInterface(url=URL, protocol_binding="JSONRPC")],
            skills=[{"id": "chat", "name": "Generic chat"}],
        )
        private = AgentCard(
            name="Cooking", capabilities={"streaming": streaming},
            supported_interfaces=[AgentInterface(url=URL, protocol_binding="JSONRPC")],
            skills=[{"id": name, "name": name} for name in ("Pizza", "Pasta", "Bread")],
        )
        self.messages = []
        self.client = Mock(close=AsyncMock(), get_extended_agent_card=AsyncMock(return_value=private))

        async def send(request):
            self.messages.append(request.message)
            if delay:
                await asyncio.sleep(delay)
            yield StreamResponse(message=new_text_message(
                "Hello", role=Role.ROLE_AGENT, context_id=contexts.pop(0),
            ))

        self.client.send_message = send
        with (
            patch("a2a_client.A2ACardResolver", return_value=Mock(
                get_agent_card=AsyncMock(return_value=public)
            )),
            patch("a2a_client.create_client", AsyncMock(return_value=self.client)) as create,
            patch("console.PromptSession") as session,
            contextlib.redirect_stdout(io.StringIO()) as output,
        ):
            session.return_value.prompt_async = AsyncMock(side_effect=prompts)
            await a2a_client.run(Settings(GUID, GUID, URL, SCOPES["a2a"], timeout), "secret")
        self.assertTrue(create.call_args.args[1].streaming)
        return output.getvalue()

    async def test_context_only_conversation_reset_and_skills(self):
        output = await self.exercise(
            ["", "/skills", "/unknown", "Pizza", "Oven?", "/new", "Bread", "/exit"],
            ["ctx1", "ctx1", "ctx2"],
        )
        self.assertIn("Agent: Cooking", output)
        self.assertNotIn("Generic chat", output)
        self.assertIn("Unknown command", output)
        self.assertEqual(output.count("Advertised skills:"), 2)
        self.assertEqual([msg.context_id for msg in self.messages], ["", "ctx1", ""])
        self.assertEqual([[p.text for p in msg.parts] for msg in self.messages], [["Pizza"], ["Oven?"], ["Bread"]])
        self.assertTrue(all(not msg.task_id for msg in self.messages))
        self.assertEqual(len({msg.message_id for msg in self.messages}), 3)
        self.client.get_extended_agent_card.assert_awaited_once()
        self.assertEqual(self.client.close.await_count, 2)

    async def test_public_card_and_eof(self):
        output = await self.exercise([EOFError()], [], extended=False)
        self.assertIn("Generic chat", output)
        self.assertIn("Chat ended.", output)
        self.client.close.assert_awaited_once()

    async def test_nonstreaming_agent_is_explicitly_out_of_scope(self):
        with self.assertRaisesRegex(SampleError, "requires.*streaming"):
            await self.exercise([], [], streaming=False, extended=False)
        self.client.close.assert_awaited_once()

    async def test_missing_or_changed_context_fails(self):
        for contexts in ([""], ["ctx1", "different"]):
            with self.subTest(contexts=contexts), self.assertRaises(SampleError):
                await self.exercise(["Hello", "Again"], contexts)
            self.assertEqual(self.client.close.await_count, 2)

    async def test_turn_deadline_excludes_typing_time(self):
        values = iter(["Hi", "/exit"])

        async def type_slowly(*args, **kwargs):
            await asyncio.sleep(0.03)
            return next(values)

        output = await self.exercise(type_slowly, ["ctx"], timeout=0.01)
        self.assertIn("Agent> Hello", output)
        with self.assertRaises(TimeoutError):
            await self.exercise(["Hi"], ["ctx"], timeout=0.01, delay=1)
        self.assertEqual(self.client.close.await_count, 2)

    async def test_sdk_sse_two_turns_preserve_context(self):
        messages = []
        card = AgentCard(
            name="Cooking", version="1", capabilities={"streaming": True},
            supported_interfaces=[AgentInterface(
                url=URL, protocol_binding="JSONRPC", protocol_version="1.0",
            )],
        )
        from google.protobuf.json_format import MessageToDict
        from a2a.client import ClientConfig, create_client

        def handler(request):
            body = json.loads(request.content)
            self.assertEqual(body["method"], "SendStreamingMessage")
            messages.append(body["params"]["message"])
            event = StreamResponse(message=new_text_message("Hello", role=Role.ROLE_AGENT, context_id="ctx"))
            return httpx.Response(200, headers={"content-type": "text/event-stream"}, text=(
                "data: " + json.dumps({"jsonrpc": "2.0", "id": body["id"], "result": MessageToDict(event)}) + "\n\n"
            ))

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
            client = await create_client(card, ClientConfig(
                httpx_client=http, streaming=True, polling=False, supported_protocol_bindings=["JSONRPC"],
            ))
            try:
                with contextlib.redirect_stdout(io.StringIO()):
                    first = await a2a_client.invoke_streaming(client, "Hello")
                    await a2a_client.invoke_streaming(client, "Again", first.context_id)
            finally:
                await client.close()
        self.assertNotIn("contextId", messages[0])
        self.assertEqual(messages[1]["contextId"], "ctx")
        self.assertNotIn("taskId", messages[1])
        self.assertNotEqual(messages[0]["messageId"], messages[1]["messageId"])
