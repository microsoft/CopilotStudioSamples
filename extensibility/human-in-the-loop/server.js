const express = require("express");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// In-memory store for pending HITL requests.
// Replace with a database for production use.
const requests = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/requests
//
// Called by the custom connector when Copilot Studio or Power Automate invokes
// the "Request Human Input" action.
//
// The platform injects a callback URL into the `notificationUrl` field
// (via the x-ms-notification-url OpenAPI extension). Returning 202 tells
// the platform to pause the agent/flow and wait for a callback.
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/requests", (req, res) => {
  const { title, message, inputs, assignedTo, notificationUrl } = req.body;

  if (!notificationUrl) {
    return res.status(400).json({ error: "notificationUrl is required" });
  }

  const id = uuidv4();
  const request = {
    id,
    title: title || "Action Required",
    message: message || "",
    inputs: inputs || [],
    assignedTo: assignedTo || null,
    notificationUrl,
    status: "pending",
    createdAt: new Date().toISOString(),
    response: null,
    respondedAt: null,
  };

  requests.set(id, request);

  console.log(`[HITL] Created: ${id} — "${request.title}"`);
  console.log(`[HITL]   callback: ${notificationUrl}`);

  // 202 Accepted — the agent/flow pauses here
  res.status(202).json({ id, status: "pending" });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/requests?status=pending|completed|all
//
// Lists requests for the human console UI.
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/requests", (req, res) => {
  const status = req.query.status || "pending";
  const filtered = [...requests.values()]
    .filter((r) => status === "all" || r.status === status)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(filtered);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/requests/:id
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/requests/:id", (req, res) => {
  const request = requests.get(req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found" });
  res.json(request);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/requests/:id/respond
//
// Called by the human console UI when a person submits their response.
// We forward the response to the notificationUrl, which resumes the
// agent or flow that is waiting.
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/requests/:id/respond", async (req, res) => {
  const request = requests.get(req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found" });

  if (request.status !== "pending") {
    return res.status(409).json({ error: "Request already completed" });
  }

  const responseData = req.body;
  console.log(`[HITL] Response for ${request.id}: ${JSON.stringify(responseData)}`);

  // POST the human's response to the callback URL → resumes the agent/flow
  try {
    console.log(`[HITL] Calling back: ${request.notificationUrl}`);

    const callbackResponse = await fetch(request.notificationUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(responseData),
    });

    console.log(`[HITL] Callback status: ${callbackResponse.status}`);

    if (!callbackResponse.ok) {
      const errorBody = await callbackResponse.text().catch(() => "");
      console.error(`[HITL] Callback failed: ${callbackResponse.status} ${errorBody}`);
      return res.status(502).json({
        error: "Failed to notify caller",
        status: callbackResponse.status,
        detail: errorBody,
      });
    }

    request.status = "completed";
    request.response = responseData;
    request.respondedAt = new Date().toISOString();

    console.log(`[HITL] Completed: ${request.id}`);
    res.json({ success: true, requestId: request.id });
  } catch (err) {
    console.error(`[HITL] Callback error:`, err.message);
    res.status(502).json({
      error: "Failed to call notificationUrl",
      detail: err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/health
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  const pending = [...requests.values()].filter((r) => r.status === "pending").length;
  res.json({ status: "ok", pendingRequests: pending });
});

const PORT = process.env.PORT || 3978;
app.listen(PORT, () => {
  console.log(`[HITL] Server running on http://localhost:${PORT}`);
  console.log(`[HITL] Console UI:        http://localhost:${PORT}`);
  console.log(`[HITL] Connector endpoint: POST http://localhost:${PORT}/api/requests`);
});
