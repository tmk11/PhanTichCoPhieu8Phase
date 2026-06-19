# NVDA — Phân tích định giá theo Forward PEG (NVIDIA Corporation)
*as_of: 2026-06-19 · giá tham chiếu: $210.69 (Finnhub MCP get_quote, 2026-06-18)*

> ⚠️ **Đây là tài liệu THAM KHẢO cho quyết định của riêng người đọc, KHÔNG phải lời khuyên đầu tư.**

## 1. Tóm tắt một dòng
Forward PEG (tính tay) ≈ **0.7027** ⇒ tương đối RẺ so với tăng trưởng. Cảnh báo lớn nhất: **đây là cổ phiếu CHU KỲ — P/E thấp ở đỉnh chu kỳ có thể là BẪY**.

## 2. Bảng định lượng (theo năm dự phóng)
| FY | EPS est | nguồn-tier | Forward P/E | YoY EPS |
|----|---------|-----------|-------------|---------|
| FY2027 | 8.9601 | data_vendor | 23.51 | — |
| FY2028 | 12.7272 | data_vendor | 16.55 | 42.04% |
| FY2029 | 15.96 | news | 13.2 | 25.4% |
| FY2030 | **GAP** | gap | — | — |

**Cách tính (tự kiểm chứng được):**
- Forward P/E[FY2027] = $210.69 ÷ 8.9601 = **23.51**.
- Tăng trưởng EPS: CAGR FY2027→FY2029 = (15.96/8.9601)^(1/2) − 1 = **33.46%** (năm xa nhất: tier news).
- **Forward PEG = 23.51 ÷ 33.46 = 0.7027** (chia cho số phần-trăm-nguyên, KHÔNG chia 0.xx; method=manual).
- Biến thể chỉ-dùng-data_vendor (loại nguồn news): CAGR FY2027→FY2028 = 42.04% ⇒ PEG = 0.5593.
- Đối chiếu vendor pegTTM = 0.62493 (Finnhub) — **không dùng để tính**; chỉ chứng minh số tự tính KHÁC số dựng sẵn.

