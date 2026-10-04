import { describe, it, expect } from "vitest";
import { buildDishTrends, TREND_LABEL } from "../dishTrend";

describe("菜品趋势", () => {
  it("按阈值分类增长/稳定/下降", () => {
    const cur = [
      { name: "宫保鸡丁", qty: 200 },
      { name: "麻婆豆腐", qty: 100 },
      { name: "回锅肉", qty: 50 },
    ];
    const prev = [
      { name: "宫保鸡丁", qty: 100 }, // +100% → up
      { name: "麻婆豆腐", qty: 100 }, // 0% → steady
      { name: "回锅肉", qty: 100 }, // -50% → down
    ];
    const r = buildDishTrends(cur, prev, 0.2);
    const byName = Object.fromEntries(r.map((x) => [x.name, x.kind]));
    expect(byName["宫保鸡丁"]).toBe("up");
    expect(byName["麻婆豆腐"]).toBe("steady");
    expect(byName["回锅肉"]).toBe("down");
  });

  it("新品与消失识别", () => {
    const cur = [{ name: "新菜", qty: 30 }];
    const prev = [{ name: "旧菜", qty: 60 }];
    const r = buildDishTrends(cur, prev, 0.2);
    const byName = Object.fromEntries(r.map((x) => [x.name, x.kind]));
    expect(byName["新菜"]).toBe("new");
    expect(byName["旧菜"]).toBe("gone");
  });

  it("标签齐全", () => {
    expect(TREND_LABEL.up.label).toBe("增长");
    expect(TREND_LABEL.gone.label).toBe("消失");
  });
});
