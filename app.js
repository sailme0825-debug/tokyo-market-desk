const yuan = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function text(id, value) {
  document.getElementById(id).textContent = value;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stageClass(stage) {
  if (stage.includes("高潮") || stage.includes("加速")) return "stage-hot";
  if (stage.includes("退潮") || stage.includes("防守")) return "stage-cold";
  return "";
}

function flowClass(score) {
  if (score >= 250) return "flow-strong";
  if (score >= 80) return "flow-warm";
  if (score < 0) return "flow-weak";
  return "flow-neutral";
}

const DEFAULT_PERSONAL_MODE = {
  title: "事件驱动的价值投机",
  definition: "先找事件催化，再找价值锚，最后用情绪周期和价格结构选择交易窗口。",
  command: "不把热度当理由，不把便宜当买点；只做可验证、可证伪、可退出的机会。",
  pillars: [
    { name: "事件催化", rule: "政策、订单、业绩、产品、涨价、并购重组必须有时间表和验证点。" },
    { name: "价值锚", rule: "估值、业绩弹性、产业地位或供需变化要能解释空间，不做纯情绪漂移。" },
    { name: "投机窗口", rule: "只在资金回流、主线扩散、分歧承接或放量突破时交易。" },
    { name: "退出纪律", rule: "事件落地不超预期、价值锚证伪、价格破位或情绪退潮，必须降级或退出。" },
  ],
};

function getPersonalMode(report) {
  return { ...DEFAULT_PERSONAL_MODE, ...(report.personal_mode || {}) };
}

function renderPersonalMode(mode) {
  text("modeTitle", mode.title || DEFAULT_PERSONAL_MODE.title);
  text("modeDefinition", mode.definition || DEFAULT_PERSONAL_MODE.definition);
  text("modeCommand", mode.command || DEFAULT_PERSONAL_MODE.command);
  const pillars = mode.pillars?.length ? mode.pillars : DEFAULT_PERSONAL_MODE.pillars;
  document.getElementById("modePillars").innerHTML = pillars
    .map((item) => `
      <article>
        <b>${htmlEscape(item.name)}</b>
        <span>${htmlEscape(item.rule)}</span>
      </article>
    `)
    .join("");
}

function renderStockResult(report) {
  const quote = report.quote;
  const tech = report.technical;
  const judgment = report.judgment;
  const research = judgment.research_system;
  const risk = judgment.risk_system;
  const mode = judgment.event_value_speculation || {};
  const grade = judgment.grade || { level: "--", label: "未分级", summary: "等待系统判断。" };
  const pctClass = (quote.pct || 0) >= 0 ? "stock-up" : "stock-down";
  document.getElementById("stockResult").className = "stock-result";
  document.getElementById("stockResult").innerHTML = `
    <div class="stock-head">
      <div>
        <span class="stock-code">${htmlEscape(report.stock.code)} · ${htmlEscape(report.stock.market || "")}</span>
        <h2>${htmlEscape(report.stock.name)}</h2>
        <p>${htmlEscape(judgment.theme_guess)} · ${htmlEscape(report.stock.symbol)}</p>
        <div class="sector-tags">
          ${(judgment.sector_matches || [{ sector: "待人工确认板块" }]).map((item) => `<span>${htmlEscape(item.sector)}</span>`).join("")}
        </div>
      </div>
      <div class="stock-grade grade-${htmlEscape(grade.level)}">
        <strong>${htmlEscape(grade.level)}</strong>
        <span>${htmlEscape(grade.label)}</span>
        <small>${htmlEscape(grade.summary)}</small>
      </div>
      <div class="stock-price ${pctClass}">
        <strong>${quote.price ?? "--"}</strong>
        <span>${quote.change ?? "--"} / ${quote.pct ?? "--"}%</span>
      </div>
    </div>

    <div class="stock-metrics">
      ${metric("成交额", quote.amount_10000 ? `${yuan.format(quote.amount_10000 / 10000)} 亿` : "--")}
      ${metric("换手率", quote.turnover ? `${quote.turnover}%` : "--")}
      ${metric("5日量比", tech.volume_ratio_5d ?? "--")}
      ${metric("趋势分", `${tech.trend_score}/4`)}
      ${metric("MA20偏离", tech.pct_from_ma20 !== null ? `${tech.pct_from_ma20}%` : "--")}
      ${metric("20日突破", tech.breakout_20d ? "是" : "否")}
      ${metric("PE", quote.pe ?? "--")}
      ${metric("总市值", quote.market_cap_100m ? `${yuan.format(quote.market_cap_100m)} 亿` : "--")}
    </div>

    <div class="mode-audit-card">
      <div>
        <span>个人模式审计</span>
        <strong>${htmlEscape(mode.label || "事件驱动价值投机")}</strong>
      </div>
      <p>${htmlEscape(mode.summary || "先确认事件催化和价值锚，再用价格结构决定是否进入交易窗口。")}</p>
      <div class="mode-audit-grid">
        ${(mode.checks || []).map((item) => `
          <article>
            <b>${htmlEscape(item.name)}</b>
            <span>${htmlEscape(item.status)}</span>
            <small>${htmlEscape(item.note)}</small>
          </article>
        `).join("")}
      </div>
    </div>

    <div class="judgment-grid">
      <section class="judgment-card research-card">
        <div class="judgment-card-head">
          <span>她模型</span>
          <strong>${htmlEscape(research.level)}</strong>
        </div>
        <h3>${htmlEscape(research.role)}</h3>
        <p>${htmlEscape(research.signal)}</p>
        <ul>${research.checks.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>
      </section>

      <section class="judgment-card risk-card">
        <div class="judgment-card-head">
          <span>v5/v6 风控执行</span>
          <strong>${htmlEscape(risk.action_bias)}</strong>
        </div>
        <h3>买点：${htmlEscape(risk.buy_zone)}</h3>
        <p><b>失效：</b>${htmlEscape(risk.invalidation)}</p>
        <p><b>仓位：</b>${htmlEscape(risk.position)}</p>
      </section>
    </div>

    <div class="stock-plan-grid">
      <section class="trade-box buy-box">
        <h3><span>买</span> 只在这些条件下考虑</h3>
        <ul><li>${htmlEscape(risk.buy_zone)}</li><li>必须叠加事件催化、价值锚、板块资金、价格结构四者共振。</li><li>不在一致高潮和情绪冲动时开仓。</li></ul>
      </section>
      <section class="trade-box sell-box">
        <h3><span>卖</span> 卖点/退出</h3>
        <ul>${risk.sell_zone.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>
      </section>
      <section class="trade-box">
        <h3><span>险</span> 风险提示</h3>
        <ul>${risk.risk_flags.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>
      </section>
      <section class="trade-box">
        <h3><span>据</span> 数据来源</h3>
        <ul>${report.data_sources.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>
      </section>
    </div>

    <div class="stock-detail-page">
      <section>
        <h3>角色审计</h3>
        <ul>${(judgment.detail?.role_audit || []).map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>
      </section>
      <section>
        <h3>触发条件</h3>
        <div class="trigger-grid">
          ${(judgment.detail?.trigger_status || []).map((item) => `
            <div class="${item.status === "通过" ? "pass" : item.status === "偏高" ? "warn" : ""}">
              <b>${htmlEscape(item.name)}</b>
              <span>${htmlEscape(item.status)}</span>
              <small>${htmlEscape(item.note)}</small>
            </div>
          `).join("")}
        </div>
      </section>
      <section>
        <h3>下一步动作</h3>
        <ul>${(judgment.detail?.next_actions || []).map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>
      </section>
      <section>
        <h3>禁止动作</h3>
        <ul>${(judgment.detail?.do_not_do || []).map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>
      </section>
    </div>
  `;
}

function metric(label, value) {
  return `
    <div class="stock-metric">
      <span>${htmlEscape(label)}</span>
      <b>${htmlEscape(value)}</b>
    </div>
  `;
}

async function searchStock() {
  const input = document.getElementById("stockQuery");
  const button = document.getElementById("stockSearchButton");
  const query = input.value.trim();
  if (!query) {
    input.focus();
    return;
  }
  const result = document.getElementById("stockResult");
  result.className = "stock-result loading-state";
  result.textContent = "正在检索行情并按系统判断...";
  button.disabled = true;
  try {
    const apiBase = getStockApiBase();
    if (!apiBase) {
      throw new Error("公开版暂未配置个股检索 API；每日市场判断仍可正常查看。");
    }
    const response = await fetch(`${apiBase}/api/stock?q=${encodeURIComponent(query)}`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || "检索失败");
    renderStockResult(payload);
  } catch (error) {
    result.className = "stock-result error-state";
    result.innerHTML = `
      <b>个股判断服务暂不可用。</b>
      <p>${htmlEscape(error.message)}</p>
      <p>本地使用请启动：<code>python3 work/stock_judgment_server.py</code>；公开部署请在 <code>site-config.js</code> 配置公网 API。</p>
    `;
  } finally {
    button.disabled = false;
  }
}

function getStockApiBase() {
  const configured = window.SITE_CONFIG?.stockApiBase?.trim();
  if (configured === "same-origin") return location.origin;
  if (configured) return configured.replace(/\/$/, "");
  if (location.protocol === "file:") return "http://127.0.0.1:8790";
  if (["127.0.0.1", "localhost"].includes(location.hostname)) {
    return "http://127.0.0.1:8790";
  }
  if (location.hostname.endsWith(".vercel.app")) {
    return location.origin;
  }
  return "";
}

async function refreshLiveDecision() {
  const button = document.getElementById("liveRefreshButton");
  const liveAction = document.getElementById("liveAction");
  button.disabled = true;
  liveAction.textContent = "正在读取盘中指数、板块资金和核心候选...";
  try {
    const apiBase = getStockApiBase();
    if (!apiBase) {
      throw new Error("公开 GitHub Pages 暂无实时 API；本地启动 8790 或部署到 Vercel 后可用。");
    }
    const response = await fetch(`${apiBase}/api/live`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || "盘中判断失败");
    renderLiveDecision(payload);
  } catch (error) {
    document.getElementById("liveGateStatus").textContent = "不可用";
    document.getElementById("liveUpdatedAt").textContent = "实时 API 未连接";
    liveAction.textContent = error.message;
    document.getElementById("liveIndices").innerHTML = `<p class="empty-line">本地请启动：python3 work/stock_judgment_server.py</p>`;
    document.getElementById("liveThemes").innerHTML = "";
    document.getElementById("liveCandidates").innerHTML = "";
  } finally {
    button.disabled = false;
  }
}

function renderLiveDecision(payload) {
  document.getElementById("liveGateStatus").textContent = `市场门：${payload.gate.status}`;
  document.getElementById("liveAction").textContent = payload.gate.action;
  document.getElementById("liveUpdatedAt").textContent = `更新 ${payload.generated_at} · ${payload.refresh_seconds}s 口径`;
  syncTopSummaryWithLive(payload);
  if (payload.emotion_dashboard) renderEmotionDashboard(payload.emotion_dashboard);

  document.getElementById("liveIndices").innerHTML = `
    <h3>指数门</h3>
    <div class="live-mini-grid">
      ${payload.indices.map((row) => `
        <div class="${(row.pct || 0) >= 0 ? "live-up" : "live-down"}">
          <b>${htmlEscape(row.name)}</b>
          <span>${row.price ?? "--"} / ${row.pct ?? "--"}%</span>
        </div>
      `).join("")}
    </div>
    <p>红盘指数 ${payload.gate.positive_index_count}/4，行业流入 ${payload.gate.positive_industry_count}，概念流入 ${payload.gate.positive_concept_count}。</p>
  `;

  document.getElementById("liveThemes").innerHTML = `
    <h3>板块情绪</h3>
    ${renderLiveSectorTabs(payload)}
  `;
  wireLiveSectorTabs();

  document.getElementById("liveCandidates").innerHTML = `
    <h3>核心候选快照</h3>
    <div class="live-candidate-list">
      ${payload.candidates.map((stock) => `
        <article>
          <div>
            <b>${htmlEscape(stock.name)} <small>${htmlEscape(stock.code)}</small></b>
            <span>${htmlEscape(stock.theme)} · ${htmlEscape(stock.role)}</span>
          </div>
          <strong class="${(stock.pct || 0) >= 0 ? "stock-up" : "stock-down"}">${stock.pct ?? "--"}%</strong>
          <p>${htmlEscape(stock.action)}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function syncTopSummaryWithLive(payload) {
  const liveTime = formatLiveTime(payload.generated_at);
  text("sourceDate", `盘中 ${liveTime}`);
  text("verifyStatus", payload.data_status || "当日实时");
  text("quickFreshness", payload.data_status || "当日实时");
  text("quickMarketGate", `市场门${payload.gate.status}`);
  text("quickMainline", payload.gate.strongest_theme || "--");
  text("quickAction", payload.gate.action);
  const banner = document.getElementById("freshnessBanner");
  banner.hidden = false;
  banner.textContent = `实时盘中数据已接入：${liveTime}，静态日报仅作盘后复盘参考。`;
  document.body.classList.remove("data-stale");
  document.body.classList.add("data-live");
}

function formatLiveTime(value) {
  if (!value) return "--";
  return String(value).replace("+08:00", "").replace("T", " ");
}

function renderLiveSectorTabs(payload) {
  const rankings = payload.sector_rankings || {
    system: payload.themes || [],
    industry: payload.industry_top5 || [],
    concept: payload.concept_top5 || [],
  };
  const sections = [
    ["system", "动态主线", rankings.system || []],
    ["industry", "行业资金", rankings.industry || []],
    ["concept", "概念资金", rankings.concept || []],
  ];
  return `
    <div class="live-sector-tabs">
      ${sections.map(([key, label, rows], index) => `<button type="button" class="${index === 0 ? "active" : ""}" data-live-sector="${key}">${label}<small>${rows.length}</small></button>`).join("")}
    </div>
    <div class="live-sector-panels">
      ${sections.map(([key, , rows], index) => `
        <div class="live-theme-list ${index === 0 ? "active" : ""}" data-live-sector-panel="${key}">
          ${rows.map((row) => renderLiveSectorRow(row)).join("") || `<p class="empty-line">暂无数据。</p>`}
        </div>
      `).join("")}
    </div>
  `;
}

function wireLiveSectorTabs() {
  const root = document.getElementById("liveThemes");
  root.querySelectorAll("[data-live-sector]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.liveSector;
      root.querySelectorAll("[data-live-sector]").forEach((node) => node.classList.remove("active"));
      root.querySelectorAll("[data-live-sector-panel]").forEach((node) => node.classList.remove("active"));
      button.classList.add("active");
      root.querySelector(`[data-live-sector-panel="${key}"]`)?.classList.add("active");
    });
  });
}

