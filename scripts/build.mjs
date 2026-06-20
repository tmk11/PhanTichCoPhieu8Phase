// build.mjs — Phase 4 BUILD. Ráp reports/<TICKER>-analysis.md từ spec + canonical.
// Logic render nằm ở engine.renderReport (dùng chung với chạy on-demand).
import path from "node:path";
import fs from "node:fs";
import { ROOT, loadCanonical, loadJSON } from "./lib.mjs";
import { renderReport } from "./engine.mjs";

export function build(ticker) {
  const c = loadCanonical(ticker);
  const d = loadJSON(path.join(ROOT, "artifacts", `spec-${ticker}.json`));
  const md = renderReport(c, d);
  const out = path.join(ROOT, "reports", `${ticker}-analysis.md`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, md);
  return out;
}

if (process.argv[1] && process.argv[1].endsWith("build.mjs")) {
  const t = process.argv[2];
  if (!t) { console.error("usage: node build.mjs <TICKER>"); process.exit(2); }
  console.log(`[build] wrote ${build(t)}`);
}
