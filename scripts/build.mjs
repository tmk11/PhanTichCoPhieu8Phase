// build.mjs — Phase 4 BUILD. Ráp reports/<TICKER>-analysis.md từ spec + canonical (định tính có nguồn).
import path from "node:path";
import fs from "node:fs";
import { ROOT, loadCanonical, loadJSON, round } from "./lib.mjs";

const pct = (x) => (x === null || x === undefined ? "n/a" : `${round(x, 2)}%`);
const money = (x) => (typeof x === "number" ? `${round(x / 1e9, 1)} tỷ USD` : x);

export function build(ticker) {
  const c = loadCanonical(ticker);
  const d = loadJSON(path.join(ROOT, "artifacts", `spec-${ticker}.json`));
  const gr = c.growth_runway || {};
  const peg = d.pegForward;
  const cheap = peg ? (peg.value < 1 ? "tương đối RẺ so với tăng trưởng" : "KHÔNG rẻ theo tăng trưởng") : "không xác định";

  const biggestCaveat = d.flags.cyclical
    ? "đây là cổ phiếu CHU KỲ — P/E thấp ở đỉnh chu kỳ có thể là BẪY"
    : d.flags.peg_unreliable_low_growth
      ? "tăng trưởng EPS đồng thuận gần hạn ~đi ngang ⇒ PEG ngắn hạn bị méo, không đáng tin"
      : d.flags.horizon_gap
        ? "khung 4 năm KHÔNG đủ dữ liệu consensus (GAP các năm xa)"
        : "so sánh forward (non-GAAP) với trailing (GAAP) là khập khiễng";

  const M = [];
  M.push(`# ${ticker} — Phân tích định giá theo Forward PEG (${c.meta.company})`);
  M.push(`*as_of: ${c.as_of} · giá tham chiếu: $${c.price.value} (${c.price.source}, ${c.price.as_of_date})*`);
  M.push(``);
  M.push(`> ⚠️ **Đây là tài liệu THAM KHẢO cho quyết định của riêng người đọc, KHÔNG phải lời khuyên đầu tư.**`);
  M.push(``);

  // 1. Tóm tắt 1 dòng
  M.push(`## 1. Tóm tắt một dòng`);
  M.push(`Forward PEG (tính tay) ≈ **${peg ? peg.value : "n/a"}** ⇒ ${cheap}. Cảnh báo lớn nhất: **${biggestCaveat}**.`);
  M.push(``);

  // 2. Bảng định lượng
  M.push(`## 2. Bảng định lượng (theo năm dự phóng)`);
  M.push(`| FY | EPS est | nguồn-tier | Forward P/E | YoY EPS |`);
  M.push(`|----|---------|-----------|-------------|---------|`);
  const yoyMap = Object.fromEntries(d.growth.yoy.map((y) => [y.fy, y.growth_pct]));
  for (const r of d.forwardPE) {
    M.push(`| FY${r.fy} | ${r.eps} | ${r.tier} | ${round(r.pe, 2)} | ${yoyMap[r.fy] !== undefined ? yoyMap[r.fy] + "%" : "—"} |`);
  }
  for (const e of (c.eps_forward || []).filter((e) => e.value === "GAP")) {
    M.push(`| FY${e.fy} | **GAP** | gap | — | — |`);
  }
  M.push(``);
  M.push(`**Cách tính (tự kiểm chứng được):**`);
  M.push(`- Forward P/E[FY${d.headline.fy}] = $${c.price.value} ÷ ${d.headline.eps} = **${round(d.headline.forwardPE, 2)}**.`);
  M.push(`- Tăng trưởng EPS: CAGR FY${d.growth.base_fy}→FY${d.growth.end_fy} = (${d.growth.end_eps}/${d.growth.base_eps})^(1/${d.growth.years}) − 1 = **${pct(d.growth.cagr_pct)}** (năm xa nhất: tier ${d.growth.furthest_tier}).`);
  if (peg) {
    M.push(`- **Forward PEG = ${round(d.headline.forwardPE, 2)} ÷ ${round(d.growth.cagr_pct, 2)} = ${peg.value}** (chia cho số phần-trăm-nguyên, KHÔNG chia 0.xx; method=${peg.method}).`);
  }
  if (d.growth.vendor_only.cagr_pct !== null) {
    M.push(`- Biến thể chỉ-dùng-data_vendor (loại nguồn news): CAGR FY${d.growth.vendor_only.base_fy}→FY${d.growth.vendor_only.end_fy} = ${pct(d.growth.vendor_only.cagr_pct)} ⇒ PEG = ${d.growth.vendor_only.peg}.`);
  }
  M.push(`- Đối chiếu vendor pegTTM = ${d.peg_vendor_for_compare} (Finnhub) — **không dùng để tính**; chỉ chứng minh số tự tính KHÁC số dựng sẵn.`);
  M.push(``);

  // 3. Caveat
  M.push(`## 3. Caveat (đọc kỹ trước khi dùng số)`);
  if (d.flags.cyclical) {
    M.push(`- 🔴 **CHU KỲ (cyclical):** ${c.meta.cyclical_reason} **P/E thấp ở ĐỈNH chu kỳ lợi nhuận thường là BẪY** — đừng diễn giải forward P/E thấp = rẻ một cách máy móc.`);
  }
  if (d.flags.loss_to_profit_applicable) {
    M.push(`- 🟠 **Nền lỗ / lãi-gần-0 (loss-to-profit / low-base):** ${d.flags.loss_to_profit_reason} Các con số tăng trưởng quá khứ (vd epsGrowth3Y/5Y, pegTTM vendor) **bị thổi phồng** và không nên dùng làm PEG tiêu đề.`);
  }
  if (d.flags.peg_unreliable_low_growth) {
    M.push(`- 🟠 **PEG ngắn hạn không đáng tin:** CAGR forward cửa sổ chính chỉ ${pct(d.growth.cagr_pct)} (gần 0) ⇒ phép chia PEG phóng đại; cần consensus dài hạn hơn (đang GAP) để PEG có nghĩa.`);
  }
  // FCF caveat (G6)
  if (d.flags.fcf_negative) {
    M.push(`- 🔴 **FCF ÂM:** ${money(c.fcf.value)} (${c.fcf.source}, ${c.fcf.as_of_date}) — định giá dựa trên lợi nhuận cần thận trọng khi dòng tiền tự do âm.${c.fcf.note ? " " + c.fcf.note : ""}`);
  } else if (c.fcf && typeof c.fcf.value === "number") {
    M.push(`- 🟢 **FCF dương:** ${money(c.fcf.value)} (${c.fcf.field}; ${c.fcf.source}, ${c.fcf.as_of_date}).${c.fcf.note ? " " + c.fcf.note : ""}`);
  } else if (c.fcf) {
    M.push(`- ⚪ **FCF (chưa chốt nguồn tuyệt đối):** ${c.fcf.reason || c.fcf.note || "GAP"} (${c.fcf.source || "—"}).`);
  }
  M.push(`- ⚪ **GAAP vs non-GAAP:** EPS TTM/quá khứ là GAAP; forward consensus thường non-GAAP ⇒ forward P/E so với trailing là khập khiễng.`);
  // Độ vênh nguồn
  const diverg = (c.eps_forward || []).filter((e) => e.note && /vênh|Độ vênh|khoảng/i.test(e.note));
  if (diverg.length) {
    M.push(`- ⚪ **Độ vênh giữa các nguồn forward EPS:**`);
    for (const e of diverg) M.push(`  - FY${e.fy}: dùng ${e.value} (${e.tier}). ${e.note}`);
  }
  // GAP còn lại
  if ((c.gaps || []).length) {
    M.push(`- ⚪ **GAP còn lại:**`);
    for (const gp of c.gaps) M.push(`  - ${gp}`);
  }
  M.push(``);

  // 4. Growth-runway / TAM (G5 bắt buộc)
  M.push(`## 4. Growth-runway / TAM (bắt buộc)`);
  M.push(`**Động cơ tăng trưởng:**`);
  for (const dr of gr.drivers || []) M.push(`- ${dr.text} *(${dr.source}, ${dr.as_of_date})*`);
  if (gr.backlog_rpo) M.push(`\n**Backlog / RPO:** ${gr.backlog_rpo.text} *(${gr.backlog_rpo.source}, ${gr.backlog_rpo.as_of_date})*`);
  if (gr.tam) M.push(`\n**TAM còn lại:** ${gr.tam.text} *(${gr.tam.source}, ${gr.tam.as_of_date})*`);
  if (gr.segments && gr.segments.length) {
    M.push(`\n**Segment & tốc độ:**`);
    for (const s of gr.segments) M.push(`- ${s.text} *(${s.source}, ${s.as_of_date})*`);
  }
  if (gr.risks && gr.risks.length) {
    M.push(`\n**Rủi ro chiến lược & optionality:**`);
    for (const r of gr.risks) M.push(`- ${r}`);
  }
  // Forward revenue nếu có
  const revNum = (c.revenue_forward || []).filter((r) => typeof r.value === "number");
  if (revNum.length) {
    M.push(`\n**Forward revenue (consensus):** ` + revNum.map((r) => `FY${r.fy} ≈ ${money(r.value)} (${r.analyst_count || "?"} analysts)`).join("; ") + `.`);
  }
  M.push(``);

  // 5. Khung tham khảo
  M.push(`## 5. Khung tham khảo`);
  M.push(`Đây là tài liệu tham khảo cho quyết định của riêng tôi, **không phải lời khuyên đầu tư**. Mọi con số đều kèm nguồn hoặc được đánh dấu GAP; verifier tự tính lại từ input thô để chống "xuất xưởng" số không kiểm chứng.`);
  M.push(``);

  // 6. Nguồn
  M.push(`## 6. Nguồn (kèm as_of_date)`);
  const srcs = new Map();
  const addSrc = (n) => { if (n && n.source && n.url) srcs.set(n.url, `${n.source} — as_of ${n.as_of_date || n.as_of || "?"}`); };
  ["price", "eps_ttm", "peg_ttm_vendor", "pe_ttm_vendor", "fcf"].forEach((k) => addSrc(c[k]));
  (c.eps_actual || []).forEach(addSrc);
  (c.eps_forward || []).forEach(addSrc);
  (c.revenue_forward || []).forEach(addSrc);
  Object.values(c.fundamentals_aux || {}).forEach(addSrc);
  for (const v of Object.values(gr)) {
    if (Array.isArray(v)) v.forEach(addSrc); else addSrc(v);
  }
  for (const [url, label] of srcs) M.push(`- [${label}](${url})`);
  M.push(``);
  M.push(`---`);
  M.push(`*Sinh tự động bởi pipeline 8-phase (derive→build→verify). Recompute & guards: xem artifacts/verifier-report-${ticker}.json.*`);

  const out = path.join(ROOT, "reports", `${ticker}-analysis.md`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, M.join("\n") + "\n");
  return out;
}

if (process.argv[1] && process.argv[1].endsWith("build.mjs")) {
  const t = process.argv[2];
  if (!t) { console.error("usage: node build.mjs <TICKER>"); process.exit(2); }
  console.log(`[build] wrote ${build(t)}`);
}
