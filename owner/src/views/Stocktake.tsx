import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  RefreshCw,
  Wand2,
  Plus,
  X,
  Check,
  History,
  User as UserIcon,
  Save,
} from "lucide-react";
import { ChartCard, EmptyState } from "../components/ui";
import { toast } from "../components/Toast";
import { fetchInventory, type InventoryItem } from "../lib/inventory";
import {
  fetchStocktakeRule,
  saveStocktakeRule,
  fetchStocktakeTasks,
  createStocktakeTasks,
  assignStocktakeTask,
  cancelStocktakeTask,
  reviewStocktakeTask,
  pickDailyStocktakeItems,
  stocktakeDiff,
  type StocktakeRule,
  type StocktakeTask,
} from "../lib/staffOps";

const STK_CLS: Record<string, string> = {
  pending: "bg-zinc-500/15 text-zinc-300",
  drafted: "bg-sky-500/15 text-sky-400",
  submitted: "bg-amber-500/15 text-amber-400",
  rejected: "bg-rose-500/15 text-rose-400",
  calibrated: "bg-green-500/15 text-green-400",
  cancelled: "bg-zinc-700/40 text-zinc-500",
};
const STK_LABEL: Record<string, string> = {
  pending: "待盘点",
  drafted: "已暂存",
  submitted: "待审核",
  rejected: "退回复核",
  calibrated: "已校准",
  cancelled: "已取消",
};

const todayStr = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD（本地时区）

