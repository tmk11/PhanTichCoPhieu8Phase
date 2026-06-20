# ORCL — Phân tích định giá theo Forward PEG (Oracle Corporation)
*as_of: 2026-06-19 · giá tham chiếu: $184.29 (Finnhub MCP get_quote, 2026-06-18)*

> ⚠️ **Đây là tài liệu THAM KHẢO, KHÔNG phải lời khuyên đầu tư.**

## 1. Tóm tắt một dòng
Forward PEG (tính tay) ≈ **0.6465** ⇒ tương đối RẺ so với tăng trưởng. Cảnh báo lớn nhất: **khung dự phóng KHÔNG đủ dữ liệu consensus (GAP các năm xa)**.

## 2. Bảng định lượng (theo năm dự phóng)
| FY | EPS est | nguồn-tier | Forward P/E | YoY EPS |
|----|---------|-----------|-------------|---------|
| FY2027 | 8.0321 | data_vendor | 22.94 | — |
| FY2028 | 10.8829 | data_vendor | 16.93 | 35.49% |
| FY2029 | **GAP** | gap | — | — |
| FY2030 | **GAP** | gap | — | — |

**Cách tính (tự kiểm chứng được):**
- Forward P/E[FY2027] = $184.29 ÷ 8.0321 = **22.94**.
- Tăng trưởng EPS: CAGR FY2027→FY2028 = (10.8829/8.0321)^(1/1) − 1 = **35.49%** (năm xa nhất: tier data_vendor).
- **Forward PEG = 22.94 ÷ 35.49 = 0.6465** (chia cho số phần-trăm-nguyên; method=manual).
- Đối chiếu vendor pegTTM = 1.83719 (Finnhub) — **không dùng để tính**; chỉ chứng minh số tự tính KHÁC số dựng sẵn.

## 3. Caveat (đọc kỹ trước khi dùng số)
- 🔴 **FCF ÂM:** -23.7 tỷ USD (Oracle FY2026 Q4 results (CNBC tổng hợp 8-K), 2026-05-31) — thận trọng khi dòng tiền tự do âm. FCF FY2026 ÂM ~ −23.7 tỷ USD do capex 55.7 tỷ (+162%). Operating cash flow +32 tỷ (+54%) — kinh doanh lõi mạnh nhưng FCF âm vì đầu tư hạ tầng AI.
- ⚪ **GAAP vs non-GAAP:** EPS TTM/quá khứ GAAP; forward thường non-GAAP ⇒ forward P/E so trailing khập khiễng.
- ⚪ **GAP còn lại:**
  - Forward EPS chỉ tới FY2028 (2 năm data_vendor); FY2029–FY2030 GAP => khung 4 năm KHÔNG được lấp đủ.
  - Tăng trưởng EPS dùng cho PEG chỉ dựa trên 1 nhịp YoY FY2027→FY2028 (biến động cao).

## 4. Growth-runway / TAM (bắt buộc)
**Động cơ tăng trưởng:**
- Oracle Cloud Infrastructure (OCI) + Cloud Applications là động cơ chính; Q4 & FY2026 đạt kết quả kỷ lục nhờ hợp đồng AI quy mô lớn. *(Oracle IR – Record Q4 & FY2026, 2026-06-10)*

**Backlog / RPO:** RPO (remaining performance obligation) đạt ~638 tỷ USD cuối Q4 FY2026 (+363% YoY, +85 tỷ so với Q3); phần lớn từ hợp đồng AI quy mô lớn. BofA: >50% RPO đến từ OpenAI. *(Oracle FY2026 results / DCD / BofA)*

**TAM còn lại:** TAM hạ tầng đám mây + AI training/inference rất lớn; chiến lược multicloud (OCI chạy trong Azure/Google/AWS) + database (Oracle 23ai) mở rộng phân phối. *(Oracle IR Q3 FY2026)*

**Segment & tốc độ:**
- Cloud Services & License Support (OCI + SaaS Fusion/NetSuite) – mảng lớn nhất, tăng tốc; Cloud License & On-Premise; Hardware; Services. *(Oracle IR)*

**Rủi ro chiến lược & optionality:**
- FCF ÂM (−23.7 tỷ FY2026) do capex 55.7 tỷ — rủi ro tài trợ/ROIC nếu nhu cầu AI hạ nhiệt hoặc khách hàng chậm thanh toán.
- Tập trung khách hàng cực cao: >50% RPO từ OpenAI => rủi ro đối tác đơn lẻ/khả năng thanh toán.
- Đòn bẩy nợ cao (totalDebt/equity ~2.3–2.5) cộng capex lớn => rủi ro lãi suất/dòng tiền.
- Optionality: nếu OCI/multicloud + database AI giữ đà, RPO 638 tỷ chuyển hóa doanh thu nhiều năm.

**Forward revenue:** FY2027 ≈ 89 tỷ USD (data_vendor); FY2028 ≈ 129.7 tỷ USD (data_vendor).

## 5. Khung tham khảo
Đây là tài liệu tham khảo cho quyết định của riêng tôi, **không phải lời khuyên đầu tư**. Mọi số có nguồn hoặc đánh dấu GAP/model; verifier tự tính lại từ input thô.

## 6. Nguồn (kèm as_of_date)
- [Finnhub MCP get_quote — as_of 2026-06-18](https://finnhub.io/docs/api/quote)
- [Finnhub MCP get_basic_financials — as_of 2026-06-19](https://finnhub.io/docs/api/company-basic-financials)
- [Oracle FY2026 results — as_of 2026-05-31](https://www.cnbc.com/2026/06/10/oracle-orcl-q4-earnings-report-2026.html)
- [Alpha Vantage EARNINGS_ESTIMATES — as_of 2026-06-19](https://www.alphavantage.co/documentation/#earnings-estimates)
- [Oracle IR — as_of 2026-06-10](https://investor.oracle.com/investor-news/news-details/2026/Oracle-Announces-Record-Q4-and-FY-2026-Results-Driven-by-Cloud-Infrastructure--Cloud-Applications/default.aspx)
- [Oracle FY2026 results / DCD / BofA — as_of 2026-05-31](https://www.datacenterdynamics.com/en/news/oracle-has-455bn-in-remaining-performance-obligations-at-end-of-q1-2026/)
- [Oracle IR Q3 FY2026 — as_of 2026-03-10](https://www.oracle.com/news/announcement/q3fy26-earnings-release-2026-03-10/)

---
*Sinh tự động bởi pipeline 8-phase (derive→build→verify).*
