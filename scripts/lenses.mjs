// lenses.mjs — Đa lăng kính định giá (thuần công thức). Bổ trợ forward PEG để tránh bẫy "PEG thấp = rẻ".
// verdict: good 🟢 | neutral ⚪ | warn 🟠 | bad 🔴 | info 🔵 | gap (thiếu dữ liệu)
import { round } from "./lib.mjs";

const pct = (x) => (x == null ? null : round(x, 1));
const B = (x) => (x == null ? "n/a" : `${round(x / 1e9, 1)} tỷ`);

// Reverse-DCF 2 giai đoạn: tìm g sao cho hiện giá dòng tiền/cổ phiếu = giá.
function impliedGrowth(price, base, { r = 0.10, gt = 0.03, N = 10 } = {}) {
  if (!(base > 0) || !(price > 0) || r <= gt) return null;
  const pv = (g) => {
    let s = 0;
    for (let i = 1; i <= N; i++) s += base * Math.pow(1 + g, i) / Math.pow(1 + r, i);
    const term = base * Math.pow(1 + g, N) * (1 + gt) / (r - gt);
    return s + term / Math.pow(1 + r, N);
  };
  let lo = -0.5, hi = 1.0;
  if (pv(lo) > price) return -50;
  if (pv(hi) < price) return 100;
  for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (pv(m) < price) lo = m; else hi = m; }
  return round((lo + hi) / 2 * 100, 1);
}

