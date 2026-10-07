/* ============ 本机数据上云同步（解禁后开放） ============
 *  - 操作日志 owner:audit:log     → public.owner_audit_log（at+action+detail 复合主键，upsert 幂等）
 *  - 盘点历史 owner:stocktake:history → public.owner_stocktake（at 主键）
 * 上行：dbSubscribe 变更后防抖推送，失败 10s 后重试一次；
 * 下行：initCloudSync 启动时全量拉取合并（两表各 ≤500/60 行，约 50KB/次）。
 * pull 引起的 localSet 走 writing 标记跳过，避免上行回环。
 * 依赖 SQL：supabase_owner_all.sql（未执行时 push/pull 静默失败，不影响本机功能）。
 */
import { supabase, isConfigured } from "./supabase";
import { localGet, localSet, dbSubscribe } from "./localdb";
import { loadAuditLog, type AuditEntry } from "./auditLog";
import { loadStocktakeHistory, type StocktakeRecord } from "./stocktakeHistory";

const AUDIT_KEY = "owner:audit:log";
const STOCK_KEY = "owner:stocktake:history";
const AUDIT_MAX = 500;
const STOCK_MAX = 60;
const DETAIL_MAX = 500;

export interface AuditRow {
  at: number;
  action: string;
  detail: string;
}
export interface StockRow {
  at: number;
  day: string;
  items: number;
  diffs: number;
  net_value: number;
  stock_value: number;
}

/** 本地 → 云行（detail 截断，保证复合主键稳定） */
export function toAuditRows(entries: AuditEntry[]): AuditRow[] {
  return entries.slice(0, AUDIT_MAX).map((e) => ({
    at: Number(e.at) || 0,
    action: String(e.action ?? ""),
    detail: String(e.detail ?? "").slice(0, DETAIL_MAX),
  }));
}

export function toStockRows(list: StocktakeRecord[]): StockRow[] {
  return list.slice(0, STOCK_MAX).map((r) => ({
    at: Number(r.at) || 0,
    day: String(r.day ?? ""),
    items: Number(r.items) || 0,
    diffs: Number(r.diffs) || 0,
    net_value: Number(r.netValue) || 0,
    stock_value: Number(r.stockValue) || 0,
  }));
}

