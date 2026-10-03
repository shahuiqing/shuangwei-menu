import { describe, it, expect } from "vitest";
import {
  REASONS,
  normalizeReason,
  todayWasteAmount,
  txnAmount,
  wasteRows,
  wasteSummary,
} from "../waste";
import type { InventoryTransaction } from "../inventory";

const DAY = 86400000;
const NOW = Date.parse("2026-01-10T12:00:00Z");
const bounds = { start: NOW - 3 * DAY, end: NOW };

const txn = (
  o: Partial<InventoryTransaction> & { created_at: string },
): InventoryTransaction => ({
  id: o.id || `t-${o.created_at}`,
  item_id: "beef",
  item_name: "牛腩",
  type: "waste",
  quantity: 1,
  unit: "kg",
  unit_cost: 10,
  ...o,
});

describe("normalizeReason", () => {
  it("空值与未知原因归入其他", () => {
    expect(normalizeReason("")).toBe("其他");
    expect(normalizeReason(undefined)).toBe("其他");
    expect(normalizeReason("看不出来的写法")).toBe("其他");
  });
  it("白名单原因原样保留", () => {
    REASONS.forEach((r) => expect(normalizeReason(r)).toBe(r));
  });
});

describe("txnAmount", () => {
  it("取绝对值 × 单价，与正负号无关", () => {
    expect(txnAmount(txn({ quantity: -2, unit_cost: 15 }))).toBe(30);
    expect(txnAmount(txn({ quantity: 2, unit_cost: 15 }))).toBe(30);
  });
});

describe("wasteSummary", () => {
  const rows = [
    txn({
      created_at: new Date(NOW - 1 * DAY).toISOString(),
      quantity: -2,
      unit_cost: 10,
      reason: "过期",
      item_name: "牛腩",
    }),
    txn({
      created_at: new Date(NOW - 1 * DAY).toISOString(),
      quantity: -1,
      unit_cost: 50,
      reason: "做坏",
      item_name: "龙虾",
    }),
    txn({
      created_at: new Date(NOW - 2 * DAY).toISOString(),
      quantity: -1,
      unit_cost: 20,
      reason: "",
      item_name: "牛腩",
    }),
    // 区间外，应被过滤
    txn({
      created_at: new Date(NOW - 9 * DAY).toISOString(),
      quantity: -1,
      unit_cost: 999,
      reason: "丢失",
      item_name: "旧的",
    }),
    // 非报损流水，应被过滤
    txn({
      created_at: new Date(NOW - 1 * DAY).toISOString(),
      type: "order_out",
      quantity: -1,
      unit_cost: 100,
      item_name: "出库的",
    }),
  ];

  const s = wasteSummary(rows, bounds, 700, 350);

  it("汇总金额、笔数、单笔最高", () => {
    expect(s.count).toBe(3);
    expect(s.amount).toBe(20 + 50 + 20);
    expect(s.maxOne).toBe(50);
  });

  it("损耗率 = 损耗额 ÷ 营收 / ÷ COGS", () => {
    expect(s.rateOnRevenue).toBeCloseTo((90 / 700) * 100, 5);
    expect(s.rateOnCogs).toBeCloseTo((90 / 350) * 100, 5);
  });

  it("营收为 0 时不产生除零", () => {
    const z = wasteSummary(rows, bounds, 0, 0);
    expect(z.rateOnRevenue).toBe(0);
    expect(z.rateOnCogs).toBe(0);
  });

  it("按原因分组，空原因归入其他，未知原因不丢金额", () => {
    const map = Object.fromEntries(s.byReason.map((r) => [r.name, r.amount]));
    expect(map["过期"]).toBe(20);
    expect(map["做坏"]).toBe(50);
    expect(map["其他"]).toBe(20);
    expect(s.byReason.reduce((x, r) => x + r.amount, 0)).toBe(90);
  });

  it("按原料分组按金额降序", () => {
    expect(s.byItem[0].key).toBe("龙虾");
    expect(s.byItem[0].cost).toBe(50);
  });

  it("按天升序", () => {
    expect(s.byDay.length).toBe(2);
    expect(s.byDay[0].key < s.byDay[1].key).toBe(true);
  });

  it("wasteRows 返回区间内报损流水并按时间倒序", () => {
    const r = wasteRows(rows, bounds);
    expect(r).toHaveLength(3);
    expect(r[0].item_name).toBe("牛腩");
  });
});

describe("todayWasteAmount", () => {
  it("只统计今天的报损", () => {
    const today = new Date();
    today.setHours(10, 0, 0, 0);
    const yest = new Date(today.getTime() - DAY);
    const list = [
      txn({ created_at: today.toISOString(), quantity: -3, unit_cost: 10 }),
      txn({ created_at: yest.toISOString(), quantity: -3, unit_cost: 10 }),
    ];
    expect(todayWasteAmount(list)).toBe(30);
  });
});
