// Test parseJSONLoose (research.mjs) — bộ parse chịu lỗi cho output của model.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseJSONLoose } from "../scripts/research.mjs";

test("JSON thuần", () => {
  assert.deepEqual(parseJSONLoose('{"a":1,"b":[2,3]}'), { a: 1, b: [2, 3] });
});

test("JSON trong code fence markdown", () => {
  assert.deepEqual(parseJSONLoose('```json\n{"a":1}\n```'), { a: 1 });
});

test("bỏ <think> block và prose thừa quanh JSON", () => {
  const s = '<think>đang suy nghĩ {x} lung tung</think>Đây là kết quả: {"ok":true} — hết.';
  assert.deepEqual(parseJSONLoose(s), { ok: true });
});

test("JSON lồng nhau + chuỗi chứa ngoặc không làm lệch quét", () => {
  const s = 'nói trước {"a":{"b":"c}d{","e":[1,{"f":2}]}} nói sau';
  assert.deepEqual(parseJSONLoose(s), { a: { b: "c}d{", e: [1, { f: 2 }] } });
});

test("JSON bị CẮT CỤT được đóng ngoặc và parse", () => {
  const j = parseJSONLoose('{"a": [1, 2');
  assert.deepEqual(j, { a: [1, 2] });
  const j2 = parseJSONLoose('{"findings": [{"issue": "abc');
  assert.equal(j2.findings[0].issue, "abc");
});

test("input rác / không có object => {} (không throw)", () => {
  assert.deepEqual(parseJSONLoose("hoàn toàn không có json"), {});
  assert.deepEqual(parseJSONLoose(""), {});
  assert.deepEqual(parseJSONLoose(null), {});
});
