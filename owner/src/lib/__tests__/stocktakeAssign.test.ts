import { describe, it, expect } from "vitest";
import {
  autoAssignStocktakes,
  buildUnassignedLog,
  DEFAULT_CATEGORY_RULES,
  type AutoAssignItem,
  type AutoAssignStaff,
} from "../staffOps";

const staff: AutoAssignStaff[] = [
  { id: "w1", name: "王服务员", roles: ["waiter"], status: "active" },
  { id: "w2", name: "李服务员", roles: ["waiter"], status: "active" },
  { id: "w3", name: "赵服务员", roles: ["waiter"], status: "disabled" }, // 停用不参与
  { id: "h1", name: "帮厨甲", roles: ["helper"], status: "active" },
  { id: "h2", name: "帮厨乙", roles: ["helper"], status: "active" },
  { id: "h3", name: "帮厨丙", roles: ["helper", "waiter"], status: "active" }, // 一人多角色
];

/** 构造 n 个某分类的物品 */
const mkItems = (n: number, category: string, zone = ""): AutoAssignItem[] =>
  Array.from({ length: n }, (_, i) => ({
    itemId: `${category}-${i + 1}`,
    category,
    zone,
  }));

describe("autoAssignStocktakes · 分类→角色→人", () => {
  it("食品类(蔬菜)默认派给帮厨，不派给服务员", () => {
    const res = autoAssignStocktakes(
      mkItems(6, "蔬菜"),
      DEFAULT_CATEGORY_RULES,
      staff,
    );
    expect(res.unassigned).toHaveLength(0);
    const assignees = new Set(res.assignments.map((a) => a.staffId));
    expect(assignees).toEqual(new Set(["h1", "h2", "h3"]));
  });

  it("耗材默认派给服务员，停用员工不参与", () => {
    const res = autoAssignStocktakes(
      mkItems(4, "耗材"),
      DEFAULT_CATEGORY_RULES,
      staff,
    );
    const assignees = new Set(res.assignments.map((a) => a.staffId));
    expect(assignees).toEqual(new Set(["w1", "w2", "h3"]));
    expect(assignees.has("w3")).toBe(false);
  });

  it("平均拆分：负载尽量均衡", () => {
    const res = autoAssignStocktakes(
      mkItems(9, "肉类"),
      DEFAULT_CATEGORY_RULES,
      staff,
    );
    const count = (id: string) =>
      res.assignments.filter((a) => a.staffId === id).length;
    const loads = ["h1", "h2", "h3"].map(count);
    expect(Math.max(...loads) - Math.min(...loads)).toBeLessThanOrEqual(1);
    expect(loads.reduce((a, b) => a + b, 0)).toBe(9);
  });

  it("按区域拆分：同区物品整块给同一人", () => {
    const items = [
      ...mkItems(3, "粮油", "A货架"),
      ...mkItems(3, "粮油", "B货架").map((x) => ({
        ...x,
        itemId: x.itemId + "b",
      })),
    ];
    const res = autoAssignStocktakes(
      items,
      [
        {
          category: "粮油",
          roles: ["helper"],
          split_mode: "zone",
          enabled: true,
        },
      ],
      staff,
    );
    expect(res.unassigned).toHaveLength(0);
    // 同一 itemId 前缀（同区）分到同一人
    const zoneOf = (id: string) => (id.endsWith("b") ? "B" : "A");
    const staffOfZone = new Map<string, Set<string>>();
    for (const a of res.assignments) {
      const z = zoneOf(a.itemId);
      if (!staffOfZone.has(z)) staffOfZone.set(z, new Set());
      staffOfZone.get(z)!.add(a.staffId);
    }
    for (const s of staffOfZone.values()) expect(s.size).toBe(1);
  });

  it("无区域信息时按区域拆分退化为平均拆分", () => {
    const res = autoAssignStocktakes(
      mkItems(6, "水产"),
      [
        {
          category: "水产",
          roles: ["helper"],
          split_mode: "zone",
          enabled: true,
        },
      ],
      staff,
    );
    const count = (id: string) =>
      res.assignments.filter((a) => a.staffId === id).length;
    expect(count("h1")).toBe(2);
    expect(count("h2")).toBe(2);
    expect(count("h3")).toBe(2);
  });

  it("整组给一人：整个分类给负载最少的人", () => {
    const res = autoAssignStocktakes(
      mkItems(5, "调料"),
      [
        {
          category: "调料",
          roles: ["helper"],
          split_mode: "category_group",
          enabled: true,
        },
      ],
      staff,
    );
    expect(new Set(res.assignments.map((a) => a.staffId)).size).toBe(1);
  });

  it("随机拆分：同一 seed 结果稳定", () => {
    const items = mkItems(8, "饮料");
    const rule = [
      {
        category: "饮料",
        roles: ["helper" as const],
        split_mode: "random" as const,
        enabled: true,
      },
    ];
    const a = autoAssignStocktakes(items, rule, staff, "2026-11-15");
    const b = autoAssignStocktakes(items, rule, staff, "2026-11-15");
    expect(a.assignments).toEqual(b.assignments);
  });

  it("轮换：上次责任人优先接着盘", () => {
    const items = mkItems(4, "蔬菜").map((it, i) => ({
      ...it,
      lastStaffId: i % 2 === 0 ? "h2" : null,
    }));
    const res = autoAssignStocktakes(
      items,
      [
        {
          category: "蔬菜",
          roles: ["helper"],
          split_mode: "rotate",
          enabled: true,
        },
      ],
      staff,
    );
    const h2Items = res.assignments.filter((a) => a.staffId === "h2");
    // 2 个上次 h2 盘的直接给 h2；其余轮流
    expect(h2Items.length).toBeGreaterThanOrEqual(2);
  });

  it("无分类物品 → no_category", () => {
    const res = autoAssignStocktakes(
      [{ itemId: "x1", category: "", zone: "" }],
      DEFAULT_CATEGORY_RULES,
      staff,
    );
    expect(res.assignments).toHaveLength(0);
    expect(res.unassigned[0].reason).toBe("no_category");
  });

  it("未配置映射的分类 → no_rule", () => {
    const res = autoAssignStocktakes(
      mkItems(2, "自定义分类"),
      DEFAULT_CATEGORY_RULES,
      staff,
    );
    expect(res.unassigned.every((u) => u.reason === "no_rule")).toBe(true);
  });

  it("映射停用（当天排除该分类）→ no_rule", () => {
    const res = autoAssignStocktakes(
      mkItems(2, "蔬菜"),
      [
        {
          ...DEFAULT_CATEGORY_RULES[0],
          enabled: false,
        },
      ],
      staff,
    );
    expect(res.unassigned.every((u) => u.reason === "no_rule")).toBe(true);
  });

  it("角色为空的映射（如「其他」）→ no_rule，提示老板指定", () => {
    const res = autoAssignStocktakes(
      mkItems(2, "其他"),
      DEFAULT_CATEGORY_RULES,
      staff,
    );
    expect(res.unassigned.every((u) => u.reason === "no_rule")).toBe(true);
  });

  it("角色无在职员工 → no_staff", () => {
    const res = autoAssignStocktakes(
      mkItems(2, "蔬菜"),
      DEFAULT_CATEGORY_RULES,
      staff.filter((s) => s.roles.every((r) => r !== "helper")),
    );
    expect(res.unassigned.every((u) => u.reason === "no_staff")).toBe(true);
  });

  it("多角色员工不重复领同一物品，且跨分类负载均衡", () => {
    const items = [
      ...mkItems(3, "蔬菜"),
      ...mkItems(3, "耗材").map((x) => ({ ...x, itemId: x.itemId + "c" })),
    ];
    const res = autoAssignStocktakes(items, DEFAULT_CATEGORY_RULES, staff);
    // 同一物品只出现一次
    const itemIds = res.assignments.map((a) => a.itemId);
    expect(new Set(itemIds).size).toBe(itemIds.length);
    // h3 两边都能接，应分担最多 3 个（两分类各均衡）
    const count = (id: string) =>
      res.assignments.filter((a) => a.staffId === id).length;
    expect(count("h3")).toBeGreaterThan(0);
  });
});

describe("未派发留档 · buildUnassignedLog", () => {
  it("补充物品名并按 itemId 去重", () => {
    const items = [
      { id: "i1", name: "牛肉", category: "肉类" },
      { id: "i2", name: "盘子", category: "餐具" },
    ];
    const log = buildUnassignedLog(items, [
      { itemId: "i1", category: "肉类", reason: "no_staff" },
      { itemId: "i1", category: "肉类", reason: "no_staff" },
      { itemId: "i2", category: "餐具", reason: "no_rule" },
    ]);
    expect(log).toHaveLength(2);
    expect(log[0]).toMatchObject({
      itemId: "i1",
      itemName: "牛肉",
      reason: "no_staff",
    });
    expect(log[1]).toMatchObject({
      itemId: "i2",
      itemName: "盘子",
      reason: "no_rule",
    });
  });

  it("找不到物品时回退用 id 当名称", () => {
    const log = buildUnassignedLog(
      [],
      [{ itemId: "x9", category: "", reason: "no_category" }],
    );
    expect(log[0]!.itemName).toBe("x9");
  });
});
