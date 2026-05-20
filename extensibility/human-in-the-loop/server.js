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
// POST /api/requests/$subscriptions
//
// Called by the custom connector when Copilot Studio or Power Automate invokes
// the "Request Human Input" action.
//
// The platform injects a callback URL into the `notificationUrl` field
// (via the x-ms-notification-url OpenAPI extension). Returning 201 tells
// the platform to pause the agent/flow and wait for a callback.
// ─────────────────────────────────────────────────────────────────────────────
function handleCreateRequest(req, res) {
  const { notificationUrl, body: innerBody } = req.body;
  const { title, message, inputs, assignedTo } = innerBody || req.body;

  if (!notificationUrl) {
    return res.status(400).json({ error: "notificationUrl is required" });
  }

  // Validate notificationUrl — only allow HTTPS callbacks to Power Platform domains
  try {
    const url = new URL(notificationUrl);
    if (url.protocol !== "https:") {
      return res.status(400).json({ error: "notificationUrl must use HTTPS" });
    }
  } catch {
    return res.status(400).json({ error: "notificationUrl is not a valid URL" });
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

  // 201 Created — matches the Teams connector pattern (webhook action, not trigger)
  // Location header for webhook unsubscribe
  res.setHeader("Location", `/api/requests/${id}`);
  res.status(201).json({ id, status: "pending" });
}

app.post("/api/requests/\\$subscriptions", handleCreateRequest);
app.post("/api/requests", handleCreateRequest);

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

  // Don't expose notificationUrl to the browser
  res.json(filtered.map(({ notificationUrl, ...rest }) => rest));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/requests/:id
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/requests/:id", (req, res) => {
  const request = requests.get(req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found" });
  const { notificationUrl, ...rest } = request;
  res.json(rest);
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

  // Mark as processing immediately to prevent double-submit
  request.status = "processing";

  const responseData = req.body;
  console.log(`[HITL] Response for ${request.id}: ${JSON.stringify(responseData)}`);

  // POST the human's response to the callback URL → resumes the agent/flow
  try {
    console.log(`[HITL] Calling back: ${request.notificationUrl}`);

    // POST body must match x-ms-notification-content schema
    const callbackBody = {
      id: request.id,
      status: "completed",
      response: responseData,
      responseText: responseData.response || responseData[Object.keys(responseData)[0]] || "",
      respondedAt: new Date().toISOString(),
    };

    const callbackResponse = await fetch(request.notificationUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(callbackBody),
    });

    console.log(`[HITL] Callback status: ${callbackResponse.status}`);

    if (!callbackResponse.ok) {
      console.error(`[HITL] Callback failed: ${callbackResponse.status}`);
      request.status = "pending"; // Roll back so user can retry
      return res.status(502).json({
        error: "Failed to notify caller",
        status: callbackResponse.status,
      });
    }

    request.status = "completed";
    request.response = responseData;
    request.respondedAt = new Date().toISOString();

    console.log(`[HITL] Completed: ${request.id}`);
    res.json({ success: true, requestId: request.id });
  } catch (err) {
    console.error(`[HITL] Callback error:`, err.message);
    request.status = "pending"; // Roll back so user can retry
    res.status(502).json({
      error: "Failed to call notificationUrl",
      detail: err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/requests/:id
//
// Called by Power Platform to unsubscribe/cancel a webhook registration.
// Required by the connector validation.
// ─────────────────────────────────────────────────────────────────────────────
app.delete("/api/requests/:id", (req, res) => {
  const request = requests.get(req.params.id);
  if (request) {
    console.log(`[HITL] Cancelled: ${request.id}`);
  }
  requests.delete(req.params.id);
  res.status(200).json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/health
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  const pending = [...requests.values()].filter((r) => r.status === "pending").length;
  res.json({ status: "ok", pendingRequests: pending });
});

// ─────────────────────────────────────────────────────────────────────────────
// Auto-expire: remove requests older than 30 minutes.
// If PA times out without calling DELETE, this cleans up stale entries.
// ─────────────────────────────────────────────────────────────────────────────
const EXPIRY_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, request] of requests.entries()) {
    if (now - new Date(request.createdAt).getTime() > EXPIRY_MS) {
      requests.delete(id);
      console.log(`[HITL] Expired: ${id} (${request.title})`);
    }
  }
}, 60 * 1000);

const PORT = process.env.PORT || 3978;
app.listen(PORT, () => {
  console.log(`[HITL] Server running on http://localhost:${PORT}`);
  console.log(`[HITL] Console UI:        http://localhost:${PORT}`);
  console.log(`[HITL] Connector endpoint: POST http://localhost:${PORT}/api/requests`);
});
