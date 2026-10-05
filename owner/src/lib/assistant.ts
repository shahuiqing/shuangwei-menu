import { fmtMoney } from "./format";

/* ============ 经营问答（规则引擎，先于 AI，纯函数） ============
 * 基于真实指标回答老板的常见问题；后续可替换为 LLM。
 */

export interface AssistantData {
  revenue: number;
  orders: number;
  aov: number;
  foodCost: number;
  foodCostRate: number;
  waste: number;
  profit: number;
  topProblem: string | null;
}

export const PRESET_QUESTIONS = [
  "今天营业额多少",
  "食材成本率如何",
  "今天有没有损耗",
  "当前最大问题是什么",
];

export function ask(question: string, d: AssistantData): string {
  const q = (question || "").toLowerCase();
  if (!q.trim()) return "问我营业、成本、损耗、利润或问题吧。";
  if (/营业额|营收|卖了多|销售/.test(q))
    return `本期营业额 ${fmtMoney(d.revenue)}，共 ${d.orders} 单。`;
  if (/客单|每单|平均|单价/.test(q)) return `客单价 ${fmtMoney(d.aov)}。`;
  if (/成本率|食材成本率/.test(q))
    return `食材成本率 ${d.foodCostRate.toFixed(1)}%。`;
  if (/成本|食材/.test(q))
    return `食材成本 ${fmtMoney(d.foodCost)}，占营业额 ${d.foodCostRate.toFixed(1)}%。`;
  if (/损耗|浪费|报损/.test(q))
    return d.waste > 0 ? `今日损耗 ${fmtMoney(d.waste)}。` : "今日暂无损耗。";
  if (/利润|赚了|毛利|净利/.test(q))
    return `毛利 ${fmtMoney(d.profit)}（营业额 − 食材成本）。`;
  if (/问题|异常|风险|待办/.test(q))
    return d.topProblem ? `当前最大问题：${d.topProblem}` : "暂无异常问题。";
  return `我可以回答营业额、客单价、食材成本率、损耗、利润、当前问题等。试试「${PRESET_QUESTIONS[0]}」。`;
}

/** LLM 系统提示（含真实经营数据上下文）；无 Key 时不会被调用 */
export function llmSystemPrompt(
  d: AssistantData,
  brief: string[] = [],
): string {
  const lines = [
    `你是「双味居」餐饮店的经营分析助手，用简洁中文回答老板的问题。`,
    `要求：基于给出的真实数据回答，给出具体数字和 1-2 条可执行建议，不超过 200 字；数据没有的信息要明说，不要编造。`,
    `当前经营数据（今天）：`,
    `- 营业额 ${fmtMoney(d.revenue)}，订单 ${d.orders} 单，客单价 ${fmtMoney(d.aov)}`,
    `- 食材成本 ${fmtMoney(d.foodCost)}，成本率 ${d.foodCostRate.toFixed(1)}%，毛利 ${fmtMoney(d.profit)}`,
    `- 损耗 ${fmtMoney(d.waste)}`,
    `- 当前最大问题：${d.topProblem ?? "暂无"}`,
  ];
  if (brief.length) lines.push(`今日简报：\n${brief.join("\n")}`);
  return lines.join("\n");
}
