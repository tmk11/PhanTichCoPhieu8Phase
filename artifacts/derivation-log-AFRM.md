# Derivation log — AFRM (Affirm Holdings, Inc.)
as_of: 2026-06-19  |  giá: 73.92 (nguồn: Finnhub MCP get_quote, 2026-06-18)

> Mọi phép tính dưới đây dùng INPUT THÔ từ canonical. Không số nào lấy từ trường dựng sẵn của vendor.

## 1. Forward P/E theo năm  (= giá ÷ EPS_estimate[năm])
| FY | EPS est | nguồn-tier | forward P/E = 73.92 ÷ EPS |
|----|---------|-----------|------|
| 2026 | 3.1027 | data_vendor | 73.92 ÷ 3.1027 = **23.82** |
| 2027 | 3.7769 | data_vendor | 73.92 ÷ 3.7769 = **19.57** |
| 2028 | GAP | gap | — (không tính: Không có consensus đáng tin cho FY2028.) |
| 2029 | GAP | gap | — (không tính: Không có consensus đáng tin cho FY2029.) |

## 2. Tăng trưởng EPS (CAGR)  (= (EPS_cuối/EPS_đầu)^(1/số_năm) − 1)
- Cửa sổ chính: FY2026 (3.1027) → FY2027 (3.7769), 1 năm.
  - CAGR = (3.7769/3.1027)^(1/1) − 1 = **21.7295%** (năm xa nhất thuộc tier: data_vendor).
- Biến thể CHỈ data_vendor: FY2026→FY2027 ⇒ CAGR=21.7295%, PEG=1.0964.
- YoY đối chiếu: FY2027:21.73%

## 3. Forward PEG  (= forward P/E[FY1] ÷ growth%dạng-nguyên)
- forwardPE(FY2026=23.8244) / growth%(21.7295) = **1.0964**  (method: manual).
- Lưu ý chia cho 21.7295 (số phần trăm), KHÔNG chia cho 0.2173.
- Đối chiếu vendor pegTTM = 34.36739 (CẤM dùng; chỉ để chứng minh số tay KHÁC số vendor).

## 4. Cờ (xác định từ dữ liệu)
- Cyclical: false  |  loss_to_profit_applicable: true (min(EPS quá khứ)=-3.3363 <= 0.5 => CAGR/growth lịch sử bị thổi phồng; PEG trailing & growth quá khứ méo.)
- FCF âm: false  |  PEG ngắn-hạn không tin (tăng trưởng <5%): false
- Khung 4 năm: có 2/4 năm forward dạng số ⇒ horizon_gap=true
