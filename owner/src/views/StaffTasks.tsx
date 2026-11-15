import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Send,
  RefreshCw,
  Plus,
  Trash2,
  Check,
  X,
  Clock,
  AlertTriangle,
  Layers,
} from "lucide-react";
import { ChartCard, EmptyState } from "../components/ui";
import { toast } from "../components/Toast";
import {
  fetchTaskTemplates,
  upsertTaskTemplate,
  deleteTaskTemplate,
  fetchStaffMembers,
  dispatchTasks,
  fetchStaffTasks,
  reviewStaffTask,
  cancelStaffTask,
  ROLES,
  ROLE_LABEL,
  TASK_STATUS_LABEL,
  isOverdue,
  type Role,
  type TaskTemplate,
  type StaffTask,
  type ChecklistItem,
} from "../lib/staffOps";

const STATUS_CLS: Record<string, string> = {
  pending: "bg-zinc-500/15 text-zinc-300",
  submitted: "bg-amber-500/15 text-amber-400",
  approved: "bg-green-500/15 text-green-400",
  rejected: "bg-rose-500/15 text-rose-400",
  cancelled: "bg-zinc-700/40 text-zinc-500",
};

const PRIORITY_CLS: Record<string, string> = {
  high: "bg-rose-500/15 text-rose-400",
  normal: "bg-sky-500/15 text-sky-400",
  low: "bg-zinc-500/15 text-zinc-400",
};

/** 常用任务预设（需求文档示例），一键导入 */
const TEMPLATE_PRESETS: Omit<TaskTemplate, "id">[] = [
  {
    name: "餐前摆台",
    task_type: "daily",
    roles: ["waiter"],
    checklist: [
      { text: "桌面擦拭" },
      { text: "餐具摆放" },
      { text: "椅子归位" },
    ],
    require_photo: true,
    due_hours: 2,
    description: "营业前完成，拍照提交",
  },
  {
    name: "闭店检查",
    task_type: "daily",
    roles: ["waiter"],
    checklist: [{ text: "收台" }, { text: "关水电气" }, { text: "垃圾清运" }],
    require_photo: true,
    due_hours: 10,
    description: "",
  },
  {
    name: "备菜",
    task_type: "daily",
    roles: ["helper"],
    checklist: [{ text: "按单备菜" }, { text: "效期检查" }],
    require_photo: false,
    due_hours: 4,
    description: "",
  },
  {
    name: "食材效期检查",
    task_type: "daily",
    roles: ["helper"],
    checklist: [{ text: "冷藏" }, { text: "冷冻" }, { text: "干货" }],
    require_photo: true,
    due_hours: 6,
    description: "临期食材拍照记录",
  },
  {
    name: "卫生间清洁",
    task_type: "daily",
    roles: ["cleaner"],
    checklist: [{ text: "便池" }, { text: "台面" }, { text: "地面" }],
    require_photo: true,
    due_hours: 3,
    description: "",
  },
];

