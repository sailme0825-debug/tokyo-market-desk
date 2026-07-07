const BK_API = "https://data.eastmoney.com/dataapi/bkzj/getbkzj";
const TENCENT_QUOTE = "https://qt.gtimg.cn/q=";
const UPSTREAM_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 60000;
let cachedLiveReport = null;
let cachedLiveAt = 0;

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
  { symbol: "sh000001", name: "上证指数", group: "A股", provider: "tencent", gate: true },
  { symbol: "sz399001", name: "深证成指", group: "A股", provider: "tencent", gate: true },
  { symbol: "sz399006", name: "创业板指", group: "A股", provider: "tencent", gate: true },
  { symbol: "sh000300", name: "沪深300", group: "A股", provider: "tencent", gate: true },
  { symbol: "sh000688", name: "科创50", group: "A股", provider: "tencent", gate: true },
  { symbol: "bj899050", name: "北证50", group: "A股", provider: "tencent", gate: true },
  { symbol: "b_NKY", name: "日经225", group: "亚太", provider: "sina_global", gate: false },
  { symbol: "b_KOSPI", name: "韩国KOSPI", group: "亚太", provider: "sina_global", gate: false },
  { symbol: "usDJI", name: "道琼斯", group: "美股", provider: "tencent", gate: false },
  { symbol: "usIXIC", name: "纳斯达克", group: "美股", provider: "tencent", gate: false },
  { symbol: "usINX", name: "标普500", group: "美股", provider: "tencent", gate: false },
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
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
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
  return quoteFromValues(values);
}

function quoteFromValues(values) {
  if (!values || values.length < 39) return null;
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

async function fetchQuotes(symbols) {
  const unique = [...new Set(symbols.filter(Boolean))];
  const quotes = new Map();
  for (let index = 0; index < unique.length; index += 80) {
    const chunk = unique.slice(index, index + 80);
    const raw = await httpGet(TENCENT_QUOTE + chunk.join(","), "gbk");
    raw.split(";\n").forEach((part) => {
      if (!part.includes('="')) return;
      const values = part.split('="', 2)[1].replace(/";?\s*$/, "").split("~");
      const quote = quoteFromValues(values);
      if (quote?.code) quotes.set(quote.code, quote);
    });
  }
  return quotes;
}

async function fetchSinaGlobalQuote(symbol) {
  const response = await fetch(`https://hq.sinajs.cn/list=${symbol}`, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: "https://finance.sina.com.cn/",
    },
  });
  if (!response.ok) throw new Error(`新浪环球市场返回 ${response.status}`);
  const raw = new TextDecoder("gbk").decode(await response.arrayBuffer());
  const match = raw.match(/="([^"]*)"/);
  if (!match || !match[1]) return null;
  const values = match[1].split(",");
  if (symbol.startsWith("b_")) {
    return {
      name: values[0],
      code: symbol,
      price: toFloat(values[1]),
      change: toFloat(values[2]),
      pct: toFloat(values[3]),
      datetime: `${values[6] || ""} ${values[5] || ""}`.trim(),
    };
  }
  return null;
}

