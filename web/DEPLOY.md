# Triển khai trên VPS (nginx + systemd + 9router)

App đã chạy trên VPS `158.180.25.244`:
- **Frontend/API:** Node `web/server.mjs` → `127.0.0.1:8895` (systemd `stock-pipeline.service`)
- **Nginx:** site `stock-pipeline-8891` lắng nghe `:8891` → proxy `127.0.0.1:8895`
- **AI đa-model:** proxy `/api/ai` → 9router `http://127.0.0.1:8889/v1` (OpenAI-compatible). **API key chỉ ở server** (web/.env, chmod 600), không lộ ra client.
- **URL:** `http://158.180.25.244:8891` (xem caveat Security List bên dưới).

## Các bước (đã thực hiện)

```bash
# 1) Lấy code + chạy pipeline (sinh artifacts/reports)
git clone --branch claude/new-session-zmiggf https://github.com/tmk11/PhanTichCoPhieu8Phase.git ~/stock-pipeline
cd ~/stock-pipeline && node scripts/orchestrate.mjs NVDA MSFT GOOGL ORCL AFRM

# 2) Env (key giữ ở server)
cat > web/.env <<'ENV'
PORT=8895
HOST=127.0.0.1
NINEROUTER_URL=http://127.0.0.1:8889/v1
NINEROUTER_KEY=<9router key trong ~/.openclaw/secrets/9router.env>
DEFAULT_MODEL=gh/gpt-4o-mini
TICKERS=NVDA,MSFT,GOOGL,ORCL,AFRM
ENV
chmod 600 web/.env

# 3) systemd service  -> /etc/systemd/system/stock-pipeline.service (xem stock-pipeline.service)
sudo systemctl daemon-reload && sudo systemctl enable --now stock-pipeline

# 4) nginx  -> /etc/nginx/sites-available/stock-pipeline-8891 (xem nginx-stock-pipeline-8891.conf)
sudo ln -sf /etc/nginx/sites-available/stock-pipeline-8891 /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 5) Firewall (iptables; chèn TRƯỚC luật REJECT cuối, rồi lưu vĩnh viễn)
sudo iptables -I INPUT -p tcp --dport 8891 -m conntrack --ctstate NEW -j ACCEPT
sudo netfilter-persistent save
```

## Cập nhật sau này
```bash
cd ~/stock-pipeline && git pull && node scripts/orchestrate.mjs NVDA MSFT GOOGL ORCL AFRM
sudo systemctl restart stock-pipeline
```

## ⚠️ Caveat — Oracle Cloud Security List
Firewall OS (iptables) đã mở cổng 8891. Nếu trình duyệt KHÔNG vào được `http://158.180.25.244:8891`,
cần thêm Ingress Rule **TCP 8891** trong **OCI Security List / NSG** của instance (giống như các cổng
8887–8890 đã mở sẵn cho các app khác). Đây là tầng firewall đám mây, không điều khiển được từ trong máy.

Phương án thay thế (public ngay, bỏ qua Security List): dùng cloudflared quick tunnel trỏ tới `127.0.0.1:8891`.
