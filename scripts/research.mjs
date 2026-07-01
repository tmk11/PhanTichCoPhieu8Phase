// research.mjs — Phase 1 RESEARCH tự động cho mã BẤT KỲ (chạy on-demand trên VPS).
// - Số CỨNG (giá, EPS quá khứ, pegTTM vendor) lấy từ Finnhub HTTP API HOẶC Yahoo (yfinance, keyless).
// - Forward EPS + định tính do MODEL ước lượng (tier:'model') — KHÔNG phải consensus vendor.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const pexec = promisify(execFile);
const FINNHUB = "https://finnhub.io/api/v1";

async function getJSON(url, signal) {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`Finnhub ${r.status} cho ${url.replace(/token=[^&]+/, "token=***")}`);
  return r.json();
}

// Lấy số cứng + lịch sử EPS từ Finnhub. Trả về phần canonical xác định (chưa có forward/định tính).
export async function fetchHard(ticker, key, { signal } = {}) {
  if (!key) throw new Error("Thiếu FINNHUB_KEY ở server");
  const t = encodeURIComponent(ticker);
  const [quote, metricR, profile] = await Promise.all([
    getJSON(`${FINNHUB}/quote?symbol=${t}&token=${key}`, signal),
    getJSON(`${FINNHUB}/stock/metric?symbol=${t}&metric=all&token=${key}`, signal),
    getJSON(`${FINNHUB}/stock/profile2?symbol=${t}&token=${key}`, signal).catch(() => ({})),
  ]);
  if (!quote || typeof quote.c !== "number" || quote.c === 0) throw new Error(`Không có giá cho '${ticker}' (mã không hợp lệ?)`);
  const m = metricR.metric || {};
  const epsSeries = (metricR.series?.annual?.eps || []).slice(0, 4); // 4 năm gần nhất
  if (!epsSeries.length) throw new Error(`Không có lịch sử EPS cho '${ticker}'`);
  const today = new Date().toISOString().slice(0, 10);
  const asOfQuote = quote.t ? new Date(quote.t * 1000).toISOString().slice(0, 10) : today;
  const fyeMonth = parseInt((epsSeries[0].period || "1900-12-01").slice(5, 7), 10) || 12;
  const lastActualFY = parseInt(epsSeries[0].period.slice(0, 4), 10);
  const prov = (extra) => ({ source: "Finnhub HTTP API", url: "https://finnhub.io/docs/api", as_of_date: today, tier: "data_vendor", ...extra });

  const eps_actual = epsSeries.map((e) => prov({
    fy: parseInt(e.period.slice(0, 4), 10), period: e.period, value: round(e.v), field: "eps", note: "GAAP diluted (Finnhub series.annual.eps)",
  }));

  return {
    ticker: ticker.toUpperCase(),
    as_of: today,
    _forwardFYs: [1, 2, 3, 4].map((k) => lastActualFY + k),
    _profile: profile,
    hard: {
      price: { ...prov({ value: round(quote.c, 4), field: "c", as_of_date: asOfQuote }) },
      eps_ttm: typeof m.epsTTM === "number" ? prov({ value: round(m.epsTTM, 4), field: "epsTTM", note: "GAAP diluted TTM" }) : null,
      peg_ttm_vendor: typeof m.pegTTM === "number" ? prov({ value: round(m.pegTTM, 5), field: "pegTTM", DO_NOT_USE_FOR_COMPUTE: true, note: "PEG dựng sẵn vendor — CẤM dùng (G1)." }) : null,
      pe_ttm_vendor: typeof m.peTTM === "number" ? prov({ value: round(m.peTTM, 4), field: "peTTM" }) : null,
      beta: typeof m.beta === "number" ? prov({ value: round(m.beta, 4), field: "beta", note: "Không dùng để sàng lọc tăng trưởng." }) : null,
      eps_actual,
      company: profile.name || ticker.toUpperCase(),
      sector: profile.finnhubIndustry || "?",
      fyeMonth, lastActualFY,
    },
  };
}

const round = (x, d = 4) => (x == null || Number.isNaN(x) ? x : Math.round(x * 10 ** d) / 10 ** d);

