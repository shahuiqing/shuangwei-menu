/* ============ 统一本地存储层 ============
 * 所有「本机暂存」数据统一走这里：版本化、变更通知、统一导出/导入。
 * 将来接云端时，只需订阅变更事件做增量同步，读写入口不变。
 */

export const DB_VERSION = 1;

type Change = { key: string; op: "set" | "remove" };
type Listener = (c: Change) => void;

const listeners = new Set<Listener>();

/** 订阅本地数据变更（供将来的增量同步 / UI 刷新） */
export function dbSubscribe(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function emit(op: "set" | "remove", key: string) {
  for (const cb of listeners) {
    try {
      cb({ key, op });
    } catch {
      /* ignore */
    }
  }
}

/** 读一个 JSON 值；缺失/解析失败返回 null */
export function localGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

/** 写一个 JSON 值（自动序列化），并广播变更 */
export function localSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    emit("set", key);
  } catch {
    /* 配额满/隐私模式忽略 */
  }
}

export function localRemove(key: string): void {
  try {
    localStorage.removeItem(key);
    emit("remove", key);
  } catch {
    /* ignore */
  }
}

/** 读写原始字符串（用于密码哈希等非 JSON 数据） */
export function localRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function localSetRaw(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
    emit("set", key);
  } catch {
    /* ignore */
  }
}

/* ============ 导出 / 导入 ============ */

export const LOCAL_KEYS = [
  "owner:item:meta",
  "owner:order:tag",
  "owner:tasks",
  "owner:quota:day",
  "owner:late:cfg",
  "owner:receipt:link",
  "owner:last-stocktake",
  "owner:stocktake:count",
  "owner:notify:orders",
];

export function exportLocalData(): string {
  const data: Record<string, string> = {};
  for (const k of LOCAL_KEYS) {
    const v = localRaw(k);
    if (v !== null) data[k] = v;
  }
  return JSON.stringify(
    {
      app: "shuangwei-owner",
      dbVersion: DB_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    },
    null,
    2,
  );
}

export function importLocalData(json: string): number {
  const o = JSON.parse(json);
  const data = (o && typeof o === "object" ? o.data : null) || {};
  let ok = 0;
  for (const [k, v] of Object.entries(data)) {
    if (LOCAL_KEYS.includes(k) && v !== undefined && v !== null) {
      try {
        localSetRaw(k, String(v));
        ok += 1;
      } catch {
        /* ignore */
      }
    }
  }
  return ok;
}

/** 本机暂存数据概况（供设置页展示） */
export function localDataStats(): { count: number; bytes: number } {
  let count = 0;
  let bytes = 0;
  for (const k of LOCAL_KEYS) {
    const v = localRaw(k);
    if (v !== null) {
      count += 1;
      bytes += k.length + v.length;
    }
  }
  return { count, bytes };
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
