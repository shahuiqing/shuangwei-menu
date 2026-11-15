import { fmtMoney } from "./format";

/**
 * AI 经营诊断：
 * - 有 LLM 时把结构化事实交给模型生成行动清单；
 * - 没配 AI 或调用失败时用规则版（同样按优先级给出可执行建议）。
 */

export interface DiagnosisFacts {
  revenue: number;
  orders: number;
  aov: number;
  foodCost: number;
  foodCostRate: number;
  profit: number;
  waste: number;
  lowStock: { name: string; stock: number; unit: string; safety: number }[];
  priceAlerts: { name: string; pct: number }[];
  pendingTasks: number;
  overdueTasks: number;
  pendingStocktakes: number;
  pendingRequests: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** 规则版诊断：最多 6 条，按「会立刻影响生意」排序 */
export function buildRuleDiagnosis(f: DiagnosisFacts): string[] {
  const out: string[] = [];

  if (f.lowStock.length > 0) {
    const names = f.lowStock
      .slice(0, 3)
      .map((i) => i.name)
      .join("、");
    out.push(
      `补货优先：${names}${
        f.lowStock.length > 3 ? ` 等 ${f.lowStock.length} 种` : ""
      }低于安全库存，今天先下单，避免晚市断货。`,
    );
  }

  if (f.priceAlerts.length > 0) {
    const names = f.priceAlerts
      .slice(0, 3)
      .map((a) => a.name)
      .join("、");
    out.push(`核对采购价：${names} 高于历史中位价，下单前先比价或换供应商。`);
  }

  if (f.foodCostRate >= 38) {
    out.push(
      `成本率 ${f.foodCostRate.toFixed(1)}% 偏高：检查高成本菜品出成率、份量和报损，优先处理毛利最低的菜。`,
    );
  } else if (f.foodCostRate > 0) {
    out.push(
      `成本率 ${f.foodCostRate.toFixed(1)}% 处于正常区间，保持当前配方和采购价。`,
    );
  }

  if (f.waste > 0) {
    out.push(
      `今日损耗 ${fmtMoney(f.waste)}：记录损耗原因，明天相应减少备货或做临期促销。`,
    );
  }

  if (f.revenue > 0) {
    out.push(
      `今日营业额 ${fmtMoney(f.revenue)}（${f.orders} 单，客单 ${fmtMoney(
        f.aov,
      )}），食材成本 ${fmtMoney(f.foodCost)}，预计毛利 ${fmtMoney(f.profit)}。`,
    );
  }

  if (f.overdueTasks > 0) {
    out.push(
      `员工协同：任务逾期 ${f.overdueTasks} 项（待完成 ${f.pendingTasks}）` +
        (f.pendingStocktakes > 0
          ? `、盘点待提交 ${f.pendingStocktakes} 项`
          : "") +
        (f.pendingRequests > 0
          ? `、采购申报待审批 ${f.pendingRequests} 条`
          : "") +
        `，先处理逾期任务和待审批申报。`,
    );
  } else if (f.pendingTasks > 0) {
    out.push(
      `员工协同：任务待完成 ${f.pendingTasks} 项` +
        (f.pendingStocktakes > 0
          ? `、盘点待提交 ${f.pendingStocktakes} 项`
          : "") +
        (f.pendingRequests > 0
          ? `、采购申报待审批 ${f.pendingRequests} 条`
          : "") +
        `，收档前确认完成。`,
    );
  } else if (f.pendingStocktakes > 0) {
    out.push(
      `员工协同：盘点还有 ${f.pendingStocktakes} 项未提交` +
        (f.pendingRequests > 0
          ? `、采购申报待审批 ${f.pendingRequests} 条`
          : "") +
        `，晚市前催办。`,
    );
  } else if (f.pendingRequests > 0) {
    out.push(`采购申报：${f.pendingRequests} 条待审批，审批后才会进采购计划。`);
  }

  if (out.length === 0) {
    out.push("今天销售、成本、库存和员工任务都正常，保持当前节奏即可。");
  }
  return out.slice(0, 6);
}

/** LLM 提示词：只发结构化事实，要求输出可执行清单 */
export function diagnosisPrompt(f: DiagnosisFacts): {
  system: string;
  user: string;
} {
  const system = [
    "你是餐厅老板的经营顾问。",
    "根据给出的当天数据，输出 3-5 条按优先级排序的行动建议。",
    "要求：每条一句话，动词开头，具体可执行；不要编造数据；不要重复罗列数字；总字数 250 字以内。",
    "只输出建议列表，每行以「1. 」这样的序号开头。",
  ].join("\n");

  const lines = [
    `今日经营数据：`,
    `- 营业额 ${fmtMoney(f.revenue)}，订单 ${f.orders} 单，客单价 ${fmtMoney(f.aov)}`,
    `- 食材成本 ${fmtMoney(f.foodCost)}，成本率 ${round1(f.foodCostRate)}%，预计毛利 ${fmtMoney(f.profit)}`,
    `- 报损 ${fmtMoney(f.waste)}`,
    f.lowStock.length
      ? `- 低于安全库存 ${f.lowStock.length} 种：` +
        f.lowStock
          .slice(0, 8)
          .map(
            (i) =>
              `${i.name}(存 ${i.stock}${i.unit}/安全 ${i.safety}${i.unit})`,
          )
          .join("、")
      : `- 库存正常，无低于安全库存的原料`,
    f.priceAlerts.length
      ? `- 采购价异常 ${f.priceAlerts.length} 项：` +
        f.priceAlerts
          .slice(0, 6)
          .map((a) => `${a.name}${a.pct > 0 ? "+" : ""}${round1(a.pct)}%`)
          .join("、")
      : `- 采购价无异常`,
    `- 员工任务待完成 ${f.pendingTasks} 项（逾期 ${f.overdueTasks}）`,
    `- 今日盘点待提交 ${f.pendingStocktakes} 项，采购申报待审批 ${f.pendingRequests} 条`,
  ];
  return { system, user: lines.join("\n") };
}
