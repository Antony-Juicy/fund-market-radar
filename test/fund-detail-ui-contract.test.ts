import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readApp = () => readFile("web/App.tsx", "utf8");
const readPanel = () => readFile("web/components/FundDetailPanel.tsx", "utf8");
const readChart = () => readFile("web/components/FundPerformanceChart.tsx", "utf8");

test("keeps detail data mounted until the drawer exit transition ends", async () => {
  const [app, panel] = await Promise.all([readApp(), readPanel()]);

  assert.match(app, /const \[detailOpened, setDetailOpened\] = useState\(false\)/);
  assert.match(app, /<FundDetailPanel opened=\{detailOpened\}/);
  assert.match(app, /onExitTransitionEnd=\{[^}]*setDetail\(undefined\)/);
  assert.doesNotMatch(app, /onClose=\{\(\) => \{[^}]*setDetail\(undefined\)/s);
  assert.match(panel, /<Drawer opened=\{opened\}/);
  assert.match(panel, /onExitTransitionEnd=\{onExitTransitionEnd\}/);
});

test("lazy-loads the Recharts performance module with a fixed chart fallback", async () => {
  const panel = await readPanel();

  assert.doesNotMatch(panel, /^import \{ FundPerformanceChart \} from "\.\/FundPerformanceChart";/m);
  assert.match(panel, /const FundPerformanceChart = lazy\(\(\) =>\s*import\("\.\/FundPerformanceChart"\)/s);
  assert.match(panel, /<Suspense fallback=\{<PerformanceChartFallback \/>\}>/);
  assert.match(panel, /function PerformanceChartFallback\(\)[\s\S]*height=\{240\}/);
});

test("gives the Recharts chart a name, description, and live tooltip announcement", async () => {
  const chart = await readChart();

  assert.match(chart, /<AreaChart[\s\S]*accessibilityLayer[\s\S]*title=\{chartTitle\}[\s\S]*desc=\{chartDescription\}/);
  assert.match(chart, /formatPerformanceAnnouncement/);
  assert.match(chart, /role="status"/);
  assert.match(chart, /aria-live="polite"/);
  assert.match(chart, /aria-atomic="true"/);
});
