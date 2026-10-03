import { appendFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { GateResult, Route, Scores } from "./gate.js";

// One record per answer: enough to reproduce why the agent answered, flagged a conflict or
// abstained, and to replay the decision with new thresholds without calling Jev again
// (route() only reads the stored scores). See scripts/replay.ts.
export interface AuditRecord {
  audit_id: string;
  timestamp: string;
  query: string;
  model: string;
  status: GateResult["status"];
  thresholds: GateResult["thresholds"];
  input_tokens: number;
  gate_ms: number;
  passages: Array<{
    id: string;
    title: string;
    url: string;
    version?: string;
    source_type: string;
    route: Route;
    scores: Scores;
  }>;
}

export function buildAuditRecord(query: string, result: GateResult): AuditRecord {
  return {
    audit_id: randomUUID(),
    timestamp: new Date().toISOString(),
    query,
    model: result.model,
    status: result.status,
    thresholds: result.thresholds,
    input_tokens: result.input_tokens,
    gate_ms: result.ms,
    passages: result.gated.map((g) => ({
      id: g.passage.id,
      title: g.passage.title,
      url: g.passage.url,
      version: g.passage.version,
      source_type: g.passage.sourceType,
      route: g.route,
      scores: g.scores,
    })),
  };
}

// Appends the record as one JSON line when AUDIT_LOG_PATH is set. In production, send it to
// your logging pipeline instead (Application Insights, a storage table) and keep in mind that
// it contains the user's question.
export async function writeAuditRecord(record: AuditRecord, path = process.env.AUDIT_LOG_PATH): Promise<void> {
  if (!path) return;
  await appendFile(path, JSON.stringify(record) + "\n", "utf8");
}
