import { describe, it, expect } from "vitest";
import {
  snapshotToPrompt,
  buildChatSystemPrompt,
  buildChatUserMessage,
  answerWithoutLlm,
  type BusinessSnapshot,
} from "../aiContext";

const snap: BusinessSnapshot = {
  generatedAt: "2026-11-15T12:00:00.000Z",
  today: "2026-11-15",
  sales: {
    today: { revenue: 5000, orders: 60, aov: 83.33 },
    week: { revenue: 32000, orders: 400, aov: 80 },
  },
  menu: {
    top: [
      { name: "羊肉串", qty: 120, revenue: 2400 },
      { name: "烤鱼", qty: 30, revenue: 1500 },
    ],
    slow: [
      { name: "凉拌黄瓜", qty: 2, revenue: 30 },
      { name: "拍黄瓜", qty: 1, revenue: 15 },
    ],
    lowMargin: [{ name: "羊肉串", margin: 18, qty: 120, revenue: 2400 }],
  },
  cost: { foodCostRate: 31.5, foodCost: 1575, profit: 3425 },
  inventory: {
    low: [{ name: "牛肉", stock: 1, unit: "kg", safety: 5 }],
    expiring: [{ name: "生菜", daysLeft: 1 }],
    totalValue: 12000,
  },
  purchasing: {
    weekAmount: 8000,
    rising: [{ name: "洋葱", pct: 12.5 }],
    suppliers: 3,
  },
  waste: { today: 40, week: 260, ratioPct: 0.8 },
  stocktake: {
    last: { day: "2026-11-14", items: 12, diffs: 2, netValue: -45.5 },
    pendingToday: 3,
  },
  staff: { pendingTasks: 4, overdueTasks: 1, pendingRequests: 2 },
};

describe("经营快照提示词", () => {
  it("包含销售、菜单、库存、采购、损耗、盘点、员工七类事实", () => {
    const p = snapshotToPrompt(snap);
    expect(p).toContain("营业额 5,000");
    expect(p).toContain("销量前 5");
    expect(p).toContain("羊肉串");
    expect(p).toContain("毛利最低");
    expect(p).toContain("牛肉");
    expect(p).toContain("临期");
    expect(p).toContain("采购额 8,000");
    expect(p).toContain("损耗");
    expect(p).toContain("最近盘点 2026-11-14");
    expect(p).toContain("任务待完成 4");
  });

  it("系统提示包含角色、规范与快照", () => {
    const s = buildChatSystemPrompt(snap);
    expect(s).toContain("经营助手");
    expect(s).toContain("不要编造");
    expect(s).toContain("250 字");
    expect(s).toContain("今日：营业额 5,000");
  });
});

describe("多轮对话上下文", () => {
  it("无历史时只发问题", () => {
    expect(buildChatUserMessage([], "今天怎么样")).toBe("今天怎么样");
  });

  it("有历史时带上最近对话", () => {
    const msg = buildChatUserMessage(
      [
        { role: "user", content: "哪些原料快没货了" },
        { role: "assistant", content: "牛肉快没了" },
      ],
      "那怎么办",
    );
    expect(msg).toContain("老板：哪些原料快没货了");
    expect(msg).toContain("助手：牛肉快没了");
    expect(msg).toContain("老板现在问：那怎么办");
  });

  it("历史过长时只保留最近 8 轮", () => {
    const history = Array.from({ length: 12 }, (_, i) => ({
      role: "user" as const,
      content: `问题${i}`,
    }));
    const msg = buildChatUserMessage(history, "追问");
    expect(msg).not.toContain("问题3");
    expect(msg).toContain("问题11");
  });
});

describe("规则版对话兜底", () => {
  it("菜单问题给出毛利与销量结构", () => {
    const a = answerWithoutLlm(snap, "菜单上哪些菜该调整");
    expect(a).toContain("毛利最低");
    expect(a).toContain("卖得最少");
    expect(a).toContain("羊肉串");
  });

  it("库存问题包含缺货与临期", () => {
    const a = answerWithoutLlm(snap, "哪些原料快没货或快过期");
    expect(a).toContain("牛肉");
    expect(a).toContain("生菜");
  });

  it("损耗、盘点、采购、员工各自可答", () => {
    expect(answerWithoutLlm(snap, "损耗怎么样")).toContain("260");
    expect(answerWithoutLlm(snap, "盘点情况")).toContain("最近一次盘点");
    expect(answerWithoutLlm(snap, "采购价有异常吗")).toContain("洋葱+12.5%");
    expect(answerWithoutLlm(snap, "员工任务")).toContain("待完成 4");
  });

  it("空问题与未知问题有引导", () => {
    expect(answerWithoutLlm(snap, "")).toContain("可以问我");
    expect(answerWithoutLlm(snap, "今天天气如何")).toContain("配置 AI");
  });
});
