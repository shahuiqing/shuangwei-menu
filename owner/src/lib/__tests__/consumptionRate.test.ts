import { describe, it, expect } from "vitest";
import {
  dailyUsageRate,
  recentRate,
  rateDeviation,
  isRateAnomaly,
} from "../consumptionRate";

const DAY = 86400000;
const now = Date.now();
const p = (daysAgo: number, qty: number) => ({ at: now - daysAgo * DAY, qty });

describe("不可盘类消耗率", () => {
  it("长期平均日消耗 = 总量 ÷ 跨度", () => {
    // 30 天前 15kg，今天 15kg，共 30kg / 30 天 = 1
    const rate = dailyUsageRate([p(30, 15), p(0, 15)]);
    expect(rate).toBeCloseTo(1, 5);
  });

  it("少于两次采购返回 0", () => {
    expect(dailyUsageRate([p(0, 10)])).toBe(0);
    expect(dailyUsageRate([])).toBe(0);
  });

  it("近窗口日消耗", () => {
    expect(recentRate([p(10, 5), p(0, 5)], 30)).toBeCloseTo(10 / 30, 5);
  });

  it("偏差与异常判定", () => {
    // 长期 200kg/100天 = 2/天；近 30 天 100kg → 3.33/天 → 偏差 1.67
    const hist = [p(100, 100), p(0, 100)];
    expect(dailyUsageRate(hist)).toBeCloseTo(2, 5);
    expect(rateDeviation(hist, 30)).toBeCloseTo(100 / 30 / 2, 5);
    expect(isRateAnomaly(hist, 30, 0.5)).toBe(true);
  });
});
