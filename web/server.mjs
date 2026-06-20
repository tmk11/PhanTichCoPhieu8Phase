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
import { fetchHard, researchMessages, mergeModel } from "../scripts/research.mjs";
import { analyze } from "../scripts/engine.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(__dirname, "public");
const FINNHUB_KEY = process.env.FINNHUB_KEY || "";
const MAX_MODELS = parseInt(process.env.MAX_MODELS || "6", 10);
const RUBRIC = JSON.parse(fs.readFileSync(path.join(ROOT, "done.rubric.json"), "utf8"));

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

// Chạy 8-phase on-demand cho 1 (mã, model): research model -> ghép Finnhub -> derive/build/verify.
async function runOneModel(hard, model, max_tokens = 1700) {
  const raw = await routerChat({ model, messages: researchMessages(hard), temperature: 0.2, max_tokens });
  const canon = mergeModel(hard, raw, model);
  const a = analyze(canon, RUBRIC);
  return {
    model, verdict: a.verdict, model_sourced: a.model_sourced,
    forwardPE: a.forwardPE, fy: a.fy, cagr_pct: a.cagr_pct, forwardPEG: a.forwardPEG,
    vendor_pegTTM: a.vendor_pegTTM, flags: a.flags,
    checks: a.checks.map((c) => ({ id: c.id, status: c.status, critical: c.critical })),
    report: a.report,
  };
}

const TICKER_RE = /^[A-Z][A-Z.\-]{0,6}$/;

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const p = url.pathname;

    if (p === "/api/summary") return sendJSON(res, 200, tickerSummary());
    if (p === "/api/health") return sendJSON(res, 200, { ok: true, router: ROUTER_URL, hasKey: !!ROUTER_KEY, tickers: TICKERS });
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
    if (p === "/api/run" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const ticker = String(body.ticker || "").toUpperCase().trim();
      if (!TICKER_RE.test(ticker)) return sendJSON(res, 400, { error: "Mã không hợp lệ (chữ in hoa, tối đa 7 ký tự)" });
      let models = Array.isArray(body.models) ? body.models.filter(Boolean) : [];
      if (!models.length) models = [DEFAULT_MODEL];
      models = [...new Set(models)].slice(0, MAX_MODELS);
      if (!FINNHUB_KEY) return sendJSON(res, 500, { error: "Server chưa cấu hình FINNHUB_KEY" });

      let hard;
      try { hard = await fetchHard(ticker, FINNHUB_KEY, { signal: AbortSignal.timeout(20000) }); }
      catch (e) { return sendJSON(res, 400, { error: "RESEARCH (Finnhub) lỗi: " + String(e.message || e) }); }

      const t0 = Date.now();
      // CHẠY SONG SONG các model
      const results = await Promise.all(models.map((m) =>
        runOneModel(hard, m).catch((e) => ({ model: m, error: String(e && e.message ? e.message : e) }))));
      return sendJSON(res, 200, {
        ticker, company: hard.hard.company, sector: hard.hard.sector,
        price: hard.hard.price.value, as_of: hard.as_of, forwardFYs: hard._forwardFYs,
        eps_actual: hard.hard.eps_actual.map((e) => ({ fy: e.fy, value: e.value })),
        vendor_pegTTM: hard.hard.peg_ttm_vendor?.value ?? null,
        ms: Date.now() - t0, results,
      });
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
