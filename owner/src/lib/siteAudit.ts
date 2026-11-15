import { fetchSettings } from "./data";
import { fetchCategories, parsePrice, type MenuCategory } from "./menu";

/**
 * 顾客端网站 / 菜单体检：
 * 从 settings.categories 与品牌设置里找出影响下单的常见问题，
 * 给出可执行的改进建议（不依赖 AI，纯数据规则）。
 */

export type SiteSeverity = "high" | "medium" | "low";

export interface SiteCheck {
  id: string;
  area: "branding" | "menu" | "content" | "i18n" | "promotion" | "order";
  severity: SiteSeverity;
  title: string;
  finding: string;
  recommendation: string;
  count?: number;
  samples?: string[];
  /** 老板端可跳转处理的页面 */
  tab?: "dishes" | "settings";
}

export interface SiteAudit {
  generatedAt: string;
  score: number;
  categories: number;
  dishes: number;
  missingImage: number;
  missingDesc: number;
  missingFr: number;
  missingAr: number;
  soldOut: number;
  zeroPrice: number;
  hasActivePromotion: boolean;
  checks: SiteCheck[];
}

const pct = (n: number, total: number) =>
  total > 0 ? Math.round((n / total) * 100) : 0;

function text(v: unknown): string {
  return String(v ?? "").trim();
}

