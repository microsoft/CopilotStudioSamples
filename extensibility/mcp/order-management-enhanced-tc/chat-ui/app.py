# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

"""
Gradio chat frontend for Copilot Studio agents.
Renders reasoning, tool calls, and messages inline with collapsible accordions.

Usage:
    pip install -r requirements.txt
    python app.py
"""

import asyncio
import json
import os
import re
from pathlib import Path

import gradio as gr
from dotenv import load_dotenv
from msal import PublicClientApplication, TokenCache

from microsoft_agents.activity import ActivityTypes
from microsoft_agents.copilotstudio.client import (
    ConnectionSettings,
    CopilotClient,
)

load_dotenv()

LOG_FILE = Path(__file__).parent / "activities.jsonl"
TOKEN_CACHE_FILE = Path(__file__).parent / ".token_cache.json"


# ---------------------------------------------------------------------------
# Persisted MSAL token cache
# ---------------------------------------------------------------------------

class LocalTokenCache(TokenCache):
    def __init__(self, path: str):
        super().__init__()
        self._path = path
        if os.path.exists(self._path):
            with self._lock:
                with open(self._path, "r") as f:
                    self._cache = json.load(f)

    def add(self, event, **kwargs):
        super().add(event, **kwargs)
        self._persist()

    def modify(self, credential_type, old_entry, new_key_value_pairs=None):
        super().modify(credential_type, old_entry, new_key_value_pairs)
        self._persist()

    def _persist(self):
        with self._lock:
            with open(self._path, "w") as f:
                json.dump(self._cache, f)


# ---------------------------------------------------------------------------
# Auth — runs once at startup, cached for subsequent runs
# ---------------------------------------------------------------------------

_cache = LocalTokenCache(str(TOKEN_CACHE_FILE))
_pca = PublicClientApplication(
    client_id=os.environ["COPILOTSTUDIOAGENT__AGENTAPPID"],
    authority=f"https://login.microsoftonline.com/{os.environ['COPILOTSTUDIOAGENT__TENANTID']}",
    token_cache=_cache,
)


def acquire_token() -> str:
    scopes = ["https://api.powerplatform.com/.default"]
    accounts = _pca.get_accounts()
    if accounts:
        result = _pca.acquire_token_silent(scopes, account=accounts[0])
        if result and "access_token" in result:
            return result["access_token"]
    result = _pca.acquire_token_interactive(scopes=scopes)
    if "access_token" in result:
        return result["access_token"]
    raise RuntimeError(result.get("error_description", "Auth failed"))


_token = acquire_token()
print(f"Authenticated. Token cached at {TOKEN_CACHE_FILE}")


def create_client() -> CopilotClient:
    global _token
    # Refresh silently if possible
    accounts = _pca.get_accounts()
    if accounts:
        result = _pca.acquire_token_silent(
            ["https://api.powerplatform.com/.default"], account=accounts[0]
        )
        if result and "access_token" in result:
            _token = result["access_token"]

    settings = ConnectionSettings(
        environment_id=os.environ["COPILOTSTUDIOAGENT__ENVIRONMENTID"],
        agent_identifier=os.environ["COPILOTSTUDIOAGENT__SCHEMANAME"],
        cloud=None,
        copilot_agent_type=None,
        custom_power_platform_cloud=None,
    )
    return CopilotClient(settings, _token)


# ---------------------------------------------------------------------------
# Activity parsing helpers
# ---------------------------------------------------------------------------

def log_activity(raw: dict, direction: str = "recv"):
    with open(LOG_FILE, "a") as f:
        f.write(json.dumps({"dir": direction, **raw}, default=str) + "\n")


def activity_to_dict(activity) -> dict:
    d = {"type": activity.type}
    for attr in ["text", "value_type", "value", "name", "entities", "channel_data",
                 "attachments", "attachment_layout", "suggested_actions"]:
        val = getattr(activity, attr, None)
        if val is not None:
            if attr == "entities" and val:
                d[attr] = [str(e) for e in val]
            elif attr == "attachments" and val:
                d[attr] = [
                    {"contentType": a.content_type, "contentUrl": (a.content_url or "")[:100],
                     "name": a.name, "hasContent": a.content is not None}
                    for a in val
                ]
            elif attr == "suggested_actions" and val:
                d[attr] = [a.title for a in val.actions] if val.actions else []
            else:
                d[attr] = val
    if hasattr(activity, "conversation") and activity.conversation:
        d["conversation_id"] = activity.conversation.id
    return d


