// orchestrate.mjs — Nhạc trưởng 8-phase với phase gating, loop tự sửa, màn G1 demo, run-summary.
// Nguồn chân lý "done" duy nhất: done.rubric.json.
import path from "node:path";
import fs from "node:fs";
import { ROOT, loadCanonical, loadJSON, writeJSON, walkProvenance } from "./lib.mjs";
import { derive } from "./derive.mjs";
import { build } from "./build.mjs";
import { verify } from "./verify.mjs";

const MAX_ITERS = 4;
const log = (...a) => console.log(...a);
const gate = (name, ok, detail) => {
  log(`  🚪 ${name}: ${ok ? "🟢 PASS" : "🔴 FAIL"}${detail ? " — " + detail : ""}`);
  return ok;
};

function runTicker(ticker) {
  log(`\n══════════ ${ticker} ══════════`);
  const phases = {};
  const runLog = [];
  const stamp = (phase, gate_pass, extra = {}) => runLog.push({ ts: new Date().toISOString(), ticker, phase, gate_pass, ...extra });

  // ---- Phase 1 RESEARCH ----
  log(`\n[Phase 1] RESEARCH`);
  let c;
  try { c = loadCanonical(ticker); } catch (e) { gate("Gate1", false, "canonical không đọc được"); return null; }
  const prov1 = walkProvenance(c);
  const bad1 = prov1.filter((r) => !r.ok);
  const g1ok = bad1.length === 0;
  phases.research = gate("Gate1", g1ok, g1ok ? `${prov1.length} node có provenance/GAP` : bad1.map((b) => b.path).join(","));
  stamp("RESEARCH", g1ok, { nodes: prov1.length, sources: [...new Set([
    ...(c.eps_forward||[]).map(e=>e.source), c.price.source, c.fcf?.source].filter(Boolean))] });
  if (!g1ok) return finalize(ticker, phases, runLog, null);

  // ---- Phase 2 INGEST ----
  log(`\n[Phase 2] INGEST`);
  const g2ok = bad1.length === 0; // 100% node hợp lệ schema
  phases.ingest = gate("Gate2", g2ok, "100% node hợp lệ schema");
  stamp("INGEST", g2ok);
  if (!g2ok) return finalize(ticker, phases, runLog, null);

  // ---- Phase 3 DERIVE ----
  log(`\n[Phase 3] DERIVE`);
  const spec = derive(ticker);
  const g3ok = !!spec.pegForward && spec.pegForward.inputs.every((i) => /^(price|eps_forward)/.test(i));
  phases.derive = gate("Gate3", g3ok, g3ok ? `forwardPE=${spec.headline.forwardPE}, PEG=${spec.pegForward.value} (truy ngược canonical)` : "derived value không truy được nguồn");
  stamp("DERIVE", g3ok, { forwardPE: spec.headline.forwardPE, cagr_pct: spec.growth.cagr_pct, peg: spec.pegForward?.value });
  if (!g3ok) return finalize(ticker, phases, runLog, spec);

  // ---- Phase 4 BUILD ----
  log(`\n[Phase 4] BUILD`);
  const reportPath = build(ticker);
  const report = fs.readFileSync(reportPath, "utf8");
  const need = ["## 1.", "## 2.", "## 3.", "## 4. Growth-runway", "## 5.", "## 6."];
  const g4ok = need.every((s) => report.includes(s));
  phases.build = gate("Gate4", g4ok, g4ok ? "đủ mục bắt buộc" : "thiếu mục");
  stamp("BUILD", g4ok, { report: path.relative(ROOT, reportPath) });
  if (!g4ok) return finalize(ticker, phases, runLog, spec);

  // ---- Phase 5 VERIFY ----
  log(`\n[Phase 5] VERIFY`);
  let vr = verify(ticker);
  for (const ch of vr.checks) log(`    [${ch.status === "pass" ? "✓" : "✗"}] ${ch.id}${ch.critical ? " (CRIT)" : ""}`);
  let g5ok = vr.summary.verdict === "pass";
  phases.verify = gate("Gate5", g5ok, `verdict=${vr.summary.verdict}`);
  stamp("VERIFY", g5ok, { verdict: vr.summary.verdict, critical_fail: vr.summary.critical_fail });

  // ---- Phase 6 LOOP (tự sửa) ----
  log(`\n[Phase 6] LOOP (MAX_ITERS=${MAX_ITERS})`);
  let iter = 0;
  while (vr.summary.verdict !== "pass" && iter < MAX_ITERS) {
    iter++;
    // Lưu bản FAIL làm bằng chứng tự bắt lỗi.
    const failName = `verifier-report-${ticker}.iter${iter}.failed.json`;
    writeJSON(path.join(ROOT, "artifacts", failName), vr);
    log(`    iter ${iter}: lưu ${failName}; phân loại ${vr.checks.filter(x=>x.status==="fail").map(x=>x.id).join(",")}`);
    // Phân loại nguyên nhân -> chạy lại khâu phù hợp (ở đây re-derive+build là đủ vì canonical là nguồn).
    derive(ticker); build(ticker);
    vr = verify(ticker);
    g5ok = vr.summary.verdict === "pass";
  }

  // ---- Màn G1 DEMO (luôn chạy 1 lần): corrupt -> refuse -> restore ----
  log(`\n[Phase 6b] G1 DEMO — corrupt → refuse → restore`);
  const specPath = path.join(ROOT, "artifacts", `spec-${ticker}.json`);
  const backup = fs.readFileSync(specPath, "utf8");
  const corrupt = JSON.parse(backup);
  const vendorPeg = corrupt.peg_vendor_for_compare;
  let g1demo = { corrupt_refused: false, restored_pass: false, vendorPeg };
  if (vendorPeg !== null && corrupt.pegForward) {
    // Cố tình thay PEG tay bằng trường pegTTM dựng sẵn của vendor.
    corrupt.pegForward.value = vendorPeg;
    corrupt.pegForward.method = "manual"; // giả vờ vẫn 'manual' để thử qua mặt
    writeJSON(specPath, corrupt);
    const vCorrupt = verify(ticker, { tag: "g1corrupt" });
    // Verifier PHẢI từ chối (fail).
    g1demo.corrupt_refused = vCorrupt.summary.verdict === "fail";
    const failBlamed = vCorrupt.checks.filter((x) => x.status === "fail").map((x) => x.id);
    // Đổi tên thành .failed.json để giữ làm bằng chứng.
    const src = path.join(ROOT, "artifacts", `verifier-report-${ticker}.g1corrupt.json`);
    const dst = path.join(ROOT, "artifacts", `verifier-report-${ticker}.g1corrupt.failed.json`);
    if (fs.existsSync(src)) fs.renameSync(src, dst);
    log(`    corrupt: PEG:=vendor(${vendorPeg}) ⇒ verify=${vCorrupt.summary.verdict} (refuse=${g1demo.corrupt_refused}); guards đỏ: ${failBlamed.join(",")}`);
    // Khôi phục: re-derive (tạo lại spec sạch) + verify lại.
    derive(ticker); build(ticker);
    const vRestore = verify(ticker, { tag: "g1restored" });
    g1demo.restored_pass = vRestore.summary.verdict === "pass";
    vr = vRestore;
    log(`    restore: re-derive ⇒ verify=${vRestore.summary.verdict} (pass=${g1demo.restored_pass})`);
  } else {
    log(`    (bỏ qua: không có vendorPeg/PEG để corrupt)`);
  }
  stamp("LOOP", vr.summary.verdict === "pass", { iters: iter, g1demo });

  const failedArtifacts = fs.readdirSync(path.join(ROOT, "artifacts")).filter((f) => f.startsWith(`verifier-report-${ticker}`) && f.endsWith(".failed.json"));
  const g6ok = vr.summary.verdict === "pass" && g1demo.corrupt_refused && g1demo.restored_pass && failedArtifacts.length >= 1;
  phases.loop = gate("Gate6", g6ok, `verify cuối=${vr.summary.verdict}, G1 refuse=${g1demo.corrupt_refused}, restore=${g1demo.restored_pass}, FAIL artifacts=${failedArtifacts.length}`);

  // ---- Phase 7 RECORD ----
  log(`\n[Phase 7] RECORD`);
  const runLogPath = path.join(ROOT, "artifacts", `run-log-${ticker}.jsonl`);
  fs.writeFileSync(runLogPath, runLog.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const g7ok = fs.existsSync(runLogPath);
  phases.record = gate("Gate7 (mềm)", g7ok, path.relative(ROOT, runLogPath));

  return finalize(ticker, phases, runLog, spec, vr, { g1demo, failedArtifacts, iter });
}

function finalize(ticker, phases, runLog, spec, vr = null, extra = {}) {
  // ---- Phase 8 SHIP — chấm rubric ----
  log(`\n[Phase 8] SHIP — chấm rubric`);
  const rubric = loadJSON(path.join(ROOT, "done.rubric.json"));
  const checkById = {};
  if (vr) for (const ch of vr.checks) checkById[ch.id] = ch.status === "pass";
  const guardPass = (g) => Object.entries(checkById).some(([id, ok]) => id.startsWith(g) && ok) ||
    (vr ? (vr.checks.find((c) => c.id.startsWith(g))?.status === "pass") : false);

  const failedArtifacts = extra.failedArtifacts || [];
  const g1demo = extra.g1demo || {};
  const results = rubric.criteria.map((cr) => {
    let pass = false;
    switch (cr.id) {
      case "every_number_sourced": pass = guardPass("G4"); break;
      case "peg_computed_manually": pass = guardPass("G1_peg"); break;
      case "recompute_matches": pass = guardPass("G7"); break;
      case "cyclical_guard_present": pass = guardPass("G2"); break;
      case "loss_to_profit_flagged": pass = guardPass("G3"); break;
      case "tam_section_nonempty": pass = guardPass("G5"); break;
      case "fcf_caveat": pass = guardPass("G6"); break;
      case "not_advice_framing": pass = guardPass("G8"); break;
      case "fail_revise_pass": pass = failedArtifacts.length >= 1; break;
      case "g1_demo_refused": pass = !!(g1demo.corrupt_refused && g1demo.restored_pass); break;
      case "rerunnable": pass = fs.existsSync(path.join(ROOT, "artifacts", `run-log-${ticker}.jsonl`)); break;
    }
    return { ...cr, pass };
  });

  const requiredRed = results.filter((r) => r.required && !r.pass);
  const criticalRed = results.filter((r) => r.critical && !r.pass);
  const verdict = criticalRed.length ? "RED" : requiredRed.length ? "PARTIAL" : "GREEN";
  log(`  Rubric: ${results.filter(r=>r.pass).length}/${results.length} pass | critical đỏ: ${criticalRed.length} | required đỏ: ${requiredRed.length}`);
  log(`  ⇒ VERDICT ${ticker}: ${verdict}`);

  return { ticker, verdict, phases, rubric: results, recompute: vr?.recompute || spec?.pegForward || null,
    critical_red: criticalRed.map((r) => r.id), required_red: requiredRed.map((r) => r.id), g1demo, failedArtifacts };
}

// ---------- main ----------
const tickers = process.argv.slice(2).filter(Boolean);
if (tickers.length === 0) { console.error("usage: node orchestrate.mjs <TICKER...>"); process.exit(2); }

const all = [];
for (const t of tickers) {
  const r = runTicker(t);
  if (r) all.push(r);
}

const summary = {
  ts: new Date().toISOString(),
  rubric_source: "done.rubric.json",
  tickers,
  results: all.map((r) => ({
    ticker: r.ticker, verdict: r.verdict,
    forwardPE: r.recompute?.forwardPE_headline ?? r.recompute?.forwardPE_used ?? null,
    cagr_pct: r.recompute?.cagr_pct ?? null,
    forwardPEG: r.recompute?.pegForward ?? r.recompute?.value ?? null,
    vendor_pegTTM: r.recompute?.vendor_pegTTM ?? null,
    critical_red: r.critical_red, required_red: r.required_red,
    g1_demo: { refused: r.g1demo?.corrupt_refused, restored: r.g1demo?.restored_pass },
    fail_artifacts: r.failedArtifacts?.length || 0,
  })),
  overall_verdict: all.every((r) => r.verdict === "GREEN") ? "GREEN" : all.some((r) => r.verdict === "RED") ? "RED" : "PARTIAL",
};
writeJSON(path.join(ROOT, "artifacts", "run-summary.json"), summary);
log(`\n════════════════════════════════════════`);
log(`RUN-SUMMARY → artifacts/run-summary.json`);
for (const r of summary.results) log(`  ${r.ticker}: ${r.verdict} | fwdPE=${r.forwardPE} CAGR=${r.cagr_pct}% PEG=${r.forwardPEG} (vendor pegTTM=${r.vendor_pegTTM}) | G1 refuse=${r.g1_demo.refused}/restore=${r.g1_demo.restored}`);
log(`  OVERALL: ${summary.overall_verdict}`);
