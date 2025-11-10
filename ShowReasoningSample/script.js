import { createCopilotClient } from "./copilotstudio/index.js";

const form = document.getElementById("ticket-form");
const statusNode = document.getElementById("status");
const yearNode = document.getElementById("year");
const submitButton = form.querySelector("button[type='submit']");
const apiKeyInput = form.querySelector("input[name='apiKey']");
const thinkingNode = document.getElementById("thinking");
const thinkingLabelNode = thinkingNode?.querySelector(".thinking-label");
const thinkingUpdatesNode = document.getElementById("thinking-updates");

const thinkingLabels = [
    "Copilot Studio is thinking...",
    "Checking your submission...",
    "Weaving ideas into shape...",
    "Reviewing possible options...",
    "Verifying details...",
    "Processing your request...",
    "Review in progress...",
    "Compiling results..."
];
const labelChangeIntervalMs = 3700;
const labelTransitionDurationMs = 220;
const maxThinkingUpdates = 5;

let labelIntervalId;
let labelTimeoutId;
let currentLabelIndex = 0;
let isThinkingActive = false;

let copilotClient;
let conversationId;
let initializationError;

const resolveApiKey = () => {
    // for testing you could return your API key here, otherwise get it from the HTML or, in production, implement a secure proxy/backend
    const rawKey = apiKeyInput?.value;
    return typeof rawKey === "string" ? rawKey.trim() : "";
};

// Initialize the Copilot Studio client and start a conversation
const clientReady = (async () => {
    try {
        copilotClient = await createCopilotClient();

        for await (const act of copilotClient.startConversationAsync(true)) {
            conversationId = act.conversation?.id ?? conversationId;

            if (conversationId) {
                break; // Stop once we have a conversation identifier
            }
        }
    } catch (error) {
        initializationError = error;
        console.error("Unable to initialize Copilot Studio client.", error);
    }
})();

// Thinking label management functions

const clearThinkingTimers = () => {
    if (labelIntervalId) {
        window.clearInterval(labelIntervalId);
        labelIntervalId = undefined;
    }
    if (labelTimeoutId) {
        window.clearTimeout(labelTimeoutId);
        labelTimeoutId = undefined;
    }
};

const applyThinkingLabel = (label, { immediate = false } = {}) => {
    if (!thinkingLabelNode) {
        return;
    }

    if (immediate) {
        thinkingLabelNode.textContent = label;
        thinkingLabelNode.classList.remove("thinking-label--changing");
        return;
    }

    thinkingLabelNode.classList.add("thinking-label--changing");

    if (labelTimeoutId) {
        window.clearTimeout(labelTimeoutId);
    }

    labelTimeoutId = window.setTimeout(() => {
        thinkingLabelNode.textContent = label;
        thinkingLabelNode.classList.remove("thinking-label--changing");
        labelTimeoutId = undefined;
    }, labelTransitionDurationMs);
};

const startThinkingRotation = () => {
    if (!thinkingLabelNode || thinkingLabels.length <= 1) {
        return;
    }

    labelIntervalId = window.setInterval(() => {
        currentLabelIndex = (currentLabelIndex + 1) % thinkingLabels.length;
        applyThinkingLabel(thinkingLabels[currentLabelIndex]);
    }, labelChangeIntervalMs);
};

const resetThinkingUpdates = () => {
    if (!thinkingUpdatesNode) {
        return;
    }

    thinkingUpdatesNode.replaceChildren();
};

const addThinkingUpdate = (updateText) => {
    if (!thinkingUpdatesNode || !isThinkingActive) {
        return;
    }

    const normalized = typeof updateText === "string" ? updateText.trim() : "";
    if (!normalized) {
        return;
    }

    const updateNode = document.createElement("div");
    updateNode.className = "thinking-update thinking-update--fresh";
    updateNode.textContent = normalized;
    thinkingUpdatesNode.prepend(updateNode);

    while (thinkingUpdatesNode.children.length > maxThinkingUpdates) {
        thinkingUpdatesNode.removeChild(thinkingUpdatesNode.lastElementChild);
    }

    const finalizeAnimation = () => updateNode.classList.remove("thinking-update--fresh");
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(finalizeAnimation);
    } else {
        setTimeout(finalizeAnimation, 260);
    }
};

