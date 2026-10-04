/* ============ 本地数据备份（前端 only，不动数据库） ============
 * 把暂存本机的业务数据导出为 JSON 备份、可再导入还原。
 * （云端数据在 Supabase，本文件只覆盖「本机暂存」的部分）
 */

export const LOCAL_KEYS = [
  "owner:item:meta",
  "owner:order:tag",
  "owner:tasks",
  "owner:quota:day",
  "owner:late:cfg",
  "owner:receipt:link",
  "owner:last-stocktake",
  "owner:snap:inventory",
  "owner:snap:settings",
];

export function exportLocalData(): string {
  const data: Record<string, string> = {};
  for (const k of LOCAL_KEYS) {
    try {
      const v = localStorage.getItem(k);
      if (v !== null) data[k] = v;
    } catch {
      /* ignore */
    }
  }
  return JSON.stringify(
    {
      app: "shuangwei-owner",
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
        localStorage.setItem(k, String(v));
        ok += 1;
      } catch {
        /* ignore */
      }
    }
  }
  return ok;
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
