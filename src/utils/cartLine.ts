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
