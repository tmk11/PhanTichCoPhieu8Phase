# Derivation log — NVDA (NVIDIA Corporation)
as_of: 2026-06-19  |  giá: 210.69 (nguồn: Finnhub MCP get_quote, 2026-06-18)

> Mọi phép tính dưới đây dùng INPUT THÔ từ canonical. Không số nào lấy từ trường dựng sẵn của vendor.

## 1. Forward P/E theo năm  (= giá ÷ EPS_estimate[năm])
| FY | EPS est | nguồn-tier | forward P/E = 210.69 ÷ EPS |
|----|---------|-----------|------|
| 2027 | 8.9601 | data_vendor | 210.69 ÷ 8.9601 = **23.51** |
| 2028 | 12.7272 | data_vendor | 210.69 ÷ 12.7272 = **16.55** |
| 2029 | 15.96 | news | 210.69 ÷ 15.96 = **13.2** |
| 2030 | GAP | gap | — (không tính: Không có consensus đáng tin cho FY2030 (>4 năm); tránh bịa.) |

## 2. Tăng trưởng EPS (CAGR)  (= (EPS_cuối/EPS_đầu)^(1/số_năm) − 1)
- Cửa sổ chính: FY2027 (8.9601) → FY2029 (15.96), 2 năm.
  - CAGR = (15.96/8.9601)^(1/2) − 1 = **33.4627%** (năm xa nhất thuộc tier: news).
- Biến thể CHỈ data_vendor: FY2027→FY2028 ⇒ CAGR=42.0431%, PEG=0.5593.
- YoY đối chiếu: FY2028:42.04%, FY2029:25.4%

## 3. Forward PEG  (= forward P/E[FY1] ÷ growth%dạng-nguyên)
- forwardPE(FY2027=23.5142) / growth%(33.4627) = **0.7027**  (method: manual).
- Lưu ý chia cho 33.4627 (số phần trăm), KHÔNG chia cho 0.3346.
- Đối chiếu vendor pegTTM = 0.62493 (CẤM dùng; chỉ để chứng minh số tay KHÁC số vendor).

## 4. Cờ (xác định từ dữ liệu)
- Cyclical: true  |  loss_to_profit_applicable: true (min(EPS quá khứ)=0.1742 <= 0.5 => CAGR/growth lịch sử bị thổi phồng; PEG trailing & growth quá khứ méo.)
- FCF âm: false  |  PEG ngắn-hạn không tin (tăng trưởng <5%): false
- Khung 4 năm: có 3/4 năm forward dạng số ⇒ horizon_gap=true
