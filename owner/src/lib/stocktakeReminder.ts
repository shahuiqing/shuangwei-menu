import { businessDayKey } from "./businessDay";

/* ============ 盘点提醒（前端 only，不动数据库） ============
 * 记录上次盘点时间，按周期判断是否该提醒（供今日待办 / 盘点入口提示）。
 */

const KEY = "owner:last-stocktake";

export function markStocktake(now: number | Date = Date.now()): void {
  const ms = now instanceof Date ? now.getTime() : now;
  try {
    localStorage.setItem(KEY, String(ms));
  } catch {
    /* ignore */
  }
}

export function lastStocktakeAt(): number | null {
  try {
    const v = localStorage.getItem(KEY);
    const n = Number(v);
    return v && Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
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
