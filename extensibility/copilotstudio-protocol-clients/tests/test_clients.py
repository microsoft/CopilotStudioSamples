import asyncio
import contextlib
import io
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import time
import unittest
from unittest.mock import AsyncMock, Mock, patch

import httpx
import httpx2
import yaml
from a2a.client import ClientConfig, create_client
from a2a.helpers import new_text_message
from a2a.types import (
    AgentCard,
    AgentInterface,
    Artifact,
    Message,
    Part,
    Role,
    StreamResponse,
    Task,
    TaskState,
    TaskStatus,
)
from mcp import Client
from mcp.server import MCPServer
from mcp.types import CallToolResult, ListToolsResult, TextContent, Tool
from msal.oauth2cli.oauth2 import BrowserInteractionTimeoutError
from google.protobuf.json_format import MessageToDict, ParseDict

from a2a_client import Reply, invoke_streaming
from auth import acquire_token, create_token_cache, sign_out
from config import SCOPES, SampleError, Settings, https_origin, require_same_origin
from mcp_client import chat_loop, discover_tools
from mcp_output import conversation_reply, show_progress

GUID = "11111111-1111-4111-8111-111111111111"
ENV = {"MCS_TENANT_ID": GUID, "MCS_CLIENT_ID": GUID}
URL = "https://agent.example/channel"
TOOL = Tool(
    name="chat",
    input_schema={
        "type": "object",
        "properties": {"message": {"type": "string"}},
        "required": ["message"],
        "additionalProperties": False,
    },
)


class ConfigurationTests(unittest.TestCase):
    def setUp(self):
        directory = self.enterContext(TemporaryDirectory())
        self.env_file = Path(directory) / ".env"
        self.enterContext(patch("config.ENV_FILE", self.env_file))

    def test_dotenv_loads_settings_for_both_protocols(self):
        self.env_file.write_text(
            f"MCS_TENANT_ID='{GUID}'\nMCS_CLIENT_ID='{GUID}'\n"
            f"MCS_MCP_URL='{URL}'\nMCS_A2A_CARD_URL='{URL}/card'\n"
            "MCS_LOGIN_HINT='cook@example.com'\n",
            encoding="utf-8",
        )
        for protocol, endpoint in (("mcp", URL), ("a2a", URL + "/card")):
            with self.subTest(protocol=protocol), patch.dict(os.environ, {}, clear=True):
                settings = Settings.from_env(protocol, None, 120)
                self.assertEqual(settings, Settings(GUID, GUID, endpoint, SCOPES[protocol], 120))
                self.assertEqual(os.environ["MCS_LOGIN_HINT"], "cook@example.com")

    def test_environment_overrides_dotenv(self):
        self.env_file.write_text("MCS_CLIENT_ID=invalid\nMCS_MCP_URL=https://file.example\n")
        with patch.dict(os.environ, {**ENV, "MCS_MCP_URL": URL}, clear=True):
            settings = Settings.from_env("mcp", None, 120)
            self.assertEqual(settings.client_id, GUID)
            self.assertEqual(settings.endpoint, URL)

    def test_unreadable_dotenv_has_actionable_error(self):
        with patch("config.load_dotenv", side_effect=PermissionError):
            with self.assertRaisesRegex(SampleError, "Unable to read.*Check file permissions"):
                Settings.from_env("mcp", None, 120)

    def test_scopes_and_required_settings(self):
        with patch.dict(os.environ, ENV, clear=True):
            for protocol in ("mcp", "a2a"):
                settings = Settings.from_env(protocol, URL, 120)
                self.assertEqual(settings.scope, SCOPES[protocol])
            with self.assertRaises(SampleError):
                Settings.from_env("mcp", None, 120)
        with patch.dict(os.environ, {}, clear=True), self.assertRaises(SampleError):
            Settings.from_env("mcp", URL, 120)

    def test_invalid_guid_timeout_and_scope(self):
        with patch.dict(os.environ, ENV, clear=True):
            for timeout in (0, -1, float("nan"), float("inf")):
                with self.subTest(timeout=timeout), self.assertRaises(SampleError):
                    Settings.from_env("mcp", URL, timeout)
            os.environ["MCS_MCP_SCOPE"] = SCOPES["a2a"]
            with self.assertRaises(SampleError):
                Settings.from_env("mcp", URL, 120)
            del os.environ["MCS_MCP_SCOPE"]
            os.environ["MCS_CLIENT_ID"] = "not-a-guid"
            with self.assertRaises(SampleError):
                Settings.from_env("mcp", URL, 120)

    def test_https_and_origin_guard(self):
        for invalid in (
            "http://agent.example", "https://user:pass@agent.example",
            "https://agent.example/#fragment", "https://agent.example:bad",
            "https://agent.example/\npath", "",
        ):
            with self.subTest(url=invalid), self.assertRaises(SampleError):
                https_origin(invalid)
        require_same_origin(URL, "https://agent.example:443/other")
        for other in ("https://other.example", "https://agent.example:444"):
            with self.assertRaises(SampleError):
                require_same_origin(other, URL)


