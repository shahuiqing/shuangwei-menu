import { describe, it, expect } from "vitest";
import {
  planAutoDispatches,
  loadAutoAdviceCfg,
  saveAutoAdviceCfg,
  autoAdviceDoneToday,
  markAutoAdviceDay,
  loadAutoAdvice,
  AUTO_PRIORITY_MAX,
  type AutoAdviceRecord,
} from "../autoAdvice";
import type { AdviceItem } from "../advisor";
import { localSet } from "../localdb";
import { beforeEach } from "vitest";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
});

const item = (over: Partial<AdviceItem>): AdviceItem => ({
  area: "inventory",
  priority: 1,
  title: "紧急补货",
  finding: "缺货",
  actions: ["补货"],
  tab: "procurement",
  ...over,
});

describe("planAutoDispatches", () => {
  it("只保留可映射岗位且高优先级的建议", () => {
    const out = planAutoDispatches([
      item({ area: "inventory", priority: 1, title: "紧急补货" }), // ✓ 库存紧急
      item({ area: "inventory", priority: 5, title: "低优库存" }), // ✗ 优先级低
      item({ area: "waste", priority: 2, title: "损耗偏高" }), // ✓ 损耗
      item({ area: "cost", priority: 1, title: "成本" }), // ✗ 成本不自动派
      item({ area: "menu", priority: 1, title: "菜单" }), // ✗ 菜单不自动派
    ]);
    expect(out.map((p) => p.item.title)).toEqual(["紧急补货", "损耗偏高"]);
    expect(out[0].roles).toEqual(["helper"]);
  });

  it("阈值边界：priority 正好等于阈值会被派发", () => {
    const out = planAutoDispatches([
      item({ area: "waste", priority: AUTO_PRIORITY_MAX }),
    ]);
    expect(out.length).toBe(1);
  });

  it("空输入返回空", () => {
    expect(planAutoDispatches([])).toEqual([]);
  });
});

describe("配置", () => {
  it("默认开启", () => {
    expect(loadAutoAdviceCfg().enabled).toBe(true);
  });

  it("保存后可回读", () => {
    saveAutoAdviceCfg({ enabled: false });
    expect(loadAutoAdviceCfg().enabled).toBe(false);
    saveAutoAdviceCfg({ enabled: true });
    expect(loadAutoAdviceCfg().enabled).toBe(true);
  });
});

describe("运行记录", () => {
  it("未标记时今天未完成", () => {
    localSet("owner:auto-advice-day", "2000-01-01");
    expect(autoAdviceDoneToday()).toBe(false);
  });

  it("标记后今天已完成", () => {
    markAutoAdviceDay("2026-11-16");
    expect(autoAdviceDoneToday("2026-11-16")).toBe(true);
  });

  it("记录可保存与回读", () => {
    const rec: AutoAdviceRecord = {
      day: "2026-11-16",
      at: "2026-11-16T10:00:00.000Z",
      enabled: true,
      considered: 5,
      dispatched: [
        { title: "紧急补货", area: "库存", roles: ["帮厨"], count: 2 },
      ],
    };
    localSet("owner:auto-advice", rec);
    expect(loadAutoAdvice()).toEqual(rec);
  });

  it("坏记录返回 null", () => {
    localSet("owner:auto-advice", { foo: 1 });
    expect(loadAutoAdvice()).toBeNull();
  });
});
