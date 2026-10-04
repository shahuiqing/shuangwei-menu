import { describe, it, expect, beforeEach } from "vitest";
import {
  getDailyQuota,
  setDailyQuota,
  quotaOverrun,
  todayQuotaKey,
} from "../dailyQuota";

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

describe("每日定额", () => {
  it("未填返回 null，保存后可读回", () => {
    expect(getDailyQuota("2026-10-03")).toBeNull();
    setDailyQuota("2026-10-03", 500);
    expect(getDailyQuota("2026-10-03")).toBe(500);
  });

  it("负数/非法值视为清除", () => {
    setDailyQuota("2026-10-03", 500);
    setDailyQuota("2026-10-03", -1);
    expect(getDailyQuota("2026-10-03")).toBeNull();
  });

  it("超出定额计算", () => {
    expect(quotaOverrun(600, 500)).toBe(100);
    expect(quotaOverrun(400, 500)).toBe(0);
    expect(quotaOverrun(400, null)).toBeNull();
  });

  it("今日键按营业日生成", () => {
    const at2 = new Date(2026, 9, 3, 2, 0); // 本地 10-03 02:00 → 前一日营业日
    expect(todayQuotaKey(at2)).toBe("2026-10-02");
  });
});
