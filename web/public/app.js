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

const WRITER_PREF = ["kr/claude-sonnet-4.5", "gh/gpt-4o", "kr/claude-haiku-4.5", "gh/gpt-4o-mini"];
function loadModelChecklist() {
  return fetch("/api/models").then((r) => r.json()).then((r) => {
    const list = (r.models || []).filter((m) => /^(gh|kr|cl|gemini|kc)\//.test(m));
    // Writer dropdown
    const wsel = $("#writer-model"); wsel.innerHTML = "";
    for (const m of list) { const o = document.createElement("option"); o.value = m; o.textContent = m; wsel.appendChild(o); }
    wsel.value = WRITER_PREF.find((m) => list.includes(m)) || list[0] || "";
    // Meta-reviewer dropdown: có lựa chọn "(tắt)" + danh sách model
    const msel = $("#meta-model"); msel.innerHTML = '<option value="">(tắt — dùng findings thô)</option>';
    for (const m of list) { const o = document.createElement("option"); o.value = m; o.textContent = m; msel.appendChild(o); }
    msel.value = WRITER_PREF.find((m) => list.includes(m)) || list[0] || "";
    // Reviewer checklist
    const box = $("#model-list"); box.innerHTML = "";
    for (const m of list) {
      const lab = document.createElement("label");
      lab.innerHTML = `<input type="checkbox" value="${m}" ${GOOD_RE.test(m) ? "checked" : ""}/> ${m}`;
      box.appendChild(lab);
    }
    box.addEventListener("change", updatePickCount);
    updatePickCount();
  }).catch(() => {});
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

const LS_CUR = "sp_current_job";
let POLL = null;

async function runNew() {
  if (!HARD) { $("#run-status").textContent = "Bấm ① Lấy dữ liệu trước"; return; }
  const ticker = HARD.ticker;
  const forwardEPS = collectEPS();
  if (!Object.keys(forwardEPS).length) { $("#run-status").textContent = "Hãy nhập forward EPS ít nhất 1 năm"; return; }
  const ai = $("#ai-toggle").checked;
  const writer = $("#writer-model").value;
  const metaReviewer = $("#meta-model").value;
  const reviewers = pickedModels().filter((m) => m !== writer).slice(0, 6);
  $("#btn-run").disabled = true;
  $("#run-status").textContent = "Đang khởi tạo…";
  $("#run-results").innerHTML = "";
  try {
    const d = await fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticker, forwardEPS, writer, reviewers, metaReviewer, ai }) }).then((r) => r.json());
    if (d.error) throw new Error(d.error);
    localStorage.setItem(LS_CUR, d.id);
    renderJob(d);            // hiện ngay 4 chỉ số định lượng + lăng kính
    if (d.status === "running") startPolling(d.id); // chỉ poll khi có AI chạy nền
    loadHistory();
  } catch (e) { $("#run-status").textContent = "Lỗi: " + (e.message || e); }
  finally { $("#btn-run").disabled = false; }
}

function startPolling(id) {
  if (POLL) clearInterval(POLL);
  POLL = setInterval(async () => {
    try {
      const j = await fetch("/api/job/" + id).then((r) => r.json());
      if (j.error) { clearInterval(POLL); POLL = null; return; }
      renderJob(j);
      if (j.status !== "running") { clearInterval(POLL); POLL = null; loadHistory(); }
    } catch { /* giữ poll, thử lại */ }
  }, 2000);
}

