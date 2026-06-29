// web/server.mjs — Backend cho dashboard phân tích cổ phiếu.
// - Phục vụ frontend tĩnh trong web/public
// - API đọc artifacts/reports do pipeline 8-phase sinh ra
// - Proxy AI tới 9router (OpenAI-compatible) — API KEY GIỮ Ở SERVER, không lộ ra frontend
//   Hỗ trợ nhiều model qua endpoint + key cấu hình bằng biến môi trường.
// Không phụ thuộc package ngoài (chỉ dùng http/fs built-in của Node >=18, ở đây Node 24).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { fetchHard, fetchHardYahoo, qualMessages, reviseMessages, buildCanonical, reviewMessages, metaMessages, parseJSONLoose } from "../scripts/research.mjs";
import { analyze } from "../scripts/engine.mjs";
import { computeDerived } from "../scripts/lib.mjs";
import { computeLenses } from "../scripts/lenses.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(__dirname, "public");
const FINNHUB_KEY = process.env.FINNHUB_KEY || "";
const MAX_MODELS = parseInt(process.env.MAX_MODELS || "6", 10);
const MAX_REFINE = parseInt(process.env.MAX_REFINE || "4", 10);
const RUBRIC = JSON.parse(fs.readFileSync(path.join(ROOT, "done.rubric.json"), "utf8"));
// Nguồn số cứng: 'finnhub' (cần key) hoặc 'yahoo' (yfinance, keyless). Auto theo key sẵn có.
const DATA_SOURCE = process.env.DATA_SOURCE || (FINNHUB_KEY ? "finnhub" : "yahoo");
const PYTHON_BIN = process.env.PYTHON_BIN || path.join(ROOT, ".venv/bin/python");
const YF_SCRIPT = path.join(ROOT, "scripts", "yf_hard.py");
// Script lấy forward EPS từ TradingView (headless Chromium) — của user, ở ~/forward-eps
const FWD_EPS_DIR = process.env.FWD_EPS_DIR || "/home/ubuntu/forward-eps";
const FWD_EPS_PY = process.env.FWD_EPS_PY || path.join(FWD_EPS_DIR, ".venv/bin/python");
// Cache forward EPS TradingView (mặc định 12h, lưu ra đĩa)
const TV_CACHE_DIR = path.join(ROOT, "tvcache");
try { fs.mkdirSync(TV_CACHE_DIR, { recursive: true }); } catch {}
const TV_TTL_MS = (parseFloat(process.env.FWD_EPS_TTL_HOURS || "12")) * 3600e3;
const tvMem = new Map();
function tvCacheGet(ticker) {
  const k = ticker.toUpperCase();
  let e = tvMem.get(k);
  if (!e) { try { e = JSON.parse(fs.readFileSync(path.join(TV_CACHE_DIR, k + ".json"), "utf8")); tvMem.set(k, e); } catch { return null; } }
  if (!e || (Date.now() - e.ts) > TV_TTL_MS) return null;
  return e;
}
function tvCacheSet(ticker, data) {
  const k = ticker.toUpperCase(); const e = { ts: Date.now(), data };
  tvMem.set(k, e);
  try { fs.writeFileSync(path.join(TV_CACHE_DIR, k + ".json"), JSON.stringify(e)); } catch {}
}
function fetchTvForwardEPS(ticker) {
  return new Promise((resolve, reject) => {
    execFile(FWD_EPS_PY,
      ["-c", "import json,sys; from tv_forecast_eps import get_tv_forecast_eps; print(json.dumps(get_tv_forecast_eps(sys.argv[1])))", ticker],
      { cwd: FWD_EPS_DIR, timeout: 110000, maxBuffer: 4e6 },
      (err, stdout, stderr) => {
        if (err && !stdout) return reject(new Error(String(stderr || err.message).slice(0, 300)));
        const line = (stdout || "").trim().split("\n").filter(Boolean).pop();
        try { resolve(JSON.parse(line)); } catch { reject(new Error("Không parse được output script: " + String(line || stderr || "").slice(0, 200))); }
      });
  });
}
async function fetchHardData(ticker) {
  return DATA_SOURCE === "finnhub"
    ? fetchHard(ticker, FINNHUB_KEY, { signal: AbortSignal.timeout(20000) })
    : fetchHardYahoo(ticker, { python: PYTHON_BIN, script: YF_SCRIPT });
}

