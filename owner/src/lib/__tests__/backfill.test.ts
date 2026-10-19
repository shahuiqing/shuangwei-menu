import { describe, it, expect } from "vitest";
import { backfillTotals, applyBackfill, type BackfillEntry } from "../backfill";

const e = (
  day: string,
  revenue: number,
  orders = 0,
  note = "",
  cogs = 0,
): BackfillEntry => ({ day, revenue, orders, cogs, note });

describe("backfillTotals", () => {
  const list = [
    e("2026-09-28", 100, 2),
    e("2026-10-01", 500, 8),
    e("2026-10-05", 300, 4),
  ];

  it("区间内求和，边界日包含", () => {
    const t = backfillTotals(
      list,
      "2026-10-01T00:00:00",
      "2026-10-03T12:00:00",
    );
    expect(t).toEqual({ revenue: 500, orders: 8, cogs: 0 });
  });

  it("含起止边界整天", () => {
    const t = backfillTotals(
      list,
      "2026-09-28T08:00:00",
      "2026-10-05T12:00:00",
    );
    expect(t.revenue).toBe(900);
    expect(t.orders).toBe(14);
  });

  it("无补录为 0", () => {
    expect(backfillTotals([], "2026-10-01", "2026-10-02")).toEqual({
      revenue: 0,
      orders: 0,
      cogs: 0,
    });
  });

  it("补录成本按区间求和", () => {
    const t = backfillTotals(
      [e("2026-10-01", 500, 8, "", 180), e("2026-10-02", 300, 4, "", 120)],
      "2026-10-01T00:00:00",
      "2026-10-02T23:59:59",
    );
    expect(t.cogs).toBe(300);
  });

  it("时区偏移不会把本地日切成前一天", () => {
    const iso = new Date(2026, 9, 19, 4, 0, 0).toISOString();
    const t = backfillTotals(
      [e("2026-10-18", 100, 1), e("2026-10-19", 200, 2)],
      iso,
      iso,
    );
    expect(t).toEqual({ revenue: 200, orders: 2, cogs: 0 });
  });

  it("02:59 截止仍属于前一营业日，不把次日补录算进来", () => {
    const start = new Date(2026, 9, 1, 3, 0, 0).toISOString();
    const end = new Date(2026, 9, 2, 2, 59, 0).toISOString();
    const t = backfillTotals(
      [e("2026-10-01", 100, 1), e("2026-10-02", 200, 2)],
      start,
      end,
    );
    expect(t.revenue).toBe(100);
  });
});

describe("applyBackfill", () => {
  it("已有天累加，缺失天追加，按 day 升序", () => {
    const rows = [
      { day: "2026-10-02", revenue: 10, orders: 1 },
      { day: "2026-10-04", revenue: 20, orders: 2 },
    ];
    const out = applyBackfill(
      rows,
      [
        e("2026-10-04", 5, 1),
        e("2026-10-01", 7, 3),
        e("2026-10-09", 99, 9), // 区间外
      ],
      "2026-10-01T00:00:00",
      "2026-10-05T00:00:00",
    );
    expect(out.map((r) => [r.day, r.revenue, r.orders])).toEqual([
      ["2026-10-01", 7, 3],
      ["2026-10-02", 10, 1],
      ["2026-10-04", 25, 3],
    ]);
  });

  it("无匹配补录时返回原数组引用", () => {
    const rows = [{ day: "2026-10-02", revenue: 1, orders: 1 }];
    expect(applyBackfill(rows, [], "2026-10-01", "2026-10-02")).toBe(rows);
  });

  it("不改动入参（纯函数）", () => {
    const rows = [{ day: "2026-10-02", revenue: 1, orders: 1 }];
    applyBackfill(rows, [e("2026-10-02", 9, 9)], "2026-10-01", "2026-10-03");
    expect(rows[0].revenue).toBe(1);
  });

  it("补录成本叠加到已有日成本", () => {
    const rows = [{ day: "2026-10-02", revenue: 10, cogs: 5 }];
    const out = applyBackfill(
      rows,
      [e("2026-10-02", 10, 1, "", 3)],
      "2026-10-01",
      "2026-10-03",
    );
    expect(out[0].revenue).toBe(20);
    expect(out[0].cogs).toBe(8);
  });
});
