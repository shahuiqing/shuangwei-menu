/* ============ 离线数据快照 ============
 * 关键只读数据在请求成功时写入 localStorage，
 * 断网/请求失败时回落到上次成功结果（配合顶栏离线提示）。
 * 快照只写不删，仅做体积守卫；不做写操作的缓存。
 */

const PREFIX = "owner:snap:";
/** 单条快照体积上限（字符数），超过则跳过写入，避免打爆 localStorage */
const MAX_LEN = 1_500_000;

let lastUsedAt = "";
const listeners = new Set<(at: string) => void>();

/** 最近一次「读到快照」的时间（ISO），未读过为空串 */
export function cacheUsedAt(): string {
  return lastUsedAt;
}

/** 订阅快照命中（Layout 顶栏显示缓存时间用） */
export function onCacheUse(cb: (at: string) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function markUsed(at: string) {
  lastUsedAt = at;
  listeners.forEach((cb) => {
    try {
      cb(at);
    } catch {
      /* ignore */
    }
  });
}

export function saveSnap<T>(key: string, data: T): void {
  if (data === null || data === undefined) return;
  try {
    const raw = JSON.stringify({ at: new Date().toISOString(), data });
    if (raw.length > MAX_LEN) return;
    localStorage.setItem(PREFIX + key, raw);
  } catch {
    /* 配额满/隐私模式忽略 */
  }
}

export function readSnap<T>(key: string): { data: T; at: string } | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || o.data === undefined || o.data === null) return null;
    return { data: o.data as T, at: String(o.at || "") };
  } catch {
    return null;
  }
}

/** 请求失败时的回落：命中快照则返回快照数据并标记时间，否则返回 fallback */
export function snapFallback<T>(key: string, fallback: T): T {
  const s = readSnap<T>(key);
  if (s) {
    markUsed(s.at);
    return s.data;
  }
  return fallback;
}
