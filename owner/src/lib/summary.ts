import { fmtMoney } from "./format";

/* ============ 经营小结 ============
 * 把看板数据压成一段可复制的中文摘要（发群/汇报用），纯函数。
 */

export interface SummaryInput {
  /** 区间标签：今天 / 近7天 / 近30天 */
  rangeLabel: string;
  /** 环比对照标签：昨天 / 上周 / 上月 */
  compareLabel: string;
  revenue: number;
  orders: number;
  aov: number;
  /** 环比变化（%），0~100 的数；无对比数据传 null */
  revenueChange: number | null;
  /** 热销第一名 */
  topDish?: { name: string; qty: number } | null;
  /** 低于安全库存的原料数 */
  lowCount: number;
  /** 采购价异常数 */
  priceAlertCount: number;
  /** 区间内损耗金额 */
  waste: number;
  /** 待接单数量 */
  pending: number;
  /** 超时未处理订单数 */
  lateCount: number;
}

const pctText = (v: number) => `${v >= 0 ? "+" : ""}${Math.round(v)}%`;

/** 一段可复制的经营小结 */
export function buildSummary(i: SummaryInput): string {
  const parts: string[] = [];

  let head = `${i.rangeLabel}营业 ${fmtMoney(i.revenue)}`;
  if (i.revenueChange !== null && Number.isFinite(i.revenueChange)) {
    head += `（较${i.compareLabel} ${pctText(i.revenueChange)}）`;
  }
  head += `，${i.orders} 单、客单价 ${fmtMoney(i.aov)}`;
  if (i.topDish && i.topDish.qty > 0) {
    head += `；热销「${i.topDish.name}」${i.topDish.qty} 份`;
  }
  parts.push(head + "。");

  const risks: string[] = [];
  if (i.lateCount > 0) risks.push(`${i.lateCount} 笔订单已超时`);
  if (i.pending > 0) risks.push(`${i.pending} 笔待接单`);
  if (i.lowCount > 0) risks.push(`${i.lowCount} 种原料低于安全库存`);
  if (i.priceAlertCount > 0) risks.push(`${i.priceAlertCount} 个采购价异常`);
  if (i.waste > 0) risks.push(`损耗 ${fmtMoney(i.waste)}`);

  parts.push(risks.length ? `关注：${risks.join("、")}。` : "暂无异常事项。");
  return parts.join("");
}

/** 卡片里按句分行展示 */
export function summaryLines(i: SummaryInput): string[] {
  return buildSummary(i)
    .split("。")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `${s}。`);
}