function renderLiveSectorRow(row) {
  const flow = row.flow_score_100m_yuan ?? row.main_net_inflow_100m_yuan ?? 0;
  const rank = row.rank ? `#${row.rank} ` : "";
  const stage = row.emotion_stage || stageClassFromFlow(flow);
  const role = row.role || row.source || "资金";
  const rule = row.intraday_rule || intradayRuleFromFlow(row.name, flow);
  const score = row.score !== undefined ? ` · ${row.score}分` : "";
  return `
    <article class="${flow < 0 ? "live-sector-weak" : ""}">
      <div>
        <b>${rank}${htmlEscape(row.name)}</b>
        <span>${htmlEscape(stage)} · ${htmlEscape(role)}${score} ${row.code ? `· ${htmlEscape(row.code)}` : ""}</span>
      </div>
      <strong class="${flow < 0 ? "stock-down" : "stock-up"}">${yuan.format(flow)}亿</strong>
      <p>${htmlEscape(rule)}</p>
    </article>
  `;
}

function stageClassFromFlow(flow) {
  if (flow >= 60) return "强流入";
  if (flow >= 20) return "温和流入";
  if (flow > 0) return "弱流入";
  if (flow <= -20) return "明显流出";
  return "震荡";
}

function intradayRuleFromFlow(name, flow) {
  if (flow <= -20) return "资金流出，按退潮/分歧处理。";
  if (flow >= 20) return "资金靠前，先找事件催化和价值锚，再等待中军/核心股确认。";
  if (/贵金属|银行|电力|煤炭|公用/.test(name)) return "偏防守属性，观察弱势市场承接。";
  return "资金强度一般，只作轮动观察；没有事件催化不进入主仓。";
}

