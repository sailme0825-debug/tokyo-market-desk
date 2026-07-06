# Tokyo A股情绪周期判断台

这是一个静态公开网站原型，用于展示用户交易系统生成的每日 A 股板块判断。

公开部署请看：

```text
PUBLIC_DEPLOY.md
```

## 当前结构

- `index.html`：公开页面。
- `styles.css`：页面样式。
- `app.js`：读取并渲染每日判断 JSON。
- `site-config.js`：公开部署配置，主要用于配置个股检索 API。
- `report-data.js`：本地文件模式的数据入口，支持直接打开 `index.html`。
- `data/daily-report.json`：每日判断结果。
- `.github/workflows/deploy.yml`：GitHub Pages 每日自动部署工作流。
- `scripts/generate_daily_market_report.py`：公开部署时使用的每日生成脚本。
- `../../work/generate_daily_market_report.py`：每日数据生成脚本。
- `../../work/stock_judgment_server.py`：个股检索与双系统判断服务。

## 每日更新

在项目根目录运行：

```bash
python3 work/generate_daily_market_report.py --data-date YYYY-MM-DD --judge-date YYYY-MM-DD
```

脚本会抓取东方财富 BK 板块资金，生成：

```text
outputs/public-trading-site/data/daily-report.json
outputs/public-trading-site/report-data.js
```

如果通过 `file://` 直接打开网页，页面会优先读取 `report-data.js`。

## 个股检索判断

### 本地使用

先在项目根目录启动本地服务：

```bash
python3 work/stock_judgment_server.py
```

服务地址：

```text
http://127.0.0.1:8790
```

页面输入股票名称或代码后，会调用：

```text
http://127.0.0.1:8790/api/stock?q=股票
```

### 公开使用

本目录已经内置 Vercel Serverless Function：

```text
api/stock.js
```

如果把整个目录部署到 Vercel，公开网址会自动调用同源：

```text
https://your-site.vercel.app/api/stock?q=股票
```

如果使用自定义 API 域名，在 `site-config.js` 里配置：

```js
window.SITE_CONFIG = {
  stockApiBase: "https://your-api.example.com"
};
```

判断输出包括：

- 东方财富搜索解析出的 A 股代码。
- 腾讯行情与前复权日 K。
- 她模型：核心候选/观察池/不进入核心、角色、信号检查。
- v5/v6：买点、卖点、失效条件、仓位倾向、风险提示。

## 已补充模块

- 大盘市场门：用主要指数趋势和板块热度判断是否允许开仓。
- 个股板块匹配：检索个股时显示自动匹配到的系统板块标签。
- 个股详情页：角色审计、触发条件、下一步动作、禁止动作。
- 核心候选池：按趋势、量能、突破和系统角色生成核心候选/观察池。
- 情绪周期仪表：将热门板块映射到启动、发酵、加速、高潮、分歧、修复、退潮。
- 系统预警：显示市场门、板块退潮、高潮分歧、无核心候选等提醒。
- 事件模板：机器人、特斯拉链、业绩预告、政策、涨价缺货等催化的观察/买预期/兑现风险。
- 盘后复盘评分：按主线识别、市场门、候选质量、风险纪律、数据可靠评分。
- 公开合规提示：强调这是研究与复盘工具，不是荐股页面。

## 数据口径

- 数据源：东方财富 Data Center `dataapi/bkzj/getbkzj`。
- 字段：`f62` 主力净流入。
- 行业：`m:90+s:4`。
- 概念：`m:90+t:3`。
- 口径：东方财富 BK 板块/概念口径，不等同于 Wind 或申万行业口径。

## 公开部署

可以部署到 GitHub Pages、Vercel、Netlify 或任意静态网站服务器。

若要全自动每日更新，推荐：

- GitHub Pages + GitHub Actions 定时运行脚本并提交 JSON。
- Vercel + Serverless Function 支持公开个股检索。
- 自有服务器 + cron 每日收盘后运行脚本。

公开页面只用于复盘和交易计划，不构成投资建议。