export function computeLenses(c, opts = {}) {
  const vi = c.valuation_inputs || {};
  const num = (k) => (typeof vi[k] === "number" ? vi[k] : null);
  const price = c.price?.value;
  const mc = num("market_cap"), ev = num("enterprise_value"), ebitda = num("ebitda");
  const fcf = num("fcf_ttm"), ocf = num("ocf_ttm");
  const capex = num("capex_annual"), dna = num("dna_annual");
  const rev = num("revenue"), rg = num("revenue_growth"), shares = num("shares");
  const sector = (vi.sector || c.meta?.sector || "").toLowerCase();
  const isSoftware = /software|technology|communication|internet|fintech/.test(sector);
  const src = vi.source || "Yahoo Finance (yfinance)";
  const cfP = vi.cf_period ? ` (BCTC ${vi.cf_period})` : "";
  const L = [];
  const add = (o) => L.push({ source: src, ...o });

  // 1) FCF YIELD + sắc thái FCF âm "tốt/xấu" theo OCF
  if (fcf == null || !mc) {
    add({ id: "fcf_yield", label: "FCF yield", verdict: "gap", text: "Thiếu FCF hoặc vốn hóa." });
  } else {
    const y = pct(fcf / mc * 100);
    if (fcf >= 0) {
      add({ id: "fcf_yield", label: "FCF yield", value: y, unit: "%", verdict: y >= 4 ? "good" : "neutral",
        text: `FCF yield = ${y}% (FCF ${B(fcf)} / vốn hóa ${B(mc)}). ${y >= 4 ? "Sinh tiền tốt." : "Dương nhưng mỏng."}` });
    } else if (ocf != null && ocf > 0) {
      add({ id: "fcf_yield", label: "FCF yield", value: y, unit: "%", verdict: "warn",
        text: `FCF ÂM (${B(fcf)}) NHƯNG OCF DƯƠNG (${B(ocf)}) ⇒ core business vẫn đẻ tiền; FCF âm là do TÁI ĐẦU TƯ capex lớn để tăng trưởng, KHÔNG phải đốt tiền. Đọc kèm CapEx/D&A.` });
    } else {
      add({ id: "fcf_yield", label: "FCF yield", value: y, unit: "%", verdict: "bad",
        text: `FCF ÂM (${B(fcf)}) và OCF ${ocf == null ? "không rõ" : "ÂM (" + B(ocf) + ")"} ⇒ core business ĐỐT TIỀN — cờ đỏ thực sự.` });
    }
  }

  // 2) CapEx / D&A — phân biệt growth vs maintenance vs dưới-đầu-tư
  if (capex == null || dna == null || dna === 0) {
    add({ id: "capex_dna", label: "CapEx / D&A", verdict: "gap", text: "Thiếu CapEx hoặc D&A." });
  } else {
    const r = round(capex / dna, 2);
    let verdict, text;
    if (r < 0.85) { verdict = "warn"; text = `CapEx/D&A = ${r} (<1): CẢNH BÁO — đầu tư dưới mức khấu hao, có thể đang thu hẹp/không tái đầu tư ⇒ nguy cơ mất lợi thế cạnh tranh.`; }
    else if (r <= 1.15) { verdict = "neutral"; text = `CapEx/D&A = ${r} (≈1): chủ yếu Maintenance CapEx — chi vừa đủ duy trì tài sản hiện có.`; }
    else { verdict = "good"; text = `CapEx/D&A = ${r} (>1): Growth CapEx — đang đầu tư tài sản mới để MỞ RỘNG quy mô (phần dôi ra trên mức khấu hao là chi cho tăng trưởng).`; }
    add({ id: "capex_dna", label: "CapEx / D&A", value: r, verdict, text: text + cfP });
  }

  // 2b) CapEx / OCF — bao nhiêu % dòng tiền hoạt động đang được tái đầu tư vào capex (TTM)
  const capexTTM = (fcf != null && ocf != null) ? (ocf - fcf) : capex;
  if (ocf == null || ocf === 0 || capexTTM == null) {
    add({ id: "capex_ocf", label: "CapEx / OCF", verdict: "gap", text: "Thiếu CapEx hoặc OCF." });
  } else {
    const r = round(capexTTM / ocf * 100, 0);
    let verdict = "neutral", text;
    if (r > 100) { verdict = "info"; text = `CapEx/OCF = ${r}% (>100%): capex VƯỢT dòng tiền hoạt động ⇒ FCF âm — đầu tư rất mạnh (đọc kèm FCF↔OCF & CapEx/D&A để biết là tăng trưởng hay đốt tiền).`; }
    else if (r >= 70) { text = `CapEx/OCF = ${r}%: tái đầu tư PHẦN LỚN dòng tiền hoạt động vào capex ⇒ FCF còn mỏng.`; }
    else if (r >= 30) { text = `CapEx/OCF = ${r}%: tái đầu tư mức vừa phải, vẫn dư FCF.`; }
    else { text = `CapEx/OCF = ${r}%: tái đầu tư nhẹ, dư nhiều dòng tiền tự do.`; }
    add({ id: "capex_ocf", label: "CapEx / OCF", value: r, unit: "%", verdict, text });
  }

  // 2c) Tăng trưởng TRUNG BÌNH 3 năm: OCF & Doanh thu (CAGR)
  const cagr3 = (ser) => {
    if (!Array.isArray(ser) || ser.length < 2) return null;
    const s = [...ser].sort((a, b) => a.fy - b.fy).slice(-4); // tối đa 4 điểm = 3 năm
    const start = s[0].value, end = s[s.length - 1].value, yrs = s.length - 1;
    if (!(start > 0) || !(end > 0) || yrs < 1) return null;
    return { g: round((Math.pow(end / start, 1 / yrs) - 1) * 100, 1), yrs };
  };
  const og = cagr3(vi.ocf_series);
  if (!og) add({ id: "ocf_cagr3", label: "OCF tăng TB 3 năm", verdict: "gap", text: "Thiếu chuỗi OCF nhiều năm (hoặc nền âm)." });
  else add({ id: "ocf_cagr3", label: "OCF tăng TB 3 năm", value: og.g, unit: "%/năm", verdict: og.g >= 15 ? "good" : og.g >= 0 ? "neutral" : "warn",
    text: `OCF (dòng tiền hoạt động) tăng trung bình ${og.g}%/năm trong ${og.yrs} năm gần nhất.` });
  const rgw = cagr3(vi.revenue_series);
  if (!rgw) add({ id: "rev_cagr3", label: "Doanh thu tăng TB 3 năm", verdict: "gap", text: "Thiếu chuỗi doanh thu nhiều năm." });
  else add({ id: "rev_cagr3", label: "Doanh thu tăng TB 3 năm", value: rgw.g, unit: "%/năm", verdict: rgw.g >= 15 ? "good" : rgw.g >= 0 ? "neutral" : "warn",
    text: `Doanh thu tăng trung bình ${rgw.g}%/năm trong ${rgw.yrs} năm gần nhất.` });

  // 2d) Biên lợi nhuận GỘP & RÒNG: hiện tại + 2 năm gần đây (kèm xu hướng)
  const marginLens = (id, label, ser) => {
    const s = (Array.isArray(ser) ? ser : []).slice().sort((a, b) => b.fy - a.fy).slice(0, 3); // mới→cũ
    if (!s.length) { add({ id, label, verdict: "gap", text: "Thiếu dữ liệu biên lợi nhuận." }); return; }
    const cur = s[0].value;
    const hist = s.map((e) => `${e.fy}: ${round(e.value, 1)}%`).join(" · ");
    let verdict = "neutral", trend = "đi ngang";
    if (s.length >= 2) {
      const diff = s[0].value - s[s.length - 1].value;
      if (diff > 1) { verdict = "good"; trend = "↑ cải thiện"; }
      else if (diff < -1) { verdict = "warn"; trend = "↓ co lại"; }
    }
    if (cur < 0) verdict = "warn";
    add({ id, label, value: round(cur, 1), unit: "%", verdict, text: `${label}: ${hist} (${trend}).` });
  };
  marginLens("gross_margin", "Biên LN gộp", vi.gross_margin_series);
  marginLens("net_margin", "Biên LN ròng", vi.net_margin_series);

  // 3) EV / EBITDA
  if (!ev || !ebitda || ebitda <= 0) {
    add({ id: "ev_ebitda", label: "EV / EBITDA", verdict: "gap", text: "Thiếu EV hoặc EBITDA (hoặc EBITDA ≤ 0)." });
  } else {
    const r = round(ev / ebitda, 1);
    const verdict = r < 12 ? "good" : r <= 20 ? "neutral" : "warn";
    add({ id: "ev_ebitda", label: "EV / EBITDA", value: r, verdict,
      text: `EV/EBITDA = ${r} (EV ${B(ev)} / EBITDA ${B(ebitda)}). ${r < 12 ? "Tương đối rẻ" : r <= 20 ? "Trung bình" : "Cao"} — lưu ý EBITDA BỎ QUA capex (đặc biệt quan trọng khi capex lớn) và ngưỡng phụ thuộc ngành.` });
  }

  // 4) Reverse-DCF: tăng trưởng NGẦM ĐỊNH trong giá
  const epsFwd = (c.eps_forward || []).filter((e) => typeof e.value === "number").sort((a, b) => a.fy - b.fy)[0]?.value;
  let base = (fcf != null && fcf > 0 && shares) ? fcf / shares : (epsFwd > 0 ? epsFwd : null);
  const baseLabel = (fcf != null && fcf > 0 && shares) ? "FCF/cp" : (epsFwd > 0 ? "forward EPS" : null);
  const r = opts.discount ?? 0.10, gt = opts.terminal ?? 0.03, N = opts.years ?? 10;
  if (!base || !price) {
    add({ id: "reverse_dcf", label: "Reverse-DCF (tăng trưởng ngầm định)", verdict: "gap",
      text: "Không tính được (FCF/cp và forward EPS đều không dương)." });
  } else {
    const g = impliedGrowth(price, base, { r, gt, N });
    add({ id: "reverse_dcf", label: "Reverse-DCF (tăng trưởng ngầm định)", value: g, unit: "%/năm", verdict: "info",
      text: `Với giá $${price}, thị trường đang NGẦM ĐỊNH ${baseLabel} tăng ~${g}%/năm trong ${N} năm (chiết khấu ${round(r * 100)}%, terminal ${round(gt * 100)}%). Hãy tự hỏi: mức này có khả thi không?`,
      caveat: "Nhạy với giả định chiết khấu/terminal — đây là tham số minh bạch, không phải nguồn." });
  }

  // 5) Rule of 40 (chỉ phần mềm/SaaS)
  if (!isSoftware) {
    // bỏ qua cho ngành ngoài phần mềm
  } else if (rg == null || fcf == null || !rev) {
    add({ id: "rule40", label: "Rule of 40 (phần mềm)", verdict: "gap", text: "Thiếu tăng trưởng doanh thu hoặc FCF/doanh thu." });
  } else {
    const rgp = round(rg * 100, 1), fm = round(fcf / rev * 100, 1), score = round(rgp + fm, 1);
    add({ id: "rule40", label: "Rule of 40 (phần mềm)", value: score, verdict: score >= 40 ? "good" : "warn",
      text: `Rule of 40 = tăng trưởng DT ${rgp}% + biên FCF ${fm}% = ${score} (${score >= 40 ? "≥40: khỏe" : "<40: dưới chuẩn"}).`,
      caveat: "Chỉ áp cho phần mềm/SaaS." });
  }

  return L;
}

// Cờ MÂU THUẪN: PEG nói rẻ nhưng có lăng kính đỏ -> cảnh báo.
export function lensContradiction(pegValue, lenses) {
  if (pegValue == null || pegValue >= 1) return null;
  const bad = lenses.find((l) => l.verdict === "bad");
  if (bad) return `PEG ${pegValue} < 1 (trông rẻ) NHƯNG lăng kính "${bad.label}" báo ĐỎ: ${bad.text} ⇒ "rẻ" có thể là bẫy.`;
  return null;
}
