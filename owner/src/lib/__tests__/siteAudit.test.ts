import { describe, it, expect } from "vitest";
import {
  auditMenu,
  buildSitePlan,
  sitePlanPrompt,
  type SiteAudit,
} from "../siteAudit";
import type { MenuCategory } from "../menu";

const dish = (id: string, over: any = {}) => ({
  id,
  title: `菜${id}`,
  price: "75",
  image: "https://img/x.jpg",
  description: "好吃",
  frTitle: "Plat",
  arTitle: "طبق",
  ...over,
});

const cats = (items: any[]): MenuCategory[] => [
  { id: "c1", name: "主菜", items },
  { id: "c2", name: "饮品", items: [dish("d9")] },
  { id: "c3", name: "前菜", items: [dish("d10")] },
];

const settings = {
  welcomeMessage: "炭火烧烤，招牌羊肉串",
  logoUrl: "https://img/logo.png",
  bgUrl: "https://img/bg.jpg",
  promotions: [{ id: "p1", isActive: true, title: "满减" }],
};

describe("网站体检 · 菜单质量", () => {
  it("图片/描述/多语言缺失会计数并生成建议", () => {
    const audit = auditMenu(
      cats([
        dish("d1", { image: "", description: "" }),
        dish("d2", { frTitle: "", arTitle: "" }),
        dish("d3"),
        dish("d4"),
      ]),
      settings,
    );
    expect(audit.dishes).toBe(6);
    expect(audit.missingImage).toBe(1);
    expect(audit.missingDesc).toBe(1);
    expect(audit.missingFr).toBe(1);
    expect(audit.missingAr).toBe(1);
    const ids = audit.checks.map((c) => c.id);
    expect(ids).toContain("no-image");
    expect(ids).toContain("no-desc");
    expect(ids).toContain("no-i18n");
  });

  it("未填价格 / 售罄 / 促销与品牌缺失都能识别", () => {
    const audit = auditMenu(
      cats([
        dish("d1", { price: "" }),
        dish("d2", { isSoldOut: true }),
        dish("d3"),
      ]),
      { welcomeMessage: "", logoUrl: "", bgUrl: "", promotions: [] },
    );
    const ids = audit.checks.map((c) => c.id);
    expect(ids).toContain("zero-price");
    expect(ids).toContain("sold-out");
    expect(ids).toContain("no-promo");
    expect(ids).toContain("weak-welcome");
    expect(ids).toContain("weak-branding");
    expect(audit.hasActivePromotion).toBe(false);
  });

  it("空菜单给高分严重问题，评分不为负", () => {
    const audit = auditMenu([], settings);
    expect(audit.checks.some((c) => c.id === "empty-menu")).toBe(true);
    expect(audit.score).toBeGreaterThanOrEqual(0);
  });

  it("完整菜单得分高、无严重问题", () => {
    const audit = auditMenu(cats([dish("d1"), dish("d2")]), settings);
    expect(audit.score).toBe(100);
    expect(audit.checks).toHaveLength(0);
  });
});

describe("网站改进计划", () => {
  const audit: SiteAudit = auditMenu(
    cats([
      dish("d1", { image: "", description: "" }),
      dish("d2", { price: "" }),
      dish("d3", { isSoldOut: true }),
      dish("d4"),
    ]),
    { welcomeMessage: "", promotions: [] },
  );

  it("规则版计划优先列严重问题", () => {
    const plan = buildSitePlan(audit);
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.length).toBeLessThanOrEqual(6);
    expect(plan[0]).toContain("优先");
  });

  it("全部正常时给维持建议", () => {
    const clean = auditMenu(cats([dish("d1")]), settings);
    expect(buildSitePlan(clean)[0]).toContain("保持");
  });

  it("AI 提示词包含评分、计数和发现", () => {
    const { system, user } = sitePlanPrompt(audit);
    expect(system).toContain("转化率");
    expect(system).toContain("本周先做");
    expect(user).toContain(`评分：${audit.score}`);
    expect(user).toContain("缺图片");
    expect(user).toContain("体检发现");
  });
});
