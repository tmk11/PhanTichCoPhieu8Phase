// Test computeLenses + lensContradiction (lenses.mjs) — đa lăng kính định giá.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLenses, lensContradiction } from "../scripts/lenses.mjs";

const mkC = (vi = {}, over = {}) => ({
  ticker: "TST",
  meta: { sector: "Technology" },
  price: { value: 100 },
  eps_forward: [{ fy: 2026, value: 4, tier: "user" }],
  valuation_inputs: { sector: "Technology", ...vi },
  ...over,
});
const lens = (L, id) => L.find((l) => l.id === id);

test("FCF yield: dương cao => good; âm nhưng OCF dương => warn (tái đầu tư); cả hai âm => bad", () => {
  const good = lens(computeLenses(mkC({ market_cap: 100e9, fcf_ttm: 5e9 })), "fcf_yield");
  assert.equal(good.verdict, "good");
  assert.equal(good.value, 5);

  const reinvest = lens(computeLenses(mkC({ market_cap: 100e9, fcf_ttm: -2e9, ocf_ttm: 8e9 })), "fcf_yield");
  assert.equal(reinvest.verdict, "warn");
  assert.match(reinvest.text, /OCF DƯƠNG/);

  const burn = lens(computeLenses(mkC({ market_cap: 100e9, fcf_ttm: -2e9, ocf_ttm: -1e9 })), "fcf_yield");
  assert.equal(burn.verdict, "bad");
});

test("CapEx/D&A: >1.15 growth (good), ~1 maintenance (neutral), <0.85 dưới-đầu-tư (warn)", () => {
  assert.equal(lens(computeLenses(mkC({ capex_annual: 2e9, dna_annual: 1e9 })), "capex_dna").verdict, "good");
  assert.equal(lens(computeLenses(mkC({ capex_annual: 1e9, dna_annual: 1e9 })), "capex_dna").verdict, "neutral");
  assert.equal(lens(computeLenses(mkC({ capex_annual: 0.5e9, dna_annual: 1e9 })), "capex_dna").verdict, "warn");
  assert.equal(lens(computeLenses(mkC({})), "capex_dna").verdict, "gap");
});

test("EV/EBITDA: <12 good, 12-20 neutral, >20 warn; EBITDA<=0 => gap", () => {
  assert.equal(lens(computeLenses(mkC({ enterprise_value: 100e9, ebitda: 10e9 })), "ev_ebitda").verdict, "good");
  assert.equal(lens(computeLenses(mkC({ enterprise_value: 300e9, ebitda: 10e9 })), "ev_ebitda").verdict, "warn");
  assert.equal(lens(computeLenses(mkC({ enterprise_value: 100e9, ebitda: -1e9 })), "ev_ebitda").verdict, "gap");
});

test("Rule of 40: chỉ áp cho phần mềm; DT +25% và biên FCF 20% => 45 good", () => {
  const sw = lens(computeLenses(mkC({ revenue: 100e9, revenue_growth: 0.25, fcf_ttm: 20e9, market_cap: 500e9 })), "rule40");
  assert.equal(sw.value, 45);
  assert.equal(sw.verdict, "good");
  // ngành ngoài phần mềm: không có lăng kính rule40
  const c = mkC({ revenue: 100e9, revenue_growth: 0.25, fcf_ttm: 20e9 });
  c.meta.sector = "Energy"; c.valuation_inputs.sector = "Energy";
  assert.equal(lens(computeLenses(c), "rule40"), undefined);
});

test("Reverse-DCF: trả tăng trưởng ngầm định hợp lý (giá 100, EPS 4, r=10%, gt=3% => ~10%/năm)", () => {
  const l = lens(computeLenses(mkC({ market_cap: 100e9 })), "reverse_dcf");
  assert.equal(l.verdict, "info");
  assert.ok(l.value > 5 && l.value < 20, `implied growth ${l.value} ngoài khoảng hợp lý`);
});

test("SBC/doanh thu: <3% good, 3-10% neutral, >10% warn, thiếu => gap", () => {
  assert.equal(lens(computeLenses(mkC({ sbc_annual: 2e9, revenue: 100e9 })), "sbc_rev").verdict, "good");
  assert.equal(lens(computeLenses(mkC({ sbc_annual: 7e9, revenue: 100e9 })), "sbc_rev").verdict, "neutral");
  assert.equal(lens(computeLenses(mkC({ sbc_annual: 15e9, revenue: 100e9 })), "sbc_rev").verdict, "warn");
  assert.equal(lens(computeLenses(mkC({ revenue: 100e9 })), "sbc_rev").verdict, "gap");
});

test("FCF yield sau SBC: FCF thô dương nhưng âm sau SBC => warn (FCF 'đẹp' nhờ pha loãng)", () => {
  const l = lens(computeLenses(mkC({ market_cap: 100e9, fcf_ttm: 5e9, sbc_annual: 15e9, revenue: 100e9 })), "fcf_yield_ex_sbc");
  assert.equal(l.verdict, "warn");
  assert.match(l.text, /pha loãng/);
});

test("FCF yield sau SBC: vẫn >=4% sau khi trừ SBC => good", () => {
  const l = lens(computeLenses(mkC({ market_cap: 100e9, fcf_ttm: 8e9, sbc_annual: 2e9, revenue: 100e9 })), "fcf_yield_ex_sbc");
  assert.equal(l.verdict, "good");
  assert.equal(l.value, 6); // (8-2)/100 = 6%
});

test("lensContradiction: PEG<1 + lăng kính bad => cảnh báo; PEG>=1 => null", () => {
  const L = computeLenses(mkC({ market_cap: 100e9, fcf_ttm: -2e9, ocf_ttm: -1e9 })); // fcf_yield bad
  assert.match(lensContradiction(0.8, L), /bẫy/);
  assert.equal(lensContradiction(1.2, L), null);
  assert.equal(lensContradiction(null, L), null);
});
