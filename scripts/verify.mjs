// verify.mjs — Phase 5 VERIFY. Verifier TỰ TÍNH LẠI từ canonical + chạy guards (engine.runChecks).
// Giữ contract output {summary,checks,recompute} + exit code cho orchestrate.mjs & màn G1 demo.
import path from "node:path";
import fs from "node:fs";
import { ROOT, loadCanonical, loadJSON, writeJSON } from "./lib.mjs";
import { runChecks } from "./engine.mjs";

export function verify(ticker, { tag = "" } = {}) {
  const rubric = loadJSON(path.join(ROOT, "done.rubric.json"));
  const c = loadCanonical(ticker);
  const specPath = path.join(ROOT, "artifacts", `spec-${ticker}.json`);
  const declared = fs.existsSync(specPath) ? loadJSON(specPath) : {};
  const repPath = path.join(ROOT, "reports", `${ticker}-analysis.md`);
  const report = fs.existsSync(repPath) ? fs.readFileSync(repPath, "utf8") : "";

  const { checks, recompute, criticalFail, anyFail } = runChecks({ canonical: c, declared, report, rubric });
  const verdict = criticalFail ? "fail" : anyFail ? "soft-fail" : "pass";

  const out = {
    ticker, as_of: c.as_of, tag, ts: new Date().toISOString(),
    recompute: { forwardPE_headline: recompute.forwardPE, fy: recompute.fy, cagr_pct: recompute.cagr_pct, pegForward: recompute.pegForward, vendor_pegTTM: recompute.vendor_pegTTM },
    checks,
    summary: { critical_fail: criticalFail, total_fail: anyFail, verdict },
  };
  const fname = tag ? `verifier-report-${ticker}.${tag}.json` : `verifier-report-${ticker}.json`;
  writeJSON(path.join(ROOT, "artifacts", fname), out);
  return out;
}

if (process.argv[1] && process.argv[1].endsWith("verify.mjs")) {
  const t = process.argv[2];
  if (!t) { console.error("usage: node verify.mjs <TICKER> [tag]"); process.exit(2); }
  const r = verify(t, { tag: process.argv[3] || "" });
  for (const c of r.checks) console.log(`  [${c.status === "pass" ? "✓" : "✗"}] ${c.id}${c.critical ? " (CRIT)" : ""}: ${c.detail}`);
  console.log(`[verify] ${t}: verdict=${r.summary.verdict} (critical_fail=${r.summary.critical_fail}, total_fail=${r.summary.total_fail})`);
  process.exit(r.summary.verdict === "pass" ? 0 : 1);
}