## 3. Caveat (đọc kỹ trước khi dùng số)
- 🔴 **CHU KỲ (cyclical):** Ngành bán dẫn lịch sử có tính chu kỳ mạnh; doanh thu hiện phụ thuộc lớn vào chu kỳ capex AI/data center. P/E thấp khi lợi nhuận ở đỉnh chu kỳ có thể là bẫy. **P/E thấp ở ĐỈNH chu kỳ lợi nhuận thường là BẪY** — đừng diễn giải forward P/E thấp = rẻ một cách máy móc.
- 🟠 **Nền lỗ / lãi-gần-0 (loss-to-profit / low-base):** min(EPS quá khứ)=0.1742 <= 0.5 => CAGR/growth lịch sử bị thổi phồng; PEG trailing & growth quá khứ méo. Các con số tăng trưởng quá khứ (vd epsGrowth3Y/5Y, pegTTM vendor) **bị thổi phồng** và không nên dùng làm PEG tiêu đề.
- 🟢 **FCF dương:** 96.6 tỷ USD (free_cash_flow_FY2026; NVIDIA Newsroom – Financial Results for Q4 & Fiscal 2026, 2026-01-25). FCF FY2026 ~ +96.58 tỷ USD (DƯƠNG mạnh).
- ⚪ **GAAP vs non-GAAP:** EPS TTM/quá khứ là GAAP; forward consensus thường non-GAAP ⇒ forward P/E so với trailing là khập khiễng.
- ⚪ **Độ vênh giữa các nguồn forward EPS:**
  - FY2029: dùng 15.96 (news). Độ vênh: 24/7 Wall St mô hình FY2029 ~12.85 (https://247wallst.com/investing/2026/03/07/can-nvidia-shares-hit-500-by-2030/). Khoảng FY2029 ~12.85–15.96.
- ⚪ **GAP còn lại:**
  - Forward EPS FY2030 (>4 năm) không có consensus đáng tin => GAP.
  - FY2029 chỉ có nguồn news (Simply Wall St) với độ vênh lớn so với 24/7 Wall St => độ tin cậy thấp hơn FY2027/FY2028 (data_vendor).

## 4. Growth-runway / TAM (bắt buộc)
**Động cơ tăng trưởng:**
- Data center là động cơ chính: Q4 FY2026 data center ~62.3 tỷ USD (+75% YoY); networking ~11 tỷ/quý (>3.5x YoY). *(Futurum / NVIDIA newsroom, 2026-01-25)*

**Backlog / RPO:** NVIDIA công bố ~1.000 tỷ USD đơn đặt hàng (purchase orders) cho nền tảng Blackwell & Vera Rubin trải dài 2025–2027; Blackwell 'sold out' hết nửa đầu 2026. *(Wolfe Research via AOL / NVIDIA commentary, 2026-04)*

**TAM còn lại:** TAM data-center/AI accelerator ước tính hàng trăm tỷ USD/năm và mở rộng (AI training+inference, sovereign AI, networking). NVDA giữ vị thế thống lĩnh GPU AI. *(Intellectia / phemex academy (tổng hợp), 2026)*

**Segment & tốc độ:**
- Data Center (chủ đạo, >88% doanh thu), Gaming, Professional Visualization, Automotive/Robotics (optionality dài hạn). *(NVIDIA newsroom, 2026-01-25)*

**Rủi ro chiến lược & optionality:**
- Tập trung khách hàng (vài hyperscaler chiếm phần lớn doanh thu) => rủi ro cắt giảm capex.
- Chu kỳ bán dẫn: nếu chi tiêu AI hạ nhiệt, lợi nhuận đỉnh có thể đảo chiều nhanh (bẫy P/E thấp).
- Cạnh tranh (AMD, ASIC nội bộ của hyperscaler) và rủi ro địa chính trị/kiểm soát xuất khẩu sang Trung Quốc.
- Optionality: phần mềm (CUDA), networking, robotics/AV có thể mở rộng TAM.

**Forward revenue (consensus):** FY2027 ≈ 391.7 tỷ USD (52 analysts); FY2028 ≈ 551.7 tỷ USD (55 analysts).

## 5. Khung tham khảo
Đây là tài liệu tham khảo cho quyết định của riêng tôi, **không phải lời khuyên đầu tư**. Mọi con số đều kèm nguồn hoặc được đánh dấu GAP; verifier tự tính lại từ input thô để chống "xuất xưởng" số không kiểm chứng.

## 6. Nguồn (kèm as_of_date)
- [Finnhub MCP get_quote — as_of 2026-06-18](https://finnhub.io/docs/api/quote)
- [Finnhub MCP get_basic_financials — as_of 2026-06-19](https://finnhub.io/docs/api/company-basic-financials)
- [NVIDIA newsroom — as_of 2026-01-25](https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-fourth-quarter-and-fiscal-2026)
- [Alpha Vantage EARNINGS_ESTIMATES — as_of 2026-06-19](https://www.alphavantage.co/documentation/#earnings-estimates)
- [Simply Wall St forecast (consensus) — as_of 2026-06](https://simplywall.st/stocks/us/semiconductors/nasdaq-nvda/nvidia/future)
- [Wolfe Research via AOL / NVIDIA commentary — as_of 2026-04](https://www.aol.com/articles/wolfe-research-nvidia-1t-orders-111125629.html)
- [Intellectia / phemex academy (tổng hợp) — as_of 2026](https://intellectia.ai/blog/nvidia-stock-analysis-2026-ai-demand)

---
*Sinh tự động bởi pipeline 8-phase (derive→build→verify). Recompute & guards: xem artifacts/verifier-report-NVDA.json.*
