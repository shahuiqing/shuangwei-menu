import { localGet, localSet } from "./localdb";
import { logAction } from "./auditLog";
import { supabase, isConfigured } from "./supabase";

/* ============ 任务中心（本机缓存 + 云端同步） ============
 * 问题 → 任务化 → 生命周期流转（发现→确认→分析→措施→执行→观察→解决），
 * 老板确认/完成/复发重开。
 * 读走本机 localStorage（同步、离线可用），写同时异步同步到 owner_tasks，
 * 打开任务页/老板端时用 syncTasks() 拉取云端并合并，跨设备不再丢任务。
 */

export const ISSUE_STAGES = [
  "found",
  "confirmed",
  "analyzing",
  "acting",
  "executing",
  "observing",
  "resolved",
] as const;
export type IssueStage = (typeof ISSUE_STAGES)[number];

export const STAGE_LABEL: Record<IssueStage, string> = {
  found: "发现",
  confirmed: "已确认",
  analyzing: "分析中",
  acting: "定措施",
  executing: "执行中",
  observing: "观察中",
  resolved: "已解决",
};

export const STAGE_NEXT: Record<IssueStage, IssueStage | null> = {
  found: "confirmed",
  confirmed: "analyzing",
  analyzing: "acting",
  acting: "executing",
  executing: "observing",
  observing: "resolved",
  resolved: null,
};

export type Routine = "none" | "daily" | "weekly" | "monthly";

export const ROUTINE_LABEL: Record<Routine, string> = {
  none: "不重复",
  daily: "每天",
  weekly: "每周",
  monthly: "每月",
};

const ROUTINE_MS: Record<Exclude<Routine, "none">, number> = {
  daily: 86400000,
  weekly: 7 * 86400000,
  monthly: 30 * 86400000,
};

export interface Task {
  id: string;
  kind: string;
  title: string;
  desc: string;
  impact: number;
  evidence: { label: string; value: string }[];
  suggestion: string;
  assignee: string;
  stage: IssueStage;
  createdAt: number;
  resolvedAt?: number;
  reopenedCount: number;
  tab: string;
  routine?: Routine;
  nextDueAt?: number;
}

const KEY = "owner:tasks";
const TABLE = "owner_tasks";

/** 本机任务 → 云端行 */
export function taskToRow(t: Task) {
  return {
    id: t.id,
    kind: t.kind || "",
    title: t.title || "",
    desc_text: t.desc || "",
    impact: Number(t.impact) || 0,
    evidence: t.evidence || [],
    suggestion: t.suggestion || "",
    assignee: t.assignee || "",
    stage: t.stage,
    created_at_ms: t.createdAt,
    resolved_at_ms: t.resolvedAt ?? null,
    reopened_count: t.reopenedCount || 0,
    tab: t.tab || "",
    routine: t.routine || "none",
    next_due_at_ms: t.nextDueAt ?? null,
    updated_at: new Date().toISOString(),
  };
}

/** 云端行 → 本机任务 */
export function taskFromRow(r: any): Task {
  return {
    id: String(r.id),
    kind: String(r.kind || ""),
    title: String(r.title || ""),
    desc: String(r.desc_text || ""),
    impact: Number(r.impact) || 0,
    evidence: Array.isArray(r.evidence) ? r.evidence : [],
    suggestion: String(r.suggestion || ""),
    assignee: String(r.assignee || ""),
    stage: (r.stage || "found") as IssueStage,
    createdAt: Number(r.created_at_ms) || 0,
    resolvedAt: r.resolved_at_ms ? Number(r.resolved_at_ms) : undefined,
    reopenedCount: Number(r.reopened_count) || 0,
    tab: String(r.tab || ""),
    routine: (r.routine || "none") as Routine,
    nextDueAt: r.next_due_at_ms ? Number(r.next_due_at_ms) : undefined,
  };
}

/** 写入/更新单条任务（异步，不阻塞 UI） */
export async function pushTask(t: Task): Promise<boolean> {
  if (!supabase || !isConfigured) return false;
  try {
    const { error } = await supabase.from(TABLE).upsert(taskToRow(t));
    return !error;
  } catch {
    return false;
  }
}

async function removeTaskRow(id: string): Promise<void> {
  if (!supabase || !isConfigured) return;
  try {
    await supabase.from(TABLE).delete().eq("id", id);
  } catch {
    /* 离线时忽略，下次同步不覆盖云端删除 */
  }
}

/**
 * 云端 → 本机合并：
 * - 云端已有的按云端为准（另一台设备可能更新过）
 * - 本机独有的任务上传到云端（首次迁移旧数据）
 * 返回合并后的列表；云端不可用时返回 null（调用方继续用本机数据）。
 */
