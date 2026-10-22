// 订单金额唯一口径（Web 后台 / 打印调用方 / 结账共用）
//
// 口径：行金额 = (菜品单价 + Σ 配菜单价) × 数量；订单总额 = Σ 行金额。
//
// 为什么要有这个模块：老板反馈「一些品加完口味后单子不显示加的价格，加菜单和结账单上应该要有」。
// 历史代码在多个地方各自用 `item.price * quantity` 算金额，配菜的加价被丢掉，
// 导致逐项累加与 order.total 对不上，打印/退菜/结账各处口径不一致。
//
// 约定：
// - 纯函数，无副作用，便于单测；
// - 全部输出四舍五入到 2 位小数（餐馆金额都是两位小数，避免 0.1+0.2 浮点误差累积）；
// - 老订单 items 里没有 addons 字段（undefined）、addons 里 price 是字符串或 NaN，都必须安全；
// - 配菜单价以订单行 addons 快照为准（下单/加菜时冻结的快照），缺失时用菜单定义补。

import type { MenuItemAddon } from "../types/menu";
import type { OrderItem, OrderItemAddon } from "../types/order";
import { makeLineKey, parseLineKey } from "./cartLine";

/** 金额比较容差：小于 0.01 视为相等 */
export const MONEY_EPSILON = 0.005;

/**
 * 把任意价格值归一化成数字。
 * - "MAD75" / "¥75 / 份" / "75" / "75.5" → 取第一个数字
 * - "" / null / undefined / "abc" / NaN / Infinity → 0（绝不抛错）
 * - 负数会被截断为 0（菜单价不支持负数）
 */
export function parseMenuPrice(priceStr: unknown): number {
  if (typeof priceStr === "number") {
    return Number.isFinite(priceStr) && priceStr > 0 ? round2(priceStr) : 0;
  }
  if (priceStr === null || priceStr === undefined) return 0;
  const match = String(priceStr).match(/\d+(\.\d+)?/);
  if (!match) return 0;
  const num = parseFloat(match[0]);
  return Number.isFinite(num) && num > 0 ? round2(num) : 0;
}

/** 四舍五入到 2 位小数，并消除 -0 */
export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const r = Math.round((n + Number.EPSILON) * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
}

