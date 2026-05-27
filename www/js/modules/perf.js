import { apiRequest } from './api-client.js';

const CLS_THRESHOLD = 0.1;
const LCP_THRESHOLD = 2500;
const INP_THRESHOLD = 200;

export function initPerfMonitor(options = {}) {
  if (typeof window === 'undefined' || typeof performance === 'undefined') {
    return { getMetrics: () => ({}) };
  }

  const { reportToApi = false, debug = false } = options;
  const metrics = {};
  let reportTimer = null;

  const report = (name, value, rating) => {
    metrics[name] = { value, rating, ts: Date.now() };
    if (debug) {
      console.log(`[Perf] ${name}: ${Math.round(value)}ms — ${rating}`);
    }
    if (reportToApi) {
      scheduleReport();
    }
  };

  const scheduleReport = () => {
    if (reportTimer) return;
    reportTimer = setTimeout(async () => {
      reportTimer = null;
      try {
        await apiRequest('/api/metrics/web-vitals', {
          method: 'POST',
          body: JSON.stringify({
            metrics,
            url: location.pathname,
            ua: navigator.userAgent,
            ts: Date.now(),
          }),
        });
      } catch (e) {}
    }, 5000);
  };

  if ('PerformanceObserver' in window) {
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (!last) return;
        const value = last.startTime;
        report('LCP', value, value < LCP_THRESHOLD ? 'good' : value < 4000 ? 'needs-improvement' : 'poor');
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {}

    try {
      let clsValue = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) clsValue += entry.value;
        }
        report('CLS', clsValue, clsValue < CLS_THRESHOLD ? 'good' : clsValue < 0.25 ? 'needs-improvement' : 'poor');
      }).observe({ type: 'layout-shift', buffered: true });
    } catch (e) {}

    try {
      new PerformanceObserver((list) => {
        const fcp = list.getEntriesByName('first-contentful-paint')[0];
        if (!fcp) return;
        report('FCP', fcp.startTime, fcp.startTime < 1800 ? 'good' : fcp.startTime < 3000 ? 'needs-improvement' : 'poor');
      }).observe({ type: 'paint', buffered: true });
    } catch (e) {}

    if (PerformanceObserver.supportedEntryTypes?.includes('event')) {
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const interactionStart = entry.startTime || 0;
            const interactionEnd = entry.processingEnd || entry.processingStart || interactionStart;
            const inp = entry.duration || (interactionEnd - interactionStart);
            report('INP', inp, inp < INP_THRESHOLD ? 'good' : inp < 500 ? 'needs-improvement' : 'poor');
          }
        }).observe({ type: 'event', buffered: true, durationThreshold: 40 });
      } catch (e) {}
    }
  }

  window.addEventListener('load', () => {
    setTimeout(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      if (!nav) return;
      report('TTFB', nav.responseStart, nav.responseStart < 800 ? 'good' : nav.responseStart < 1800 ? 'needs-improvement' : 'poor');
      report('TTI_estimate', nav.domInteractive, nav.domInteractive < 3800 ? 'good' : 'needs-improvement');
    }, 0);
  });

  return { getMetrics: () => ({ ...metrics }) };
}
