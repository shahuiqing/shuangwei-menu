/* ============ 盘点记录 ============
 * 每次盘点落一条记录（时间/营业日/品项/差异数/净差异），
 * 供设置与库存页回溯；与云端流水互补（云端盘点失败也有据可查）。
 * 已上云：由 cloudSync 自动同步到 owner_stocktake（多设备合并）。
 */

import { businessDayKey } from "./businessDay";
import { localGet, localSet } from "./localdb";

export interface StocktakeRecord {
  at: number;
  day: string;
  /** 实盘品项数 */
  items: number;
  /** 有差异的品项数 */
  diffs: number;
  /** 净差异金额（正=盘盈，负=盘亏） */
  netValue: number;
  /** 盘点后的库存总额（成本对账锚点） */
  stockValue: number;
}

const KEY = "owner:stocktake:history";
const MAX = 60;

export function pushStocktake(r: {
  items: number;
  diffs: number;
  netValue: number;
  stockValue: number;
}): StocktakeRecord {
  const rec: StocktakeRecord = {
    at: Date.now(),
    day: businessDayKey(Date.now()),
    items: r.items,
    diffs: r.diffs,
    netValue: r.netValue,
    stockValue: r.stockValue,
  };
  const list = loadStocktakeHistory();
  list.unshift(rec);
  localSet(KEY, list.slice(0, MAX));
  return rec;
}

/** 新→旧 */
export function loadStocktakeHistory(): StocktakeRecord[] {
  const o = localGet<unknown>(KEY);
  return Array.isArray(o) ? (o as StocktakeRecord[]) : [];
}

export function clearStocktakeHistory(): void {
  localSet(KEY, []);
}
