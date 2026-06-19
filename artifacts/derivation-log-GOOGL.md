# Derivation log — GOOGL (Alphabet Inc. (Class A))
as_of: 2026-06-19  |  giá: 368.03 (nguồn: Finnhub MCP get_quote, 2026-06-18)

> Mọi phép tính dưới đây dùng INPUT THÔ từ canonical. Không số nào lấy từ trường dựng sẵn của vendor.

## 1. Forward P/E theo năm  (= giá ÷ EPS_estimate[năm])
| FY | EPS est | nguồn-tier | forward P/E = 368.03 ÷ EPS |
|----|---------|-----------|------|
| 2026 | 14.2204 | data_vendor | 368.03 ÷ 14.2204 = **25.88** |
| 2027 | 14.4584 | data_vendor | 368.03 ÷ 14.4584 = **25.45** |

## 2. Tăng trưởng EPS (CAGR)  (= (EPS_cuối/EPS_đầu)^(1/số_năm) − 1)
- Cửa sổ chính: FY2026 (14.2204) → FY2027 (14.4584), 1 năm.
  - CAGR = (14.4584/14.2204)^(1/1) − 1 = **1.6737%** (năm xa nhất thuộc tier: data_vendor).
- Biến thể CHỈ data_vendor: FY2026→FY2027 ⇒ CAGR=1.6737%, PEG=15.463.
- YoY đối chiếu: FY2027:1.67%

## 3. Forward PEG  (= forward P/E[FY1] ÷ growth%dạng-nguyên)
- forwardPE(FY2026=25.8804) / growth%(1.6737) = **15.463**  (method: manual).
- Lưu ý chia cho 1.6737 (số phần trăm), KHÔNG chia cho 0.0167.
- Đối chiếu vendor pegTTM = 1.71989 (CẤM dùng; chỉ để chứng minh số tay KHÁC số vendor).

## 4. Cờ (xác định từ dữ liệu)
- Cyclical: false  |  loss_to_profit_applicable: false
- FCF âm: false  |  PEG ngắn-hạn không tin (tăng trưởng <5%): true
- Khung 4 năm: có 2/4 năm forward dạng số ⇒ horizon_gap=true
