// app.js — frontend dashboard (vanilla JS, không framework)
const $ = (s, r = document) => r.querySelector(s);
const fmt = (x, d = 2) => (x === null || x === undefined ? "—" : Number(x).toFixed(d));

// ---- markdown -> HTML tối giản (heading, bold, list, blockquote, table, link, hr) ----
function md2html(md) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s) => esc(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const lines = md.replace(/\r/g, "").split("\n");
  let html = "", i = 0, inList = false;
  const closeList = () => { if (inList) { html += "</ul>"; inList = false; } };
  while (i < lines.length) {
    const ln = lines[i];
    if (/^\s*\|.*\|\s*$/.test(ln) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      closeList();
      const row = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = row(ln); i += 2; let body = "";
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { body += "<tr>" + row(lines[i]).map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>"; i++; }
      html += `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;
      continue;
    }
    let m;
    if ((m = ln.match(/^(#{1,6})\s+(.*)/))) { closeList(); html += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; }
    else if (/^\s*>\s?/.test(ln)) { closeList(); html += `<blockquote>${inline(ln.replace(/^\s*>\s?/, ""))}</blockquote>`; }
    else if (/^\s*[-*]\s+/.test(ln)) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${inline(ln.replace(/^\s*[-*]\s+/, ""))}</li>`; }
    else if (/^\s*---+\s*$/.test(ln)) { closeList(); html += "<hr>"; }
    else if (ln.trim() === "") { closeList(); }
    else { closeList(); html += `<p>${inline(ln)}</p>`; }
    i++;
  }
  closeList();
  return html;
}

function guardLabel(f) {
  if (!f) return "—";
  const g = [];
  if (f.cyclical) g.push("Chu kỳ (bẫy P/E đỉnh)");
  if (f.loss_to_profit_applicable) g.push("Lỗ→lãi (méo tăng trưởng)");
  if (f.fcf_negative) g.push("FCF âm");
  if (f.peg_unreliable_low_growth) g.push("PEG ngắn hạn vô nghĩa");
  if (f.horizon_gap) g.push("Thiếu năm xa (GAP)");
  return g.length ? g.join(" · ") : "Cơ bản sạch";
}

let MODELS = null;
async function loadModels() {
  if (MODELS) return MODELS;
  const r = await fetch("/api/models").then((r) => r.json()).catch(() => ({ models: [], default: "" }));
  const sel = $("#model");
  sel.innerHTML = "";
  // ưu tiên nhóm gh/* và kr/* (đã kiểm chứng hoạt động) lên đầu
  const list = r.models || [];
  const pref = list.filter((m) => /^(gh|kr)\//.test(m));
  const rest = list.filter((m) => !/^(gh|kr)\//.test(m));
  for (const m of [...pref, ...rest]) {
    const o = document.createElement("option"); o.value = m; o.textContent = m; sel.appendChild(o);
  }
  sel.value = r.default && list.includes(r.default) ? r.default : (pref[0] || list[0] || "");
  MODELS = r; return r;
}

async function loadOverview() {
  const d = await fetch("/api/summary").then((r) => r.json());
  $("#meta").textContent = `Overall: ${d.overall || "—"} · cập nhật: ${d.generated ? new Date(d.generated).toLocaleString("vi-VN") : "—"} · ${d.rows.length} mã`;
  const tb = $("#tbl tbody"); tb.innerHTML = "";
  for (const r of d.rows) {
    const tr = document.createElement("tr");
    const pegCls = r.forwardPEG != null ? (r.forwardPEG < 1 ? "cheap" : "rich") : "";
    tr.innerHTML = `
      <td class="tk">${r.ticker}</td>
      <td><span class="badge ${r.verdict}">${r.verdict || "—"}</span></td>
      <td class="num">${fmt(r.forwardPE)}</td>
      <td class="num">${r.cagr_pct != null ? fmt(r.cagr_pct) + "%" : "—"}</td>
      <td class="num ${pegCls}">${fmt(r.forwardPEG)}</td>
      <td class="num">${fmt(r.vendor_pegTTM)}</td>
      <td class="guard">${guardLabel(r.flags)}</td>`;
    tr.onclick = () => openDetail(r.ticker);
    tb.appendChild(tr);
  }
}

let CURRENT = null;
async function openDetail(ticker) {
  CURRENT = ticker;
  $("#detail").hidden = false;
  $("#d-title").textContent = `${ticker} — báo cáo`;
  $("#report").innerHTML = "<p class='hint'>đang tải…</p>";
  $("#ai-out").innerHTML = ""; $("#ai-status").textContent = "";
  await loadModels();
  const rep = await fetch(`/api/report/${ticker}`).then((r) => r.json());
  $("#report").innerHTML = md2html(rep.markdown || "");
  $("#detail").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function ask(mode) {
  if (!CURRENT) return;
  const model = $("#model").value;
  const question = $("#q").value.trim();
  const btns = document.querySelectorAll(".ai button"); btns.forEach((b) => (b.disabled = true));
  $("#ai-status").textContent = `Đang hỏi ${model}…`;
  $("#ai-out").innerHTML = "";
  try {
    const t0 = Date.now();
    const r = await fetch("/api/ai", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, ticker: CURRENT, question, mode }),
    }).then((r) => r.json());
    if (r.error) throw new Error(r.error);
    $("#ai-status").textContent = `${r.model} · ${(r.ms / 1000).toFixed(1)}s`;
    $("#ai-out").innerHTML = md2html(r.content || "(rỗng)");
  } catch (e) {
    $("#ai-status").textContent = "Lỗi: " + (e.message || e);
  } finally {
    btns.forEach((b) => (b.disabled = false));
  }
}

$("#d-close").onclick = () => { $("#detail").hidden = true; CURRENT = null; };
$("#btn-review").onclick = () => ask("review");
$("#btn-explain").onclick = () => ask("explain");
$("#btn-ask").onclick = () => ask("ask");
$("#q").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask("ask"); });

