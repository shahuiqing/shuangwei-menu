import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  Save,
  UserCog,
  RefreshCw,
  Info,
  Eye,
  EyeOff,
} from "lucide-react";
import { ChartCard, EmptyState } from "../components/ui";
import { toast } from "../components/Toast";
import { fetchStaff, saveStaff, type Staff } from "../lib/data";

export default function StaffView() {
  const [list, setList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState<Record<number, boolean>>({});

  const load = async () => {
    setLoading(true);
    const data = await fetchStaff();
    setList(data.length ? data : [{ name: "", password: "" }]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const update = (i: number, patch: Partial<Staff>) =>
    setList((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    );
  const remove = (i: number) =>
    setList((prev) =>
      prev.length <= 1
        ? [{ name: "", password: "" }]
        : prev.filter((_, idx) => idx !== i),
    );
  const add = () => setList((prev) => [...prev, { name: "", password: "" }]);

  const save = async () => {
    // 校验：过滤空行；姓名/密码都必填；姓名不可重复
    const filled = list.filter((s) => s.name.trim() || s.password.trim());
    const invalid = filled.find((s) => !s.name.trim() || !s.password.trim());
    if (invalid) return toast.error("有员工缺少姓名或密码，请补全后再保存");
    const names = filled.map((s) => s.name.trim());
    if (new Set(names).size !== names.length)
      return toast.error("存在重名的员工，请修改后保存");
    setSaving(true);
    const ok = await saveStaff(filled);
    setSaving(false);
    if (ok) {
      toast.success(`已保存 ${filled.length} 名员工到云端`);
      load();
    } else toast.error("保存失败（检查数据库权限）");
  };

  const validCount = list.filter(
    (s) => s.name.trim() && s.password.trim(),
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center flex-wrap gap-3">
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 bg-zinc-900 border border-white/5 rounded-xl hover:bg-zinc-800"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> 刷新
        </button>
        <button
          onClick={add}
          className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-zinc-700 hover:bg-zinc-600 rounded-xl"
        >
          <Plus size={16} /> 添加员工
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-500 rounded-xl disabled:opacity-50"
        >
          <Save size={16} /> {saving ? "保存中…" : "保存到云端"}
        </button>
      </div>

      <div className="flex items-start gap-2 text-xs text-zinc-500 bg-zinc-900/60 border border-white/5 rounded-xl px-4 py-3">
        <Info size={15} className="shrink-0 mt-0.5 text-orange-500" />
        <span>
          员工密码用于顾客端「服务员模式」解锁点单。保存后同步到云端 settings
          表；当前有效员工 {validCount} 人。
        </span>
      </div>

      <ChartCard
        title="员工列表"
        action={<UserCog size={18} className="text-orange-500" />}
      >
        {loading ? (
          <EmptyState text="加载中…" />
        ) : list.length === 0 ? (
          <EmptyState text="暂无员工，点「添加员工」" />
        ) : (
          <div className="space-y-2.5">
            {list.map((s, i) => (
              <div
                key={i}
                className="flex flex-col sm:flex-row gap-2 items-stretch"
              >
                <div className="flex items-center gap-2 text-zinc-500 text-sm w-6 shrink-0">
                  {i + 1}.
                </div>
                <input
                  value={s.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="姓名 / 工号"
                  className="flex-1 bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                />
                <div className="relative flex-1">
                  <input
                    type={showPw[i] ? "text" : "password"}
                    value={s.password}
                    onChange={(e) => update(i, { password: e.target.value })}
                    placeholder="登录密码"
                    className="w-full bg-zinc-950 border border-white/5 rounded-xl pl-3 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((p) => ({ ...p, [i]: !p[i] }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
                  >
                    {showPw[i] ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <button
                  onClick={() => remove(i)}
                  className="shrink-0 px-3 py-2.5 text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-xl"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  );
}
