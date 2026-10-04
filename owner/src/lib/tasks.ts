import { localGet, localSet } from "./localdb";

/* ============ 任务中心（前端 only，不动数据库） ============
 * 问题 → 任务化 → 生命周期流转（发现→确认→分析→措施→执行→观察→解决），
 * 老板确认/完成/复发重开；任务与负责人暂存本机 localStorage。
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
  return t;
}

export function advanceTask(id: string): Task[] {
  const list = read().map((t) => {
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
  return list;
}

/** 复发重开：已解决的问题回退到「发现」，并累计复发次数 */
export function reopenTask(id: string): Task[] {
  const list = read().map((t) =>
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
  return list;
}

export function setAssignee(id: string, name: string): Task[] {
  const list = read().map((t) => (t.id === id ? { ...t, assignee: name } : t));
  persist(list);
  return list;
}

export function removeTask(id: string): Task[] {
  const list = read().filter((t) => t.id !== id);
  persist(list);
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
  return list;
}

/** 处理到期例行任务：已解决且到期 → 自动新建「发现」实例 */
export function processRoutines(now = Date.now()): Task[] {
  const list = read();
  const additions: Task[] = [];
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
      return { ...t, nextDueAt: now + ROUTINE_MS[t.routine] };
    }
    return t;
  });
  if (additions.length) persist([...next, ...additions]);
  return additions.length ? [...next, ...additions] : next;
}
