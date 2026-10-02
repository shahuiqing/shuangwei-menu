import { describe, it, expect } from "vitest";
import { buildMenuPoints, type DishMargin } from "../cost";

const d = (
  name: string,
  qty: number,
  revenue: number,
  cost: number,
): DishMargin => {
  const profit = revenue - cost;
  return {
    name,
    qty,
    revenue,
    cost,
    profit,
    margin: revenue ? (profit / revenue) * 100 : 0,
    hasCost: cost > 0,
  };
};

describe("buildMenuPoints（菜单工程矩阵）", () => {
  // 均值分界：qty 均值 25；单价均值 20
  // 单价 = 营收/销量： 30, 16, 21, 9
  const margins = [
    d("明星菜", 40, 1200, 800), // 高销量、高单价 → star
    d("金牛菜", 40, 640, 500), // 高销量、低单价 → plowhorse
    d("问题菜", 10, 210, 100), // 低销量、高单价 → puzzle
    d("瘦狗菜", 10, 90, 80), // 低销量、低单价 → dog
  ];

  it("按营收口径分四象限", () => {
    const pts = buildMenuPoints(margins, "revenue");
    const q = Object.fromEntries(pts.map((p) => [p.name, p.quad]));
    expect(q["明星菜"]).toBe("star");
    expect(q["金牛菜"]).toBe("plowhorse");
    expect(q["问题菜"]).toBe("puzzle");
    expect(q["瘦狗菜"]).toBe("dog");
  });

  it("按毛利口径使用单位毛利与毛利额", () => {
    const pts = buildMenuPoints(margins, "profit");
    const star = pts.find((p) => p.name === "明星菜")!;
    expect(star.value).toBe(400); // 1200-800
    expect(star.unit).toBeCloseTo(10, 4); // 400/40
    const 金牛 = pts.find((p) => p.name === "金牛菜")!;
    expect(金牛.value).toBe(140); // 640-500
    expect(金牛.unit).toBeCloseTo(3.5, 4);
  });

  it("过滤零销量并保留未配配方标记", () => {
    const pts = buildMenuPoints(
      [d("无销量", 0, 0, 0), d("未配", 5, 50, 0)],
      "profit",
    );
    expect(pts.find((p) => p.name === "无销量")).toBeUndefined();
    expect(pts.find((p) => p.name === "未配")!.hasCost).toBe(false);
  });

  it("空输入返回空数组", () => {
    expect(buildMenuPoints([], "revenue")).toEqual([]);
  });
});
