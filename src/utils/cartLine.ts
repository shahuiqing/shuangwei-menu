// 购物车行键：同一菜品选择不同加项（口味）时，各自成为独立的购物车行。
// 无加项的行键就是菜品 id；有加项的行键为 `${dishId}|${addonId1},${addonId2}`。

const SEP = "|";

export function makeLineKey(dishId: string, addonIds: string[] = []): string {
  const ids = [...addonIds].filter(Boolean).sort();
  return ids.length > 0 ? `${dishId}${SEP}${ids.join(",")}` : dishId;
}

export function parseLineKey(key: string): {
  dishId: string;
  addonIds: string[];
} {
  const idx = key.indexOf(SEP);
  if (idx < 0) return { dishId: key, addonIds: [] };
  return {
    dishId: key.slice(0, idx),
    addonIds: key
      .slice(idx + 1)
      .split(",")
      .filter(Boolean),
  };
}

/** 购物车结构：行键 → 数量 */
export type Cart = Record<string, number>;

/** 同一菜品的购物车总量（含所有口味行） */
export function dishQtyIn(cart: Cart, dishId: string): number {
  return Object.entries(cart).reduce(
    (sum, [key, qty]) =>
      parseLineKey(key).dishId === dishId ? sum + Number(qty || 0) : sum,
    0,
  );
}

/**
 * 按**行键**增减购物车数量。
 *
 * 关键：必须用 lineKey 读写，不能用 parseLineKey(lineKey).dishId。
 * 历史上曾把行键退化成 dishId，导致：
 *   1) 同一菜品的不同口味被合并成一行（按口味分行失效）；
 *   2) 从加项行减数量时，实际减掉的是该菜品的无加项主行。
 *
 * @returns 新的购物车对象（不修改入参）
 */
export function applyCartDelta(
  cart: Cart,
  lineKey: string,
  delta: number,
): Cart {
  const next = { ...cart };
  const qty = (next[lineKey] || 0) + delta;
  if (qty <= 0) {
    delete next[lineKey];
  } else {
    next[lineKey] = qty;
  }
  return next;
}
