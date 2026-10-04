/* ============ 跨天分界 ============
 * 营业日默认凌晨 3 点切分：次日 03:00 前的订单仍算前一天。
 * 供「每日定额」「盘点周期」「今日统计」统一口径。
 */

export const BUSINESS_DAY_HOUR = 3;

function asMs(t: number | Date): number {
  return t instanceof Date ? t.getTime() : t;
}

/** 当前/某时刻所在营业日的起始时刻（03:00） */
export function businessDayStart(t: number | Date = Date.now()): number {
  const ms = asMs(t);
  const d = new Date(ms);
  d.setHours(BUSINESS_DAY_HOUR, 0, 0, 0);
  if (d.getTime() > ms) d.setDate(d.getDate() - 1);
  return d.getTime();
}

/** 该营业日的结束时刻（次日 03:00） */
export function businessDayEnd(t: number | Date = Date.now()): number {
  return businessDayStart(t) + 24 * 3600 * 1000;
}

/** 营业日键（YYYY-MM-DD，取该时刻所属营业日开始日） */
export function businessDayKey(t: number | Date): string {
  const d = new Date(businessDayStart(t));
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** 该时刻是否落在某个营业日内 */
export function withinBusinessDay(
  t: number | Date,
  now: number | Date = Date.now(),
): boolean {
  const ms = asMs(t);
  const start = businessDayStart(now);
  return ms >= start && ms < start + 24 * 3600 * 1000;
}
