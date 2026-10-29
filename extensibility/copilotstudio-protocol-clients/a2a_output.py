"""Plain terminal output for A2A artifacts."""

import re
from dataclasses import dataclass, field

from a2a.types import AgentCard, Artifact, Message, Role, Task

from config import SampleError


def show_skills(card: AgentCard) -> None:
    # Skills describe the agent's capabilities.
    print(f"Agent: {card.name}\nAdvertised skills:")
    for skill in card.skills:
        print(f"  - {skill.name} [{skill.id}]: {skill.description}")


def message_text(message: Message) -> str:
    if message.role != Role.ROLE_AGENT:
        raise SampleError("A2A returned a message that is not from the agent.")
    text = "".join(part.text for part in message.parts)
    if not text.strip():
        raise SampleError("A2A returned no agent text.")
    return text


def completed_text(task: Task) -> str:
    # Status and history can also contain the final response.
    if task.status.HasField("message") and task.status.message.role == Role.ROLE_AGENT:
        return message_text(task.status.message)
    for message in reversed(task.history):
        if message.role == Role.ROLE_AGENT:
            return message_text(message)
    raise SampleError("A2A task completed without an agent text response.")


def tool_notice(text: str) -> tuple[str, str] | None:
    """Recognize complete server-reported tool activity notices."""
    name = r"([A-Za-z_][A-Za-z0-9_.:/-]*)"
    for pattern, phase in (
        (rf"Calling {name}\.\.\.", "calling"),
        (rf"{name} completed", "completed"),
    ):
        match = re.fullmatch(pattern, text)
        if match:
            return match.group(1), phase
    return None


@dataclass
class A2AStreamOutput:
    chunks: dict[str, dict[str, str]] = field(default_factory=dict)
    artifact_groups: dict[str, str] = field(default_factory=dict)
    copilot_groups: set[str] = field(default_factory=set)
    printed_text: dict[str, str] = field(default_factory=dict)
    last_group: str | None = None
    line_open: bool = False

    def finish_line(self) -> None:
        if self.line_open:
            print(flush=True)
            self.line_open = False

    def message(self, text: str) -> None:
        self.finish_line()
        if self.printed_text:
            print(flush=True)
        print("Agent> " + text, end="", flush=True)
        self.line_open = True

    def update(self, artifact: Artifact, append: bool) -> None:
        artifact_id = artifact.artifact_id
        if not artifact_id:
            raise SampleError("A2A stream returned an artifact without an ID.")
        text = "".join(part.text for part in artifact.parts if part.text)
        incoming_notice = tool_notice(text)
        if artifact_id not in self.artifact_groups:
            group = artifact_id
            source = artifact.metadata.fields.get("mcs.sourceActivityId")
            copilot = source is not None and source.string_value == artifact_id
            if copilot:
                # Copilot Studio numbers the artifacts containing fragments of one activity.
                root, _, suffix = artifact_id.rpartition("-")
                if (
                    not incoming_notice and root in self.copilot_groups
                    and suffix == str(len(self.chunks[root]))
                    and tool_notice("".join(self.chunks[root].values())) is None
                ):
                    group = root
                self.copilot_groups.add(group)
            self.artifact_groups[artifact_id] = group
            self.chunks.setdefault(group, {})
        group = self.artifact_groups[artifact_id]
        chunks = self.chunks[group]
        chunks[artifact_id] = chunks.get(artifact_id, "") + text if append else text
        current = "".join(chunks.values())
        previous = self.printed_text.get(group, "")
        if current == previous:
            return
        # A final Copilot Studio activity can repeat the text just streamed under another ID.
        if (
            group not in self.printed_text and group in self.copilot_groups
            and self.last_group in self.copilot_groups
            and current == self.printed_text.get(self.last_group or "")
        ):
            return
        notice = tool_notice(current)
        if notice and not previous and group in self.copilot_groups:
            self.finish_line()
            if self.printed_text:
                print(flush=True)
            name, phase = notice
            print(f"--- Tool: {name} | {phase} ---", flush=True)
        else:
            delta = current[len(previous):] if current.startswith(previous) else (
                "\n[Artifact replaced]\n" + current
            )
            if self.last_group != group or not self.line_open:
                self.message(delta)
            else:
                print(delta, end="", flush=True)
        self.printed_text[group] = current
        self.last_group = group

    def text(self) -> str:
        return "\n".join(text for text in self.printed_text.values() if text.strip())