export default function StaffTasks({ version = 0 }: { version?: number }) {
  const [tab, setTab] = useState<"dispatch" | "board">("dispatch");
  const [staff, setStaff] = useState<
    Awaited<ReturnType<typeof fetchStaffMembers>>
  >([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [loading, setLoading] = useState(true);

  // 派发表单
  const [tplId, setTplId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [requirePhoto, setRequirePhoto] = useState(false);
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [dueHours, setDueHours] = useState(8);
  const [pickedRoles, setPickedRoles] = useState<Role[]>([]);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [dispatching, setDispatching] = useState(false);

  // 看板
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const [s, t, k] = await Promise.all([
      fetchStaffMembers(),
      fetchTaskTemplates(),
      fetchStaffTasks(),
    ]);
    setStaff(s);
    setTemplates(t);
    setTasks(k);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [version]);

  const loadTpl = (id: string) => {
    setTplId(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      setTitle(t.name);
      setDescription(t.description || "");
      setChecklist(t.checklist.map((c) => ({ text: c.text, done: false })));
      setRequirePhoto(t.require_photo);
      setPickedRoles(t.roles);
      setDueHours(t.due_hours);
    }
  };

  /** 按岗位派发的预计人数 */
  const estimated = useMemo(() => {
    if (pickedIds.length > 0) return pickedIds.length;
    const active = staff.filter((s) => s.status === "active");
    return active.filter((s) => s.roles.some((r) => pickedRoles.includes(r)))
      .length;
  }, [staff, pickedRoles, pickedIds]);

  const dispatch = async () => {
    if (!title.trim()) return toast.error("请填写任务名称");
    if (pickedIds.length === 0 && pickedRoles.length === 0)
      return toast.error("请选择岗位或指定员工");
    setDispatching(true);
    const n = await dispatchTasks({
      title,
      description,
      checklist,
      require_photo: requirePhoto,
      priority,
      roles: pickedIds.length > 0 ? undefined : pickedRoles,
      assigneeIds: pickedIds.length > 0 ? pickedIds : undefined,
      due_hours: dueHours,
      template_id: tplId || undefined,
    });
    setDispatching(false);
    if (n > 0) {
      toast.success(`已派发给 ${n} 名员工（责任到人）`);
      setTitle("");
      setDescription("");
      setChecklist([]);
      setTplId("");
      load();
    } else toast.error("派发失败：无匹配的在职员工或数据库错误");
  };

  const review = async (t: StaffTask, approve: boolean) => {
    let note = "";
    if (!approve) {
      note = prompt("驳回原因（会显示给员工）") || "";
      if (!note) return toast.error("驳回必须填写原因");
    }
    if (await reviewStaffTask(t.id, approve, note)) {
      toast.success(approve ? "已验收通过" : "已驳回，员工可重新提交");
      load();
    } else toast.error("操作失败");
  };

  const shown = useMemo(() => {
    if (filter === "all") return tasks;
    if (filter === "overdue")
      return tasks.filter((t) => t.status === "pending" && isOverdue(t.due_at));
    return tasks.filter((t) => t.status === filter);
  }, [tasks, filter]);

  const pendingReview = tasks.filter((t) => t.status === "submitted").length;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-center flex-wrap gap-2">
        {(
          [
            { id: "dispatch", label: "派发任务", icon: Send },
            {
              id: "board",
              label: `看板与验收${pendingReview ? ` (${pendingReview})` : ""}`,
              icon: Layers,
            },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl ${
              tab === t.id
                ? "bg-orange-600 text-white"
                : "bg-zinc-900 text-zinc-400 border border-white/5 hover:text-zinc-200"
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
        <button
          onClick={load}
          className="ml-auto flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 bg-zinc-900 border border-white/5 rounded-xl hover:bg-zinc-800"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> 刷新
        </button>
      </div>

      {tab === "dispatch" && (
        <>
          {/* 模板管理 */}
          <ChartCard
            title="任务模板"
            subtitle="点模板自动填入下方派发表单"
            action={<ClipboardList size={18} className="text-orange-500" />}
          >
            {templates.length === 0 ? (
              <div className="space-y-3">
                <EmptyState text="暂无模板，可用下方预设一键导入" />
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      onClick={async () => {
                        if (await upsertTaskTemplate(p)) {
                          toast.success(`已导入模板「${p.name}」`);
                          load();
                        } else toast.error("导入失败");
                      }}
                      className="px-3 py-1.5 text-xs rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                    >
                      + {p.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 bg-zinc-950 rounded-xl px-3.5 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-zinc-100 truncate">
                        {t.name}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        {t.roles.map((r) => ROLE_LABEL[r]).join("/")} ·{" "}
                        {t.due_hours}h 内完成
                        {t.require_photo ? " · 需拍照" : ""}
                        {t.checklist.length > 0
                          ? ` · ${t.checklist.length} 项检查`
                          : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => loadTpl(t.id)}
                      className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-600 text-white"
                    >
                      派发
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`删除模板「${t.name}」？`)) return;
                        if (await deleteTaskTemplate(t.id)) load();
                        else toast.error("删除失败");
                      }}
                      className="shrink-0 p-1.5 text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>

          {/* 派发表单 */}
          <ChartCard
            title="新建派发"
            subtitle="按岗位派给全部该岗位在职员工，或指定到个人"
          >
            <div className="space-y-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="任务名称，如：餐前摆台"
                className="w-full bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="任务说明（选填）"
                rows={2}
                className="w-full bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              />

              {/* 检查项 */}
              <div className="space-y-1.5">
                <div className="text-xs text-zinc-500">
                  检查项（员工逐项打勾）
                </div>
                {checklist.map((c, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={c.text}
                      onChange={(e) =>
                        setChecklist((prev) =>
                          prev.map((x, j) =>
                            j === i ? { ...x, text: e.target.value } : x,
                          ),
                        )
                      }
                      placeholder={`检查项 ${i + 1}`}
                      className="flex-1 bg-zinc-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                    />
                    <button
                      onClick={() =>
                        setChecklist((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="px-2 text-zinc-500 hover:text-red-400"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    setChecklist((prev) => [...prev, { text: "" }])
                  }
                  className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
                >
                  <Plus size={13} /> 添加检查项
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="bg-zinc-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white"
                >
                  <option value="low">低优先</option>
                  <option value="normal">普通</option>
                  <option value="high">高优先</option>
                </select>
                <div className="flex items-center gap-1 bg-zinc-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white">
                  <Clock size={14} className="text-zinc-500" />
                  <input
                    type="number"
                    min={1}
                    value={dueHours}
                    onChange={(e) => setDueHours(Number(e.target.value) || 8)}
                    className="w-12 bg-transparent text-sm focus:outline-none"
                  />
                  小时内完成
                </div>
                <button
                  onClick={() => setRequirePhoto(!requirePhoto)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold ${
                    requirePhoto
                      ? "bg-sky-500/15 text-sky-400"
                      : "bg-zinc-950 border border-white/5 text-zinc-500"
                  }`}
                >
                  {requirePhoto ? "✓" : ""} 需拍照提交
                </button>
              </div>

              {/* 指派对象 */}
              <div className="space-y-2">
                <div className="text-xs text-zinc-500">
                  指派给（岗位 = 全部该岗位在职员工；也可直接勾选个人）
                </div>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      onClick={() =>
                        setPickedRoles((prev) =>
                          prev.includes(r)
                            ? prev.filter((x) => x !== r)
                            : [...prev, r],
                        )
                      }
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                        pickedRoles.includes(r)
                          ? "bg-sky-500/15 text-sky-400 border-transparent"
                          : "bg-zinc-950 border-white/5 text-zinc-500"
                      }`}
                    >
                      {ROLE_LABEL[r]}
                    </button>
                  ))}
                  <span className="h-5 w-px bg-white/10 self-center" />
                  {staff
                    .filter((s) => s.status === "active")
                    .map((s) => (
                      <button
                        key={s.id}
                        onClick={() =>
                          setPickedIds((prev) =>
                            prev.includes(s.id)
                              ? prev.filter((x) => x !== s.id)
                              : [...prev, s.id],
                          )
                        }
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                          pickedIds.includes(s.id)
                            ? "bg-orange-600 text-white border-transparent"
                            : "bg-zinc-950 border-white/5 text-zinc-500"
                        }`}
                      >
                        {s.name}
                      </button>
                    ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={dispatch}
                  disabled={dispatching}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-500 rounded-xl disabled:opacity-50"
                >
                  <Send size={15} />
                  {dispatching ? "派发中…" : `派发（${estimated} 人）`}
                </button>
                <span className="text-xs text-zinc-500">
                  每名员工一条任务，互相独立提交，责任到人
                </span>
              </div>
            </div>
          </ChartCard>
        </>
      )}

      {tab === "board" && (
        <ChartCard
          title="任务看板"
          subtitle="员工提交后在这里验收；驳回会退回员工重做"
        >
          <div className="flex flex-wrap gap-2 mb-3">
            {[
              { id: "all", label: "全部" },
              { id: "pending", label: "待完成" },
              { id: "submitted", label: "待验收" },
              { id: "approved", label: "已通过" },
              { id: "rejected", label: "已驳回" },
              { id: "overdue", label: "已逾期" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  filter === f.id
                    ? "bg-orange-600 text-white border-transparent"
                    : "bg-zinc-950 border-white/5 text-zinc-500"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <EmptyState text="暂无任务" />
          ) : (
            <div className="space-y-2">
              {shown.map((t) => {
                const done = t.checklist.filter((c) => c.done).length;
                const overdue = t.status === "pending" && isOverdue(t.due_at);
                return (
                  <div
                    key={t.id}
                    className={`bg-zinc-950 rounded-xl px-3.5 py-3 space-y-2 ${
                      overdue ? "border border-rose-500/30" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${STATUS_CLS[t.status]}`}
                      >
                        {TASK_STATUS_LABEL[t.status]}
                      </span>
                      {t.priority === "high" && (
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${PRIORITY_CLS.high}`}
                        >
                          高优先
                        </span>
                      )}
                      {overdue && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-bold">
                          <AlertTriangle size={11} /> 逾期
                        </span>
                      )}
                      <span className="text-sm text-zinc-100 font-semibold">
                        {t.title}
                      </span>
                      <span className="text-xs text-zinc-400">
                        → {t.assignee_name || "未指派"}
                      </span>
                      <span className="ml-auto text-[11px] text-zinc-500">
                        截止{" "}
                        {t.due_at
                          ? new Date(t.due_at).toLocaleString("zh-CN", {
                              hour12: false,
                            })
                          : "—"}
                      </span>
                    </div>

                    {(t.description || t.checklist.length > 0) && (
                      <div className="text-xs text-zinc-500">
                        {t.description && <div>{t.description}</div>}
                        {t.checklist.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {t.checklist.map((c, i) => (
                              <span
                                key={i}
                                className={`px-2 py-0.5 rounded-full ${
                                  c.done
                                    ? "bg-green-500/15 text-green-400"
                                    : "bg-zinc-800 text-zinc-400"
                                }`}
                              >
                                {c.done ? "✓" : "○"} {c.text}
                              </span>
                            ))}
                            <span className="text-zinc-600">
                              {done}/{t.checklist.length}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {(t.note || t.photos.length > 0) && (
                      <div className="text-xs text-zinc-400 bg-zinc-900 rounded-xl px-3 py-2">
                        {t.note && <div>📝 {t.note}</div>}
                        {t.photos.length > 0 && (
                          <div className="flex gap-2 mt-1.5 flex-wrap">
                            {t.photos.map((p, i) => (
                              <a
                                key={i}
                                href={p}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <img
                                  src={p}
                                  alt={`照片${i + 1}`}
                                  className="w-14 h-14 object-cover rounded-lg border border-white/10"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                        {t.submitted_at && (
                          <div className="text-[11px] text-zinc-600 mt-1">
                            提交于{" "}
                            {new Date(t.submitted_at).toLocaleString("zh-CN", {
                              hour12: false,
                            })}
                            {t.resubmit_count > 0
                              ? ` · 重提 ${t.resubmit_count} 次`
                              : ""}
                          </div>
                        )}
                      </div>
                    )}

                    {t.review_note && (
                      <div className="text-xs text-zinc-500">
                        老板意见：{t.review_note}
                      </div>
                    )}

                    <div className="flex gap-2">
                      {t.status === "submitted" && (
                        <>
                          <button
                            onClick={() => review(t, true)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-500"
                          >
                            <Check size={13} /> 验收通过
                          </button>
                          <button
                            onClick={() => review(t, false)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/15 text-rose-400"
                          >
                            <X size={13} /> 驳回
                          </button>
                        </>
                      )}
                      {t.status === "pending" && (
                        <button
                          onClick={async () => {
                            if (!confirm("取消该任务？")) return;
                            if (await cancelStaffTask(t.id)) load();
                          }}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 text-zinc-400"
                        >
                          取消任务
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>
      )}
    </div>
  );
}
