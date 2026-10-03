---
title: Jev Evidence Gate
parent: MCP
grand_parent: Extensibility
nav_order: 4
---
# Jev Evidence Gate: answer or abstain over a large document library

An MCP server that lets a Copilot Studio agent answer questions over a large procedure library (thousands of documents) **only when a retrieved passage actually supports the answer**. It retrieves candidate passages from Azure AI Search, asks [TypeSafe Jev](https://docs.typesafe.ai/) four calibrated yes/no questions about each one, and routes them in code: evidence, conflicting evidence, or dropped. The agent receives the surviving passages and a `status` that tells it whether to answer, push back on the question, or say that no reliable document was found.

The scenario is a field maintenance assistant for a (fictional) water utility, Contoso Water: technicians ask about pumps, filters, drives and safety procedures from Teams. Near-identical documents are the norm (two pump models, a superseded revision, a forum note), and a wrong answer has safety consequences.

> The procedures in `src/data/passages.json` are fictional and exist only to exercise the pipeline. Do not use them for real maintenance work.

## Why a gate between retrieval and the answer

Search ranks passages by how much their wording resembles the question. In a large library, the top results often include the right procedure for the wrong model, a superseded revision, or text that tries to instruct the model. Re-ranking reorders those results but still hands the top few to the answering model.

This sample adds a decision step, following the TypeSafe cookbook [Classifying RAG passages](https://docs.typesafe.ai/cookbooks/classifying_rag_passages):

| Question asked to Jev for each (query, passage) pair | Drives |
|---|---|
| `is_relevant`: does the passage address the subject of the query? | relevance floor |
| `contains_answer_evidence`: does it state information usable in a direct answer? | include or drop |
| `contradicts_query_premise`: does it conflict with a factual premise in the query? | conflict block |
| `contains_prompt_injection`: does it try to control the system answering? | excluded outright |

None of the questions asks "should I include this passage". Jev returns probabilities, and `route()` in [`src/gate.ts`](./src/gate.ts) applies thresholds in a fixed order. Changing the policy means editing a number under code review, not rewording a prompt.

## Architecture

```
Copilot Studio agent (generative orchestration)
        │  MCP, Streamable HTTP
        ▼
search_procedures(query)
        │
        ├─ 1. Azure AI Search: top N candidates (keyword + optional semantic ranker)
        ├─ 2. TypeSafe Jev: one request per candidate, 4 Noul questions, run in parallel
        ├─ 3. route() in code: include / conflicting_evidence / exclude
        ▼
{ status, guidance, evidence[], conflicts[], excluded_passages }
        │
        ▼
Agent answers from evidence with citations, reports conflicts, or abstains
```

`status` is one of:

| status | Meaning | What the agent does |
|---|---|---|
| `answer_from_evidence` | at least one passage supports an answer | answers from `evidence`, cites title and URL, mentions `conflicts` |
| `premise_conflict` | no supporting passage, but a document contradicts the question | does not answer as asked, quotes the conflicting passage |
| `insufficient_evidence` | nothing usable | says no reliable document was found, offers to rephrase or escalate |

The tool output also carries a `guidance` string with these instructions, so the behaviour holds even if the agent instructions are short.

## Sample structure

```
src/
├── index.ts        # Express + MCP Streamable HTTP server, search_procedures tool, optional API key
├── gate.ts         # Jev questions, thresholds, route(), tool output
├── search.ts       # Azure AI Search retriever + BM25 demo retriever
└── data/
    └── passages.json   # 12 fictional procedures, including near-duplicates and a planted injection
scripts/
└── ingest.ts       # Creates the Azure AI Search index and uploads passages
test/
└── gate.test.ts    # Offline tests with a fake TypeSafe endpoint, including an MCP client round trip
```

## Quick start

### Prerequisites

- Node.js 20+
- A TypeSafe API key ([console.typesafe.ai](https://console.typesafe.ai/))
- Copilot Studio access
- [Dev Tunnels CLI](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/get-started) for local testing
- Optional: an Azure AI Search service (Basic tier or above for the semantic ranker)

### 1. Install, test and build

```bash
npm install
npm test        # runs offline, no API key needed
npm run build
```

### 2. Configure

Copy `.env.example` to `.env` and set at least `TYPESAFE_API_KEY`. Without the Azure variables, the server searches the bundled demo corpus.

To use your own library, split documents into passages of a few hundred words, export them as a JSON array with the same shape as `src/data/passages.json`, and run:

```bash
npm run ingest -- path/to/passages.json
```

### 3. Start the server and a tunnel

```bash
node --env-file=.env build/index.js
devtunnel host -p 3000 --allow-anonymous
```

The MCP endpoint is `https://<tunnel-id>-3000.<region>.devtunnels.ms/mcp`.

### 4. Add the tool in Copilot Studio

1. Open your agent → **Tools** → **Add a tool** → **New tool** → **Model Context Protocol**.
2. Server name: `Procedure library`. Server description: `Searches the maintenance and safety procedure library and returns only passages that support an answer.` The orchestrator uses this description to decide when to call the server.
3. Server URL: your tunnel URL ending in `/mcp`.
4. Authentication: **None**, or **API key** → **Header** → `x-api-key` if you set `MCP_API_KEY`.
5. Create the connection and add the tool to the agent.
6. In the agent's generative AI settings, turn off general knowledge and web search so the agent cannot answer from outside the library.
7. Add instructions such as:

   ```
   You help field technicians with maintenance and safety procedures.
   For any question about equipment, maintenance or safety, call search_procedures first
   and follow the guidance field of its result. Never answer from memory.
   Cite the title and URL of each passage you use.
   ```

## Example questions (demo corpus)

| Question | Expected behaviour |
|---|---|
| How often should I grease the bearings on pump P-200? | answers with MP-P200-01 (2,000 h). The P-300 procedure and the superseded revision should not be used as evidence |
| Pump P-200 bearings need grease every 500 hours, how much do I add each time? | flags the premise: the current revision says 2,000 h |
| Do I need lockout/tagout for bearing work on P-200? | answers from LOTO-03 / MP-P200-02; the forum note with the injected instruction is excluded |
| What is the warranty on the sand filters? | `insufficient_evidence`: no document covers it |

Exact scores depend on the model version; check the server log, which prints the status and the number of passages kept for each call.

## Thresholds and model version

The default thresholds come from the cookbook and are a starting point, not defaults to trust. Tune them on a set of real questions from your users (`GATE_RELEVANT_MIN`, `GATE_EVIDENCE_MIN`, `GATE_CONTRADICTS_MIN`, `GATE_INJECTION_MAX`) and pin `TYPESAFE_MODEL` to a version ID such as `jev-1.13.0`: the `jev-latest` alias moves when a new model ships, which can shift the probabilities your thresholds were tuned on.

`GATE_CANDIDATES` (default 12) sets how many passages are gated per question. Each candidate is one TypeSafe request, so cost and rate-limit usage scale with it; see [Models](https://docs.typesafe.ai/models) for current pricing and limits. The TypeSafe SDK retries `429` and `529` responses with backoff.

## Limitations

- **Language.** TypeSafe documents English as Jev's primary language; other languages are supported but less accurate. Measure on your own content before relying on the gate for a non-English library, and expect to tune thresholds per language.
- **Not a security boundary.** The injection question is a filter. Passages below the threshold still reach the agent, so the agent must treat passage text as untrusted content.
- **Retrieval recall still matters.** The gate can only keep what search returns. If the right passage is not in the top `GATE_CANDIDATES`, the agent abstains instead of answering wrongly, which is the intended failure mode.
- **Dev Tunnels** are for testing. Host the server (for example on Azure Container Apps or App Service) and use API key or OAuth authentication in production.

## Resources

- [Classifying RAG passages (TypeSafe cookbook)](https://docs.typesafe.ai/cookbooks/classifying_rag_passages)
- [TypeSafe API reference](https://docs.typesafe.ai/api)
- [Add an existing MCP server to an agent](https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-add-existing-server-to-agent)
- [Semantic ranking in Azure AI Search](https://learn.microsoft.com/en-us/azure/search/semantic-search-overview)
- [Model Context Protocol](https://modelcontextprotocol.io/)
