# Derivation log — MSFT (Microsoft Corporation)
as_of: 2026-06-19  |  giá: 379.4 (nguồn: Finnhub MCP get_quote, 2026-06-18)

> Mọi phép tính dưới đây dùng INPUT THÔ từ canonical. Không số nào lấy từ trường dựng sẵn của vendor.

## 1. Forward P/E theo năm  (= giá ÷ EPS_estimate[năm])
| FY | EPS est | nguồn-tier | forward P/E = 379.4 ÷ EPS |
|----|---------|-----------|------|
| 2026 | 15.93 | news | 379.4 ÷ 15.93 = **23.82** |
| 2027 | 18.61 | news | 379.4 ÷ 18.61 = **20.39** |
| 2028 | 21.74 | news | 379.4 ÷ 21.74 = **17.45** |
| 2029 | GAP | gap | — (không tính: Không có consensus đáng tin cho FY2029 từ nguồn mở tại thời điểm chạy.) |

## 2. Tăng trưởng EPS (CAGR)  (= (EPS_cuối/EPS_đầu)^(1/số_năm) − 1)
- Cửa sổ chính: FY2026 (15.93) → FY2028 (21.74), 2 năm.
  - CAGR = (21.74/15.93)^(1/2) − 1 = **16.8213%** (năm xa nhất thuộc tier: news).
- YoY đối chiếu: FY2027:16.82%, FY2028:16.82%

## 3. Forward PEG  (= forward P/E[FY1] ÷ growth%dạng-nguyên)
- forwardPE(FY2026=23.8167) / growth%(16.8213) = **1.4159**  (method: manual).
- Lưu ý chia cho 16.8213 (số phần trăm), KHÔNG chia cho 0.1682.
- Đối chiếu vendor pegTTM = 1.5835 (CẤM dùng; chỉ để chứng minh số tay KHÁC số vendor).

## 4. Cờ (xác định từ dữ liệu)
- Cyclical: false  |  loss_to_profit_applicable: false
- FCF âm: false  |  PEG ngắn-hạn không tin (tăng trưởng <5%): false
- Khung 4 năm: có 3/4 năm forward dạng số ⇒ horizon_gap=true
