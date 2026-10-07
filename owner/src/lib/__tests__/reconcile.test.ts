import { describe, it, expect } from "vitest";
import { reconcileCost, reconcileFromHistory } from "../reconcile";
import type { StocktakeRecord } from "../stocktakeHistory";

describe("reconcileCost", () => {
  it("真实 COGS = 期初 + 采购 − 期末", () => {
    const r = reconcileCost(10000, 8000, 12000, 5000);
    expect(r.realCogs).toBeCloseTo(6000);
    expect(r.hiddenLoss).toBeCloseTo(1000);
  });

  it("真实 COGS 低于标准时为负隐性损耗（可能盘点有误差）", () => {
    const r = reconcileCost(10000, 8000, 13000, 5000);
    expect(r.realCogs).toBeCloseTo(5000);
    expect(r.hiddenLoss).toBeCloseTo(0);
  });
});

describe("reconcileFromHistory", () => {
  const rec = (at: number, stockValue: number): StocktakeRecord => ({
    at,
    day: "2026-10-05",
    items: 0,
    diffs: 0,
    netValue: 0,
    stockValue,
  });

  it("不足两次盘点返回 null", () => {
    expect(reconcileFromHistory([rec(1, 1000)], 100, 50)).toBeNull();
    expect(reconcileFromHistory([], 100, 50)).toBeNull();
  });

  it("用最近两次盘点做期初/期末对账", () => {
    const records = [rec(10, 12000), rec(5, 10000), rec(1, 9000)]; // 新→旧
    const r = reconcileFromHistory(records, 8000, 5000)!;
    expect(r.realCogs).toBeCloseTo(6000); // 10000 + 8000 − 12000
    expect(r.hiddenLoss).toBeCloseTo(1000);
  });
});
