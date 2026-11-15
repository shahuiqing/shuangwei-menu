import { fmtMoney } from "./format";
import { snapshotToPrompt, type BusinessSnapshot } from "./aiContext";

/**
 * 经营顾问建议：
 * - 规则版：按板块生成「发现 → 建议动作 → 影响」清单，按紧急度排序；
 * - AI 版：把全店快照交给模型，输出同样结构的顾问报告。
 */

export type AdviceArea =
  | "inventory"
  | "waste"
  | "cost"
  | "menu"
  | "purchase"
  | "stocktake"
  | "staff"
  | "sales"
  | "site";

export type AdviceTab =
  | "inventory"
  | "waste"
  | "cost"
  | "menu"
  | "procurement"
  | "stocktake"
  | "dispatch"
  | "requests"
  | "orders"
  | "dishes"
  | "settings";

export interface AdviceItem {
  area: AdviceArea;
  /** 越小越紧急 */
  priority: number;
  title: string;
  finding: string;
  actions: string[];
  impact?: string;
  tab: AdviceTab;
}

export const AREA_LABEL: Record<AdviceArea, string> = {
  inventory: "库存",
  waste: "损耗",
  cost: "成本",
  menu: "菜单",
  purchase: "采购",
  stocktake: "盘点",
  staff: "员工",
  sales: "销售",
  site: "网站",
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** 规则版顾问建议（最多 7 条） */
export function buildAdvice(
  s: BusinessSnapshot,
  now: number = Date.now(),
): AdviceItem[] {
  const out: AdviceItem[] = [];

  // ── 库存：断货风险 ──
  if (s.inventory.low.length > 0) {
    const names = s.inventory.low
      .slice(0, 3)
      .map((i) => i.name)
      .join("、");
    out.push({
      area: "inventory",
      priority: 1,
      title: "先补断货风险原料",
      finding: `${names}${
        s.inventory.low.length > 3 ? ` 等 ${s.inventory.low.length} 种` : ""
      }低于安全库存，晚市可能断货。`,
      actions: [
        "打开采购页，用采购计划一键补齐缺货项",
        "到货前调整相关菜品：售罄标记或替换配菜",
      ],
      impact: "避免晚市售罄与临时采购溢价",
      tab: "procurement",
    });
  }

  // ── 库存：临期 ──
  if (s.inventory.expiring.length > 0) {
    const names = s.inventory.expiring
      .slice(0, 3)
      .map((e) => `${e.name}(${e.daysLeft}天)`)
      .join("、");
    out.push({
      area: "inventory",
      priority: 2,
      title: "处理临期原料",
      finding: `${names} 将在 3 天内到期。`,
      actions: [
        "做临期促销菜或员工餐，优先消耗这批原料",
        "同步减少明后天的同类备货",
      ],
      impact: "减少直接报损",
      tab: "inventory",
    });
  }

  // ── 损耗 ──
  if (s.waste.ratioPct >= 3) {
    out.push({
      area: "waste",
      priority: 2,
      title: "损耗率偏高，先查原因",
      finding: `近 7 天损耗 ${fmtMoney(
        s.waste.week,
      )}，占营业额 ${round1(s.waste.ratioPct)}%（高于 3%）。`,
      actions: [
        "按原料看报损登记，找出重复报损的 2-3 个品类",
        "对高损耗品类减少单次备货量，改为少量多次",
      ],
      impact: "损耗每降 1 个点，直接增加利润",
      tab: "waste",
    });
  } else if (s.waste.week > 0 && s.waste.ratioPct < 1) {
    out.push({
      area: "waste",
      priority: 8,
      title: "损耗控制良好",
      finding: `近 7 天损耗占营业额 ${round1(
        s.waste.ratioPct,
      )}%，处于健康水平。`,
      actions: ["保持当前备货节奏", "继续登记报损，便于趋势对比"],
      tab: "waste",
    });
  }

  // ── 成本率 ──
  if (s.cost.foodCostRate >= 38) {
    out.push({
      area: "cost",
      priority: 2,
      title: "成本率偏高",
      finding: `今日食材成本率 ${s.cost.foodCostRate.toFixed(
        1,
      )}%，高于 38% 警戒线。`,
      actions: [
        "检查毛利最低菜品的配方用量与出成率",
        "核对今日采购价是否高于历史中位价",
        "必要时调整份量或售价 5-8%",
      ],
      impact: "成本率回到 35% 以内，利润明显改善",
      tab: "cost",
    });
  } else if (s.cost.foodCostRate > 0 && s.cost.foodCostRate < 30) {
    out.push({
      area: "cost",
      priority: 8,
      title: "成本率健康",
      finding: `今日食材成本率 ${s.cost.foodCostRate.toFixed(
        1,
      )}%，低于 30%，毛利空间充足。`,
      actions: ["保持当前采购与配方", "可考虑用节省的毛利做引流套餐"],
      tab: "cost",
    });
  }

  // ── 菜单：高销量低毛利 ──
  const lowMarginTop = s.menu.lowMargin.filter((d) => d.qty >= 10);
  if (lowMarginTop.length > 0) {
    out.push({
      area: "menu",
      priority: 3,
      title: "高销量菜品毛利偏低",
      finding: `${lowMarginTop
        .map((d) => `${d.name}(毛利率 ${d.margin}%)`)
        .join("、")} 卖得多但毛利低。`,
      actions: [
        "先核对配方成本：是否存在用量偏大或采购价上涨",
        "成本可控则小幅提价 5-8%，或改成套餐提高客单",
      ],
      impact: "提价 5% 通常可直接转化为利润",
      tab: "menu",
    });
  }

  // ── 菜单：低销量 ──
  if (s.menu.slow.length > 0) {
    const slow = s.menu.slow.slice(0, 3);
    out.push({
      area: "menu",
      priority: 4,
      title: "清理低销量菜品",
      finding: `${slow
        .map((d) => `${d.name}(${d.qty}份/周)`)
        .join("、")} 近 7 天销量最低。`,
      actions: [
        "低毛利且低销量：下架或改为限时供应",
        "有特色但卖不动：调整菜单位置、加图片或做推荐话术",
      ],
      impact: "减少备货压力和后厨复杂度",
      tab: "menu",
    });
  }

  // ── 采购价异常 ──
  if (s.purchasing.rising.length > 0) {
    const rising = s.purchasing.rising.slice(0, 3);
    out.push({
      area: "purchase",
      priority: 3,
      title: "采购价上涨，先比价",
      finding: `${rising
        .map((a) => `${a.name}${a.pct > 0 ? "+" : ""}${a.pct}%`)
        .join("、")} 高于历史中位价。`,
      actions: [
        "在供应商比价里对比同原料各家的加权均价",
        "对涨幅大的原料改用替代品或调整菜单定价",
      ],
      impact: "单笔采购即可省下差价",
      tab: "procurement",
    });
  }

  // ── 网站/菜单体验（来自顾客端体检） ──
  if (s.site && s.site.checks.length > 0) {
    const urgent = s.site.checks.filter((c) => c.severity === "high");
    const top = (urgent.length ? urgent : s.site.checks).slice(0, 3);
    out.push({
      area: "site",
      priority: urgent.length ? 3 : 6,
      title: `网站体验评分 ${s.site.score}/100`,
      finding:
        top.map((c) => `${c.title}（${c.finding}）`).join("；") +
        "，会直接影响顾客下单转化。",
      actions: top.map((c) => c.recommendation),
      impact: "菜单信息更完整，顾客更容易下单",
      tab: top.some((c) => c.tab === "settings") ? "settings" : "dishes",
    });
  }

  // ── 盘点 ──
  if (s.stocktake.pendingToday > 0) {
    out.push({
      area: "stocktake",
      priority: 5,
      title: "今日盘点未完成",
      finding: `还有 ${s.stocktake.pendingToday} 项盘点未提交。`,
      actions: ["在盘点管理里催办责任人", "收档前完成提交与审核校准"],
      impact: "库存和成本数据才准确",
      tab: "stocktake",
    });
  } else if (s.stocktake.last && Math.abs(s.stocktake.last.netValue) > 200) {
    out.push({
      area: "stocktake",
      priority: 5,
      title: "上次盘点差异较大",
      finding: `${s.stocktake.last.day} 盘点净差异 ${fmtMoney(
        s.stocktake.last.netValue,
      )}。`,
      actions: [
        "复核差异最大的 2-3 个原料：收货、领用、报损是否漏记",
        "连续两次同方向差异，检查是否存在损耗未登记",
      ],
      impact: "减少账实不符带来的隐性亏损",
      tab: "stocktake",
    });
  }

  // ── 员工协同 ──
  if (s.staff.overdueTasks > 0 || s.staff.pendingRequests > 0) {
    const parts = [
      s.staff.overdueTasks > 0 ? `逾期任务 ${s.staff.overdueTasks} 项` : "",
      s.staff.pendingRequests > 0
        ? `待审批采购申报 ${s.staff.pendingRequests} 条`
        : "",
    ].filter(Boolean);
    out.push({
      area: "staff",
      priority: 4,
      title: "员工事项待处理",
      finding: parts.join("，") + "。",
      actions: [
        "先处理逾期任务，避免影响晚市准备",
        "审批采购申报，通过后会自动进入采购计划",
      ],
      tab: s.staff.overdueTasks > 0 ? "dispatch" : "requests",
    });
  }

  // ── 销售：临近收档仍明显低于日均 ──
  const hour = new Date(now).getHours();
  const dailyAvg = s.sales.week.revenue / 7;
  if (hour >= 20 && dailyAvg > 0 && s.sales.today.revenue < dailyAvg * 0.7) {
    out.push({
      area: "sales",
      priority: 6,
      title: "今天生意低于近期日均",
      finding: `今日 ${fmtMoney(s.sales.today.revenue)}，近 7 天日均 ${fmtMoney(
        dailyAvg,
      )}。`,
      actions: [
        "检查外卖平台是否在线、菜单是否有售罄",
        "老客群/朋友圈发一条今晚限定优惠",
      ],
      tab: "orders",
    });
  }

  return out.sort((a, b) => a.priority - b.priority).slice(0, 7);
}

/** AI 顾问报告提示词：要求按板块给结论与动作 */
export function advisorPrompt(s: BusinessSnapshot): {
  system: string;
  user: string;
} {
  const system = [
    "你是餐厅老板的经营顾问。",
    "根据全店数据，输出一份经营建议报告。",
    "内容包括经营（销售/菜单/成本/库存/采购/损耗/员工）和顾客端网站/菜单体验（图片、描述、多语言、促销、售罄）。",
    "格式要求：按板块分段，每段包含：",
    "① 一句结论（带具体数字）；② 2-3 条可执行动作（动词开头）；③ 一句预期影响。",
    "总共不超过 6 个板块、400 字；不要编造数据，不要重复罗列数字。",
    "只输出报告正文，不要开场白。",
  ].join("\n");
  const user = [snapshotToPrompt(s), "", "请按上述格式给出经营建议报告。"].join(
    "\n",
  );
  return { system, user };
}
