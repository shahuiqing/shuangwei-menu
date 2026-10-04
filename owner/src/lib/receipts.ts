/* ============ 票据图片本地存储（IndexedDB，手机本地） ============
 * 图片存本机 IndexedDB，系统只保存「图片 id」索引。
 * 换手机会丢图（需备份），但采购数据仍在云端。
 */

const DB = "owner-receipts";
const STORE = "images";

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB, 1);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export interface ReceiptMeta {
  id: string;
  name: string;
  size: number;
  at: number;
}

function newReceiptId() {
  return `rcpt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** 存一张图，返回图片 id（失败/不支持返回 null） */
export async function saveReceiptImage(
  blob: Blob,
  name = "receipt",
): Promise<string | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const id = newReceiptId();
    const rec = { id, blob, name, size: blob.size, at: Date.now() };
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = () => {
      db.close();
      resolve(id);
    };
    tx.onerror = () => {
      db.close();
      resolve(null);
    };
  });
}

/** 读一张图（预览/核对用） */
export async function getReceiptImage(
  id: string,
): Promise<{ blob: Blob; name: string } | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const req = db.transaction(STORE).objectStore(STORE).get(id);
    req.onsuccess = () => {
      const r = req.result as { blob: Blob; name: string } | undefined;
      db.close();
      resolve(r ? { blob: r.blob, name: r.name } : null);
    };
    req.onerror = () => {
      db.close();
      resolve(null);
    };
  });
}

/** 列出所有本地票据图（不含 blob，仅元数据） */
export async function listReceiptImages(): Promise<ReceiptMeta[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result || []) as Array<{
        id: string;
        name: string;
        size: number;
        at: number;
      }>;
      db.close();
      resolve(
        rows
          .map((r) => ({ id: r.id, name: r.name, size: r.size, at: r.at }))
          .sort((a, b) => b.at - a.at),
      );
    };
    req.onerror = () => {
      db.close();
      resolve([]);
    };
  });
}

export async function deleteReceiptImage(id: string): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve(true);
    };
    tx.onerror = () => {
      db.close();
      resolve(false);
    };
  });
}

/* ---------- 采购单 → 图片 id 索引（localStorage，不动数据库） ---------- */

const LINK_KEY = "owner:receipt:link";

function readLinks(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(LINK_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === "object" && !Array.isArray(o) ? o : {};
  } catch {
    return {};
  }
}

export function linkReceipts(purchaseId: string, imageIds: string[]): void {
  try {
    const map = readLinks();
    map[purchaseId] = Array.from(new Set(imageIds.filter(Boolean)));
    localStorage.setItem(LINK_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function receiptsForPurchase(purchaseId: string): string[] {
  return readLinks()[purchaseId] || [];
}
