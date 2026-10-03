import demo from "./data/passages.json" with { type: "json" };

export interface Passage {
  id: string;
  title: string;
  text: string;
  url: string;
  sourceType: string;
}

export interface Retriever {
  name: string;
  search(query: string, top: number): Promise<Passage[]>;
}

// Azure AI Search keyword search, with the semantic ranker when a semantic configuration
// is set. Swap in hybrid (vector) search if your index has embeddings: the gate only needs
// a candidate list. Field names match scripts/ingest.ts.
export class AzureSearchRetriever implements Retriever {
  name = "azure-ai-search";
  constructor(
    private endpoint: string,
    private apiKey: string,
    private index: string,
    private semanticConfig?: string,
  ) {}

  async search(query: string, top: number): Promise<Passage[]> {
    const url = `${this.endpoint.replace(/\/$/, "")}/indexes/${encodeURIComponent(this.index)}/docs/search?api-version=2024-07-01`;
    const body: Record<string, unknown> = {
      search: query,
      top,
      select: "id,title,content,url,source_type",
    };
    if (this.semanticConfig) {
      body.queryType = "semantic";
      body.semanticConfiguration = this.semanticConfig;
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": this.apiKey },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Azure AI Search returned ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { value: Array<Record<string, string>> };
    return data.value.map((d) => ({
      id: d.id,
      title: d.title,
      text: d.content,
      url: d.url,
      sourceType: d.source_type ?? "document",
    }));
  }
}

// Small BM25 over the bundled demo corpus, so the sample runs without Azure.
export class DemoRetriever implements Retriever {
  name = "demo-corpus";
  private docs = (demo as Passage[]).map((p) => ({ p, terms: tokenize(`${p.title} ${p.text}`) }));
  private avgLen = this.docs.reduce((n, d) => n + d.terms.length, 0) / this.docs.length;

  async search(query: string, top: number): Promise<Passage[]> {
    const q = [...new Set(tokenize(query))];
    const N = this.docs.length;
    const df = new Map(q.map((t) => [t, this.docs.filter((d) => d.terms.includes(t)).length]));
    const k1 = 1.2;
    const b = 0.75;
    return this.docs
      .map(({ p, terms }) => {
        let score = 0;
        for (const t of q) {
          const tf = terms.filter((x) => x === t).length;
          if (!tf) continue;
          const n = df.get(t) ?? 0;
          const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
          score += (idf * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * terms.length) / this.avgLen));
        }
        return { p, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b2) => b2.score - a.score)
      .slice(0, top)
      .map((x) => x.p);
  }
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

export function createRetriever(env = process.env): Retriever {
  if (env.AZURE_SEARCH_ENDPOINT && env.AZURE_SEARCH_API_KEY) {
    return new AzureSearchRetriever(
      env.AZURE_SEARCH_ENDPOINT,
      env.AZURE_SEARCH_API_KEY,
      env.AZURE_SEARCH_INDEX ?? "procedures",
      env.AZURE_SEARCH_SEMANTIC_CONFIG || undefined,
    );
  }
  return new DemoRetriever();
}
