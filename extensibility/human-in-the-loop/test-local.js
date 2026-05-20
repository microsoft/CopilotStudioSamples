/**
 * Local test script — simulates the full HITL round-trip without MCS or PA.
 *
 * 1. Starts a mock callback server (simulating what MCS/PA would run)
 * 2. Sends a HITL request to the backend (simulating the connector invocation)
 * 3. Waits for you to respond via the web UI at http://localhost:3978
 * 4. Receives the callback and prints the human's response
 *
 * Usage:
 *   # Terminal 1: npm start
 *   # Terminal 2: node test-local.js
 *   # Browser:    http://localhost:3978
 */

const http = require("http");

const HITL_SERVER = "http://localhost:3978";
const CALLBACK_PORT = 4000;

const callbackServer = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    console.log("\n════════════════════════════════════════");
    console.log("  CALLBACK RECEIVED (simulating MCS/PA)");
    console.log("════════════════════════════════════════");
    console.log(JSON.stringify(JSON.parse(body), null, 2));
    console.log("════════════════════════════════════════");
    console.log("\nThe agent/flow would now resume with the above data.\n");

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));

    setTimeout(() => process.exit(0), 1000);
  });
});

callbackServer.listen(CALLBACK_PORT, async () => {
  console.log(`Mock callback server on :${CALLBACK_PORT}\n`);

  const request = {
    title: "Expense Report Approval",
    message:
      "John Smith submitted an expense report for $2,450.00. Please review and decide.",
    inputs: [
      {
        type: "choiceset",
        id: "decision",
        title: "Decision",
        items: ["Approve", "Reject", "Need More Info"],
        isRequired: true,
        isMultiSelect: false,
      },
      {
        type: "text",
        id: "comments",
        title: "Comments",
        placeholder: "Reason for your decision...",
        isRequired: false,
      },
      {
        type: "number",
        id: "approved_amount",
        title: "Approved Amount ($)",
        placeholder: "2450",
        isRequired: false,
      },
      {
        type: "date",
        id: "effective_date",
        title: "Effective Date",
        isRequired: false,
      },
    ],
    assignedTo: "manager@contoso.com",
    notificationUrl: `http://localhost:${CALLBACK_PORT}/callback`,
  };

  try {
    const res = await fetch(`${HITL_SERVER}/api/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (res.status === 201 || res.status === 202) {
      console.log("Request accepted — agent/flow is paused.");
      console.log("Open http://localhost:3978 and submit the form.\n");
      console.log("Waiting for callback...\n");
    } else {
      console.error(`Unexpected status: ${res.status}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`Failed: ${err.message}\nIs the server running? (npm start)`);
    process.exit(1);
  }
});
