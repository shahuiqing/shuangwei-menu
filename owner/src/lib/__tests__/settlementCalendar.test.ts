import { describe, it, expect } from "vitest";
import {
  monthBounds,
  buildMonthCells,
  fmtCompactMoney,
  revenueHeat,
  heatColor,
} from "../settlementCalendar";

describe("日结日历：月份边界", () => {
  it("普通月份", () => {
    expect(monthBounds(2026, 9)).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
      days: 31,
    });
  });

  it("闰年二月", () => {
    expect(monthBounds(2024, 1)).toEqual({
      from: "2024-02-01",
      to: "2024-02-29",
      days: 29,
    });
    expect(monthBounds(2026, 1).days).toBe(28);
  });
});

describe("日结日历：月历格子", () => {
  const points = [
    { day: "2026-10-01", revenue: 100, orders: 2 },
    { day: "2026-10-03", revenue: 250, orders: 5 },
    { day: "2026-10-31", revenue: 0, orders: 1 },
  ];

  it("周一起始、前导空位与整周补齐", () => {
    // 2026-10-01 是周四 => 前导 3 个空位（周一/二/三）
    const cells = buildMonthCells(2026, 9, points, "2026-10-20");
    expect(cells.slice(0, 3)).toEqual([null, null, null]);
    expect(cells.length % 7).toBe(0);
    const first = cells[3];
    expect(first?.day).toBe(1);
    expect(first?.revenue).toBe(100);
    expect(first?.hasData).toBe(true);
  });

  it("标记今天、未来与无数据", () => {
    const cells = buildMonthCells(2026, 9, points, "2026-10-20");
    const byDay = new Map(cells.filter(Boolean).map((c) => [c!.day, c!]));
    expect(byDay.get(20)?.today).toBe(true);
    expect(byDay.get(21)?.future).toBe(true);
    expect(byDay.get(20)?.future).toBe(false);
    // 10-31 有订单但营收为 0，仍算有数据
    expect(byDay.get(31)?.hasData).toBe(true);
    expect(byDay.get(31)?.future).toBe(true);
    expect(byDay.get(2)?.hasData).toBe(false);
  });

  it("缺少某天时补零而非缺失格子", () => {
    const cells = buildMonthCells(2026, 9, points, "2026-10-20");
    const day2 = cells.find((c) => c?.day === 2);
    expect(day2).toMatchObject({ revenue: 0, orders: 0, hasData: false });
  });
});

describe("日结日历：格式化与热力", () => {
  it("紧凑金额", () => {
    expect(fmtCompactMoney(0)).toBe("");
    expect(fmtCompactMoney(316.67)).toBe("317");
    expect(fmtCompactMoney(9999)).toBe("9999");
    expect(fmtCompactMoney(12000)).toBe("1.2万");
    expect(fmtCompactMoney(156000)).toBe("16万");
  });

  it("热力归一化并保底可见", () => {
    expect(revenueHeat(0, 100)).toBe(0);
    expect(revenueHeat(50, 0)).toBe(0);
    expect(revenueHeat(100, 100)).toBe(1);
    expect(revenueHeat(1, 100)).toBe(0.1);
  });

  it("热力颜色带 alpha", () => {
    expect(heatColor("#c0392b", 0)).toBe("transparent");
    expect(heatColor("#c0392b", 1)).toMatch(/^#c0392b[0-9a-f]{2}$/);
  });
});