def parse_tool_call(entity_str: str) -> dict | None:
    if "type='toolCall'" not in entity_str:
        return None
    result = {}
    for key in ["tool_call_id", "tool_name", "tool_display_name", "status", "duration_ms"]:
        m = re.search(rf"{key}='([^']*)'", entity_str)
        if m:
            result[key] = m.group(1)
    m = re.search(r"filled_parameters=\{([^}]*)\}", entity_str)
    if m:
        try:
            result["parameters"] = json.loads("{" + m.group(1).replace("'", '"') + "}")
        except json.JSONDecodeError:
            result["parameters_raw"] = m.group(1)
    m = re.search(r"result='(.+?)'\s*$", entity_str)
    if not m:
        m = re.search(r"result='(.+?)'(?:,\s*type=)", entity_str)
    if m:
        try:
            parsed = json.loads(m.group(1))
            if isinstance(parsed, dict) and "content" in parsed:
                for c in parsed["content"]:
                    if c.get("type") == "text":
                        try:
                            result["result"] = json.loads(c["text"])
                        except (json.JSONDecodeError, TypeError):
                            result["result"] = c["text"]
                        break
            else:
                result["result"] = parsed
        except json.JSONDecodeError:
            result["result_raw"] = m.group(1)[:300]
    return result


# Fields to strip from tool results (internal IDs, not useful for end users)
_HIDDEN_KEYS = {"conversation_id", "id", "botId", "bot_id", "agent_id", "is_error"}


def _format_tool_result(result) -> str:
    """Format tool result for display — show data but hide internal IDs."""
    if isinstance(result, dict):
        cleaned = {k: v for k, v in result.items() if k not in _HIDDEN_KEYS}
        if not cleaned:
            return "✅ Done"
        return json.dumps(cleaned, indent=2)
    elif isinstance(result, list):
        cleaned = []
        for item in result:
            if isinstance(item, dict):
                cleaned.append({k: v for k, v in item.items() if k not in _HIDDEN_KEYS})
            else:
                cleaned.append(item)
        return json.dumps(cleaned, indent=2)
    elif isinstance(result, str):
        return result
    return "✅ Done"


def parse_thought(entity_str: str) -> str | None:
    if "type='thought'" not in entity_str:
        return None
    m = re.search(r"text=['\"](.+?)['\"](?:\s+reasoned_for_seconds|\s*$)", entity_str)
    return m.group(1) if m else None


# ---------------------------------------------------------------------------
# Conversation state (per-process, single user demo)
# ---------------------------------------------------------------------------

_client: CopilotClient | None = None
_conversation_id: str | None = None


def ensure_client() -> CopilotClient:
    global _client
    if _client is None:
        _client = create_client()
    return _client


# ---------------------------------------------------------------------------
# Chat handler — yields gr.ChatMessage list progressively
# ---------------------------------------------------------------------------

_tool_id_counter = 0


import base64
import mimetypes
import tempfile

from microsoft_agents.activity import Activity
from microsoft_agents.activity.attachment import Attachment


def _build_attachments(files: list) -> list[Attachment]:
    """Build Bot Framework Attachments from uploaded files as base64 data URLs."""
    attachments = []
    for f in files:
        file_path = f if isinstance(f, str) else f.get("path", f.get("name", ""))
        if not file_path:
            continue
        path = Path(file_path)
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        data = path.read_bytes()
        b64 = base64.b64encode(data).decode("ascii")
        attachments.append(Attachment(
            content_type=content_type,
            content_url=f"data:{content_type};base64,{b64}",
            name=path.name,
        ))
    return attachments