/** 合并本地 + 云端：按复合键去重、新→旧、截断上限 */
export function mergeAudit(
  local: AuditEntry[],
  cloud: AuditRow[],
): AuditEntry[] {
  const seen = new Set<string>();
  const out: AuditRow[] = [];
  for (const e of [...toAuditRows(local), ...cloud]) {
    const k = `${e.at}|${e.action}|${e.detail}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  out.sort((a, b) => b.at - a.at);
  return out.slice(0, AUDIT_MAX).map((e) => ({
    at: e.at,
    action: e.action,
    detail: e.detail,
  }));
}

export function mergeStocktake(
  local: StocktakeRecord[],
  cloud: StockRow[],
): StocktakeRecord[] {
  const seen = new Set<number>();
  const out: StocktakeRecord[] = [];
  for (const r of [
    ...toStockRows(local).map((c) => ({
      at: c.at,
      day: c.day,
      items: c.items,
      diffs: c.diffs,
      netValue: c.net_value,
      stockValue: c.stock_value,
    })),
    ...cloud.map((c) => ({
      at: Number(c.at) || 0,
      day: String(c.day ?? ""),
      items: Number(c.items) || 0,
      diffs: Number(c.diffs) || 0,
      netValue: Number(c.net_value) || 0,
      stockValue: Number(c.stock_value) || 0,
    })),
  ]) {
    if (seen.has(r.at)) continue;
    seen.add(r.at);
    out.push(r);
  }
  out.sort((a, b) => b.at - a.at);
  return out.slice(0, STOCK_MAX);
}

/** pull 写入中标记，防上行回环 */
const writing = new Set<string>();

function writeLocal(key: string, value: unknown): boolean {
  const cur = localGet<unknown>(key);
  if (JSON.stringify(cur ?? null) === JSON.stringify(value)) return false;
  writing.add(key);
  try {
    localSet(key, value);
  } finally {
    writing.delete(key);
  }
  return true;
}

async function pushKey(key: string): Promise<boolean> {
  if (!isConfigured || !supabase) return false;
  if (writing.has(key)) return true;
  try {
    if (key === AUDIT_KEY) {
      const rows = toAuditRows(loadAuditLog());
      if (!rows.length) return true;
      const { error } = await supabase
        .from("owner_audit_log")
        .upsert(rows, { onConflict: "at,action,detail" });
      if (error) throw new Error(error.message);
      return true;
    }
    if (key === STOCK_KEY) {
      const rows = toStockRows(loadStocktakeHistory());
      if (!rows.length) return true;
      const { error } = await supabase
        .from("owner_stocktake")
        .upsert(rows, { onConflict: "at" });
      if (error) throw new Error(error.message);
      return true;
    }
    return true;
  } catch (e) {
    console.warn("[owner] cloud push failed:", key, e);
    return false;
  }
}

/** 下行：全量拉取合并（SQL 未执行时 error 静默，保持本机数据不动） */
export async function pullCloud(): Promise<{ audit: number; stock: number }> {
  if (!isConfigured || !supabase) return { audit: 0, stock: 0 };
  const [a, s] = await Promise.all([
    supabase
      .from("owner_audit_log")
      .select("at, action, detail")
      .order("at", { ascending: false })
      .limit(AUDIT_MAX),
    supabase
      .from("owner_stocktake")
      .select("at, day, items, diffs, net_value, stock_value")
      .order("at", { ascending: false })
      .limit(STOCK_MAX),
  ]);
  let audit = 0;
  let stock = 0;
  if (!a.error && Array.isArray(a.data)) {
    const merged = mergeAudit(loadAuditLog(), a.data as unknown as AuditRow[]);
    writeLocal(AUDIT_KEY, merged);
    audit = merged.length;
  }
  if (!s.error && Array.isArray(s.data)) {
    const merged = mergeStocktake(
      loadStocktakeHistory(),
      s.data as unknown as StockRow[],
    );
    writeLocal(STOCK_KEY, merged);
    stock = merged.length;
  }
  return { audit, stock };
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const retried = new Set<string>();
let subscribed = false;

function schedule(key: string, ms: number) {
  const t = timers.get(key);
  if (t) clearTimeout(t);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      void pushKey(key).then((ok) => {
        if (ok || retried.has(key)) return;
        retried.add(key);
        setTimeout(() => {
          retried.delete(key);
          void pushKey(key);
        }, 10000);
      });
    }, ms),
  );
}

/** 启动接入：注册变更监听 + 首次下拉（幂等，可重复调用） */
export function initCloudSync(): void {
  if (!isConfigured || !supabase) return;
  if (subscribed) return;
  subscribed = true;
  dbSubscribe((c) => {
    if (c.key !== AUDIT_KEY && c.key !== STOCK_KEY) return;
    if (writing.has(c.key)) return;
    schedule(c.key, 1500);
  });
  void pullCloud();
}

/** 手动同步：立即上行两键 + 下行合并（设置页按钮） */
export async function syncNow(): Promise<{ pushed: boolean; pulled: boolean }> {
  if (!isConfigured || !supabase) return { pushed: false, pulled: false };
  const [p1, p2] = await Promise.all([pushKey(AUDIT_KEY), pushKey(STOCK_KEY)]);
  await pullCloud();
  return { pushed: p1 && p2, pulled: true };
}

/** 清空云端操作日志（本机清空时一并调用，fire-and-forget） */
export async function clearCloudAudit(): Promise<void> {
  if (!isConfigured || !supabase) return;
  await supabase.from("owner_audit_log").delete().neq("at", -1);
}

/** 清空云端盘点历史 */
export async function clearCloudStock(): Promise<void> {
  if (!isConfigured || !supabase) return;
  await supabase.from("owner_stocktake").delete().neq("at", -1);
}
