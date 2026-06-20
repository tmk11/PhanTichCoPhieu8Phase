# Derivation log — ORCL (Oracle Corporation)
as_of: 2026-06-19  |  giá: 184.29 (nguồn: Finnhub MCP get_quote, 2026-06-18)

> Mọi phép tính dưới đây dùng INPUT THÔ từ canonical. Không số nào lấy từ trường dựng sẵn của vendor.

## 1. Forward P/E theo năm  (= giá ÷ EPS_estimate[năm])
| FY | EPS est | nguồn-tier | forward P/E = 184.29 ÷ EPS |
|----|---------|-----------|------|
| 2027 | 8.0321 | data_vendor | 184.29 ÷ 8.0321 = **22.94** |
| 2028 | 10.8829 | data_vendor | 184.29 ÷ 10.8829 = **16.93** |
| 2029 | GAP | gap | — (không tính: Không có consensus đáng tin cho FY2029 (>2 năm) từ nguồn mở tại thời điểm chạy.) |
| 2030 | GAP | gap | — (không tính: Không có consensus đáng tin cho FY2030.) |

## 2. Tăng trưởng EPS (CAGR)  (= (EPS_cuối/EPS_đầu)^(1/số_năm) − 1)
- Cửa sổ chính: FY2027 (8.0321) → FY2028 (10.8829), 1 năm.
  - CAGR = (10.8829/8.0321)^(1/1) − 1 = **35.4926%** (năm xa nhất thuộc tier: data_vendor).
- Biến thể CHỈ data_vendor: FY2027→FY2028 ⇒ CAGR=35.4926%, PEG=0.6465.
- YoY đối chiếu: FY2028:35.49%

## 3. Forward PEG  (= forward P/E[FY1] ÷ growth%dạng-nguyên)
- forwardPE(FY2027=22.9442) / growth%(35.4926) = **0.6465**  (method: manual).
- Lưu ý chia cho 35.4926 (số phần trăm), KHÔNG chia cho 0.3549.
- Đối chiếu vendor pegTTM = 1.83719 (CẤM dùng; chỉ để chứng minh số tay KHÁC số vendor).

## 4. Cờ (xác định từ dữ liệu)
- Cyclical: false  |  loss_to_profit_applicable: false
- FCF âm: true  |  PEG ngắn-hạn không tin (tăng trưởng <5%): false
- Khung 4 năm: có 2/4 năm forward dạng số ⇒ horizon_gap=true
