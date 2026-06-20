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
    },
  };
}

// Prompt cho model: trả về JSON forward EPS + định tính. KHÔNG bịa số cứng.
export function researchMessages(hard) {
  const h = hard.hard;
  const epsHist = h.eps_actual.map((e) => `FY${e.fy}=${e.value}`).join(", ");
  const sys = `Bạn là analyst định lượng. Bạn ĐƯỢC CHO sẵn số cứng (giá, EPS quá khứ) và CHỈ được trả về JSON hợp lệ (không markdown, không giải thích ngoài JSON). ` +
    `TUYỆT ĐỐI KHÔNG bịa số cứng. Forward EPS là ƯỚC LƯỢNG của bạn — nếu không đủ tự tin cho năm nào thì để value:null. ` +
    `Mỗi forward EPS phải kèm "basis" (1 câu lý do/cơ sở) và "confidence" (low|med|high). Trả lời định tính bằng tiếng Việt.`;
  const schema = {
    company: "string", sector: "string", fiscal_year_end_month: "1-12",
    cyclical: "boolean", cyclical_reason: "string (nếu cyclical: nêu vì sao + rủi ro bẫy P/E đỉnh)",
    eps_basis_note: "string (GAAP vs non-GAAP)",
    forward_eps: hard._forwardFYs.map((fy) => ({ fy, value: "number|null", basis: "string", confidence: "low|med|high" })),
    forward_revenue: hard._forwardFYs.slice(0, 2).map((fy) => ({ fy, value: "number USD|null", basis: "string" })),
    fcf: { value: "number USD|null", negative: "boolean", note: "string" },
    growth_runway: { drivers: [{ text: "string" }], backlog_rpo: { text: "string" }, tam: { text: "string" }, segments: [{ text: "string" }], risks: ["string"] },
    loss_to_profit_note: "string (nếu EPS nền âm/gần 0 thì cảnh báo méo tăng trưởng)",
  };
  const usr = `MÃ: ${hard.ticker} (${h.company}, ngành ${h.sector}). Giá hiện tại: $${h.price.value}. ` +
    `EPS quá khứ (GAAP, Finnhub): ${epsHist}. EPS TTM: ${h.eps_ttm?.value ?? "?"}. vendor pegTTM: ${h.peg_ttm_vendor?.value ?? "?"} (chỉ tham khảo, không dùng). ` +
    `Hãy điền các năm tài chính forward: ${hard._forwardFYs.join(", ")}.\n` +
    `Trả về DUY NHẤT JSON theo schema sau (đúng khóa, value là số hoặc null):\n${JSON.stringify(schema)}`;
  return [{ role: "system", content: sys }, { role: "user", content: usr }];
}

function extractJSON(s) {
  if (!s) throw new Error("model trả rỗng");
  let txt = s.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const a = txt.indexOf("{"), b = txt.lastIndexOf("}");
  if (a < 0 || b < 0) throw new Error("model không trả JSON: " + txt.slice(0, 160));
  return JSON.parse(txt.slice(a, b + 1));
}

// Ghép số cứng (Finnhub) + ước lượng model -> canonical đầy đủ.
export function mergeModel(hard, modelRaw, modelId) {
  const j = extractJSON(modelRaw);
  const h = hard.hard;
  const today = hard.as_of;
  const mprov = (extra) => ({ source: `model:${modelId}`, url: null, as_of_date: today, tier: "model", ...extra });

  const eps_forward = [];
  const wantFYs = hard._forwardFYs;
  const got = new Map((j.forward_eps || []).map((e) => [Number(e.fy), e]));
  for (const fy of wantFYs) {
    const e = got.get(fy);
    if (e && typeof e.value === "number" && isFinite(e.value)) {
      eps_forward.push(mprov({ fy, value: round(e.value, 4), field: "forward_eps_estimate", basis: String(e.basis || "ước lượng model"), confidence: e.confidence || "low" }));
    } else {
      eps_forward.push({ fy, value: "GAP", reason: `model ${modelId} không đủ tự tin cho FY${fy}`, tier: "gap" });
    }
  }
  const revenue_forward = [];
  for (const r of (j.forward_revenue || [])) {
    if (typeof r.value === "number" && isFinite(r.value)) revenue_forward.push(mprov({ fy: Number(r.fy), value: Math.round(r.value), field: "forward_revenue_estimate", basis: String(r.basis || "ước lượng model") }));
  }
  let fcf;
  if (j.fcf && typeof j.fcf.value === "number" && isFinite(j.fcf.value)) {
    fcf = mprov({ value: Math.round(j.fcf.value), field: "fcf_estimate", basis: String(j.fcf.note || "ước lượng model"), note: String(j.fcf.note || "") });
  } else fcf = { value: "GAP", reason: "model không ước lượng FCF tuyệt đối", source: `model:${modelId}`, as_of_date: today, tier: "gap" };

  const gr = j.growth_runway || {};
  const txtNode = (o) => o && (o.text || typeof o === "string") ? { text: typeof o === "string" ? o : o.text, source: `model:${modelId}` } : null;
  const growth_runway = {
    drivers: (gr.drivers || []).map(txtNode).filter(Boolean),
    backlog_rpo: txtNode(gr.backlog_rpo),
    tam: txtNode(gr.tam),
    segments: (gr.segments || []).map(txtNode).filter(Boolean),
    risks: (gr.risks || []).map((r) => (typeof r === "string" ? r : r.text)).filter(Boolean),
  };
  if (!growth_runway.risks.length) growth_runway.risks = ["(model không nêu rủi ro cụ thể — cần bổ sung)"];

  return {
    ticker: hard.ticker,
    as_of: today,
    meta: {
      company: j.company || h.company,
      sector: j.sector || h.sector,
      fiscal_year_end_month: Number(j.fiscal_year_end_month) || h.fyeMonth,
      currency: "USD",
      cyclical: !!j.cyclical,
      cyclical_reason: j.cyclical_reason || "",
      eps_basis_note: j.eps_basis_note || "EPS quá khứ GAAP (Finnhub); forward do model ước lượng.",
      model: modelId,
      data_provenance: "hard=Finnhub; forward+qualitative=model(tier:model)",
    },
    price: h.price,
    eps_ttm: h.eps_ttm || { value: "GAP", reason: "Finnhub thiếu epsTTM", tier: "gap" },
    peg_ttm_vendor: h.peg_ttm_vendor || { value: "GAP", reason: "Finnhub thiếu pegTTM", tier: "gap" },
    pe_ttm_vendor: h.pe_ttm_vendor || { value: "GAP", reason: "Finnhub thiếu peTTM", tier: "gap" },
    eps_actual: h.eps_actual,
    eps_forward,
    revenue_forward,
    fcf,
    fundamentals_aux: h.beta ? { beta: h.beta } : {},
    growth_runway,
    gaps: [
      "Forward EPS & định tính do MODEL ước lượng (tier:model) — KHÔNG phải consensus vendor; cần kiểm chứng.",
      j.loss_to_profit_note ? `Lưu ý nền lợi nhuận: ${j.loss_to_profit_note}` : null,
    ].filter(Boolean),
  };
}
