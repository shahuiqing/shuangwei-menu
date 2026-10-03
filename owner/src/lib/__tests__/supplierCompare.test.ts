import { describe, it, expect } from "vitest";
import {
  supplierCompare,
  compareInsight,
  rivalItems,
} from "../supplierCompare";
import type { PurchaseOrder } from "../inventory";

const po = (over: Partial<PurchaseOrder>): PurchaseOrder => ({
  id: "P1",
  supplier: "供应商",
  item_id: "a",
  item_name: "土豆",
  quantity: 1,
  unit: "kg",
  unit_price: 1,
  total_cost: 1,
  purchased_at: "2026-01-01",
  ...over,
});

describe("supplierCompare", () => {
  const rows: PurchaseOrder[] = [
    po({ supplier: "老王", quantity: 10, unit_price: 3, total_cost: 30 }),
    po({ supplier: "老王", quantity: 10, unit_price: 5, total_cost: 50 }),
    po({ supplier: "小李", quantity: 20, unit_price: 4, total_cost: 80 }),
    po({ supplier: "老王", item_id: "b", quantity: 9, total_cost: 99 }), // 其他原料，不参与
  ];

  it("按原料过滤并按加权均价升序", () => {
    const s = supplierCompare(rows, "a");
    expect(s.map((x) => x.supplier)).toEqual(["老王", "小李"]);
    expect(s[0].avg).toBe(4); // 80/20
    expect(s[1].avg).toBe(4); // 80/20
  });

  it("标记最低/最高价与金额份额", () => {
    const s = supplierCompare(
      [
        po({ supplier: "贵", quantity: 2, unit_price: 10, total_cost: 20 }),
        po({ supplier: "便宜", quantity: 2, unit_price: 5, total_cost: 10 }),
        po({ supplier: "中间", quantity: 2, unit_price: 8, total_cost: 16 }),
      ],
      "a",
    );
    expect(s[0].supplier).toBe("便宜");
    expect(s[0].level).toBe("best");
    expect(s[s.length - 1].level).toBe("worst");
    expect(s.reduce((t, x) => t + x.share, 0)).toBe(1);
    expect(s[1].level).toBe("mid");
  });

  it("中位价抗极端单价，空供应商归入未知供应商", () => {
    const s = supplierCompare(
      [
        po({ supplier: "", unit_price: 2, quantity: 1, total_cost: 2 }),
        po({ supplier: "", unit_price: 100, quantity: 1, total_cost: 100 }),
        po({ supplier: "", unit_price: 3, quantity: 1, total_cost: 3 }),
      ],
      "a",
    );
    expect(s).toHaveLength(1);
    expect(s[0].supplier).toBe("未知供应商");
    expect(s[0].medianUnit).toBe(3);
    expect(s[0].avg).toBe(35);
  });

  it("只有一家供应商时不分档", () => {
    const s = supplierCompare([po({ unit_price: 5 })], "a");
    expect(s[0].level).toBe("mid");
  });
});

describe("compareInsight", () => {
  const mk = (supplier: string, price: number, qty = 10) =>
    po({ supplier, quantity: qty, unit_price: price, total_cost: price * qty });

  it("两家有价差时给出可省金额与比例", () => {
    const s = supplierCompare([mk("贵", 5), mk("便宜", 4)], "a");
    const i = compareInsight(s);
    expect(i).not.toBeNull();
    expect(i!.best.supplier).toBe("便宜");
    expect(i!.worst.supplier).toBe("贵");
    expect(i!.savePerUnit).toBe(1);
    expect(i!.savePct).toBe(0.2);
    expect(i!.savePerBuy).toBe(10); // 1 × 平均数量 10
  });

  it("价差为 0 或仅一家时返回 null", () => {
    expect(compareInsight(supplierCompare([mk("a", 5)], "a"))).toBeNull();
    expect(
      compareInsight(supplierCompare([mk("a", 5), mk("b", 5)], "a")),
    ).toBeNull();
  });
});

describe("rivalItems", () => {
  it("只保留 ≥2 家供应商的原料并按笔数排序", () => {
    const r = rivalItems([
      po({ item_id: "a", item_name: "土豆", supplier: "A" }),
      po({ item_id: "a", item_name: "土豆", supplier: "B" }),
      po({ item_id: "b", item_name: "青菜", supplier: "A" }),
      po({ item_id: "c", item_name: "牛肉", supplier: "A" }),
      po({ item_id: "c", item_name: "牛肉", supplier: "B" }),
      po({ item_id: "c", item_name: "牛肉", supplier: "C" }),
    ]);
    expect(r.map((x) => x.itemId)).toEqual(["c", "a"]);
    expect(r[0]).toMatchObject({ itemName: "牛肉", suppliers: 3, count: 3 });
  });
});
