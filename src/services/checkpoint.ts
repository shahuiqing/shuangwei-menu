/**
 * 本地重置点（快照）服务
 *
 * 目的：把当前菜单数据快照到 localStorage，数据库不可用时也能快速恢复，
 * 不完全依赖 Supabase，作为容灾/备用手段。
 *
 * - 自动重置点：每次「保存到云端」成功后自动写入一份（保留最近若干份）
 * - 手动重置点：管理员可手动命名保存，用于重要节点
 */

export interface CheckpointData {
  categories: any[];
  promotions: any[];
  restaurantName: string;
  welcomeMessage: string;
  bgUrl: string;
  logoUrl: string;
  layoutStyle: string;
  theme: string;
  soundEnabled: boolean;
  receiptSettings: any;
  deletedItemIds: string[];
}

export interface Checkpoint {
  id: string;
  name: string;
  createdAt: string;
  auto: boolean;
  data: CheckpointData;
}

const STORAGE_KEY = "menu_checkpoints";
const MAX_MANUAL = 10;
const MAX_AUTO = 3;

type Listener = () => void;
const listeners: Listener[] = [];

function readAll(): Checkpoint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(list: Checkpoint[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("[checkpoint] 保存重置点失败（可能超出存储配额）", e);
  }
  listeners.forEach((cb) => cb());
}

function sortDesc(list: Checkpoint[]): Checkpoint[] {
  return [...list].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function trim(list: Checkpoint[]): Checkpoint[] {
  const sorted = sortDesc(list);
  const manual = sorted.filter((c) => !c.auto).slice(0, MAX_MANUAL);
  const auto = sorted.filter((c) => c.auto).slice(0, MAX_AUTO);
  return sortDesc([...manual, ...auto]);
}

export const checkpointService = {
  list(): Checkpoint[] {
    return sortDesc(readAll());
  },

  get(id: string): Checkpoint | null {
    return readAll().find((c) => c.id === id) || null;
  },

  getLatest(): Checkpoint | null {
    return checkpointService.list()[0] || null;
  },

  save(name: string, data: CheckpointData): Checkpoint {
    const cp: Checkpoint = {
      id: "cp-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      name: name || "手动重置点",
      createdAt: new Date().toISOString(),
      auto: false,
      data,
    };
    writeAll(trim([...readAll(), cp]));
    return cp;
  },

  autoSave(data: CheckpointData): void {
    const cp: Checkpoint = {
      id: "auto-" + Date.now(),
      name: "自动重置点（最近一次成功保存）",
      createdAt: new Date().toISOString(),
      auto: true,
      data,
    };
    writeAll(trim([...readAll(), cp]));
  },

  remove(id: string): void {
    writeAll(readAll().filter((c) => c.id !== id));
  },

  clear(): void {
    writeAll([]);
  },

  subscribe(cb: Listener): () => void {
    listeners.push(cb);
    return () => {
      const i = listeners.indexOf(cb);
      if (i > -1) listeners.splice(i, 1);
    };
  },
};
