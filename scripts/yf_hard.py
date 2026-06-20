#!/usr/bin/env python3
# Lấy SỐ CỨNG từ Yahoo Finance (yfinance, keyless): giá, EPS TTM/PE/PEG vendor, beta,
# và LỊCH SỬ EPS pha loãng theo năm. In ra JSON 1 dòng cho Node gọi.
import sys, json, datetime

def _num(x):
    try:
        if x is None: return None
        f = float(x)
        return f if f == f else None
    except Exception:
        return None

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "thiếu ticker"})); return
    sym = sys.argv[1].upper()
    import yfinance as yf
    t = yf.Ticker(sym)

    price = None
    try:
        price = _num(t.fast_info.last_price)
    except Exception:
        pass
    info = {}
    try:
        info = t.info or {}
    except Exception:
        info = {}
    if price is None:
        price = _num(info.get("currentPrice") or info.get("regularMarketPrice"))
    if not price:
        print(json.dumps({"ok": False, "error": f"không có giá cho '{sym}' (mã không hợp lệ?)"})); return

    eps_actual, fye_month = [], None
    try:
        ist = t.income_stmt
        row = None
        for label in ("Diluted EPS", "Basic EPS"):
            if ist is not None and label in ist.index:
                row = ist.loc[label]; break
        if row is not None:
            for col, val in row.items():
                v = _num(val)
                if v is None: continue
                d = str(col.date() if hasattr(col, "date") else col)[:10]
                eps_actual.append({"fy": int(d[:4]), "period": d, "value": round(v, 4)})
            eps_actual.sort(key=lambda e: e["period"], reverse=True)
            if eps_actual:
                fye_month = int(eps_actual[0]["period"][5:7])
    except Exception:
        pass

    if fye_month is None:
        try:
            fye_month = datetime.datetime.utcfromtimestamp(int(info.get("lastFiscalYearEnd"))).month
        except Exception:
            fye_month = 12

    today = datetime.date.today().isoformat()
    print(json.dumps({
        "ok": True, "ticker": sym, "as_of": today, "price_as_of": today,
        "price": round(float(price), 4),
        "eps_ttm": _num(info.get("trailingEps")),
        "pe_ttm": _num(info.get("trailingPE")),
        "peg_ttm": _num(info.get("trailingPegRatio") or info.get("pegRatio")),
        "beta": _num(info.get("beta")),
        "company": info.get("longName") or info.get("shortName") or sym,
        "sector": info.get("sector") or info.get("industry") or "?",
        "fye_month": fye_month,
        "eps_actual": eps_actual[:4],
    }))

main()
