#!/usr/bin/env python3
# Lấy SỐ CỨNG từ Yahoo (yfinance, keyless): giá, EPS TTM/PE/PEG vendor, beta, lịch sử EPS,
# và INPUT cho đa-lăng-kính định giá: market cap, EV, EBITDA, FCF/OCF (TTM), CapEx & D&A (BCTC năm),
# tổng nợ/tiền, doanh thu & tăng trưởng, số cổ phiếu, sector. In JSON 1 dòng.
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
    try: price = _num(t.fast_info.last_price)
    except Exception: pass
    info = {}
    try: info = t.info or {}
    except Exception: info = {}
    if price is None:
        price = _num(info.get("currentPrice") or info.get("regularMarketPrice"))
    if not price:
        print(json.dumps({"ok": False, "error": f"không có giá cho '{sym}' (mã không hợp lệ?)"})); return

    eps_actual, fye_month = [], None
    ist = None
    try: ist = t.income_stmt
    except Exception: ist = None
    try:
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
        try: fye_month = datetime.datetime.utcfromtimestamp(int(info.get("lastFiscalYearEnd"))).month
        except Exception: fye_month = 12

    def series(df, *names, n=5):
        if df is None: return []
        for nm in names:
            if nm in df.index:
                out = []
                for col, val in df.loc[nm].items():
                    v = _num(val)
                    if v is None: continue
                    d = str(col.date() if hasattr(col, "date") else col)[:10]
                    out.append({"fy": int(d[:4]), "period": d, "value": round(v, 2)})
                out.sort(key=lambda e: e["period"], reverse=True)
                return out[:n]
        return []

    revenue_series = series(ist, "Total Revenue", "Operating Revenue")

    # Biên lợi nhuận gộp & ròng theo năm (hiện tại + 2 năm gần đây)
    def margins(*num_names):
        rev = {e["fy"]: e["value"] for e in revenue_series}
        num = series(ist, *num_names)
        out = []
        for e in num:
            r = rev.get(e["fy"])
            if r and r != 0:
                out.append({"fy": e["fy"], "period": e["period"], "value": round(e["value"] / r * 100, 2)})
        return out[:3]
    gross_margin_series = margins("Gross Profit")
    net_margin_series = margins("Net Income", "Net Income Common Stockholders",
                                "Net Income Continuous Operations",
                                "Net Income From Continuing Operation Net Minority Interest")

    # ---- Input cho đa lăng kính ----
    capex_annual = dna_annual = ocf_annual = fcf_annual = None
    cf_period = None
    ocf_series = []
    try:
        cf = t.cashflow
        if cf is not None and len(cf.columns):
            col = cf.columns[0]
            cf_period = str(col.date() if hasattr(col, "date") else col)[:10]
            def g(*names):
                for n in names:
                    if n in cf.index:
                        v = _num(cf.loc[n, col])
                        if v is not None: return v
                return None
            capex_annual = g("Capital Expenditure", "Capital Expenditures", "Capital Expenditure Reported")
            dna_annual = g("Depreciation And Amortization", "Depreciation Amortization Depletion", "Reconciled Depreciation", "Depreciation")
            ocf_annual = g("Operating Cash Flow", "Cash Flow From Continuing Operating Activities")
            fcf_annual = g("Free Cash Flow")
            ocf_series = series(cf, "Operating Cash Flow", "Cash Flow From Continuing Operating Activities")
    except Exception:
        pass

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
        # valuation inputs
        "market_cap": _num(info.get("marketCap")),
        "enterprise_value": _num(info.get("enterpriseValue")),
        "ebitda": _num(info.get("ebitda")),
        "total_debt": _num(info.get("totalDebt")),
        "total_cash": _num(info.get("totalCash")),
        "revenue": _num(info.get("totalRevenue")),
        "revenue_growth": _num(info.get("revenueGrowth")),
        "shares": _num(info.get("sharesOutstanding")),
        "fcf_ttm": _num(info.get("freeCashflow")),
        "ocf_ttm": _num(info.get("operatingCashflow")),
        "capex_annual": (abs(capex_annual) if capex_annual is not None else None),
        "dna_annual": (abs(dna_annual) if dna_annual is not None else None),
        "ocf_annual": ocf_annual,
        "fcf_annual": fcf_annual,
        "cf_period": cf_period,
        "ocf_series": ocf_series,
        "revenue_series": revenue_series,
        "gross_margin_series": gross_margin_series,
        "net_margin_series": net_margin_series,
    }))

main()