export default function Stocktake() {
  const [rule, setRule] = useState<StocktakeRule | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [tasks, setTasks] = useState<StocktakeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRule, setSavingRule] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [historyDate, setHistoryDate] = useState(todayStr());
  const [history, setHistory] = useState<StocktakeTask[] | null>(null);
  const [adHocItemId, setAdHocItemId] = useState("");

  const today = todayStr();
  const todayTasks = useMemo(
    () => tasks.filter((t) => t.count_date === today),
    [tasks, today],
  );

  const load = async () => {
    setLoading(true);
    const [r, inv, t] = await Promise.all([
      fetchStocktakeRule(),
      fetchInventory(),
      fetchStocktakeTasks(),
    ]);
    setRule(r);
    setItems(inv);
    setTasks(t);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const saveRule = async () => {
    if (!rule) return;
    setSavingRule(true);
    const ok = await saveStocktakeRule(rule);
    setSavingRule(false);
    ok ? toast.success("盘点规则已保存") : toast.error("保存失败");
  };

  /** 生成今日清单：按规则抽盘，默认不指派人（老板再逐条指派） */
  const generate = async () => {
    if (!rule) return;
    setGenerating(true);
    const picked = pickDailyStocktakeItems(
      items.map((it) => ({
        id: it.id,
        name: it.name,
        zone: it.zone || "",
        lastCountedAt: it.last_counted_at || null,
      })),
      rule,
      today,
      todayTasks.map((t) => t.item_id),
    );
    if (picked.length === 0) {
      setGenerating(false);
      return toast.error("没有可盘的物品（已全部生成过或库存为空）");
    }
    const full = picked
      .map((p) => items.find((it) => it.id === p.id)!)
      .filter(Boolean);
    const n = await createStocktakeTasks(today, full, null);
    setGenerating(false);
    if (n > 0) {
      toast.success(`已生成 ${n} 条今日盘点任务，请逐条指派到人`);
      load();
    } else toast.error("生成失败");
  };

  /** 手动加一条 */
  const addAdHoc = async () => {
    const it = items.find((x) => x.id === adHocItemId);
    if (!it) return toast.error("请选择要增加盘点的物品");
    const n = await createStocktakeTasks(today, [it], null);
    n > 0
      ? toast.success(`已加入「${it.name}」`)
      : toast.error("该物品今天已有盘点任务");
    setAdHocItemId("");
    load();
  };

  const assign = async (t: StocktakeTask, staffId: string) => {
    const member = staffList.find((s) => s.id === staffId);
    if (
      await assignStocktakeTask(
        t.id,
        member ? { id: member.id, name: member.name } : null,
      )
    )
      load();
  };

  // 员工名单（指派用）
  const [staffList, setStaffList] = useState<{ id: string; name: string }[]>(
    [],
  );
  useEffect(() => {
    (async () => {
      const { fetchStaffMembers } = await import("../lib/staffOps");
      const s = await fetchStaffMembers();
      setStaffList(s.filter((x) => x.status === "active"));
    })();
  }, []);

  const review = async (t: StocktakeTask, approve: boolean) => {
    let note = "";
    if (!approve) {
      note = prompt("驳回原因（会显示给员工，要求复核）") || "";
      if (!note) return toast.error("驳回必须填写原因");
    }
    const item = items.find((it) => it.id === t.item_id);
    if (await reviewStocktakeTask(t, approve, item, note)) {
      toast.success(
        approve
          ? "已确认校准，库存已按实盘更新"
          : "已退回，员工可修改后重新提交",
      );
      load();
    } else toast.error("操作失败");
  };

  const loadHistory = async () => {
    const h = await fetchStocktakeTasks(historyDate);
    setHistory(h);
  };

  const unassigned = todayTasks.filter(
    (t) => !t.assigned_to && t.status === "pending",
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-center flex-wrap gap-3">
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 bg-zinc-900 border border-white/5 rounded-xl hover:bg-zinc-800"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> 刷新
        </button>
        <span className="text-xs text-zinc-500">
          今日 {todayTasks.filter((t) => t.status !== "cancelled").length} 条 ·
          未指派 {unassigned.length} 条 · 已校准{" "}
          {todayTasks.filter((t) => t.status === "calibrated").length} 条
        </span>
      </div>

      {/* 规则 */}
      {rule && (
        <ChartCard
          title="每日抽盘规则"
          subtitle="每天只盘一部分，长期未盘优先，责任到人"
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setRule({ ...rule, enabled: !rule.enabled })}
              className={`px-3 py-2 rounded-xl text-xs font-semibold ${
                rule.enabled
                  ? "bg-green-500/15 text-green-400"
                  : "bg-zinc-950 border border-white/5 text-zinc-500"
              }`}
            >
              {rule.enabled ? "✓ 规则启用" : "规则停用"}
            </button>
            <label className="flex items-center gap-1.5 bg-zinc-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white">
              每天盘
              <input
                type="number"
                min={1}
                value={rule.items_per_day}
                onChange={(e) =>
                  setRule({
                    ...rule,
                    items_per_day: Number(e.target.value) || 1,
                  })
                }
                className="w-12 bg-transparent text-sm focus:outline-none"
              />
              种物品
            </label>
            <select
              value={rule.strategy}
              onChange={(e) =>
                setRule({ ...rule, strategy: e.target.value as any })
              }
              className="bg-zinc-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white"
            >
              <option value="stale_first">久未盘优先</option>
              <option value="zone_rotate">按区域轮换</option>
              <option value="random">随机抽盘</option>
            </select>
            <label className="flex items-center gap-1.5 bg-zinc-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white">
              截止
              <input
                type="time"
                value={rule.due_time}
                onChange={(e) => setRule({ ...rule, due_time: e.target.value })}
                className="bg-transparent text-sm focus:outline-none"
              />
            </label>
            <button
              onClick={() =>
                setRule({ ...rule, require_photo: !rule.require_photo })
              }
              className={`px-3 py-2 rounded-xl text-xs font-semibold ${
                rule.require_photo
                  ? "bg-sky-500/15 text-sky-400"
                  : "bg-zinc-950 border border-white/5 text-zinc-500"
              }`}
            >
              {rule.require_photo ? "✓ 需拍照" : "需拍照"}
            </button>
            <button
              onClick={() =>
                setRule({ ...rule, show_book_qty: !rule.show_book_qty })
              }
              className={`px-3 py-2 rounded-xl text-xs font-semibold ${
                rule.show_book_qty
                  ? "bg-sky-500/15 text-sky-400"
                  : "bg-zinc-950 border border-white/5 text-zinc-500"
              }`}
            >
              {rule.show_book_qty ? "✓ 显示账面数" : "不显示账面数"}
            </button>
            <button
              onClick={saveRule}
              disabled={savingRule}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-500 rounded-xl disabled:opacity-50"
            >
              <Save size={14} /> {savingRule ? "保存中…" : "保存规则"}
            </button>
          </div>
          <div className="mt-2 text-[11px] text-zinc-600">
            「不显示账面数」=
            员工盘点时看不到系统账面数量，盲盘防照抄；默认不显示。
            区域在「库存管理」每个物品的区域字段维护。
          </div>
        </ChartCard>
      )}

      {/* 今日清单 */}
      <ChartCard
        title={`今日盘点清单（${today}）`}
        subtitle="每条任务必须指派具体员工才会在员工端出现"
        action={<Boxes size={18} className="text-orange-500" />}
      >
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-xl disabled:opacity-50"
          >
            <Wand2 size={15} /> {generating ? "生成中…" : "按规则生成今日清单"}
          </button>
          <div className="flex items-center gap-2">
            <select
              value={adHocItemId}
              onChange={(e) => setAdHocItemId(e.target.value)}
              className="bg-zinc-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white max-w-[220px]"
            >
              <option value="">手动加一条…</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name}（{it.unit}）
                </option>
              ))}
            </select>
            <button
              onClick={addAdHoc}
              className="flex items-center gap-1 px-3 py-2 text-sm text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-xl"
            >
              <Plus size={14} /> 加入
            </button>
          </div>
        </div>

        {todayTasks.length === 0 ? (
          <EmptyState text="今天还没有盘点任务，点上方按钮生成" />
        ) : (
          <div className="space-y-2">
            {todayTasks.map((t) => {
              const diff = stocktakeDiff(t.book_qty, t.actual_qty);
              return (
                <div
                  key={t.id}
                  className="bg-zinc-950 rounded-xl px-3.5 py-3 space-y-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${STK_CLS[t.status]}`}
                    >
                      {STK_LABEL[t.status]}
                    </span>
                    <span className="text-sm text-zinc-100 font-semibold">
                      {t.item_name}
                    </span>
                    <span className="text-xs text-zinc-500">{t.unit}</span>
                    {t.zone && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                        {t.zone}
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <UserIcon size={13} className="text-zinc-500" />
                      <select
                        value={t.assigned_to || ""}
                        onChange={(e) => assign(t, e.target.value)}
                        className="bg-zinc-900 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-white"
                      >
                        <option value="">未指派</option>
                        {staffList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    {t.book_qty !== null && (
                      <span className="text-zinc-500">
                        账面 {t.book_qty} {t.unit}
                      </span>
                    )}
                    {t.actual_qty !== null && (
                      <span
                        className={
                          diff === 0 ? "text-zinc-400" : "text-amber-400"
                        }
                      >
                        实盘 {t.actual_qty} {t.unit}
                        {diff !== null &&
                          diff !== 0 &&
                          ` · 差异 ${diff > 0 ? "+" : ""}${diff}`}
                      </span>
                    )}
                    {t.note && (
                      <span className="text-zinc-500">📝 {t.note}</span>
                    )}
                    {t.photos.length > 0 && (
                      <div className="flex gap-1.5">
                        {t.photos.map((p, i) => (
                          <a key={i} href={p} target="_blank" rel="noreferrer">
                            <img
                              src={p}
                              alt=""
                              className="w-10 h-10 object-cover rounded-lg border border-white/10"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  {t.review_note && (
                    <div className="text-xs text-zinc-500">
                      审核意见：{t.review_note}
                    </div>
                  )}
                  <div className="flex gap-2">
                    {t.status === "submitted" && (
                      <>
                        <button
                          onClick={() => review(t, true)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-500"
                        >
                          <Check size={13} /> 通过并校准库存
                        </button>
                        <button
                          onClick={() => review(t, false)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/15 text-rose-400"
                        >
                          退回复核
                        </button>
                      </>
                    )}
                    {(t.status === "pending" || t.status === "drafted") && (
                      <button
                        onClick={async () => {
                          if (!confirm("取消该盘点任务？")) return;
                          if (await cancelStocktakeTask(t.id)) load();
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-zinc-800 text-zinc-400"
                      >
                        <X size={13} /> 取消
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ChartCard>

      {/* 历史 */}
      <ChartCard
        title="盘点历史"
        subtitle="按日期查询：谁盘的、差异多少、是否已校准"
        action={<History size={18} className="text-orange-500" />}
      >
        <div className="flex items-center gap-2 mb-3">
          <input
            type="date"
            value={historyDate}
            onChange={(e) => setHistoryDate(e.target.value)}
            className="bg-zinc-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white"
          />
          <button
            onClick={loadHistory}
            className="px-4 py-2 text-sm font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-xl"
          >
            查询
          </button>
        </div>
        {!history ? (
          <EmptyState text="选日期后点查询" />
        ) : history.length === 0 ? (
          <EmptyState text="该日期无盘点记录" />
        ) : (
          <div className="space-y-1.5">
            {history.map((t) => {
              const diff = stocktakeDiff(t.book_qty, t.actual_qty);
              return (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center gap-2 bg-zinc-950 rounded-xl px-3.5 py-2.5 text-xs"
                >
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold ${STK_CLS[t.status]}`}
                  >
                    {STK_LABEL[t.status]}
                  </span>
                  <span className="text-zinc-200">{t.item_name}</span>
                  <span className="text-zinc-500">
                    账面 {t.book_qty ?? "—"} → 实盘 {t.actual_qty ?? "—"}{" "}
                    {t.unit}
                    {diff !== null && diff !== 0 && (
                      <span
                        className={
                          diff > 0 ? " text-green-400" : " text-rose-400"
                        }
                      >
                        （{diff > 0 ? "+" : ""}
                        {diff}）
                      </span>
                    )}
                  </span>
                  <span className="text-zinc-500">
                    盘于人：{t.assignee_name || "未指派"}
                  </span>
                  {t.submitted_at && (
                    <span className="text-zinc-600">
                      {new Date(t.submitted_at).toLocaleString("zh-CN", {
                        hour12: false,
                      })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ChartCard>
    </div>
  );
}
