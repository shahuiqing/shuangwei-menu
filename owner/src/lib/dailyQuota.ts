import { businessDayKey } from "./businessDay";
import { localGet, localSet } from "./localdb";

/* ============ 每日定额（前端 only，不动数据库） ============
 * 老板每天填「食材成本定额」（成本价），当日实际食材成本超出即算损耗。
 * 按营业日（凌晨 3 点分界）键控，存本机 localStorage。
 */

const KEY = "owner:quota:day";

function readMap(): Record<string, number> {
  const o = localGet<unknown>(KEY);
  return o && typeof o === "object" && !Array.isArray(o)
    ? (o as Record<string, number>)
    : {};
}

/** 某营业日的食材成本定额；未填返回 null */
export function getDailyQuota(dayKey: string): number | null {
  const v = readMap()[dayKey];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function setDailyQuota(dayKey: string, amount: number): number | null {
  const map = readMap();
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 0) {
    delete map[dayKey];
    localSet(KEY, map);
    return null;
  }
  map[dayKey] = amt;
  localSet(KEY, map);
  return amt;
}

/** 今日定额（营业日键） */
export function todayQuotaKey(now: number | Date = Date.now()): string {
  return businessDayKey(now);
}

/** 超出定额的部分（正数=超出，0=未超出）；无定额返回 null */
export function quotaOverrun(
  actualCost: number,
  quota: number | null,
): number | null {
  if (quota === null) return null;
  const over = actualCost - quota;
  return over > 0 ? over : 0;
}