// Nguồn KEYLESS: Yahoo Finance qua scripts/yf_hard.py (yfinance). Cùng shape với fetchHard.
export async function fetchHardYahoo(ticker, { python, script, timeoutMs = 30000 } = {}) {
  let stdout;
  try { ({ stdout } = await pexec(python, [script, ticker], { timeout: timeoutMs, maxBuffer: 8e6 })); }
  catch (e) { throw new Error("yfinance lỗi: " + String(e.message || e)); }
  const line = (stdout || "").trim().split("\n").filter(Boolean).pop();
  let j; try { j = JSON.parse(line); } catch { throw new Error("yf_hard không trả JSON: " + (line || "").slice(0, 160)); }
  if (!j.ok) throw new Error(j.error || "yfinance không lấy được dữ liệu");
  const today = j.as_of;
  const prov = (extra) => ({ source: "Yahoo Finance (yfinance)", url: `https://finance.yahoo.com/quote/${j.ticker}`, as_of_date: today, tier: "data_vendor", ...extra });
  const eps_actual = (j.eps_actual || []).map((e) => prov({ fy: e.fy, period: e.period, value: e.value, field: "eps", note: "Diluted EPS năm (yfinance)" }));
  const lastActualFY = eps_actual.length ? eps_actual[0].fy : new Date().getFullYear() - 1;
  return {
    ticker: j.ticker, as_of: today, _forwardFYs: [1, 2, 3, 4].map((k) => lastActualFY + k), _profile: {},
    hard: {
      price: prov({ value: j.price, field: "c", as_of_date: j.price_as_of || today }),
      eps_ttm: j.eps_ttm != null ? prov({ value: j.eps_ttm, field: "epsTTM", note: "GAAP TTM (yfinance trailingEps)" }) : null,
      peg_ttm_vendor: j.peg_ttm != null ? prov({ value: j.peg_ttm, field: "pegTTM", DO_NOT_USE_FOR_COMPUTE: true, note: "PEG dựng sẵn vendor — CẤM dùng (G1)." }) : null,
      pe_ttm_vendor: j.pe_ttm != null ? prov({ value: j.pe_ttm, field: "peTTM" }) : null,
      beta: j.beta != null ? prov({ value: j.beta, field: "beta", note: "Không dùng để sàng lọc tăng trưởng." }) : null,
      eps_actual, company: j.company, sector: j.sector, fyeMonth: j.fye_month, lastActualFY,
      vi: {
        source: "Yahoo Finance (yfinance)", as_of: today, sector: j.sector, cf_period: j.cf_period ?? null,
        market_cap: j.market_cap ?? null, enterprise_value: j.enterprise_value ?? null, ebitda: j.ebitda ?? null,
        total_debt: j.total_debt ?? null, total_cash: j.total_cash ?? null,
        revenue: j.revenue ?? null, revenue_growth: j.revenue_growth ?? null, shares: j.shares ?? null,
        fcf_ttm: j.fcf_ttm ?? null, ocf_ttm: j.ocf_ttm ?? null,
        capex_annual: j.capex_annual ?? null, dna_annual: j.dna_annual ?? null,
        sbc_annual: j.sbc_annual ?? null,
        ocf_series: j.ocf_series || [], revenue_series: j.revenue_series || [],
        gross_margin_series: j.gross_margin_series || [], net_margin_series: j.net_margin_series || [],
      },
    },
  };
}

const QUAL_SCHEMA = {
  company: "string", sector: "string", fiscal_year_end_month: "1-12",
  cyclical: "boolean", cyclical_reason: "string (nếu cyclical: nêu vì sao + rủi ro bẫy P/E ở đỉnh chu kỳ)",
  eps_basis_note: "string (GAAP vs non-GAAP)",
  fcf: { value: "number USD|null", negative: "boolean", note: "string" },
  growth_runway: { drivers: [{ text: "string" }], backlog_rpo: { text: "string" }, tam: { text: "string" }, segments: [{ text: "string" }], risks: ["string"] },
  loss_to_profit_note: "string (nếu EPS nền âm/gần 0 thì cảnh báo méo tăng trưởng)",
};