async def chat_async(user_message, history: list):
    global _conversation_id, _tool_id_counter

    # Handle multimodal input (text + files)
    if isinstance(user_message, dict):
        text = user_message.get("text", "")
        files = user_message.get("files", [])
    else:
        text = str(user_message)
        files = []

    LOG_FILE.write_text("") if not _conversation_id else None
    log_activity({"type": "user_message", "text": text[:200]}, "send")

    client = ensure_client()

    # Start conversation on first message
    if _conversation_id is None:
        async for activity in client.start_conversation(True):
            if hasattr(activity, "conversation") and activity.conversation:
                _conversation_id = activity.conversation.id
            log_activity(activity_to_dict(activity), "start")

    messages = list(history)

    # Build attachments from uploaded files
    attachments = _build_attachments(files) if files else []
    has_attachments = len(attachments) > 0

    # Track tool groups: when we see tool calls between messages,
    # group them under one parent
    tool_group_id: str | None = None
    tool_count = 0

    # Send with attachments if files were uploaded, otherwise plain text
    if has_attachments:
        outgoing = Activity(
            type="message",
            text=text,
            attachments=attachments,
            conversation={"id": _conversation_id} if _conversation_id else None,
        )
        activity_stream = client.ask_question_with_activity(outgoing)
    else:
        activity_stream = client.ask_question(text, _conversation_id)

    async for activity in activity_stream:
        if not _conversation_id and hasattr(activity, "conversation") and activity.conversation:
            _conversation_id = activity.conversation.id

        log_activity(activity_to_dict(activity))

        cd = getattr(activity, "channel_data", None) or {}
        stream_type = cd.get("streamType", "")
        entities = getattr(activity, "entities", None) or []

        if activity.type == ActivityTypes.typing:
            for e in entities:
                e_str = str(e)

                # Reasoning
                thought = parse_thought(e_str)
                if thought:
                    messages.append(gr.ChatMessage(
                        role="assistant",
                        content=thought,
                        metadata={"title": "💭 Reasoning", "status": "done"},
                    ))
                    yield messages

                # Tool calls
                tc = parse_tool_call(e_str)
                if tc:
                    tool_id = tc.get("tool_call_id", "")
                    status = tc.get("status", "")
                    tool_name = tc.get("tool_display_name") or tc.get("tool_name", "tool")

                    if status == "started":
                        # Create a tool group parent if this is the first tool in a batch
                        if tool_group_id is None:
                            _tool_id_counter += 1
                            tool_group_id = f"tool_group_{_tool_id_counter}"
                            tool_count = 0

                        tool_count += 1
                        params = tc.get("parameters", tc.get("parameters_raw", ""))
                        # Show clean parameter summary
                        if isinstance(params, dict):
                            param_parts = [f"{k}={v}" for k, v in params.items()]
                            content = ", ".join(param_parts)
                        else:
                            content = str(params) if params else ""

                        messages.append(gr.ChatMessage(
                            role="assistant",
                            content=content,
                            metadata={
                                "title": f"🔧 {tool_name}",
                                "id": tool_id,
                                "parent_id": tool_group_id,
                                "status": "pending",
                            },
                        ))
                        yield messages

                    elif status == "completed":
                        # Find and update the tool message
                        for msg in messages:
                            if (isinstance(msg, gr.ChatMessage)
                                    and msg.metadata
                                    and msg.metadata.get("id") == tool_id):
                                duration = tc.get("duration_ms", "")
                                result = tc.get("result", tc.get("result_raw", ""))
                                msg.content = _format_tool_result(result)
                                msg.metadata["status"] = "done"
                                if duration:
                                    msg.metadata["duration"] = float(duration) / 1000
                                break
                        yield messages

        elif activity.type == ActivityTypes.message:
            # Check for file attachments
            activity_attachments = getattr(activity, "attachments", None) or []
            for att in activity_attachments:
                content_url = getattr(att, "content_url", "") or ""
                att_name = getattr(att, "name", "file") or "file"
                if content_url.startswith("data:"):
                    # Decode base64 data URL and save as temp file
                    try:
                        header, b64data = content_url.split(",", 1)
                        file_bytes = base64.b64decode(b64data)
                        temp_dir = tempfile.gettempdir()
                        temp_path = Path(temp_dir) / att_name
                        temp_path.write_bytes(file_bytes)
                        messages.append(gr.ChatMessage(
                            role="assistant",
                            content=gr.FileData(path=str(temp_path), mime_type=getattr(att, "content_type", "")),
                        ))
                        yield messages
                    except Exception as e:
                        messages.append(gr.ChatMessage(
                            role="assistant",
                            content=f"📎 {att_name} (download failed: {e})",
                        ))
                        yield messages

            if stream_type == "final" and activity.text:
                # Close the current tool group
                tool_group_id = None
                tool_count = 0

                messages.append(gr.ChatMessage(
                    role="assistant",
                    content=activity.text,
                ))
                yield messages

        elif activity.type == ActivityTypes.end_of_conversation:
            break


def chat(user_message: str, history: list):
    """Sync wrapper for the async chat handler."""
    loop = asyncio.new_event_loop()
    gen = chat_async(user_message, history)

    try:
        while True:
            result = loop.run_until_complete(gen.__anext__())
            yield result
    except StopAsyncIteration:
        pass
    finally:
        loop.close()


# ---------------------------------------------------------------------------
# Theme & CSS
# ---------------------------------------------------------------------------

