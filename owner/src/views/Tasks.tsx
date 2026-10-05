import { useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck,
  CheckCircle2,
  RotateCcw,
  Trash2,
  ArrowRight,
  User,
  Repeat,
} from "lucide-react";
import { ChartCard, EmptyState, SkeletonRows } from "../components/ui";
import { toast } from "../components/Toast";
import { fmtMoney } from "../lib/format";
import { buildProblems } from "../lib/problems";
import { stocktakeDue } from "../lib/stocktakeReminder";
import { lateOrders, loadLateConfig } from "../lib/lateOrders";
import { useOpsSignals } from "../lib/useOpsSignals";
import {
  loadTasks,
  createTask,
  advanceTask,
  reopenTask,
  setAssignee,
  removeTask,
  setRoutine,
  processRoutines,
  STAGE_LABEL,
  STAGE_NEXT,
  ROUTINE_LABEL,
  type Task,
  type Routine,
} from "../lib/tasks";

const STAGE_CLS: Record<string, string> = {
  found: "bg-rose-500/15 text-rose-400",
  confirmed: "bg-orange-500/15 text-orange-400",
  analyzing: "bg-sky-500/15 text-sky-400",
  acting: "bg-violet-500/15 text-violet-400",
  executing: "bg-amber-500/15 text-amber-400",
  observing: "bg-teal-500/15 text-teal-400",
  resolved: "bg-green-500/15 text-green-400",
};

export default function Tasks({
  recentOrders,
  version = 0,
}: {
  recentOrders: any[];
  version?: number;
}) {
  const ops = useOpsSignals(version);
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());

  const late = useMemo(
    () => lateOrders(recentOrders, loadLateConfig(), Date.now()),
    [recentOrders],
  );
  const problems = useMemo(
    () =>
      buildProblems({
        priceAlerts: ops.alerts,
        low: ops.low,
        todayWaste: ops.todayWaste,
        late,
        stocktakeDue: stocktakeDue(),
      }),
    [ops, late],
  );

  useEffect(() => {
    setTasks(processRoutines());
  }, [version]);

  const cycleRoutine = (t: Task) => {
    const order: Routine[] = ["none", "daily", "weekly", "monthly"];
    const cur = t.routine || "none";
    const next = order[(order.indexOf(cur) + 1) % order.length];
    setTasks(setRoutine(t.id, next));
  };

  const open = tasks.filter((t) => t.stage !== "resolved");
  const resolved = tasks.filter((t) => t.stage === "resolved");

  const taskify = (p: (typeof problems)[number]) => {
    createTask(
      {
        id: p.id,
        kind: p.kind,
        title: p.title,
        desc: p.desc,
        impact: p.impact,
        evidence: p.evidence,
        suggestion: p.suggestion,
        tab: p.tab,
      },
      "",
    );
    setTasks(loadTasks());
    toast.success(`已任务化：${p.title}`);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <ChartCard
        title="问题池"
        subtitle={`${problems.length} 个待处理问题 · 点「任务化」进入执行`}
        action={<ClipboardCheck size={18} className="text-orange-500" />}
      >
        {!ops.ready ? (
          <SkeletonRows rows={3} />
        ) : problems.length === 0 ? (
          <EmptyState text="暂无问题，数据都正常" />
        ) : (
          <div className="space-y-2">
            {problems.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 bg-zinc-950 rounded-xl px-3.5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-zinc-100 truncate">
                    {p.title}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5 truncate">
                    {p.suggestion}
                  </div>
                </div>
                {p.impact > 0 && (
                  <span className="shrink-0 text-sm text-red-400 font-bold tnum">
                    {fmtMoney(p.impact)}
                  </span>
                )}
                <button
                  onClick={() => taskify(p)}
                  className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold btn-brand text-white active:scale-95 transition-transform"
                >
                  任务化
                </button>
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      <ChartCard
        title="进行中任务"
        subtitle={`${open.length} 个 · 发现→确认→分析→措施→执行→观察→解决`}
      >
        {open.length === 0 ? (
          <EmptyState
            text="暂无进行中的任务"
            hint="从上方问题池「任务化」一个开始"
          />
        ) : (
          <div className="space-y-2">
            {open.map((t) => (
              <div key={t.id} className="bg-zinc-950 rounded-xl px-3.5 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${STAGE_CLS[t.stage]}`}
                  >
                    {STAGE_LABEL[t.stage]}
                  </span>
                  {t.reopenedCount > 0 && (
                    <span className="text-[11px] text-zinc-500">
                      复发 {t.reopenedCount} 次
                    </span>
                  )}
                  {t.routine && t.routine !== "none" && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400">
                      <Repeat size={11} /> {ROUTINE_LABEL[t.routine]}
                    </span>
                  )}
                  <span className="flex-1 text-sm text-zinc-100 truncate">
                    {t.title}
                  </span>
                  {t.impact > 0 && (
                    <span className="text-sm text-red-400 font-bold tnum">
                      {fmtMoney(t.impact)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2.5">
                  <User size={13} className="text-zinc-500 shrink-0" />
                  <input
                    value={t.assignee}
                    onChange={(e) =>
                      setTasks(setAssignee(t.id, e.target.value))
                    }
                    placeholder="负责人（选填）"
                    className="flex-1 min-w-0 bg-zinc-900 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                  <button
                    onClick={() => cycleRoutine(t)}
                    title="设为例行（每天/每周/每月）"
                    className={`shrink-0 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold border ${
                      t.routine && t.routine !== "none"
                        ? "bg-sky-500/10 border-sky-500/40 text-sky-400"
                        : "bg-zinc-900 border-white/5 text-zinc-500"
                    }`}
                  >
                    <Repeat size={12} /> {ROUTINE_LABEL[t.routine || "none"]}
                  </button>
                  <button
                    onClick={() => setTasks(advanceTask(t.id))}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                  >
                    {STAGE_LABEL[STAGE_NEXT[t.stage] || t.stage]}{" "}
                    <ArrowRight size={13} />
                  </button>
                  <button
                    onClick={() => setTasks(removeTask(t.id))}
                    className="shrink-0 p-1.5 text-zinc-500 hover:text-red-400"
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      {resolved.length > 0 && (
        <ChartCard title="已解决" subtitle="观察后未复发即关闭">
          <div className="space-y-2">
            {resolved.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 bg-zinc-950 rounded-xl px-3.5 py-3"
              >
                <CheckCircle2 size={16} className="text-green-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-zinc-300 truncate">
                    {t.title}
                  </div>
                  {t.assignee && (
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      {t.assignee} · 复发 {t.reopenedCount} 次
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setTasks(reopenTask(t.id))}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400"
                >
                  <RotateCcw size={13} /> 复发重开
                </button>
                <button
                  onClick={() => setTasks(removeTask(t.id))}
                  className="shrink-0 p-1.5 text-zinc-500 hover:text-red-400"
                  title="删除"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}
