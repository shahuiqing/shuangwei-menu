import { fmtMoney } from "./format";

/* ============ 经营助手（规则版，零成本、离线可用） ============
 * 规则优先回答常见问题；复杂问题交给 LLM（见 llm.ts）。
 * ops 为库存/采购/员工任务等经营事实（可选，缺失时不影响原有问答）。
 */

/** 库存/采购/员工协同的实时事实 */
export interface OpsFacts {
  /** 低于安全库存的原料（按缺口排序后的前几条即可） */
  lowStock: {
    name: string;
    stock: number;
    unit: string;
    safety: number;
  }[];
  /** 采购价异常（较中位价上涨） */
  priceAlerts: { name: string; pct: number }[];
  /** 待审批的采购申报 */
  pendingRequests: number;
  /** 员工任务：待完成 / 其中逾期 */
  pendingTasks: number;
  overdueTasks: number;
  /** 今日待完成的盘点任务 */
  pendingStocktakes: number;
}

export interface AssistantData {
  revenue: number;
  orders: number;
  aov: number;
  foodCost: number;
  foodCostRate: number;
  waste: number;
  profit: number;
  topProblem: string | null;
  /** 库存/采购/员工任务事实（可选） */
  ops?: OpsFacts;
}

export const PRESET_QUESTIONS = [
  "今天生意怎么样？",
  "哪些原料快没货了？",
  "员工任务完成得怎么样？",
  "有采购价异常吗？",
  "这周成本率正常吗？",
  "今天最该先处理什么？",
];

const round1 = (n: number) => Math.round(n * 10) / 10;

function lowStockAnswer(ops?: OpsFacts): string {
  if (!ops || ops.lowStock.length === 0)
    return "库存正常，没有低于安全库存的原料。";
  const top = ops.lowStock.slice(0, 5);
  const lines = top.map(
    (i) => `· ${i.name}：现存 ${i.stock}${i.unit}（安全 ${i.safety}${i.unit}）`,
  );
  const more =
    ops.lowStock.length > top.length
      ? `\n另有 ${ops.lowStock.length - top.length} 种，去「库存」页查看完整清单。`
      : "";
  return `低于安全库存的有 ${ops.lowStock.length} 种：\n${lines.join("\n")}${more}`;
}

function priceAlertAnswer(ops?: OpsFacts): string {
  if (!ops || ops.priceAlerts.length === 0)
    return "近期没有明显高于历史中位价的采购，价格正常。";
  const top = ops.priceAlerts.slice(0, 5);
  return `采购价异常 ${ops.priceAlerts.length} 项：\n${top
    .map(
      (a) => `· ${a.name}：较中位价 ${a.pct > 0 ? "+" : ""}${round1(a.pct)}%`,
    )
    .join("\n")}`;
}

function taskAnswer(ops?: OpsFacts): string {
  if (!ops) return "员工任务数据暂未加载，去「任务派发」页查看。";
  const parts: string[] = [];
  parts.push(
    ops.pendingTasks > 0
      ? `待完成 ${ops.pendingTasks} 项`
      : "没有待完成的员工任务",
  );
  if (ops.overdueTasks > 0) parts.push(`其中逾期 ${ops.overdueTasks} 项`);
  if (ops.pendingStocktakes > 0)
    parts.push(`今日盘点还有 ${ops.pendingStocktakes} 项未提交`);
  if (ops.pendingRequests > 0)
    parts.push(`采购申报待审批 ${ops.pendingRequests} 条`);
  return parts.join("；") + "。";
}