/** 数量归一化：非数字/负数 → 0，缺省 → 1（订单行默认一份） */
function normalizeQty(qty: unknown): number {
  if (qty === null || qty === undefined || qty === "") return 1;
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

/** 单个配菜加价（`{ price: "10" }`、`price: NaN`、缺 price 都安全） */
export function addonPrice(addon: any): number {
  if (!addon || typeof addon !== "object") return 0;
  return parseMenuPrice(addon.price);
}

/** 一行配菜合计加价（不含数量） */
export function addonsUnitTotal(addons: unknown): number {
  if (!Array.isArray(addons)) return 0;
  return round2(addons.reduce((sum, a) => sum + addonPrice(a), 0));
}

/** 行单价合计 = 菜品单价 + Σ 配菜单价（不乘数量） */
export function lineUnitTotal(item: any): number {
  if (!item || typeof item !== "object") return 0;
  return round2(parseMenuPrice(item.price) + addonsUnitTotal(item.addons));
}

/** 行小计 = (菜品单价 + Σ 配菜单价) × 数量 */
export function lineSubtotal(item: any): number {
  if (!item || typeof item !== "object") return 0;
  return round2(lineUnitTotal(item) * normalizeQty(item.quantity));
}

/** 订单逐项合计 = Σ 行小计（空/非法 items 安全返回 0） */
export function orderComputedTotal(items: unknown): number {
  if (!Array.isArray(items)) return 0;
  return round2(items.reduce((sum, item) => sum + lineSubtotal(item), 0));
}

/** 订单当前 `total` 字段的数值（兼容 total_amount，非法为 0） */
export function orderStoredTotal(order: any): number {
  if (!order || typeof order !== "object") return 0;
  return round2(Number(order.total ?? order.total_amount) || 0);
}

/**
 * 订单「应采用的金额」：以逐项合计为准；
 * 旧订单 items 缺失/为空（逐项合计为 0）而 total 有值时，信任 total。
 */
export function resolveOrderTotal(order: any): number {
  const computed = orderComputedTotal(order?.items);
  const stored = orderStoredTotal(order);
  if (computed === 0 && stored !== 0) return stored;
  return computed;
}

export interface OrderTotalAudit {
  /** 逐项合计（菜品单价 + 配菜单价）× 数量 */
  computed: number;
  /** 订单上保存的 total */
  stored: number;
  /** 应采用的金额（逐项合计为准） */
  resolved: number;
  /** 是否不一致（差异 > 0.01） */
  mismatch: boolean;
  /** stored - computed，正数表示订单 total 多算 */
  diff: number;
}

/** 校验订单 total 与逐项是否一致，供结账弹窗/打印调用方提示用 */
export function auditOrderTotal(order: any): OrderTotalAudit {
  const computed = orderComputedTotal(order?.items);
  const stored = orderStoredTotal(order);
  const resolved = resolveOrderTotal(order);
  const diff = round2(stored - computed);
  return {
    computed,
    stored,
    resolved,
    mismatch: Math.abs(diff) > MONEY_EPSILON,
    diff,
  };
}

/**
 * 由菜单定义生成订单行的配菜快照 `{ id, name, price }`。
 * - 配菜单价以菜单为准（订单行上的旧值仅在菜单里找不到该配菜时保留）；
 * - 菜单里不存在的 addonId 保留旧行快照里的同名配菜（不静默丢弃）；
 * - 结果按 id 排序去重，保证「同一菜品 + 同一组口味」行键稳定。
 */
export function buildAddonSnapshot(
  addonIds: string[],
  menuItem?: any,
  existingAddons?: any,
): OrderItemAddon[] {
  const menuAddons: MenuItemAddon[] = Array.isArray(menuItem?.addons)
    ? menuItem.addons
    : [];
  const previous: any[] = Array.isArray(existingAddons) ? existingAddons : [];
  const ids = [...new Set((addonIds || []).filter(Boolean))].sort();
  const out: OrderItemAddon[] = [];
  for (const id of ids) {
    const fromMenu = menuAddons.find((a) => a && a.id === id);
    if (fromMenu) {
      out.push({
        id: fromMenu.id,
        name: String(fromMenu.name || id),
        price: addonPrice(fromMenu),
      });
      continue;
    }
    const fromPrev = previous.find((a) => a && a.id === id);
    if (fromPrev) {
      out.push({
        id: String(fromPrev.id || id),
        name: String(fromPrev.name || id),
        price: addonPrice(fromPrev),
      });
    }
  }
  return out;
}

/**
 * 归一化订单行：补齐 addons 快照、按口径重算单价与行小计。
 *
 * @param item     订单行（可能来自老订单，没有 addons）
 * @param menuItem 菜单定义（可选；提供时配菜单价以菜单为准）
 */
export function normalizeOrderItem(item: any, menuItem?: any): OrderItem {
  const source = item && typeof item === "object" ? item : {};
  const addonIds = Array.isArray(source.addons)
    ? source.addons.map((a: any) => String(a?.id ?? "")).filter(Boolean)
    : [];
  const addons = buildAddonSnapshot(addonIds, menuItem, source.addons);
  const price =
    menuItem !== undefined
      ? parseMenuPrice(menuItem?.price)
      : parseMenuPrice(source.price);
  const normalized: OrderItem = {
    ...source,
    id: String(source.id ?? menuItem?.id ?? ""),
    name: String(source.name || menuItem?.title || menuItem?.name || ""),
    quantity: normalizeQty(source.quantity),
    price,
    subtotal: round2(
      (price + addonsUnitTotal(addons)) * normalizeQty(source.quantity),
    ),
  };
  if (addons.length > 0) normalized.addons = addons;
  else delete normalized.addons;
  return normalized;
}

/** 由菜单项 + 选中的口味生成一条后台加菜的订单行（isAdded=true） */
export function buildOrderLineFromMenu(
  menuItem: any,
  quantity: unknown,
  addonIds: string[] = [],
): OrderItem {
  const addons = buildAddonSnapshot(addonIds, menuItem);
  const qty = normalizeQty(quantity);
  const price = parseMenuPrice(menuItem?.price);
  const line: OrderItem = {
    id: String(menuItem?.id ?? ""),
    name: String(menuItem?.title || menuItem?.name || menuItem?.id || ""),
    enTitle: String(menuItem?.enTitle || ""),
    frTitle: String(menuItem?.frTitle || ""),
    arTitle: String(menuItem?.arTitle || ""),
    maTitle: String(menuItem?.maTitle || ""),
    quantity: qty,
    price,
    isAdded: true,
    subtotal: round2((price + addonsUnitTotal(addons)) * qty),
  };
  if (menuItem?.image) line.image = menuItem.image;
  if (addons.length > 0) line.addons = addons;
  return line;
}

/** 订单行在 UI 上展示的口味文案，例如 ["+ 加蛋 +¥5.00", "+ 加芝士"] */
export function describeAddons(item: any, currency = "¥"): string[] {
  if (!Array.isArray(item?.addons)) return [];
  return item.addons.map((a: any) => {
    const price = addonPrice(a);
    const name = String(a?.name || a?.id || "");
    return price > 0 ? `+ ${name} ${currency}${price.toFixed(2)}` : `+ ${name}`;
  });
}

/**
 * 合并订单行：同一菜品 + 同一组口味视为同一行（数量相加），不同口味保持独立行。
 * 用于后台「合并并入订单」逐行重算，保证逐项合计与 total 一致。
 */
export function mergeOrderItems(items: unknown): OrderItem[] {
  if (!Array.isArray(items)) return [];
  const merged: OrderItem[] = [];
  const index = new Map<string, number>();
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const item = normalizeOrderItem(raw);
    const key = makeLineKey(
      item.id || item.name,
      (item.addons || []).map((a) => a.id),
    );
    const pos = index.get(key);
    if (pos === undefined) {
      index.set(key, merged.length);
      merged.push(item);
    } else {
      const prev = merged[pos];
      const quantity = round2(prev.quantity + item.quantity);
      merged[pos] = {
        ...prev,
        quantity,
        subtotal: round2(lineUnitTotal(prev) * quantity),
      };
    }
  }
  return merged;
}

