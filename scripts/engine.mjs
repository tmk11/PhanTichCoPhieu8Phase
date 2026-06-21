// engine.mjs — Hàm THUẦN dùng chung: render report + chạy guards (không I/O).
// Dùng cho cả pipeline curated (build.mjs/verify.mjs) lẫn chạy on-demand đa-model.
import { computeDerived, walkProvenance, round } from "./lib.mjs";
import { computeLenses, lensContradiction } from "./lenses.mjs";

const LENS_ICON = { good: "🟢", neutral: "⚪", warn: "🟠", bad: "🔴", info: "🔵", gap: "⚪" };

const pct = (x) => (x === null || x === undefined ? "n/a" : `${round(x, 2)}%`);
const money = (x) => (typeof x === "number" ? `${round(x / 1e9, 1)} tỷ USD` : x);

export function hasModelTier(c) {
  return (c.eps_forward || []).some((e) => e.tier === "model") ||
    (c.revenue_forward || []).some((e) => e.tier === "model");
}
export function forwardSource(c) {
  const fwd = (c.eps_forward || []).filter((e) => typeof e.value === "number");
  if (fwd.some((e) => e.tier === "user")) return "user";
  if (fwd.some((e) => e.tier === "model")) return "model";
  return fwd[0]?.tier || "vendor";
}

