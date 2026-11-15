import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Home,
  ClipboardList,
  Boxes,
  ShoppingCart,
  User,
  LogOut,
  RefreshCw,
  Camera,
  Send,
  AlertTriangle,
  ChevronLeft,
} from "lucide-react";
import {
  loadStaffSession,
  saveStaffSession,
  clearStaffSession,
  staffLogin,
  fetchMyTasks,
  fetchMyStocktakes,
  fetchMyPurchaseRequests,
  fetchStocktakeRule,
  submitStaffTask,
  submitStocktakeTask,
  createPurchaseRequest,
  resubmitPurchaseRequest,
  compressPhoto,
  ROLE_LABEL,
  TASK_STATUS_LABEL,
  stocktakeDiff,
  isOverdue,
  type StaffSession,
  type StaffTask,
  type StocktakeTask,
  type StocktakeRule,
  type PurchaseRequest,
  type PurchaseStatus,
} from "../lib/staffOps";
import { isConfigured } from "../lib/supabase";

const PUR_LABEL: Record<PurchaseStatus, string> = {
  pending: "待审批",
  approved: "已通过",
  rejected: "已驳回",
  purchased: "已采购",
};
const PUR_CLS: Record<PurchaseStatus, string> = {
  pending: "bg-amber-500/15 text-amber-400",
  approved: "bg-sky-500/15 text-sky-400",
  rejected: "bg-rose-500/15 text-rose-400",
  purchased: "bg-green-500/15 text-green-400",
};

const TASK_CLS: Record<string, string> = {
  pending: "bg-zinc-500/15 text-zinc-300",
  submitted: "bg-amber-500/15 text-amber-400",
  approved: "bg-green-500/15 text-green-400",
  rejected: "bg-rose-500/15 text-rose-400",
  cancelled: "bg-zinc-700/40 text-zinc-500",
};
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
  submitted: "待老板审核",
  rejected: "需复核",
  calibrated: "已通过",
  cancelled: "已取消",
};

const todayStr = () => new Date().toLocaleDateString("sv-SE");

type Tab = "home" | "tasks" | "stocktake" | "purchase" | "me";

/** 登录后用户信息（exp 只存在于 localStorage 存储层，内存里不需要） */
type StaffInfo = Omit<StaffSession, "exp">;

export default function App() {
  const [session, setSession] = useState<StaffInfo | null>(() =>
    loadStaffSession(),
  );

  if (!isConfigured) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-zinc-950 text-zinc-300 p-6 text-center">
        系统未配置数据库，请联系老板。
      </div>
    );
  }

  return session ? (
    <Main session={session} onLogout={() => setSession(null)} />
  ) : (
    <Login onOk={(s) => setSession(s)} />
  );
}

// ───────────────────────── 登录 ─────────────────────────

function Login({ onOk }: { onOk: (s: StaffInfo) => void }) {
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (!name.trim() || !pw) return setErr("请输入姓名和密码");
    setBusy(true);
    const s = await staffLogin(name, pw);
    setBusy(false);
    if (s) {
      saveStaffSession(s);
      onOk(s);
    } else setErr("登录失败：姓名或密码错误，或账号已停用");
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-zinc-950 text-white p-6">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto bg-orange-600/20 text-orange-500 rounded-full flex items-center justify-center mb-3">
            <User size={30} />
          </div>
          <h1 className="text-xl font-bold">员工端</h1>
          <p className="text-sm text-zinc-500 mt-1">输入老板给你的姓名和密码</p>
        </div>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setErr("");
          }}
          placeholder="姓名"
          className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500"
        />
        <input
          type="password"
          value={pw}
          onChange={(e) => {
            setPw(e.target.value);
            setErr("");
          }}
          onKeyDown={(e) => e.key === "Enter" && go()}
          placeholder="密码"
          className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500"
        />
        {err && <div className="text-sm text-rose-400">{err}</div>}
        <button
          onClick={go}
          disabled={busy}
          className="w-full py-3 font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-xl disabled:opacity-50"
        >
          {busy ? "登录中…" : "登录"}
        </button>
        <p className="text-[11px] text-zinc-600 text-center">
          这里只显示你自己的任务和申报，不包含营业与成本数据
        </p>
      </div>
    </div>
  );
}