// ================= Chạy mã mới (đa model song song) =================
const GOOD_RE = /^(gh\/gpt-4o-mini|kr\/claude-haiku-4\.5|gh\/gpt-4o|kr\/claude-sonnet-4\.5)$/;
async function loadModelChecklist() {
  const r = await fetch("/api/models").then((r) => r.json()).catch(() => ({ models: [] }));
  const list = (r.models || []).filter((m) => /^(gh|kr|cl|gemini|kc)\//.test(m));
  const box = $("#model-list"); box.innerHTML = "";
  for (const m of list) {
    const id = "m_" + m.replace(/[^a-z0-9]/gi, "_");
    const lab = document.createElement("label");
    lab.innerHTML = `<input type="checkbox" value="${m}" ${GOOD_RE.test(m) ? "checked" : ""}/> ${m}`;
    box.appendChild(lab);
  }
  box.addEventListener("change", updatePickCount);
  updatePickCount();
}
function pickedModels() { return [...document.querySelectorAll("#model-list input:checked")].map((i) => i.value); }
function updatePickCount() { $("#pick-count").textContent = `(${pickedModels().length} model đã chọn, tối đa 6)`; }

let HARD = null;
async function loadHard() {
  const ticker = $("#new-ticker").value.toUpperCase().trim();
  if (!/^[A-Z][A-Z.\-]{0,6}$/.test(ticker)) { $("#run-status").textContent = "Mã không hợp lệ"; return; }
  $("#btn-load").disabled = true; $("#run-status").textContent = `Đang lấy số cứng ${ticker} (Yahoo)…`;
  $("#eps-form").hidden = true; $("#run-results").innerHTML = "";
  try {
    const d = await fetch("/api/hard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticker }) }).then((r) => r.json());
    if (d.error) throw new Error(d.error);
    HARD = d;
    const epsHist = (d.eps_actual || []).map((e) => `FY${e.fy}=${e.value}`).join(", ");
    $("#hard-info").innerHTML = `<b>${d.ticker}</b> — ${d.company} · ${d.sector} · giá <b>$${d.price}</b> · EPS quá khứ: ${epsHist} · vendor pegTTM ${fmt(d.vendor_pegTTM)} <span class="hint">(Yahoo)</span>`;
    $("#eps-inputs").innerHTML = d.forwardFYs.map((fy) =>
      `<label>FY${fy} EPS<input type="number" step="any" inputmode="decimal" data-fy="${fy}" placeholder="vd 8.75"/></label>`).join("");
    $("#eps-form").hidden = false;
    $("#run-status").textContent = `Đã lấy dữ liệu — nhập forward EPS từ TradingView rồi bấm ② Chạy.`;
    $("#eps-inputs input")?.focus?.();
  } catch (e) { $("#run-status").textContent = "Lỗi: " + (e.message || e); }
  finally { $("#btn-load").disabled = false; }
}

function collectEPS() {
  const m = {};
  document.querySelectorAll("#eps-inputs input").forEach((i) => { const v = parseFloat(i.value); if (isFinite(v)) m[i.dataset.fy] = v; });
  return m;
}

async function runNew() {
  if (!HARD) { $("#run-status").textContent = "Bấm ① Lấy dữ liệu trước"; return; }
  const ticker = HARD.ticker;
  const forwardEPS = collectEPS();
  if (!Object.keys(forwardEPS).length) { $("#run-status").textContent = "Hãy nhập forward EPS ít nhất 1 năm"; return; }
  let models = pickedModels();
  if (!models.length) { $("#model-pick").hidden = false; $("#run-status").textContent = "Hãy chọn ít nhất 1 model (cho phần định tính)"; return; }
  models = models.slice(0, 6);
  $("#btn-run").disabled = true;
  $("#run-status").textContent = `Đang chạy ${ticker} · ${models.length} model (định tính song song)…`;
  $("#run-results").innerHTML = "";
  try {
    const t0 = Date.now();
    const d = await fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticker, forwardEPS, models }) }).then((r) => r.json());
    if (d.error) throw new Error(d.error);
    $("#run-status").textContent = `${ticker} · ${((Date.now() - t0) / 1000).toFixed(1)}s · ${d.results.length} model`;
    renderRun(d);
  } catch (e) { $("#run-status").textContent = "Lỗi: " + (e.message || e); }
  finally { $("#btn-run").disabled = false; }
}

