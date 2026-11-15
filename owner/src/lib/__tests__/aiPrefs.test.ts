import { describe, it, expect } from "vitest";
import { prefsPrompt, loadAiPrefs, type AiPrefs } from "../aiPrefs";
import { buildChatSystemPrompt, type BusinessSnapshot } from "../aiContext";
import { advisorPrompt } from "../advisor";

const snap: BusinessSnapshot = {
  generatedAt: "2026-11-16T10:00:00.000Z",
  today: "2026-11-16",
  sales: {
    today: { revenue: 1200, orders: 15, aov: 80 },
    week: { revenue: 9000, orders: 110, aov: 81.8 },
  },
  menu: { top: [], slow: [], lowMargin: [] },
  cost: { foodCostRate: 32, foodCost: 384, profit: 816 },
  inventory: { low: [], expiring: [], totalValue: 5000 },
  purchasing: { weekAmount: 2000, rising: [], suppliers: 2 },
  waste: { today: 0, week: 20, ratioPct: 0.2 },
  stocktake: { last: null, pendingToday: 0 },
  staff: { pendingTasks: 0, overdueTasks: 0, pendingRequests: 0 },
};

describe("助手偏好", () => {
  it("默认偏好安全（无关注点、简洁）", () => {
    const p = loadAiPrefs();
    expect(p.style).toBe("brief");
    expect(Array.isArray(p.focus)).toBe(true);
  });

  it("提示词片段包含关注点与风格", () => {
    const p: AiPrefs = { focus: ["cost", "inventory"], style: "detailed" };
    const text = prefsPrompt(p);
    expect(text).toContain("成本");
    expect(text).toContain("库存");
    expect(text).toContain("400 字");
  });

  it("简洁风格提示 200 字", () => {
    expect(prefsPrompt({ focus: [], style: "brief" })).toContain("200 字");
  });

  it("对话系统提示会带上偏好", () => {
    const p: AiPrefs = { focus: ["revenue"], style: "brief" };
    const text = buildChatSystemPrompt(snap, p);
    expect(text).toContain("老板当前最关注：营收");
    expect(text).toContain("不超过 200 字");
  });

  it("顾问建议提示也会带上偏好", () => {
    const p: AiPrefs = { focus: ["efficiency"], style: "detailed" };
    expect(advisorPrompt(snap, p).system).toContain("老板当前最关注：人效");
  });
});