async function fetchIndexQuote(item) {
  const quote = item.provider === "sina_global" ? await fetchSinaGlobalQuote(item.symbol) : await fetchQuote(item.symbol);
  return {
    ...item,
    quote,
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
  if (rank <= 3 && flow >= 20) return `${source}前排，先核对事件催化和价值锚，再找中军/核心股承接，避免追后排。`;
  if (flow > 0) return "有资金回流，但要等事件线索、价格结构和个股地位确认。";
  if (/贵金属|银行|电力|煤炭|公用/.test(name)) return "偏防守属性，适合观察市场弱势时的资金避险。";
  return "资金强度一般，降低优先级，只作轮动观察。";
}

function rawSectorRows(rows, source) {
  return rows.map((row, index) => {
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

function isNoisySector(name) {
  return /融资融券|富时罗素|标准普尔|深股通|沪股通|昨日|预亏预减|ST股|转债|机构重仓|证金持股|基金重仓|HS300|MSCI|大盘价值|小盘|红利股|风格|破净|价值股|高股息|低价股|反转股|绩优股|一季报|三季报|年报|预增|预减|扭亏|GDR|QFII|社保|养老金|参股|中特估|超级品牌|其他|综合/.test(name);
}

function isDefensiveSector(name) {
  return /贵金属|银行|电力|煤炭|公用|保险|红利|高股息/.test(name);
}

function inferMainlineRole(name, flow, phase, source) {
  if (isDefensiveSector(name)) return "防守主线";
  if (flow <= -20 || phase === "退潮") return "退潮观察";
  if (flow >= 20 && ["发酵", "加速", "高潮"].includes(phase)) return source === "概念" ? "题材主线" : "行业主线";
  if (flow >= 8 && phase === "启动") return source === "概念" ? "题材分支" : "行业分支";
  if (flow >= 3) return "主线观察";
  return "分歧观察";
}

function mainlineScore(row) {
  if (isNoisySector(row.name)) return -9999;
  const flow = Number(row.flow_score_100m_yuan ?? row.flow ?? 0);
  const phaseBonus = {
    高潮: 18,
    加速: 22,
    发酵: 24,
    启动: 12,
    修复: 8,
    分歧: -8,
    退潮: -35,
  }[row.phase] || 0;
  const sourceBonus = row.source === "概念" ? 6 : 0;
  const defensePenalty = isDefensiveSector(row.name) ? 18 : 0;
  const broadPenalty = /Ⅱ/.test(row.name) ? 4 : 0;
  const rankBonus = Math.max(0, 18 - Math.min(row.rank || 99, 18));
  return flow * 1.15 + phaseBonus + sourceBonus + rankBonus - defensePenalty - broadPenalty;
}

function buildDynamicMainlines(industryRows, conceptRows) {
  const allRows = [...industryRows, ...conceptRows].map((row) => {
    const phase = cyclePhaseForSector(row.name, row.flow_score_100m_yuan, row.source);
    const role = inferMainlineRole(row.name, row.flow_score_100m_yuan, phase, row.source);
    const score = mainlineScore({ ...row, phase });
    return {
      ...row,
      phase,
      emotion_stage: phase,
      role,
      score: Number(score.toFixed(1)),
      is_system_mainline: score >= 8 && row.flow_score_100m_yuan > 0 && !isNoisySector(row.name) && !["防守主线", "退潮观察", "分歧观察"].includes(role),
      intraday_rule: `${role}：${cycleRuleForPhase(phase)}`,
    };
  });
  const selected = allRows
    .filter((row) => row.is_system_mainline)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);
  const fallback = allRows
    .filter((row) => !isNoisySector(row.name))
    .sort((a, b) => b.score - a.score)
    .slice(0, 18);
  return selected.length ? selected : fallback;
}

function cyclePhaseForSector(name, flow, source) {
  if (/贵金属|银行|电力|煤炭|公用|保险/.test(name) && flow > 0) return "修复";
  if (flow >= 150) return "高潮";
  if (flow >= 60) return "加速";
  if (flow >= 20) return "发酵";
  if (flow > 0) return "启动";
  if (flow > -20) return "分歧";
  return "退潮";
}

function cycleRuleForPhase(phase) {
  const rules = {
    启动: "只做观察和首批中军确认，先核对事件催化与价值锚，不能提前重仓。",
    发酵: "开始筛龙头和中军，买点必须是事件预期差 + 分歧承接或放量突破。",
    加速: "只给前排核心，后排不追，仓位不再扩张。",
    高潮: "一致性过强，优先兑现和等待强分歧后的回封，事件落地前后防兑现。",
    分歧: "看事件逻辑是否未证伪、核心是否抗跌和回流，不用下跌本身当买点。",
    修复: "防守或修复阶段，只看中军承接，不按主线仓位处理。",
    退潮: "主动降级，停止新开仓，已有仓位按失效线处理。",
  };
  return rules[phase] || "等待资金与价格共振。";
}

function buildEmotionDashboardFromSectors(systemThemes, industryRows, conceptRows) {
  const order = ["启动", "发酵", "加速", "高潮", "分歧", "修复", "退潮"];
  const allSectors = [...industryRows, ...conceptRows].map((row) => {
    const phase = cyclePhaseForSector(row.name, row.flow_score_100m_yuan, row.source);
    return {
      name: row.name,
      code: row.code,
      source: row.source,
      phase,
      phase_index: order.indexOf(phase),
      flow: row.flow_score_100m_yuan,
      rank: row.rank,
      rule: cycleRuleForPhase(phase),
    };
  });
  const systemItems = systemThemes.map((theme) => {
    const phase = cyclePhaseForSector(theme.name, theme.flow_score_100m_yuan, "系统");
    return {
      name: theme.name,
      source: "系统主线",
      phase,
      phase_index: order.indexOf(phase),
      flow: theme.flow_score_100m_yuan,
      rule: theme.intraday_rule,
    };
  });
  const phaseCounts = Object.fromEntries(order.map((phase) => [phase, 0]));
  for (const row of allSectors) phaseCounts[row.phase] += 1;
  const leaders = [...allSectors].sort((a, b) => b.flow - a.flow).slice(0, 10);
  const laggards = [...allSectors].sort((a, b) => a.flow - b.flow).slice(0, 10);
  const phaseGroups = order.map((phase) => ({
    phase,
    count: phaseCounts[phase],
    rule: cycleRuleForPhase(phase),
    sectors: allSectors.filter((row) => row.phase === phase).sort((a, b) => b.flow - a.flow),
  }));
  const activeCount = phaseCounts["启动"] + phaseCounts["发酵"] + phaseCounts["加速"] + phaseCounts["高潮"];
  const riskCount = phaseCounts["分歧"] + phaseCounts["退潮"];
  const totalCount = allSectors.length || 1;
  const heatScore = Math.round((activeCount / totalCount) * 100);
  let overallPhase = "分歧";
  if (phaseCounts["高潮"] >= 8 || phaseCounts["加速"] >= 20) overallPhase = "加速";
  else if (phaseCounts["发酵"] + phaseCounts["启动"] >= riskCount) overallPhase = "发酵";
  else if (phaseCounts["退潮"] > activeCount) overallPhase = "退潮";
  else if (phaseCounts["修复"] > phaseCounts["加速"]) overallPhase = "修复";
  return {
    order,
    summary: {
      overall_phase: overallPhase,
      heat_score: heatScore,
      total_count: allSectors.length,
      active_count: activeCount,
      risk_count: riskCount,
      strongest: leaders[0] || null,
      weakest: laggards[0] || null,
      action: cycleRuleForPhase(overallPhase),
    },
    phase_counts: phaseCounts,
    leaders,
    laggards,
    phase_groups: phaseGroups,
    items: systemItems,
  };
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
  const gateIndices = indices.filter((row) => row.gate !== false);
  const overseasIndices = indices.filter((row) => row.gate === false);
  const positiveIndexCount = gateIndices.filter((row) => (row.pct || 0) >= 0).length;
  const overseasPositiveCount = overseasIndices.filter((row) => (row.pct || 0) >= 0).length;
  const positiveIndustryCount = industry.filter((row) => (row.f62 || 0) > 0).length;
  const positiveConceptCount = concept.filter((row) => (row.f62 || 0) > 0).length;
  const strongest = themes[0];

  let status = "收紧";
  let action = "不主动开新仓，只做已有持仓风控和确认后的核心观察。";
  if (positiveIndexCount >= 4 && strongest?.flow_score_100m_yuan >= 100) {
    status = "打开";
    action = "可做计划内买点：核心分歧承接、放量突破、回踩不破三类。";
  } else if (positiveIndexCount >= 3 || strongest?.flow_score_100m_yuan >= 80) {
    status = "半开";
    action = "只允许小仓试错，不追高，不把轮动后排当核心。";
  }
  const overseasWind = overseasPositiveCount >= 4 ? "外盘偏强" : overseasPositiveCount >= 2 ? "外盘中性" : "外盘偏弱";

  return {
    status,
    action,
    positive_index_count: positiveIndexCount,
    index_total_count: gateIndices.length,
    overseas_positive_count: overseasPositiveCount,
    overseas_total_count: overseasIndices.length,
    overseas_wind: overseasWind,
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

function stockSymbolFromCode(code) {
  if (String(code || "").startsWith("6")) return `sh${code}`;
  if (String(code || "").startsWith("4") || String(code || "").startsWith("8")) return `bj${code}`;
  return `sz${code}`;
}

function staticLinkageGroups() {
  try {
    return require("../data/daily-report.json").sector_linkage || [];
  } catch {
    return [];
  }
}

function staticCandidatePool() {
  try {
    return require("../data/daily-report.json").candidate_pool?.all || [];
  } catch {
    return [];
  }
}

function matchLinkageGroup(theme, groups) {
  return groups.find((group) => group.theme === theme.name)
    || groups.find((group) => theme.name.includes(group.theme) || group.theme.includes(theme.name))
    || null;
}

async function buildDynamicCandidates(themes) {
  const groups = staticLinkageGroups();
  const rowsByCode = new Map();
  for (const theme of themes.slice(0, 16)) {
    const group = matchLinkageGroup(theme, groups);
    if (!group) continue;
    for (const stock of (group.stocks || []).slice(0, 10)) {
      if (!stock.code) continue;
      const old = rowsByCode.get(stock.code);
      const candidate = {
        code: stock.code,
        name: stock.name,
        theme: theme.name,
        role: stock.role || theme.role || "板块关联",
        phase: theme.phase || theme.emotion_stage,
        theme_score: theme.score || 0,
        base_score: stock.score || 0,
      };
      if (!old || candidate.theme_score + candidate.base_score > old.theme_score + old.base_score) {
        rowsByCode.set(stock.code, candidate);
      }
    }
  }
  if (!rowsByCode.size) {
    const pool = staticCandidatePool();
    for (const item of pool.slice(0, 80)) {
      rowsByCode.set(item.code, {
        ...item,
        phase: item.phase || "动态候选",
        theme_score: item.score || 0,
        base_score: item.score || 0,
      });
    }
  }
  if (!rowsByCode.size) {
    for (const item of CANDIDATE_UNIVERSE) rowsByCode.set(item.code, { ...item, phase: "预设观察", theme_score: 0, base_score: 60 });
  }
  const rows = [...rowsByCode.values()];
  const quotes = await fetchQuotes(rows.map((row) => stockSymbolFromCode(row.code)));
  return rows
    .map((row, index) => {
      const quote = quotes.get(row.code);
      const pct = quote?.pct ?? null;
      const turnover = quote?.turnover ?? null;
      const amount = quote?.amount_10000 ? Number((quote.amount_10000 / 10000).toFixed(2)) : null;
      const score = Number(((row.theme_score || 0) * 0.45 + (row.base_score || 0) * 0.35 + Math.max(Math.min(pct || 0, 10), -10) * 2.5 + Math.min(turnover || 0, 15) * 1.1 + Math.min(amount || 0, 100) * 0.08 - index * 0.03).toFixed(1));
      let level = "观察池";
      if (score >= 92 && (pct || 0) >= 1) level = "核心候选";
      else if (score >= 78) level = "强观察";
      return {
        ...row,
        price: quote?.price ?? null,
        pct,
        turnover,
        amount_100m_yuan: amount,
        score,
        level,
        action: quote ? candidateAction(quote) : "行情暂缺，先按观察处理。",
      };
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 24);
}

async function buildLiveReport() {
  const [industry, concept, indexQuotes] = await Promise.all([
    fetchBk("m:90+s:4"),
    fetchBk("m:90+t:3"),
    Promise.all(INDEX_UNIVERSE.map((item) => fetchIndexQuote(item).catch((error) => ({ ...item, quote: null, error: error.message })))),
  ]);

  const industryRows = rawSectorRows(industry, "行业");
  const conceptRows = rawSectorRows(concept, "概念");
  const themes = buildDynamicMainlines(industryRows, conceptRows);
  const watchThemes = THEMES.map((theme) => collectTheme(theme, industry, concept)).sort((a, b) => b.flow_score_100m_yuan - a.flow_score_100m_yuan);
  const indices = indexQuotes.map((item) => ({
    name: item.name,
    symbol: item.symbol,
    group: item.group || "A股",
    gate: item.gate !== false,
    price: item.quote?.price ?? null,
    pct: item.quote?.pct ?? null,
    status: item.quote ? ((item.quote?.pct || 0) >= 0 ? "红盘" : "绿盘") : "缺失",
    error: item.error,
  }));
  const gate = judgeGate(indices, industry, concept, themes);
  const candidates = await buildDynamicCandidates(themes);

  const generatedAt = beijingTimestamp();
  return {
    generated_at: generatedAt,
    trading_date: generatedAt.slice(0, 10),
    data_status: "当日实时",
    refresh_seconds: 60,
    data_sources: ["东方财富 BK 板块资金", "腾讯实时行情", "新浪环球市场"],
    gate,
    indices,
    themes,
    watch_themes: watchThemes,
    emotion_dashboard: buildEmotionDashboardFromSectors(themes, industryRows, conceptRows),
    sector_rankings: {
      system: themes,
      industry: industryRows,
      concept: conceptRows,
    },
    candidates,
    industry_top5: industry.map(publicRow),
    concept_top5: concept.map(publicRow),
    system_boundary: "盘中实时判断只做条件过滤和风险提示，不给无条件买卖指令。",
  };
}

function buildFallbackReport(error) {
  const daily = require("../data/daily-report.json");
  const generatedAt = beijingTimestamp();
  return {
    generated_at: generatedAt,
    trading_date: daily.source_data_date || daily.generated_at || generatedAt.slice(0, 10),
    data_status: "静态回退",
    refresh_seconds: 300,
    data_sources: [...(daily.data_sources || []), "本地日报缓存"],
    gate: daily.market_gate || daily.gate || {},
    indices: daily.indices || daily.market_gate?.indices || [],
    themes: daily.themes || [],
    watch_themes: daily.watch_themes || [],
    emotion_dashboard: daily.emotion_dashboard || {},
    sector_rankings: {
      system: daily.themes || [],
      industry: daily.industry_all || daily.industry_top10 || [],
      concept: daily.concept_all || daily.concept_top10 || [],
    },
    candidates: [...(daily.candidate_pool?.core || []), ...(daily.candidate_pool?.watch || [])].slice(0, 24),
    industry_top5: (daily.industry_top10 || []).slice(0, 5),
    concept_top5: (daily.concept_top10 || []).slice(0, 5),
    system_boundary: daily.system_boundary || "盘中实时判断只做条件过滤和风险提示，不给无条件买卖指令。",
    error_notice: `实时源暂不可用，已使用静态日报缓存：${error?.message || "unknown"}`,
  };
}

async function getLiveReport() {
  const now = Date.now();
  if (cachedLiveReport && now - cachedLiveAt < CACHE_TTL_MS) {
    return { ...cachedLiveReport, data_status: "当日实时缓存" };
  }
  const report = await buildLiveReport();
  cachedLiveReport = report;
  cachedLiveAt = now;
  return report;
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
    res.end(JSON.stringify(await getLiveReport()));
  } catch (error) {
    if (cachedLiveReport) {
      res.end(JSON.stringify({ ...cachedLiveReport, data_status: "实时缓存回退", error_notice: error.message || "实时判断失败" }));
      return;
    }
    res.end(JSON.stringify(buildFallbackReport(error)));
  }
}

module.exports = handler;
module.exports._private = { buildLiveReport, buildFallbackReport, getLiveReport };
