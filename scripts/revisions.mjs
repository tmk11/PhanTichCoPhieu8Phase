// revisions.mjs — Lịch sử revision forward EPS (thuần công thức, không I/O).
// Server ghi mỗi lần consensus TradingView ĐỔI vào tvcache/<T>-history.jsonl;
// các hàm ở đây so sánh & tính % thay đổi để hiển thị "estimate revision momentum".

// Hai bộ forward EPS {fy: eps} giống hệt nhau?
export function sameByYear(a = {}, b = {}) {
  const ka = Object.keys(a || {}), kb = Object.keys(b || {});
  if (ka.length !== kb.length) return false;
  return ka.every((k) => (b || {})[k] === (a || {})[k]);
}

// So sánh entry MỚI NHẤT với entry NGAY TRƯỚC. history = [{ts, price, byYear}, ...] (cũ -> mới).
// Trả {since, changes:[{fy, from, to, pct}]} hoặc null nếu chưa có gì để so / không đổi.
export function diffLatest(history) {
  if (!Array.isArray(history) || history.length < 2) return null;
  const cur = history[history.length - 1], prev = history[history.length - 2];
  const changes = [];
  for (const [fy, v] of Object.entries(cur.byYear || {})) {
    const old = (prev.byYear || {})[fy];
    if (typeof old === "number" && typeof v === "number" && old !== v) {
      changes.push({ fy, from: old, to: v, pct: old !== 0 ? Math.round((v / old - 1) * 1000) / 10 : null });
    }
  }
  changes.sort((a, b) => String(a.fy).localeCompare(String(b.fy)));
  return changes.length ? { since: prev.ts, changes } : null;
}

// Thêm entry mới vào history NẾU byYear đổi so với entry cuối (giữ tối đa `limit` entry).
// Trả {history, appended}. KHÔNG ghi file — caller tự persist.
export function appendIfChanged(history, entry, limit = 200) {
  const h = Array.isArray(history) ? history.slice() : [];
  const last = h[h.length - 1];
  if (last && sameByYear(last.byYear, entry.byYear)) return { history: h, appended: false };
  h.push(entry);
  return { history: h.slice(-limit), appended: true };
}
