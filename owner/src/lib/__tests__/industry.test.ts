import { describe, it, expect, beforeEach } from "vitest";
import {
  BENCHMARKS,
  benchmarks,
  getBizType,
  setBizType,
  rangeVerdict,
  wasteVerdict,
  pctText,
  DEFAULT_BIZ,
} from "../industry";

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

describe("行业基准", () => {
  it("每个业态区间合法", () => {
    for (const [k, b] of Object.entries(BENCHMARKS)) {
      expect(b.foodCost[0], k).toBeLessThan(b.foodCost[1]);
      expect(b.wasteMax, k).toBeGreaterThan(0);
      expect(b.labor[0], k).toBeLessThan(b.labor[1]);
    }
  });

  it("业态选择默认中文餐、可持久化、脏值回落", () => {
    expect(getBizType()).toBe(DEFAULT_BIZ);
    setBizType("hotpot");
    expect(getBizType()).toBe("hotpot");
    expect(benchmarks().wasteMax).toBe(BENCHMARKS.hotpot.wasteMax);
    store.set("owner:biz:type", JSON.stringify("不存在"));
    expect(getBizType()).toBe(DEFAULT_BIZ);
  });

  it("区间判定与损耗判定", () => {
    const b = BENCHMARKS.chinese;
    expect(rangeVerdict(30, b.foodCost)).toBe("ok");
    expect(rangeVerdict(45, b.foodCost)).toBe("high");
    expect(rangeVerdict(20, b.foodCost)).toBe("low");
    expect(wasteVerdict(1.2, b.wasteMax)).toBe("ok");
    expect(wasteVerdict(5.5, b.wasteMax)).toBe("high");
    expect(pctText(b.foodCost)).toBe("28%~35%");
  });
});