/** 从菜单分类计算体检结果（纯函数，便于测试） */
export function auditMenu(cats: MenuCategory[], settings: any): SiteAudit {
  const list = Array.isArray(cats) ? cats : [];
  const items = list.flatMap((c) =>
    (Array.isArray(c.items) ? c.items : []).map((it) => ({
      ...it,
      _cat: c.name,
    })),
  );
  const total = items.length;

  const missingImage = items.filter((it: any) => !text(it.image));
  const missingDesc = items.filter(
    (it: any) =>
      !text(it.description) &&
      !text(it.enDescription) &&
      !text(it.frDescription) &&
      !text(it.arDescription),
  );
  const missingFr = items.filter((it: any) => !text(it.frTitle));
  const missingAr = items.filter((it: any) => !text(it.arTitle));
  const soldOut = items.filter((it: any) => it.isSoldOut === true);
  const zeroPrice = items.filter((it: any) => parsePrice(it.price) <= 0);
  const prices = items
    .map((it: any) => parsePrice(it.price))
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0;
  const overpriced = items.filter(
    (it: any) => median > 0 && parsePrice(it.price) >= median * 3,
  );
  const promos = Array.isArray(settings?.promotions) ? settings.promotions : [];
  const hasActivePromotion = promos.some((p: any) => p?.isActive !== false);

  const checks: SiteCheck[] = [];

  if (total === 0) {
    checks.push({
      id: "empty-menu",
      area: "menu",
      severity: "high",
      title: "网站还没有菜品",
      finding: "顾客打开菜单会看到空页面。",
      recommendation: "先在「菜品」页添加分类和菜品，并上传图片。",
      tab: "dishes",
    });
  }

  if (missingImage.length > 0) {
    const ratio = missingImage.length / Math.max(1, total);
    checks.push({
      id: "no-image",
      area: "content",
      severity: ratio >= 0.3 ? "high" : "medium",
      title: "菜品缺少图片",
      finding: `${missingImage.length}/${total} 个菜品没有图片（${pct(
        missingImage.length,
        total,
      )}%）。`,
      recommendation:
        "优先给销量前 5 和高价菜补实拍图；图片是顾客下单最主要的判断依据。",
      count: missingImage.length,
      samples: missingImage.slice(0, 5).map((it: any) => it.title),
      tab: "dishes",
    });
  }

  if (missingDesc.length > 0) {
    checks.push({
      id: "no-desc",
      area: "content",
      severity:
        missingDesc.length / Math.max(1, total) >= 0.5 ? "medium" : "low",
      title: "菜品缺少介绍",
      finding: `${missingDesc.length}/${total} 个菜品没有描述。`,
      recommendation:
        "给招牌菜写一句卖点（食材/口味/份量），能明显减少顾客犹豫。",
      count: missingDesc.length,
      samples: missingDesc.slice(0, 5).map((it: any) => it.title),
      tab: "dishes",
    });
  }

  if (missingFr.length > 0 || missingAr.length > 0) {
    const worse = Math.min(
      missingFr.length > 0 ? missingFr.length : total,
      missingAr.length > 0 ? missingAr.length : total,
    );
    checks.push({
      id: "no-i18n",
      area: "i18n",
      severity: total > 0 && worse / total >= 0.3 ? "medium" : "low",
      title: "菜单缺少法语/阿拉伯语",
      finding: `法语缺 ${missingFr.length} 个、阿拉伯语缺 ${missingAr.length} 个（共 ${total} 个菜品）。`,
      recommendation:
        "给菜品补法语/阿语名称，本地客和游客点单会更顺畅；可先补销量前 10。",
      count: Math.max(missingFr.length, missingAr.length),
      samples: missingFr.slice(0, 5).map((it: any) => it.title),
      tab: "dishes",
    });
  }

  if (soldOut.length > 0) {
    checks.push({
      id: "sold-out",
      area: "menu",
      severity: soldOut.length / Math.max(1, total) >= 0.2 ? "high" : "low",
      title: "售罄菜品较多",
      finding: `${soldOut.length} 个菜品处于售罄状态。`,
      recommendation:
        "及时恢复有货菜品；长期售罄的菜先隐藏或下架，避免顾客觉得菜单不更新。",
      count: soldOut.length,
      samples: soldOut.slice(0, 5).map((it: any) => it.title),
      tab: "dishes",
    });
  }

  if (zeroPrice.length > 0) {
    checks.push({
      id: "zero-price",
      area: "menu",
      severity: "high",
      title: "有菜品未填价格",
      finding: `${zeroPrice.length} 个菜品价格为 0 或无法识别。`,
      recommendation: "补齐价格；价格为 0 的菜品顾客无法正常下单。",
      count: zeroPrice.length,
      samples: zeroPrice.slice(0, 5).map((it: any) => it.title),
      tab: "dishes",
    });
  }

  if (list.length === 0) {
    // 已在 empty-menu 提示
  } else if (list.length > 12) {
    checks.push({
      id: "too-many-cats",
      area: "menu",
      severity: "low",
      title: "分类偏多",
      finding: `共 ${list.length} 个分类，顾客滑动查找成本高。`,
      recommendation: "合并到 6-10 个分类，把高频分类放在最前。",
      tab: "dishes",
    });
  } else if (list.length < 3) {
    checks.push({
      id: "few-cats",
      area: "menu",
      severity: "low",
      title: "分类偏少",
      finding: `只有 ${list.length} 个分类。`,
      recommendation: "按前菜/主菜/饮品等拆分，便于顾客快速找到目标。",
      tab: "dishes",
    });
  }

  if (overpriced.length > 0) {
    checks.push({
      id: "price-outlier",
      area: "menu",
      severity: "low",
      title: "价格明显高于其他菜",
      finding: `${overpriced.length} 个菜品价格超过菜单中位价的 3 倍。`,
      recommendation: "确认是否录错价格；高价菜建议补充图片和说明。",
      count: overpriced.length,
      samples: overpriced.slice(0, 5).map((it: any) => it.title),
      tab: "dishes",
    });
  }

  if (!hasActivePromotion) {
    checks.push({
      id: "no-promo",
      area: "promotion",
      severity: "medium",
      title: "没有生效中的促销",
      finding: "顾客端没有优惠/推荐位，缺少下单理由。",
      recommendation:
        "在顾客端管理面板配置 1 个促销（如招牌菜立减或套餐），并保持长期有 1 个在跑。",
      tab: "dishes",
    });
  }

  const welcome = text(settings?.welcomeMessage);
  if (welcome.length < 6) {
    checks.push({
      id: "weak-welcome",
      area: "branding",
      severity: "low",
      title: "欢迎语过短或缺失",
      finding: welcome ? `当前欢迎语仅「${welcome}」。` : "没有欢迎语。",
      recommendation:
        "写一句能说明特色的话（菜系、招牌、氛围），提升第一印象。",
      tab: "settings",
    });
  }

  if (!text(settings?.logoUrl) || !text(settings?.bgUrl)) {
    const missing = [
      !text(settings?.logoUrl) ? "店标" : "",
      !text(settings?.bgUrl) ? "背景图" : "",
    ].filter(Boolean);
    checks.push({
      id: "weak-branding",
      area: "branding",
      severity: "low",
      title: "品牌素材缺失",
      finding: `缺少${missing.join("和")}。`,
      recommendation:
        "上传清晰的店标和门口/招牌菜背景图，网站会更像一家真实门店。",
      tab: "settings",
    });
  }

  const weight: Record<SiteSeverity, number> = { high: 15, medium: 8, low: 3 };
  const score = Math.max(
    0,
    Math.min(100, 100 - checks.reduce((s, c) => s + weight[c.severity], 0)),
  );

  return {
    generatedAt: new Date().toISOString(),
    score,
    categories: list.length,
    dishes: total,
    missingImage: missingImage.length,
    missingDesc: missingDesc.length,
    missingFr: missingFr.length,
    missingAr: missingAr.length,
    soldOut: soldOut.length,
    zeroPrice: zeroPrice.length,
    hasActivePromotion,
    checks,
  };
}