// ---- Phase 4 BUILD (thuần): trả về markdown ----
export function renderReport(c, d) {
  const gr = c.growth_runway || {};
  const peg = d.pegForward;
  const cheap = peg ? (peg.value < 1 ? "tương đối RẺ so với tăng trưởng" : "KHÔNG rẻ theo tăng trưởng") : "không xác định";
  const fsrc = forwardSource(c);
  const modelSourced = fsrc === "model";
  const userSourced = fsrc === "user";

  const biggestCaveat = userSourced
    ? "forward EPS do NGƯỜI DÙNG nhập (từ TradingView) — kiểm tra lại số đã nhập"
    : modelSourced
    ? "forward EPS do MODEL ước lượng (không phải consensus vendor) — độ tin cậy thấp"
    : d.flags.cyclical ? "đây là cổ phiếu CHU KỲ — P/E thấp ở đỉnh chu kỳ có thể là BẪY"
    : d.flags.peg_unreliable_low_growth ? "tăng trưởng EPS đồng thuận gần hạn ~đi ngang ⇒ PEG ngắn hạn bị méo"
    : d.flags.horizon_gap ? "khung dự phóng KHÔNG đủ dữ liệu consensus (GAP các năm xa)"
    : "so sánh forward (non-GAAP) với trailing (GAAP) là khập khiễng";

  const M = [];
  M.push(`# ${c.ticker} — Phân tích định giá theo Forward PEG (${c.meta.company})`);
  M.push(`*as_of: ${c.as_of} · giá tham chiếu: $${c.price.value} (${c.price.source}, ${c.price.as_of_date})*`);
  M.push(``);
  M.push(`> ⚠️ **Đây là tài liệu THAM KHẢO, KHÔNG phải lời khuyên đầu tư.**`);
  if (userSourced) {
    M.push(`>`);
    M.push(`> ✍️ **NGUỒN:** Số cứng (giá, EPS quá khứ) từ Yahoo Finance. **Forward EPS do NGƯỜI DÙNG nhập (từ TradingView)** ⇒ forward P/E & PEG dựa trên số bạn nhập. Phần định tính (TAM, FCF, chu kỳ) do model \`${c.meta.model || "?"}\` sinh — cần kiểm chứng.`);
  } else if (modelSourced) {
    M.push(`>`);
    M.push(`> 🤖 **CẢNH BÁO NGUỒN:** Số cứng từ Yahoo/Finnhub. **Forward EPS & định tính do MODEL \`${c.meta.model || "?"}\` ƯỚC LƯỢNG (tier: model), KHÔNG phải consensus analyst.** Đối chiếu nhiều model để thấy độ phân tán.`);
  }
  M.push(``);

  M.push(`## 1. Tóm tắt một dòng`);
  M.push(`Forward PEG (tính tay) ≈ **${peg ? peg.value : "n/a"}** ⇒ ${cheap}. Cảnh báo lớn nhất: **${biggestCaveat}**.`);
  M.push(``);

  M.push(`## 2. Bảng định lượng (theo năm dự phóng)`);
  M.push(`| FY | EPS est | nguồn-tier | Forward P/E | YoY EPS |`);
  M.push(`|----|---------|-----------|-------------|---------|`);
  const yoyMap = Object.fromEntries(d.growth.yoy.map((y) => [y.fy, y.growth_pct]));
  for (const r of d.forwardPE) M.push(`| FY${r.fy} | ${r.eps} | ${r.tier} | ${round(r.pe, 2)} | ${yoyMap[r.fy] !== undefined ? yoyMap[r.fy] + "%" : "—"} |`);
  for (const e of (c.eps_forward || []).filter((e) => e.value === "GAP")) M.push(`| FY${e.fy} | **GAP** | gap | — | — |`);
  M.push(``);
  M.push(`**Cách tính (tự kiểm chứng được):**`);
  M.push(`- Forward P/E[FY${d.headline.fy}] = $${c.price.value} ÷ ${d.headline.eps} = **${round(d.headline.forwardPE, 2)}**.`);
  M.push(`- Tăng trưởng EPS: CAGR FY${d.growth.base_fy}→FY${d.growth.end_fy} = (${d.growth.end_eps}/${d.growth.base_eps})^(1/${d.growth.years}) − 1 = **${pct(d.growth.cagr_pct)}** (năm xa nhất: tier ${d.growth.furthest_tier}).`);
  if (peg) M.push(`- **Forward PEG = ${round(d.headline.forwardPE, 2)} ÷ ${round(d.growth.cagr_pct, 2)} = ${peg.value}** (chia cho số phần-trăm-nguyên; method=${peg.method}).`);
  M.push(`- Đối chiếu vendor pegTTM = ${d.peg_vendor_for_compare} (Finnhub) — **không dùng để tính**; chỉ chứng minh số tự tính KHÁC số dựng sẵn.`);
  M.push(``);

  // Đa lăng kính định giá (chỉ khi có dữ liệu định giá từ Yahoo — luồng chạy mã mới)
  const lenses = (c.valuation_inputs && typeof c.valuation_inputs.market_cap === "number") ? computeLenses(c) : [];
  if (lenses.length) {
    M.push(`## 🔭 Đa lăng kính định giá (đừng nhìn PEG một mình)`);
    const contra = lensContradiction(peg ? peg.value : null, lenses);
    if (contra) M.push(`> 🔴 **MÂU THUẪN:** ${contra}`);
    M.push(`| Lăng kính | Giá trị | Đánh giá | Diễn giải |`);
    M.push(`|-----------|---------|----------|-----------|`);
    for (const l of lenses) {
      const v = l.verdict === "gap" ? "GAP" : (l.value != null ? `${l.value}${l.unit || ""}` : "—");
      M.push(`| ${l.label} | ${v} | ${LENS_ICON[l.verdict] || ""} | ${l.text}${l.caveat ? ` *(${l.caveat})*` : ""} |`);
    }
    M.push(`\n*Nguồn số định giá: Yahoo Finance (yfinance). FCF âm KHÔNG mặc nhiên xấu — xem cặp FCF↔OCF và CapEx/D&A ở trên.*`);
    M.push(``);
  }

  M.push(`## 3. Caveat (đọc kỹ trước khi dùng số)`);
  if (userSourced) M.push(`- ✍️ **USER-SOURCED:** forward EPS do bạn nhập (TradingView) — PEG chỉ đúng khi số nhập đúng; phần định tính bên dưới do model sinh.`);
  else if (modelSourced) M.push(`- 🤖 **MODEL-SOURCED:** forward EPS là ước lượng của model, không có URL nguồn — chỉ nên đọc định tính & so sánh giữa các model.`);
  if (d.flags.cyclical) M.push(`- 🔴 **CHU KỲ (cyclical):** ${c.meta.cyclical_reason || "ngành có tính chu kỳ"}. **P/E thấp ở ĐỈNH chu kỳ lợi nhuận thường là BẪY.**`);
  if (d.flags.loss_to_profit_applicable) M.push(`- 🟠 **Nền lỗ / lãi-gần-0 (loss-to-profit / low-base):** ${d.flags.loss_to_profit_reason} Tăng trưởng quá khứ **bị thổi phồng**, không nên dùng làm PEG tiêu đề.`);
  if (d.flags.peg_unreliable_low_growth) M.push(`- 🟠 **PEG ngắn hạn không đáng tin:** CAGR forward chỉ ${pct(d.growth.cagr_pct)} (gần 0) ⇒ phép chia PEG phóng đại.`);
  if (d.flags.fcf_negative) M.push(`- 🔴 **FCF ÂM:** ${money(c.fcf.value)} (${c.fcf.source}, ${c.fcf.as_of_date}) — thận trọng khi dòng tiền tự do âm.${c.fcf.note ? " " + c.fcf.note : ""}`);
  else if (c.fcf && typeof c.fcf.value === "number") M.push(`- 🟢 **FCF dương:** ${money(c.fcf.value)} (${c.fcf.field || "fcf"}; ${c.fcf.source}, ${c.fcf.as_of_date}).${c.fcf.note ? " " + c.fcf.note : ""}`);
  else if (c.fcf) M.push(`- ⚪ **FCF (chưa chốt nguồn tuyệt đối):** ${c.fcf.reason || c.fcf.note || "GAP"} (${c.fcf.source || "—"}).`);
  M.push(`- ⚪ **GAAP vs non-GAAP:** EPS TTM/quá khứ GAAP; forward thường non-GAAP ⇒ forward P/E so trailing khập khiễng.`);
  const diverg = (c.eps_forward || []).filter((e) => e.note && /vênh|Độ vênh|khoảng/i.test(e.note));
  if (diverg.length) { M.push(`- ⚪ **Độ vênh giữa các nguồn forward EPS:**`); for (const e of diverg) M.push(`  - FY${e.fy}: dùng ${e.value} (${e.tier}). ${e.note}`); }
  if ((c.gaps || []).length) { M.push(`- ⚪ **GAP còn lại:**`); for (const gp of c.gaps) M.push(`  - ${gp}`); }
  M.push(``);

  M.push(`## 4. Growth-runway / TAM (bắt buộc)`);
  M.push(`**Động cơ tăng trưởng:**`);
  for (const dr of gr.drivers || []) M.push(`- ${dr.text}${dr.source ? ` *(${dr.source}${dr.as_of_date ? ", " + dr.as_of_date : ""})*` : ""}`);
  if (gr.backlog_rpo) M.push(`\n**Backlog / RPO:** ${gr.backlog_rpo.text}${gr.backlog_rpo.source ? ` *(${gr.backlog_rpo.source})*` : ""}`);
  if (gr.tam) M.push(`\n**TAM còn lại:** ${gr.tam.text}${gr.tam.source ? ` *(${gr.tam.source})*` : ""}`);
  if (gr.segments && gr.segments.length) { M.push(`\n**Segment & tốc độ:**`); for (const s of gr.segments) M.push(`- ${s.text}${s.source ? ` *(${s.source})*` : ""}`); }
  if (gr.risks && gr.risks.length) { M.push(`\n**Rủi ro chiến lược & optionality:**`); for (const r of gr.risks) M.push(`- ${typeof r === "string" ? r : r.text}`); }
  const revNum = (c.revenue_forward || []).filter((r) => typeof r.value === "number");
  if (revNum.length) M.push(`\n**Forward revenue:** ` + revNum.map((r) => `FY${r.fy} ≈ ${money(r.value)} (${r.tier})`).join("; ") + `.`);
  M.push(``);

  M.push(`## 5. Khung tham khảo`);
  M.push(`Đây là tài liệu tham khảo cho quyết định của riêng tôi, **không phải lời khuyên đầu tư**. Mọi số có nguồn hoặc đánh dấu GAP/model; verifier tự tính lại từ input thô.`);
  M.push(``);

  M.push(`## 6. Nguồn (kèm as_of_date)`);
  const srcs = new Map();
  const addSrc = (n) => { if (n && n.source) srcs.set(n.url || n.source, `${n.source} — as_of ${n.as_of_date || n.as_of || "?"}`); };
  ["price", "eps_ttm", "peg_ttm_vendor", "pe_ttm_vendor", "fcf"].forEach((k) => addSrc(c[k]));
  (c.eps_actual || []).forEach(addSrc); (c.eps_forward || []).forEach(addSrc); (c.revenue_forward || []).forEach(addSrc);
  Object.values(c.fundamentals_aux || {}).forEach(addSrc);
  for (const v of Object.values(gr)) { if (Array.isArray(v)) v.forEach(addSrc); else addSrc(v); }
  for (const [url, label] of srcs) M.push(/^https?:/.test(url) ? `- [${label}](${url})` : `- ${label}`);
  M.push(``);
  M.push(`---`);
  M.push(`*Sinh tự động bởi pipeline 8-phase (derive→build→verify).*`);
  return M.join("\n") + "\n";
}

