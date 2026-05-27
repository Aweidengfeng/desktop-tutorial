# 性能优化指南

## Core Web Vitals 目标

| 指标 | Good | Needs Improvement | Poor |
|------|------|-------------------|------|
| LCP  | < 2.5s | 2.5–4s | > 4s |
| INP  | < 200ms | 200–500ms | > 500ms |
| CLS  | < 0.1 | 0.1–0.25 | > 0.25 |
| FCP  | < 1.8s | 1.8–3s | > 3s |
| TTFB | < 800ms | 800–1800ms | > 1800ms |

## Bundle 体积限制

| 文件 | 限制 |
|------|------|
| `www/js/app-core.js` | < 300KB |
| 单个懒加载模块 | < 80KB |

## 如何本地运行 Lighthouse

```bash
npm install -g @lhci/cli
npm start
lhci autorun
```

## 监控模块使用

性能采集模块位于 `www/js/modules/perf.js`，通过 `initPerfMonitor()` 初始化。
开发环境会在 console 输出 Core Web Vitals 指标，后续可切换为上报 `/api/metrics/web-vitals`。
