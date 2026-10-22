import type { MenuCategory, MenuItem } from "../types/menu";

/**
 * 推导「被删除的内置菜品」标识集合。
 *
 * 背景：内置菜单（INITIAL_MENU_CATEGORIES）随代码发布，云端/本地若缺少其中某项，
 * 说明店主主动删过它，需要记录到 deletedItemIds，避免下次合并时又冒出来。
 *
 * 历史缺陷：该推导曾在每次保存时无条件执行，任何一次「结构变化」（如改主题
 * 触发的 silent 全量保存）都会把当时不满足匹配条件的条目整批标记为已删除，
 * 造成默认菜品成批误删。
 *
 * 修复策略：
 * - 只有调用方**明确处于菜品编辑场景**（`menuMutation = true`）时才补齐标记；
 *   改主题/改布局等非菜单写入不再触碰 deletedItemIds。
 * - 保持幂等：相同输入多次调用结果一致。
 */
export type DeletedId = string | number;

function pushUnique(target: DeletedId[], value: unknown) {
  if (value === undefined || value === null) return;
  const v = typeof value === "string" ? value : String(value);
  if (!v) return;
  if (!target.includes(v)) target.push(v);
}

/**
 * 判断两个标识是否「真正相等」。
 *
 * 关键：双方都为空（undefined/null/""）时必须视为**不相等**。
 * 曾直接写 `a.name === b.name`，当两个菜品都没有 name 字段（MenuItem 用的是
 * title）时 `undefined === undefined` 恒为 true，导致被删菜品永远匹配到别的菜品、
 * 从而漏标记，下次合并时「已删除的菜又冒出来」。
 */
function idEquals(a: unknown, b: unknown): boolean {
  const sa = a === undefined || a === null ? "" : String(a);
  const sb = b === undefined || b === null ? "" : String(b);
  if (!sa || !sb) return false;
  return sa === sb;
}

/** 两个菜品/分类是否为同一条（按 id、title、name 任一且非空匹配） */
function sameItem(
  a: { id?: unknown; title?: unknown; name?: unknown },
  b: { id?: unknown; title?: unknown; name?: unknown },
): boolean {
  return (
    idEquals(a.id, b.id) ||
    idEquals(a.title, b.title) ||
    idEquals(a.name, b.name)
  );
}

export function deriveDeletedItemIds(
  initialCategories: MenuCategory[],
  currentCategories: MenuCategory[],
  existing: DeletedId[] = [],
): DeletedId[] {
  const result: DeletedId[] = Array.from(new Set<DeletedId>(existing));

  for (const cat of initialCategories) {
    const catFound = currentCategories.find((c: MenuCategory) =>
      sameItem(c, cat),
    );

    if (!catFound) {
      pushUnique(result, cat.id);
      pushUnique(result, cat.name);
      pushUnique(result, (cat as { title?: string }).title);
      (cat.items || []).forEach((item: MenuItem) => {
        pushUnique(result, item.id);
        pushUnique(result, (item as { title?: string }).title);
        pushUnique(result, item.name);
      });
      continue;
    }

    (cat.items || []).forEach((item: MenuItem) => {
      const itemFound = (catFound.items || []).find((i: MenuItem) =>
        sameItem(i, item),
      );
      if (!itemFound) {
        pushUnique(result, item.id);
        pushUnique(result, (item as { title?: string }).title);
        pushUnique(result, item.name);
      }
    });
  }

  return result;
}
