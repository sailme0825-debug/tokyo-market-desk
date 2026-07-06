const BK_API = "https://data.eastmoney.com/dataapi/bkzj/getbkzj";
const TENCENT_QUOTE = "https://qt.gtimg.cn/q=";

const THEMES = [
  {
    name: "机器人/人形机器人",
    aliases: ["机器人概念", "人形机器人", "机器人执行器", "减速器", "工业母机"],
    role: "主线题材",
  },
  {
    name: "汽车零部件/新能源车/特斯拉链",
    aliases: ["汽车零部件", "新能源车", "特斯拉概念", "华为汽车", "乘用车"],
    role: "承接主线",
  },
  {
    name: "低空经济/军工/商业航天",
    aliases: ["低空经济", "军工", "军民融合", "航天装备Ⅱ", "航海装备Ⅱ"],
    role: "轮动支线",
  },
  {
    name: "贵金属",
    aliases: ["贵金属"],
    role: "防守支线",
  },
  {
    name: "半导体/芯片/CPO",
    aliases: ["半导体", "半导体概念", "国产芯片", "存储芯片", "CPO概念", "光通信模块", "通信设备"],
    role: "修复观察",
  },
];

const INDEX_UNIVERSE = [
  { symbol: "sh000001", name: "上证指数" },
  { symbol: "sz399001", name: "深证成指" },
  { symbol: "sz399006", name: "创业板指" },
  { symbol: "sh000300", name: "沪深300" },
];

const CANDIDATE_UNIVERSE = [
  { code: "002050", symbol: "sz002050", name: "三花智控", theme: "机器人/汽车零部件链", role: "中军/趋势核心" },
  { code: "601689", symbol: "sh601689", name: "拓普集团", theme: "机器人/汽车零部件链", role: "中军/趋势核心" },
  { code: "688017", symbol: "sh688017", name: "绿的谐波", theme: "机器人/人形机器人", role: "弹性核心" },
  { code: "603728", symbol: "sh603728", name: "鸣志电器", theme: "机器人执行器", role: "弹性观察" },
  { code: "002472", symbol: "sz002472", name: "双环传动", theme: "减速器/汽车链", role: "趋势观察" },
  { code: "002085", symbol: "sz002085", name: "万丰奥威", theme: "低空经济/汽车链", role: "轮动核心" },
  { code: "000099", symbol: "sz000099", name: "中信海直", theme: "低空经济", role: "轮动观察" },
  { code: "601899", symbol: "sh601899", name: "紫金矿业", theme: "贵金属/资源", role: "防守中军" },
  { code: "600547", symbol: "sh600547", name: "山东黄金", theme: "贵金属", role: "防守观察" },
  { code: "300502", symbol: "sz300502", name: "新易盛", theme: "CPO/AI硬件", role: "修复观察" },
  { code: "300308", symbol: "sz300308", name: "中际旭创", theme: "CPO/AI硬件", role: "修复观察" },
  { code: "002463", symbol: "sz002463", name: "沪电股份", theme: "AI硬件/PCB", role: "趋势观察" },
  { code: "002916", symbol: "sz002916", name: "深南电路", theme: "AI硬件/PCB", role: "趋势观察" },
];

function toFloat(value) {
  if (value === "" || value === "-" || value === null || value === undefined) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function yi(value) {
  return Number((Number(value || 0) / 100000000).toFixed(2));
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
        Referer: "https://data.eastmoney.com/bkzj/",
      },
    });
    if (!response.ok) throw new Error(`上游接口返回 ${response.status}`);
    const buffer = await response.arrayBuffer();
    return new TextDecoder(encoding).decode(buffer);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchBk(fsCode) {
  const params = new URLSearchParams({ key: "f62", code: fsCode });
  const raw = await httpGet(`${BK_API}?${params.toString()}`);
  return JSON.parse(raw).data?.diff || [];
}

