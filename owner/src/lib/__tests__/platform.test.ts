import { describe, it, expect, beforeEach } from "vitest";
import {
  getCommissionRate,
  setCommissionRate,
  platformNetRevenue,
  platformNetProfit,
} from "../platform";

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

describe("平台抽成率", () => {
  it("默认 20%", () => {
    expect(getCommissionRate()).toBe(0.2);
  });

  it("保存后可读回，并钳制 0-1", () => {
    setCommissionRate(0.25);
    expect(getCommissionRate()).toBe(0.25);
    setCommissionRate(1.5);
    expect(getCommissionRate()).toBe(1);
    setCommissionRate(-0.1);
    expect(getCommissionRate()).toBe(0);
  });
});

describe("平台净利", () => {
  it("净营收 = 营收 × (1 − 抽成)", () => {
    expect(platformNetRevenue(1000, 0.2)).toBeCloseTo(800);
  });

  it("净利 = 营收×(1−抽成) − 配送费 − COGS", () => {
    expect(platformNetProfit(1000, 300, 0.2, 50)).toBeCloseTo(450);
  });
});