class AuthenticationTests(unittest.TestCase):
    def setUp(self):
        self.cache = Mock()
        self.enterContext(patch("auth.create_token_cache", return_value=self.cache))

    @patch("auth.PublicClientApplication")
    def test_browser_timeout_is_actionable(self, application):
        application.return_value.get_accounts.return_value = []
        application.return_value.acquire_token_interactive.side_effect = (
            BrowserInteractionTimeoutError("timeout")
        )
        with contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaisesRegex(SampleError, "Browser sign-in timed out"):
                acquire_token(Settings(GUID, GUID, URL, SCOPES["mcp"], 120))

    @patch("auth.PublicClientApplication")
    def test_msal_uses_protocol_scope_and_encrypted_cache(self, application):
        application.return_value.get_accounts.return_value = []
        application.return_value.acquire_token_interactive.return_value = {"access_token": "secret"}
        settings = Settings(GUID, GUID, URL, SCOPES["mcp"], 120)
        with (
            patch.dict(os.environ, {"MCS_LOGIN_HINT": "cook@example.com"}),
            contextlib.redirect_stderr(io.StringIO()),
        ):
            self.assertEqual(acquire_token(settings), "secret")
        application.assert_called_once_with(
            GUID, authority=f"https://login.microsoftonline.com/{GUID}",
            enable_pii_log=False, token_cache=self.cache,
        )
        application.return_value.acquire_token_interactive.assert_called_once_with(
            scopes=[SCOPES["mcp"]], timeout=300, login_hint="cook@example.com", prompt=None
        )

    @patch("auth.PublicClientApplication")
    def test_failure_does_not_log_token_or_description(self, application):
        application.return_value.get_accounts.return_value = []
        application.return_value.acquire_token_interactive.return_value = {
            "error": "access_denied",
            "error_description": "Sensitive token secret-value",
            "correlation_id": GUID,
            "refresh_token": "secret-value",
        }
        with contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SampleError) as failure:
                acquire_token(Settings(GUID, GUID, URL, SCOPES["a2a"], 120))
        self.assertIn("access_denied", str(failure.exception))
        self.assertNotIn("secret-value", str(failure.exception))

    @patch("auth.PublicClientApplication")
    def test_cached_token_is_used_without_browser(self, application):
        account = {"home_account_id": "account1"}
        app = application.return_value
        app.get_accounts.return_value = [account]
        app.acquire_token_silent.return_value = {"access_token": "cached-token"}
        with contextlib.redirect_stderr(io.StringIO()):
            token = acquire_token(Settings(GUID, GUID, URL, SCOPES["a2a"], 120))
        self.assertEqual(token, "cached-token")
        app.acquire_token_silent.assert_called_once_with([SCOPES["a2a"]], account=account)
        app.acquire_token_interactive.assert_not_called()

    @patch("auth.PublicClientApplication")
    def test_expired_cache_requires_interaction_when_silent_refresh_fails(self, application):
        app = application.return_value
        app.get_accounts.return_value = [{"home_account_id": "account1"}]
        app.acquire_token_silent.return_value = None
        app.acquire_token_interactive.return_value = {"access_token": "new-token"}
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(
                acquire_token(Settings(GUID, GUID, URL, SCOPES["mcp"], 120)), "new-token"
            )
        app.acquire_token_interactive.assert_called_once()

    @patch("auth.PublicClientApplication")
    def test_ambiguous_cached_accounts_are_not_selected_automatically(self, application):
        app = application.return_value
        app.get_accounts.return_value = [{"home_account_id": "one"}, {"home_account_id": "two"}]
        app.acquire_token_interactive.return_value = {"access_token": "selected-token"}
        with patch.dict(os.environ, {}, clear=True), contextlib.redirect_stderr(io.StringIO()):
            acquire_token(Settings(GUID, GUID, URL, SCOPES["mcp"], 120))
        app.acquire_token_silent.assert_not_called()
        self.assertEqual(app.acquire_token_interactive.call_args.kwargs["prompt"], "select_account")

    @patch("auth.PublicClientApplication")
    def test_sign_out_removes_only_the_selected_cached_account(self, application):
        account = {"home_account_id": "account1"}
        application.return_value.get_accounts.return_value = [account]
        with contextlib.redirect_stdout(io.StringIO()):
            sign_out(Settings(GUID, GUID, URL, SCOPES["mcp"], 120))
        application.return_value.remove_account.assert_called_once_with(account)

    @patch("auth.PublicClientApplication")
    def test_cache_error_is_explicit_and_does_not_launch_browser(self, application):
        app = application.return_value
        app.get_accounts.side_effect = OSError("sensitive-storage-detail")
        with self.assertRaisesRegex(SampleError, "OS-encrypted token cache") as error:
            acquire_token(Settings(GUID, GUID, URL, SCOPES["mcp"], 120))
        self.assertNotIn("sensitive-storage-detail", str(error.exception))
        app.acquire_token_interactive.assert_not_called()


