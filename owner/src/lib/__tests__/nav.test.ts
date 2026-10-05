import { describe, it, expect } from "vitest";
import { NAV, NAV_GROUPS } from "../../components/Layout";

describe("导航分组数据", () => {
  const ids = NAV_GROUPS.flatMap((g) => g.items);

  it("分组覆盖全部页面且无重复、无遗漏", () => {
    expect(ids.length).toBe(NAV.length);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids)).toEqual(new Set(NAV.map((n) => n.id)));
  });

  it("每组至少 1 项，组名非空", () => {
    for (const g of NAV_GROUPS) {
      expect(g.title.length).toBeGreaterThan(0);
      expect(g.items.length).toBeGreaterThan(0);
    }
  });

  it("首页快捷入口数据源存在（Dashboard 直达所有页面）", () => {
    const shortcuts = NAV.filter((n) => n.id !== "dashboard");
    expect(shortcuts.length).toBe(NAV.length - 1);
    expect(shortcuts.every((n) => n.label && n.icon)).toBe(true);
  });
});