const setThinking = (isVisible) => {
    if (!thinkingNode) {
        return;
    }

    clearThinkingTimers();

    if (isVisible) {
        isThinkingActive = true;
        resetThinkingUpdates();
        submitButton.hidden = true;
        thinkingNode.hidden = false;
        currentLabelIndex = 0;
        applyThinkingLabel(thinkingLabels[currentLabelIndex], { immediate: true });
        startThinkingRotation();
        return;
    }

    isThinkingActive = false;
    resetThinkingUpdates();
    thinkingNode.hidden = true;
    submitButton.hidden = false;
    currentLabelIndex = 0;
    applyThinkingLabel(thinkingLabels[currentLabelIndex], { immediate: true });
};

// Status result message management

const setStatus = (message, type, asHtml = false) => {
    statusNode.className = `status${type ? ` ${type}` : ""}`;
    if (asHtml) {
        statusNode.innerHTML = message;
    } else {
        statusNode.textContent = message;
    }
};

const summarize = async (textToSummarize) => {
    const resolvedKey = resolveApiKey();

    if (!resolvedKey) {
        throw new Error("Azure OpenAI API key is missing.");
    }

    const payload = {
        "messages": [
            { "role": "system", "content": "You summarize any message received in no more than 10 words. You need to maintain their original sense, but no more than 10 words per summary. Some examples: 1) \"The user wants to create a new ticket with:\n- Title: \u0022VPN outage in germany\u0022\n- Description: \u0022all operations blocked open ticket\u0022\n\nAccording to the instructions, before creating a new ticket, I need to:\n1. Check if there is an existing ticket that is semantically similar\n2. If a similar ticket exists, don\u0027t create a new one - instead add a comment to the existing ticket and update its title\n3. If no similar ticket exists, proceed to create a new one\n\nThe ticket should be created in the \u0022Unassigned Tickets\u0022 category (which is a group on the website issue tracker board).\n\nFirst, I need to find the board and check for existing similar tickets. I should search for tickets related to VPN, Germany, or outages.\n\nLet me start by getting board information to understand the structure, then search for existing similar tickets.\n\nWait, I don\u0027t have a specific board ID yet. I need to either:\n1. List workspaces to find the right board\n2. Or try to search for items related to VPN/Germany\n\nActually, looking at the instructions again, it mentions \u0022website issue tracker board\u0022 - this seems to be a specific board. But I don\u0027t have the board ID.\n\nLet me think about the approach:\n1. I could list workspaces to find the board\n2. Or I could try to search broadly\n\nActually, I don\u0027t have enough context about which board to use. But the instructions mention \u0022website issue tracker board\u0022 and \u0022Unassigned Tickets\u0022 group. \n\nLet me start by listing workspaces to find the appropriate board, or I could ask the user for the board ID. But according to the instructions, I should not ask for missing inputs and should call tools without them.\n\nHmm, but I need a board ID to check for existing tickets and to create new ones. Let me list workspaces first to find the right board.\" should become \"User wants a new ticket about VPN outage. Let me seek into the workspace for a similar one.\" 2) \"I\u0027ll help you create this ticket. First, let me check if there are any existing similar tickets related to VPN outages or issues in Germany to avoid duplicates.\" becomes \"Checking for duplicates related to VPN outages in Germany...\" 3) \"Good, I found a workspace called \u0022Tickets queue\u0022 with ID 5124896. Now I need to get the boards within this workspace to find the \u0022website issue tracker board\u0022 or the relevant board where tickets are tracked.\" becomes \"Found 'tickets queue' workspace. Let me seek for a website issue tracker board" },
            { "role": "user", "content": textToSummarize }
        ],
        "max_completion_tokens": 5000,
        "temperature": 1,
        "top_p": 1,
        "frequency_penalty": 0,
        "presence_penalty": 0,
        "model": "gpt-4.1-mini"
    };
    const endpoint = "YOUR-AOAI-ENDPOINT/chat/completions?api-version=2025-01-01-preview";
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resolvedKey}`
        },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        throw new Error(`OpenAI request failed: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error("OpenAI response did not contain a summary.");
    }

    return content;
};

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const shortTitle = form.shortTitle.value;
    const longDescription = form.longDescription.value;

    setThinking(true);
    submitButton.disabled = true;

    try {
        await clientReady;

        const prompt = `Create the following ticket:\n\nTitle: ${shortTitle}\nDescription: ${longDescription}`;
        const activityStream = copilotClient.askQuestionAsync(prompt, conversationId);

        const agentMessages = [];
        const thinkingMessages = [];
        const streamLastActivity = new Map();

        const resolveStreamKey = (activity) => {
            if (!activity) {
                return "stream:__unidentified";
            }

            const streamId = activity.channelData?.streamId;
            if (streamId) {
                return `stream:${streamId}`;
            }

            const activityId = activity.id;
            if (activityId) {
                return `activity:${activityId}`;
            }

            return "stream:__default";
        };

        const normalizeActivityText = (text) => (typeof text === "string" ? text.trim() : "");

        const isContinuationOfPrevious = (previousActivity, nextActivity) => {
            const previousText = normalizeActivityText(previousActivity?.text);
            const nextText = normalizeActivityText(nextActivity?.text);

            if (!previousText || !nextText) {
                return false;
            }

            return nextText.startsWith(previousText);
        };

        const isRegressionOf = (previousText, nextActivity) => {
            const nextText = normalizeActivityText(nextActivity?.text);

            if (!previousText || !nextText) {
                return false;
            }

            return previousText.startsWith(nextText);
        };

        const flushActivity = async (activityToFlush, recordForUi = false) => {
            const finalText = activityToFlush?.text?.trim();

            if (!finalText) {
                return;
            }

            if (recordForUi) {
                agentMessages.push(finalText);
            } else {
                thinkingMessages.push(finalText);
                try {
                    const summary = await summarize(finalText);
                    addThinkingUpdate(summary);
                } catch (summaryError) {
                    console.error("Unable to summarize activity text.", summaryError);
                }
            }
        };

        for await (const activity of activityStream) {
            if (!activity) {
                continue;
            }

            const activityType = activity.type?.toLowerCase();
            if (activityType === "event") {
                continue;
            }

            if (activityType === "typing" && activity.channelData?.streamType === "informative") {
                const streamKey = resolveStreamKey(activity);
                const previousActivity = streamLastActivity.get(streamKey);

                if (previousActivity) {
                    if (isContinuationOfPrevious(previousActivity, activity)) {
                        streamLastActivity.set(streamKey, activity);
                        continue;
                    }

                    if (isRegressionOf(thinkingMessages[0], activity)) {
                        continue;
                    }
                    await flushActivity(previousActivity, false);
                }

                streamLastActivity.set(streamKey, activity);
                continue;
            }

            if (activityType === "message") {
                for (const [streamKey, pendingActivity] of Array.from(streamLastActivity.entries())) {
                    if (pendingActivity?.type?.toLowerCase() === "typing" && !isRegressionOf(thinkingMessages[0], pendingActivity)) {
                        await flushActivity(pendingActivity, false);
                    }
                    streamLastActivity.delete(streamKey);
                }

                const messageText = normalizeActivityText(activity.text);
                if (messageText) {
                    agentMessages.push(messageText);
                }
                continue;
            }
        }

        for (const activity of streamLastActivity.values()) {
            if (activity?.type?.toLowerCase() === "typing") {
                await flushActivity(activity, true);
            }
        }

        // Handle HTML formatting in agent messages
        const formattedMessages = agentMessages.map((message) => {
            const content = message.includes("<") ? message : message.replace(/\n/g, "<br>");
            return `<div class="agent-message">${content}</div>`;
        });

        const htmlResponse = formattedMessages.length > 0
            ? formattedMessages.join("<div class=\"agent-divider\" role=\"presentation\"></div>")
            : "<div class=\"agent-message\">Ticket summary sent. Awaiting agent response.</div>";

        setStatus(htmlResponse, "success", true);
        form.reset();

    } catch (error) {
        setStatus("We could not relay this ticket to the Copilot agent. Refresh and try again.", "error");
        console.error(error);
    } finally {
        setThinking(false);
        submitButton.disabled = false;
    }
});

yearNode.textContent = new Date().getFullYear();

applyThinkingLabel(thinkingLabels[currentLabelIndex], { immediate: true });
