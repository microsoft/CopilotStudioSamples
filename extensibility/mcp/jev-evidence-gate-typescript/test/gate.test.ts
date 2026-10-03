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
const CANNED: Record<string, [number, number, number, number]> = {
  // [is_relevant, contains_answer_evidence, contradicts_query_premise, contains_prompt_injection]
  "MP-P200-01": [0.98, 0.97, 0.9, 0.1],
  "MP-P200-01-r1": [0.9, 0.6, 0.05, 0.1],
  "FORUM-118": [0.8, 0.3, 0.2, 0.99],
  "MP-P300-01": [0.3, 0.2, 0.1, 0.1],
};
const requests: Array<{ state: any; questions: Record<string, unknown>; model: string }> = [];
const fakeFetch = async (_url: string, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body));
  requests.push(body);
  const [r, e, c, i] = CANNED[body.state.passage.id] ?? [0.1, 0.1, 0.1, 0.1];
  const answers = {
    is_relevant: { type: "noul", noul: r },
    contains_answer_evidence: { type: "noul", noul: e },
    contradicts_query_premise: { type: "noul", noul: c },
    contains_prompt_injection: { type: "noul", noul: i },
  };
  return new Response(JSON.stringify({ model: "jev-1.13.0", answers, usage: { input_tokens: 300, output_tokens: 20 } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
const client = new TypeSafeClient({ apiKey: "test", fetch: fakeFetch as any, retry: { maxRetries: 0 } });

test("route: injection beats relevance, contradiction beats evidence", () => {
  assert.equal(route({ is_relevant: 0.9, contains_answer_evidence: 0.9, contradicts_query_premise: 0.1, contains_prompt_injection: 0.95 }), "exclude");
  assert.equal(route({ is_relevant: 0.9, contains_answer_evidence: 0.9, contradicts_query_premise: 0.9, contains_prompt_injection: 0.1 }), "conflicting_evidence");
  assert.equal(route({ is_relevant: 0.3, contains_answer_evidence: 0.9, contradicts_query_premise: 0.1, contains_prompt_injection: 0.1 }), "exclude");
  assert.equal(route({ is_relevant: 0.9, contains_answer_evidence: 0.6, contradicts_query_premise: 0.1, contains_prompt_injection: 0.1 }), "include");
  assert.equal(THRESHOLDS.evidence_min, 0.55);
});

test("gate: one request per passage, pinned model, query and passage in state", async () => {
  requests.length = 0;
  const passages = await new DemoRetriever().search("How often should I grease the P-200 bearings? Every 500 hours?", 12);
  const result = await gate(client, "Every 500 hours?", passages, { model: "jev-1.13.0", concurrency: 3 });
  assert.equal(requests.length, passages.length);
  assert.ok(requests.every((r) => r.model === "jev-1.13.0" && r.state.query === "Every 500 hours?"));
  assert.deepEqual(Object.keys(requests[0].questions).sort(), [
    "contains_answer_evidence",
    "contains_prompt_injection",
    "contradicts_query_premise",
    "is_relevant",
  ]);
  assert.equal(result.status, "answer_from_evidence");
  assert.deepEqual(result.evidence.map((g) => g.passage.id), ["MP-P200-01-r1"]);
  assert.deepEqual(result.conflicts.map((g) => g.passage.id), ["MP-P200-01"]);
  assert.ok(!result.evidence.concat(result.conflicts).some((g) => g.passage.id === "FORUM-118"));
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
    const res: any = await mcp.callTool({ name: "search_procedures", arguments: { query: "How often should I grease pump P-200 bearings?" } });
    const out = JSON.parse(res.content[0].text);
    assert.equal(out.status, "answer_from_evidence");
    assert.ok(out.guidance.length > 0);
    assert.ok(out.evidence.every((p: any) => p.url.startsWith("https://")));
    await mcp.close();
  } finally {
    server.close();
    delete process.env.MCP_API_KEY;
  }
});