export async function syncTasks(): Promise<Task[] | null> {
  if (!supabase || !isConfigured) return null;
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at_ms", { ascending: false })
      .limit(1000);
    if (error) return null;
    const dbList = (data || []).map(taskFromRow);
    const dbIds = new Set(dbList.map((t) => t.id));
    const localOnly = read().filter((t) => !dbIds.has(t.id));
    const merged = [...dbList, ...localOnly].sort(
      (a, b) => b.createdAt - a.createdAt,
    );
    persist(merged);
    if (localOnly.length > 0)
      await supabase.from(TABLE).upsert(localOnly.map(taskToRow));
    return merged;
  } catch {
    return null;
  }
}

function read(): Task[] {
  const o = localGet<unknown>(KEY);
  return Array.isArray(o) ? (o as Task[]) : [];
}

function persist(list: Task[]) {
  localSet(KEY, list);
}

export function loadTasks(): Task[] {
  return read().sort((a, b) => b.createdAt - a.createdAt);
}

export function createTask(
  p: {
    id: string;
    kind: string;
    title: string;
    desc: string;
    impact: number;
    evidence: { label: string; value: string }[];
    suggestion: string;
    tab: string;
  },
  assignee = "",
): Task {
  const t: Task = {
    ...p,
    id: `${p.id}-${Date.now()}`,
    assignee,
    stage: "found",
    createdAt: Date.now(),
    reopenedCount: 0,
  };
  persist([t, ...read()]);
  void pushTask(t);
  return t;
}

export function advanceTask(id: string): Task[] {
  const prev = read();
  const list = prev.map((t) => {
    if (t.id !== id) return t;
    const next = STAGE_NEXT[t.stage];
    if (!next) return t;
    return {
      ...t,
      stage: next,
      resolvedAt: next === "resolved" ? Date.now() : t.resolvedAt,
    };
  });
  persist(list);
  const a = prev.find((t) => t.id === id);
  const b = list.find((t) => t.id === id);
  if (a && b && a.stage !== b.stage) {
    void pushTask(b);
    logAction(
      "任务推进",
      `${b.title}：${STAGE_LABEL[a.stage]} → ${STAGE_LABEL[b.stage]}`,
    );
  }
  return list;
}

/** 复发重开：已解决的问题回退到「发现」，并累计复发次数 */
export function reopenTask(id: string): Task[] {
  const prev = read();
  const list = prev.map((t) =>
    t.id === id
      ? {
          ...t,
          stage: "found" as IssueStage,
          resolvedAt: undefined,
          reopenedCount: t.reopenedCount + 1,
        }
      : t,
  );
  persist(list);
  const t = list.find((x) => x.id === id);
  if (t) {
    void pushTask(t);
    logAction("任务复发", t.title);
  }
  return list;
}

export function setAssignee(id: string, name: string): Task[] {
  const list = read().map((t) => (t.id === id ? { ...t, assignee: name } : t));
  persist(list);
  const t = list.find((x) => x.id === id);
  if (t) void pushTask(t);
  return list;
}

export function removeTask(id: string): Task[] {
  const list = read().filter((t) => t.id !== id);
  persist(list);
  void removeTaskRow(id);
  return list;
}

/** 设为例行（每天/每周/每月），已解决后按周期自动重开 */
export function setRoutine(id: string, routine: Routine): Task[] {
  const list = read().map((t) =>
    t.id === id
      ? {
          ...t,
          routine,
          nextDueAt:
            routine === "none" ? undefined : Date.now() + ROUTINE_MS[routine],
        }
      : t,
  );
  persist(list);
  const t = list.find((x) => x.id === id);
  if (t) void pushTask(t);
  return list;
}

/** 处理到期例行任务：已解决且到期 → 自动新建「发现」实例 */
export function processRoutines(now = Date.now()): Task[] {
  const list = read();
  const additions: Task[] = [];
  const touched: Task[] = [];
  const next = list.map((t) => {
    if (
      t.routine &&
      t.routine !== "none" &&
      t.stage === "resolved" &&
      t.nextDueAt &&
      t.nextDueAt <= now
    ) {
      additions.push({
        ...t,
        id: `${t.id}-${now}`,
        stage: "found",
        resolvedAt: undefined,
        createdAt: now,
        nextDueAt: now + ROUTINE_MS[t.routine],
      });
      const upd = { ...t, nextDueAt: now + ROUTINE_MS[t.routine] };
      touched.push(upd);
      return upd;
    }
    return t;
  });
  if (additions.length) {
    persist([...next, ...additions]);
    for (const x of [...touched, ...additions]) void pushTask(x);
  }
  return additions.length ? [...next, ...additions] : next;
}
