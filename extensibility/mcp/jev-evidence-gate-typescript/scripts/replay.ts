// Replays past decisions from the audit log with the current thresholds, without calling Jev.
// Usage: npm run replay -- audit.jsonl
// Set GATE_*_MIN / GATE_*_MAX to try new thresholds; the script lists the passages whose route
// would change and the answers whose status would change.
import { readFile } from "node:fs/promises";
import { route, type GateStatus } from "../src/gate.js";
import type { AuditRecord } from "../src/audit.js";

const file = process.argv[2] ?? process.env.AUDIT_LOG_PATH;
if (!file) {
  console.error("Usage: npm run replay -- path/to/audit.jsonl");
  process.exit(1);
}

const records = (await readFile(file, "utf8"))
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line) as AuditRecord);

let changedAnswers = 0;
for (const r of records) {
  const rerouted = r.passages.map((p) => ({ ...p, newRoute: route(p.scores) }));
  const status: GateStatus = rerouted.some((p) => p.newRoute === "include")
    ? "answer_from_evidence"
    : rerouted.some((p) => p.newRoute === "conflicting_evidence")
      ? "premise_conflict"
      : "insufficient_evidence";
  const moved = rerouted.filter((p) => p.newRoute !== p.route);
  if (!moved.length && status === r.status) continue;
  if (status !== r.status) changedAnswers++;
  console.log(`${r.timestamp} ${r.audit_id} "${r.query}"`);
  console.log(`  status: ${r.status} -> ${status}`);
  for (const p of moved) console.log(`  ${p.id}${p.version ? ` (${p.version})` : ""}: ${p.route} -> ${p.newRoute}`);
}
console.log(`${records.length} answers replayed, ${changedAnswers} would change status.`);
