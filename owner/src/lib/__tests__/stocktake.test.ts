import { describe, it, expect } from "vitest";
import {
  buildStocktake,
  parseCount,
  pendingAdjustments,
  STOCKTAKE_REASON,
} from "../stocktake";
import type { InventoryItem } from "../inventory";

const item = (over: Partial<InventoryItem>): InventoryItem => ({
  id: "I1",
  name: "原料",
  category: "蔬菜",
  stock: 0,
  unit: "kg",
  safety_stock: 0,
  price: 0,
  ...over,
});

describe("parseCount", () => {
  it("空串/非法/负数视为未盘", () => {
    expect(parseCount("")).toBeNull();
    expect(parseCount("  ")).toBeNull();
    expect(parseCount(undefined)).toBeNull();
    expect(parseCount("abc")).toBeNull();
    expect(parseCount("-1")).toBeNull();
    expect(parseCount("NaN")).toBeNull();
  });

  it("合法数字保留两位并接受小数", () => {
    expect(parseCount("3.14159")).toBe(3.14);
    expect(parseCount(" 8 ")).toBe(8);
    expect(parseCount("0")).toBe(0);
  });
});

describe("buildStocktake", () => {
  const items = [
    item({ id: "a", name: "土豆", stock: 20, price: 3 }),
    item({ id: "b", name: "青菜", stock: 10, price: 5 }),
    item({ id: "c", name: "牛肉", stock: 5, price: 40 }),
  ];

  it("差异 = 实盘 − 账面，金额 = 差异 × 单价", () => {
    const r = buildStocktake(items, { a: "18", c: "7" });
    const a = r.rows.find((x) => x.id === "a")!;
    const b = r.rows.find((x) => x.id === "b")!;
    expect(a.actual).toBe(18);
    expect(a.diff).toBe(-2);
    expect(a.value).toBe(-6);
    expect(b.actual).toBeNull();
    expect(b.diff).toBeNull();
    expect(b.value).toBeNull();
  });

  it("汇总只统计已盘项，区分盘亏与盘盈", () => {
    const r = buildStocktake(items, { a: "18", b: "12", c: "7" });
    expect(r.summary.total).toBe(3);
    expect(r.summary.counted).toBe(3);
    expect(r.summary.diffCount).toBe(3);
    expect(r.summary.lossValue).toBe(6); // 土豆 −2×3
    expect(r.summary.gainValue).toBe(90); // 青菜 +2×5、牛肉 +2×40
    expect(r.summary.diffValue).toBe(84);
  });

  it("实盘等于账面不算差异", () => {
    const r = buildStocktake(items, { a: "20", b: "10" });
    expect(r.summary.diffCount).toBe(0);
    expect(r.summary.diffValue).toBe(0);
    expect(pendingAdjustments(r)).toHaveLength(0);
  });

  it("pendingAdjustments 只返回需写库的差异行", () => {
    const r = buildStocktake(items, { a: "20", b: "12" });
    const adj = pendingAdjustments(r);
    expect(adj).toHaveLength(1);
    expect(adj[0].id).toBe("b");
    expect(adj[0].diff).toBe(2);
    expect(STOCKTAKE_REASON).toBe("盘点差异");
  });
});