// Hiển thị: 4 chỉ số ĐỊNH LƯỢNG trước (luôn có), phần phân tích AI hiện dần theo job.status.
function renderJob(d) {
  const q = d.quant || {};
  const w = d.writer || null;
  const running = d.status === "running";
  const epsUsed = Object.entries(d.forwardEPS || {}).map(([fy, v]) => `FY${fy}=${v}`).join(", ");
  const pegCls = q.forwardPEG != null ? (q.forwardPEG < 1 ? "cheap" : "rich") : "";
  const aiOff = d.ai === false;
  $("#run-status").textContent = running ? `⏳ ${d.phase || "đang chạy"}…` : (d.status === "error" ? "Lỗi: " + (d.error || "") : aiOff ? "✓ đã lấy & lưu dữ liệu (AI tắt)" : `✓ xong · ${d.ms ? (d.ms / 1000).toFixed(1) + "s" : ""}`);

  let html = `<div class="run-head"><b>${d.ticker}</b> — ${d.company} · ${d.sector} · giá $${d.price} · forward EPS bạn nhập: <b>${epsUsed || "—"}</b></div>`;
  html += `<div class="quant-kpis">
    <div>forward P/E (FY${q.fy})<b>${fmt(q.forwardPE)}</b></div>
    <div>CAGR EPS<b>${q.cagr_pct != null ? fmt(q.cagr_pct) + "%" : "—"}</b></div>
    <div>forward PEG<b class="${pegCls}">${fmt(q.forwardPEG)}</b></div>
    <div>vendor pegTTM<b>${fmt(q.vendor_pegTTM)}</b></div>
  </div>`;
  html += `<div class="hint">✅ 4 chỉ số trên tính từ giá Yahoo + forward EPS bạn nhập (có ngay, không đợi AI).</div>`;
  // Đa lăng kính định giá (deterministic, có ngay)
  const LICON = { good: "🟢", neutral: "⚪", warn: "🟠", bad: "🔴", info: "🔵", gap: "⚪" };
  const lenses = q.lenses || [];
  if (lenses.length) {
    html += `<div class="lens-wrap"><h4 style="margin:10px 0 4px">🔭 Đa lăng kính định giá (đừng nhìn PEG một mình)</h4><div class="lens-grid">`;
    for (const l of lenses) {
      const v = l.verdict === "gap" ? "GAP" : (l.value != null ? `${l.value}${l.unit || ""}` : "—");
      html += `<div class="lens ${l.verdict}"><div class="lens-h">${LICON[l.verdict] || ""} ${l.label}</div><div class="lens-v">${v}</div><div class="lens-t">${escapeHtml(l.text || "")}</div></div>`;
    }
    html += `</div></div>`;
  }

  // refine timeline (cập nhật dần) — hiện cả gộp meta
  if ((d.rounds || []).length) {
    html += `<div class="rounds">` + d.rounds.map((rd) => {
      const tot = rd.reviews.reduce((s, x) => s + (x.findings || 0), 0);
      const m = rd.meta;
      const label = m ? `vòng ${rd.iter}: ${tot}→${m.kept} lỗi (meta bỏ ${m.dropped})` : `vòng ${rd.iter}: ${tot ? tot + " lỗi" : "sạch"}`;
      const ok = m ? (m.decision !== "revise") : rd.reviews.every((x) => x.status === "pass");
      return `<span class="round ${ok ? "ok" : "bad"}">${label}</span>`;
    }).join(" → ") + (running ? ` <span class="round">…</span>` : "") + `</div>`;
  }

  if (aiOff) {
    html += `<div class="ok-box">🔕 <b>AI tắt</b> — chỉ hiển thị & lưu dữ liệu định lượng (giá, forward P/E, PEG, lăng kính). Không có phần writer/reviewer.</div>`;
  } else if (running) {
    html += `<div class="ok-box">🧠 Phần phân tích AI đang chạy: <b>${d.phase || ""}</b>. Bạn có thể đóng tab — kết quả vẫn lưu, mở lại xem ở "Lịch sử".</div>`;
  } else if (d.status === "error") {
    html += `<div class="warn-box">Lỗi khi chạy phân tích: ${escapeHtml(d.error || "")}</div>`;
  } else if (d.warning) {
    html += `<div class="warn-box">⚠️ <b>Sau ${d.iterations}/${d.max_refine} vòng refine, reviewer VẪN còn lỗi.</b> Báo cáo vẫn hiển thị nhưng hãy ĐỌC THẬN TRỌNG.</div>`;
  } else {
    html += `<div class="ok-box">✅ Reviewer hết lỗi sau ${d.iterations} vòng refine.</div>`;
  }

  if (w) {
    const wguards = (w.checks || []).map((c) => `<span class="gpill ${c.status}" title="${c.id}">${c.id.split("_")[0]}</span>`).join("");
    html += `<div class="writer-block card">
      <h4>✍️ Writer: ${w.writer || d.writerModel || "?"} <span class="badge ${w.verdict}">${w.verdict || "—"}</span> ${w.refined ? `<span class="hint">(đã refine ${w.iterations} vòng)</span>` : ""}</h4>
      <div class="guards-mini">${wguards}</div>
      <details ${running ? "" : "open"}><summary>Báo cáo định tính${running ? " (bản tạm — đang refine)" : " (bản cuối)"}</summary><div class="md">${md2html(w.report || "")}</div></details>
    </div>`;
  } else if (running) {
    html += `<div class="writer-block card"><h4>✍️ Writer ${d.writerModel || ""} đang viết…</h4></div>`;
  }
  // Meta-reviewer: danh sách findings ĐÃ GỘP (cái thực sự dùng để writer sửa)
  if (d.meta) {
    const cons = d.consolidated || [];
    html += `<div class="writer-block card">
      <h4>🧮 Meta-reviewer: ${d.meta.model} <span class="badge ${d.meta.decision === "revise" ? "revise" : "pass"}">${d.meta.decision === "revise" ? "CẦN SỬA" : "ĐẠT"}</span>
        <span class="hint">gộp ${d.meta.raw}→${d.meta.kept} findings (bỏ ${d.meta.dropped} trùng/vụn)</span></h4>
      ${d.meta.note ? `<div class="summary">${escapeHtml(d.meta.note)}</div>` : ""}
      ${cons.length ? `<ul class="findings">` + cons.map((f) => { const sev = (f.severity || "med").toLowerCase(); return `<li class="${sev}"><span class="sev">${sev}</span>${escapeHtml(f.issue)}${(f.from || []).length ? ` <span class="hint">(${escapeHtml((f.from || []).join(", "))})</span>` : ""}</li>`; }).join("") + `</ul>` : `<div class="hint">không còn lỗi đáng sửa sau khi gộp</div>`}
    </div>`;
  }
  if ((d.reviews || []).length) {
    html += `<h3 style="margin:16px 0 4px">🔎 Reviewers ${running ? "(vòng hiện tại)" : "— vòng cuối"} (${d.reviews.length}, song song)${d.meta ? " · findings thô trước khi gộp" : ""}</h3>`;
    html += `<div class="review-grid">` + d.reviews.map(rcard).join("") + `</div>`;
  }
  $("#run-results").innerHTML = html;
}

