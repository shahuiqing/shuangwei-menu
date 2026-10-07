/* ============ 成本对账（真实 COGS + 隐性损耗） ============
 * 标准 COGS 靠配方估算，后厨实际用了多少、浪费多少是看不见的。
 * 用「库存变动法」对账：真实 COGS = 期初库存 + 采购 − 期末库存。
 * 真实 COGS 与标准 COGS 的差额，就是隐性损耗（用了没报 + 浪费 + 上错菜）。
 */
import type { StocktakeRecord } from "./stocktakeHistory";

export interface ReconcileResult {
  /** 真实 COGS = 期初库存金额 + 期间采购额 − 期末库存金额 */
  realCogs: number;
  /** 隐性损耗 = 真实 COGS − 标准 COGS（正数=有隐性损耗） */
  hiddenLoss: number;
}

export function reconcileCost(
  openingStockValue: number,
  purchases: number,
  closingStockValue: number,
  standardCogs: number,
): ReconcileResult {
  const realCogs = openingStockValue + purchases - closingStockValue;
  return { realCogs, hiddenLoss: realCogs - standardCogs };
}

/** 从最近两次盘点（新→旧）+ 期间采购额 + 标准成本，算对账；盘点不足两次返回 null */
export function reconcileFromHistory(
  records: StocktakeRecord[],
  purchases: number,
  standardCogs: number,
): ReconcileResult | null {
  if (!Array.isArray(records) || records.length < 2) return null;
  const closing = Number(records[0]?.stockValue) || 0;
  const opening = Number(records[1]?.stockValue) || 0;
  return reconcileCost(opening, purchases, closing, standardCogs);
}