theme = gr.themes.Base(
    primary_hue=gr.themes.Color(
        c50="#f0f9f6", c100="#d5f0e8", c200="#a8e0cf", c300="#6ec9b0",
        c400="#3bab8e", c500="#1e8c6e", c600="#187058", c700="#145845",
        c800="#104437", c900="#0c332a", c950="#06201a",
    ),
    secondary_hue=gr.themes.Color(
        c50="#fef7ee", c100="#fdedd3", c200="#f9d7a5", c300="#f4bb6d",
        c400="#ef9a33", c500="#e8801b", c600="#cf6612", c700="#ab4e12",
        c800="#893f16", c900="#713615", c950="#3d1a09",
    ),
    neutral_hue=gr.themes.Color(
        c50="#f8f9fa", c100="#f1f3f5", c200="#e5e7eb", c300="#d1d5db",
        c400="#9ca3af", c500="#6b7280", c600="#4b5563", c700="#374151",
        c800="#1f2937", c900="#111827", c950="#030712",
    ),
    font=[gr.themes.GoogleFont("Plus Jakarta Sans"), "system-ui", "sans-serif"],
    font_mono=[gr.themes.GoogleFont("IBM Plex Mono"), "ui-monospace", "monospace"],
    radius_size=gr.themes.sizes.radius_lg,
    spacing_size=gr.themes.sizes.spacing_md,
).set(
    # Overall page
    body_background_fill="#f8f9fa",
    body_background_fill_dark="#111827",

    # Blocks
    block_background_fill="white",
    block_background_fill_dark="#1f2937",
    block_border_width="0px",
    block_shadow="0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)",
    block_shadow_dark="0 1px 3px 0 rgba(0,0,0,0.4)",

    # Buttons
    button_primary_background_fill="*primary_500",
    button_primary_background_fill_hover="*primary_600",
    button_primary_text_color="white",
    button_primary_shadow="0 1px 2px 0 rgba(30,140,110,0.2)",
    button_secondary_background_fill="white",
    button_secondary_background_fill_hover="*neutral_50",
    button_secondary_border_color="*neutral_200",
    button_secondary_text_color="*neutral_700",

    # Inputs
    input_background_fill="white",
    input_background_fill_dark="#1f2937",
    input_border_color="*neutral_200",
    input_border_color_dark="*neutral_700",
    input_border_color_focus="*primary_400",
    input_shadow="none",
    input_shadow_focus="0 0 0 3px rgba(30,140,110,0.1)",

    # Labels & text
    block_label_text_color="*neutral_500",
    block_title_text_color="*neutral_800",
    block_title_text_color_dark="*neutral_200",
)

