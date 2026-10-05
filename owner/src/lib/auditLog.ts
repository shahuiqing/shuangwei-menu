/* ============ 操作日志 ============
 * 关键业务动作（盘点/报损/任务流转/定额/采购…）记到本机，
 * 供设置页回溯与换机前审计；上限 500 条，随本地数据备份导出。
 * 已上云：由 cloudSync 自动同步到 owner_audit_log（多设备合并）。
 */

import { localGet, localSet } from "./localdb";

export interface AuditEntry {
  at: number;
  action: string;
  detail: string;
}

const KEY = "owner:audit:log";
const MAX = 500;

/** 记一条日志（新→旧排列；失败静默，绝不影响主流程） */
export function logAction(action: string, detail = ""): void {
  try {
    const list = loadAuditLog();
    list.unshift({ at: Date.now(), action, detail });
    localSet(KEY, list.slice(0, MAX));
  } catch {
    /* ignore */
  }
}

export function loadAuditLog(): AuditEntry[] {
  const o = localGet<unknown>(KEY);
  return Array.isArray(o) ? (o as AuditEntry[]) : [];
}

export function clearAuditLog(): void {
  localSet(KEY, []);
}