// ───────────────────────── 主框架 ─────────────────────────

/** 员工主界面：员工端(/staff.html)与老板端登录页共用 */
export function Main({
  session,
  onLogout,
}: {
  session: StaffInfo;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<Tab>("home");
  const [refresh, setRefresh] = useState(0);
  const reload = useCallback(() => setRefresh((v) => v + 1), []);

  const tabs: { id: Tab; label: string; icon: typeof Home }[] = [
    { id: "home", label: "首页", icon: Home },
    { id: "tasks", label: "我的任务", icon: ClipboardList },
    { id: "stocktake", label: "盘点", icon: Boxes },
    { id: "purchase", label: "采购申报", icon: ShoppingCart },
    { id: "me", label: "我的", icon: User },
  ];

  return (
    <div className="min-h-dvh bg-zinc-950 text-white pb-20">
      {/* 顶栏 */}
      <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-white/5 px-4 py-3 flex items-center gap-2">
        <div className="font-bold">{session.name}</div>
        <div className="flex gap-1">
          {session.roles.map((r) => (
            <span
              key={r}
              className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-600/20 text-orange-400"
            >
              {ROLE_LABEL[r] || r}
            </span>
          ))}
        </div>
        <button
          onClick={reload}
          className="ml-auto p-2 text-zinc-500 hover:text-white"
        >
          <RefreshCw size={16} className={refresh ? "" : ""} />
        </button>
        <button
          onClick={() => {
            if (!confirm("退出登录？")) return;
            clearStaffSession();
            onLogout();
          }}
          className="p-2 text-zinc-500 hover:text-rose-400"
        >
          <LogOut size={16} />
        </button>
      </div>

      <div className="p-4 max-w-lg mx-auto" key={refresh}>
        {tab === "home" && <HomeTab session={session} />}
        {tab === "tasks" && <TasksTab session={session} />}
        {tab === "stocktake" && <StocktakeTab session={session} />}
        {tab === "purchase" && <PurchaseTab session={session} />}
        {tab === "me" && <MeTab session={session} />}
      </div>

      {/* 底部导航 */}
      <div className="fixed bottom-0 inset-x-0 z-10 bg-zinc-900/95 backdrop-blur border-t border-white/5 flex">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] ${
              tab === t.id ? "text-orange-500" : "text-zinc-500"
            }`}
          >
            <t.icon size={20} />
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── 首页 ─────────────────────────

function HomeTab({ session }: { session: StaffInfo }) {
  const [todoTasks, setTodoTasks] = useState<StaffTask[]>([]);
  const [todoStk, setTodoStk] = useState<StocktakeTask[]>([]);
  const [rejectedReq, setRejectedReq] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [t, s, p] = await Promise.all([
        fetchMyTasks(session.staffId),
        fetchMyStocktakes(session.staffId, todayStr()),
        fetchMyPurchaseRequests(session.staffId),
      ]);
      setTodoTasks(
        t.filter((x) => x.status === "pending" || x.status === "rejected"),
      );
      setTodoStk(
        s.filter(
          (x) =>
            x.status === "pending" ||
            x.status === "drafted" ||
            x.status === "rejected",
        ),
      );
      setRejectedReq(p.filter((x) => x.status === "rejected"));
      setLoading(false);
    })();
  }, [session.staffId]);

  const item = (title: string, n: number, Icon: typeof Home, hint: string) => (
    <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-orange-600/15 text-orange-500 flex items-center justify-center shrink-0">
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-zinc-200">{title}</div>
        <div className="text-[11px] text-zinc-500">{hint}</div>
      </div>
      <div
        className={`text-xl font-bold tnum ${n > 0 ? "text-orange-500" : "text-zinc-600"}`}
      >
        {loading ? "…" : n}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">今日待办</h2>
      {item("我的任务", todoTasks.length, ClipboardList, "含被驳回需重做的")}
      {item("今日盘点", todoStk.length, Boxes, "填实盘数量、拍照、提交")}
      {item(
        "被驳回的采购申报",
        rejectedReq.length,
        ShoppingCart,
        "可修改后重新提交",
      )}
      <div className="bg-zinc-900/60 border border-white/5 rounded-2xl px-4 py-3 text-[11px] text-zinc-600">
        完成情况会实时同步给老板。这里看不到别人的任务，也看不到经营数据。
      </div>
    </div>
  );
}

// ───────────────────────── 我的任务 ─────────────────────────

function TasksTab({ session }: { session: StaffInfo }) {
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setTasks(await fetchMyTasks(session.staffId));
    setLoading(false);
  }, [session.staffId]);

  useEffect(() => {
    load();
  }, [load]);

  const open = tasks.find((t) => t.id === openId) || null;
  const sorted = useMemo(() => {
    // 待办在前，逾期最靠前
    const rank = (t: StaffTask) =>
      t.status === "rejected"
        ? 0
        : t.status === "pending"
          ? isOverdue(t.due_at)
            ? 1
            : 2
          : 3;
    return [...tasks].sort((a, b) => rank(a) - rank(b));
  }, [tasks]);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">我的任务</h2>
      {loading ? (
        <div className="text-sm text-zinc-500">加载中…</div>
      ) : sorted.length === 0 ? (
        <div className="text-sm text-zinc-500 bg-zinc-900 rounded-2xl p-6 text-center">
          暂时没有任务，等老板派发
        </div>
      ) : (
        sorted.map((t) => {
          const overdue = t.status === "pending" && isOverdue(t.due_at);
          return (
            <button
              key={t.id}
              onClick={() => setOpenId(t.id)}
              className={`w-full text-left bg-zinc-900 border rounded-2xl p-4 ${
                overdue ? "border-rose-500/40" : "border-white/5"
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${TASK_CLS[t.status]}`}
                >
                  {TASK_STATUS_LABEL[t.status]}
                </span>
                {overdue && (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-bold">
                    <AlertTriangle size={11} /> 逾期
                  </span>
                )}
                <span className="text-sm font-semibold">{t.title}</span>
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">
                截止{" "}
                {t.due_at
                  ? new Date(t.due_at).toLocaleString("zh-CN", {
                      hour12: false,
                    })
                  : "—"}
                {t.resubmit_count > 0 ? ` · 重提过 ${t.resubmit_count} 次` : ""}
              </div>
              {t.status === "rejected" && t.review_note && (
                <div className="text-xs text-rose-400 mt-1">
                  老板意见：{t.review_note}
                </div>
              )}
            </button>
          );
        })
      )}

      {open && (
        <TaskDetail
          task={open}
          onClose={() => setOpenId(null)}
          onDone={() => {
            setOpenId(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function TaskDetail({
  task,
  onClose,
  onDone,
}: {
  task: StaffTask;
  onClose: () => void;
  onDone: () => void;
}) {
  const [checklist, setChecklist] = useState(
    task.checklist.map((c) => ({ text: c.text, done: !!c.done })),
  );
  const [note, setNote] = useState(task.status === "rejected" ? "" : task.note);
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const addPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr("");
    try {
      const p = await compressPhoto(f);
      setPhotos((prev) => [...prev, p]);
    } catch {
      setErr("照片处理失败，请换一张");
    }
    e.target.value = "";
  };

  const submit = async () => {
    if (checklist.some((c) => !c.done && c.text.trim()))
      return setErr("还有检查项没打勾");
    if (task.require_photo && photos.length === 0 && task.photos.length === 0)
      return setErr("该任务要求拍照提交");
    setBusy(true);
    const ok = await submitStaffTask(
      task.id,
      checklist,
      note,
      [...task.photos, ...photos],
      task.status === "rejected",
    );
    setBusy(false);
    if (ok) onDone();
    else setErr("提交失败，检查网络后重试");
  };

  const resubmitting = task.status === "rejected";

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-zinc-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 max-h-[85dvh] overflow-y-auto space-y-3">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-1 text-zinc-400">
            <ChevronLeft size={20} />
          </button>
          <div className="font-bold">{task.title}</div>
          <span
            className={`ml-auto text-[11px] px-2 py-0.5 rounded-full font-bold ${TASK_CLS[task.status]}`}
          >
            {TASK_STATUS_LABEL[task.status]}
          </span>
        </div>
        {task.description && (
          <div className="text-xs text-zinc-400">{task.description}</div>
        )}
        {resubmitting && task.review_note && (
          <div className="text-xs text-rose-400 bg-rose-500/10 rounded-xl px-3 py-2">
            被驳回：{task.review_note}（修改后重新提交）
          </div>
        )}

        {checklist.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs text-zinc-500">检查项（逐项完成打勾）</div>
            {checklist.map((c, i) => (
              <label
                key={i}
                className="flex items-center gap-2 bg-zinc-950 rounded-xl px-3 py-2.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={!!c.done}
                  onChange={(e) =>
                    setChecklist((prev) =>
                      prev.map((x, j) =>
                        j === i ? { ...x, done: e.target.checked } : x,
                      ),
                    )
                  }
                  className="w-4 h-4 accent-orange-500"
                />
                {c.text}
              </label>
            ))}
          </div>
        )}

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="完成说明（选填）"
          rows={2}
          className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"
        />

        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-zinc-800 text-zinc-200 cursor-pointer">
            <Camera size={14} /> 拍照/选照片
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={addPhoto}
              className="hidden"
            />
          </label>
          {task.photos.length > 0 && (
            <span className="text-[11px] text-zinc-500">
              已有 {task.photos.length} 张
            </span>
          )}
        </div>
        {photos.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {photos.map((p, i) => (
              <div key={i} className="relative">
                <img
                  src={p}
                  alt=""
                  className="w-16 h-16 object-cover rounded-xl border border-white/10"
                />
                <button
                  onClick={() =>
                    setPhotos((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-600 rounded-full text-white text-[11px] leading-5"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {err && <div className="text-xs text-rose-400">{err}</div>}
        <button
          onClick={submit}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-3 font-bold text-white bg-green-600 hover:bg-green-500 rounded-xl disabled:opacity-50"
        >
          <Send size={16} />{" "}
          {busy ? "提交中…" : resubmitting ? "重新提交" : "提交完成"}
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── 盘点 ─────────────────────────

function StocktakeTab({ session }: { session: StaffInfo }) {
  const [rule, setRule] = useState<StocktakeRule | null>(null);
  const [tasks, setTasks] = useState<StocktakeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, t] = await Promise.all([
      fetchStocktakeRule(),
      fetchMyStocktakes(session.staffId),
    ]);
    setRule(r);
    // 今天优先 + 待复核优先
    const rank = (x: StocktakeTask) =>
      (x.count_date === todayStr() ? 0 : 1) * 10 +
      (x.status === "rejected"
        ? 0
        : x.status === "pending" || x.status === "drafted"
          ? 1
          : 2);
    setTasks([...t].sort((a, b) => rank(a) - rank(b)));
    setLoading(false);
  }, [session.staffId]);

  useEffect(() => {
    load();
  }, [load]);

  const open = tasks.find((t) => t.id === openId) || null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">盘点任务</h2>
      <div className="text-[11px] text-zinc-600 bg-zinc-900/60 border border-white/5 rounded-xl px-3 py-2">
        填「我看到多少」就好。
        {rule && !rule.show_book_qty
          ? "按老板设置，这里不显示账面数量。"
          : rule
            ? "老板已开启显示账面数量。"
            : ""}
        数量会拿去校准库存，请如实填写。
      </div>
      {loading ? (
        <div className="text-sm text-zinc-500">加载中…</div>
      ) : tasks.length === 0 ? (
        <div className="text-sm text-zinc-500 bg-zinc-900 rounded-2xl p-6 text-center">
          今天没有你的盘点任务
        </div>
      ) : (
        tasks.map((t) => {
          const overdue =
            (t.status === "pending" || t.status === "drafted") &&
            rule?.due_time &&
            todayStr() >= t.count_date;
          return (
            <button
              key={t.id}
              onClick={() => setOpenId(t.id)}
              className={`w-full text-left bg-zinc-900 border rounded-2xl p-4 ${
                t.status === "rejected"
                  ? "border-rose-500/40"
                  : overdue
                    ? "border-amber-500/30"
                    : "border-white/5"
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${STK_CLS[t.status]}`}
                >
                  {STK_LABEL[t.status]}
                </span>
                <span className="text-sm font-semibold">{t.item_name}</span>
                <span className="text-xs text-zinc-500">{t.unit}</span>
                <span className="ml-auto text-[11px] text-zinc-500">
                  {t.count_date}
                  {rule?.due_time ? ` · ${rule.due_time} 前` : ""}
                </span>
              </div>
              {t.status === "rejected" && t.review_note && (
                <div className="text-xs text-rose-400 mt-1">
                  老板意见：{t.review_note}
                </div>
              )}
            </button>
          );
        })
      )}
      {open && (
        <StocktakeDetail
          task={open}
          rule={rule}
          onClose={() => setOpenId(null)}
          onDone={() => {
            setOpenId(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function StocktakeDetail({
  task,
  rule,
  onClose,
  onDone,
}: {
  task: StocktakeTask;
  rule: StocktakeRule | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [qty, setQty] = useState(
    task.actual_qty === null || task.actual_qty === undefined
      ? ""
      : String(task.actual_qty),
  );
  const [note, setNote] = useState(task.note);
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const addPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const p = await compressPhoto(f);
      setPhotos((prev) => [...prev, p]);
    } catch {
      setErr("照片处理失败");
    }
    e.target.value = "";
  };

  const submit = async (asDraft: boolean) => {
    const trimmed = qty.trim();
    if (!asDraft && trimmed === "") return setErr("请填写实盘数量（或点暂存）");
    const n = trimmed === "" ? null : Number(trimmed);
    if (n !== null && (!isFinite(n) || n < 0))
      return setErr("数量要是不小于 0 的数字");
    if (
      rule?.require_photo &&
      !asDraft &&
      task.photos.length === 0 &&
      photos.length === 0
    )
      return setErr("老板要求盘点拍照");
    setBusy(true);
    const res = await submitStocktakeTask(
      task.id,
      asDraft ? null : n,
      note,
      [...task.photos, ...photos],
      rule?.allow_draft ?? true,
    );
    setBusy(false);
    if (res === false) setErr("提交失败，检查网络后重试");
    else onDone();
  };

  const showBook = rule?.show_book_qty && task.book_qty !== null;
  const diff = stocktakeDiff(task.book_qty, qty === "" ? null : Number(qty));

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-zinc-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 max-h-[85dvh] overflow-y-auto space-y-3">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-1 text-zinc-400">
            <ChevronLeft size={20} />
          </button>
          <div className="font-bold">{task.item_name}</div>
          <span
            className={`ml-auto text-[11px] px-2 py-0.5 rounded-full font-bold ${STK_CLS[task.status]}`}
          >
            {STK_LABEL[task.status]}
          </span>
        </div>
        <div className="text-xs text-zinc-500">
          单位：{task.unit} · {task.count_date}
          {task.zone ? ` · ${task.zone}` : ""}
        </div>
        {task.status === "rejected" && task.review_note && (
          <div className="text-xs text-rose-400 bg-rose-500/10 rounded-xl px-3 py-2">
            老板要求复核：{task.review_note}
          </div>
        )}

        <div>
          <div className="text-xs text-zinc-500 mb-1">
            实盘数量（现在实际有多少 {task.unit}）
          </div>
          <div className="flex items-center gap-2 bg-zinc-950 border border-white/10 rounded-xl px-3 py-2.5">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={qty}
              onChange={(e) => {
                setQty(e.target.value);
                setErr("");
              }}
              placeholder="填数量"
              className="flex-1 bg-transparent text-lg font-bold focus:outline-none"
            />
            <span className="text-zinc-500 text-sm">{task.unit}</span>
          </div>
          {showBook && diff !== null && (
            <div className="text-[11px] text-zinc-600 mt-1">
              账面 {task.book_qty} {task.unit}
              {diff !== 0 && ` · 与账面差 ${diff > 0 ? "+" : ""}${diff}`}
            </div>
          )}
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="备注：比如临期、破损、位置不对（选填）"
          rows={2}
          className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"
        />

        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-zinc-800 text-zinc-200 cursor-pointer">
            <Camera size={14} /> 拍照/选照片
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={addPhoto}
              className="hidden"
            />
          </label>
          {task.photos.length > 0 && (
            <span className="text-[11px] text-zinc-500">
              已有 {task.photos.length} 张
            </span>
          )}
        </div>
        {photos.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {photos.map((p, i) => (
              <div key={i} className="relative">
                <img
                  src={p}
                  alt=""
                  className="w-16 h-16 object-cover rounded-xl border border-white/10"
                />
                <button
                  onClick={() =>
                    setPhotos((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-600 rounded-full text-white text-[11px] leading-5"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {err && <div className="text-xs text-rose-400">{err}</div>}
        <div className="flex gap-2">
          {rule?.allow_draft && (
            <button
              onClick={() => submit(true)}
              disabled={busy}
              className="flex-1 py-3 font-semibold text-zinc-200 bg-zinc-800 rounded-xl disabled:opacity-50"
            >
              暂存（盘到一半）
            </button>
          )}
          <button
            onClick={() => submit(false)}
            disabled={busy}
            className="flex-1 py-3 font-bold text-white bg-green-600 hover:bg-green-500 rounded-xl disabled:opacity-50"
          >
            {busy ? "提交中…" : "提交盘点"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── 采购申报 ─────────────────────────

const UNITS = ["kg", "g", "L", "ml", "个", "箱", "包", "袋", "桶", "瓶"];
const CATEGORIES = [
  "蔬菜",
  "肉类",
  "水产",
  "调料",
  "粮油",
  "饮料",
  "耗材",
  "其他",
];

function PurchaseTab({ session }: { session: StaffInfo }) {
  const [list, setList] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PurchaseRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setList(await fetchMyPurchaseRequests(session.staffId));
    setLoading(false);
  }, [session.staffId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold">采购申报</h2>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-xl"
        >
          <ShoppingCart size={15} /> 申报要买的
        </button>
      </div>
      {loading ? (
        <div className="text-sm text-zinc-500">加载中…</div>
      ) : list.length === 0 ? (
        <div className="text-sm text-zinc-500 bg-zinc-900 rounded-2xl p-6 text-center">
          还没有申报过，点右上角「申报要买的」
        </div>
      ) : (
        list.map((r) => (
          <div
            key={r.id}
            className="bg-zinc-900 border border-white/5 rounded-2xl p-4"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${PUR_CLS[r.status]}`}
              >
                {PUR_LABEL[r.status]}
              </span>
              {r.urgency === "urgent" && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-bold">
                  紧急
                </span>
              )}
              <span className="text-sm font-semibold">{r.item_name}</span>
              <span className="text-sm text-zinc-300">
                {r.quantity} {r.unit}
              </span>
            </div>
            {r.status === "rejected" && r.reject_reason && (
              <div className="text-xs text-rose-400 mt-1">
                驳回原因：{r.reject_reason}
              </div>
            )}
            {r.status === "purchased" && (
              <div className="text-[11px] text-green-500 mt-1">已采购 ✓</div>
            )}
            {r.status === "rejected" && (
              <button
                onClick={() => {
                  setEditing(r);
                  setShowForm(true);
                }}
                className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200"
              >
                修改后重新提交
              </button>
            )}
          </div>
        ))
      )}
      {showForm && (
        <RequestForm
          session={session}
          editing={editing}
          onClose={() => setShowForm(false)}
          onDone={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function RequestForm({
  session,
  editing,
  onClose,
  onDone,
}: {
  session: StaffInfo;
  editing: PurchaseRequest | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(editing?.item_name || "");
  const [qty, setQty] = useState(editing ? String(editing.quantity) : "");
  const [unit, setUnit] = useState(editing?.unit || "kg");
  const [category, setCategory] = useState(editing?.category || "其他");
  const [urgent, setUrgent] = useState(editing?.urgency === "urgent");
  const [expected, setExpected] = useState(
    editing?.expected_date || todayStr(),
  );
  const [note, setNote] = useState(editing?.note || "");
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const addPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const p = await compressPhoto(f);
      setPhotos((prev) => [...prev, p]);
    } catch {
      setErr("照片处理失败");
    }
    e.target.value = "";
  };

  const submit = async () => {
    if (!name.trim()) return setErr("填写要买什么");
    if (!qty.trim() || !(Number(qty) > 0)) return setErr("填写数量");
    setBusy(true);
    const payload = {
      item_name: name.trim(),
      quantity: Number(qty),
      unit,
      category,
      urgency: urgent ? ("urgent" as const) : ("normal" as const),
      expected_date: expected || null,
      note,
      photos,
    };
    const ok = editing
      ? await resubmitPurchaseRequest(editing.id, payload)
      : await createPurchaseRequest(session, payload);
    setBusy(false);
    if (ok) onDone();
    else setErr("提交失败，检查网络后重试");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-zinc-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 max-h-[85dvh] overflow-y-auto space-y-3">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-1 text-zinc-400">
            <ChevronLeft size={20} />
          </button>
          <div className="font-bold">
            {editing ? "修改采购申报" : "采购申报（明天要买的）"}
          </div>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="要买什么，如：洋葱"
          className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"
        />
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="数量"
            className="flex-1 bg-zinc-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="bg-zinc-950 border border-white/10 rounded-xl px-3 text-sm text-white"
          >
            {UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                category === c
                  ? "bg-sky-500/15 text-sky-400 border-transparent"
                  : "bg-zinc-950 border-white/5 text-zinc-500"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUrgent(!urgent)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold ${
              urgent
                ? "bg-rose-500/15 text-rose-400"
                : "bg-zinc-950 border border-white/5 text-zinc-500"
            }`}
          >
            {urgent ? "🔥 紧急（今天就要）" : "不紧急"}
          </button>
          <label className="flex items-center gap-1.5 bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-400">
            期望到货
            <input
              type="date"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none"
            />
          </label>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="用途/备注（选填）"
          rows={2}
          className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"
        />
        <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-zinc-800 text-zinc-200 cursor-pointer">
          <Camera size={14} /> 拍照（选填）
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={addPhoto}
            className="hidden"
          />
        </label>
        {photos.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {photos.map((p, i) => (
              <div key={i} className="relative">
                <img
                  src={p}
                  alt=""
                  className="w-16 h-16 object-cover rounded-xl border border-white/10"
                />
                <button
                  onClick={() =>
                    setPhotos((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-600 rounded-full text-white text-[11px] leading-5"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {err && <div className="text-xs text-rose-400">{err}</div>}
        <button
          onClick={submit}
          disabled={busy}
          className="w-full py-3 font-bold text-white bg-green-600 hover:bg-green-500 rounded-xl disabled:opacity-50"
        >
          {busy ? "提交中…" : editing ? "重新提交" : "提交申报"}
        </button>
        <div className="text-[11px] text-zinc-600">
          老板审批后会汇总采购；这里看不到价格和供应商信息。
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── 我的 ─────────────────────────

function MeTab({ session }: { session: StaffInfo }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">我的资料</h2>
      <div className="bg-zinc-900 border border-white/5 rounded-2xl divide-y divide-white/5">
        {[
          { label: "姓名", value: session.name },
          {
            label: "岗位",
            value: session.roles.map((r) => ROLE_LABEL[r] || r).join("、"),
          },
          { label: "账号状态", value: "在职" },
        ].map((row) => (
          <div key={row.label} className="flex items-center px-4 py-3.5">
            <span className="text-sm text-zinc-500">{row.label}</span>
            <span className="ml-auto text-sm">{row.value}</span>
          </div>
        ))}
      </div>
      <div className="bg-zinc-900/60 border border-white/5 rounded-2xl px-4 py-3 text-[11px] text-zinc-600">
        修改姓名/岗位/密码请联系老板。登录有效期 7 天。
      </div>
    </div>
  );
}
