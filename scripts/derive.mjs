// derive.mjs — Phase 3 DERIVE. Rule engine thuần công thức.
// Input: data/<TICKER>-canonical.json. Output: artifacts/spec-<TICKER>.json + artifacts/derivation-log-<TICKER>.md
import path from "node:path";
import { ROOT, loadCanonical, computeDerived, writeJSON, round } from "./lib.mjs";
import fs from "node:fs";

export function derive(ticker) {
  const c = loadCanonical(ticker);
  const d = computeDerived(c);
  writeJSON(path.join(ROOT, "artifacts", `spec-${ticker}.json`), d);

  const L = [];
  L.push(`# Derivation log — ${ticker} (${c.meta.company})`);
  L.push(`as_of: ${c.as_of}  |  giá: ${c.price.value} (nguồn: ${c.price.source}, ${c.price.as_of_date})`);
  L.push(`\n> Mọi phép tính dưới đây dùng INPUT THÔ từ canonical. Không số nào lấy từ trường dựng sẵn của vendor.`);
  L.push(`\n## 1. Forward P/E theo năm  (= giá ÷ EPS_estimate[năm])`);
  L.push(`| FY | EPS est | nguồn-tier | forward P/E = ${c.price.value} ÷ EPS |`);
  L.push(`|----|---------|-----------|------|`);
  for (const r of d.forwardPE) L.push(`| ${r.fy} | ${r.eps} | ${r.tier} | ${c.price.value} ÷ ${r.eps} = **${round(r.pe,2)}** |`);
  for (const e of (c.eps_forward||[]).filter(e=>e.value==="GAP")) L.push(`| ${e.fy} | GAP | gap | — (không tính: ${e.reason}) |`);

  L.push(`\n## 2. Tăng trưởng EPS (CAGR)  (= (EPS_cuối/EPS_đầu)^(1/số_năm) − 1)`);
  const g = d.growth;
  L.push(`- Cửa sổ chính: FY${g.base_fy} (${g.base_eps}) → FY${g.end_fy} (${g.end_eps}), ${g.years} năm.`);
  L.push(`  - CAGR = (${g.end_eps}/${g.base_eps})^(1/${g.years}) − 1 = **${g.cagr_pct}%** (năm xa nhất thuộc tier: ${g.furthest_tier}).`);
  if (g.vendor_only.cagr_pct !== null)
    L.push(`- Biến thể CHỈ data_vendor: FY${g.vendor_only.base_fy}→FY${g.vendor_only.end_fy} ⇒ CAGR=${g.vendor_only.cagr_pct}%, PEG=${g.vendor_only.peg}.`);
  L.push(`- YoY đối chiếu: ${g.yoy.map(y=>`FY${y.fy}:${y.growth_pct}%`).join(", ") || "—"}`);

  L.push(`\n## 3. Forward PEG  (= forward P/E[FY1] ÷ growth%dạng-nguyên)`);
  if (d.pegForward) {
    L.push(`- ${d.pegForward.formula} = **${d.pegForward.value}**  (method: ${d.pegForward.method}).`);
    L.push(`- Lưu ý chia cho ${d.pegForward.growth_pct_used} (số phần trăm), KHÔNG chia cho ${round(d.pegForward.growth_pct_used/100,4)}.`);
    L.push(`- Đối chiếu vendor pegTTM = ${d.peg_vendor_for_compare} (CẤM dùng; chỉ để chứng minh số tay KHÁC số vendor).`);
  } else {
    L.push(`- Không tính được PEG (tăng trưởng ≤0 hoặc thiếu dữ liệu).`);
  }

  L.push(`\n## 4. Cờ (xác định từ dữ liệu)`);
  L.push(`- Cyclical: ${d.flags.cyclical}  |  loss_to_profit_applicable: ${d.flags.loss_to_profit_applicable}${d.flags.loss_to_profit_reason?` (${d.flags.loss_to_profit_reason})`:""}`);
  L.push(`- FCF âm: ${d.flags.fcf_negative}  |  PEG ngắn-hạn không tin (tăng trưởng <5%): ${d.flags.peg_unreliable_low_growth}`);
  L.push(`- Khung 4 năm: có ${d.flags.numeric_forward_years}/${d.flags.horizon_target_years} năm forward dạng số ⇒ horizon_gap=${d.flags.horizon_gap}`);

  fs.mkdirSync(path.join(ROOT, "artifacts"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "artifacts", `derivation-log-${ticker}.md`), L.join("\n") + "\n");
  return d;
}

if (process.argv[1] && process.argv[1].endsWith("derive.mjs")) {
  const t = process.argv[2];
  if (!t) { console.error("usage: node derive.mjs <TICKER>"); process.exit(2); }
  const d = derive(t);
  console.log(`[derive] ${t}: forwardPE(FY${d.headline.fy})=${round(d.headline.forwardPE,2)}, CAGR=${d.growth.cagr_pct}%, forwardPEG=${d.pegForward?d.pegForward.value:"n/a"}`);
}