/** 读取线上菜单与设置并做体检 */
export async function loadSiteAudit(): Promise<SiteAudit> {
  const [cats, settings] = await Promise.all([
    fetchCategories(),
    fetchSettings(),
  ]);
  return auditMenu(cats, settings);
}

/** 规则版网站改进计划：按严重度排序的清单 */
export function buildSitePlan(a: SiteAudit): string[] {
  const rank: Record<SiteSeverity, number> = { high: 0, medium: 1, low: 2 };
  const checks = [...a.checks].sort(
    (x, y) => rank[x.severity] - rank[y.severity],
  );
  if (checks.length === 0) {
    return [
      `网站评分 ${a.score}/100，菜单信息完整，保持每周更新 1-2 个菜品即可。`,
    ];
  }
  return checks.slice(0, 6).map((c, i) => {
    const tag =
      c.severity === "high"
        ? "优先"
        : c.severity === "medium"
          ? "建议"
          : "可选";
    return `${i + 1}. 【${tag}】${c.recommendation}${
      c.samples?.length ? `（如：${c.samples.slice(0, 3).join("、")}）` : ""
    }`;
  });
}

/** AI 网站改进计划提示词 */
export function sitePlanPrompt(a: SiteAudit): { system: string; user: string } {
  const system = [
    "你是餐厅线上菜单/点单网站的优化顾问。",
    "目标：提升顾客打开菜单后的下单转化率。",
    "根据体检结果输出改进计划：先写一句总体判断（含评分），再按「本周先做 / 之后再做」分两组，每组 2-4 条。",
    "每条用动词开头、具体到页面操作；总字数 300 字以内；不要编造体检结果以外的信息。",
    "只输出计划正文。",
  ].join("\n");
  const lines = [
    `网站评分：${a.score}/100`,
    `规模：${a.categories} 个分类、${a.dishes} 个菜品`,
    `缺图片 ${a.missingImage} 个，缺描述 ${a.missingDesc} 个，缺法语 ${a.missingFr} 个，缺阿语 ${a.missingAr} 个，售罄 ${a.soldOut} 个，未填价格 ${a.zeroPrice} 个；${
      a.hasActivePromotion ? "有" : "没有"
    }生效中的促销。`,
    "体检发现：",
    ...a.checks.map(
      (c) =>
        `- [${c.severity === "high" ? "高" : c.severity === "medium" ? "中" : "低"}] ${c.title}：${c.finding}（建议：${c.recommendation}）`,
    ),
  ];
  return { system, user: lines.join("\n") };
}
