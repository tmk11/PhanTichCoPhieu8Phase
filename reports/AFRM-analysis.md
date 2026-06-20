# AFRM — Phân tích định giá theo Forward PEG (Affirm Holdings, Inc.)
*as_of: 2026-06-19 · giá tham chiếu: $73.92 (Finnhub MCP get_quote, 2026-06-18)*

> ⚠️ **Đây là tài liệu THAM KHẢO, KHÔNG phải lời khuyên đầu tư.**

## 1. Tóm tắt một dòng
Forward PEG (tính tay) ≈ **1.0964** ⇒ KHÔNG rẻ theo tăng trưởng. Cảnh báo lớn nhất: **khung dự phóng KHÔNG đủ dữ liệu consensus (GAP các năm xa)**.

## 2. Bảng định lượng (theo năm dự phóng)
| FY | EPS est | nguồn-tier | Forward P/E | YoY EPS |
|----|---------|-----------|-------------|---------|
| FY2026 | 3.1027 | data_vendor | 23.82 | — |
| FY2027 | 3.7769 | data_vendor | 19.57 | 21.73% |
| FY2028 | **GAP** | gap | — | — |
| FY2029 | **GAP** | gap | — | — |

**Cách tính (tự kiểm chứng được):**
- Forward P/E[FY2026] = $73.92 ÷ 3.1027 = **23.82**.
- Tăng trưởng EPS: CAGR FY2026→FY2027 = (3.7769/3.1027)^(1/1) − 1 = **21.73%** (năm xa nhất: tier data_vendor).
- **Forward PEG = 23.82 ÷ 21.73 = 1.0964** (chia cho số phần-trăm-nguyên; method=manual).
- Đối chiếu vendor pegTTM = 34.36739 (Finnhub) — **không dùng để tính**; chỉ chứng minh số tự tính KHÁC số dựng sẵn.

## 3. Caveat (đọc kỹ trước khi dùng số)
- 🟠 **Nền lỗ / lãi-gần-0 (loss-to-profit / low-base):** min(EPS quá khứ)=-3.3363 <= 0.5 => CAGR/growth lịch sử bị thổi phồng; PEG trailing & growth quá khứ méo. Tăng trưởng quá khứ **bị thổi phồng**, không nên dùng làm PEG tiêu đề.
- ⚪ **FCF (chưa chốt nguồn tuyệt đối):** FCF tuyệt đối chưa có nguồn sạch; Finnhub fcfMargin FY2025 = +18.7% (DƯƠNG) nhưng FCF của một công ty cho vay BNPL bị nhiễu mạnh bởi tài trợ khoản vay/chứng khoán hóa nên không dùng làm chỉ số định giá trực tiếp. (Finnhub MCP get_basic_financials (fcfMargin)).
- ⚪ **GAAP vs non-GAAP:** EPS TTM/quá khứ GAAP; forward thường non-GAAP ⇒ forward P/E so trailing khập khiễng.
- ⚪ **Độ vênh giữa các nguồn forward EPS:**
  - FY2026: dùng 3.1027 (data_vendor). ĐỘ VÊNH NGHIÊM TRỌNG (~3x): EPS GAAP TTM (Finnhub) = 1.07 và Zacks consensus FY2026 GAAP ~1.08, trong khi Alpha Vantage FY2026 = 3.10 (chỉ 8 analyst trên số FY). Nhiều khả năng khác cơ sở GAAP vs non-GAAP. => forward P/E & PEG đổi rất mạnh theo cơ sở chọn.
  - FY2027: dùng 3.7769 (data_vendor). Cùng cơ sở với FY2026 của Alpha Vantage (để CAGR nhất quán); vẫn dính cảnh báo độ vênh GAAP.
