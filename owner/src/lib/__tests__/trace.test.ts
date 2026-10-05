import { describe, it, expect } from "vitest";
import {
  orderTraceRows,
  traceTotals,
  latestPurchases,
  outOrderRows,
  outSummary,
} from "../trace";
import type { InventoryTransaction } from "../inventory";

const txn = (p: Partial<InventoryTransaction>): InventoryTransaction => ({
  id: "t1",
  item_id: "I1",
  item_name: "五花肉",
  type: "order_out",
  quantity: -1,
  unit: "kg",
  unit_cost: 30,
  reference: "O1",
  notes: "红烧肉",
  ...p,
});

describe("orderTraceRows", () => {
  it("聚合 原料×菜品，只取 order_out，数量取绝对值", () => {
    const rows = orderTraceRows([
      txn({ item_id: "A", quantity: -0.5, unit_cost: 20 }),
      txn({ item_id: "A", quantity: -0.3, unit_cost: 20 }),
      txn({ item_id: "A", notes: "回锅肉", quantity: -0.2, unit_cost: 20 }),
      txn({ item_id: "B", type: "purchase_in", quantity: 10 }),
      txn({ item_id: "C", quantity: -1, unit_cost: 5, notes: "" }),
    ]);
    expect(rows).toHaveLength(3);
    const a1 = rows.find((r) => r.itemId === "A" && r.dish === "红烧肉")!;
    expect(a1.qty).toBeCloseTo(0.8);
    expect(a1.cost).toBeCloseTo(16);
    const a2 = rows.find((r) => r.itemId === "A" && r.dish === "回锅肉")!;
    expect(a2.qty).toBeCloseTo(0.2);
    expect(rows.find((r) => r.itemId === "C")!.dish).toBe("未标记菜品");
  });

  it("按成本降序", () => {
    const rows = orderTraceRows([
      txn({ item_id: "cheap", quantity: -1, unit_cost: 1 }),
      txn({
        item_id: "rich",
        item_name: "藏红花",
        quantity: -1,
        unit_cost: 99,
      }),
    ]);
    expect(rows[0].itemId).toBe("rich");
  });

  it("空输入返回空数组", () => {
    expect(orderTraceRows([])).toEqual([]);
  });
});

describe("traceTotals", () => {
  it("成本求和、原料去重计数", () => {
    const rows = orderTraceRows([
      txn({ item_id: "A", quantity: -1, unit_cost: 10 }),
      txn({ item_id: "A", notes: "另一道菜", quantity: -2, unit_cost: 10 }),
      txn({ item_id: "B", quantity: -1, unit_cost: 5 }),
    ]);
    const t = traceTotals(rows);
    expect(t.cost).toBeCloseTo(35);
    expect(t.items).toBe(2);
    expect(t.qty).toBeCloseTo(4);
  });

  it("空数组为 0", () => {
    expect(traceTotals([])).toEqual({ cost: 0, qty: 0, items: 0 });
  });
});

describe("latestPurchases", () => {
  it("每原料取最近一次采购，输入乱序亦可", () => {
    const m = latestPurchases([
      {
        id: "PO1",
        supplier: "旧供应商",
        item_id: "A",
        item_name: "五花肉",
        quantity: 10,
        unit: "kg",
        unit_price: 28,
        total_cost: 280,
        purchased_at: "2026-09-01T00:00:00Z",
      },
      {
        id: "PO2",
        supplier: "新供应商",
        item_id: "A",
        item_name: "五花肉",
        quantity: 5,
        unit: "kg",
        unit_price: 32,
        total_cost: 160,
        purchased_at: "2026-10-01T00:00:00Z",
      },
      {
        id: "PO3",
        supplier: "蔬菜商",
        item_id: "B",
        item_name: "青菜",
        quantity: 20,
        unit: "kg",
        unit_price: 4,
        total_cost: 80,
        purchased_at: "2026-09-15T00:00:00Z",
      },
    ]);
    expect(m.get("A")!.id).toBe("PO2");
    expect(m.get("B")!.id).toBe("PO3");
    expect(m.size).toBe(2);
  });
});

describe("outOrderRows / outSummary", () => {
  it("按订单去重、取首条时间、限制条数", () => {
    const txns = [
      txn({
        reference: "O1",
        quantity: -1,
        created_at: "2026-10-01T10:00:00Z",
      }),
      txn({
        reference: "O1",
        quantity: -2,
        created_at: "2026-10-01T11:00:00Z",
      }),
      txn({
        reference: "O2",
        quantity: -0.5,
        created_at: "2026-10-02T10:00:00Z",
        notes: "",
      }),
    ];
    const rows = outOrderRows(txns);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ orderId: "O1", qty: 1 });
    expect(rows[1].dish).toBe("—");
    const s = outSummary(rows);
    expect(s.orders).toBe(2);
    expect(s.qty).toBeCloseTo(1.5);
  });

  it("limit 截断", () => {
    const txns = Array.from({ length: 30 }, (_, i) =>
      txn({ reference: `O${i}`, quantity: -1 }),
    );
    expect(outOrderRows(txns, 20)).toHaveLength(20);
  });

  it("忽略无 reference 的行", () => {
    expect(outOrderRows([txn({ reference: "" })])).toEqual([]);
  });
});
