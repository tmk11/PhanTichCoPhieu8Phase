// verify.mjs — Phase 5 VERIFY. Verifier TỰ TÍNH LẠI từ canonical (input thô) + chạy guards.
// KHÔNG bao giờ tin con số đã khai trong spec/report: luôn recompute rồi so sánh.
import path from "node:path";
import fs from "node:fs";
import { ROOT, loadCanonical, loadJSON, computeDerived, walkProvenance, writeJSON, round } from "./lib.mjs";

function readReport(ticker) {
  const p = path.join(ROOT, "reports", `${ticker}-analysis.md`);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}

export function verify(ticker, { tag = "" } = {}) {
  const rubric = loadJSON(path.join(ROOT, "done.rubric.json"));
  const tolPE = rubric.rounding_tolerance.forward_pe_abs;
  const tolPEG = rubric.rounding_tolerance.peg_abs;
  const epsVendor = rubric.peg_vendor_match_epsilon;

  const c = loadCanonical(ticker);
  const truth = computeDerived(c); // TÍNH LẠI TỪ INPUT THÔ
  const specPath = path.join(ROOT, "artifacts", `spec-${ticker}.json`);
  const spec = fs.existsSync(specPath) ? loadJSON(specPath) : null;
  const report = readReport(ticker);

  const checks = [];
  const add = (id, critical, status, detail) => checks.push({ id, critical, status, detail });

  // ---------- G4 — Cite-or-gap ----------
  const prov = walkProvenance(c);
  const provBad = prov.filter((r) => !r.ok);
  // input nuôi chỉ số tiêu đề: price + các eps_forward dạng số
  const headlineInputsOk =
    prov.find((r) => r.path === "price")?.ok &&
    (c.eps_forward || []).filter((e) => typeof e.value === "number").every((e) =>
      ["value", "source", "url", "as_of_date", "field"].every((f) => e[f] !== undefined && e[f] !== null && e[f] !== ""));
  add("G4_cite_or_gap", true,
    provBad.length === 0 && headlineInputsOk ? "pass" : "fail",
    provBad.length ? `Node lỗi provenance: ${provBad.map((b) => `${b.path}(${b.reason})`).join("; ")}` :
      headlineInputsOk ? "Mọi node có provenance hoặc GAP tường minh; input tiêu đề đủ nguồn." : "Input tiêu đề thiếu trường provenance.");

  // ---------- G7 — Recompute khớp ----------
  let g7 = "pass", g7d = [];
  if (!spec) { g7 = "fail"; g7d.push("thiếu spec"); }
  else {
    const dPE = Math.abs((spec.headline?.forwardPE ?? NaN) - truth.headline.forwardPE);
    if (!(dPE <= tolPE)) { g7 = "fail"; g7d.push(`forwardPE spec=${spec.headline?.forwardPE} vs recompute=${truth.headline.forwardPE} (Δ=${round(dPE,4)} > ${tolPE})`); }
    const tp = truth.pegForward ? truth.pegForward.value : null;
    const sp = spec.pegForward ? spec.pegForward.value : null;
    if (tp === null || sp === null) {
      if (tp !== sp) { g7 = "fail"; g7d.push(`PEG null mismatch spec=${sp} recompute=${tp}`); }
    } else {
      const dPEG = Math.abs(sp - tp);
      if (!(dPEG <= tolPEG)) { g7 = "fail"; g7d.push(`PEG spec=${sp} vs recompute=${tp} (Δ=${round(dPEG,4)} > ${tolPEG})`); }
    }
    // Report markdown phải in đúng số recompute (chống report lệch spec/canonical)
    if (report) {
      if (!report.includes(String(round(truth.headline.forwardPE, 2)))) { g7 = "fail"; g7d.push(`report không chứa forwardPE=${round(truth.headline.forwardPE,2)}`); }
      if (tp !== null && !report.includes(String(tp))) { g7 = "fail"; g7d.push(`report không chứa PEG=${tp}`); }
    } else { g7 = "fail"; g7d.push("thiếu report"); }
  }
  add("G7_recompute_matches", true, g7, g7d.join(" | ") || `forwardPE=${truth.headline.forwardPE}, PEG=${truth.pegForward?.value} khớp.`);

  // ---------- G1 — PEG tính tay (không trùng vendor) ----------
  let g1 = "pass", g1d = [];
  const vendorPeg = truth.peg_vendor_for_compare;
  if (!spec || !spec.pegForward) { g1 = "fail"; g1d.push("spec thiếu pegForward"); }
  else {
    if (spec.pegForward.method !== "manual") { g1 = "fail"; g1d.push(`method=${spec.pegForward.method} (phải 'manual')`); }
    if (vendorPeg !== null && Math.abs(spec.pegForward.value - vendorPeg) <= epsVendor) {
      g1 = "fail"; g1d.push(`PEG spec=${spec.pegForward.value} TRÙNG vendor pegTTM=${vendorPeg} (Δ<=${epsVendor}) ⇒ nghi dùng số dựng sẵn`);
    }
    // truth (tự tính) cũng phải khác vendor — sanity
    if (truth.pegForward && vendorPeg !== null && Math.abs(truth.pegForward.value - vendorPeg) <= epsVendor) {
      g1d.push(`(cảnh báo: recompute PEG ${truth.pegForward.value} tình cờ gần vendor ${vendorPeg})`);
    }
  }
  add("G1_peg_manual", true, g1, g1d.join(" | ") || `PEG tay=${spec?.pegForward?.value} ≠ vendor pegTTM=${vendorPeg}.`);

  // ---------- G2 — Bẫy chu kỳ ----------
  if (truth.flags.cyclical) {
    const ok = /chu k[ỳy]/i.test(report) && /b[ẫâ]y/i.test(report);
    add("G2_cyclical_guard", true, ok ? "pass" : "fail",
      ok ? "Có cảnh báo chu kỳ + bẫy P/E đỉnh." : "Cyclical=true nhưng report thiếu cảnh báo 'chu kỳ'/'bẫy'.");
  } else {
    add("G2_cyclical_guard", true, "pass", "Không phải cyclical ⇒ n/a.");
  }

  // ---------- G3 — Méo loss-to-profit / low-base ----------
  if (truth.flags.loss_to_profit_applicable) {
    const ok = /(loss-to-profit|nền lỗ|lãi-gần-0|low-base|thổi phồng)/i.test(report);
    add("G3_loss_to_profit", true, ok ? "pass" : "fail",
      ok ? "Đã đánh dấu nền lỗ/lãi-gần-0 làm tăng trưởng méo." : "Có EPS nền gần 0 nhưng report không đánh dấu méo.");
  } else {
    add("G3_loss_to_profit", true, "pass", "Không có nền lỗ/gần-0 ⇒ n/a.");
  }

  // ---------- G5 — TAM section ----------
  {
    const m = report.match(/##\s+4\.\s+Growth-runway[\s\S]*?(?=\n##\s+\d|$)/);
    const body = m ? m[0] : "";
    const ok = body.length > 200 && /backlog|RPO|TAM/i.test(body) && /[Rr]ủi ro/.test(body);
    add("G5_tam_section", false, ok ? "pass" : "fail",
      ok ? "Phần growth-runway/TAM đầy đủ (động cơ, backlog/RPO, segment, rủi ro)." : "Phần TAM rỗng/thiếu backlog-RPO-rủi ro.");
  }

  // ---------- G6 — FCF caveat ----------
  if (truth.flags.fcf_negative) {
    const ok = /FCF ÂM/i.test(report);
    add("G6_fcf_caveat", false, ok ? "pass" : "fail", ok ? "FCF âm có caveat." : "FCF âm nhưng thiếu caveat.");
  } else {
    add("G6_fcf_caveat", false, "pass", "FCF dương (hoặc GAP) ⇒ pass.");
  }

  // ---------- G8 — Not advice framing ----------
  add("G8_not_advice", false, /không phải lời khuyên/i.test(report) ? "pass" : "fail",
    /không phải lời khuyên/i.test(report) ? "Có khung tham khảo." : "Thiếu khung 'không phải lời khuyên'.");

  const criticalFails = checks.filter((c) => c.critical && c.status === "fail");
  const anyFail = checks.filter((c) => c.status === "fail");
  const verdict = criticalFails.length === 0 && anyFail.length === 0 ? "pass"
    : criticalFails.length === 0 ? "soft-fail" : "fail";

  const out = {
    ticker, as_of: c.as_of, tag, ts: new Date().toISOString(),
    recompute: {
      forwardPE_headline: truth.headline.forwardPE, fy: truth.headline.fy,
      cagr_pct: truth.growth.cagr_pct, pegForward: truth.pegForward ? truth.pegForward.value : null,
      vendor_pegTTM: vendorPeg,
    },
    checks,
    summary: { critical_fail: criticalFails.length, total_fail: anyFail.length, verdict },
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