function renderPulseCards(themes) {
  const root = document.getElementById("pulseCards");
  root.innerHTML = themes
    .map((theme, index) => {
      const primary = theme.watch_points[0] || { name: "等待确认", flow: 0 };
      return `
        <article class="pulse-card ${flowClass(theme.flow_score_100m_yuan)}">
          <div class="pulse-rank">0${index + 1}</div>
          <div class="pulse-main">
            <h2>${theme.name}</h2>
            <p>${theme.trade_plan?.bias || theme.role}</p>
          </div>
          <div class="pulse-metric">
            <strong>${yuan.format(theme.flow_score_100m_yuan)}</strong>
            <span>亿元</span>
          </div>
          <div class="pulse-foot">
            <span>${theme.emotion_stage}</span>
            <b>${primary.name} ${yuan.format(primary.flow)}亿</b>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderThemes(themes) {
  const root = document.getElementById("themeList");
  root.innerHTML = themes
    .map((theme) => {
      const items = theme.watch_points.length
        ? theme.watch_points
        : [{ name: "等待确认", flow: 0, code: "--" }];
      const plan = theme.trade_plan || {
        bias: "等待确认",
        analysis: theme.expectation,
        buy_points: ["等待事件催化、价值锚、板块资金、价格结构同时确认。"],
        sell_points: ["确认失败或跌回平台。"],
        invalidation: "资金不持续。",
        position: "观察。"
      };
      return `
        <article class="theme-row ${flowClass(theme.flow_score_100m_yuan)}">
          <div>
            <h2 class="theme-title">${theme.name}</h2>
            <div class="theme-meta">
              <span class="pill">${theme.role}</span>
              <span class="pill ${stageClass(theme.emotion_stage)}">${theme.emotion_stage}</span>
              <span class="pill">${yuan.format(theme.flow_score_100m_yuan)} 亿</span>
            </div>
            <p class="theme-bias">${plan.bias}</p>
          </div>
          <div class="theme-body">
            <p class="theme-expect">${theme.expectation}</p>
            <p class="theme-analysis">${plan.analysis}</p>
            <div class="watch-grid">
              ${items
                .slice(0, 4)
                .map(
                  (item) => `
                    <div class="watch-item">
                      <b>${item.name} · ${item.code}</b>
                      <span>${yuan.format(item.flow)} 亿</span>
                    </div>
                  `
                )
                .join("")}
            </div>
            <div class="trade-grid">
              <section class="trade-box buy-box">
                <h3><span>买</span> 条件买点</h3>
                <ul>${plan.buy_points.map((item) => `<li>${item}</li>`).join("")}</ul>
              </section>
              <section class="trade-box sell-box">
                <h3><span>卖</span> 卖点/退出</h3>
                <ul>${plan.sell_points.map((item) => `<li>${item}</li>`).join("")}</ul>
              </section>
              <section class="trade-box">
                <h3><span>破</span> 失效条件</h3>
                <p>${plan.invalidation}</p>
              </section>
              <section class="trade-box">
                <h3><span>仓</span> 仓位倾向</h3>
                <p>${plan.position}</p>
              </section>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderBars(id, rows) {
  const root = document.getElementById(id);
  if (!rows?.length) {
    root.innerHTML = `<p class="empty-line">暂无板块资金数据。</p>`;
    return;
  }
  const max = Math.max(...rows.map((row) => Math.abs(row.main_net_inflow_100m_yuan)), 1);
  root.innerHTML = rows
    .map((row) => {
      const width = Math.max(4, Math.round((Math.abs(row.main_net_inflow_100m_yuan) / max) * 100));
      return `
        <div class="bar-row">
          <div class="bar-name" title="${row.name}">#${row.rank ?? ""} ${row.name}</div>
          <div class="bar-track" aria-hidden="true">
            <div class="bar-fill" style="width:${width}%"></div>
          </div>
          <div class="bar-value">${yuan.format(row.main_net_inflow_100m_yuan)}</div>
        </div>
      `;
    })
    .join("");
}

function renderVerification(verification) {
  const fields = [
    ["数据源", verification.source],
    ["字段", verification.field],
    ["行业样本", `${verification.industry_count} 条 · ${verification.industry_top}`],
    ["概念样本", `${verification.concept_count} 条 · ${verification.concept_top}`],
  ];
  document.getElementById("verification").innerHTML = fields
    .map(
      ([label, value]) => `
        <div class="verify-item">
          <span>${label}</span>
          <b>${value}</b>
        </div>
      `
    )
    .join("");
}

function renderSystemRules(rules) {
  const root = document.getElementById("systemRules");
  root.innerHTML = rules
    .map(
      (rule) => `
        <article class="rule-card">
          <div class="rule-card-head">
            <h2>${rule.title}</h2>
            <span>${rule.tag}</span>
          </div>
          <ul>
            ${rule.items.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </article>
      `
    )
    .join("");
}

function renderMarketGate(gate) {
  text("marketGateStatus", gate.status);
  document.getElementById("marketGate").innerHTML = `
    <div class="gate-summary">
      <strong>${htmlEscape(gate.status)}</strong>
      <span>${htmlEscape(gate.advice)}</span>
    </div>
    <div class="gate-metrics">
      ${metric("打开指数", `${gate.open_index_count}/4`)}
      ${metric("板块热度", gate.sector_heat)}
      ${metric("行业流入", `${gate.positive_industry_count}`)}
      ${metric("概念流入", `${gate.positive_concept_count}`)}
    </div>
    <div class="mini-table">
      ${gate.indices.map((row) => `
        <div>
          <b>${htmlEscape(row.name)}</b>
          <span>${row.price ?? "--"} / ${row.pct ?? "--"}% / ${htmlEscape(row.status)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderTopSummary(report) {
  const summary = report.top_summary || {};
  text("quickMarketGate", summary.market_gate || "--");
  text("quickMainline", summary.mainline || "--");
  text("quickAction", summary.action || "--");
  text("quickFreshness", summary.freshness || "--");
  text("quickTaboo", summary.taboo || "--");

  const banner = document.getElementById("freshnessBanner");
  if (report.data_freshness && !report.data_freshness.is_current) {
    banner.hidden = false;
    banner.textContent = report.data_freshness.message;
    document.body.classList.add("data-stale");
  } else {
    banner.hidden = true;
    document.body.classList.remove("data-stale");
  }
}

function renderAlerts(alerts) {
  document.getElementById("alertList").innerHTML = alerts.map((alert) => `
    <article class="alert-item ${alert.level}">
      <b>${htmlEscape(alert.title)}</b>
      <span>${htmlEscape(alert.body)}</span>
    </article>
  `).join("");
}

function renderExecutionChecklist(items) {
  document.getElementById("executionChecklist").innerHTML = (items || []).map((item, index) => `
    <article class="execution-item">
      <span>${index + 1}</span>
      <div>
        <b>${htmlEscape(item.title)}</b>
        <p>${htmlEscape(item.body)}</p>
      </div>
    </article>
  `).join("");
}

function renderSectorLinkage(linkage) {
  const root = document.getElementById("sectorLinkage");
  const groups = linkage || [];
  if (!groups.length) {
    root.innerHTML = `<p class="empty-line">暂无板块候选。</p>`;
    return;
  }
  root.innerHTML = `
    <div class="sector-tabs">
      ${groups.map((group, index) => `<button type="button" class="${index === 0 ? "active" : ""}" data-sector-index="${index}">${htmlEscape(group.theme)}</button>`).join("")}
    </div>
    <div id="sectorStocks" class="sector-stocks"></div>
  `;
  const renderGroup = (index) => {
    const group = groups[index];
    document.getElementById("sectorStocks").innerHTML = group.stocks.map((stock) => `
      <article class="sector-stock">
        <b>${htmlEscape(stock.name)} <small>${htmlEscape(stock.code)}</small></b>
        <span>${htmlEscape(stock.role)} · ${htmlEscape(stock.level)} · ${stock.score ?? "--"}分</span>
        <p>${htmlEscape(stock.reason || "")}</p>
      </article>
    `).join("");
  };
  root.querySelectorAll("[data-sector-index]").forEach((button) => {
    button.addEventListener("click", () => {
      root.querySelectorAll("[data-sector-index]").forEach((node) => node.classList.remove("active"));
      button.classList.add("active");
      renderGroup(Number(button.dataset.sectorIndex));
    });
  });
  renderGroup(0);
}

function renderEventTemplates(templates) {
  const root = document.getElementById("eventTemplates");
  root.innerHTML = (templates || []).map((item) => `
    <article class="event-card">
      <h3>${htmlEscape(item.name)}</h3>
      <dl>
        <div><dt>观察</dt><dd>${htmlEscape(item.watch)}</dd></div>
        <div><dt>买预期</dt><dd>${htmlEscape(item.buy_expectation)}</dd></div>
        <div><dt>兑现风险</dt><dd>${htmlEscape(item.sell_news_risk)}</dd></div>
        <div><dt>系统规则</dt><dd>${htmlEscape(item.system_rule)}</dd></div>
      </dl>
    </article>
  `).join("");
}

function renderPostReviewScore(score) {
  const root = document.getElementById("postReviewScore");
  if (!score) {
    root.innerHTML = `<p class="empty-line">暂无复盘评分。</p>`;
    return;
  }
  root.innerHTML = `
    <div class="review-total">
      <strong>${score.total}</strong>
      <span>${htmlEscape(score.conclusion)}</span>
    </div>
    <div class="review-dimensions">
      ${score.dimensions.map((item) => `
        <article>
          <div>
            <b>${htmlEscape(item.name)}</b>
            <span>${htmlEscape(item.note)}</span>
          </div>
          <strong>${item.score}</strong>
        </article>
      `).join("")}
    </div>
  `;
}

function renderCandidatePool(pool) {
  const core = pool.core.length ? pool.core : [];
  const watch = pool.watch || [];
  document.getElementById("candidatePool").innerHTML = `
    <div class="pool-section">
      <h3>核心候选</h3>
      ${core.length ? core.map(renderCandidate).join("") : `<p class="empty-line">今日无核心候选，按系统等待。</p>`}
    </div>
    <div class="pool-section">
      <h3>观察池</h3>
      <div class="candidate-list">${watch.map(renderCandidate).join("")}</div>
    </div>
    <p class="pool-note">${htmlEscape(pool.note)}</p>
  `;
}

function renderCandidate(row) {
  return `
    <article class="candidate-item">
      <div>
        <b>${htmlEscape(row.name)} <small>${htmlEscape(row.code)}</small></b>
        <span>${htmlEscape(row.theme)} · ${htmlEscape(row.role)}</span>
      </div>
      <div>
        <strong>${row.score ?? "--"}</strong>
        <em>${htmlEscape(row.level)}</em>
      </div>
      <p>${htmlEscape(row.reason || "")}</p>
    </article>
  `;
}

function renderEmotionDashboard(dashboard) {
  if (!dashboard) {
    document.getElementById("emotionDashboard").innerHTML = `<p class="empty-line">暂无情绪周期数据。</p>`;
    return;
  }
  if (!dashboard.summary) {
    renderLegacyEmotionDashboard(dashboard);
    return;
  }
  const summary = dashboard.summary;
  document.getElementById("emotionDashboard").innerHTML = `
    <div class="emotion-summary">
      <div>
        <span>全市场阶段</span>
        <strong>${htmlEscape(summary.overall_phase)}</strong>
        <small>热度 ${summary.heat_score} · 活跃 ${summary.active_count}/${summary.total_count}</small>
      </div>
      <div>
        <span>最强板块</span>
        <strong>${htmlEscape(summary.strongest?.name || "--")}</strong>
        <small>${summary.strongest ? `${htmlEscape(summary.strongest.source)} · ${yuan.format(summary.strongest.flow)}亿` : "--"}</small>
      </div>
      <div>
        <span>最大退潮</span>
        <strong>${htmlEscape(summary.weakest?.name || "--")}</strong>
        <small>${summary.weakest ? `${htmlEscape(summary.weakest.source)} · ${yuan.format(summary.weakest.flow)}亿` : "--"}</small>
      </div>
    </div>
    <p class="emotion-action">${htmlEscape(summary.action)}</p>
    <div class="cycle-axis">
      ${dashboard.order.map((phase) => `
        <span>
          <b>${phase}</b>
          <small>${dashboard.phase_counts?.[phase] ?? 0}</small>
        </span>
      `).join("")}
    </div>
    <div class="emotion-playbook">
      <h3>阶段动作矩阵</h3>
      <div>
        ${getCyclePlaybook().map((item) => `
          <article>
            <b>${htmlEscape(item.phase)}</b>
            <span>${htmlEscape(item.signal)}</span>
            <p><strong>买</strong>${htmlEscape(item.buy)}</p>
            <p><strong>卖</strong>${htmlEscape(item.sell)}</p>
            <p><strong>仓</strong>${htmlEscape(item.position)}</p>
          </article>
        `).join("")}
      </div>
    </div>
    <div class="emotion-explorer">
      <div class="emotion-explorer-head">
        <h3>全板块阶段检索</h3>
        <input id="emotionSectorSearch" type="search" placeholder="搜索板块 / 代码 / 阶段" autocomplete="off">
      </div>
      <div class="emotion-filter-tabs">
        <button type="button" class="active" data-emotion-filter="全部">全部<small>${summary.total_count}</small></button>
        ${dashboard.order.map((phase) => `<button type="button" data-emotion-filter="${htmlEscape(phase)}">${phase}<small>${dashboard.phase_counts?.[phase] ?? 0}</small></button>`).join("")}
      </div>
      <div id="emotionExplorerMeta" class="emotion-explorer-meta"></div>
      <div id="emotionExplorerList" class="emotion-explorer-list"></div>
    </div>
    <div class="emotion-columns">
      <section>
        <h3>强势榜</h3>
        <div class="emotion-mini-list">${(dashboard.leaders || []).slice(0, 8).map(renderEmotionSector).join("")}</div>
      </section>
      <section>
        <h3>退潮榜</h3>
        <div class="emotion-mini-list">${(dashboard.laggards || []).slice(0, 8).map(renderEmotionSector).join("")}</div>
      </section>
    </div>
    <div class="emotion-system">
      <h3>系统主线定位</h3>
      <div class="emotion-list">
        ${(dashboard.items || []).map((item) => `
          <article>
            <div>
              <b>${htmlEscape(item.name)}</b>
              <span>${htmlEscape(item.rule)}</span>
            </div>
            <strong>${htmlEscape(item.phase)}</strong>
          </article>
        `).join("")}
      </div>
    </div>
    <div class="emotion-phase-groups">
      ${(dashboard.phase_groups || []).map((group) => `
        <section>
          <h3>${htmlEscape(group.phase)} <small>${group.count}</small></h3>
          <p>${htmlEscape(group.rule)}</p>
          <div>${(group.sectors || []).slice(0, 18).map(renderEmotionSector).join("") || `<em>暂无</em>`}</div>
        </section>
      `).join("")}
    </div>
  `;
  wireEmotionExplorer(dashboard);
}

function renderLegacyEmotionDashboard(dashboard) {
  document.getElementById("emotionDashboard").innerHTML = `
    <div class="cycle-axis">${dashboard.order.map((phase) => `<span><b>${phase}</b><small>--</small></span>`).join("")}</div>
    <div class="emotion-list">
      ${dashboard.items.map((item) => `
        <article>
          <div>
            <b>${htmlEscape(item.name)}</b>
            <span>${htmlEscape(item.rule)}</span>
          </div>
          <strong>${htmlEscape(item.phase)}</strong>
        </article>
      `).join("")}
    </div>
  `;
}

function renderEmotionSector(item) {
  const flow = item.flow ?? 0;
  return `
    <article class="${flow < 0 ? "emotion-weak" : ""}">
      <b>${item.rank ? `#${item.rank} ` : ""}${htmlEscape(item.name)}</b>
      <span>${htmlEscape(item.source || "")} · ${htmlEscape(item.phase || "")}</span>
      <strong class="${flow < 0 ? "stock-down" : "stock-up"}">${yuan.format(flow)}亿</strong>
    </article>
  `;
}

function getCyclePlaybook() {
  return [
    { phase: "启动", signal: "资金刚转正，梯队未完全扩散。", buy: "只观察首批核心和中军，不急着重仓。", sell: "冲高无承接先放弃。", position: "0-10%" },
    { phase: "发酵", signal: "资金连续回流，核心开始带队。", buy: "分歧承接、平台突破、回踩不破。", sell: "后排冲高回落不恋战。", position: "10-20%" },
    { phase: "加速", signal: "一致性增强，前排快速拉开空间。", buy: "只允许前排核心确认，不追后排。", sell: "放量滞涨或炸板不回封。", position: "不加大总风险" },
    { phase: "高潮", signal: "普涨、一致高开、后排补涨。", buy: "原则上不新开，等强分歧。", sell: "兑现、降仓、保护利润。", position: "降级" },
    { phase: "分歧", signal: "资金摇摆，强弱开始分层。", buy: "只买核心抗跌后转强。", sell: "跌破买入依据直接处理。", position: "试错仓" },
    { phase: "修复", signal: "退潮后局部回流或防守承接。", buy: "只看中军承接，不当主升浪。", sell: "反抽无量或回流失败。", position: "轻仓" },
    { phase: "退潮", signal: "大面积流出，亏钱效应扩散。", buy: "不主动开新仓。", sell: "执行失效线，避免补仓。", position: "防守" },
  ];
}

function flattenEmotionSectors(dashboard) {
  return (dashboard.phase_groups || []).flatMap((group) =>
    (group.sectors || []).map((sector) => ({ ...sector, phase: sector.phase || group.phase }))
  );
}

function wireEmotionExplorer(dashboard) {
  const root = document.getElementById("emotionDashboard");
  const input = document.getElementById("emotionSectorSearch");
  const list = document.getElementById("emotionExplorerList");
  const meta = document.getElementById("emotionExplorerMeta");
  const allRows = flattenEmotionSectors(dashboard);
  let activePhase = "全部";

  const render = () => {
    const query = input.value.trim().toLowerCase();
    const rows = allRows.filter((row) => {
      const matchPhase = activePhase === "全部" || row.phase === activePhase;
      const haystack = `${row.name || ""} ${row.code || ""} ${row.source || ""} ${row.phase || ""}`.toLowerCase();
      return matchPhase && (!query || haystack.includes(query));
    });
    meta.textContent = `显示 ${rows.length} / ${allRows.length} 个板块`;
    list.innerHTML = rows.map(renderEmotionSector).join("") || `<p class="empty-line">没有匹配板块。</p>`;
  };

  input.addEventListener("input", render);
  root.querySelectorAll("[data-emotion-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activePhase = button.dataset.emotionFilter;
      root.querySelectorAll("[data-emotion-filter]").forEach((node) => node.classList.remove("active"));
      button.classList.add("active");
      render();
    });
  });
  render();
}

async function boot() {
  const report = window.DAILY_REPORT || await loadReport();

  renderPersonalMode(getPersonalMode(report));
  renderTopSummary(report);
  text("judgeDate", `判断日 ${report.judge_date}`);
  text("sourceDate", `数据日 ${report.source_data_date}`);
  text("verifyStatus", "已核验");
  text("cyclePosition", report.market_view.cycle_position);
  text("marketSummary", report.market_view.summary);
  text("buyRule", report.market_view.buy_point_rule);
  text("researchSystem", report.systems.research_system);
  text("riskSystem", report.systems.risk_system);
  text("disclaimer", `${report.verification.classification_note} ${report.disclaimer}`);

  renderMarketGate(report.market_gate);
  renderAlerts(report.alerts || []);
  renderCandidatePool(report.candidate_pool);
  renderEmotionDashboard(report.emotion_dashboard);
  renderExecutionChecklist(report.execution_checklist || []);
  renderSectorLinkage(report.sector_linkage || []);
  renderEventTemplates(report.event_templates || []);
  renderPostReviewScore(report.post_review_score);
  renderThemes(report.themes);
  renderPulseCards(report.themes);
  renderSystemRules(report.systems.rules || []);
  renderBars("industryBars", report.industry_all || report.industry_top10);
  renderBars("conceptBars", report.concept_all || report.concept_top10);
  renderVerification(report.verification);

  document.getElementById("stockSearchButton").addEventListener("click", searchStock);
  document.getElementById("stockQuery").addEventListener("keydown", (event) => {
    if (event.key === "Enter") searchStock();
  });
  document.getElementById("liveRefreshButton").addEventListener("click", refreshLiveDecision);
  refreshLiveDecision();
  if (getStockApiBase()) {
    setInterval(refreshLiveDecision, 60000);
  }
}

async function loadReport() {
  const response = await fetch("./data/daily-report.json", { cache: "no-store" });
  if (!response.ok) throw new Error("daily-report.json not found");
  return response.json();
}

boot().catch((error) => {
  text("verifyStatus", "加载失败");
  text("marketSummary", error.message);
});
