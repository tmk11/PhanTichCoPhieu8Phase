// lib.mjs — tiện ích dùng chung cho pipeline.
// Triết lý: mọi con số phái sinh phải truy ngược về node canonical có nguồn.
// computeDerived() TÍNH LẠI TỪ INPUT THÔ (canonical) — không bao giờ đọc số đã khai trong report/spec.

import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

export function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
export function writeJSON(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}
export function loadCanonical(ticker) {
  return loadJSON(path.join(ROOT, "data", `${ticker}-canonical.json`));
}

export const round = (x, d = 2) => {
  if (x === null || x === undefined || Number.isNaN(x)) return null;
  const f = 10 ** d;
  return Math.round(x * f) / f;
};

// ---- Provenance schema ----
export const PROV_FIELDS = ["value", "source", "url", "as_of_date", "field"];
export function isGap(node) {
  return node && (node.value === "GAP" || node.tier === "gap");
}
// Một node "số" hợp lệ khi: có đủ 5 trường provenance, HOẶC là GAP tường minh,
// HOẶC là ước lượng của model (tier:'model') — url được phép null nhưng PHẢI có 'basis'.
export function nodeProvenanceStatus(node) {
  if (node === null || node === undefined) return { ok: false, reason: "node null" };
  if (isGap(node)) {
    if (!node.reason) return { ok: false, reason: "GAP thiếu 'reason'" };
    return { ok: true, gap: true };
  }
  if (typeof node !== "object") return { ok: false, reason: "không phải object có provenance (số trần)" };
  if (node.tier === "model") {
    // Ước lượng của LLM: nguồn = model id, không có url, nhưng phải khai 'basis' (lý do/cơ sở).
    const need = ["value", "source", "as_of_date", "field"].filter((f) => node[f] === undefined || node[f] === null || node[f] === "");
    if (need.length) return { ok: false, reason: `model-node thiếu: ${need.join(", ")}` };
    if (!node.basis) return { ok: false, reason: "model-node thiếu 'basis'" };
    if (typeof node.value !== "number") return { ok: false, reason: "model value không phải số" };
    return { ok: true, gap: false, model: true };
  }
  const missing = PROV_FIELDS.filter((f) => node[f] === undefined || node[f] === null || node[f] === "");
  if (missing.length) return { ok: false, reason: `thiếu trường: ${missing.join(", ")}` };
  if (typeof node.value !== "number") return { ok: false, reason: "value không phải số (và không phải GAP)" };
  return { ok: true, gap: false };
}

// Duyệt đệ quy mọi node "lá có vẻ là số liệu" để kiểm provenance.
// Quy ước: node là object có 'value' => phải pass schema. Mảng eps_actual/eps_forward => mỗi phần tử.
export function walkProvenance(canonical) {
  const results = [];
  const numericKeys = new Set([
    "price", "eps_ttm", "peg_ttm_vendor", "pe_ttm_vendor", "fcf",
  ]);
  for (const k of numericKeys) {
    if (canonical[k] !== undefined) results.push({ path: k, ...nodeProvenanceStatus(canonical[k]) });
  }
  for (const arrKey of ["eps_actual", "eps_forward", "revenue_forward"]) {
    (canonical[arrKey] || []).forEach((n, i) => {
      results.push({ path: `${arrKey}[${i}]${n.fy ? ` fy${n.fy}` : ""}`, ...nodeProvenanceStatus(n) });
    });
  }
  if (canonical.fundamentals_aux) {
    for (const [k, n] of Object.entries(canonical.fundamentals_aux)) {
      results.push({ path: `fundamentals_aux.${k}`, ...nodeProvenanceStatus(n) });
    }
  }
  return results;
}

