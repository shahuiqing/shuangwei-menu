import { describe, it, expect } from "vitest";
import { computeExpiry, expiryAlerts } from "../expiry";
import type { InventoryItem } from "../inventory";

const item = (p: Partial<InventoryItem>): InventoryItem => ({
  id: "I1",
  name: "牛肉",
  category: "食材",
  stock: 5,
  unit: "kg",
  safety_stock: 0,
  price: 100,
  ...p,
});

describe("computeExpiry", () => {
  const now = new Date("2026-10-05T00:00:00Z");

  it("无保质期或无采购时状态 unknown", () => {
    const rows = computeExpiry(
      [item({ shelf_life_days: undefined })],
      new Map(),
      now,
    );
    expect(rows[0].status).toBe("unknown");
    expect(rows[0].daysLeft).toBeNull();
  });

  it("已过期（剩余天数为负）", () => {
    const rows = computeExpiry(
      [item({ shelf_life_days: 3 })],
      new Map([["I1", "2026-09-30T00:00:00Z"]]), // 3 天后 10-03，已过 2 天
      now,
    );
    expect(rows[0].status).toBe("expired");
    expect(rows[0].daysLeft).toBeLessThan(0);
  });

  it("临期（剩余天数 <= 阈值 3）", () => {
    const rows = computeExpiry(
      [item({ shelf_life_days: 7 })],
      new Map([["I1", "2026-10-01T00:00:00Z"]]), // 10-08 到期，剩 3 天
      now,
    );
    expect(rows[0].status).toBe("expiring");
    expect(rows[0].daysLeft).toBe(3);
  });

  it("正常（剩余天数 > 阈值）", () => {
    const rows = computeExpiry(
      [item({ shelf_life_days: 30 })],
      new Map([["I1", "2026-10-01T00:00:00Z"]]),
      now,
    );
    expect(rows[0].status).toBe("ok");
    expect(rows[0].daysLeft).toBeGreaterThan(3);
  });

  it("expiryAlerts 分类过期与临期", () => {
    const rows = computeExpiry(
      [
        item({ id: "A", shelf_life_days: 3 }),
        item({ id: "B", shelf_life_days: 5 }),
        item({ id: "C", shelf_life_days: 30 }),
        item({ id: "D" }),
      ],
      new Map([
        ["A", "2026-09-30T00:00:00Z"], // 过期
        ["B", "2026-10-03T00:00:00Z"], // 10-08 到期，剩 3 天
        ["C", "2026-10-01T00:00:00Z"], // ok
      ]),
      now,
    );
    const { expired, expiring } = expiryAlerts(rows);
    expect(expired.map((r) => r.itemId)).toEqual(["A"]);
    expect(expiring.map((r) => r.itemId)).toEqual(["B"]);
  });
});