async function fetchQuote(symbol) {
  const raw = await httpGet(TENCENT_QUOTE + symbol, "gbk");
  const match = raw.match(/="([\s\S]*)";?\s*$/);
  if (!match) return null;
  const values = match[1].split("~");
  if (values.length < 39) return null;
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
    amount_10000: toFloat(values[37]),
    turnover: toFloat(values[38]),
  };
}

function publicRow(row, rank) {
  return {
    rank,
    code: row.f12,
    name: row.f14,
    main_net_inflow_100m_yuan: yi(row.f62),
  };
}

function stageForFlow(flow) {
  if (flow >= 60) return "强流入";
  if (flow >= 20) return "温和流入";
  if (flow > 0) return "弱流入";
  if (flow <= -60) return "强流出";
  if (flow <= -20) return "明显流出";
  return "震荡";
}

function intradayRuleForRawSector(name, flow, rank, source) {
  if (flow <= -20) return "资金流出，先按退潮/分歧处理，不做主动买点。";
  if (rank <= 3 && flow >= 20) return `${source}前排，先找板块中军和核心股承接，避免追后排。`;
  if (flow > 0) return "有资金回流，但要等价格结构和个股地位确认。";
  if (/贵金属|银行|电力|煤炭|公用/.test(name)) return "偏防守属性，适合观察市场弱势时的资金避险。";
  return "资金强度一般，降低优先级，只作轮动观察。";
}

function rawSectorRows(rows, source, limit) {
  return rows.slice(0, limit).map((row, index) => {
    const flow = yi(row.f62);
    return {
      rank: index + 1,
      code: row.f12,
      name: row.f14,
      source,
      role: source === "行业" ? "行业资金" : "概念资金",
      flow_score_100m_yuan: flow,
      emotion_stage: stageForFlow(flow),
      intraday_rule: intradayRuleForRawSector(row.f14, flow, index + 1, source),
    };
  });
}

function collectTheme(theme, industry, concept) {
  const rows = [];
  for (const row of [...industry, ...concept]) {
    if (theme.aliases.includes(row.f14)) {
      rows.push({
        code: row.f12,
        name: row.f14,
        flow: yi(row.f62),
      });
    }
  }
  const flow = Number(rows.reduce((sum, row) => sum + row.flow, 0).toFixed(2));
  const strongest = rows.sort((a, b) => b.flow - a.flow).slice(0, 3);
  let stage = "观察";
  if (flow >= 250) stage = "高潮/强分歧";
  else if (flow >= 120) stage = "发酵/加速";
  else if (flow >= 30) stage = "启动/修复";
  else if (flow < -60) stage = "退潮";
  return {
    name: theme.name,
    role: theme.role,
    flow_score_100m_yuan: flow,
    emotion_stage: stage,
    strongest,
    intraday_rule: ruleForTheme(theme.name, flow, stage),
  };
}

function ruleForTheme(name, flow, stage) {
  if (stage === "退潮") return "资金转负，不做主动买点；已有仓位只看修复和失效线。";
  if (stage.includes("高潮")) return "只等强分歧后的核心承接，不追一致加速。";
  if (name.includes("机器人")) return "主线优先，但必须前排换手确认，后排冲高不追。";
  if (name.includes("汽车")) return "适合作承接方向，优先看中军能否强于机器人分歧。";
  if (name.includes("半导体")) return "修复方向只看放量反包和中军带队，不能提前当新主线。";
  return "只做资金和价格共振，轮动方向降低仓位。";
}

