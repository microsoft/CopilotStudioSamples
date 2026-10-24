// Creates the Azure AI Search index used by the server and uploads passages.
// Usage: npm run ingest -- path/to/passages.json
// The file is a JSON array of { id, title, text, url, sourceType, version? } (same shape as src/data/passages.json).
// Split long documents into passages of a few hundred words before ingesting: the gate
// evaluates one passage per TypeSafe request, and shorter passages score more precisely.
import { readFile } from "node:fs/promises";

const endpoint = process.env.AZURE_SEARCH_ENDPOINT?.replace(/\/$/, "");
const apiKey = process.env.AZURE_SEARCH_API_KEY;
const index = process.env.AZURE_SEARCH_INDEX ?? "procedures";
const file = process.argv[2] ?? "src/data/passages.json";
const apiVersion = "2024-07-01";

if (!endpoint || !apiKey) {
  console.error("Set AZURE_SEARCH_ENDPOINT and AZURE_SEARCH_API_KEY.");
  process.exit(1);
}

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${endpoint}${path}?api-version=${apiVersion}`, {
    method,
    headers: { "Content-Type": "application/json", "api-key": apiKey! },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const semanticConfig = process.env.AZURE_SEARCH_SEMANTIC_CONFIG || "default";
await call("PUT", `/indexes/${index}`, {
  name: index,
  fields: [
    { name: "id", type: "Edm.String", key: true, filterable: true },
    { name: "title", type: "Edm.String", searchable: true },
    { name: "content", type: "Edm.String", searchable: true },
    { name: "url", type: "Edm.String", retrievable: true },
    { name: "source_type", type: "Edm.String", filterable: true, facetable: true },
    { name: "version", type: "Edm.String", filterable: true },
  ],
  semantic: {
    configurations: [
      {
        name: semanticConfig,
        prioritizedFields: { titleField: { fieldName: "title" }, prioritizedContentFields: [{ fieldName: "content" }] },
      },
    ],
  },
});

type Passage = { id: string; title: string; text: string; url: string; sourceType: string; version?: string };
const passages = JSON.parse(await readFile(file, "utf8")) as Passage[];
for (let i = 0; i < passages.length; i += 500) {
  const value = passages.slice(i, i + 500).map((p) => ({
    "@search.action": "mergeOrUpload",
    // Azure AI Search keys allow letters, digits, _ - =
    id: p.id.replace(/[^A-Za-z0-9_\-=]/g, "_"),
    title: p.title,
    content: p.text,
    url: p.url,
    source_type: p.sourceType,
    version: p.version ?? null,
  }));
  await call("POST", `/indexes/${index}/docs/index`, { value });
  console.log(`Uploaded ${Math.min(i + 500, passages.length)} / ${passages.length}`);
}
console.log(`Index "${index}" ready. Set AZURE_SEARCH_SEMANTIC_CONFIG=${semanticConfig} to use the semantic ranker.`);