// ---- Phase 5 VERIFY (thuần): chạy guards trên object ----
// declared = spec/derived được "khai" (report dùng số này); truth = tự tính lại từ canonical.
export function runChecks({ canonical: c, declared, report, rubric }) {
  const tolPE = rubric.rounding_tolerance.forward_pe_abs;
  const tolPEG = rubric.rounding_tolerance.peg_abs;
  const epsVendor = rubric.peg_vendor_match_epsilon;
  const truth = computeDerived(c); // TÍNH LẠI TỪ INPUT THÔ
  const checks = [];
  const add = (id, critical, status, detail) => checks.push({ id, critical, status, detail });

  // G4 — cite-or-gap (cho phép tier:model có basis)
  const prov = walkProvenance(c);
  const provBad = prov.filter((r) => !r.ok);
  const headlineInputsOk = prov.find((r) => r.path === "price")?.ok &&
    (c.eps_forward || []).filter((e) => typeof e.value === "number").every((e) =>
      (e.tier === "model" || e.tier === "user") ? (e.source && e.as_of_date && e.field)
        : ["value", "source", "url", "as_of_date", "field"].every((f) => e[f] !== undefined && e[f] !== null && e[f] !== ""));
  add("G4_cite_or_gap", true, provBad.length === 0 && headlineInputsOk ? "pass" : "fail",
    provBad.length ? `Node lỗi: ${provBad.map((b) => `${b.path}(${b.reason})`).join("; ")}` : headlineInputsOk ? "Mọi node có provenance/GAP/model-basis." : "Input tiêu đề thiếu provenance.");

  // G7 — recompute khớp
  let g7 = "pass", g7d = [];
  const dPE = Math.abs((declared.headline?.forwardPE ?? NaN) - truth.headline.forwardPE);
  if (!(dPE <= tolPE)) { g7 = "fail"; g7d.push(`forwardPE khai=${declared.headline?.forwardPE} vs recompute=${truth.headline.forwardPE}`); }
  const tp = truth.pegForward?.value ?? null, sp = declared.pegForward?.value ?? null;
  if (tp === null || sp === null) { if (tp !== sp) { g7 = "fail"; g7d.push(`PEG null mismatch ${sp}/${tp}`); } }
  else if (!(Math.abs(sp - tp) <= tolPEG)) { g7 = "fail"; g7d.push(`PEG khai=${sp} vs recompute=${tp}`); }
  if (report) {
    if (!report.includes(String(round(truth.headline.forwardPE, 2)))) { g7 = "fail"; g7d.push("report thiếu forwardPE"); }
    if (tp !== null && !report.includes(String(tp))) { g7 = "fail"; g7d.push("report thiếu PEG"); }
  }
  add("G7_recompute_matches", true, g7, g7d.join(" | ") || `forwardPE=${truth.headline.forwardPE}, PEG=${truth.pegForward?.value} khớp.`);

  // G1 — PEG tính tay ≠ vendor
  let g1 = "pass", g1d = [];
  const vendorPeg = truth.peg_vendor_for_compare;
  if (!declared.pegForward) { g1 = "fail"; g1d.push("thiếu pegForward"); }
  else {
    if (declared.pegForward.method !== "manual") { g1 = "fail"; g1d.push(`method=${declared.pegForward.method}`); }
    if (vendorPeg != null && Math.abs(declared.pegForward.value - vendorPeg) <= epsVendor) { g1 = "fail"; g1d.push(`PEG=${declared.pegForward.value} TRÙNG vendor pegTTM=${vendorPeg}`); }
  }
  add("G1_peg_manual", true, g1, g1d.join(" | ") || `PEG tay=${declared.pegForward?.value} ≠ vendor=${vendorPeg}.`);

  // G2 — chu kỳ
  if (truth.flags.cyclical) {
    const ok = /chu k[ỳy]/i.test(report) && /b[ẫâ]y/i.test(report);
    add("G2_cyclical_guard", true, ok ? "pass" : "fail", ok ? "Có cảnh báo chu kỳ + bẫy." : "Cyclical nhưng thiếu cảnh báo.");
  } else add("G2_cyclical_guard", true, "pass", "Không cyclical ⇒ n/a.");

  // G3 — loss-to-profit
  if (truth.flags.loss_to_profit_applicable) {
    const ok = /(loss-to-profit|nền lỗ|lãi-gần-0|low-base|thổi phồng)/i.test(report);
    add("G3_loss_to_profit", true, ok ? "pass" : "fail", ok ? "Đã đánh dấu nền lỗ/lãi-gần-0." : "Có EPS nền gần 0 nhưng thiếu đánh dấu.");
  } else add("G3_loss_to_profit", true, "pass", "Không có nền lỗ/gần-0 ⇒ n/a.");

  // G5 — TAM
  const m = report.match(/##\s+4\.\s+Growth-runway[\s\S]*?(?=\n##\s+\d|$)/);
  const body = m ? m[0] : "";
  add("G5_tam_section", false, body.length > 160 && /[Rr]ủi ro/.test(body) ? "pass" : "fail", body.length > 160 ? "TAM đủ." : "TAM rỗng/thiếu rủi ro.");

  // G6 — FCF caveat
  if (truth.flags.fcf_negative) add("G6_fcf_caveat", false, /FCF ÂM/i.test(report) ? "pass" : "fail", /FCF ÂM/i.test(report) ? "FCF âm có caveat." : "FCF âm thiếu caveat.");
  else add("G6_fcf_caveat", false, "pass", "FCF dương/GAP ⇒ pass.");

  // G8 — not advice
  add("G8_not_advice", false, /không phải lời khuyên/i.test(report) ? "pass" : "fail", /không phải lời khuyên/i.test(report) ? "Có khung tham khảo." : "Thiếu khung.");

  const criticalFail = checks.filter((x) => x.critical && x.status === "fail").length;
  const anyFail = checks.filter((x) => x.status === "fail").length;
  const verdict = criticalFail ? "RED" : anyFail ? "PARTIAL" : "GREEN";
  return { checks, verdict, recompute: { forwardPE: truth.headline.forwardPE, fy: truth.headline.fy, cagr_pct: truth.growth.cagr_pct, pegForward: truth.pegForward?.value ?? null, vendor_pegTTM: vendorPeg }, criticalFail, anyFail };
}

// Chạy trọn (derive→build→verify) trên 1 canonical in-memory.
export function analyze(canonical, rubric) {
  const derived = computeDerived(canonical);
  const report = renderReport(canonical, derived);
  const v = runChecks({ canonical, declared: derived, report, rubric });
  return {
    ticker: canonical.ticker, model: canonical.meta.model || null,
    verdict: v.verdict, checks: v.checks, recompute: v.recompute,
    forwardPE: derived.headline.forwardPE, fy: derived.headline.fy,
    cagr_pct: derived.growth.cagr_pct, forwardPEG: derived.pegForward?.value ?? null,
    vendor_pegTTM: derived.peg_vendor_for_compare, flags: derived.flags,
    model_sourced: hasModelTier(canonical), forward_source: forwardSource(canonical), report, derived,
  };
}
