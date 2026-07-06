const EASTMONEY_SUGGEST = "https://searchapi.eastmoney.com/api/suggest/get";
const TENCENT_QUOTE = "https://qt.gtimg.cn/q=";
const TENCENT_KLINE = "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get";

const SECTOR_RULES = [
  {
    sector: "机器人/人形机器人",
    keywords: ["拓普", "三花", "绿的谐波", "鸣志", "中大力德", "双环", "埃斯顿", "汇川", "柯力"],
  },
  {
    sector: "汽车零部件/新能源车/特斯拉链",
    keywords: ["拓普", "三花", "双环", "万丰", "赛力斯", "均胜", "旭升", "银轮"],
  },
  {
    sector: "低空经济/军工/商业航天",
    keywords: ["中信海直", "万丰", "宗申", "航天", "中航", "航发", "洪都"],
  },
  {
    sector: "贵金属",
    keywords: ["紫金", "山东黄金", "赤峰黄金", "中金黄金", "湖南黄金"],
  },
  {
    sector: "半导体/芯片/CPO",
    keywords: ["寒武", "海光", "中际", "新易盛", "沪电", "深南", "佰维", "兆易", "中芯"],
  },
];

function toFloat(value) {
  if (value === "" || value === "-" || value === null || value === undefined) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function avg(values) {
  const clean = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null;
}

function pct(a, b) {
  if (!a || !b) return null;
  return Number(((a / b - 1) * 100).toFixed(2));
}

function round(value, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function beijingTimestamp() {
  return `${new Date().toLocaleString("sv-SE", { timeZone: "Asia/Shanghai", hour12: false }).replace(" ", "T")}+08:00`;
}

async function httpGet(url, encoding = "utf-8") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://quote.eastmoney.com/",
      },
    });
    if (!response.ok) throw new Error(`上游接口返回 ${response.status}`);
    const buffer = await response.arrayBuffer();
    return new TextDecoder(encoding).decode(buffer);
  } finally {
    clearTimeout(timeout);
  }
}

async function eastmoneySearch(query) {
  const params = new URLSearchParams({
    input: query,
    type: "14",
    token: "D43BF722C8E33BDC906FB84D85E326E8",
    count: "8",
  });
  const raw = await httpGet(`${EASTMONEY_SUGGEST}?${params.toString()}`);
  const data = JSON.parse(raw).QuotationCodeTable?.Data || [];
  const aStocks = data.filter((item) => item.Classify === "AStock");
  return aStocks[0] || data[0] || null;
}

function symbolFromItem(item) {
  const code = item.Code;
  const market = item.MktNum || String(item.QuoteID || "").split(".")[0];
  const prefix = market === "1" || code.startsWith("6") ? "sh" : "sz";
  return `${prefix}${code}`;
}

async function fetchQuote(symbol) {
  const raw = await httpGet(TENCENT_QUOTE + symbol, "gbk");
  const match = raw.match(/="([\s\S]*)";?\s*$/);
  if (!match) throw new Error("腾讯行情返回格式异常");
  const values = match[1].split("~");
  return {
    name: values[1],
    code: values[2],
    price: toFloat(values[3]),
    prev_close: toFloat(values[4]),
    open: toFloat(values[5]),
    datetime: values[30],
    change: toFloat(values[31]),
    pct: toFloat(values[32]),
    high: toFloat(values[33]),
    low: toFloat(values[34]),
    volume_lot: toFloat(values[36]),
    amount_10000: toFloat(values[37]),
    turnover: toFloat(values[38]),
    pe: toFloat(values[39]),
    market_cap_100m: toFloat(values[45]),
  };
}

async function fetchKlines(symbol, limit = 120) {
  const params = new URLSearchParams({ param: `${symbol},day,,,${limit},qfq` });
  const raw = await httpGet(`${TENCENT_KLINE}?${params.toString()}`);
  const data = JSON.parse(raw).data?.[symbol] || {};
  const rows = data.qfqday || data.day || [];
  return rows.map((row) => ({
    date: row[0],
    open: toFloat(row[1]),
    close: toFloat(row[2]),
    high: toFloat(row[3]),
    low: toFloat(row[4]),
    volume: toFloat(row[5]),
  }));
}

