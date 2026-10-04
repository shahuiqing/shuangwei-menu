import { describe, it, expect, beforeEach } from "vitest";
import {
  markStocktake,
  lastStocktakeAt,
  daysSinceStocktake,
  stocktakeDue,
  lastStocktakeDay,
  stocktakeCount,
  stocktakeConfidence,
} from "../stocktakeReminder";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
});

const DAY = 86400000;

describe("盘点提醒", () => {
  it("从未盘点视为应盘", () => {
    expect(lastStocktakeAt()).toBeNull();
    expect(daysSinceStocktake()).toBeNull();
    expect(stocktakeDue()).toBe(true);
  });

  it("记录后可算天数，未到周期不提醒", () => {
    const now = Date.now();
    markStocktake(now - 3 * DAY);
    expect(daysSinceStocktake(now)).toBe(3);
    expect(stocktakeDue(now, 7)).toBe(false);
  });

  it("超过周期则提醒", () => {
    const now = Date.now();
    markStocktake(now - 9 * DAY);
    expect(stocktakeDue(now, 7)).toBe(true);
  });

  it("上次盘点营业日可读", () => {
    const at = new Date(2026, 9, 3, 10, 0, 0);
    markStocktake(at);
    expect(lastStocktakeDay()).toBe("2026-10-03");
  });
});

describe("盘点置信度", () => {
  it("累计次数并给出置信度", () => {
    expect(stocktakeCount()).toBe(0);
    expect(stocktakeConfidence()).toBe("low");

    markStocktake();
    markStocktake();
    markStocktake();
    expect(stocktakeCount()).toBe(3);
    expect(stocktakeConfidence()).toBe("medium");

    markStocktake();
    markStocktake();
    expect(stocktakeConfidence()).toBe("high");
  });
});