const PORT = parseInt(process.env.PORT || "8895", 10);
const HOST = process.env.HOST || "127.0.0.1";
// 9router (OpenAI-compatible). Mặc định trỏ tới instance trên VPS; ghi đè bằng env.
const ROUTER_URL = (process.env.NINEROUTER_URL || "http://127.0.0.1:8889/v1").replace(/\/$/, "");
const ROUTER_KEY = process.env.NINEROUTER_KEY || "";
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || "gh/gpt-4o-mini";
const TICKERS = (process.env.TICKERS || "NVDA,MSFT,GOOGL,ORCL,AFRM").split(",").map((s) => s.trim());

const send = (res, code, body, headers = {}) => {
  res.writeHead(code, { "Cache-Control": "no-store", ...headers });
  res.end(body);
};
const sendJSON = (res, code, obj) => send(res, code, JSON.stringify(obj), { "Content-Type": "application/json; charset=utf-8" });
const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const exists = (p) => fs.existsSync(p);

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

function serveStatic(req, res) {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  const fp = path.join(PUBLIC, path.normalize(rel).replace(/^(\.\.[/\\])+/, ""));
  if (!fp.startsWith(PUBLIC) || !exists(fp) || !fs.statSync(fp).isFile()) return send(res, 404, "Not found");
  send(res, 200, fs.readFileSync(fp), { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream" });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = ""; req.on("data", (c) => { b += c; if (b.length > 2_000_000) reject(new Error("body too large")); });
    req.on("end", () => resolve(b)); req.on("error", reject);
  });
}

// ---- Tổng hợp dữ liệu pipeline cho 1 ticker ----
function tickerSummary() {
  const sumPath = path.join(ROOT, "artifacts", "run-summary.json");
  const sum = exists(sumPath) ? readJSON(sumPath) : { results: [] };
  const byTicker = Object.fromEntries((sum.results || []).map((r) => [r.ticker, r]));
  const rows = TICKERS.map((t) => {
    const specPath = path.join(ROOT, "artifacts", `spec-${t}.json`);
    const spec = exists(specPath) ? readJSON(specPath) : null;
    const s = byTicker[t] || {};
    return {
      ticker: t,
      verdict: s.verdict || null,
      forwardPE: s.forwardPE ?? spec?.headline?.forwardPE ?? null,
      cagr_pct: s.cagr_pct ?? spec?.growth?.cagr_pct ?? null,
      forwardPEG: s.forwardPEG ?? spec?.pegForward?.value ?? null,
      vendor_pegTTM: s.vendor_pegTTM ?? spec?.peg_vendor_for_compare ?? null,
      headline_fy: spec?.headline?.fy ?? null,
      flags: spec?.flags ?? null,
    };
  });
  return { generated: sum.ts || null, overall: sum.overall_verdict || null, rows };
}

function reportFor(ticker) {
  if (!TICKERS.includes(ticker)) return null;
  const md = path.join(ROOT, "reports", `${ticker}-analysis.md`);
  const spec = path.join(ROOT, "artifacts", `spec-${ticker}.json`);
  const deriv = path.join(ROOT, "artifacts", `derivation-log-${ticker}.md`);
  const ver = path.join(ROOT, "artifacts", `verifier-report-${ticker}.json`);
  return {
    ticker,
    markdown: exists(md) ? fs.readFileSync(md, "utf8") : "(chưa có report)",
    derivation: exists(deriv) ? fs.readFileSync(deriv, "utf8") : "",
    spec: exists(spec) ? readJSON(spec) : null,
    verifier: exists(ver) ? readJSON(ver) : null,
  };
}