function enrichTechnical(klines, quote) {
  const closes = klines.map((row) => row.close);
  const highs = klines.map((row) => row.high);
  const lows = klines.map((row) => row.low);
  const vols = klines.map((row) => row.volume);
  const close = quote.price || closes.at(-1);
  const ma5 = avg(closes.slice(-5));
  const ma10 = avg(closes.slice(-10));
  const ma20 = avg(closes.slice(-20));
  const ma60 = avg(closes.slice(-60));
  const vol5 = vols.length >= 6 ? avg(vols.slice(-6, -1)) : avg(vols.slice(0, -1));
  const volRatio = vols.length && vol5 ? round(vols.at(-1) / vol5, 2) : null;
  const prior20High = highs.length >= 21 ? Math.max(...highs.slice(-21, -1)) : highs.length > 1 ? Math.max(...highs.slice(0, -1)) : null;
  const prior20Low = lows.length >= 21 ? Math.min(...lows.slice(-21, -1)) : lows.length > 1 ? Math.min(...lows.slice(0, -1)) : null;
  const breakout = Boolean(close && prior20High && close >= prior20High);
  const aboveMa = {
    ma5: Boolean(close && ma5 && close >= ma5),
    ma10: Boolean(close && ma10 && close >= ma10),
    ma20: Boolean(close && ma20 && close >= ma20),
    ma60: Boolean(close && ma60 && close >= ma60),
  };
  const trendScore = Object.values(aboveMa).filter(Boolean).length;
  let rangePosition = null;
  if (close && prior20High && prior20Low && prior20High > prior20Low) {
    rangePosition = round(((close - prior20Low) / (prior20High - prior20Low)) * 100, 1);
  }
  return {
    ma5: round(ma5),
    ma10: round(ma10),
    ma20: round(ma20),
    ma60: round(ma60),
    volume_ratio_5d: volRatio,
    prior20_high: round(prior20High),
    prior20_low: round(prior20Low),
    breakout_20d: breakout,
    above_ma: aboveMa,
    trend_score: trendScore,
    range_position_20d: rangePosition,
    pct_from_ma20: pct(close, ma20),
  };
}

function matchSectors(name) {
  const matches = [];
  for (const rule of SECTOR_RULES) {
    const hits = rule.keywords.filter((keyword) => name.includes(keyword));
    if (hits.length) matches.push({ sector: rule.sector, confidence: "关键词匹配", hits });
  }
  return matches;
}

function inferTheme(name) {
  const matches = matchSectors(name);
  if (!matches.length) return "待人工确认板块归属";
  if (matches.length === 1) return matches[0].sector;
  return matches.slice(0, 2).map((item) => item.sector).join(" / ");
}

