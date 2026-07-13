# Fund Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real-data fund autocomplete that immediately runs an exact fund query when the user selects a result.

**Architecture:** Keep suggestion retrieval inside the existing live-API-first/static-snapshot-fallback data layer. Put deterministic search thresholds and selection mapping in a small shared helper, let `App` own cancellation and selected-query execution, and keep `FilterBar` focused on Mantine autocomplete rendering.

**Tech Stack:** React 18, TypeScript, Mantine 7 `Autocomplete`, Mantine hooks, Node test runner, Vite, existing `/api/funds` API and Pages JSON fallback.

## Global Constraints

- Suggestions appear only after at least 2 trimmed characters and are debounced by 250ms.
- Suggestions contain only real API or exported real snapshot records; no hard-coded fund results.
- A selected suggestion immediately queries by its six-digit fund code.
- Suggestion failures do not clear the current market table.
- Desktop and mobile layouts must not shift while suggestions load or open.
- Existing topic, match-field, market, sort, and limit filters remain available.

---

### Task 1: Deterministic fund-search behavior

**Files:**
- Create: `src/fund-search.ts`
- Create: `test/fund-search.test.ts`

**Interfaces:**
- Consumes: `FundQuote` from `src/fund-types.ts`.
- Produces: `canSearchFunds(keyword: string): boolean`, `toFundSearchOptions(items: FundQuote[]): FundSearchOption[]`, and `createSelectedFundQuery(code: string, limit: number): SelectedFundQuery`.

- [ ] **Step 1: Write the failing tests**

```ts
const quote: FundQuote = {
  code: "159915", name: "创业板ETF", market: "on_exchange", fundType: "ETF",
  price: 1.5, changePercent: 1.2, dataDate: "2026-07-13",
  updatedAt: "2026-07-13T07:00:00.000Z", isTradingDay: true,
  officialNavAvailable: true, source: "东方财富 ETF 行情"
};

test("fund suggestions require two trimmed characters", () => {
  assert.equal(canSearchFunds("创"), false);
  assert.equal(canSearchFunds(" 创业 "), true);
});

test("fund options preserve real quote identity", () => {
  assert.deepEqual(toFundSearchOptions([quote]), [{ value: "159915", name: "创业板ETF", code: "159915", market: "on_exchange", fundType: "ETF" }]);
});

test("selecting a fund creates an exact code query", () => {
  assert.deepEqual(createSelectedFundQuery("159915", 20), { keyword: "159915", matchBy: "code", market: "all", sort: "change_desc", limit: 20 });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test`

Expected: TypeScript fails because `src/fund-search.ts` does not exist.

- [ ] **Step 3: Implement the minimal helper**

```ts
export interface FundSearchOption {
  value: string;
  name: string;
  code: string;
  market: "on_exchange" | "off_exchange";
  fundType: string;
}

export interface SelectedFundQuery {
  keyword: string;
  matchBy: "code";
  market: "all";
  sort: "change_desc";
  limit: number;
}

export const canSearchFunds = (keyword: string) => keyword.trim().length >= 2;
export const toFundSearchOptions = (items: FundQuote[]): FundSearchOption[] =>
  items.map(({ code, name, market, fundType }) => ({ value: code, code, name, market, fundType }));
export const createSelectedFundQuery = (code: string, limit: number): SelectedFundQuery => ({
  keyword: code, matchBy: "code", market: "all", sort: "change_desc", limit
});
```

- [ ] **Step 4: Run the tests and verify GREEN**

Run: `npm test`

