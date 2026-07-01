// Test computeDerived + nodeProvenanceStatus (lib.mjs) — nền móng định lượng của pipeline.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDerived, nodeProvenanceStatus } from "../scripts/lib.mjs";

const baseCanonical = (over = {}) => ({
  ticker: "TST",
  as_of: "2026-01-01",
  meta: { cyclical: false },
  price: { value: 100 },
  eps_actual: [{ value: 2 }, { value: 3 }],
  eps_forward: [
    { fy: 2026, value: 4, tier: "user" },
    { fy: 2027, value: 5, tier: "user" },
    { fy: 2028, value: "GAP", tier: "gap" },
  ],
  peg_ttm_vendor: { value: 2.5 },
  ...over,
});

test("forward P/E, CAGR, PEG tính đúng công thức (chia cho %-nguyên)", () => {
  const d = computeDerived(baseCanonical());
  assert.equal(d.headline.forwardPE, 25); // 100 / 4
  assert.equal(d.headline.fy, 2026);
  assert.equal(d.growth.cagr_pct, 25); // (5/4)^(1/1) - 1 = 25%
  assert.equal(d.pegForward.value, 1); // 25 / 25 (chia 25, KHÔNG chia 0.25)
  assert.equal(d.pegForward.method, "manual");
  assert.equal(d.peg_vendor_for_compare, 2.5);
});

test("GAP bị loại khỏi cửa sổ forward; horizon_gap bật khi <4 năm có số", () => {
  const d = computeDerived(baseCanonical());
  assert.equal(d.forwardPE.length, 2); // FY2028 GAP không được tính
  assert.equal(d.flags.horizon_gap, true);
  assert.equal(d.flags.numeric_forward_years, 2);
});

test("chỉ 1 năm forward => không có CAGR/PEG (không chia 0)", () => {
  const d = computeDerived(baseCanonical({ eps_forward: [{ fy: 2026, value: 4, tier: "user" }] }));
  assert.equal(d.headline.forwardPE, 25);
  assert.equal(d.growth.cagr_pct, null);
  assert.equal(d.pegForward, null);
});

test("tăng trưởng âm => PEG null (không trả PEG âm gây hiểu nhầm)", () => {
  const d = computeDerived(baseCanonical({
    eps_forward: [{ fy: 2026, value: 5, tier: "user" }, { fy: 2027, value: 4, tier: "user" }],
  }));
  assert.ok(d.growth.cagr_pct < 0);
  assert.equal(d.pegForward, null);
});

test("EPS nền <= 0.5 => cờ loss-to-profit bật", () => {
  const d = computeDerived(baseCanonical({ eps_actual: [{ value: 0.3 }, { value: 3 }] }));
  assert.equal(d.flags.loss_to_profit_applicable, true);
  assert.match(d.flags.loss_to_profit_reason, /0\.3/);
});

test("CAGR < 5% => cờ PEG-không-đáng-tin bật", () => {
  const d = computeDerived(baseCanonical({
    eps_forward: [{ fy: 2026, value: 4, tier: "user" }, { fy: 2027, value: 4.05, tier: "user" }],
  }));
  assert.equal(d.flags.peg_unreliable_low_growth, true);
});

test("không có forward EPS dạng số => throw (không âm thầm trả rác)", () => {
  assert.throws(() => computeDerived(baseCanonical({ eps_forward: [{ fy: 2026, value: "GAP", tier: "gap" }] })));
});

test("nodeProvenanceStatus: đủ 5 trường pass; thiếu trường fail; GAP cần reason", () => {
  const full = { value: 1, source: "s", url: "https://x", as_of_date: "2026-01-01", field: "f" };
  assert.equal(nodeProvenanceStatus(full).ok, true);
  assert.equal(nodeProvenanceStatus({ ...full, url: null }).ok, false);
  assert.equal(nodeProvenanceStatus({ value: "GAP", tier: "gap", reason: "chưa có" }).ok, true);
  assert.equal(nodeProvenanceStatus({ value: "GAP", tier: "gap" }).ok, false);
  assert.equal(nodeProvenanceStatus(42).ok, false); // số trần bị cấm
});

test("nodeProvenanceStatus: tier user/model được phép url null nhưng phải đủ trường", () => {
  const user = { value: 5, tier: "user", source: "Người dùng nhập", as_of_date: "2026-01-01", field: "forward_eps_user" };
  assert.equal(nodeProvenanceStatus(user).ok, true);
  const model = { ...user, tier: "model" };
  assert.equal(nodeProvenanceStatus(model).ok, false); // model thiếu basis
  assert.equal(nodeProvenanceStatus({ ...model, basis: "ước lượng" }).ok, true);
});