async function loadHistory() {
  try {
    const d = await fetch("/api/history").then((r) => r.json());
    const list = d.jobs || [];
    if (!list.length) {
      $("#history-list").innerHTML = ""; $("#history-sec").hidden = true; $("#compare-sec").hidden = true; return;
    }
    $("#history-sec").hidden = false;
    const rows = list.map((j) => {
      const st = j.status === "running" ? "⏳" : j.warning ? "⚠️" : j.status === "error" ? "✗" : "✅";
      const t = j.ts ? new Date(j.ts).toLocaleString("vi-VN") : "";
      return `<div class="hist-row" data-id="${j.id}"><span class="tk">${j.ticker}</span> <span>PEG ${fmt(j.forwardPEG)}</span> <span class="hint">${st} ${j.iterations || 0} vòng · ${t}</span><button class="hist-del" data-id="${j.id}" title="Xoá bản này">🗑</button></div>`;
    }).join("");
    $("#history-list").innerHTML = `<div class="hist-tools"><button id="btn-clear-hist" class="ghost danger">🗑 Xoá tất cả lịch sử</button></div>` + rows;
    document.querySelectorAll(".hist-row").forEach((el) => {
      el.onclick = (e) => { if (e.target.classList.contains("hist-del")) return; openJob(el.dataset.id); };
    });
    document.querySelectorAll(".hist-del").forEach((b) => { b.onclick = (e) => { e.stopPropagation(); deleteOne(b.dataset.id); }; });
    $("#btn-clear-hist").onclick = clearAllHistory;
    renderComparePicker(list);
  } catch { /* bỏ qua */ }
}

async function deleteOne(id) {
  if (!confirm("Xoá bản phân tích này?")) return;
  try {
    await fetch("/api/job/" + encodeURIComponent(id), { method: "DELETE" });
    if (localStorage.getItem(LS_CUR) === id) { localStorage.removeItem(LS_CUR); $("#run-results").innerHTML = ""; $("#run-status").textContent = ""; }
    loadHistory();
  } catch (e) { alert("Lỗi xoá: " + (e.message || e)); }
}