// Prompt cho WRITER: CHỈ phần ĐỊNH TÍNH (forward EPS đã do người dùng nhập, không cần model đoán).
export function qualMessages(hard) {
  const h = hard.hard;
  const epsHist = h.eps_actual.map((e) => `FY${e.fy}=${e.value}`).join(", ");
  const sys = `Bạn là analyst cổ phiếu. Forward EPS ĐÃ do người dùng cung cấp (lấy từ TradingView) — bạn KHÔNG cần và KHÔNG được đoán forward EPS. ` +
    `Nhiệm vụ của bạn CHỈ là phần ĐỊNH TÍNH. Trả về DUY NHẤT JSON hợp lệ (không markdown, không văn xuôi ngoài JSON). Viết tiếng Việt.`;
  const usr = `MÃ: ${hard.ticker} (${h.company}, ngành ${h.sector}). Giá: $${h.price.value}. EPS quá khứ (GAAP): ${epsHist}. ` +
    `Chỉ trả phần ĐỊNH TÍNH theo schema (KHÔNG forward EPS):\n${JSON.stringify(QUAL_SCHEMA)}`;
  return [{ role: "system", content: sys }, { role: "user", content: usr }];
}

// Prompt cho WRITER TỰ SỬA (refine) theo góp ý reviewer.
export function reviseMessages(hard, prevQualRaw, findings) {
  const h = hard.hard;
  const epsHist = h.eps_actual.map((e) => `FY${e.fy}=${e.value}`).join(", ");
  const prev = parseJSONLoose(prevQualRaw);
  const flist = (findings || []).map((f, i) => `${i + 1}. [${f.severity || "med"}] ${f.issue}${f.by ? ` (reviewer ${f.by})` : ""}`).join("\n") || "(không có)";
  const sys = `Bạn là analyst (WRITER). Đây là bản ĐỊNH TÍNH trước của bạn và GÓP Ý của reviewer độc lập. ` +
    `Hãy SỬA để khắc phục TẤT CẢ góp ý: bổ sung caveat còn thiếu (chu kỳ & bẫy P/E đỉnh, nền lỗ→lãi, FCF âm, độ tin forward EPS), ` +
    `bỏ khẳng định bịa/nói quá, làm rõ mâu thuẫn với số liệu. Chỉ trả về DUY NHẤT JSON ĐÚNG schema cũ (không markdown). ` +
    `KHÔNG bịa số cứng/forward EPS. Viết tiếng Việt.`;
  const usr = `MÃ ${hard.ticker} (${h.company}). EPS quá khứ: ${epsHist}.\n` +
    `BẢN ĐỊNH TÍNH TRƯỚC (JSON):\n${JSON.stringify(prev)}\n\n` +
    `GÓP Ý REVIEWER CẦN KHẮC PHỤC:\n${flist}\n\n` +
    `Trả về JSON định tính ĐÃ SỬA theo đúng schema:\n${JSON.stringify(QUAL_SCHEMA)}`;
  return [{ role: "system", content: sys }, { role: "user", content: usr }];
}

