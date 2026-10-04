/* ============ 本地主数据扩展（前端 only，不动数据库） ============
 * 原料的「最小单位换算 / 可盘·不可盘 / A类」暂存本机 localStorage，
 * 以云端 inventory_items 的 id 为键关联（同一设备内生效）。
 * 后续要跨设备/多人协作时，再迁移为数据库列。
 */

export interface ItemMeta {
  /** 是否可盘点（称重/计数）。false = 不可盘（按消耗率估） */
  countable: boolean;
  /** 是否 A 类食材（重点监控，优先盘点） */
  classA: boolean;
  /** 采购单位 → 换算到最小单位的系数（1 采购单位 = factor 个最小单位） */
  conversions: Record<string, number>;
}

const KEY = "owner:item:meta";

export const DEFAULT_META: ItemMeta = {
  countable: true,
  classA: false,
  conversions: {},
};

function readRaw(): Record<string, ItemMeta> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === "object" && !Array.isArray(o) ? o : {};
  } catch {
    return {};
  }
}

function persist(map: Record<string, ItemMeta>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* 配额/隐私模式忽略 */
  }
}

/** 全量读取（渲染徽章用） */
export function loadMetaMap(): Record<string, ItemMeta> {
  const raw = readRaw();
  const out: Record<string, ItemMeta> = {};
  for (const [id, m] of Object.entries(raw)) {
    out[id] = normalize(m);
  }
  return out;
}

function normalize(m: unknown): ItemMeta {
  const o = (m && typeof m === "object" ? m : {}) as Partial<ItemMeta>;
  return {
    countable: o.countable !== false,
    classA: !!o.classA,
    conversions:
      o.conversions && typeof o.conversions === "object" ? o.conversions : {},
  };
}

export function getItemMeta(id: string): ItemMeta {
  const raw = readRaw()[id];
  return normalize(raw);
}

export function saveItemMeta(id: string, patch: Partial<ItemMeta>): ItemMeta {
  const cur = getItemMeta(id);
  const next: ItemMeta = {
    countable: patch.countable ?? cur.countable,
    classA: patch.classA ?? cur.classA,
    conversions: patch.conversions ?? cur.conversions,
  };
  const map = readRaw();
  map[id] = next;
  persist(map);
  return next;
}

/** 新增/覆盖一条采购单位换算；buyUnit 为空或 factor<=0 时不写 */
export function addConversion(
  id: string,
  buyUnit: string,
  factor: number,
): ItemMeta {
  const buy = String(buyUnit || "").trim();
  if (!buy || !(factor > 0) || !Number.isFinite(factor)) return getItemMeta(id);
  const meta = getItemMeta(id);
  meta.conversions = { ...meta.conversions, [buy]: factor };
  return saveItemMeta(id, { conversions: meta.conversions });
}

export function removeConversion(id: string, buyUnit: string): ItemMeta {
  const meta = getItemMeta(id);
  const next = { ...meta.conversions };
  delete next[buyUnit];
  return saveItemMeta(id, { conversions: next });
}

/** 某采购单位的换算系数；无则 1 */
export function unitFactor(
  meta: ItemMeta | undefined,
  buyUnit: string,
): number {
  const f = buyUnit ? meta?.conversions[buyUnit] : undefined;
  return f && f > 0 ? f : 1;
}

/** 把「采购单位数量」换算成「最小单位数量」；无换算时原样返回 */
export function toMinQuantity(
  meta: ItemMeta | undefined,
  buyUnit: string,
  qty: number,
): number {
  return qty * unitFactor(meta, buyUnit);
}
