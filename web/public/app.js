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

loadOverview().catch((e) => { $("#meta").textContent = "Lỗi tải dữ liệu: " + e.message; });