function judgeGate(indices, industry, concept, themes) {
  const positiveIndexCount = indices.filter((row) => (row.pct || 0) >= 0).length;
  const positiveIndustryCount = industry.filter((row) => (row.f62 || 0) > 0).length;
  const positiveConceptCount = concept.filter((row) => (row.f62 || 0) > 0).length;
  const strongest = themes[0];

  let status = "收紧";
  let action = "不主动开新仓，只做已有持仓风控和确认后的核心观察。";
  if (positiveIndexCount >= 3 && strongest?.flow_score_100m_yuan >= 100) {
    status = "打开";
    action = "可做计划内买点：核心分歧承接、放量突破、回踩不破三类。";
  } else if (positiveIndexCount >= 2 || strongest?.flow_score_100m_yuan >= 80) {
    status = "半开";
    action = "只允许小仓试错，不追高，不把轮动后排当核心。";
  }

  return {
    status,
    action,
    positive_index_count: positiveIndexCount,
    positive_industry_count: positiveIndustryCount,
    positive_concept_count: positiveConceptCount,
    strongest_theme: strongest?.name || "--",
    strongest_flow: strongest?.flow_score_100m_yuan || 0,
  };
}

function candidateAction(quote) {
  const pct = quote?.pct || 0;
  const turnover = quote?.turnover || 0;
  if (pct >= 7) return "高位一致，按系统不追，只看开板承接或次日分歧。";
  if (pct >= 3 && turnover >= 3) return "强势换手，若所属板块同步走强，可进入观察买点。";
  if (pct > 0) return "红盘但未充分确认，等分时回踩不破或放量突破。";
  if (pct <= -3) return "弱势/分歧中，先看失效线，不用下跌当低吸理由。";
  return "中性震荡，等待板块资金和价格方向选择。";
}

async function buildLiveReport() {
  const [industry, concept, indexQuotes, candidateQuotes] = await Promise.all([
    fetchBk("m:90+s:4"),
    fetchBk("m:90+t:3"),
    Promise.all(INDEX_UNIVERSE.map(async (item) => ({ ...item, quote: await fetchQuote(item.symbol) }))),
    Promise.all(CANDIDATE_UNIVERSE.map(async (item) => ({ ...item, quote: await fetchQuote(item.symbol) }))),
  ]);

  const themes = THEMES.map((theme) => collectTheme(theme, industry, concept)).sort((a, b) => b.flow_score_100m_yuan - a.flow_score_100m_yuan);
  const indices = indexQuotes.map((item) => ({
    name: item.name,
    price: item.quote?.price ?? null,
    pct: item.quote?.pct ?? null,
    status: (item.quote?.pct || 0) >= 0 ? "红盘" : "绿盘",
  }));
  const gate = judgeGate(indices, industry, concept, themes);
  const candidates = candidateQuotes
    .filter((item) => item.quote)
    .map((item) => ({
      code: item.code,
      name: item.name,
      theme: item.theme,
      role: item.role,
      price: item.quote.price,
      pct: item.quote.pct,
      turnover: item.quote.turnover,
      amount_100m_yuan: item.quote.amount_10000 ? Number((item.quote.amount_10000 / 10000).toFixed(2)) : null,
      action: candidateAction(item.quote),
    }))
    .sort((a, b) => (b.pct || 0) - (a.pct || 0))
    .slice(0, 8);

  const generatedAt = beijingTimestamp();
  return {
    generated_at: generatedAt,
    trading_date: generatedAt.slice(0, 10),
    data_status: "当日实时",
    refresh_seconds: 60,
    data_sources: ["东方财富 BK 板块资金", "腾讯实时行情"],
    gate,
    indices,
    themes,
    sector_rankings: {
      system: themes,
      industry: rawSectorRows(industry, "行业", 12),
      concept: rawSectorRows(concept, "概念", 16),
    },
    candidates,
    industry_top5: industry.slice(0, 12).map(publicRow),
    concept_top5: concept.slice(0, 16).map(publicRow),
    system_boundary: "盘中实时判断只做条件过滤和风险提示，不给无条件买卖指令。",
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

  try {
    res.end(JSON.stringify(await buildLiveReport()));
  } catch (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: error.message || "实时判断失败" }));
  }
}

module.exports = handler;
module.exports._private = { buildLiveReport };
