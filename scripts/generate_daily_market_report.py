#!/usr/bin/env python3
import argparse
import json
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path


BASE = "https://data.eastmoney.com/dataapi/bkzj/getbkzj"
TENCENT_QUOTE = "https://qt.gtimg.cn/q="
TENCENT_KLINE = "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get"
SITE_ROOT = Path(__file__).resolve().parents[1]
SITE_DATA = SITE_ROOT / "data"


THEMES = [
    {
        "name": "机器人/人形机器人",
        "aliases": ["机器人概念", "人形机器人", "机器人执行器", "减速器", "工业母机"],
        "role": "主线题材",
    },
    {
        "name": "汽车零部件/新能源车/特斯拉链",
        "aliases": ["汽车零部件", "新能源车", "特斯拉概念", "华为汽车", "乘用车"],
        "role": "承接主线",
    },
    {
        "name": "低空经济/军工/商业航天",
        "aliases": ["低空经济", "军工", "军民融合", "航天装备Ⅱ", "航海装备Ⅱ"],
        "role": "轮动支线",
    },
    {
        "name": "贵金属",
        "aliases": ["贵金属"],
        "role": "防守支线",
    },
    {
        "name": "半导体/芯片/CPO",
        "aliases": ["半导体", "半导体概念", "国产芯片", "存储芯片", "CPO概念", "光通信模块", "通信设备"],
        "role": "修复观察",
    },
]

CANDIDATE_UNIVERSE = [
    {"code": "002050", "symbol": "sz002050", "name": "三花智控", "theme": "机器人/汽车零部件链", "role": "中军/趋势核心"},
    {"code": "601689", "symbol": "sh601689", "name": "拓普集团", "theme": "机器人/汽车零部件链", "role": "中军/趋势核心"},
    {"code": "688017", "symbol": "sh688017", "name": "绿的谐波", "theme": "机器人/人形机器人", "role": "弹性核心"},
    {"code": "603728", "symbol": "sh603728", "name": "鸣志电器", "theme": "机器人执行器", "role": "弹性观察"},
    {"code": "002472", "symbol": "sz002472", "name": "双环传动", "theme": "减速器/汽车链", "role": "趋势观察"},
    {"code": "002085", "symbol": "sz002085", "name": "万丰奥威", "theme": "低空经济/汽车链", "role": "轮动核心"},
    {"code": "000099", "symbol": "sz000099", "name": "中信海直", "theme": "低空经济", "role": "轮动观察"},
    {"code": "601899", "symbol": "sh601899", "name": "紫金矿业", "theme": "贵金属/资源", "role": "防守中军"},
    {"code": "600547", "symbol": "sh600547", "name": "山东黄金", "theme": "贵金属", "role": "防守观察"},
    {"code": "300502", "symbol": "sz300502", "name": "新易盛", "theme": "CPO/AI硬件", "role": "修复观察"},
    {"code": "300308", "symbol": "sz300308", "name": "中际旭创", "theme": "CPO/AI硬件", "role": "修复观察"},
    {"code": "002463", "symbol": "sz002463", "name": "沪电股份", "theme": "AI硬件/PCB", "role": "趋势观察"},
    {"code": "002916", "symbol": "sz002916", "name": "深南电路", "theme": "AI硬件/PCB", "role": "趋势观察"},
]

INDEX_UNIVERSE = [
    {"symbol": "sh000001", "name": "上证指数"},
    {"symbol": "sz399001", "name": "深证成指"},
    {"symbol": "sz399006", "name": "创业板指"},
    {"symbol": "sh000300", "name": "沪深300"},
]


