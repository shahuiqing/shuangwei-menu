import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  UserCog,
  RefreshCw,
  Info,
  KeyRound,
  Loader2,
} from "lucide-react";
import { ChartCard, EmptyState } from "../components/ui";
import { toast } from "../components/Toast";
import {
  fetchStaffMembers,
  upsertStaffMember,
  deleteStaffMember,
  ROLES,
  ROLE_LABEL,
  type Role,
  type StaffMember,
} from "../lib/staffOps";

/** 岗位徽标配色 */
const ROLE_CLS: Record<string, string> = {
  waiter: "bg-sky-500/15 text-sky-400",
  helper: "bg-amber-500/15 text-amber-400",
  cleaner: "bg-teal-500/15 text-teal-400",
  other: "bg-zinc-500/15 text-zinc-400",
};

interface Draft extends StaffMember {
  password: string; // 仅输入时生效，永不回显
}

const emptyDraft = (): Draft => ({
  id: "",
  name: "",
  roles: ["waiter"],
  status: "active",
  phone: "",
  note: "",
  password: "",
});

export default function StaffView() {
  const [list, setList] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pwPrompt, setPwPrompt] = useState<Draft | null>(null);
  const [pwValue, setPwValue] = useState("");

  const load = async () => {
    setLoading(true);
    const data = await fetchStaffMembers();
    setList(
      data.map((s) => ({
        ...s,
        roles: s.roles.length ? s.roles : ["waiter"],
        password: "",
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const patch = (id: string, p: Partial<Draft>) =>
    setList((prev) => prev.map((s) => (s.id === id ? { ...s, ...p } : s)));

  const toggleRole = (s: Draft, role: Role) =>
    patch(s.id, {
      roles: s.roles.includes(role)
        ? s.roles.filter((r) => r !== role)
        : [...s.roles, role],
    });

  const save = async (s: Draft) => {
    if (!s.name.trim()) return toast.error("请填写员工姓名");
    if (s.roles.length === 0) return toast.error("至少选择一个岗位");
    setSavingId(s.id || "new");
    const res = await upsertStaffMember(s, s.password || undefined);
    setSavingId(null);
    if (res.ok) {
      toast.success(
        s.id
          ? `已保存「${s.name.trim()}」`
          : `已添加员工「${s.name.trim()}」${s.password ? "" : "（尚未设置密码，点钥匙图标设置）"}`,
      );
      load();
    } else toast.error("保存失败（检查数据库权限）");
  };

  const remove = async (s: Draft) => {
    if (!s.id) {
      setList((prev) => prev.filter((x) => x.id));
      return;
    }
    if (
      !confirm(
        `删除员工「${s.name}」？其名下任务记录将保留但不再显示姓名关联。`,
      )
    )
      return;
    if (await deleteStaffMember(s.id)) {
      toast.success("已删除");
      load();
    } else toast.error("删除失败");
  };

  const setPw = async () => {
    if (!pwPrompt) return;
    const p = pwValue.trim();
    if (p.length < 4) return toast.error("密码至少 4 位");
    setPwPrompt(null);
    setPwValue("");
    setSavingId(pwPrompt.id);
    const res = await upsertStaffMember(pwPrompt, p);
    setSavingId(null);
    if (res.ok) toast.success(`「${pwPrompt.name}」的登录密码已更新`);
    else toast.error("密码保存失败");
  };

  const activeCount = list.filter((s) => s.status === "active").length;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-center flex-wrap gap-3">
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 bg-zinc-900 border border-white/5 rounded-xl hover:bg-zinc-800"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> 刷新
        </button>
        <button
          onClick={() => setList((prev) => [...prev, emptyDraft()])}
          className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-zinc-700 hover:bg-zinc-600 rounded-xl"
        >
          <Plus size={16} /> 添加员工
        </button>
        <span className="text-xs text-zinc-500">
          在职 {activeCount} 人 / 共 {list.filter((s) => s.id).length} 人
        </span>
      </div>

      <div className="flex items-start gap-2 text-xs text-zinc-500 bg-zinc-900/60 border border-white/5 rounded-xl px-4 py-3">
        <Info size={15} className="shrink-0 mt-0.5 text-orange-500" />
        <span>
          员工用「姓名 +
          密码」登录员工端（/staff.html），只能看到派给自己的任务、盘点、采购申报，经营数据对员工完全不可见。
          一个员工可兼多个岗位；停用后无法登录但记录保留。密码加密存储，不回显。
        </span>
      </div>

      {loading ? (
        <ChartCard title="员工列表">
          <EmptyState text="加载中…" />
        </ChartCard>
      ) : list.length === 0 ? (
        <ChartCard
          title="员工列表"
          action={<UserCog size={18} className="text-orange-500" />}
        >
          <EmptyState text="暂无员工，点「添加员工」" />
        </ChartCard>
      ) : (
        list.map((s) => (
          <div
            key={s.id || `new-${s.name}`}
            className="bg-zinc-900/60 border border-white/5 rounded-2xl p-4 space-y-3"
          >
            <div className="flex flex-col sm:flex-row gap-2 items-stretch">
              <input
                value={s.name}
                onChange={(e) => patch(s.id, { name: e.target.value })}
                placeholder="姓名"
                className="sm:w-36 bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              />
              <input
                value={s.phone}
                onChange={(e) => patch(s.id, { phone: e.target.value })}
                placeholder="手机号（选填）"
                className="flex-1 bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              />
              <input
                value={s.note}
                onChange={(e) => patch(s.id, { note: e.target.value })}
                placeholder="备注（选填）"
                className="flex-1 bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              />
              <button
                onClick={() => {
                  setPwPrompt(s);
                  setPwValue("");
                }}
                title={s.id ? "设置/重置登录密码" : "新员工先保存后再设密码"}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm border ${
                  s.id
                    ? "bg-zinc-800 hover:bg-zinc-700 border-white/5 text-zinc-200"
                    : "bg-zinc-900 border-white/5 text-zinc-600 cursor-not-allowed"
                }`}
                disabled={!s.id}
              >
                <KeyRound size={15} /> {s.id ? "密码" : "密码（先保存）"}
              </button>
              <button
                onClick={() => save(s)}
                disabled={savingId === (s.id || "new")}
                className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-500 rounded-xl disabled:opacity-50"
              >
                {savingId === (s.id || "new") ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : null}
                保存
              </button>
              <button
                onClick={() => remove(s)}
                className="shrink-0 px-3 py-2.5 text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-xl"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() => toggleRole(s, r)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    s.roles.includes(r)
                      ? `${ROLE_CLS[r]} border-transparent`
                      : "bg-zinc-950 border-white/5 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-white/10" />
              <button
                onClick={() =>
                  patch(s.id, {
                    status: s.status === "active" ? "disabled" : "active",
                  })
                }
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  s.status === "active"
                    ? "bg-green-500/15 text-green-400 border-transparent"
                    : "bg-zinc-800 text-zinc-500 border-white/5"
                }`}
              >
                {s.status === "active" ? "在职" : "停用"}
              </button>
            </div>
          </div>
        ))
      )}

      {/* 设置密码弹窗 */}
      {pwPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 w-full max-w-sm space-y-3">
            <div className="flex items-center gap-2 text-white font-bold">
              <KeyRound size={18} className="text-orange-500" />
              设置「{pwPrompt.name}」的登录密码
            </div>
            <input
              type="text"
              autoFocus
              value={pwValue}
              onChange={(e) => setPwValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setPw()}
              placeholder="至少 4 位，输入后点确认"
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPwPrompt(null)}
                className="px-4 py-2 text-sm text-zinc-300 bg-zinc-800 rounded-xl"
              >
                取消
              </button>
              <button
                onClick={setPw}
                className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-500 rounded-xl"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
