// Test revisions.mjs — lịch sử revision forward EPS.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sameByYear, diffLatest, appendIfChanged } from "../scripts/revisions.mjs";

test("sameByYear: so sánh đúng, chịu được null/undefined", () => {
  assert.equal(sameByYear({ 2026: 8.75 }, { 2026: 8.75 }), true);
  assert.equal(sameByYear({ 2026: 8.75 }, { 2026: 8.4 }), false);
  assert.equal(sameByYear({ 2026: 8.75 }, { 2026: 8.75, 2027: 10 }), false);
  assert.equal(sameByYear({}, {}), true);
  assert.equal(sameByYear(undefined, undefined), true);
});

test("appendIfChanged: chỉ ghi khi consensus ĐỔI", () => {
  const e1 = { ts: "t1", byYear: { 2026: 8.75 } };
  let r = appendIfChanged([], e1);
  assert.equal(r.appended, true);
  assert.equal(r.history.length, 1);

  // cùng số => không ghi thêm
  r = appendIfChanged(r.history, { ts: "t2", byYear: { 2026: 8.75 } });
  assert.equal(r.appended, false);
  assert.equal(r.history.length, 1);

  // số đổi => ghi
  r = appendIfChanged(r.history, { ts: "t3", byYear: { 2026: 8.4 } });
  assert.equal(r.appended, true);
  assert.equal(r.history.length, 2);
});

test("appendIfChanged: cắt bớt theo limit", () => {
  let h = [];
  for (let i = 0; i < 10; i++) h = appendIfChanged(h, { ts: `t${i}`, byYear: { 2026: i } }, 5).history;
  assert.equal(h.length, 5);
  assert.equal(h[h.length - 1].byYear[2026], 9);
});

test("diffLatest: tính đúng % thay đổi từng FY, chỉ FY có ở cả hai entry", () => {
  const hist = [
    { ts: "2026-06-01", byYear: { 2026: 8.75, 2027: 10.0 } },
    { ts: "2026-06-20", byYear: { 2026: 8.4, 2027: 10.0, 2028: 12.0 } },
  ];
  const d = diffLatest(hist);
  assert.equal(d.since, "2026-06-01");
  assert.equal(d.changes.length, 1); // FY2027 không đổi, FY2028 mới xuất hiện => không tính
  assert.equal(d.changes[0].fy, "2026");
  assert.equal(d.changes[0].from, 8.75);
  assert.equal(d.changes[0].to, 8.4);
  assert.equal(d.changes[0].pct, -4); // (8.4/8.75 - 1) = -4.0%
});

test("diffLatest: <2 entry hoặc không đổi => null", () => {
  assert.equal(diffLatest([]), null);
  assert.equal(diffLatest([{ ts: "t", byYear: { 2026: 1 } }]), null);
  assert.equal(diffLatest([
    { ts: "t1", byYear: { 2026: 1 } },
    { ts: "t2", byYear: { 2026: 1 } },
  ]), null);
});