async function clearAllHistory() {
  if (!confirm("Xoá TẤT CẢ lịch sử phân tích? Không thể hoàn tác.")) return;
  try {
    await fetch("/api/history", { method: "DELETE" });
    localStorage.removeItem(LS_CUR); localStorage.removeItem(LS_WATCH);
    $("#run-results").innerHTML = ""; $("#run-status").textContent = ""; $("#compare-out").innerHTML = "";
    loadHistory();
  } catch (e) { alert("Lỗi: " + (e.message || e)); }
}

const LS_WATCH = "sp_watch";
function renderComparePicker(list) {
  // lấy job MỚI NHẤT mỗi ticker
  const latest = {};
  for (const j of list) { if (!latest[j.ticker]) latest[j.ticker] = j; }
  const tickers = Object.values(latest);
  if (!tickers.length) return;
  $("#compare-sec").hidden = false;
  const watch = new Set(JSON.parse(localStorage.getItem(LS_WATCH) || "[]"));
  $("#compare-pick").innerHTML = tickers.map((j) =>
    `<label class="cmp-chip"><input type="checkbox" value="${j.id}" data-tk="${j.ticker}" ${watch.has(j.ticker) ? "checked" : ""}/> ${j.ticker} <span class="hint">PEG ${fmt(j.forwardPEG)}</span></label>`).join("");
}

async function doCompare() {
  const checked = [...document.querySelectorAll("#compare-pick input:checked")];
  const ids = checked.map((i) => i.value).slice(0, 8);
  localStorage.setItem(LS_WATCH, JSON.stringify(checked.map((i) => i.dataset.tk)));
  if (ids.length < 2) { $("#compare-out").innerHTML = "<p class='hint'>Chọn ít nhất 2 mã để so sánh.</p>"; return; }
  $("#compare-out").innerHTML = "<p class='hint'>đang tải…</p>";
  try {
    const d = await fetch("/api/compare?ids=" + encodeURIComponent(ids.join(","))).then((r) => r.json());
    renderCompare(d.rows || []);
  } catch (e) { $("#compare-out").innerHTML = "<p class='hint'>Lỗi: " + (e.message || e) + "</p>"; }
}

function renderCompare(rows) {
  if (rows.length < 2) { $("#compare-out").innerHTML = "<p class='hint'>Không đủ dữ liệu.</p>"; return; }
  const lc = (r, id) => { const l = (r.lenses || {})[id]; return l ? { v: (l.value != null ? l.value + (l.unit || "") : "GAP"), cls: l.verdict } : { v: "—", cls: "" }; };
  const pegCell = (v) => v == null ? "—" : `<span class="${v < 1 ? "cheap" : "rich"}">${fmt(v)}</span>`;
  // best PEG (thấp nhất) tô đậm
  const minPeg = Math.min(...rows.filter((r) => r.forwardPEG != null).map((r) => r.forwardPEG));
  const metricRows = [
    ["Giá", (r) => "$" + r.price],
    ["forward P/E", (r) => fmt(r.forwardPE)],
    ["CAGR EPS", (r) => r.cagr_pct != null ? fmt(r.cagr_pct) + "%" : "—"],
    ["forward PEG", (r) => `${r.forwardPEG === minPeg ? "⭐ " : ""}${pegCell(r.forwardPEG)}`],
    ["vendor pegTTM", (r) => fmt(r.vendor_pegTTM)],
    ["🟢/🟠 FCF yield", (r) => { const c = lc(r, "fcf_yield"); return `<span class="lc ${c.cls}">${c.v}</span>`; }],
    ["CapEx / D&A", (r) => { const c = lc(r, "capex_dna"); return `<span class="lc ${c.cls}">${c.v}</span>`; }],
    ["EV / EBITDA", (r) => { const c = lc(r, "ev_ebitda"); return `<span class="lc ${c.cls}">${c.v}</span>`; }],
    ["Reverse-DCF (g ngầm)", (r) => { const c = lc(r, "reverse_dcf"); return `<span class="lc ${c.cls}">${c.v}</span>`; }],
    ["Rule of 40", (r) => { const c = lc(r, "rule40"); return `<span class="lc ${c.cls}">${c.v}</span>`; }],
    ["Đánh giá writer", (r) => r.writerVerdict ? `<span class="badge ${r.writerVerdict}">${r.writerVerdict}</span>` : "—"],
  ];
  let html = `<table class="cmp-table"><thead><tr><th>Chỉ số</th>${rows.map((r) => `<th>${r.ticker}<div class="hint">${r.company ? r.company.slice(0, 18) : ""}</div></th>`).join("")}</tr></thead><tbody>`;
  for (const [label, fn] of metricRows) {
    html += `<tr><td class="mlabel">${label}</td>${rows.map((r) => `<td class="num">${fn(r)}</td>`).join("")}</tr>`;
  }
  html += `</tbody></table><div class="hint">⭐ = forward PEG thấp nhất. Màu ô lăng kính: 🟢 tốt · 🟠 lưu ý · 🔴 xấu · ⚪ trung tính/GAP. FCF âm chưa chắc xấu — xem cặp FCF↔OCF & CapEx/D&A.</div>`;
  $("#compare-out").innerHTML = html;
}