// ---- Engine tính toán xác định (thuần công thức) ----
// forward P/E (năm N) = price / EPS_estimate[N]
// CAGR = (EPS_end / EPS_start)^(1/years) - 1
// forward PEG = forwardPE(FY1) / (CAGR * 100)   [chia cho số phần trăm dạng nguyên, vd 33.4 KHÔNG phải 0.334]
export function computeDerived(c) {
  const price = c.price.value;

  // Chỉ lấy các năm forward có EPS dạng SỐ (loại GAP).
  const fwd = (c.eps_forward || [])
    .filter((e) => typeof e.value === "number")
    .sort((a, b) => a.fy - b.fy);

  if (fwd.length === 0) throw new Error("Không có forward EPS dạng số để tính.");

  const forwardPE = fwd.map((e) => ({
    fy: e.fy,
    eps: e.value,
    tier: e.tier,
    pe: round(price / e.value, 4),
    input: `eps_forward fy${e.fy} (${e.tier})`,
  }));

  const fy1 = fwd[0];
  const headline_forwardPE = round(price / fy1.value, 4);

  // Tăng trưởng: CAGR trên toàn bộ cửa sổ forward có số.
  const base = fwd[0], end = fwd[fwd.length - 1];
  const years = end.fy - base.fy;
  let cagr_pct = null;
  if (years > 0) cagr_pct = round((Math.pow(end.value / base.value, 1 / years) - 1) * 100, 4);

  // Biến thể chỉ-dùng-vendor (data_vendor) để đối chiếu độ tin cậy.
  const vfwd = fwd.filter((e) => e.tier === "data_vendor");
  let cagr_vendor_only_pct = null, peg_vendor_only = null;
  if (vfwd.length >= 2) {
    const vy = vfwd[vfwd.length - 1].fy - vfwd[0].fy;
    if (vy > 0) {
      cagr_vendor_only_pct = round((Math.pow(vfwd[vfwd.length - 1].value / vfwd[0].value, 1 / vy) - 1) * 100, 4);
      if (cagr_vendor_only_pct > 0) peg_vendor_only = round(headline_forwardPE / cagr_vendor_only_pct, 4);
    }
  }

  const yoy = [];
  for (let i = 1; i < fwd.length; i++) {
    yoy.push({ fy: fwd[i].fy, growth_pct: round((fwd[i].value / fwd[i - 1].value - 1) * 100, 2) });
  }

  let pegForward = null;
  if (cagr_pct !== null && cagr_pct > 0) pegForward = round(headline_forwardPE / cagr_pct, 4);

  // Cờ định tính (xác định từ dữ liệu, không phán đoán).
  const epsActualVals = (c.eps_actual || []).map((e) => e.value).filter((v) => typeof v === "number");
  const minActual = epsActualVals.length ? Math.min(...epsActualVals) : null;
  const loss_to_profit_applicable = minActual !== null && minActual <= 0.5; // nền lỗ/gần-0
  const fcfNode = c.fcf;
  const fcf_negative = fcfNode && typeof fcfNode.value === "number" && fcfNode.value < 0;
  const peg_unreliable_low_growth = cagr_pct !== null && cagr_pct < 5; // tăng trưởng ~0 => PEG vô nghĩa

  // GAP trong khung dự phóng (yêu cầu 4 năm forward).
  const horizon_target_years = 4;
  const numeric_forward_years = fwd.length;
  const horizon_gap = numeric_forward_years < horizon_target_years;

  return {
    ticker: c.ticker,
    as_of: c.as_of,
    price: { value: price, input: "price" },
    forwardPE,
    headline: { fy: fy1.fy, forwardPE: headline_forwardPE, eps: fy1.value, eps_tier: fy1.tier },
    growth: {
      method: "CAGR forward EPS toàn cửa sổ có số",
      base_fy: base.fy, end_fy: end.fy, base_eps: base.value, end_eps: end.value,
      years, cagr_pct,
      furthest_tier: end.tier,
      yoy,
      vendor_only: { cagr_pct: cagr_vendor_only_pct, peg: peg_vendor_only,
        base_fy: vfwd.length ? vfwd[0].fy : null, end_fy: vfwd.length ? vfwd[vfwd.length - 1].fy : null },
    },
    pegForward: pegForward === null ? null : {
      value: pegForward,
      method: "manual",
      formula: `forwardPE(FY${fy1.fy}=${headline_forwardPE}) / growth%(${cagr_pct})`,
      forwardPE_used: headline_forwardPE,
      growth_pct_used: cagr_pct,
      inputs: ["price", `eps_forward fy${base.fy}`, `eps_forward fy${end.fy}`],
    },
    flags: {
      cyclical: !!c.meta.cyclical,
      loss_to_profit_applicable,
      loss_to_profit_reason: loss_to_profit_applicable
        ? `min(EPS quá khứ)=${minActual} <= 0.5 => CAGR/growth lịch sử bị thổi phồng; PEG trailing & growth quá khứ méo.`
        : null,
      fcf_negative,
      peg_unreliable_low_growth,
      horizon_gap,
      numeric_forward_years,
      horizon_target_years,
    },
    peg_vendor_for_compare: c.peg_ttm_vendor ? c.peg_ttm_vendor.value : null,
  };
}
