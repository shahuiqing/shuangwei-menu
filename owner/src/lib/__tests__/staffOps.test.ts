import { describe, it, expect } from "vitest";
import {
  expandRoleAssignees,
  pickDailyStocktakeItems,
  planAutoDispatch,
  stocktakeDiff,
  dueFromHours,
  isOverdue,
  type StaffMember,
  type TaskTemplate,
} from "../staffOps";

const staff: StaffMember[] = [
  {
    id: "a",
    name: "张三",
    roles: ["waiter"],
    status: "active",
    phone: "",
    note: "",
  },
  {
    id: "b",
    name: "李四",
    roles: ["waiter", "helper"],
    status: "active",
    phone: "",
    note: "",
  },
  {
    id: "c",
    name: "王五",
    roles: ["helper"],
    status: "disabled",
    phone: "",
    note: "",
  },
  {
    id: "d",
    name: "赵六",
    roles: ["cleaner"],
    status: "active",
    phone: "",
    note: "",
  },
];

describe("expandRoleAssignees 按岗位展开到人", () => {
  it("只展开在职员工，停用员工不参与", () => {
    const picked = expandRoleAssignees(["helper"], staff);
    // 王五已停用，只剩李四（兼职帮厨）
    expect(picked.map((s) => s.id)).toEqual(["b"]);
  });

  it("多岗位命中同一员工只派一条", () => {
    const picked = expandRoleAssignees(["waiter", "helper"], staff);
    expect(picked.map((s) => s.id).sort()).toEqual(["a", "b"]);
  });

  it("无匹配岗位返回空", () => {
    expect(expandRoleAssignees(["other"], staff)).toEqual([]);
  });
});

describe("pickDailyStocktakeItems 每日抽盘选品", () => {
  const items = [
    {
      id: "1",
      name: "牛肉",
      zone: "冷冻",
      lastCountedAt: "2026-11-10T00:00:00Z",
    },
    { id: "2", name: "洋葱", zone: "常温", lastCountedAt: null },
    {
      id: "3",
      name: "鸡蛋",
      zone: "常温",
      lastCountedAt: "2026-11-01T00:00:00Z",
    },
    {
      id: "4",
      name: "羊肉",
      zone: "冷冻",
      lastCountedAt: "2026-11-05T00:00:00Z",
    },
  ];

  it("stale_first：从未盘过最优先，按上次盘点时间升序", () => {
    const picked = pickDailyStocktakeItems(
      items,
      { items_per_day: 2, strategy: "stale_first", zones: [] },
      "2026-11-15",
    );
    expect(picked.map((i) => i.id)).toEqual(["2", "3"]); // 从未盘 > 最早盘
  });

  it("只取 items_per_day 个", () => {
    const picked = pickDailyStocktakeItems(
      items,
      { items_per_day: 1, strategy: "stale_first", zones: [] },
      "2026-11-15",
    );
    expect(picked.length).toBe(1);
  });

  it("zone_rotate：按日期轮换到指定区域", () => {
    const rule = {
      items_per_day: 2,
      strategy: "zone_rotate" as const,
      zones: ["冷冻", "常温"],
    };
    // 2026-11-15 距 epoch 天数 % 2 决定区域；断言结果都在同一区域
    const picked = pickDailyStocktakeItems(items, rule, "2026-11-15");
    expect(picked.length).toBe(2);
    const zones = new Set(picked.map((i) => i.zone));
    expect(zones.size).toBe(1);
    // 同参数结果稳定
    const again = pickDailyStocktakeItems(items, rule, "2026-11-15");
    expect(again.map((i) => i.id)).toEqual(picked.map((i) => i.id));
  });

  it("random：同一天可复现", () => {
    const rule = { items_per_day: 3, strategy: "random" as const, zones: [] };
    const a = pickDailyStocktakeItems(items, rule, "2026-11-15").map(
      (i) => i.id,
    );
    const b = pickDailyStocktakeItems(items, rule, "2026-11-15").map(
      (i) => i.id,
    );
    expect(a).toEqual(b);
  });

  it("排除今天已盘过的物品", () => {
    const picked = pickDailyStocktakeItems(
      items,
      { items_per_day: 2, strategy: "stale_first", zones: [] },
      "2026-11-15",
      ["2", "3"],
    );
    expect(picked.map((i) => i.id)).toEqual(["4", "1"]);
  });
});

describe("差异与逾期", () => {
  it("stocktakeDiff 实盘-账面，保留两位", () => {
    expect(stocktakeDiff(10, 9.5)).toBe(-0.5);
    expect(stocktakeDiff(3, 3)).toBe(0);
    expect(stocktakeDiff(null, 5)).toBe(null);
  });

  it("dueFromHours 与 isOverdue", () => {
    const now = 1731600000000;
    const due = dueFromHours(2, now);
    expect(new Date(due).getTime() - now).toBe(2 * 3600_000);
    expect(isOverdue(due, now - 1)).toBe(false);
    expect(isOverdue(due, now + 3 * 3600_000)).toBe(true);
    expect(isOverdue(null)).toBe(false);
  });
});

describe("任务按天自动派发 · planAutoDispatch", () => {
  const tpl = (over: Partial<TaskTemplate>): TaskTemplate => ({
    id: "t1",
    name: "开档清洁",
    task_type: "daily",
    roles: ["waiter"],
    checklist: [{ text: "擦桌子" }],
    require_photo: false,
    due_hours: 4,
    description: "",
    auto_dispatch: true,
    ...over,
  });

  it("只处理开启自动且有岗位的模板", () => {
    const res = planAutoDispatch(
      [
        tpl({ id: "t1" }),
        tpl({ id: "t2", auto_dispatch: false }),
        tpl({ id: "t3", roles: [] }),
      ],
      staff,
      "2026-11-15",
      [],
    );
    expect(new Set(res.map((r) => r.templateId))).toEqual(new Set(["t1"]));
  });

  it("按岗位展开到在职员工（停用不派）", () => {
    const res = planAutoDispatch(
      [tpl({ id: "t1", roles: ["waiter"] })],
      staff,
      "2026-11-15",
      [],
    );
    const ids = new Set(res.map((r) => r.staffId));
    expect(ids).toEqual(new Set(["a", "b"]));
    expect(ids.has("c")).toBe(false); // 停用
  });

  it("同一天已派过的 (模板,员工) 不重复派", () => {
    const res = planAutoDispatch(
      [tpl({ id: "t1", roles: ["waiter"] })],
      staff,
      "2026-11-15",
      [
        {
          template_id: "t1",
          assigned_to: "a",
          dispatch_day: "2026-11-15",
        },
      ],
    );
    expect(res.map((r) => r.staffId)).toEqual(["b"]);
  });

  it("其他日期的记录不影响今天", () => {
    const res = planAutoDispatch(
      [tpl({ id: "t1", roles: ["waiter"] })],
      staff,
      "2026-11-15",
      [
        {
          template_id: "t1",
          assigned_to: "a",
          dispatch_day: "2026-11-14",
        },
      ],
    );
    expect(res).toHaveLength(2);
  });
});