/**
 * 把「行键 → 数量」的购物车（后台加菜弹窗）转换成订单行。
 * 行键来自 cartLine.makeLineKey，同一菜品不同口味天然是不同行（独立订单行）。
 * 找不到菜单定义的脏行键会被跳过（返回的 items 里不含）。
 */
export function cartLinesToOrderItems(
  cart: Record<string, unknown>,
  menuItems: any[],
): OrderItem[] {
  if (!cart || typeof cart !== "object") return [];
  const list = Array.isArray(menuItems) ? menuItems : [];
  const out: OrderItem[] = [];
  for (const [lineKey, qty] of Object.entries(cart)) {
    const quantity = Number(qty);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const { dishId, addonIds } = parseLineKey(String(lineKey));
    const menuItem = list.find((i) => i && i.id === dishId);
    if (!menuItem) continue;
    out.push(buildOrderLineFromMenu(menuItem, quantity, addonIds));
  }
  return out;
}

/**
 * 退菜：把某一行数量减 1（数量为 1 则整行移除），并重算订单 total。
 * 返回 null 表示该行不存在；否则返回新的 items 与 total（均以逐项口径为准）。
 */
export function removeOneFromLine(
  items: unknown,
  lineIndex: number,
  storedTotal: number,
): { items: OrderItem[]; total: number; removedAmount: number } | null {
  if (!Array.isArray(items)) return null;
  if (lineIndex < 0 || lineIndex >= items.length) return null;
  const newItems = items.map((it) =>
    it && typeof it === "object" ? { ...it } : it,
  );
  const target = newItems[lineIndex];
  if (!target) return null;
  const unit = lineUnitTotal(target);
  const qty = normalizeQty(target.quantity);
  const removedAmount = round2(unit * Math.min(1, qty || 1));
  if (qty > 1) {
    const quantity = qty - 1;
    newItems[lineIndex] = {
      ...target,
      quantity,
      subtotal: round2(unit * quantity),
    };
  } else {
    newItems.splice(lineIndex, 1);
  }
  const computed = orderComputedTotal(newItems);
  const total = computed === 0 && storedTotal !== 0 ? 0 : computed;
  return { items: newItems as OrderItem[], total, removedAmount };
}