function judgeSystems(stock, quote, tech) {
  const theme = inferTheme(stock.name);
  const sectorMatches = matchSectors(stock.name);
  const isStrongTrend = tech.trend_score >= 3;
  const isBreakout = tech.breakout_20d;
  const hasVolume = (tech.volume_ratio_5d || 0) >= 1.25;
  const isExtended = (tech.range_position_20d || 0) >= 92 || (tech.pct_from_ma20 || 0) >= 18;
  const isWeak = tech.trend_score <= 1;
  const hasValueAnchor = Boolean((quote.pe && quote.pe > 0 && quote.pe < 60) || (quote.market_cap_100m && quote.market_cap_100m >= 80));
  const hasEventProxy = sectorMatches.length > 0;
  const speculationWindow = isStrongTrend && hasVolume && !isExtended;

  let researchLevel = "观察池";
  let role = "等待确认";
  let researchSignal = "信号不完整，不能强行归为核心。";
  if (isBreakout && hasVolume && isStrongTrend) {
    researchLevel = "核心候选";
    role = "趋势核心/中军候选";
    researchSignal = "价格突破、均线多头、成交放大，满足她模型的信号层条件；还需核对事件催化是否真实。";
  } else if (isStrongTrend) {
    role = "趋势观察";
    researchSignal = "趋势结构尚可，但还需要事件催化、板块资金或突破确认。";
  } else if (isWeak) {
    researchLevel = "不进入核心";
    role = "弱势/修复观察";
    researchSignal = "价格结构偏弱，不符合核心候选。";
  }

  let actionBias = "等待确认";
  let buyZone = "等待事件催化明确、放量突破平台、重新站上关键均线，或板块资金共振。";
  if (researchLevel === "核心候选" && !isExtended) {
    actionBias = "可计划，不追高";
    buyZone = "事件逻辑未证伪时，回踩分时均线/5日线不破，或突破后换手回封。";
  } else if (researchLevel === "核心候选" && isExtended) {
    actionBias = "强但偏高潮";
    buyZone = "只等强分歧后的承接，并重新核对事件预期是否仍有增量。";
  } else if (researchLevel !== "观察池") {
    actionBias = "不主动买";
    buyZone = "除非重新修复趋势和资金，否则不纳入买点。";
  }

  const sellZone = [
    "跌破买入依据对应的关键均线或平台，且无法收回。",
    "放量冲高回落，次日不能弱转强。",
    "板块角色从核心降级为跟风，或原始逻辑被证伪。",
  ];
  const invalidation = isWeak ? "当前已经不满足趋势核心条件，需先修复再评估。" : "价格跌回 20 日平台下方、成交放大但不涨、或所属主线资金退潮。";
  const modeSummary = hasEventProxy
    ? "已识别到产业/题材线索，但仍需人工核对具体事件、时间表、受益路径和预期差。"
    : "暂未自动识别明确事件线索，只能先按观察池处理，不能仅凭走势进入主仓。";

  let maxPosition = "试错仓 5%-10%";
  if (researchLevel === "核心候选" && !isExtended) {
    maxPosition = "计划仓 10%-20%，确认后再分批；单票绝不超过 30%";
  } else if (researchLevel === "核心候选" && isExtended) {
    maxPosition = "只允许轻仓观察或等分歧，避免情绪高点上仓";
  }

  const riskFlags = [];
  if (isExtended) riskFlags.push("短线涨幅/区间位置偏高，容易高开兑现。");
  if (!hasVolume) riskFlags.push("成交量未明显放大，突破有效性不足。");
  if (theme === "待人工确认板块归属") riskFlags.push("板块归属未自动确认，需人工核对资金主线。");
  if (quote.pct && quote.pct >= 8) riskFlags.push("当日涨幅较大，按系统不追一致高潮。");
  if (!riskFlags.length) riskFlags.push("主要风险来自板块退潮、突破失败和仓位过大。");

  let grade = { level: "C", label: "只看不买", summary: "信号不完整，只能等待确认。" };
  if (researchLevel === "核心候选" && !isExtended) {
    grade = { level: "A", label: "可进入核心候选", summary: "趋势、量能和突破较完整，但仍需等买点确认。" };
  } else if (researchLevel === "核心候选") {
    grade = { level: "B", label: "强势观察", summary: "强但位置偏高，等分歧承接，不追一致。" };
  } else if (researchLevel === "观察池" && isStrongTrend) {
    grade = { level: "B", label: "观察池", summary: "趋势尚可，等待板块资金或突破确认。" };
  } else if (researchLevel !== "观察池") {
    grade = { level: "D", label: "回避", summary: "不满足系统条件，先不纳入买点。" };
  }

  return {
    theme_guess: theme,
    sector_matches: sectorMatches,
    grade,
    detail: {
      role_audit: [`板块归属：${theme}`, `系统角色：${role}`, `研究层级：${researchLevel}`, `动作倾向：${actionBias}`],
      trigger_status: [
        { name: "趋势", status: isStrongTrend ? "通过" : "不足", note: `趋势分 ${tech.trend_score}/4` },
        { name: "量能", status: hasVolume ? "通过" : "不足", note: `5日量比 ${tech.volume_ratio_5d || "不足"}` },
        { name: "突破", status: isBreakout ? "通过" : "未触发", note: isBreakout ? "20日突破" : "未突破20日高点" },
        { name: "位置", status: isExtended ? "偏高" : "可评估", note: `20日区间位置 ${tech.range_position_20d ?? "不足"}%` },
      ],
      next_actions: [buyZone, "若买点未出现，保持观察池，不预判成交。", "若市场门收紧，同等级个股自动降一级处理。"],
      do_not_do: ["不因单日大涨直接追高。", "不把观察池当核心仓。", "不在失效后用补仓替代止损。"],
    },
    event_value_speculation: {
      label: "事件驱动价值投机",
      summary: modeSummary,
      checks: [
        {
          name: "事件催化",
          status: hasEventProxy ? "待核实" : "不足",
          note: hasEventProxy ? `自动匹配：${theme}` : "未识别政策、订单、业绩、产品或涨价线索。",
        },
        {
          name: "价值锚",
          status: hasValueAnchor ? "可评估" : "需补充",
          note: `PE ${quote.pe ?? "--"}，总市值 ${quote.market_cap_100m ?? "--"} 亿；价值锚必须来自业绩弹性或产业地位。`,
        },
        {
          name: "投机窗口",
          status: speculationWindow ? "打开" : isExtended ? "偏晚" : "等待",
          note: speculationWindow ? "趋势、量能、位置较适合计划交易。" : "还需要量价确认或等待分歧承接。",
        },
        {
          name: "退出证伪",
          status: "必须预设",
          note: "事件落地不超预期、价值锚证伪、跌回平台或板块退潮即降级。",
        },
      ],
    },
    research_system: {
      level: researchLevel,
      role,
      signal: researchSignal,
      checks: [
        `趋势分 ${tech.trend_score}/4`,
        `20日突破：${isBreakout ? "是" : "否"}`,
        `5日量比：${tech.volume_ratio_5d || "不足"}`,
        `20日区间位置：${tech.range_position_20d ?? "不足"}%`,
      ],
    },
    risk_system: {
      action_bias: actionBias,
      buy_zone: buyZone,
      sell_zone: sellZone,
      invalidation,
      position: maxPosition,
      risk_flags: riskFlags,
    },
  };
}

