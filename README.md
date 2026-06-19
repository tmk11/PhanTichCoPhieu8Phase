# Pipeline Phân Tích Cổ Phiếu — 8 Phase, Có Cổng Chặn & Tự Kiểm Chứng

> Triết lý: **không số nào được "xuất xưởng" nếu không có nguồn, và verifier phải TỰ TÍNH LẠI từ input gốc — không bao giờ đọc con số đã khai sẵn.**
>
> ⚠️ Đây là tài liệu tham khảo cho quyết định cá nhân, **KHÔNG phải lời khuyên đầu tư.**

## Đang theo dõi
`NVDA`, `MSFT`, `GOOGL` — khung dự phóng 4 năm forward (FY+1..FY+4, đánh dấu `GAP` ở những năm consensus không phủ).

## Chạy
```bash
node scripts/orchestrate.mjs NVDA MSFT GOOGL
```
8 phase tự chạy với phase-gating + loop tự sửa + màn G1 demo. Kết quả: `artifacts/run-summary.json` (verdict GREEN/PARTIAL/RED).

Chạy lẻ từng khâu:
```bash
node scripts/derive.mjs NVDA      # rule engine -> spec + derivation-log
node scripts/build.mjs  NVDA      # ráp report
node scripts/verify.mjs NVDA      # verifier tự tính lại + guards (exit 0/1)
```

## Cấu trúc
```
data/<T>-canonical.json     # dữ liệu thô có provenance {value,source,url,as_of_date,field,tier} — single source of truth
scripts/lib.mjs             # provenance check + computeDerived() (tính lại từ input thô)
scripts/derive.mjs          # Phase 3 DERIVE — forward P/E, CAGR, forward PEG (thuần công thức)
scripts/build.mjs           # Phase 4 BUILD — ráp reports/<T>-analysis.md
scripts/verify.mjs          # Phase 5 VERIFY — recompute + G1..G8, exit code
scripts/orchestrate.mjs     # nhạc trưởng 8-phase: gating, loop, G1 demo, run-summary
done.rubric.json            # bảng tiêu chí "thế nào là xong" (nguồn chân lý duy nhất)
reports/<T>-analysis.md     # output cho người đọc
artifacts/                  # spec, derivation-log, verifier-report, run-log, run-summary, các bản *.failed.json
```

## 8 Phase & Cổng chặn
1. **RESEARCH** → Gate1: canonical tồn tại; mọi node có provenance hoặc `GAP` tường minh.
2. **INGEST** → Gate2: 100% node hợp lệ schema 5 trường.
3. **DERIVE** → Gate3: mọi chỉ số phái sinh truy ngược được về node canonical có nguồn.
4. **BUILD** → Gate4: report đủ mục bắt buộc.
5. **VERIFY** → Gate5: mọi guard nghiêm trọng pass + recompute khớp.
6. **LOOP** → Gate6: verify cuối xanh + màn G1 refuse đúng + khôi phục xanh + ≥1 bản FAIL được lưu.
7. **RECORD** → Gate7 (mềm): có run-log tái lập.
8. **SHIP** → chấm rubric, in verdict.

## Guards (verify.mjs)
| Guard | critical | Ý nghĩa |
|-------|----------|---------|
| G1 PEG tính tay | ✓ | PEG ≠ trường `pegTTM` dựng sẵn của vendor; method=`manual`. |
| G2 Bẫy chu kỳ | ✓ | Ticker cyclical phải kèm cảnh báo "P/E thấp ở đỉnh chu kỳ = bẫy". |
| G3 Loss-to-profit | ✓ | EPS nền ≤0.5 (đáy chu kỳ) làm growth méo phải được đánh dấu. |
| G4 Cite-or-gap | ✓ | Input nuôi chỉ số tiêu đề thiếu provenance ⇒ FAIL. |
| G7 Recompute khớp | ✓ | Verifier tự tính lại lệch số report quá ngưỡng ⇒ FAIL. |
| G5 TAM section | – | Phần growth-runway/TAM phải đủ động cơ, backlog/RPO, segment, rủi ro. |
| G6 FCF caveat | – | FCF âm thiếu caveat ⇒ FAIL (FCF dương ⇒ pass). |
| G8 Not-advice | – | Có khung "tham khảo, không phải lời khuyên". |

## Màn G1 demo (bằng chứng tự bảo vệ)
Mỗi lần chạy, orchestrator cố tình thay forward PEG bằng trường `pegTTM` dựng sẵn của Finnhub →
verifier **PHẢI từ chối** (G1 + G7 đỏ, exit 1) → khôi phục bản tính tay → verify xanh lại.
Bản FAIL được giữ tại `artifacts/verifier-report-<T>.g1corrupt.failed.json`.

## Phương pháp tính (xác định)
- `forward P/E[năm N] = giá_hiện_tại ÷ EPS_estimate[N]`
- `CAGR = (EPS_cuối / EPS_đầu)^(1/số_năm) − 1`
- `forward PEG = forward_P/E[FY1] ÷ (CAGR × 100)` — chia cho **số phần trăm nguyên** (vd 33.4), KHÔNG chia 0.334.
- Sàng tăng trưởng dựa trên **forward EPS/revenue estimate**, KHÔNG dùng beta.

## Nguồn dữ liệu
Finnhub MCP (giá, EPS TTM/quá khứ, pegTTM vendor để đối chứng), Alpha Vantage `EARNINGS_ESTIMATES`
(forward EPS/revenue consensus + analyst count), web_search (FY xa, FCF, backlog/RPO, segment),
filings/IR (NVIDIA/Microsoft/Alphabet 8-K). Mỗi datum ghi `as_of_date` và phân tier
`filing > data_vendor > news > gap`.

## Hạn chế đã biết (minh bạch)
- Khung 4 năm thường không được consensus phủ đủ ⇒ nhiều `GAP` ở FY xa (đúng tinh thần cite-or-gap, không bịa).
- Forward EPS consensus thường non-GAAP còn EPS TTM là GAAP ⇒ forward P/E so trailing là khập khiễng (đã caveat).
- Reviewer context-mới (Phase 5c bằng `claude` CLI) là cổng MỀM, chưa bật trong bản này.
