# 公开部署指南

这个目录已经是一个可部署的公开静态网站。

## 推荐方案：GitHub Pages

1. 新建一个 GitHub 仓库，例如 `tokyo-market-desk`。
2. 把本目录 `outputs/public-trading-site/` 里的所有文件上传到仓库根目录。
3. 进入 GitHub 仓库的 `Settings -> Pages`。
4. Source 选择 `GitHub Actions`。
5. 进入 `Actions` 页面，手动运行 `Deploy Daily Market Desk`。
6. 部署完成后，GitHub 会给出一个公开网址，别人就能访问。

## 每日自动更新

`.github/workflows/deploy.yml` 已经配置：

- 每个交易日北京时间 15:45 自动运行。
- 自动抓取东方财富板块资金和腾讯行情/K线。
- 自动生成 `data/daily-report.json` 与 `report-data.js`。
- 自动发布到 GitHub Pages。

也可以在 GitHub Actions 页面手动点击运行。

## 个股检索

公开静态站点无法直接调用你电脑上的：

```text
http://127.0.0.1:8790
```

所以公开版默认只保证“每日市场判断”自动更新。

如果要让别人也能在线搜索个股，有两种方式。

## 方案 A：Vercel 一体部署

本目录已经内置：

```text
api/stock.js
vercel.json
```

把整个目录导入 Vercel 后，Vercel 会同时托管页面和：

```text
/api/stock?q=股票
```

前端在 `*.vercel.app` 域名下会自动调用同源 API，无需额外配置。

如果使用 Vercel 自定义域名，把：

```text
site-config.js
```

改成：

```js
window.SITE_CONFIG = {
  stockApiBase: "same-origin"
};
```

## 方案 B：外部公网 API

把 `work/stock_judgment_server.py` 或 `api/stock.js` 部署成公网 API，然后在：

```text
site-config.js
```

里配置：

```js
window.SITE_CONFIG = {
  stockApiBase: "https://your-api.example.com"
};
```

本地使用时无需配置，页面会自动调用 `http://127.0.0.1:8790`。

## 公开表达边界

页面应保持“研究/复盘/条件买点/风险退出”的表达，不应写成无条件荐股或收益承诺。
