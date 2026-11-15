import {
  num,
  type InventoryItem,
  type PurchaseOrder,
} from "../../lib/inventory";
import { getItemMeta } from "../../lib/masterData";
import { priceHistoryRef, type PriceReference } from "../../lib/priceAlert";

/** 采购/AI 票据复核的共用纯逻辑 */

export const sameUnit = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

export function conversionFactor(itemId: string, unit: string): number {
  const conversions = getItemMeta(itemId).conversions;
  const key = Object.keys(conversions).find((k) => sameUnit(k, unit));
  return key ? conversions[key] || 0 : 0;
}

export const signedPct = (v: number) =>
  `${v >= 0 ? "+" : ""}${Math.round(v * 100)}%`;

export interface ReviewRow {
  key: string;
  included: boolean;
  /** 用于入库的名称；采用译名后会变成中文 */
  name: string;
  /** 票面原文，便于对照 */
  sourceName: string;
  /** 外文票据的中文译名；中文票据为空 */
  nameZh: string;
  itemId: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  confidence: number;
  matchScore: number;
}

export interface ReviewCheck {
  unit: string;
  mismatch: boolean;
  factor: number;
  /** 折算成库存单位后的单价；无法可靠折算时为 0 */
  basePrice: number;
  history: PriceReference | null;
}

export function reviewCheckFor(
  row: ReviewRow,
  inv: InventoryItem[],
  list: PurchaseOrder[],
): ReviewCheck {
  const item = row.itemId ? inv.find((i) => i.id === row.itemId) : undefined;
  const unit = row.unit.trim() || item?.unit || "";
  const mismatch = Boolean(item && unit && !sameUnit(unit, item.unit));
  const factor = mismatch && item ? conversionFactor(item.id, unit) : 1;
  const price = num(row.unitPrice);
  const basePrice =
    item && price > 0 && (!mismatch || factor > 0)
      ? mismatch
        ? price / factor
        : price
      : 0;
  return {
    unit,
    mismatch,
    factor,
    basePrice,
    history:
      item && basePrice > 0
        ? priceHistoryRef(list, item.id, basePrice, item.unit)
        : null,
  };
}
