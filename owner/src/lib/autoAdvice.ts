import { todayKey } from "./businessDay";
import { loadBusinessSnapshot } from "./aiContext";
import { buildAdvice, AREA_LABEL, type AdviceItem } from "./advisor";
import { dispatchTasks, ROLE_LABEL, type Role } from "./staffOps";
import { localGet, localSet } from "./localdb";

/**
 * AI 每日自动经营建议：
 * 老板每天第一次打开系统时自动生成全店建议；
 * 其中高优先级（紧急缺货 / 损耗偏高）在开关打开时自动派给对应岗位员工。
 * 运行记录存本机，助手页可回看。
 */

export const AUTO_ADVICE_KEY = "owner:auto-advice";
export const AUTO_ADVICE_DAY_KEY = "owner:auto-advice-day";
export const AUTO_ADVICE_CFG_KEY = "owner:auto-advice-cfg";

/** area → 自动派发岗位（保守：只派库存与损耗，派给帮厨） */
export const AUTO_AREA_ROLES: Partial<Record<AdviceItem["area"], Role[]>> = {
  inventory: ["helper"],
  waste: ["helper"],
};

/** 自动派发阈值：priority ≤ 2（缺货紧急 / 临期 / 损耗偏高） */
export const AUTO_PRIORITY_MAX = 2;

export interface AutoAdviceConfig {
  enabled: boolean;
}

export const DEFAULT_AUTO_ADVICE_CFG: AutoAdviceConfig = { enabled: true };

export function loadAutoAdviceCfg(): AutoAdviceConfig {
  const o = localGet<Partial<AutoAdviceConfig>>(AUTO_ADVICE_CFG_KEY);
  if (!o || typeof o !== "object") return { ...DEFAULT_AUTO_ADVICE_CFG };
  return { enabled: o.enabled !== false };
}

export function saveAutoAdviceCfg(cfg: AutoAdviceConfig): AutoAdviceConfig {
  const next = { enabled: cfg.enabled !== false };
  localSet(AUTO_ADVICE_CFG_KEY, next);
  return next;
}

export interface AutoDispatchedItem {
  title: string;
  area: string;
  roles: string[];
  count: number;
}

export interface AutoAdviceRecord {
  day: string;
  at: string;
  /** 是否处于开启状态（关闭时也会生成记录，便于助手页回看） */
  enabled: boolean;
  /** 当天生成的建议总条数 */
  considered: number;
  dispatched: AutoDispatchedItem[];
}

export function loadAutoAdvice(): AutoAdviceRecord | null {
  const r = localGet<AutoAdviceRecord>(AUTO_ADVICE_KEY);
  if (!r || typeof r !== "object" || typeof r.day !== "string") return null;
  return r;
}

function saveAutoAdvice(rec: AutoAdviceRecord): void {
  localSet(AUTO_ADVICE_KEY, rec);
}

export function autoAdviceDoneToday(day = todayKey()): boolean {
  return localGet<string>(AUTO_ADVICE_DAY_KEY) === day;
}

export function markAutoAdviceDay(day = todayKey()): void {
  localSet(AUTO_ADVICE_DAY_KEY, day);
}

/** 纯函数：筛出可自动派发的建议（范围 + 优先级阈值） */
export function planAutoDispatches(items: AdviceItem[]): {
  item: AdviceItem;
  roles: Role[];
}[] {
  return items
    .filter((it) => {
      const roles = AUTO_AREA_ROLES[it.area];
      return roles && it.priority <= AUTO_PRIORITY_MAX;
    })
    .map((it) => ({
      item: it,
      roles: AUTO_AREA_ROLES[it.area] as Role[],
    }));
}

/** 执行一次（默认每天一次；force = 手动重跑） */
export async function runAutoAdvice(
  opts: { force?: boolean } = {},
): Promise<AutoAdviceRecord | null> {
  if (!opts.force && autoAdviceDoneToday()) return loadAutoAdvice();
  const cfg = loadAutoAdviceCfg();
  const day = todayKey();

  const snapshot = await loadBusinessSnapshot();
  const advice = buildAdvice(snapshot);
  const plan = cfg.enabled ? planAutoDispatches(advice) : [];

  const dispatched: AutoDispatchedItem[] = [];
  for (const { item, roles } of plan) {
    const n = await dispatchTasks({
      title: `每日自动 · ${item.title}`,
      description: [item.finding, ...item.actions.map((a) => `· ${a}`)].join(
        "\n",
      ),
      checklist: item.actions.map((text) => ({ text })),
      due_hours: 24,
      roles,
    });
    if (n > 0) {
      dispatched.push({
        title: item.title,
        area: AREA_LABEL[item.area],
        roles: roles.map((r) => ROLE_LABEL[r]),
        count: n,
      });
    }
  }

  const rec: AutoAdviceRecord = {
    day,
    at: new Date().toISOString(),
    enabled: cfg.enabled,
    considered: advice.length,
    dispatched,
  };
  saveAutoAdvice(rec);
  markAutoAdviceDay(day);
  return rec;
}
