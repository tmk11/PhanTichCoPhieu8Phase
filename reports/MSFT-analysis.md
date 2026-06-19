# MSFT — Phân tích định giá theo Forward PEG (Microsoft Corporation)
*as_of: 2026-06-19 · giá tham chiếu: $379.4 (Finnhub MCP get_quote, 2026-06-18)*

> ⚠️ **Đây là tài liệu THAM KHẢO cho quyết định của riêng người đọc, KHÔNG phải lời khuyên đầu tư.**

## 1. Tóm tắt một dòng
Forward PEG (tính tay) ≈ **1.4159** ⇒ KHÔNG rẻ theo tăng trưởng. Cảnh báo lớn nhất: **khung 4 năm KHÔNG đủ dữ liệu consensus (GAP các năm xa)**.

## 2. Bảng định lượng (theo năm dự phóng)
| FY | EPS est | nguồn-tier | Forward P/E | YoY EPS |
|----|---------|-----------|-------------|---------|
| FY2026 | 15.93 | news | 23.82 | — |
| FY2027 | 18.61 | news | 20.39 | 16.82% |
| FY2028 | 21.74 | news | 17.45 | 16.82% |
| FY2029 | **GAP** | gap | — | — |

**Cách tính (tự kiểm chứng được):**
- Forward P/E[FY2026] = $379.4 ÷ 15.93 = **23.82**.
- Tăng trưởng EPS: CAGR FY2026→FY2028 = (21.74/15.93)^(1/2) − 1 = **16.82%** (năm xa nhất: tier news).
- **Forward PEG = 23.82 ÷ 16.82 = 1.4159** (chia cho số phần-trăm-nguyên, KHÔNG chia 0.xx; method=manual).
- Đối chiếu vendor pegTTM = 1.5835 (Finnhub) — **không dùng để tính**; chỉ chứng minh số tự tính KHÁC số dựng sẵn.

## 3. Caveat (đọc kỹ trước khi dùng số)
- 🟢 **FCF dương:** 25.7 tỷ USD (free_cash_flow_Q1FY2026; Microsoft Q1 FY2026 earnings (Futurum tổng hợp 8-K), 2025-10). FCF Q1 FY2026 +25.7 tỷ USD (+33% YoY) — DƯƠNG; con số quý, FCF cả năm cao hơn nhiều.
- ⚪ **GAAP vs non-GAAP:** EPS TTM/quá khứ là GAAP; forward consensus thường non-GAAP ⇒ forward P/E so với trailing là khập khiễng.
- ⚪ **Độ vênh giữa các nguồn forward EPS:**
  - FY2026: dùng 15.93 (news). Độ vênh: KeyCorp ~15.64 (https://www.marketbeat.com/instant-alerts/analysts-offer-predictions-for-microsoft-fy2026-earnings-2025-08-04). Khoảng FY2026 ~15.6–15.9.
  - FY2027: dùng 18.61 (news). Độ vênh: Simply Wall St ~19.4 (https://simplywall.st/stocks/us/software/nasdaq-msft/microsoft/future). Khoảng FY2027 ~18.6–19.4.
- ⚪ **GAP còn lại:**
  - Forward EPS FY2026–FY2028 chỉ có nguồn news (Alpha Vantage hết hạn mức ngày) với độ vênh ~2–4% giữa các nguồn => độ tin cậy thấp hơn NVDA/GOOGL (data_vendor).
  - Revenue estimate forward: GAP.
  - Forward EPS FY2029: GAP.

## 4. Growth-runway / TAM (bắt buộc)
**Động cơ tăng trưởng:**
- Azure & cloud là động cơ chính: Azure +40% (constant currency) trong Q1 FY2026; Microsoft Cloud tăng trưởng diện rộng, biên lợi nhuận mở rộng. *(Futurum – Microsoft Q1 FY2026, 2025-10)*

**Backlog / RPO:** Commercial RPO (remaining performance obligation) ~625 tỷ USD ở Q2 FY2026 (+110% YoY), thời hạn bình quân ~2.5 năm; ~25% ghi nhận trong 12 tháng tới. ~45% RPO đến từ OpenAI; phần còn lại +28% YoY (nhu cầu khách hàng diện rộng). *(Microsoft FY2026 Q2 earnings call, 2026-01)*

**TAM còn lại:** TAM phần mềm doanh nghiệp + đám mây + AI (Copilot, Azure AI, M365, security, gaming) rất lớn và còn dư địa; AI monetization là đòn bẩy biên lợi nhuận. *(Investing.com analysis, 2026-06)*

**Segment & tốc độ:**
- Intelligent Cloud (Azure), Productivity & Business Processes (M365, LinkedIn), More Personal Computing (Windows, gaming/Activision, search). *(Futurum – Microsoft Q1 FY2026, 2025-10)*

**Rủi ro chiến lược & optionality:**
- Capex AI khổng lồ => rủi ro nén FCF và ROIC nếu nhu cầu AI hạ nhiệt.
- Tập trung RPO vào OpenAI (~45%) => rủi ro đối tác đơn lẻ.
- Cạnh tranh đám mây (AWS, Google Cloud) và rủi ro pháp lý/chống độc quyền.
- Optionality: Copilot/AI monetization, security, gaming.

## 5. Khung tham khảo
Đây là tài liệu tham khảo cho quyết định của riêng tôi, **không phải lời khuyên đầu tư**. Mọi con số đều kèm nguồn hoặc được đánh dấu GAP; verifier tự tính lại từ input thô để chống "xuất xưởng" số không kiểm chứng.

## 6. Nguồn (kèm as_of_date)
- [Finnhub MCP get_quote — as_of 2026-06-18](https://finnhub.io/docs/api/quote)
- [Finnhub MCP get_basic_financials — as_of 2026-06-19](https://finnhub.io/docs/api/company-basic-financials)
- [Futurum – Microsoft Q1 FY2026 — as_of 2025-10](https://futurumgroup.com/insights/microsoft-q1-fy-2026-cloud-and-ai-fuel-broad-based-growth/)
- [Investing.com analysis — as_of 2026-06](https://www.investing.com/analysis/microsoft-valuation-looks-disconnected-from-growth-margins-and-cash-flow-200677270)
- [Microsoft FY2026 Q2 earnings call — as_of 2026-01](https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q2)

---
*Sinh tự động bởi pipeline 8-phase (derive→build→verify). Recompute & guards: xem artifacts/verifier-report-MSFT.json.*
