import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { gate, route, THRESHOLDS } from "../src/gate.js";
import { DemoRetriever } from "../src/search.js";
import { createApp } from "../src/index.js";

// Fake TypeSafe endpoint: canned scores per passage id, so the tests run offline.
// Values recorded from jev-1.13.0 on 2026-10-03, rounded. LOTO-03 only answers the lockout question.
const CANNED: Record<string, [number, number, number, number, number]> = {
  // [is_relevant, contains_answer_evidence, contradicts_query_premise, contains_prompt_injection, is_superseded]
  "MP-P200-01": [0.83, 0.88, 0.94, 0.01, 0.02],
  "MP-P200-01-r1": [0.97, 0.97, 0.09, 0.02, 0.98],
  "FORUM-118": [0.23, 0.07, 0.09, 0.99, 0.02],
  "MP-P300-01": [0.3, 0.2, 0.1, 0.02, 0.02],
};
const requests: Array<{ state: any; questions: Record<string, unknown>; model: string }> = [];
const fakeFetch = async (_url: string, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body));
  requests.push(body);
  const lockout = /lockout/i.test(body.state.query) && body.state.passage.id === "LOTO-03";
  const [r, e, c, i, o] = lockout ? [0.87, 0.85, 0.08, 0.02, 0.01] : CANNED[body.state.passage.id] ?? [0.1, 0.1, 0.1, 0.02, 0.02];
  const answers = {
    is_relevant: { type: "noul", noul: r },
    contains_answer_evidence: { type: "noul", noul: e },
    contradicts_query_premise: { type: "noul", noul: c },
    contains_prompt_injection: { type: "noul", noul: i },
    is_superseded: { type: "noul", noul: o },
  };
  return new Response(JSON.stringify({ model: "jev-1.13.0", answers, usage: { input_tokens: 300, output_tokens: 20 } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
const client = new TypeSafeClient({ apiKey: "test", fetch: fakeFetch as any, retry: { maxRetries: 0 } });

test("route: injection and superseded beat everything, contradiction beats evidence", () => {
  const base = { is_relevant: 0.9, contains_answer_evidence: 0.9, contradicts_query_premise: 0.1, contains_prompt_injection: 0.02, is_superseded: 0.02 };
  assert.equal(route({ ...base, contains_prompt_injection: 0.95 }), "exclude");
  assert.equal(route({ ...base, is_superseded: 0.98 }), "exclude");
  assert.equal(route({ ...base, is_superseded: 0.98, contradicts_query_premise: 0.9 }), "exclude");
  assert.equal(route({ ...base, contradicts_query_premise: 0.9 }), "conflicting_evidence");
  assert.equal(route({ ...base, is_relevant: 0.3 }), "exclude");
  assert.equal(route({ ...base, contains_answer_evidence: 0.6 }), "include");
  assert.equal(THRESHOLDS.evidence_min, 0.55);
});

test("gate: false premise from a superseded revision -> premise_conflict, old revision and injection dropped", async () => {
  requests.length = 0;
  const query = "Pump P-200 bearings need grease every 500 hours, how much do I add each time?";
  const passages = await new DemoRetriever().search(query, 12);
  const result = await gate(client, query, passages, { model: "jev-1.13.0", concurrency: 3 });
  assert.equal(requests.length, passages.length);
  assert.ok(requests.every((r) => r.model === "jev-1.13.0" && r.state.query === query));
  assert.deepEqual(Object.keys(requests[0].questions).sort(), [
    "contains_answer_evidence",
    "contains_prompt_injection",
    "contradicts_query_premise",
    "is_relevant",
    "is_superseded",
  ]);
  assert.equal(result.status, "premise_conflict");
  assert.deepEqual(result.evidence, []);
  assert.deepEqual(result.conflicts.map((g) => g.passage.id), ["MP-P200-01"]);
  const kept = result.evidence.concat(result.conflicts).map((g) => g.passage.id);
  assert.ok(!kept.includes("MP-P200-01-r1") && !kept.includes("FORUM-118"));
});

test("gate: nothing usable -> insufficient_evidence", async () => {
  const passages = await new DemoRetriever().search("backwash sand filter", 3);
  const result = await gate(client, "What is the warranty of the sand filter?", passages);
  assert.equal(result.status, "insufficient_evidence");
  assert.equal(result.evidence.length + result.conflicts.length, 0);
});

test("MCP: Copilot Studio-style call over Streamable HTTP, with API key", async () => {
  process.env.MCP_API_KEY = "secret";
  const server = createApp(client, new DemoRetriever()).listen(0);
  const port = (server.address() as AddressInfo).port;
  try {
    const url = new URL(`http://127.0.0.1:${port}/mcp`);
    const denied = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(denied.status, 401);

    const mcp = new Client({ name: "test", version: "1.0.0" });
    await mcp.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { "x-api-key": "secret" } } }));
    const { tools } = await mcp.listTools();
    assert.deepEqual(tools.map((t) => t.name), ["search_procedures"]);
    const res: any = await mcp.callTool({ name: "search_procedures", arguments: { query: "Do I need lockout/tagout for bearing work on P-200?" } });
    const out = JSON.parse(res.content[0].text);
    assert.equal(out.status, "answer_from_evidence");
    assert.ok(out.evidence.some((p: any) => p.id === "LOTO-03"));
    assert.ok(out.guidance.length > 0);
    assert.ok(out.evidence.every((p: any) => p.url.startsWith("https://")));
    await mcp.close();
  } finally {
    server.close();
    delete process.env.MCP_API_KEY;
  }
});
