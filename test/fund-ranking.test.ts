import assert from "node:assert/strict";
import test from "node:test";

import { parseExchangeFundRankingText, parseOpenFundRankingText, parsePublishedNumber, shiftDate } from "../src/fund-service.js";

test("parses observed open-fund period returns from Eastmoney ranking data", () => {
  const text = 'var rankData = {datas:["001480,财通成长优选混合A,CTCZYXHHA,2026-07-10,8.412,8.412,-4.49,-8.56,3.08,68.31,109.46,335.18,379.59,391.36,111.57,741.2,2015-06-29,1,-13.7319,1.50%,0.15%,1,0.15%,1,296.61"],allRecords:1};';

  const ranking = parseOpenFundRankingText(text);

  assert.deepEqual(ranking.get("001480"), {
    today: -4.49,
    week: -8.56,
    month: 3.08,
    custom: -13.7319
  });
});

test("parses observed exchange-fund weekly and monthly returns", () => {
  const text = 'var rankData = {datas:["588170,科创半导体ETF华夏,KCBDTETFHX,2026-07-10,1.262,3.786,6.87,46.06,119.67,118.1,272.16,,,151.95,278.6,2025-03-24,,,,,,指数型-股票,"],allRecords:1};';

  const ranking = parseExchangeFundRankingText(text);

  assert.deepEqual(ranking.get("588170"), { week: 6.87, month: 46.06 });
});

test("ranking parser leaves missing returns absent instead of inventing values", () => {
  const text = 'var rankData = {datas:["000001,测试基金,CSJJ,2026-07-10,1.0000,1.0000,,,,,,,,,,,2020-01-01,1,,0%,0%,1,0%,1,"],allRecords:1};';

  assert.deepEqual(parseOpenFundRankingText(text).get("000001"), {});
});

test("published fund values keep missing upstream fields absent instead of converting them to zero", () => {
  assert.equal(parsePublishedNumber(""), undefined);
  assert.equal(parsePublishedNumber("-"), undefined);
  assert.equal(parsePublishedNumber(undefined), undefined);
  assert.equal(parsePublishedNumber("0"), 0);
  assert.equal(parsePublishedNumber("1.2345"), 1.2345);
});

test("shifts Shanghai market dates without crossing a UTC day boundary", () => {
  assert.equal(shiftDate("2026-07-09", -1), "2026-07-08");
  assert.equal(shiftDate("2026-07-10", -15), "2026-06-25");
});