export function ask(question: string, d: AssistantData): string {
  const q = (question || "").toLowerCase();
  if (!q.trim())
    return "可以问我营业额、成本、库存、员工任务或采购方面的问题。";
  if (/缺货|没货|库存|补货|原料|安全库存/.test(q)) return lowStockAnswer(d.ops);
  if (/价格|涨价|采购价|比价/.test(q)) return priceAlertAnswer(d.ops);
  if (/任务|员工|完成情况|谁没|盘点进度/.test(q)) return taskAnswer(d.ops);
  if (/申报|审批|采购申请/.test(q))
    return d.ops
      ? d.ops.pendingRequests > 0
        ? `有 ${d.ops.pendingRequests} 条采购申报待审批，去「采购申报」页处理。`
        : "没有待审批的采购申报。"
      : "采购申报数据暂未加载。";
  if (/营业额|营收|收入|卖了多少/.test(q))
    return `今天营业额 ${fmtMoney(d.revenue)}，共 ${d.orders} 单。`;
  if (/客单|平均/.test(q)) return `今天客单价 ${fmtMoney(d.aov)}。`;
  if (/成本率|毛利/.test(q))
    return `今天成本率 ${d.foodCostRate.toFixed(1)}%，利润 ${fmtMoney(d.profit)}。`;
  if (/成本|食材/.test(q))
    return `今天食材成本 ${fmtMoney(d.foodCost)}，成本率 ${d.foodCostRate.toFixed(1)}%。`;
  if (/损耗|报损|浪费/.test(q))
    return d.waste > 0
      ? `今天损耗 ${fmtMoney(d.waste)}。`
      : "今天没有报损记录。";
  if (/利润|赚/.test(q))
    return `今天利润 ${fmtMoney(d.profit)}（营业额 − 食材成本）。`;
  if (/问题|异常|注意|先处理/.test(q))
    return d.topProblem
      ? `目前最需要处理：${d.topProblem}`
      : "目前没有明显异常。";
  return `这个问题可以试试点上面的常见问题，或直接问「${PRESET_QUESTIONS[0]}」。`;
}

/** LLM 系统提示（只发送必要经营事实）；Key 由本机配置 */
export function llmSystemPrompt(
  d: AssistantData,
  brief: string[] = [],
): string {
  const lines = [
    `你是餐厅老板的经营助手，回答要具体、简短、可执行。`,
    `规则：只根据下面提供的数据回答，不要编造；不确定就说不知道；控制在 200 字内。`,
    `经营数据（今天）：`,
    `- 营业额 ${fmtMoney(d.revenue)}，订单 ${d.orders} 单，客单价 ${fmtMoney(d.aov)}`,
    `- 食材成本 ${fmtMoney(d.foodCost)}，成本率 ${d.foodCostRate.toFixed(1)}%，利润 ${fmtMoney(d.profit)}`,
    `- 损耗 ${fmtMoney(d.waste)}`,
    `- 当前最大问题：${d.topProblem ?? "暂无"}`,
  ];
  if (d.ops) {
    lines.push(`库存与员工协同（实时）：`);
    if (d.ops.lowStock.length) {
      lines.push(
        `- 低于安全库存 ${d.ops.lowStock.length} 种：` +
          d.ops.lowStock
            .slice(0, 8)
            .map(
              (i) =>
                `${i.name}(存 ${i.stock}${i.unit}/安全 ${i.safety}${i.unit})`,
            )
            .join("、"),
      );
    } else lines.push(`- 库存正常，无低于安全库存的原料`);
    if (d.ops.priceAlerts.length) {
      lines.push(
        `- 采购价异常 ${d.ops.priceAlerts.length} 项：` +
          d.ops.priceAlerts
            .slice(0, 6)
            .map((a) => `${a.name}${a.pct > 0 ? "+" : ""}${round1(a.pct)}%`)
            .join("、"),
      );
    }
    lines.push(
      `- 员工任务待完成 ${d.ops.pendingTasks} 项（逾期 ${d.ops.overdueTasks}），今日盘点待提交 ${d.ops.pendingStocktakes} 项，采购申报待审批 ${d.ops.pendingRequests} 条`,
    );
  }
  if (brief.length) lines.push(`每日简报：\n${brief.join("\n")}`);
  return lines.join("\n");
}