function renderRun(d) {
  const q = d.quant || {};
  const epsUsed = Object.entries(d.forwardEPS || {}).map(([fy, v]) => `FY${fy}=${v}`).join(", ");
  const pegCls = q.forwardPEG != null ? (q.forwardPEG < 1 ? "cheap" : "rich") : "";
  let html = `<div class="run-head"><b>${d.ticker}</b> — ${d.company} · ${d.sector} · giá $${d.price} · forward EPS bạn nhập: <b>${epsUsed || "—"}</b></div>`;
  html += `<div class="quant-kpis">
    <div>forward P/E (FY${q.fy})<b>${fmt(q.forwardPE)}</b></div>
    <div>CAGR EPS<b>${q.cagr_pct != null ? fmt(q.cagr_pct) + "%" : "—"}</b></div>
    <div>forward PEG<b class="${pegCls}">${fmt(q.forwardPEG)}</b></div>
    <div>vendor pegTTM<b>${fmt(q.vendor_pegTTM)}</b></div>
  </div>`;
  html += `<div class="disp">✅ PEG tính từ giá Yahoo + forward EPS bạn nhập ⇒ <b>giống nhau ở mọi model</b> (hết phân tán). Bên dưới: phần ĐỊNH TÍNH mỗi model khác nhau.</div>`;
  html += `<div class="cmp">` + d.results.map(mcard).join("") + `</div>`;
  $("#run-results").innerHTML = html;
}

function mcard(r) {
  if (r.error) return `<div class="mcard"><h4>${r.model}</h4><div class="err">✗ ${r.error}</div></div>`;
  const pegCls = r.forwardPEG != null ? (r.forwardPEG < 1 ? "cheap" : "rich") : "";
  const guards = (r.checks || []).map((c) => `<span class="gpill ${c.status}" title="${c.id}">${c.id.split("_")[0]}</span>`).join("");
  const rep = md2html(r.report || "");
  return `<div class="mcard">
    <h4>${r.model}</h4>
    <div><span class="badge ${r.verdict}">${r.verdict}</span> ${r.model_sourced ? '<span class="gpill" style="color:#e3b341">model-sourced</span>' : ""}</div>
    <div class="kpis">
      <div>fwd P/E<b>${fmt(r.forwardPE)}</b></div>
      <div>CAGR<b>${r.cagr_pct != null ? fmt(r.cagr_pct) + "%" : "—"}</b></div>
      <div>forward PEG<b class="${pegCls}">${fmt(r.forwardPEG)}</b></div>
      <div>vendor pegTTM<b>${fmt(r.vendor_pegTTM)}</b></div>
    </div>
    <div class="guards-mini">${guards}</div>
    <details><summary>Xem báo cáo đầy đủ</summary><div class="md">${rep}</div></details>
  </div>`;
}

$("#btn-load").onclick = loadHard;
$("#btn-run").onclick = runNew;
$("#btn-toggle-models").onclick = () => { const e = $("#model-pick"); e.hidden = !e.hidden; };
$("#new-ticker").addEventListener("keydown", (e) => { if (e.key === "Enter") loadHard(); });
$("#pick-good").onclick = (e) => { e.preventDefault(); document.querySelectorAll("#model-list input").forEach((i) => (i.checked = GOOD_RE.test(i.value))); updatePickCount(); };
$("#pick-none").onclick = (e) => { e.preventDefault(); document.querySelectorAll("#model-list input").forEach((i) => (i.checked = false)); updatePickCount(); };

loadOverview().catch((e) => { $("#meta").textContent = "Lỗi tải dữ liệu: " + e.message; });
loadModelChecklist();