async function openJob(id) {
  if (POLL) { clearInterval(POLL); POLL = null; }
  $("#run-results").innerHTML = "<p class='hint'>đang tải…</p>";
  try {
    const j = await fetch("/api/job/" + id).then((r) => r.json());
    if (j.error) throw new Error(j.error);
    localStorage.setItem(LS_CUR, id);
    renderJob(j);
    $("#runner").scrollIntoView({ behavior: "smooth", block: "start" });
    if (j.status === "running") startPolling(id);
  } catch (e) { $("#run-results").innerHTML = "<p class='hint'>Lỗi: " + (e.message || e) + "</p>"; }
}

function rcard(r) {
  if (r.error) return `<div class="rcard"><h4>${r.model}</h4><div class="err">✗ ${r.error}</div></div>`;
  const badge = r.status === "pass" ? `<span class="badge pass">PASS</span>` : r.status === "revise" ? `<span class="badge revise">CẦN SỬA</span>` : `<span class="badge PARTIAL">?</span>`;
  const findings = (r.findings || []).map((f) => {
    const sev = (f.severity || "med").toLowerCase();
    return `<li class="${sev}"><span class="sev">${sev}</span>${escapeHtml(f.issue)}${f.section ? ` <span class="hint">(${escapeHtml(f.section)})</span>` : ""}</li>`;
  }).join("");
  return `<div class="rcard">
    <h4>${r.model} ${badge}</h4>
    ${r.summary ? `<div class="summary">${escapeHtml(r.summary)}</div>` : ""}
    ${findings ? `<ul class="findings">${findings}</ul>` : `<div class="hint">không nêu lỗi cụ thể</div>`}
  </div>`;
}
function escapeHtml(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

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
$("#btn-compare").onclick = doCompare;
$("#ai-toggle").addEventListener("change", (e) => {
  const on = e.target.checked;
  $("#btn-toggle-models").style.display = on ? "" : "none";
  if (!on) $("#model-pick").hidden = true;
  $("#btn-run").textContent = on ? "② Chạy" : "② Lấy & lưu dữ liệu";
});
$("#btn-toggle-models").onclick = () => { const e = $("#model-pick"); e.hidden = !e.hidden; };
$("#new-ticker").addEventListener("keydown", (e) => { if (e.key === "Enter") loadHard(); });
$("#pick-good").onclick = (e) => { e.preventDefault(); document.querySelectorAll("#model-list input").forEach((i) => (i.checked = GOOD_RE.test(i.value))); updatePickCount(); };
$("#pick-none").onclick = (e) => { e.preventDefault(); document.querySelectorAll("#model-list input").forEach((i) => (i.checked = false)); updatePickCount(); };

loadOverview().catch((e) => { $("#meta").textContent = "Lỗi tải dữ liệu: " + e.message; });
loadModelChecklist();
loadHistory();
// Khôi phục job gần nhất khi mở lại trang (reload / mở lại tab)
const _cur = localStorage.getItem(LS_CUR);
if (_cur) openJob(_cur).catch(() => {});
