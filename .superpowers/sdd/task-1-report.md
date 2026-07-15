# Task 1 Report

状态：DONE_WITH_CONCERNS

## 改动文件

- `src/fund-performance.ts`
- `src/fund-types.ts`
- `web/types.ts`
- `test/fund-performance.test.ts`

## RED

命令：`npm run build`

结果：失败，退出码 2。失败原因为测试先导入的 `../src/fund-performance.js` 尚不存在，TypeScript 报 `TS2307: Cannot find module '../src/fund-performance.js'`。

## GREEN

命令：`npm run build && node --test build/test/fund-performance.test.js`

结果：构建成功，目标测试 3/3 通过，退出码 0。

完整回归：`npm test`，46/46 通过，退出码 0。

## Commit

- 实现 commit：`6667989` (`feat: add fund performance ranges`)

## 自查与风险

- `git diff --check` 和暂存区检查通过；未修改 brief 之外的代码文件。
- 实现过滤无效日期/净值，按日期排序，使用 UTC 日期运算，支持 half-month、month、quarter、year、year-to-date，并将收益率按两位小数归一化。
- 现有 `src/fund-service.ts` 的两个详情适配器仍只返回基础详情且本任务禁止修改该文件，因此 `FundDetail` 暂以 `Partial<FundResearchDetail>` 保持构建兼容。后续详情数据接入任务应补齐这些字段，并评估是否恢复 `FundDetail` 对研究字段的必需约束。
