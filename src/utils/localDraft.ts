// 本地草稿追踪：检测"启动时云端覆盖本地未同步编辑"的冲突。
//
// 问题：App 启动时 initData 拿到云端数据后直接 processSettingsData 覆盖当前状态，
// 若老板离线改过菜单（localStorage 里 menuCategories 已变），这些本地编辑会被无声丢弃。
//
// 方案：每次本地编辑写入一个时间戳 menuLocalDraftTs；成功保存到云端后清除。
// 启动时若该时间戳存在，说明本地有未同步的改动，提示用户选择"用本地"还是"用云端"。

const DRAFT_TS_KEY = "menuLocalDraftTs";

/** 记录本地编辑时间戳。在每次本地写入 localStorage 的编辑入口调用。 */
export function touchLocalDraft(): void {
  try {
    localStorage.setItem(DRAFT_TS_KEY, String(Date.now()));
  } catch {
    // localStorage 不可用时静默跳过：不影响编辑功能本身
  }
}

/** 清除本地草稿标记。在成功保存到云端后调用。 */
export function clearLocalDraft(): void {
  try {
    localStorage.removeItem(DRAFT_TS_KEY);
  } catch {
    // 同上
  }
}

/**
 * 检查是否有未同步的本地草稿。
 * @returns 草稿时间戳（毫秒），没有则返回 0
 */
export function getLocalDraftTs(): number {
  try {
    const v = localStorage.getItem(DRAFT_TS_KEY);
    if (!v) return 0;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * 判断本地草稿的 categories 与云端 categories 是否有实质差异。
 * 仅比较菜品 id 集合 + 价格，避免深比较的开销。
 */
export function categoriesDiffer(local: unknown, cloud: unknown): boolean {
  if (!Array.isArray(local) || !Array.isArray(cloud)) return false;

  // 收集本地菜品 (id → price)
  const localMap = new Map<string, string>();
  for (const cat of local) {
    if (!cat || typeof cat !== "object") continue;
    const items = (cat as { items?: unknown }).items;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const id = String((item as { id?: unknown }).id ?? "");
      const price = String((item as { price?: unknown }).price ?? "");
      if (id) localMap.set(id, price);
    }
  }

  // 逐个比对云端
  let cloudCount = 0;
  for (const cat of cloud) {
    if (!cat || typeof cat !== "object") continue;
    const items = (cat as { items?: unknown }).items;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const id = String((item as { id?: unknown }).id ?? "");
      const price = String((item as { price?: unknown }).price ?? "");
      if (!id) continue;
      cloudCount++;
      const localPrice = localMap.get(id);
      if (localPrice === undefined) return true; // 云端有本地没有的菜品
      if (localPrice !== price) return true; // 价格不同
    }
  }

  // 本地有云端没有的菜品
  return cloudCount !== localMap.size;
}