Expected: all existing tests plus the three fund-search tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/fund-search.ts test/fund-search.test.ts
git commit -m "test: define fund search behavior"
```

### Task 2: Real-data suggestion API

**Files:**
- Modify: `web/api.ts`
- Modify: `web/types.ts`

**Interfaces:**
- Consumes: `canSearchFunds` and `toFundSearchOptions` from Task 1.
- Produces: `fetchFundSuggestions(keyword: string, signal?: AbortSignal): Promise<FundSearchOption[]>`.

- [ ] **Step 1: Add the typed suggestion contract**

```ts
export type { FundSearchOption } from "../src/fund-search";
```

- [ ] **Step 2: Add suggestion retrieval through the existing fallback-aware query**

```ts
export async function fetchFundSuggestions(keyword: string, signal?: AbortSignal): Promise<FundSearchOption[]> {
  if (!canSearchFunds(keyword)) return [];
  const snapshot = await fetchFundSnapshot({
    keyword: keyword.trim(), matchBy: "all", market: "all", sort: "name", limit: 8
  }, signal);
  return toFundSearchOptions(snapshot.items);
}
```

- [ ] **Step 3: Verify type checking and existing fallback behavior**

Run: `npm run build`

Expected: TypeScript and Vite builds complete without errors.

- [ ] **Step 4: Commit**

```bash
git add web/api.ts web/types.ts
git commit -m "feat: add real fund suggestion query"
```

### Task 3: Autocomplete and immediate exact query

**Files:**
- Modify: `web/components/FilterBar.tsx`
- Modify: `web/App.tsx`
- Modify: `web/styles.css`

**Interfaces:**
- Consumes: `FundSearchOption`, `fetchFundSuggestions`, and `createSelectedFundQuery`.
- Produces: a controlled Mantine autocomplete with `onKeywordChange` and `onFundSelect` callbacks.

- [ ] **Step 1: Add suggestion state and cancellation in `App`**

```tsx
const [suggestions, setSuggestions] = useState<FundSearchOption[]>([]);
const [suggestionsLoading, setSuggestionsLoading] = useState(false);
const [suggestionError, setSuggestionError] = useState<string>();
const suggestionControllerRef = useRef<AbortController>();
```

- [ ] **Step 2: Debounce suggestion requests by 250ms**

Use `useDebouncedValue(query.keyword, 250)` and an effect that cancels the previous controller, skips fewer than two characters, calls `fetchFundSuggestions`, and leaves `snapshot` untouched on failure.

```tsx
const [debouncedKeyword] = useDebouncedValue(query.keyword, 250);
useEffect(() => {
  suggestionControllerRef.current?.abort();
  if (!canSearchFunds(debouncedKeyword) || query.matchBy === "code") {
    setSuggestions([]); setSuggestionError(undefined); setSuggestionsLoading(false); return;
  }
  const controller = new AbortController();
  suggestionControllerRef.current = controller;
  setSuggestionsLoading(true); setSuggestionError(undefined);
  void fetchFundSuggestions(debouncedKeyword, controller.signal)
    .then(setSuggestions)
    .catch((caught) => { if ((caught as Error).name !== "AbortError") setSuggestionError("暂时无法获取搜索建议"); })
    .finally(() => { if (suggestionControllerRef.current === controller) setSuggestionsLoading(false); });
  return () => controller.abort();
}, [debouncedKeyword, query.matchBy]);
```

- [ ] **Step 3: Replace `TextInput` with Mantine `Autocomplete`**

```tsx
<Autocomplete
  label="搜索基金"
  placeholder="输入基金名称或代码，如：创业板ETF、159915"
  value={query.keyword}
  data={suggestions.map((item) => ({ value: item.code, label: item.name }))}
  limit={8}
  maxDropdownHeight={320}
  nothingFoundMessage={suggestionError || "未找到匹配基金"}
  rightSection={suggestionsLoading ? <Loader size={16} /> : <IconSearch size={16} />}
  onChange={onKeywordChange}
  onOptionSubmit={onFundSelect}
  renderOption={({ option }) => {
    const item = suggestions.find((candidate) => candidate.code === option.value);
    if (!item) return option.label;
    return <div className="fund-search-option">
      <Text size="sm" fw={650} truncate>{item.name}</Text>
      <Group gap={6} wrap="nowrap">
        <Text size="xs" c="dimmed">{item.code}</Text>
        <Badge size="xs" variant="light">{item.market === "on_exchange" ? "场内" : "场外"}</Badge>
        <Text size="xs" c="dimmed" truncate>{item.fundType}</Text>
      </Group>
    </div>;
  }}
/>
```

- [ ] **Step 4: Implement immediate selection**

```tsx
const selectFund = (code: string) => {
  const nextQuery = createSelectedFundQuery(code, query.limit);
  setQuery(nextQuery);
  setSuggestions([]);
  void runQuery(nextQuery);
};
```

When the user edits the input after a code selection, update `{ keyword, matchBy: /^\d{6}$/.test(keyword.trim()) ? "code" : "all" }` so name search is restored automatically.

- [ ] **Step 5: Stabilize desktop and mobile rendering**

```css
.fund-search-option {
  width: 100%;
  min-width: 0;
  min-height: 48px;
  padding: 4px 0;
  overflow: hidden;
}
.fund-search-option .mantine-Text-root {
  min-width: 0;
}
@media (max-width: 48em) {
  .fund-search-option {
    max-width: calc(100vw - 64px);
  }
}
```

- [ ] **Step 6: Build and run all automated tests**

Run: `npm test`

Expected: all tests pass and Vite produces the web bundle.

- [ ] **Step 7: Commit**

```bash
git add web/App.tsx web/components/FilterBar.tsx web/styles.css
git commit -m "feat: add instant fund autocomplete"
```

### Task 4: Browser regression and deployment

**Files:**
- Modify only if verification exposes a defect in the files from Tasks 1-3.

**Interfaces:**
- Consumes: local Vite/web server and the deployed Sites URL.
- Produces: verified desktop/mobile search behavior and a published commit.

- [ ] **Step 1: Start the production-like local server**

Run: `npm run web`

Expected: the server reports a local URL and both API and React assets respond successfully.

- [ ] **Step 2: Verify the desktop search flow**

At a desktop viewport, enter `创业板ETF`, wait for suggestions, confirm each option shows name/code/market, click `159915`, and confirm the result table contains code `159915` without moving the table header or overview card.

- [ ] **Step 3: Verify the mobile search flow**

At a 390x844 viewport, repeat the same flow and confirm the dropdown stays inside the viewport, long names truncate cleanly, and selection immediately refreshes the list.

- [ ] **Step 4: Verify fallback search**

Block or fail the live `/api/funds` request, enter `创业板ETF`, and confirm suggestions still come from `data/funds.json` and contain real exported fund records.

- [ ] **Step 5: Run final verification**

Run: `npm test`

Expected: all tests pass with zero failures.

- [ ] **Step 6: Push and deploy**

```bash
git push origin feat/local-mcp-web-demo
```

Confirm the configured GitHub Pages workflow and Sites deployment complete, then repeat the desktop search flow against `https://fund-market-radar.gabbiyabbiy9.chatgpt.site/`.
