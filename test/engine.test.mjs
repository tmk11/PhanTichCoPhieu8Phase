// Test engine.mjs — smoke test analyze() + mutation test kiểu "màn G1":
// verifier PHẢI từ chối khi PEG khai bị thay bằng pegTTM dựng sẵn của vendor.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { analyze, runChecks, renderReport } from "../scripts/engine.mjs";
import { computeDerived } from "../scripts/lib.mjs";

const rubric = JSON.parse(fs.readFileSync(new URL("../done.rubric.json", import.meta.url), "utf8"));

const prov = { source: "test-fixture", url: "https://example.com", as_of_date: "2026-01-01" };
const mkCanonical = (over = {}) => ({
  ticker: "TST",
  as_of: "2026-01-01",
  meta: { company: "Test Corp", sector: "Software", fiscal_year_end_month: 12, currency: "USD", cyclical: false, cyclical_reason: "", model: null },
  price: { ...prov, value: 100, field: "c" },
  eps_actual: [
    { ...prov, fy: 2024, value: 3, field: "eps" },
    { ...prov, fy: 2025, value: 4, field: "eps" },
  ],
  eps_forward: [
    { fy: 2026, value: 5, tier: "user", source: "Người dùng nhập (TradingView)", as_of_date: "2026-01-01", field: "forward_eps_user", basis: "test" },
    { fy: 2027, value: 6.5, tier: "user", source: "Người dùng nhập (TradingView)", as_of_date: "2026-01-01", field: "forward_eps_user", basis: "test" },
  ],
  revenue_forward: [],
  peg_ttm_vendor: { ...prov, value: 2.2, field: "pegTTM" },
  fcf: { value: "GAP", reason: "fixture không có FCF", tier: "gap" },
  growth_runway: {
    drivers: [{ text: "Động cơ tăng trưởng chính: nhu cầu hạ tầng AI tăng mạnh nhiều năm tới trên mọi phân khúc khách hàng doanh nghiệp lẫn tiêu dùng." }],
    backlog_rpo: null,
    tam: { text: "TAM còn rất lớn so với doanh thu hiện tại." },
    segments: [],
    risks: ["Cạnh tranh gay gắt từ các đối thủ lớn."],
  },
  gaps: [],
  ...over,
});

test("analyze(): fixture sạch phải GREEN, mọi guard critical pass", () => {
  const a = analyze(mkCanonical(), rubric);
  assert.equal(a.verdict, "GREEN");
  assert.equal(a.forwardPE, 20); // 100/5
  assert.equal(a.cagr_pct, 30); // (6.5/5) - 1
  assert.equal(a.forwardPEG, 0.6667); // 20/30
  assert.equal(a.forward_source, "user");
  for (const c of a.checks.filter((x) => x.critical)) assert.equal(c.status, "pass", `${c.id}: ${c.detail}`);
});

test("mutation kiểu màn G1: PEG khai := vendor pegTTM => verifier từ chối (RED)", () => {
  const c = mkCanonical();
  const declared = computeDerived(c);
  const report = renderReport(c, declared);
  // Cố tình thay PEG tay bằng số dựng sẵn của vendor, vẫn giả vờ method=manual.
  declared.pegForward.value = c.peg_ttm_vendor.value;
  const v = runChecks({ canonical: c, declared, report, rubric });
  assert.equal(v.verdict, "RED");
  const g1 = v.checks.find((x) => x.id === "G1_peg_manual");
  const g7 = v.checks.find((x) => x.id === "G7_recompute_matches");
  assert.equal(g1.status, "fail"); // trùng vendor
  assert.equal(g7.status, "fail"); // lệch recompute
});

test("G2: ticker cyclical mà report thiếu cảnh báo bẫy => fail; renderReport chuẩn thì pass", () => {
  const c = mkCanonical({ meta: { ...mkCanonical().meta, cyclical: true, cyclical_reason: "ngành bán dẫn có tính chu kỳ" } });
  const a = analyze(c, rubric); // renderReport tự chèn cảnh báo chu kỳ + bẫy
  assert.equal(a.checks.find((x) => x.id === "G2_cyclical_guard").status, "pass");
  // report bị đục bỏ cảnh báo => G2 phải fail
  const declared = computeDerived(c);
  const bad = renderReport(c, declared).replace(/CHU KỲ|chu kỳ|BẪY|bẫy/gi, "xxx");
  const v = runChecks({ canonical: c, declared, report: bad, rubric });
  assert.equal(v.checks.find((x) => x.id === "G2_cyclical_guard").status, "fail");
});

test("G3: EPS nền <= 0.5 mà report không đánh dấu => fail", () => {
  const c = mkCanonical({ eps_actual: [
    { ...prov, fy: 2024, value: 0.2, field: "eps" },
    { ...prov, fy: 2025, value: 4, field: "eps" },
  ] });
  const a = analyze(c, rubric);
  assert.equal(a.checks.find((x) => x.id === "G3_loss_to_profit").status, "pass"); // renderReport có caveat
  const declared = computeDerived(c);
  const v = runChecks({ canonical: c, declared, report: "# report trống không caveat 0.6667 20", rubric });
  assert.equal(v.checks.find((x) => x.id === "G3_loss_to_profit").status, "fail");
});

test("G4: node thiếu provenance => fail cite-or-gap", () => {
  const c = mkCanonical({ price: { value: 100 } }); // số trần, thiếu source/url/...
  const declared = computeDerived(c);
  const report = renderReport(c, declared);
  const v = runChecks({ canonical: c, declared, report, rubric });
  assert.equal(v.checks.find((x) => x.id === "G4_cite_or_gap").status, "fail");
  assert.equal(v.verdict, "RED");
});
