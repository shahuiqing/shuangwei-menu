/* ============ 数据置信度 ============
 * 依据「积累了多少数据 + 是否盘点过」给一个粗粒度置信度，
 * 首页低置信的数字标灰，避免老板误信。
 */

export type Confidence = "high" | "medium" | "low";

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export interface ConfidenceInput {
  /** 采购记录条数（周期积累的代理） */
  purchaseCount: number;
  /** 是否盘点过（盘点能校正消耗率/差异） */
  stocktakeDone: boolean;
}

export function dataConfidence(input: ConfidenceInput): Confidence {
  let pts = 0;
  if (input.purchaseCount >= 10) pts += 2;
  else if (input.purchaseCount >= 3) pts += 1;
  if (input.stocktakeDone) pts += 1;
  return pts >= 3 ? "high" : pts >= 1 ? "medium" : "low";
}