export function parseJSONLoose(s) {
  if (!s) return {};
  let t = String(s).replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```(?:json)?/gi, "").trim();
  const i = t.indexOf("{");
  if (i < 0) return {};
  // Quét ngoặc cân bằng từ '{' đầu tiên (bỏ qua chuỗi/escape) -> lấy object hoàn chỉnh, chịu được prose thừa.
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let k = i; k < t.length; k++) {
    const ch = t[k];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; }
    else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { end = k; break; } }
  }
  const slice = end >= 0 ? t.slice(i, end + 1) : t.slice(i);
  try { return JSON.parse(slice); } catch {}
  // Bị cắt cụt: đóng nốt ngoặc còn thiếu (đúng loại { } / [ ]) rồi parse.
  const stack = []; let str = false, e = false;
  for (let k = 0; k < slice.length; k++) {
    const ch = slice[k];
    if (str) { if (e) e = false; else if (ch === "\\") e = true; else if (ch === '"') str = false; }
    else if (ch === '"') str = true;
    else if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  let fix = slice.replace(/,\s*$/, "");
  if (str) fix += '"';
  while (stack.length) fix += stack.pop();
  try { return JSON.parse(fix); } catch {}
  // Phương án cuối: cắt tới '}' cuối cùng.
  const last = slice.lastIndexOf("}");
  if (last > 0) { try { return JSON.parse(slice.slice(0, last + 1)); } catch {} }
  return {};
}
const extractJSON = parseJSONLoose;

// Prompt cho REVIEWER context-mới: soi báo cáo để BẮT LỖI (không viết lại, không bịa số).
export function reviewMessages({ ticker, company, price, epsHist, forwardEPS, quant, reportMd }) {
  const fwd = Object.entries(forwardEPS || {}).map(([fy, v]) => `FY${fy}=${v}`).join(", ") || "(chưa nhập)";
  const sys = `Bạn là REVIEWER ĐỘC LẬP, context mới. Nhiệm vụ DUY NHẤT: soi phần ĐỊNH TÍNH của báo cáo để BẮT LỖI. ` +
    `Chỉ trả về JSON hợp lệ (không markdown, không văn xuôi ngoài JSON). KHÔNG viết lại báo cáo, KHÔNG tự bịa số mới. ` +
    `QUAN TRỌNG: forward EPS là ĐẦU VÀO TIN CẬY do NGƯỜI DÙNG tự nhập từ TradingView — coi như ĐÚNG. ` +
    `TUYỆT ĐỐI KHÔNG soi, KHÔNG nghi ngờ, KHÔNG trừ điểm vì forward EPS "thiếu kiểm chứng/thiếu nguồn/không xác minh độc lập". ` +
    `KHÔNG tạo bất kỳ finding nào về độ tin cậy/nguồn của forward EPS. ` +
    `Chỉ soi 4 nhóm: (1) khẳng định BỊA/không có cơ sở trong phần định tính, (2) NÓI QUÁ/hype, ` +
    `(3) MÂU THUẪN nội tại của phần định tính, (4) THIẾU caveat quan trọng (chu kỳ & bẫy P/E đỉnh, nền lỗ→lãi, FCF âm). ` +
    `Nếu phần định tính ổn, status="pass"; nếu có lỗi cần sửa, status="revise".`;
  const data = `DỮ LIỆU CỨNG (chuẩn để đối chiếu — KHÔNG soi forward EPS):\n` +
    `- Mã ${ticker} (${company}), giá hiện tại $${price}\n- EPS quá khứ (GAAP): ${epsHist}\n` +
    `- forward EPS (ĐẦU VÀO TIN CẬY, người dùng nhập — coi như đúng, không soi): ${fwd}\n` +
    `- Số tự tính (code, đã đúng): forward P/E=${quant.forwardPE}, CAGR=${quant.cagr_pct}%, forward PEG=${quant.forwardPEG}\n\n` +
    `BÁO CÁO CẦN SOI (chỉ phần định tính):\n${reportMd}`;
  const schema = { status: "pass|revise", findings: [{ issue: "mô tả lỗi ngắn", severity: "low|med|high", section: "mục nào" }], summary: "1-2 câu kết luận" };
  return [{ role: "system", content: sys }, { role: "user", content: data + `\n\nTrả về DUY NHẤT JSON theo schema:\n${JSON.stringify(schema)}` }];
}

// META-REVIEWER: gộp findings của nhiều reviewer -> khử trùng lặp, bỏ vụn vặt, chấm lại severity.
export function metaMessages(ctx, findings) {
  const { ticker, company, price, epsHist, quant } = ctx;
  const list = findings.map((f, i) => `${i + 1}. [${f.severity || "med"}] (${f.by || "?"}) ${f.issue}`).join("\n") || "(không có)";
  const sys = `Bạn là META-REVIEWER (trọng tài). Nhiều reviewer độc lập đã soi một báo cáo cổ phiếu và liệt kê findings (có thể trùng lặp, vụn vặt, hoặc khắt khe quá mức). ` +
    `Nhiệm vụ: (1) GỘP các finding trùng/tương tự thành MỘT; (2) BỎ finding vụn vặt/pedantic/không ảnh hưởng quyết định đầu tư, và BỎ mọi finding về độ tin/nguồn của forward EPS (forward EPS là số NGƯỜI DÙNG nhập, coi như tin cậy); ` +
    `(3) Chấm lại severity (high/med/low) theo mức ẢNH HƯỞNG thực sự tới quyết định; ` +
    `(4) Quyết định report có CẦN SỬA không: 'revise' CHỈ khi còn finding high/med THỰC CHẤT; nếu chỉ còn low/vụn vặt thì 'pass'. ` +
    `Chỉ trả về DUY NHẤT JSON hợp lệ (không markdown). Viết tiếng Việt.`;
  const usr = `BỐI CẢNH: ${ticker} (${company}), giá $${price}, EPS quá khứ: ${epsHist}, forward P/E=${quant.forwardPE}, forward PEG=${quant.forwardPEG}.\n` +
    `FINDINGS THÔ TỪ CÁC REVIEWER:\n${list}\n\n` +
    `Trả JSON: ${JSON.stringify({ decision: "pass|revise", findings: [{ issue: "đã gộp/viết gọn", severity: "high|med|low", from: ["reviewer model"] }], dropped_count: 0, note: "1 câu vì sao" })}`;
  return [{ role: "system", content: sys }, { role: "user", content: usr }];
}

// Ghép: số cứng (Yahoo) + forward EPS NGƯỜI DÙNG nhập + định tính của model -> canonical.
export function buildCanonical(hard, { forwardEPS = {}, qualRaw = null, modelId = null } = {}) {
  const h = hard.hard;
  const today = hard.as_of;
  const j = qualRaw ? extractJSON(qualRaw) : {};

  // Forward EPS do người dùng nhập (tier:'user') — lấy từ TradingView.
  const uprov = (extra) => ({ source: "Người dùng nhập (TradingView)", url: null, as_of_date: today, tier: "user", ...extra });
  const eps_forward = hard._forwardFYs.map((fy) => {
    const v = forwardEPS[fy] ?? forwardEPS[String(fy)];
    return (typeof v === "number" && isFinite(v))
      ? uprov({ fy, value: round(v, 4), field: "forward_eps_user", basis: "Người dùng nhập từ TradingView" })
      : { fy, value: "GAP", reason: `Người dùng chưa nhập forward EPS FY${fy}`, tier: "gap" };
  });

  // FCF từ model (tier:model) hoặc GAP.
  let fcf;
  if (j.fcf && typeof j.fcf.value === "number" && isFinite(j.fcf.value)) {
    fcf = { value: Math.round(j.fcf.value), source: `model:${modelId}`, url: null, as_of_date: today, tier: "model", field: "fcf_estimate", basis: String(j.fcf.note || "ước lượng model"), note: String(j.fcf.note || "") };
  } else fcf = { value: "GAP", reason: "model không ước lượng FCF tuyệt đối", source: `model:${modelId || "?"}`, as_of_date: today, tier: "gap" };

  const gr = j.growth_runway || {};
  const arr = (x) => (Array.isArray(x) ? x : x ? [x] : []);
  const txtNode = (o) => (o && (o.text || typeof o === "string")) ? { text: typeof o === "string" ? o : o.text, source: `model:${modelId}` } : null;
  const growth_runway = {
    drivers: arr(gr.drivers).map(txtNode).filter(Boolean),
    backlog_rpo: txtNode(gr.backlog_rpo),
    tam: txtNode(gr.tam),
    segments: arr(gr.segments).map(txtNode).filter(Boolean),
    risks: arr(gr.risks).map((r) => (typeof r === "string" ? r : r && r.text)).filter(Boolean),
  };
  if (!growth_runway.risks.length) growth_runway.risks = ["(model không nêu rủi ro cụ thể — cần bổ sung thủ công)"];

  return {
    ticker: hard.ticker, as_of: today,
    meta: {
      company: j.company || h.company, sector: j.sector || h.sector,
      fiscal_year_end_month: Number(j.fiscal_year_end_month) || h.fyeMonth, currency: "USD",
      cyclical: !!j.cyclical, cyclical_reason: j.cyclical_reason || "",
      eps_basis_note: j.eps_basis_note || "EPS quá khứ GAAP (Yahoo); forward EPS do người dùng nhập từ TradingView.",
      model: modelId, data_provenance: "hard=Yahoo; forward EPS=user(TradingView); định tính=model",
    },
    price: h.price,
    eps_ttm: h.eps_ttm || { value: "GAP", reason: "thiếu epsTTM", tier: "gap" },
    peg_ttm_vendor: h.peg_ttm_vendor || { value: "GAP", reason: "thiếu pegTTM", tier: "gap" },
    pe_ttm_vendor: h.pe_ttm_vendor || { value: "GAP", reason: "thiếu peTTM", tier: "gap" },
    eps_actual: h.eps_actual,
    eps_forward,
    revenue_forward: [],
    fcf,
    valuation_inputs: h.vi || {},
    fundamentals_aux: h.beta ? { beta: h.beta } : {},
    growth_runway,
    gaps: [
      "Forward EPS do NGƯỜI DÙNG nhập (từ TradingView) — không phải consensus tự động; tin cậy theo nguồn người dùng.",
      "Phần định tính (TAM, FCF, cyclical) do model sinh (tier:model) — cần kiểm chứng.",
      j.loss_to_profit_note ? `Lưu ý nền lợi nhuận: ${j.loss_to_profit_note}` : null,
    ].filter(Boolean),
  };
}
