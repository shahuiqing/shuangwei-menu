import { businessDayKey } from "./businessDay";
import { localGet, localSet } from "./localdb";

/* ============ 盘点提醒（前端 only，不动数据库） ============
 * 记录上次盘点时间，按周期判断是否该提醒（供今日待办 / 盘点入口提示）。
 */

const KEY = "owner:last-stocktake";
const COUNT_KEY = "owner:stocktake:count";

export function markStocktake(now: number | Date = Date.now()): void {
  const ms = now instanceof Date ? now.getTime() : now;
  localSet(KEY, ms);
  localSet(COUNT_KEY, stocktakeCount() + 1);
}

/** 累计盘点次数（周期积累的代理） */
export function stocktakeCount(): number {
  const n = Number(localGet<number>(COUNT_KEY));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export type StocktakeConfidence = "low" | "medium" | "high";

export const STOCKTAKE_CONF_LABEL: Record<StocktakeConfidence, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

/** 盘点置信度：随盘点次数积累，人工修正可额外加权 */
export function stocktakeConfidence(
  manualCorrections = 0,
): StocktakeConfidence {
  const pts = Math.min(stocktakeCount(), 5) + Math.min(manualCorrections, 2);
  return pts >= 5 ? "high" : pts >= 3 ? "medium" : "low";
}

export function lastStocktakeAt(): number | null {
  const n = Number(localGet<number>(KEY));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 距上次盘点的天数；从未盘点返回 null */
export function daysSinceStocktake(
  now: number | Date = Date.now(),
): number | null {
  const last = lastStocktakeAt();
  if (last === null) return null;
  const ms = now instanceof Date ? now.getTime() : now;
  return Math.floor((ms - last) / 86400000);
}

/** 是否已到盘点周期（默认 7 天）；从未盘点视为「应该盘」 */
export function stocktakeDue(
  now: number | Date = Date.now(),
  cycleDays = 7,
): boolean {
  const d = daysSinceStocktake(now);
  return d === null || d >= cycleDays;
}

/** 上次盘点所属营业日（供界面展示） */
export function lastStocktakeDay(): string | null {
  const last = lastStocktakeAt();
  return last === null ? null : businessDayKey(last);
}
