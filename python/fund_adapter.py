#!/usr/bin/env python3
"""Small JSON-line adapter for domestic public-fund market data.

The --sample mode is dependency-free and is used by the local regression tests.
The default mode lazily imports AKShare so the MCP server can still start when
the optional real-data dependencies have not been installed yet.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from typing import Any


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def sample_quotes() -> list[dict[str, Any]]:
    stamp = now_iso()
    quotes = [
        {"code": "510300", "name": "沪深300ETF", "market": "on_exchange", "fundType": "ETF", "indexName": "沪深300", "industry": "宽基", "price": 3.8, "nav": 3.79, "estimate": 3.8, "changePercent": 2.1, "volume": 1234567, "turnover": 4680000, "dataDate": stamp[:10], "updatedAt": stamp, "isTradingDay": True, "officialNavAvailable": True, "source": "sample"},
        {"code": "159915", "name": "创业板ETF", "market": "on_exchange", "fundType": "ETF", "indexName": "创业板指", "industry": "科技", "price": 2.1, "nav": 2.09, "estimate": 2.1, "changePercent": 1.2, "volume": 823400, "turnover": 1730000, "dataDate": stamp[:10], "updatedAt": stamp, "isTradingDay": True, "officialNavAvailable": True, "source": "sample"},
        {"code": "012345", "name": "半导体精选混合", "market": "off_exchange", "fundType": "混合型", "industry": "半导体", "nav": 1.2, "changePercent": -1.4, "dataDate": stamp[:10], "updatedAt": stamp, "isTradingDay": True, "officialNavAvailable": False, "source": "sample"},
        {"code": "000001", "name": "华夏成长混合", "market": "off_exchange", "fundType": "混合型", "industry": "成长", "nav": 1.05, "changePercent": 0.3, "dataDate": stamp[:10], "updatedAt": stamp, "isTradingDay": True, "officialNavAvailable": False, "source": "sample"},
    ]
    extra = [
        ("013001", "人工智能主题ETF联接", "AI", "混合型", 1.18, 1.8),
        ("159819", "互联网科技ETF", "科技", "ETF", 1.92, 1.4),
        ("512760", "半导体ETF", "半导体", "ETF", 0.86, 0.9),
        ("159992", "创新药ETF", "医疗", "ETF", 0.77, 0.7),
        ("516160", "新能源ETF", "新能源", "ETF", 1.36, 0.5),
        ("159928", "消费ETF", "消费", "ETF", 0.98, 0.2),
        ("512660", "军工ETF", "军工", "ETF", 1.11, -0.2),
        ("515180", "红利ETF", "红利", "ETF", 1.22, -0.4),
        ("011234", "成长精选混合", "成长", "混合型", 1.09, -0.6),
        ("014567", "医疗健康混合", "医疗", "混合型", 0.93, -0.8),
        ("016789", "科技创新混合", "科技", "混合型", 1.03, -1.0),
        ("018901", "新能源车混合", "新能源", "混合型", 0.88, -1.2),
        ("019012", "数字经济混合", "科技", "混合型", 1.16, -1.5),
        ("020123", "先进制造混合", "制造", "混合型", 1.02, -1.7),
        ("021234", "中证红利指数", "红利", "指数型", 1.31, -2.0),
        ("022345", "宽基成长ETF", "宽基", "ETF", 1.48, -2.3),
    ]
    for index, (code, name, industry, fund_type, nav, change) in enumerate(extra):
        quotes.append({
            "code": code, "name": name, "market": "off_exchange" if index % 3 == 0 else "on_exchange",
            "fundType": fund_type, "industry": industry, "nav": nav, "price": nav if fund_type == "ETF" else None,
            "changePercent": change, "dataDate": stamp[:10], "updatedAt": stamp,
            "isTradingDay": True, "officialNavAvailable": fund_type == "ETF", "source": "sample",
        })
    # Keep the local demo useful for testing the 20 / 50 / 100 result sizes.
    industries = [("AI", "人工智能"), ("科技", "科技创新"), ("半导体", "芯片产业"), ("医疗", "医药健康"), ("新能源", "新能源"), ("消费", "消费升级"), ("红利", "红利策略"), ("宽基", "宽基指数")]
    for index in range(80):
        industry, label = industries[index % len(industries)]
        fund_type = "ETF" if index % 2 == 0 else "混合型"
        code = str(230000 + index).zfill(6)
        change = round(0.35 - (index % 15) * 0.11, 2)
        nav = round(0.82 + (index % 18) * 0.035, 4)
        quotes.append({
            "code": code, "name": f"{label}精选{index + 1:02d}",
            "market": "on_exchange" if index % 3 else "off_exchange", "fundType": fund_type,
            "indexName": industry, "industry": industry, "nav": nav,
            "price": nav if fund_type == "ETF" else None, "changePercent": change,
            "dataDate": stamp[:10], "updatedAt": stamp, "isTradingDay": True,
            "officialNavAvailable": fund_type == "ETF", "source": "sample",
        })
    for index, quote in enumerate(quotes):
        today = float(quote.get("changePercent") or 0)
        quote["periodChanges"] = {
            "today": round(today, 2),
            "yesterday": round(today * (0.72 + (index % 3) * 0.08), 2),
            "week": round(today * (1.55 + (index % 4) * 0.12), 2),
            "half_month": round(today * (2.15 + (index % 5) * 0.15), 2),
            "month": round(today * (3.1 + (index % 6) * 0.2), 2),
        }
    return quotes


def as_number(value: Any) -> float | None:
    if value is None or value == "" or value != value:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def row_value(row: Any, *names: str) -> Any:
    for name in names:
        if name in row:
            return row[name]
    return None


def real_quotes() -> list[dict[str, Any]]:
    try:
        import akshare as ak
    except ImportError as error:
        raise RuntimeError("Real fund data requires: pip install -r python/requirements.txt") from error

    stamp = now_iso()
    quotes: list[dict[str, Any]] = []
    etf = ak.fund_etf_spot_em()
    for _, row in etf.iterrows():
        code = str(row_value(row, "代码", "基金代码") or "").zfill(6)
        if not code or code == "000000":
            continue
        quotes.append({
            "code": code,
            "name": str(row_value(row, "名称", "基金名称") or ""),
            "market": "on_exchange",
            "fundType": "ETF",
            "price": as_number(row_value(row, "最新价", "最新净值")),
            "nav": as_number(row_value(row, "IOPV实时估值", "IOPV")),
            "estimate": as_number(row_value(row, "IOPV实时估值", "IOPV")),
            "changePercent": as_number(row_value(row, "涨跌幅")),
            "volume": as_number(row_value(row, "成交量")),
            "turnover": as_number(row_value(row, "成交额")),
            "dataDate": stamp[:10], "updatedAt": stamp, "isTradingDay": True,
            "officialNavAvailable": True, "source": "AKShare fund_etf_spot_em",
        })

    open_fund = ak.fund_open_fund_daily_em()
    for _, row in open_fund.iterrows():
        code = str(row_value(row, "基金代码") or "").zfill(6)
        if not code or code == "000000":
            continue
        quotes.append({
            "code": code,
            "name": str(row_value(row, "基金简称") or ""),
            "market": "off_exchange",
            "fundType": "开放式公募",
            "nav": as_number(row_value(row, "单位净值")),
            "changePercent": as_number(row_value(row, "日增长率")),
            "dataDate": str(row_value(row, "净值日期") or stamp[:10]), "updatedAt": stamp,
            "isTradingDay": True, "officialNavAvailable": False,
            "source": "AKShare fund_open_fund_daily_em",
        })
    return quotes


def main() -> None:
    request = json.loads(sys.stdin.readline() or "{}")
    quotes = sample_quotes() if "--sample" in sys.argv else real_quotes()
    payload = {"quotes": quotes, "request": request}
    print(json.dumps(payload, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False), flush=True)
        sys.exit(1)
