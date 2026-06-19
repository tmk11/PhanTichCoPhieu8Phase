# GOOGL — Phân tích định giá theo Forward PEG (Alphabet Inc. (Class A))
*as_of: 2026-06-19 · giá tham chiếu: $368.03 (Finnhub MCP get_quote, 2026-06-18)*

> ⚠️ **Đây là tài liệu THAM KHẢO cho quyết định của riêng người đọc, KHÔNG phải lời khuyên đầu tư.**

## 1. Tóm tắt một dòng
Forward PEG (tính tay) ≈ **15.463** ⇒ KHÔNG rẻ theo tăng trưởng. Cảnh báo lớn nhất: **tăng trưởng EPS đồng thuận gần hạn ~đi ngang ⇒ PEG ngắn hạn bị méo, không đáng tin**.

## 2. Bảng định lượng (theo năm dự phóng)
| FY | EPS est | nguồn-tier | Forward P/E | YoY EPS |
|----|---------|-----------|-------------|---------|
| FY2026 | 14.2204 | data_vendor | 25.88 | — |
| FY2027 | 14.4584 | data_vendor | 25.45 | 1.67% |

**Cách tính (tự kiểm chứng được):**
- Forward P/E[FY2026] = $368.03 ÷ 14.2204 = **25.88**.
- Tăng trưởng EPS: CAGR FY2026→FY2027 = (14.4584/14.2204)^(1/1) − 1 = **1.67%** (năm xa nhất: tier data_vendor).
- **Forward PEG = 25.88 ÷ 1.67 = 15.463** (chia cho số phần-trăm-nguyên, KHÔNG chia 0.xx; method=manual).
- Biến thể chỉ-dùng-data_vendor (loại nguồn news): CAGR FY2026→FY2027 = 1.67% ⇒ PEG = 15.463.
- Đối chiếu vendor pegTTM = 1.71989 (Finnhub) — **không dùng để tính**; chỉ chứng minh số tự tính KHÁC số dựng sẵn.

## 3. Caveat (đọc kỹ trước khi dùng số)
- 🟠 **PEG ngắn hạn không đáng tin:** CAGR forward cửa sổ chính chỉ 1.67% (gần 0) ⇒ phép chia PEG phóng đại; cần consensus dài hạn hơn (đang GAP) để PEG có nghĩa.
- 🟢 **FCF dương:** 73.3 tỷ USD (free_cash_flow_FY2025; Alphabet FY2025 results (qua TIKR/heygotrade tổng hợp 8-K), 2025-12-31). FCF FY2025 ~ +73.3 tỷ USD (DƯƠNG). CẢNH BÁO: FCF 2026 dự kiến nén mạnh xuống ~20.5 tỷ do capex AI ~185 tỷ => caveat optionality/ROIC.
- ⚪ **GAAP vs non-GAAP:** EPS TTM/quá khứ là GAAP; forward consensus thường non-GAAP ⇒ forward P/E so với trailing là khập khiễng.
- ⚪ **GAP còn lại:**
  - Forward EPS chỉ tới FY2027 (2 năm data_vendor); FY2028–FY2029 không có consensus đáng tin => GAP (khung 4 năm KHÔNG được lấp đủ).
  - Consensus FY2026->FY2027 đi ngang bất thường (+1.7%) => forward PEG ngắn hạn không đáng tin (caveat G3-styleméo tăng trưởng do capex).

## 4. Growth-runway / TAM (bắt buộc)
**Động cơ tăng trưởng:**
- Google Cloud bứt tốc: doanh thu Q1 2026 ~20 tỷ USD (+63% YoY); biên lợi nhuận hoạt động Cloud nhảy từ 17.8% lên 32.9% trong một năm; Cloud operating income Q1 2026 gấp 3 lần YoY (~6.6 tỷ). *(TIKR / Alphabet Q1 2026 8-K, 2026-03-31)*

**Backlog / RPO:** Backlog Google Cloud ~462 tỷ USD cuối Q1 2026 (từ ~240 tỷ cuối Q4 2025); >50% dự kiến chuyển thành doanh thu trong 24 tháng (>230 tỷ ghi nhận tới giữa 2028). *(TIKR – Google Cloud backlog, 2026-03-31)*

**TAM còn lại:** TAM: Search/quảng cáo số, YouTube, Cloud/AI (Gemini), Waymo (AV optionality). AI vừa là cơ hội (Gemini, Cloud AI) vừa là rủi ro đối với Search truyền thống. *(heygotrade – Alphabet Q1 2026, 2026-04)*

**Segment & tốc độ:**
- Google Services (Search, YouTube, ads) – operating income FY2025 ~139.4 tỷ USD; Google Cloud – operating income FY2025 ~13.9 tỷ; Other Bets (Waymo...). *(Alphabet FY2025 8-K, 2025-12-31)*

**Rủi ro chiến lược & optionality:**
- Capex AI rất lớn (~185 tỷ 2026) nén FCF gần hạn (FCF 2026 dự kiến ~20.5 tỷ) => rủi ro ROIC.
- Disruption của AI/chatbot đối với Search quảng cáo cốt lõi.
- Rủi ro pháp lý/chống độc quyền (DOJ) có thể buộc thoái vốn mảng.
- Optionality: Gemini, Cloud margin expansion, Waymo.

**Forward revenue (consensus):** FY2026 ≈ 487.7 tỷ USD (52 analysts); FY2027 ≈ 578.9 tỷ USD (53 analysts).

## 5. Khung tham khảo
Đây là tài liệu tham khảo cho quyết định của riêng tôi, **không phải lời khuyên đầu tư**. Mọi con số đều kèm nguồn hoặc được đánh dấu GAP; verifier tự tính lại từ input thô để chống "xuất xưởng" số không kiểm chứng.

## 6. Nguồn (kèm as_of_date)
- [Finnhub MCP get_quote — as_of 2026-06-18](https://finnhub.io/docs/api/quote)
- [Finnhub MCP get_basic_financials — as_of 2026-06-19](https://finnhub.io/docs/api/company-basic-financials)
- [TIKR / Alphabet Q1 2026 8-K — as_of 2026-03-31](https://www.sec.gov/Archives/edgar/data/0001652044/000165204426000043/googexhibit991q12026.htm)
- [Alpha Vantage EARNINGS_ESTIMATES — as_of 2026-06-19](https://www.alphavantage.co/documentation/#earnings-estimates)
- [Alphabet FY2025 8-K — as_of 2025-12-31](https://www.sec.gov/Archives/edgar/data/0001652044/000165204425000087/googexhibit991q32025.htm)
- [TIKR – Google Cloud backlog — as_of 2026-03-31](https://www.tikr.com/blog/google-cloud-just-crossed-462-billion-in-backlog-heres-what-it-means-for-googl)
- [heygotrade – Alphabet Q1 2026 — as_of 2026-04](https://www.heygotrade.com/en/blog/alphabet-q1-2026-earnings-reaction/)

---
*Sinh tự động bởi pipeline 8-phase (derive→build→verify). Recompute & guards: xem artifacts/verifier-report-GOOGL.json.*