def fetch(fs_code: str):
    params = urllib.parse.urlencode({"key": "f62", "code": fs_code})
    req = urllib.request.Request(
        f"{BASE}?{params}",
        headers={
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://data.eastmoney.com/bkzj/",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))["data"]["diff"]


def yi(value: int) -> float:
    return round(value / 100000000, 2)


def http_get(url, encoding="utf-8"):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=12) as resp:
        return resp.read().decode(encoding, errors="ignore")


def to_float(value):
    try:
        if value in ("", "-", None):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def avg(values):
    clean = [v for v in values if isinstance(v, (int, float))]
    return sum(clean) / len(clean) if clean else None


def fetch_tencent_quote(symbol):
    raw = http_get(TENCENT_QUOTE + symbol, encoding="gbk")
    if '="' not in raw:
        return None
    values = raw.split('="', 1)[1].rsplit('"', 1)[0].split("~")
    if len(values) < 38:
        return None
    return {
        "name": values[1],
        "code": values[2],
        "price": to_float(values[3]),
        "prev_close": to_float(values[4]),
        "open": to_float(values[5]),
        "datetime": values[30],
        "change": to_float(values[31]),
        "pct": to_float(values[32]),
        "high": to_float(values[33]),
        "low": to_float(values[34]),
        "amount_10000": to_float(values[37]),
        "turnover": to_float(values[38]) if len(values) > 38 else None,
    }


def fetch_tencent_klines(symbol, limit=80):
    params = urllib.parse.urlencode({"param": f"{symbol},day,,,{limit},qfq"})
    raw = http_get(f"{TENCENT_KLINE}?{params}")
    data = json.loads(raw).get("data", {}).get(symbol, {})
    rows = data.get("qfqday") or data.get("day") or []
    return [
        {
            "date": row[0],
            "open": to_float(row[1]),
            "close": to_float(row[2]),
            "high": to_float(row[3]),
            "low": to_float(row[4]),
            "volume": to_float(row[5]),
        }
        for row in rows
    ]


def technical_from(quote, klines):
    closes = [row["close"] for row in klines]
    highs = [row["high"] for row in klines]
    lows = [row["low"] for row in klines]
    vols = [row["volume"] for row in klines]
    close = (quote or {}).get("price") or (closes[-1] if closes else None)
    ma5 = avg(closes[-5:])
    ma10 = avg(closes[-10:])
    ma20 = avg(closes[-20:])
    ma60 = avg(closes[-60:])
    vol5 = avg(vols[-6:-1]) if len(vols) >= 6 else avg(vols[:-1])
    prior20_high = max(highs[-21:-1]) if len(highs) >= 21 else (max(highs[:-1]) if len(highs) > 1 else None)
    prior20_low = min(lows[-21:-1]) if len(lows) >= 21 else (min(lows[:-1]) if len(lows) > 1 else None)
    above = [
        bool(close and ma5 and close >= ma5),
        bool(close and ma10 and close >= ma10),
        bool(close and ma20 and close >= ma20),
        bool(close and ma60 and close >= ma60),
    ]
    range_pos = None
    if close and prior20_high and prior20_low and prior20_high > prior20_low:
        range_pos = round((close - prior20_low) / (prior20_high - prior20_low) * 100, 1)
    return {
        "ma5": round(ma5, 2) if ma5 else None,
        "ma10": round(ma10, 2) if ma10 else None,
        "ma20": round(ma20, 2) if ma20 else None,
        "ma60": round(ma60, 2) if ma60 else None,
        "trend_score": sum(above),
        "volume_ratio_5d": round(vols[-1] / vol5, 2) if vols and vol5 else None,
        "breakout_20d": bool(close and prior20_high and close >= prior20_high),
        "range_position_20d": range_pos,
    }


def row_to_public(row, rank):
    return {
        "rank": rank,
        "code": row["f12"],
        "name": row["f14"],
        "main_net_inflow_yuan": row["f62"],
        "main_net_inflow_100m_yuan": yi(row["f62"]),
    }


def collect_theme(theme, industry, concept):
    rows = []
    all_rows = [("industry", row) for row in industry] + [("concept", row) for row in concept]
    for source, row in all_rows:
        if row["f14"] in theme["aliases"]:
            rows.append(
                {
                    "source": source,
                    "code": row["f12"],
                    "name": row["f14"],
                    "flow": yi(row["f62"]),
                }
            )
    score = round(sum(item["flow"] for item in rows), 2)
    strongest = sorted(rows, key=lambda x: x["flow"], reverse=True)[:4]
    weakest = sorted(rows, key=lambda x: x["flow"])[:2]
    return rows, score, strongest, weakest


def stage_for(theme_name, score, strongest):
    if "机器人" in theme_name:
        if score >= 250:
            return "高潮后分歧", "强分歧后看前排回封，不追一致高开。"
        return "发酵", "看板块是否补量扩散，优先核心零部件。"
    if "汽车" in theme_name:
        if score >= 180:
            return "承接加速", "若机器人分歧，观察汽车链中军能否逆势放量突破。"
        return "承接观察", "只看有成交确认的趋势核心。"
    if "低空" in theme_name:
        return "轮动试探", "只做换手确认，不把缩量秒板当核心。"
    if "贵金属" in theme_name:
        return "防守承接", "指数走弱或题材炸板率升高时才提高权重。"
    if "半导体" in theme_name:
        if score < -200:
            return "退潮/弱修复", "资金未回流前只观察，不按新主线处理。"
        return "修复观察", "必须看到板块资金和中军反包同时确认。"
    return "观察", "等待资金与价格共振。"


def trade_plan_for(theme_name, score, stage):
    if "机器人" in theme_name:
        return {
            "bias": "主线强，但只买分歧确认",
            "analysis": "资金强度最高，情绪处在高潮后的分歧观察位。这里最容易出现前排继续强、后排兑现的分化，不能用板块热度替代个股地位。",
            "buy_points": [
                "前排核心高开后换手承接，回踩分时均线不破，再放量转强。",
                "炸板后快速回封，且板块内仍有 2-3 个强势核心互相支撑。",
                "低吸只允许发生在上升趋势内，不能买后排冲高回落。"
            ],
            "sell_points": [
                "前排核心开盘一致加速后放量炸板，回封失败。",
                "板块后排大面积掉队，核心股跌破分时均线且无法收回。",
                "持仓股从龙头/中军降级为跟风，按纪律减仓或退出。"
            ],
            "invalidation": "机器人核心不再领涨，执行器/减速器同步走弱，板块资金明显转负。",
            "position": "可作为主线观察，但只给确认仓；高潮后不适合满仓追。"
        }
    if "汽车" in theme_name:
        return {
            "bias": "承接方向，优先看中军",
            "analysis": "汽车零部件、新能源车、特斯拉链与机器人硬件有交集，适合承接主线分歧资金。比纯题材后排更适合做趋势核心和中军。",
            "buy_points": [
                "机器人分歧时，汽车链核心逆势放量突破平台或前高。",
                "板块指数强于大盘，个股站上分时均线后回踩不破。",
                "优先选择汽车零部件 + 机器人零部件双属性的趋势票。"
            ],
            "sell_points": [
                "承接失败，放量突破后立刻跌回平台。",
                "机器人和汽车链同时退潮，说明资金不是切换而是整体撤退。",
                "中军放量滞涨，后排先跌，按趋势破坏处理。"
            ],
            "invalidation": "汽车零部件不再维持行业流入前列，新能源车/特斯拉链同步转弱。",
            "position": "比机器人后排更适合做计划仓，但仍需分批，不超过系统单票红线。"
        }
    if "低空" in theme_name:
        return {
            "bias": "轮动支线，小仓试错",
            "analysis": "低空、军工、商业航天属于主线外溢后的轮动方向。能做，但需要确认资金切换，不应提前重仓埋伏。",
            "buy_points": [
                "主线分歧时，低空/军工板块主动进入涨幅前列。",
                "出现换手板或趋势中军放量突破，而不是缩量秒板。",
                "午前强、午后仍能维持承接，才说明不是一日游。"
            ],
            "sell_points": [
                "轮动当天冲高回落，次日不能弱转强。",
                "只有个别票表现，板块没有梯队。",
                "大盘走弱时高位题材炸板，先保护本金。"
            ],
            "invalidation": "没有板块梯队，资金只拉单点，无法形成情绪扩散。",
            "position": "观察或小仓，不按主线仓位处理。"
        }
    if "贵金属" in theme_name:
        return {
            "bias": "防守承接，不做进攻主线",
            "analysis": "贵金属适合在指数弱、题材炸板率升高时承担防守角色。它不是题材进攻核心，买点要和风险偏好下降同时出现。",
            "buy_points": [
                "指数冲高回落，题材股炸板率升高，贵金属逆势走强。",
                "趋势票回踩 5 日线或分时均线后转强。",
                "金价或避险情绪同步强化时，提高观察权重。"
            ],
            "sell_points": [
                "指数重新放量上攻，风险偏好回到题材主线。",
                "贵金属冲高但成交跟不上，防守资金撤离。",
                "跌破短期趋势线，按防守失败处理。"
            ],
            "invalidation": "市场风险偏好上升，题材主线重新吸金，贵金属失去逆势属性。",
            "position": "只作对冲/防守仓，不和主线题材同等权重。"
        }
    if "半导体" in theme_name:
        return {
            "bias": "资金流出区，只看修复确认",
            "analysis": "半导体、国产芯片、存储、CPO当前资金流出明显。这里不能因为熟悉或有信仰就提前抄底，必须等资金回流和中军反包。",
            "buy_points": [
                "板块资金由大幅流出转为明显回流。",
                "核心中军放量反包，并且不是低开弱反抽。",
                "CPO/存储/国产芯片至少一个细分方向出现持续梯队。"
            ],
            "sell_points": [
                "反抽无量，冲高后继续被主线抽血。",
                "中军反包失败，跌回前一日低点或关键均线下方。",
                "板块仍在流出榜前列，按退潮处理。"
            ],
            "invalidation": "资金继续流出且核心中军无法反包。",
            "position": "只观察，不作为优先买入方向；确认前不加大仓位。"
        }
    return {
        "bias": "等待确认",
        "analysis": "资金和价格尚未形成足够共振。",
        "buy_points": ["板块资金回流，核心个股放量突破。"],
        "sell_points": ["突破失败，跌回平台。"],
        "invalidation": "资金不持续。",
        "position": "观察。"
    }


def make_verification(industry, concept):
    return {
        "source": "Eastmoney Data Center dataapi/bkzj/getbkzj",
        "field": "f62 main net inflow",
        "industry_scope": "m:90+s:4",
        "concept_scope": "m:90+t:3",
        "industry_count": len(industry),
        "concept_count": len(concept),
        "industry_top": f"{industry[0]['f14']} {yi(industry[0]['f62'])}亿",
        "concept_top": f"{concept[0]['f14']} {yi(concept[0]['f62'])}亿",
        "classification_note": "东方财富 BK 板块/概念口径，不等同于 Wind 或申万行业口径。",
    }


def build_market_gate(industry, concept):
    index_rows = []
    open_count = 0
    for item in INDEX_UNIVERSE:
        try:
            quote = fetch_tencent_quote(item["symbol"])
            klines = fetch_tencent_klines(item["symbol"])
            tech = technical_from(quote, klines)
            is_open = tech["trend_score"] >= 3 and (quote or {}).get("pct", 0) >= -0.8
            open_count += 1 if is_open else 0
            index_rows.append(
                {
                    "name": item["name"],
                    "symbol": item["symbol"],
                    "price": (quote or {}).get("price"),
                    "pct": (quote or {}).get("pct"),
                    "trend_score": tech["trend_score"],
                    "status": "打开" if is_open else "谨慎",
                }
            )
        except Exception as exc:
            index_rows.append({"name": item["name"], "symbol": item["symbol"], "status": "数据缺失", "error": str(exc)})
    positive_industry = sum(1 for row in industry if row["f62"] > 0)
    positive_concept = sum(1 for row in concept if row["f62"] > 0)
    heat = round((positive_industry / len(industry)) * 0.45 + (positive_concept / len(concept)) * 0.55, 2)
    if open_count >= 3 and heat >= 0.45:
        status = "市场门打开"
        advice = "允许按系统做计划仓，但仍需分批和等待买点确认。"
    elif open_count >= 2:
        status = "市场门半开"
        advice = "只做主线前排和承接中军，后排与轮动降仓。"
    else:
        status = "市场门收紧"
        advice = "控制仓位，优先观察和防守，避免情绪化开新仓。"
    return {
        "status": status,
        "advice": advice,
        "open_index_count": open_count,
        "sector_heat": heat,
        "positive_industry_count": positive_industry,
        "positive_concept_count": positive_concept,
        "indices": index_rows,
    }


def score_candidate(item):
    quote = fetch_tencent_quote(item["symbol"])
    klines = fetch_tencent_klines(item["symbol"])
    tech = technical_from(quote, klines)
    pct_value = (quote or {}).get("pct") or 0
    vol_ratio = tech["volume_ratio_5d"] or 0
    score = tech["trend_score"] * 18 + min(vol_ratio, 3) * 10 + max(min(pct_value, 10), -10) * 1.2
    if tech["breakout_20d"]:
        score += 18
    if (tech["range_position_20d"] or 0) >= 95 and pct_value >= 7:
        score -= 10
    level = "观察池"
    if score >= 82 and tech["trend_score"] >= 3 and vol_ratio >= 1.2:
        level = "核心候选"
    elif score < 38 or tech["trend_score"] <= 1:
        level = "暂不纳入"
    return {
        **item,
        "price": (quote or {}).get("price"),
        "pct": pct_value,
        "turnover": (quote or {}).get("turnover"),
        "amount_10000": (quote or {}).get("amount_10000"),
        "score": round(score, 1),
        "level": level,
        "technical": tech,
        "reason": f"趋势分 {tech['trend_score']}/4，5日量比 {vol_ratio or '不足'}，20日突破 {'是' if tech['breakout_20d'] else '否'}。",
    }


def build_candidate_pool():
    candidates = []
    for item in CANDIDATE_UNIVERSE:
        try:
            candidates.append(score_candidate(item))
        except Exception as exc:
            candidates.append({**item, "level": "数据缺失", "score": 0, "reason": str(exc)})
    ranked = sorted(candidates, key=lambda row: row.get("score", 0), reverse=True)
    core = [row for row in ranked if row.get("level") == "核心候选"][:3]
    watch = [row for row in ranked if row.get("level") != "暂不纳入"][:8]
    return {
        "core": core,
        "watch": watch,
        "all": ranked,
        "note": "核心候选最多 1-3 个；若信号不完整，允许今日无核心候选。",
    }


def cycle_phase_for_sector(name, flow, source=""):
    if any(key in name for key in ["贵金属", "银行", "电力", "煤炭", "公用", "保险"]) and flow > 0:
        return "修复"
    if flow >= 150:
        return "高潮"
    if flow >= 60:
        return "加速"
    if flow >= 20:
        return "发酵"
    if flow > 0:
        return "启动"
    if flow > -20:
        return "分歧"
    return "退潮"


def cycle_rule_for_phase(phase):
    rules = {
        "启动": "只做观察和首板/中军确认，不能提前重仓。",
        "发酵": "开始筛龙头和中军，买点必须是分歧承接或放量突破。",
        "加速": "只给前排核心，后排不追，仓位不再扩张。",
        "高潮": "一致性过强，优先兑现和等待强分歧后的回封。",
        "分歧": "看核心是否抗跌和回流，不用下跌本身当买点。",
        "修复": "防守或修复阶段，只看中军承接，不按主线仓位处理。",
        "退潮": "主动降级，停止新开仓，已有仓位按失效线处理。",
    }
    return rules.get(phase, "等待资金与价格共振。")


def sector_cycle_rows(rows, source):
    result = []
    order = ["启动", "发酵", "加速", "高潮", "分歧", "修复", "退潮"]
    for index, row in enumerate(rows, 1):
        flow = yi(row["f62"])
        phase = cycle_phase_for_sector(row["f14"], flow, source)
        result.append(
            {
                "name": row["f14"],
                "code": row["f12"],
                "source": source,
                "phase": phase,
                "phase_index": order.index(phase),
                "flow": flow,
                "rank": index,
                "rule": cycle_rule_for_phase(phase),
            }
        )
    return result


def build_emotion_dashboard(themes, industry=None, concept=None):
    order = ["启动", "发酵", "加速", "高潮", "分歧", "修复", "退潮"]
    cards = []
    for theme in themes:
        phase = cycle_phase_for_sector(theme["name"], theme["flow_score_100m_yuan"], "系统")
        cards.append(
            {
                "name": theme["name"],
                "source": "系统主线",
                "phase": phase,
                "phase_index": order.index(phase),
                "flow": theme["flow_score_100m_yuan"],
                "rule": theme["trade_plan"]["bias"],
            }
        )
    sector_rows = sector_cycle_rows(industry or [], "行业") + sector_cycle_rows(concept or [], "概念")
    phase_counts = {phase: 0 for phase in order}
    for row in sector_rows:
        phase_counts[row["phase"]] += 1
    leaders = sorted(sector_rows, key=lambda row: row["flow"], reverse=True)[:10]
    laggards = sorted(sector_rows, key=lambda row: row["flow"])[:10]
    phase_groups = [
        {
            "phase": phase,
            "count": phase_counts[phase],
            "rule": cycle_rule_for_phase(phase),
            "sectors": sorted([row for row in sector_rows if row["phase"] == phase], key=lambda row: row["flow"], reverse=True),
        }
        for phase in order
    ]
    active_count = phase_counts["启动"] + phase_counts["发酵"] + phase_counts["加速"] + phase_counts["高潮"]
    risk_count = phase_counts["分歧"] + phase_counts["退潮"]
    total_count = len(sector_rows) or 1
    heat_score = round((active_count / total_count) * 100)
    overall_phase = "分歧"
    if phase_counts["高潮"] >= 8 or phase_counts["加速"] >= 20:
        overall_phase = "加速"
    elif phase_counts["发酵"] + phase_counts["启动"] >= risk_count:
        overall_phase = "发酵"
    elif phase_counts["退潮"] > active_count:
        overall_phase = "退潮"
    elif phase_counts["修复"] > phase_counts["加速"]:
        overall_phase = "修复"
    return {
        "order": order,
        "summary": {
            "overall_phase": overall_phase,
            "heat_score": heat_score,
            "total_count": len(sector_rows),
            "active_count": active_count,
            "risk_count": risk_count,
            "strongest": leaders[0] if leaders else None,
            "weakest": laggards[0] if laggards else None,
            "action": cycle_rule_for_phase(overall_phase),
        },
        "phase_counts": phase_counts,
        "leaders": leaders,
        "laggards": laggards,
        "phase_groups": phase_groups,
        "items": cards,
    }


def build_alerts(themes, market_gate, candidate_pool):
    alerts = []
    if market_gate["status"] != "市场门打开":
        alerts.append({"level": "risk", "title": "市场门未完全打开", "body": market_gate["advice"]})
    for theme in themes:
        if theme["flow_score_100m_yuan"] < -200:
            alerts.append({"level": "risk", "title": f"{theme['name']}资金退潮", "body": "资金仍在大幅流出，按系统只观察不加仓。"})
        if "高潮" in theme["emotion_stage"]:
            alerts.append({"level": "watch", "title": f"{theme['name']}高潮后分歧", "body": "只买分歧后的确认，不追一致高开。"})
    if not candidate_pool["core"]:
        alerts.append({"level": "watch", "title": "今日无核心候选", "body": "候选池未出现完整共振，按规则等待。"})
    return alerts[:8]


def build_data_freshness(source_data_date, generated_date):
    is_current = source_data_date == generated_date
    return {
        "is_current": is_current,
        "status": "当日数据" if is_current else "非当日数据",
        "message": "数据日期与生成日期一致。" if is_current else "数据日期不是今天，页面结论默认降级为历史复盘/待刷新。",
    }


def build_top_summary(themes, market_gate, freshness):
    main_theme = themes[0]["name"] if themes else "无明确主线"
    if market_gate["status"] == "市场门打开" and freshness["is_current"]:
        action = "可计划"
    elif market_gate["status"] == "市场门打开":
        action = "待刷新后计划"
    elif market_gate["status"] == "市场门半开":
        action = "轻仓观察"
    else:
        action = "只观察"
    return {
        "market_gate": market_gate["status"],
        "mainline": main_theme,
        "action": action,
        "taboo": "不追一致高开；不买后排情绪；不在市场门收紧时加仓。",
        "freshness": freshness["status"],
    }


def build_execution_checklist(themes, market_gate, freshness):
    items = []
    if not freshness["is_current"]:
        items.append({"title": "先刷新数据", "body": "当前不是当日数据，所有买点先按历史复盘处理。"})
    items.append({"title": "市场门", "body": market_gate["advice"]})
    for theme in themes[:4]:
        items.append({"title": theme["name"], "body": theme["trade_plan"]["bias"] + "；" + theme["expectation"]})
    items.append({"title": "禁忌", "body": "不开盘追一致，不买后排，不用情绪替代系统。"})
    return items[:6]


def build_sector_linkage(candidate_pool):
    sectors = {}
    for row in candidate_pool["all"]:
        sectors.setdefault(row["theme"], []).append(
            {
                "code": row["code"],
                "name": row["name"],
                "role": row["role"],
                "level": row.get("level"),
                "score": row.get("score"),
                "reason": row.get("reason"),
            }
        )
    return [
        {"theme": theme, "stocks": sorted(stocks, key=lambda x: x.get("score", 0), reverse=True)[:6]}
        for theme, stocks in sorted(sectors.items(), key=lambda item: max((x.get("score", 0) for x in item[1]), default=0), reverse=True)
    ]


def build_event_templates():
    return [
        {
            "name": "机器人/Tesla 催化",
            "watch": "发布会、订单、量产节点、供应链确认。",
            "buy_expectation": "只在板块未高潮、核心零部件放量转强时看预期。",
            "sell_news_risk": "若事件前已连续加速，发布当天更偏兑现风险。",
            "system_rule": "先确认龙头/中军地位，再决定是否进入核心候选。"
        },
        {
            "name": "业绩预告",
            "watch": "利润增速、订单能见度、毛利率、是否超一致预期。",
            "buy_expectation": "预告前趋势温和、估值未透支、板块资金回流时才可计划。",
            "sell_news_risk": "业绩落地但股价放量滞涨，按买预期卖事实处理。",
            "system_rule": "逻辑兑现不等于继续买，先看增量信息。"
        },
        {
            "name": "政策会议/产业政策",
            "watch": "政策是否有预算、订单、牌照、试点城市或明确时间表。",
            "buy_expectation": "政策前只看中军和趋势核心，不做后排纯题材。",
            "sell_news_risk": "只有口号没有落地路径，冲高后容易退潮。",
            "system_rule": "轮动题材只给小仓，不按主线仓位处理。"
        },
        {
            "name": "半导体涨价/缺货",
            "watch": "涨价品类、持续周期、库存位置、公司是否真的受益。",
            "buy_expectation": "必须看到板块资金由流出转回流，且中军放量反包。",
            "sell_news_risk": "若涨价已被广泛讨论且股价已大涨，按晚周期处理。",
            "system_rule": "运行 Lynch 周期检查：我是早买，还是在热闹时接最后一棒。"
        },
        {
            "name": "产品发布/客户认证",
            "watch": "客户级别、认证是否转订单、收入弹性、替代难度。",
            "buy_expectation": "平台突破 + 放量 + 大客户逻辑可证伪时才纳入。",
            "sell_news_risk": "发布只有概念没有订单，按题材兑现风险处理。",
            "system_rule": "原始买入理由必须能被验证，也必须能被证伪。"
        },
    ]


def build_post_review_score(themes, market_gate, candidate_pool, alerts, freshness):
    top_theme = themes[0] if themes else {"name": "无", "flow_score_100m_yuan": 0}
    dimensions = [
        {
            "name": "主线识别",
            "score": 85 if top_theme["flow_score_100m_yuan"] > 250 else 65,
            "note": f"最强主线为 {top_theme['name']}，资金强度 {top_theme['flow_score_100m_yuan']} 亿。"
        },
        {
            "name": "市场门",
            "score": 80 if market_gate["status"] == "市场门打开" else (60 if market_gate["status"] == "市场门半开" else 45),
            "note": market_gate["advice"]
        },
        {
            "name": "候选质量",
            "score": min(90, 50 + len(candidate_pool["core"]) * 12 + len(candidate_pool["watch"])),
            "note": f"核心候选 {len(candidate_pool['core'])} 个，观察池 {len(candidate_pool['watch'])} 个。"
        },
        {
            "name": "风险纪律",
            "score": 70 if len(alerts) <= 2 else 55,
            "note": f"系统预警 {len(alerts)} 条，按预警降级仓位。"
        },
        {
            "name": "数据可靠",
            "score": 90 if freshness["is_current"] else 50,
            "note": freshness["message"]
        },
    ]
    total = round(sum(item["score"] for item in dimensions) / len(dimensions), 1)
    if total >= 75:
        conclusion = "系统状态可用，但仍必须等买点确认。"
    elif total >= 60:
        conclusion = "系统可用于观察，交易动作需要降级。"
    else:
        conclusion = "系统只适合复盘，不适合直接开新仓。"
    return {"total": total, "conclusion": conclusion, "dimensions": dimensions}


SYSTEM_RULES = [
    {
        "title": "数据先验",
        "tag": "必须核验",
        "items": [
            "先确认东方财富 BK 口径和交易日期，再进入判断。",
            "板块资金、个股地位、价格结构必须互相印证。",
            "数据不完整时，允许今日无核心候选。",
        ],
    },
    {
        "title": "研究边界",
        "tag": "她模型",
        "items": [
            "只做观察 -> 信号 -> 评估，不把观察直接当交易指令。",
            "核心候选最多 1-3 个，观察池 5-8 个。",
            "角色必须说清：龙头、中军、补涨、趋势核心或只观察。",
        ],
    },
    {
        "title": "买点规则",
        "tag": "只买确认",
        "items": [
            "只买有效平台突破、上升趋势、放量确认。",
            "情绪高潮后不追一致，优先等分歧后的回封或承接。",
            "大盘市场门未打开时，不因为个股热闹而加大风险。",
        ],
    },
    {
        "title": "仓位规则",
        "tag": "v5/v6",
        "items": [
            "单票红线不超过 30%，同一逻辑不能伪装成多只票分散。",
            "最多 3 批建仓，越往上加仓越小。",
            "按波动和 R 计算风险，不按情绪决定仓位。",
        ],
    },
    {
        "title": "卖出与 T",
        "tag": "保护赢家",
        "items": [
            "核心仓不随意做 T，防止卖飞强趋势。",
            "如果做 T，只允许先买后卖，不做先卖后买。",
            "真正卖出条件：逻辑兑现、趋势破坏、价格止损或更好机会。",
        ],
    },
    {
        "title": "禁止动作",
        "tag": "纪律红线",
        "items": [
            "不追情绪高点，不抄下跌趋势的便宜。",
            "不无限补仓，不在止损后用幻想替代规则。",
            "兴奋、恐惧、报复、想赚回来时，不开新仓。",
        ],
    },
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-date", default="2026-07-03", help="Verified source data date")
    parser.add_argument("--judge-date", default=(date.today() + timedelta(days=1)).isoformat())
    args = parser.parse_args()

    industry = fetch("m:90+s:4")
    concept = fetch("m:90+t:3")

    theme_reports = []
    for theme in THEMES:
        rows, score, strongest, weakest = collect_theme(theme, industry, concept)
        stage, expectation = stage_for(theme["name"], score, strongest)
        trade_plan = trade_plan_for(theme["name"], score, stage)
        theme_reports.append(
            {
                "name": theme["name"],
                "role": theme["role"],
                "flow_score_100m_yuan": score,
                "emotion_stage": stage,
                "expectation": expectation,
                "trade_plan": trade_plan,
                "watch_points": strongest,
                "risk_points": weakest,
            }
        )

    sorted_themes = sorted(theme_reports, key=lambda x: x["flow_score_100m_yuan"], reverse=True)
    market_gate = build_market_gate(industry, concept)
    candidate_pool = build_candidate_pool()
    emotion_dashboard = build_emotion_dashboard(sorted_themes, industry, concept)
    alerts = build_alerts(sorted_themes, market_gate, candidate_pool)
    freshness = build_data_freshness(args.data_date, date.today().isoformat())
    top_summary = build_top_summary(sorted_themes, market_gate, freshness)
    execution_checklist = build_execution_checklist(sorted_themes, market_gate, freshness)
    sector_linkage = build_sector_linkage(candidate_pool)
    event_templates = build_event_templates()
    post_review_score = build_post_review_score(sorted_themes, market_gate, candidate_pool, alerts, freshness)

    report = {
        "generated_at": date.today().isoformat(),
        "source_data_date": args.data_date,
        "judge_date": args.judge_date,
        "data_freshness": freshness,
        "top_summary": top_summary,
        "execution_checklist": execution_checklist,
        "sector_linkage": sector_linkage,
        "event_templates": event_templates,
        "post_review_score": post_review_score,
        "market_view": {
            "summary": "主线资金集中在机器人、汽车链和新能源车；半导体/芯片链大幅流出。下一交易日优先观察主线分歧后的承接，而不是追一致高潮。",
            "cycle_position": "机器人高潮后分歧，汽车链承接，低空/军工轮动，贵金属防守，半导体弱修复观察。",
            "buy_point_rule": "只买分歧后的确认：前排回封、分时均线承接、放量突破、板块资金共振。不开盘追一致，不买后排情绪。",
        },
        "systems": {
            "research_system": "她模型/stock_research_lab：观察 -> 信号 -> 评估；核心候选最多 1-3 个，允许今日无核心候选。",
            "risk_system": "v5/v6：市场门、相关性、单票不超过 30%、最多 3 批、价格止损/逻辑止损、避免冲动 T。",
            "rules": SYSTEM_RULES,
        },
        "market_gate": market_gate,
        "candidate_pool": candidate_pool,
        "emotion_dashboard": emotion_dashboard,
        "alerts": alerts,
        "themes": sorted_themes,
        "industry_top10": [row_to_public(row, i) for i, row in enumerate(industry[:10], 1)],
        "concept_top10": [row_to_public(row, i) for i, row in enumerate(concept[:10], 1)],
        "industry_all": [row_to_public(row, i) for i, row in enumerate(industry, 1)],
        "concept_all": [row_to_public(row, i) for i, row in enumerate(concept, 1)],
        "verification": make_verification(industry, concept),
        "disclaimer": "公开研究页面仅用于复盘和交易计划，不构成投资建议或收益承诺。",
    }

    SITE_DATA.mkdir(parents=True, exist_ok=True)
    out = SITE_DATA / "daily-report.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    data_js = SITE_ROOT / "report-data.js"
    data_js.write_text(
        "window.DAILY_REPORT = "
        + json.dumps(report, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    print(out)


if __name__ == "__main__":
    main()