class EncryptedCacheTests(unittest.TestCase):
    def test_native_cache_locations_and_encrypted_factory_on_each_os(self):
        for platform, relative in (
            ("darwin", Path("Library/Caches")),
            ("win32", Path("AppData/Local")),
            ("linux", Path(".cache")),
        ):
            with (
                self.subTest(platform=platform),
                TemporaryDirectory() as home,
                patch("auth.sys.platform", platform),
                patch("auth.Path.home", return_value=Path(home)),
                patch.dict(os.environ, {}, clear=True),
                patch("auth.build_encrypted_persistence", return_value=Mock(is_encrypted=True)) as build,
                patch("auth.PersistedTokenCache") as cache,
            ):
                settings = Settings(GUID, GUID, URL, SCOPES["mcp"], 120)
                self.assertIs(create_token_cache(settings), cache.return_value)
                expected = Path(home) / relative / "CopilotStudioProtocolClients" / f"{GUID}-{GUID}.bin"
                build.assert_called_once_with(str(expected))
                cache.assert_called_once_with(build.return_value)

    def test_encryption_failure_never_falls_back_to_plaintext(self):
        with (
            TemporaryDirectory() as home,
            patch("auth.Path.home", return_value=Path(home)),
            patch("auth.sys.platform", "darwin"),
            patch("auth.build_encrypted_persistence", side_effect=OSError("secret detail")),
            self.assertRaisesRegex(SampleError, "Plaintext caching is disabled"),
        ):
            create_token_cache(Settings(GUID, GUID, URL, SCOPES["mcp"], 120))