async function buildReport(query) {
  const item = await eastmoneySearch(query);
  if (!item) throw new Error("没有找到 A 股匹配结果");
  const symbol = symbolFromItem(item);
  const quote = await fetchQuote(symbol);
  const klines = await fetchKlines(symbol);
  const tech = enrichTechnical(klines, quote);
  const name = quote.name || item.Name;
  const stock = {
    name,
    code: quote.code || item.Code,
    symbol,
    quote_id: item.QuoteID,
    market: item.SecurityTypeName,
    sector_matches: matchSectors(name),
  };
  return {
    query,
    generated_at: beijingTimestamp(),
    data_sources: ["东方财富搜索接口：名称/代码解析", "腾讯行情接口：价格与前复权日K"],
    stock,
    quote,
    technical: tech,
    judgment: judgeSystems(stock, quote, tech),
    disclaimer: "这是按用户交易系统生成的研究与风控判断，不构成投资建议。",
  };
}

async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "method not allowed" }));
    return;
  }

  const url = new URL(req.url || "/api/stock", "http://localhost");
  if (url.pathname === "/api/health") {
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  const query = String(req.query?.q || url.searchParams.get("q") || "").trim();
  if (!query) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "请输入股票代码或名称" }));
    return;
  }

  try {
    const payload = await buildReport(query);
    res.end(JSON.stringify(payload));
  } catch (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: error.message || "检索失败" }));
  }
}

module.exports = handler;
module.exports._private = { buildReport };