custom_css = """
/* ── Page background with subtle grid ── */
.gradio-container {
    background:
        linear-gradient(rgba(248,249,250,0.97), rgba(248,249,250,0.97)),
        linear-gradient(90deg, #e5e7eb 1px, transparent 1px),
        linear-gradient(#e5e7eb 1px, transparent 1px) !important;
    background-size: 100% 100%, 48px 48px, 48px 48px !important;
}

/* ── Chat area ── */
.chatbot {
    border: none !important;
    box-shadow: none !important;
    background: transparent !important;
}

/* ── User messages ── */
.message-row.user-row .message-bubble {
    background: #111827 !important;
    color: #f1f3f5 !important;
    border-radius: 20px 20px 4px 20px !important;
    box-shadow: 0 2px 12px rgba(17, 24, 39, 0.12) !important;
    font-size: 0.92em !important;
    line-height: 1.6 !important;
}

/* ── Bot messages ── */
.message-row.bot-row .message-bubble {
    background: white !important;
    border: 1px solid #e5e7eb !important;
    border-radius: 20px 20px 20px 4px !important;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04) !important;
    line-height: 1.65 !important;
}

/* ── Tool call accordions ── */
.message-row .accordion {
    border: 1px solid #e5e7eb !important;
    border-left: 3px solid #3bab8e !important;
    border-radius: 2px 10px 10px 2px !important;
    background: #f8f9fa !important;
    overflow: hidden;
    transition: border-color 0.2s ease !important;
}

.message-row .accordion:hover {
    border-left-color: #1e8c6e !important;
}

.message-row .accordion .label-wrap {
    padding: 10px 14px !important;
    font-size: 0.88em !important;
    font-weight: 600 !important;
    letter-spacing: 0.01em !important;
}

/* ── Code blocks in tool results ── */
.message-row pre {
    border-radius: 8px !important;
    font-size: 0.8em !important;
    border: 1px solid #e5e7eb !important;
    background: #f8f9fa !important;
}

/* ── Header area ── */
.header-bar {
    background: linear-gradient(135deg, #111827 0%, #1f2937 50%, #145845 100%) !important;
    border-radius: 16px !important;
    padding: 28px 32px !important;
    margin-bottom: 8px !important;
    border: 1px solid rgba(255,255,255,0.06) !important;
    box-shadow: 0 4px 24px rgba(17, 24, 39, 0.12), 0 1px 3px rgba(17, 24, 39, 0.08) !important;
}

.header-bar h1 {
    font-size: 1.5em !important;
    font-weight: 700 !important;
    letter-spacing: -0.03em !important;
    color: #f1f3f5 !important;
    margin: 0 0 6px 0 !important;
    line-height: 1.2 !important;
}

.header-bar p {
    color: #9ca3af !important;
    font-size: 0.9em !important;
    margin: 0 !important;
    line-height: 1.5 !important;
    font-weight: 400 !important;
}

.header-bar .badge {
    display: inline-block;
    background: rgba(62, 171, 142, 0.15);
    color: #6ec9b0;
    font-size: 0.72em;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 3px 10px;
    border-radius: 20px;
    border: 1px solid rgba(62, 171, 142, 0.2);
    margin-bottom: 10px;
}

/* ── Example buttons ── */
.example-btn {
    border-radius: 12px !important;
    font-size: 0.84em !important;
    padding: 10px 16px !important;
    border: 1px solid #e5e7eb !important;
    background: white !important;
    transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
    line-height: 1.5 !important;
    box-shadow: 0 1px 2px rgba(0,0,0,0.03) !important;
}

.example-btn:hover {
    border-color: #3bab8e !important;
    color: #1e8c6e !important;
    background: #f0f9f6 !important;
    box-shadow: 0 2px 8px rgba(30,140,110,0.08) !important;
    transform: translateY(-1px) !important;
}

/* ── Input area ── */
.textbox textarea {
    border-radius: 14px !important;
    font-size: 0.92em !important;
    padding: 12px 16px !important;
}

/* ── Markdown rendering in bot messages ── */
.message-row.bot-row .message-bubble h3 {
    font-size: 1em !important;
    font-weight: 700 !important;
    margin-top: 16px !important;
    margin-bottom: 6px !important;
    letter-spacing: -0.01em !important;
}

.message-row.bot-row .message-bubble ul,
.message-row.bot-row .message-bubble ol {
    padding-left: 1.2em !important;
    margin: 6px 0 !important;
}

.message-row.bot-row .message-bubble li {
    margin: 4px 0 !important;
    line-height: 1.55 !important;
}

.message-row.bot-row .message-bubble blockquote {
    border-left: 3px solid #d1d5db !important;
    margin: 10px 0 !important;
    padding: 6px 14px !important;
    background: #f8f9fa !important;
    border-radius: 0 8px 8px 0 !important;
    font-size: 0.92em !important;
}

.message-row.bot-row .message-bubble hr {
    border-color: #e5e7eb !important;
    margin: 14px 0 !important;
}

/* ── Scrollbar ── */
::-webkit-scrollbar {
    width: 5px;
}
::-webkit-scrollbar-track {
    background: transparent;
}
::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
}

/* ── Footer ── */
footer {
    opacity: 0.4;
    font-size: 0.85em !important;
}
"""

# ---------------------------------------------------------------------------
# Gradio UI
# ---------------------------------------------------------------------------

with gr.Blocks(title="Copilot Studio Agent Chat") as demo:
    gr.HTML("""
    <div class="header-bar">
        <div class="badge">Enhanced Task Completion</div>
        <h1>Copilot Studio Agent Chat</h1>
        <p>Agents with Enhanced Task Completion reason dynamically, chain tools across MCP servers, and process files &mdash; all visible inline below.</p>
    </div>
    """)
    gr.ChatInterface(
        fn=chat,
        multimodal=True,
        examples=[
            "Hi, I'm Sarah Mitchell. I ordered some Sony headphones recently but they arrived with a crackling sound in the left ear. I'd like to return them. Also, can you check where my other order is — the Kindle I ordered last week?",
            "I'm Emily Chen. I returned a damaged Blu-ray disc a couple weeks ago — can you check if my refund has been processed yet, and also tell me where my ergonomic chair delivery is right now?",
            "I'm James Rivera. I have two pending orders — can you give me a full status update on both? I want to know exactly where each one is in the process, when they'll ship, and if anything is out of stock, what alternatives do I have?",
            "I've uploaded a CSV with order IDs. For each order, fill in all the empty columns and return the completed CSV.",
        ],
    )

if __name__ == "__main__":
    demo.launch(theme=theme, css=custom_css)
