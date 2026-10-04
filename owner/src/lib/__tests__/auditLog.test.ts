import { describe, it, expect, beforeEach } from "vitest";
import { logAction, loadAuditLog, clearAuditLog } from "../auditLog";

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

describe("本机操作日志", () => {
  it("新→旧、含明细", () => {
    logAction("盘点提交", "2 项调整");
    logAction("报损登记", "牛肉 -1kg");
    const list = loadAuditLog();
    expect(list).toHaveLength(2);
    expect(list[0].action).toBe("报损登记");
    expect(list[0].detail).toBe("牛肉 -1kg");
    expect(list[0].at).toBeGreaterThan(0);
    expect(list[1].action).toBe("盘点提交");
  });

  it("上限 500 条", () => {
    for (let i = 0; i < 510; i++) logAction("动作", `n${i}`);
    const list = loadAuditLog();
    expect(list).toHaveLength(500);
    expect(list[0].detail).toBe("n509");
  });

  it("坏数据不炸、清空可用", () => {
    store.set("owner:audit:log", "{oops");
    expect(loadAuditLog()).toEqual([]);
    logAction("A");
    clearAuditLog();
    expect(loadAuditLog()).toEqual([]);
  });
});