- ⚪ **GAP còn lại:**
  - ĐỘ VÊNH forward EPS ~3x (Alpha Vantage 3.10 vs GAAP/Zacks ~1.08) => forward P/E & PEG KHÔNG đáng tin; chỉ nên đọc định tính.
  - Forward EPS chỉ tới FY2027 (2 năm); FY2028–FY2029 GAP => khung 4 năm KHÔNG đủ.
  - FCF tuyệt đối: GAP (mô hình cho vay làm FCF nhiễu).
  - Số FY estimate chỉ dựa trên ~8 analyst => coverage mỏng.

## 4. Growth-runway / TAM (bắt buộc)
**Động cơ tăng trưởng:**
- GMV Q1 FY2026 ~10.4 tỷ USD (+42% YoY); doanh thu ~933 triệu (+33%); biên lợi nhuận cải thiện, vừa chuyển sang có lãi GAAP. *(Affirm Q1 FY2026 (Yahoo Finance), 2025-09-30)*

**Backlog / RPO:** Không phải mô hình backlog/RPO như SaaS. Động lực phân phối: hợp tác Amazon, Shopify, Apple Pay/Walmart; thẻ Affirm Card mở rộng tần suất sử dụng; sản phẩm 0% APR do merchant tài trợ. *(Simply Wall St – Affirm)*

**TAM còn lại:** TAM tài trợ điểm-bán (POS)/BNPL toàn cầu lớn và đang số hóa; Affirm Card đưa BNPL vào chi tiêu hằng ngày. Tăng trưởng doanh thu dự phóng ~18.5%/năm, EPS ~32%/năm (Simply Wall St). *(Simply Wall St – Affirm forecast)*

**Segment & tốc độ:**
- Doanh thu từ network/merchant fees + interest income (lãi khoản vay) + servicing; phụ thuộc chi phí vốn & chất lượng tín dụng. *(Simply Wall St – Affirm)*

**Rủi ro chiến lược & optionality:**
- RỦI RO TÍN DỤNG/CHU KỲ TIÊU DÙNG: tổn thất nợ (charge-offs) tăng mạnh khi suy thoái — lợi nhuận mới-chớm-dương có thể đảo ngược nhanh.
- Chi phí vốn/lãi suất: biên lợi nhuận nhạy với lãi suất và khả năng tiếp cận thị trường chứng khoán hóa.
- Quy định: khung pháp lý BNPL (CFPB) siết lại có thể tăng chi phí tuân thủ.
- Cạnh tranh gay gắt (Klarna, PayPal, Apple, Afterpay/Block); beta ~3.76 => biến động giá cực lớn.
- Optionality: Affirm Card + hợp tác lớn (Amazon/Apple) nếu giữ chất lượng tín dụng.

**Forward revenue:** FY2026 ≈ 4.2 tỷ USD (data_vendor); FY2027 ≈ 5.3 tỷ USD (data_vendor).

## 5. Khung tham khảo
Đây là tài liệu tham khảo cho quyết định của riêng tôi, **không phải lời khuyên đầu tư**. Mọi số có nguồn hoặc đánh dấu GAP/model; verifier tự tính lại từ input thô.

## 6. Nguồn (kèm as_of_date)
- [Finnhub MCP get_quote — as_of 2026-06-18](https://finnhub.io/docs/api/quote)
- [Finnhub MCP get_basic_financials — as_of 2026-06-19](https://finnhub.io/docs/api/company-basic-financials)
- [Alpha Vantage EARNINGS_ESTIMATES — as_of 2026-06-19](https://www.alphavantage.co/documentation/#earnings-estimates)
- [Affirm Q1 FY2026 (Yahoo Finance) — as_of 2025-09-30](https://finance.yahoo.com/news/buy-hold-sell-affirm-stock-161600432.html)
- [Simply Wall St – Affirm forecast — as_of 2026-06](https://simplywall.st/stocks/us/diversified-financials/nasdaq-afrm/affirm-holdings/future)
- [Simply Wall St – Affirm — as_of 2026-06](https://simplywall.st/stocks/us/diversified-financials/nasdaq-afrm/affirm-holdings)

---
*Sinh tự động bởi pipeline 8-phase (derive→build→verify).*