class AgentSourceTests(unittest.TestCase):
    def test_portable_skills_instructions_and_knowledge(self):
        agent = Path(__file__).parent.parent / "agent" / "A2A MCP Sample"
        settings = yaml.safe_load((agent / "settings.mcs.yml").read_text())
        config = settings["configuration"]["agentSettings"]
        skills = config["a2A"]["skills"]
        self.assertEqual(
            [skill["name"] for skill in skills],
            ["Pizza Recipes", "Pasta Recipes", "Bread Baking"],
        )
        self.assertEqual(skills[0]["id"], "c19120bd-418b-4b96-b23d-9b80b000c964")
        self.assertEqual(len({skill["id"] for skill in skills}), 3)
        instructions = config["instructions"]["segments"][0]["value"]
        self.assertIn("bolognese", instructions)
        self.assertIn("ragù", instructions)
        sources = list((agent / "capabilities" / "knowledge").glob("*.mcs.yml"))
        self.assertEqual(len(sources), 3)
        for path in sources:
            component = yaml.safe_load(path.read_text())
            source = component["source"]
            self.assertEqual(source["kind"], "WebsiteKnowledgeSource")
            url = source["siteUrl"]
            https_origin(url)
            self.assertLessEqual(len([s for s in httpx.URL(url).path.split("/") if s]), 2)
            self.assertEqual(component["mcs.metadata"]["componentName"], url)
            self.assertTrue(component["mcs.metadata"]["description"])
            self.assertLessEqual(len(path.name.removesuffix(".mcs.yml")), 100)






class McpChatTests(unittest.IsolatedAsyncioTestCase):
    async def test_real_sdk_context_only_conversation_and_reset(self):
        server = MCPServer("Cooking")
        calls = []
        identifiers = iter([GUID, "22222222-2222-4222-8222-222222222222"])

        @server.tool(name="send-message")
        def send_message(message: str, conversationId: str | None = None) -> dict:
            calls.append({"message": message, "conversationId": conversationId})
            return {
                "conversationId": conversationId or next(identifiers),
                "response": [f"Received: {message}"],
            }

        async with Client(server) as client:
            tools = await discover_tools(client)
            with (
                patch("console.PromptSession") as prompts,
                contextlib.redirect_stdout(io.StringIO()) as stdout,
            ):
                prompts.return_value.prompt_async = AsyncMock(side_effect=[
                    "", "/tools", "/unknown", "Pizza", "What about the oven?",
                    "/new", "Bread", "/exit",
                ])
                await chat_loop(client, tools, 1)
        self.assertEqual(calls, [
            {"message": "Pizza", "conversationId": None},
            {"message": "What about the oven?", "conversationId": GUID},
            {"message": "Bread", "conversationId": None},
        ])
        self.assertIn("Agent> Received: What about the oven?", stdout.getvalue())
        self.assertIn("Unknown command", stdout.getvalue())
        self.assertIn("22222222-2222-4222-8222-222222222222", stdout.getvalue())
        self.assertEqual(type(prompts.call_args.kwargs["history"]).__name__, "DummyHistory")

    def test_conversation_payload_shapes_and_errors(self):
        payload = {"conversationId": GUID, "response": ["First", "Second"]}
        for result in (
            CallToolResult(content=[TextContent(type="text", text=json.dumps(payload))]),
            CallToolResult(content=[], structured_content=payload),
        ):
            self.assertEqual(conversation_reply(result), ("First\nSecond", GUID))
        invalid = (
            "not JSON", [], {}, {"conversationId": "not-a-guid", "response": ["Hi"]},
            {"conversationId": GUID, "response": []},
            {"conversationId": GUID, "response": [""]},
            {"conversationId": GUID, "response": "Hi"},
            {"conversationId": GUID, "response": [1]},
        )
        for payload in invalid:
            raw = payload if isinstance(payload, str) else json.dumps(payload)
            with self.subTest(payload=payload), self.assertRaises(SampleError):
                conversation_reply(CallToolResult(content=[TextContent(type="text", text=raw)]))

    async def test_changed_conversation_id_fails_without_retry(self):
        tool = Tool(name="send-message", input_schema={
            "type": "object", "properties": {
                "message": {"type": "string"}, "conversationId": {"type": "string"},
            }, "required": ["message"],
        })
        client = Mock(call_tool=AsyncMock(side_effect=[
            CallToolResult(content=[], structured_content={
                "conversationId": identifier, "response": ["Hi"],
            }) for identifier in (GUID, "22222222-2222-4222-8222-222222222222")
        ]))
        with (
            patch("console.PromptSession") as prompts,
            contextlib.redirect_stdout(io.StringIO()),
            self.assertRaisesRegex(SampleError, "did not preserve"),
        ):
            prompts.return_value.prompt_async = AsyncMock(side_effect=["Hi", "Follow up"])
            await chat_loop(client, [tool], 1)
        self.assertEqual(client.call_tool.await_count, 2)

    async def test_eof_does_not_invoke_tool(self):
        client = Mock(call_tool=AsyncMock())
        with (
            patch("console.PromptSession") as prompts,
            contextlib.redirect_stdout(io.StringIO()) as stdout,
        ):
            prompts.return_value.prompt_async = AsyncMock(side_effect=EOFError)
            await chat_loop(client, [Tool(name="send-message", input_schema=TOOL.input_schema)], 1)
        client.call_tool.assert_not_awaited()
        self.assertIn("Chat ended.", stdout.getvalue())

    async def test_progress_is_labeled_as_progress_not_agent_text(self):
        with contextlib.redirect_stdout(io.StringIO()) as stdout:
            await show_progress(1, 3, "Working")
        self.assertEqual(stdout.getvalue(), "\n--- MCP progress 1/3: Working ---\n\n")






