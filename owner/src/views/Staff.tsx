import { useEffect, useState } from "react";
import { Plus, Trash2, Save, UserCog, RefreshCw, Info } from "lucide-react";
import { fetchStaff, saveStaff, type Staff } from "../lib/data";

export default function StaffView() {
  const [list, setList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setLoading(true);
    const data = await fetchStaff();
    setList(data.length ? data : [{ name: "", password: "" }]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const update = (i: number, patch: Partial<Staff>) => {
    setList((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    );
  };

  const remove = (i: number) => {
    setList((prev) => prev.filter((_, idx) => idx !== i));
  };

  const add = () => {
    setList((prev) => [...prev, { name: "", password: "" }]);
  };

  const save = async () => {
    setSaving(true);
    const ok = await saveStaff(list);
    setSaving(false);
    setMsg(ok ? "✅ 已保存到云端" : "❌ 保存失败（检查数据库权限）");
    setTimeout(() => setMsg(""), 4000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />{" "}
            刷新
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
          {msg && <span className="text-sm text-zinc-300">{msg}</span>}
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-zinc-500 bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3">
        <Info size={15} className="shrink-0 mt-0.5 text-orange-500" />
        <span>
          这里的员工密码用于顾客端「服务员模式」解锁点单。最多建议 5
          个。保存后同步到云端 settings 表。
        </span>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-1">
          <UserCog size={18} className="text-orange-500" /> 员工列表
        </h3>
        {loading ? (
          <p className="text-zinc-500 text-sm py-6 text-center">加载中…</p>
        ) : list.length === 0 ? (
          <p className="text-zinc-500 text-sm py-6 text-center">
            暂无员工，点「添加员工」
          </p>
        ) : (
          list.map((s, i) => (
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
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              />
              <input
                value={s.password}
                onChange={(e) => update(i, { password: e.target.value })}
                placeholder="登录密码"
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              />
              <button
                onClick={() => remove(i)}
                className="shrink-0 px-3 py-2.5 text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-xl"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