// ---- Gọi 9router; xử lý cả JSON lẫn SSE upstream ----
async function routerChat({ model, messages, temperature = 0.3, max_tokens = 1200 }) {
  if (!ROUTER_KEY) throw new Error("Chưa cấu hình NINEROUTER_KEY ở server");
  const r = await fetch(`${ROUTER_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ROUTER_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature, max_tokens, stream: false }),
    signal: AbortSignal.timeout(150000),
  });
  const ct = r.headers.get("content-type") || "";
  const raw = await r.text();
  // Trường hợp JSON thuần
  if (ct.includes("application/json") && !raw.trimStart().startsWith("data:")) {
    let j; try { j = JSON.parse(raw); } catch { throw new Error("Upstream JSON lỗi: " + raw.slice(0, 300)); }
    if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
    const c = j.choices?.[0] || {};
    return c.message?.content ?? c.content ?? c.delta?.content ?? "";
  }
  // Trường hợp SSE: gộp các delta
  let out = "", err = "";
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("data:")) continue;
    const payload = t.slice(5).trim();
    if (payload === "[DONE]" || !payload) continue;
    try {
      const j = JSON.parse(payload);
      if (j.error) { err = j.error.message || JSON.stringify(j.error); continue; }
      const c = j.choices?.[0] || {};
      out += c.delta?.content ?? c.message?.content ?? c.text ?? "";
    } catch { /* bỏ qua dòng không parse được */ }
  }
  if (!out && err) throw new Error(err);
  if (!out && !ct.includes("event-stream")) {
    // Không phải SSE mà cũng không JSON hợp lệ
    try { const j = JSON.parse(raw); if (j.error) throw new Error(j.error.message); } catch (e) { if (e.message) throw e; }
  }
  return out;
}

// Tạo prompt nhận xét dựa trên report (reviewer context-mới — Phase 5c tinh thần brief)
function buildMessages(mode, ticker, question, reportText, spec) {
  const guard = `BỐI CẢNH: Đây là output của một pipeline phân tích cổ phiếu có cổng chặn & tự kiểm chứng. ` +
    `Mọi số đều có nguồn hoặc đánh dấu GAP. Forward PEG = forward P/E ÷ CAGR%. ` +
    `Đây là TÀI LIỆU THAM KHẢO, KHÔNG phải lời khuyên đầu tư. Trả lời bằng tiếng Việt, súc tích, có cấu trúc.`;
  const data = `\n\n=== REPORT ${ticker} ===\n${reportText}\n` +
    (spec ? `\n=== SỐ LIỆU PHÁI SINH ===\nforwardPE(FY${spec.headline?.fy})=${spec.headline?.forwardPE}, CAGR=${spec.growth?.cagr_pct}%, forwardPEG=${spec.pegForward?.value}, vendor pegTTM=${spec.peg_vendor_for_compare}; flags=${JSON.stringify(spec.flags)}\n` : "");
  let task;
  if (mode === "review") task = `NHIỆM VỤ (reviewer độc lập): Soi phần định tính & caveat của report. Có chỗ nào nói quá, bịa, hoặc mâu thuẫn với số liệu không? Caveat đã đủ chưa (chu kỳ, loss-to-profit, FCF, độ vênh nguồn)? Nêu 3-6 gạch đầu dòng + một câu kết luận pass/cần-sửa.`;
  else if (mode === "explain") task = `NHIỆM VỤ: Giải thích cho người đọc phổ thông ý nghĩa các con số (forward P/E, CAGR, forward PEG, vì sao vendor pegTTM bị cấm dùng) và "guard nổi bật" của riêng ${ticker}.`;
  else task = `CÂU HỎI CỦA NGƯỜI DÙNG: ${question || "Hãy tóm tắt điểm mấu chốt và rủi ro lớn nhất."}`;
  return [
    { role: "system", content: guard },
    { role: "user", content: task + data },
  ];
}

// WRITER viết/sửa phần định tính -> ghép forward EPS người dùng -> derive/build/verify.
// messages = qualMessages (vòng đầu) hoặc reviseMessages (vòng refine). Trả {qualRaw, a}.
async function writeQual(hard, model, forwardEPS, messages, max_tokens = 2400) {
  const qualRaw = await routerChat({ model, messages, temperature: 0.3, max_tokens });
  const canon = buildCanonical(hard, { forwardEPS, qualRaw, modelId: model });
  const gr = canon.growth_runway || {};
  const growthOk = (gr.drivers || []).length > 0 || !!gr.tam || (gr.segments || []).length > 0;
  return { qualRaw, a: analyze(canon, RUBRIC), growthOk };
}
function writerView(model, a, iterations, refined) {
  return {
    writer: model, verdict: a.verdict, forward_source: a.forward_source,
    forwardPE: a.forwardPE, fy: a.fy, cagr_pct: a.cagr_pct, forwardPEG: a.forwardPEG,
    vendor_pegTTM: a.vendor_pegTTM, flags: a.flags, iterations, refined,
    checks: a.checks.map((c) => ({ id: c.id, status: c.status, critical: c.critical })),
    report: a.report,
  };
}

// REVIEWER: model độc lập soi báo cáo của writer để bắt lỗi.
// Bỏ mọi finding nhắm vào ĐỘ TIN của forward EPS (người dùng nhập = tin cậy, không soi).
const EPS_TRUST_RE = /(forward[\s_-]?eps|eps\s*(forward|dự\s*phóng|tương\s*lai|ước\s*lượng))/i;
const TRUST_WORD_RE = /(tin cậy|độ tin|kiểm chứng|xác minh|verif|nguồn|tự nhập|người dùng nhập|không.*kiểm|độc lập|giả định|lạc quan|quá mức|quá cao|quá thấp|thổi phồng|phi thực tế|khó đạt|tham vọng|optimistic|aggressive|bất thường|thận trọng|chính xác|đáng tin)/i;
function isEpsTrustFinding(text) {
  const t = String(text || "");
  return EPS_TRUST_RE.test(t) && TRUST_WORD_RE.test(t);
}
async function runReviewer(model, ctx, max_tokens = 900) {
  const raw = await routerChat({ model, messages: reviewMessages(ctx), temperature: 0.2, max_tokens });
  const j = parseJSONLoose(raw);
  let findings = Array.isArray(j.findings) ? j.findings.slice(0, 10).map((f) => ({
    issue: String(f.issue || f.text || f).slice(0, 300), severity: f.severity || "med", section: f.section || "",
  })) : [];
  findings = findings.filter((f) => !isEpsTrustFinding(f.issue + " " + f.section)); // bỏ soi forward EPS
  const status = findings.length ? "revise" : (j.status === "revise" ? "pass" : (j.status === "pass" ? "pass" : "pass"));
  return { model, status, findings, summary: String(j.summary || "").slice(0, 400) };
}

// META-REVIEWER: gộp & khử trùng lặp findings của nhiều reviewer, chấm lại severity, quyết định revise/pass.
async function runMeta(model, ctx, rawFindings, max_tokens = 1200) {
  const raw = await routerChat({ model, messages: metaMessages(ctx, rawFindings), temperature: 0.1, max_tokens });
  const j = parseJSONLoose(raw);
  let findings = (Array.isArray(j.findings) ? j.findings : []).slice(0, 12).map((f) => ({
    issue: String(f.issue || f.text || f).slice(0, 300), severity: (f.severity || "med").toLowerCase(),
    from: Array.isArray(f.from) ? f.from : Array.isArray(f.sources) ? f.sources : [],
  })).filter((f) => f.issue && !isEpsTrustFinding(f.issue));
  const decision = (j.decision === "revise" && findings.length) ? "revise" : "pass";
  return { model, decision, findings, dropped: Math.max(0, rawFindings.length - findings.length), note: String(j.note || j.summary || "").slice(0, 300) };
}

// Phần định lượng KHÔNG phụ thuộc model (từ giá Yahoo + forward EPS người dùng).
function quantOnly(hard, forwardEPS) {
  const canon = buildCanonical(hard, { forwardEPS, qualRaw: null, modelId: null });
  const d = computeDerived(canon);
  const lenses = (canon.valuation_inputs && typeof canon.valuation_inputs.market_cap === "number") ? computeLenses(canon) : [];
  return { forwardPE: d.headline.forwardPE, fy: d.headline.fy, cagr_pct: d.growth.cagr_pct, forwardPEG: d.pegForward?.value ?? null, vendor_pegTTM: d.peg_vendor_for_compare, flags: d.flags, lenses };
}

const TICKER_RE = /^[A-Z][A-Z.\-]{0,6}$/;
function parseForwardEPS(obj) {
  const m = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const fy = parseInt(k, 10); const num = typeof v === "number" ? v : parseFloat(v);
    if (fy && isFinite(num)) m[fy] = num;
  }
  return m;
}

// ---- Job store: chạy nền + lịch sử BỀN VỮNG (ghi ra đĩa) ----
const JOBS_DIR = path.join(ROOT, "jobruns");
try { fs.mkdirSync(JOBS_DIR, { recursive: true }); } catch {}
const jobs = new Map();
const jobPublic = (j) => { const { _t0, ...rest } = j; return rest; };
function saveJob(j) { jobs.set(j.id, j); try { fs.writeFileSync(path.join(JOBS_DIR, j.id + ".json"), JSON.stringify(jobPublic(j))); } catch {} }
function getJob(id) {
  if (!/^[a-zA-Z0-9_-]{6,50}$/.test(id || "")) return null;
  if (jobs.has(id)) return jobs.get(id);
  try { const j = JSON.parse(fs.readFileSync(path.join(JOBS_DIR, id + ".json"), "utf8")); jobs.set(id, j); return j; } catch { return null; }
}
function listJobs(limit = 100) {
  try {
    return fs.readdirSync(JOBS_DIR).filter((f) => f.endsWith(".json")).map((f) => {
      try {
        const j = JSON.parse(fs.readFileSync(path.join(JOBS_DIR, f), "utf8"));
        return { id: j.id, ticker: j.ticker, company: j.company, ts: j.ts, forwardPEG: j.quant?.forwardPEG, forwardPE: j.quant?.forwardPE, status: j.status, warning: j.warning, iterations: j.iterations, writer: j.writerModel };
      } catch { return null; }
    }).filter(Boolean).sort((a, b) => String(b.ts).localeCompare(String(a.ts))).slice(0, limit);
  } catch { return []; }
}
const newId = () => Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
function deleteJob(id) {
  if (!/^[a-zA-Z0-9_-]{6,50}$/.test(id || "")) return false;
  jobs.delete(id);
  try { fs.unlinkSync(path.join(JOBS_DIR, id + ".json")); return true; } catch { return false; }
}
function clearJobs() {
  let n = 0;
  try { for (const f of fs.readdirSync(JOBS_DIR)) if (f.endsWith(".json")) { try { fs.unlinkSync(path.join(JOBS_DIR, f)); n++; } catch {} } } catch {}
  jobs.clear();
  return n;
}

// Chạy vòng refine ở NỀN, cập nhật job sau mỗi bước (frontend poll để xem tiến trình).
async function runJob(job, hard, forwardEPS) {
  try {
    const epsHist = hard.hard.eps_actual.map((e) => `FY${e.fy}=${e.value}`).join(", ");
    const ctxBase = { ticker: job.ticker, company: job.company, price: job.price, epsHist, forwardEPS, quant: { forwardPE: job.quant.forwardPE, cagr_pct: job.quant.cagr_pct, forwardPEG: job.quant.forwardPEG } };
    let { qualRaw, a, growthOk } = await writeQual(hard, job.writerModel, forwardEPS, qualMessages(hard));
    job.writer = writerView(job.writerModel, a, 1, false); saveJob(job);
    let iterations = 0, resolved = false, reviews = [];
    while (true) {
      iterations++;
      job.phase = `reviewers đang soi (vòng ${iterations}/${job.max_refine})`; saveJob(job);
      const ctx = { ...ctxBase, reportMd: a.report };
      reviews = await Promise.all(job.reviewerModels.map((m) => runReviewer(m, ctx).catch((e) => ({ model: m, error: String(e && e.message ? e.message : e) }))));
      const rawIssues = reviews.flatMap((r) => (r.findings || []).map((f) => ({ ...f, by: r.model }))).filter((f) => f.issue);

      // META-REVIEWER: gộp/khử trùng lặp/chấm severity nếu được bật & có >0 finding.
      let issues = rawIssues, metaInfo = null;
      if (job.metaModel && rawIssues.length) {
        try {
          const meta = await runMeta(job.metaModel, { ...ctxBase, reportMd: a.report }, rawIssues);
          issues = meta.findings;
          metaInfo = { model: job.metaModel, decision: meta.decision, kept: meta.findings.length, raw: rawIssues.length, dropped: meta.dropped, note: meta.note };
        } catch { /* lỗi meta -> dùng findings thô */ }
      }
      const hasIssues = metaInfo ? (metaInfo.decision === "revise" && issues.length > 0)
        : reviews.some((r) => r.status === "revise" && (r.findings || []).length);

      job.rounds.push({ iter: iterations, verdict: a.verdict, reviews: reviews.map((r) => ({ model: r.model, status: r.status, findings: (r.findings || []).length, error: r.error })), meta: metaInfo });
      job.reviews = reviews; job.meta = metaInfo; job.consolidated = issues; job.iterations = iterations; job.writer = writerView(job.writerModel, a, iterations, iterations > 1); saveJob(job);
      if (!hasIssues) { resolved = true; break; }
      if (iterations >= job.max_refine) break;
      job.phase = `writer đang sửa theo góp ý (vòng ${iterations + 1})`; saveJob(job);
      let rev;
      try { rev = await writeQual(hard, job.writerModel, forwardEPS, reviseMessages(hard, qualRaw, issues)); }
      catch { break; }
      // CHỐNG REGRESSION: chỉ nhận bản sửa nếu nó vẫn có nội dung định tính (không để bản rỗng ghi đè bản tốt).
      if (!rev.growthOk) { job.refine_note = "Bản revise trả nội dung định tính rỗng → giữ bản trước, dừng refine."; saveJob(job); break; }
      qualRaw = rev.qualRaw; a = rev.a;
      job.writer = writerView(job.writerModel, a, iterations + 1, true); saveJob(job);
    }
    job.resolved = resolved; job.warning = !resolved; job.status = "done"; job.phase = "hoàn tất"; job.ms = Date.now() - job._t0; saveJob(job);
  } catch (e) {
    job.status = "error"; job.error = String(e && e.message ? e.message : e); job.phase = "lỗi"; saveJob(job);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const p = url.pathname;

    if (p === "/api/summary") return sendJSON(res, 200, tickerSummary());
    if (p === "/api/health") return sendJSON(res, 200, { ok: true, router: ROUTER_URL, hasKey: !!ROUTER_KEY, dataSource: DATA_SOURCE, tickers: TICKERS });
    if (p.startsWith("/api/report/")) {
      const rep = reportFor(decodeURIComponent(p.slice("/api/report/".length)).toUpperCase());
      return rep ? sendJSON(res, 200, rep) : sendJSON(res, 404, { error: "ticker không hợp lệ" });
    }
    if (p === "/api/models") {
      try {
        const r = await fetch(`${ROUTER_URL}/models`, { headers: { Authorization: `Bearer ${ROUTER_KEY}` } });
        const j = await r.json();
        const ids = (j.data || []).map((m) => m.id);
        return sendJSON(res, 200, { default: DEFAULT_MODEL, models: ids });
      } catch (e) { return sendJSON(res, 200, { default: DEFAULT_MODEL, models: [DEFAULT_MODEL], error: String(e.message || e) }); }
    }
    if (p === "/api/ai" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const model = body.model || DEFAULT_MODEL;
      const ticker = (body.ticker || "").toUpperCase();
      const rep = ticker ? reportFor(ticker) : null;
      const messages = buildMessages(body.mode || "ask", ticker || "(none)", body.question, rep?.markdown || "(không có report)", rep?.spec);
      const t0 = Date.now();
      const content = await routerChat({ model, messages, temperature: body.temperature ?? 0.3 });
      return sendJSON(res, 200, { model, ms: Date.now() - t0, content });
    }
    if (p === "/api/forward-eps" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const ticker = String(body.ticker || "").toUpperCase().trim();
      if (!TICKER_RE.test(ticker)) return sendJSON(res, 400, { error: "Mã không hợp lệ" });
      if (body.refresh !== true) {
        const c = tvCacheGet(ticker);
        if (c) return sendJSON(res, 200, { ...c.data, cached: true, age_min: Math.round((Date.now() - c.ts) / 60000) });
      }
      try {
        const r = await fetchTvForwardEPS(ticker);
        if (r.error) return sendJSON(res, 502, { error: "TradingView: " + r.error });
        const byYear = {};
        (r.forward || []).forEach((f) => { if (f.eps != null && /^20\d\d$/.test(String(f.tv_year))) byYear[String(f.tv_year)] = f.eps; });
        const data = { ticker: r.ticker, price: r.price ?? null, exchange: r.exchange ?? null, source: r.source ?? "TradingView", forward: r.forward || [], byYear };
        tvCacheSet(ticker, data);
        return sendJSON(res, 200, { ...data, cached: false, age_min: 0 });
      } catch (e) { return sendJSON(res, 502, { error: "Lấy forward EPS lỗi: " + String(e.message || e) }); }
    }
    if (p === "/api/hard" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const ticker = String(body.ticker || "").toUpperCase().trim();
      if (!TICKER_RE.test(ticker)) return sendJSON(res, 400, { error: "Mã không hợp lệ" });
      let hard;
      try { hard = await fetchHardData(ticker); }
      catch (e) { return sendJSON(res, 400, { error: `RESEARCH (${DATA_SOURCE}) lỗi: ` + String(e.message || e) }); }
      return sendJSON(res, 200, {
        ticker, company: hard.hard.company, sector: hard.hard.sector, price: hard.hard.price.value,
        as_of: hard.as_of, forwardFYs: hard._forwardFYs,
        eps_actual: hard.hard.eps_actual.map((e) => ({ fy: e.fy, value: e.value })),
        vendor_pegTTM: hard.hard.peg_ttm_vendor?.value ?? null, eps_ttm: hard.hard.eps_ttm?.value ?? null,
      });
    }
    if (p === "/api/history") {
      if (req.method === "DELETE") return sendJSON(res, 200, { cleared: clearJobs() });
      return sendJSON(res, 200, { jobs: listJobs() });
    }
    if (p === "/api/compare") {
      const compareRow = (j) => {
        const q = j.quant || {};
        const lmap = {};
        (q.lenses || []).forEach((l) => { lmap[l.id] = { value: l.value, unit: l.unit, verdict: l.verdict, label: l.label, text: l.text }; });
        return {
          id: j.id, ticker: j.ticker, company: j.company, price: j.price, ts: j.ts, sector: j.sector,
          forwardPE: q.forwardPE ?? null, cagr_pct: q.cagr_pct ?? null, forwardPEG: q.forwardPEG ?? null,
          vendor_pegTTM: q.vendor_pegTTM ?? j.vendor_pegTTM ?? null, lenses: lmap,
          writerVerdict: j.writer?.verdict ?? null, forwardEPS: j.forwardEPS || {},
        };
      };
      let rows = [];
      const ids = (url.searchParams.get("ids") || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8);
      if (ids.length) rows = ids.map(getJob).filter(Boolean).map(compareRow);
      else {
        const tks = (url.searchParams.get("tickers") || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 8);
        const all = listJobs(500);
        for (const t of tks) { const s = all.find((x) => x.ticker === t); const j = s && getJob(s.id); if (j) rows.push(compareRow(j)); }
      }
      return sendJSON(res, 200, { rows });
    }
    if (p.startsWith("/api/job/")) {
      const id = decodeURIComponent(p.slice("/api/job/".length));
      if (req.method === "DELETE") return sendJSON(res, 200, { ok: deleteJob(id) });
      const j = getJob(id);
      return j ? sendJSON(res, 200, jobPublic(j)) : sendJSON(res, 404, { error: "job không tồn tại" });
    }
    if (p === "/api/run" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const ticker = String(body.ticker || "").toUpperCase().trim();
      if (!TICKER_RE.test(ticker)) return sendJSON(res, 400, { error: "Mã không hợp lệ (chữ in hoa, tối đa 7 ký tự)" });
      const forwardEPS = parseForwardEPS(body.forwardEPS);
      if (!Object.keys(forwardEPS).length) return sendJSON(res, 400, { error: "Hãy nhập forward EPS ít nhất 1 năm (lấy từ TradingView)" });
      const writer = body.writer || DEFAULT_MODEL;
      const aiEnabled = body.ai !== false; // tắt AI -> chỉ lấy & lưu dữ liệu
      let reviewers = Array.isArray(body.reviewers) ? body.reviewers.filter(Boolean) : [];
      reviewers = [...new Set(reviewers)].filter((r) => r !== writer).slice(0, MAX_MODELS);
      const metaModel = body.metaReviewer && String(body.metaReviewer).trim() ? String(body.metaReviewer).trim() : null;

      let hard;
      try { hard = await fetchHardData(ticker); }
      catch (e) { return sendJSON(res, 400, { error: `RESEARCH (${DATA_SOURCE}) lỗi: ` + String(e.message || e) }); }

      const quant = quantOnly(hard, forwardEPS); // ĐỊNH LƯỢNG sẵn ngay (giá Yahoo + EPS người dùng)
      const job = {
        id: newId(), ts: new Date().toISOString(), _t0: Date.now(),
        ticker, company: hard.hard.company, sector: hard.hard.sector, price: hard.hard.price.value,
        as_of: hard.as_of, forwardFYs: hard._forwardFYs, forwardEPS, quant,
        eps_actual: hard.hard.eps_actual.map((e) => ({ fy: e.fy, value: e.value })),
        vendor_pegTTM: hard.hard.peg_ttm_vendor?.value ?? null,
        writerModel: writer, reviewerModels: reviewers, metaModel, ai: aiEnabled,
        status: aiEnabled ? "running" : "done", phase: aiEnabled ? "writer đang viết phần định tính" : "chỉ dữ liệu (AI tắt)", iterations: 0,
        rounds: [], writer: null, reviews: [], meta: null, consolidated: [], resolved: false, warning: false, max_refine: MAX_REFINE,
        ms: aiEnabled ? undefined : 0,
      };
      saveJob(job);
      if (aiEnabled) runJob(job, hard, forwardEPS); // CHẠY NỀN — không await
      return sendJSON(res, 200, jobPublic(job)); // trả ngay: có jobId + quant (+lăng kính)
    }
    if (p.startsWith("/api/")) return sendJSON(res, 404, { error: "endpoint không tồn tại" });

    return serveStatic(req, res);
  } catch (e) {
    return sendJSON(res, 500, { error: String(e && e.message ? e.message : e) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[stock-pipeline] http://${HOST}:${PORT}  router=${ROUTER_URL} key=${ROUTER_KEY ? "set" : "MISSING"} tickers=${TICKERS.join(",")}`);
});