class A2aStreamingTests(unittest.IsolatedAsyncioTestCase):
    def events(self):
        return [
            StreamResponse(task=Task(
                id="task1", context_id="context1",
                status=TaskStatus(state=TaskState.TASK_STATE_WORKING),
            )),
            StreamResponse(artifact_update={
                "task_id": "task1", "context_id": "context1",
                "artifact": {"artifact_id": "answer", "parts": [{"text": "Pizza"}]},
            }),
            StreamResponse(artifact_update={
                "task_id": "task1", "context_id": "context1", "append": True,
                "last_chunk": True,
                "artifact": {"artifact_id": "answer", "parts": [{"text": " dough"}]},
            }),
            StreamResponse(status_update={
                "task_id": "task1", "context_id": "context1",
                "status": {"state": TaskState.TASK_STATE_COMPLETED},
            }),
        ]

    def client(self, events):
        async def send_message(request):
            for event in events:
                yield event
        return Mock(send_message=send_message)

    def copilot_event(self, artifact_id, text):
        return ParseDict({"artifactUpdate": {
            "taskId": "task1", "contextId": "context1", "lastChunk": True,
            "artifact": {
                "artifactId": artifact_id,
                "metadata": {"mcs.sourceActivityId": artifact_id},
                "parts": [{"text": text}],
            },
        }}, StreamResponse())

    async def sdk_reply(self, events):

        def handler(request):
            payload = json.loads(request.content)
            self.assertEqual(payload["method"], "SendStreamingMessage")
            frames = [
                "data: " + json.dumps({
                    "jsonrpc": "2.0", "id": payload["id"], "result": MessageToDict(event),
                }) + "\n\n"
                for event in events
            ]
            return httpx.Response(
                200, headers={"content-type": "text/event-stream"},
                content="".join(frames).encode(),
            )

        card = AgentCard(
            name="Cooking", version="1.0", capabilities={"streaming": True},
            supported_interfaces=[
                AgentInterface(url=URL, protocol_binding="JSONRPC", protocol_version="1.0")
            ],
        )
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
            client = await create_client(card, ClientConfig(
                httpx_client=http, streaming=True, polling=False,
                supported_protocol_bindings=["JSONRPC"],
            ))
            try:
                with contextlib.redirect_stdout(io.StringIO()) as stdout:
                    reply = await invoke_streaming(client, "Pizza")
            finally:
                await client.close()
        return reply, stdout.getvalue()

    async def test_real_sdk_jsonrpc_sse_stream(self):
        reply, output = await self.sdk_reply(self.events())
        self.assertEqual(reply, Reply("Pizza dough", "context1"))
        self.assertEqual(output, "Agent> Pizza dough\n")

    async def test_real_sdk_copilot_fragments_preserve_words_and_paragraphs(self):
        events = self.events()[:1] + [
            self.copilot_event(GUID, "A ra"),
            self.copilot_event(GUID + "-1", "gù sauce."),
            self.copilot_event(GUID + "-2", "\n\n"),
            self.copilot_event(GUID + "-3", "Simmer it slowly."),
            self.copilot_event("final-answer", "A ragù sauce.\n\nSimmer it slowly."),
        ] + self.events()[-1:]
        reply, output = await self.sdk_reply(events)
        self.assertEqual(reply.text, "A ragù sauce.\n\nSimmer it slowly.")
        self.assertEqual(output, "Agent> A ragù sauce.\n\nSimmer it slowly.\n")

    async def test_copilot_fragments_are_printed_immediately(self):
        events = self.events()[:1] + [
            self.copilot_event(GUID, "Pi"),
            self.copilot_event(GUID + "-1", "zza"),
        ] + self.events()[-1:]
        with contextlib.redirect_stdout(io.StringIO()) as stdout:
            async def send_message(request):
                for index, event in enumerate(events):
                    yield event
                    if index == 1:
                        self.assertEqual(stdout.getvalue(), "Agent> Pi")
                    if index == 2:
                        self.assertEqual(stdout.getvalue(), "Agent> Pizza")
            await invoke_streaming(Mock(send_message=send_message), "Pizza")

    async def test_text_parts_keep_their_own_whitespace(self):
        events = self.events()[:1] + [StreamResponse(artifact_update={
            "task_id": "task1", "context_id": "context1",
            "artifact": {
                "artifact_id": "answer",
                "parts": [{"text": "A ra"}, {"text": "gù."}, {"text": "\n\nSlowly."}],
            },
        })] + self.events()[-1:]
        with contextlib.redirect_stdout(io.StringIO()) as stdout:
            reply = await invoke_streaming(self.client(events), "Ragu")
        self.assertEqual(reply.text, "A ragù.\n\nSlowly.")
        self.assertEqual(stdout.getvalue(), "Agent> A ragù.\n\nSlowly.\n")

    async def test_tool_banners_are_separate_from_agent_text(self):
        events = self.events()[:1] + [
            self.copilot_event("intro", "Let me check."),
            self.copilot_event("tool", "Calling web_search..."),
            self.copilot_event("tool-1", "web_search completed"),
            self.copilot_event("answer", "Here is a ra"),
            self.copilot_event("answer-1", "gù recipe."),
        ] + self.events()[-1:]
        with contextlib.redirect_stdout(io.StringIO()) as stdout:
            await invoke_streaming(self.client(events), "Ragu")
        self.assertEqual(stdout.getvalue(), (
            "Agent> Let me check.\n\n"
            "--- Tool: web_search | calling ---\n\n"
            "--- Tool: web_search | completed ---\n\n"
            "Agent> Here is a ragù recipe.\n"
        ))

    async def test_numbered_untagged_artifacts_remain_independent(self):
        events = self.events()
        events[2].artifact_update.artifact.artifact_id = "answer-1"
        events[2].artifact_update.append = False
        with contextlib.redirect_stdout(io.StringIO()) as stdout:
            reply = await invoke_streaming(self.client(events), "Pizza")
        self.assertEqual(reply.text, "Pizza\n dough")
        self.assertEqual(stdout.getvalue(), "Agent> Pizza\n\nAgent>  dough\n")

    async def test_changed_final_text_is_not_hidden(self):
        events = self.events()[:1] + [
            self.copilot_event("answer", "A recipe [doc:1]."),
            self.copilot_event("final", "A recipe [1]."),
        ] + self.events()[-1:]
        with contextlib.redirect_stdout(io.StringIO()) as stdout:
            await invoke_streaming(self.client(events), "Pizza")
        self.assertEqual(stdout.getvalue(), "Agent> A recipe [doc:1].\n\nAgent> A recipe [1].\n")

    async def test_tool_like_prose_is_not_classified_as_a_tool_notice(self):
        text = "The words Calling web_search... are an example."
        events = self.events()[:1] + [self.copilot_event("answer", text)] + self.events()[-1:]
        with contextlib.redirect_stdout(io.StringIO()) as stdout:
            await invoke_streaming(self.client(events), "Pizza")
        self.assertEqual(stdout.getvalue(), f"Agent> {text}\n")

    async def test_chunks_are_printed_before_the_stream_completes(self):
        with contextlib.redirect_stdout(io.StringIO()) as stdout:
            async def send_message(request):
                for index, event in enumerate(self.events()):
                    yield event
                    if index == 1:
                        self.assertEqual(stdout.getvalue(), "Agent> Pizza")
            await invoke_streaming(Mock(send_message=send_message), "Pizza")

    async def test_final_snapshot_does_not_duplicate_streamed_text(self):
        events = self.events()[:-1] + [StreamResponse(task=Task(
            id="task1", context_id="context1",
            status=TaskStatus(state=TaskState.TASK_STATE_COMPLETED),
            artifacts=[Artifact(artifact_id="answer", parts=[Part(text="Pizza dough")])],
        ))]
        with contextlib.redirect_stdout(io.StringIO()) as stdout:
            reply = await invoke_streaming(self.client(events), "Pizza")
        self.assertEqual(reply.text, "Pizza dough")
        self.assertEqual(stdout.getvalue(), "Agent> Pizza dough\n")

    async def test_replacement_artifacts_replace_accumulated_text(self):
        events = self.events()
        events[2].artifact_update.append = False
        events[2].artifact_update.artifact.parts[0].text = "Bread"
        with contextlib.redirect_stdout(io.StringIO()) as stdout:
            reply = await invoke_streaming(self.client(events), "Pizza")
        self.assertEqual(reply.text, "Bread")
        self.assertIn("[Artifact replaced]", stdout.getvalue())

    async def test_nontext_artifacts_do_not_add_output_or_separators(self):
        events = self.events()
        data_event = ParseDict({"artifactUpdate": {
            "taskId": "task1", "contextId": "context1",
            "artifact": {"artifactId": "metadata", "parts": [{"data": {"turnId": "turn1"}}]},
        }}, StreamResponse())
        events.insert(1, data_event)
        events.insert(-1, data_event)
        with contextlib.redirect_stdout(io.StringIO()) as stdout:
            reply = await invoke_streaming(self.client(events), "Pizza")
        self.assertEqual(reply.text, "Pizza dough")
        self.assertEqual(stdout.getvalue(), "Agent> Pizza dough\n")

    async def test_distinct_artifact_ids_are_not_heuristically_merged(self):
        events = self.events()
        events.insert(-1, StreamResponse(artifact_update={
            "task_id": "task1", "context_id": "context1",
            "artifact": {"artifact_id": "different", "parts": [{"text": "Pizza dough"}]},
        }))
        with contextlib.redirect_stdout(io.StringIO()) as stdout:
            reply = await invoke_streaming(self.client(events), "Pizza")
        self.assertEqual(reply.text, "Pizza dough\nPizza dough")
        self.assertEqual(stdout.getvalue(), "Agent> Pizza dough\n\nAgent> Pizza dough\n")

    async def test_early_eof_and_failed_tasks_are_not_success(self):
        with contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaisesRegex(SampleError, "before task completion"):
                await invoke_streaming(self.client(self.events()[:-1]), "Pizza")
            events = self.events()
            events[-1].status_update.status.state = TaskState.TASK_STATE_FAILED
            with self.assertRaisesRegex(SampleError, "TASK_STATE_FAILED"):
                await invoke_streaming(self.client(events), "Pizza")

    async def test_changed_task_and_context_ids_fail(self):
        with contextlib.redirect_stdout(io.StringIO()):
            for field in ("task_id", "context_id"):
                events = self.events()
                setattr(events[1].artifact_update, field, "other")
                with self.subTest(field=field), self.assertRaises(SampleError):
                    await invoke_streaming(self.client(events), "Pizza")

    async def test_immediate_message_is_supported(self):
        event = StreamResponse(message=new_text_message(
            "Hello", role=Role.ROLE_AGENT, context_id="context1"
        ))
        with contextlib.redirect_stdout(io.StringIO()) as stdout:
            reply = await invoke_streaming(self.client([event]), "Hello")
        self.assertEqual(reply, Reply("Hello", "context1"))
        self.assertEqual(stdout.getvalue(), "Agent> Hello\n")




if __name__ == "__main__":
    unittest.main()
