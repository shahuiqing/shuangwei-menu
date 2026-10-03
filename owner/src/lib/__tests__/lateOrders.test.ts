import { describe, it, expect, beforeEach } from "vitest";
import {
  lateOrders,
  lateNotice,
  loadLateConfig,
  saveLateConfig,
  DEFAULT_LATE,
  MAX_LATE_MIN,
  type LateConfig,
} from "../lateOrders";
import { buildTodos } from "../todo";

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

const CFG: LateConfig = { pendingMin: 10, cookingMin: 20 };
const NOW = Date.parse("2026-10-03T12:00:00Z");
const ago = (min: number) => new Date(NOW - min * 60000).toISOString();

describe("lateOrders 超时判定", () => {
  it("待接单超过阈值才算超时，未超阈值/已完成不计入", () => {
    const list = lateOrders(
      [
        { id: "A1", status: "pending", created_at: ago(15), total: 88 },
        { id: "A2", status: "pending", created_at: ago(5), total: 66 },
        { id: "A3", status: "completed", created_at: ago(99), total: 55 },
        { id: "A4", status: "cooking", created_at: ago(15), total: 44 },
      ],
      CFG,
      NOW,
    );
    expect(list.map((l) => l.id)).toEqual(["A1"]);
    expect(list[0]!.elapsedMin).toBe(15);
    expect(list[0]!.overdueMin).toBe(5);
    expect(list[0]!.kindLabel).toBe("待接单");
  });

  it("制作中用更长阈值，超时程度降序排列", () => {
    const list = lateOrders(
      [
        { id: "B1", status: "cooking", created_at: ago(30), total: 10 },
        { id: "B2", status: "pending", created_at: ago(40), total: 20 },
        { id: "B3", status: "cooking", created_at: ago(22), total: 30 },
      ],
      CFG,
      NOW,
    );
    expect(list.map((l) => l.id)).toEqual(["B2", "B1", "B3"]);
    expect(list[1]!.kindLabel).toBe("制作中");
    expect(list[1]!.overdueMin).toBe(10);
  });

  it("缺 id / 无时间 / 未来时间的订单被跳过", () => {
    const list = lateOrders(
      [
        { status: "pending", created_at: ago(30) },
        { id: "C1", status: "pending" },
        {
          id: "C2",
          status: "pending",
          created_at: new Date(NOW + 60000).toISOString(),
        },
        null,
      ],
      CFG,
      NOW,
    );
    expect(list).toEqual([]);
  });

  it("兼容 _id 与 total_amount 字段", () => {
    const [l] = lateOrders(
      [
        {
          _id: "X9",
          status: "pending",
          created_at: ago(12),
          total_amount: 128,
        },
      ],
      CFG,
      NOW,
    );
    expect(l!.id).toBe("X9");
    expect(l!.total).toBe(128);
  });
});

describe("阈值配置持久化", () => {
  it("保存后可读回，越界值被夹到合法区间", () => {
    const next = saveLateConfig({ pendingMin: 0, cookingMin: 99999 });
    expect(next.pendingMin).toBe(DEFAULT_LATE.pendingMin);
    expect(next.cookingMin).toBe(MAX_LATE_MIN);
    expect(loadLateConfig()).toEqual(next);
  });

  it("无配置返回默认值，坏 JSON 也不炸", () => {
    expect(loadLateConfig()).toEqual(DEFAULT_LATE);
    store.set("owner:late:cfg", "{oops");
    expect(loadLateConfig()).toEqual(DEFAULT_LATE);
  });
});

describe("lateNotice 文案与待办联动", () => {
  it("通知标题含桌号，正文含耗时与阈值", () => {
    const [l] = lateOrders(
      [
        {
          id: "A1",
          status: "pending",
          table_no: "A12",
          created_at: ago(18),
          total: 99,
        },
      ],
      CFG,
      NOW,
    );
    const n = lateNotice(l!);
    expect(n.title).toContain("A12");
    expect(n.body).toContain("18");
    expect(n.body).toContain("阈值 10 分钟");
  });

  it("超时待办权重最高，排在最前", () => {
    const todos = buildTodos({
      low: [],
      priceAlerts: [],
      todayWaste: 0,
      pendingOrders: 3,
      late: [
        {
          id: "A1",
          label: "A12",
          status: "pending",
          kindLabel: "待接单",
          thresholdMin: 10,
          elapsedMin: 18,
          overdueMin: 8,
          total: 99,
        },
      ],
    });
    expect(todos[0]!.id).toBe("late");
    expect(todos[0]!.level).toBe("high");
    expect(todos[0]!.desc).toContain("A12·待接单18分");
  });
});
