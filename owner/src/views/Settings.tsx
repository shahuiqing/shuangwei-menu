import { useState } from "react";
import { Store, KeyRound, Database, CheckCircle2 } from "lucide-react";
import { ChartCard } from "../components/ui";
import { toast } from "../components/Toast";
import { setOwnerPassword, verifyOwnerPassword } from "../lib/auth";
import { isConfigured, STORE_NAME } from "../lib/supabase";
import { saveSettingsField } from "../lib/data";

export default function Settings({
  settings,
  orderCount,
  onSaved,
}: {
  settings: any;
  orderCount: number;
  onSaved: () => void;
}) {
  const [storeName, setStoreName] = useState(
    settings?.restaurantName || STORE_NAME,
  );
  const [savingStore, setSavingStore] = useState(false);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");

  const saveStore = async () => {
    if (!storeName.trim()) return toast.error("店铺名称不能为空");
    setSavingStore(true);
    const ok = await saveSettingsField({ restaurantName: storeName.trim() });
    setSavingStore(false);
    if (ok) {
      toast.success("店铺名称已保存");
      onSaved();
    } else {
      toast.error("保存失败（检查数据库权限）");
    }
  };

  const changePw = () => {
    if (!verifyOwnerPassword(curPw)) return toast.error("当前密码错误");
    if (!newPw.trim()) return toast.error("新密码不能为空");
    setOwnerPassword(newPw.trim());
    setCurPw("");
    setNewPw("");
    toast.success("密码已修改（存本机）");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <ChartCard
        title="店铺信息"
        subtitle="同步到顾客端与云端"
        action={<Store size={18} className="text-orange-500" />}
      >
        <label className="text-sm text-zinc-400">店铺名称</label>
        <input
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          className="w-full mt-1.5 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
        />
        <button
          onClick={saveStore}
          disabled={savingStore}
          className="mt-3 w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold disabled:opacity-50"
        >
          {savingStore ? "保存中…" : "保存店铺名称"}
        </button>
      </ChartCard>

      <ChartCard
        title="老板端登录密码"
        subtitle="仅存本机，不依赖数据库"
        action={<KeyRound size={18} className="text-orange-500" />}
      >
        <label className="text-sm text-zinc-400">当前密码</label>
        <input
          type="password"
          value={curPw}
          onChange={(e) => setCurPw(e.target.value)}
          className="w-full mt-1.5 mb-3 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
        />
        <label className="text-sm text-zinc-400">新密码</label>
        <input
          type="password"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          className="w-full mt-1.5 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
        />
        <button
          onClick={changePw}
          className="mt-3 w-full py-2.5 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white font-semibold"
        >
          修改密码
        </button>
      </ChartCard>

      <ChartCard
        title="数据与连接"
        subtitle="当前系统状态"
        className="lg:col-span-2"
        action={<Database size={18} className="text-orange-500" />}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-zinc-950 rounded-xl p-4">
            <div className="text-zinc-500 text-xs">数据库</div>
            <div
              className={`text-lg font-bold mt-1 ${isConfigured ? "text-green-400" : "text-red-400"}`}
            >
              {isConfigured ? "已连接" : "未配置"}
            </div>
          </div>
          <div className="bg-zinc-950 rounded-xl p-4">
            <div className="text-zinc-500 text-xs">已加载订单</div>
            <div className="text-lg font-bold mt-1 text-white">
              {orderCount}
            </div>
          </div>
          <div className="bg-zinc-950 rounded-xl p-4">
            <div className="text-zinc-500 text-xs">菜单分类</div>
            <div className="text-lg font-bold mt-1 text-white">
              {Array.isArray(settings?.categories)
                ? settings.categories.length
                : 0}
            </div>
          </div>
          <div className="bg-zinc-950 rounded-xl p-4">
            <div className="text-zinc-500 text-xs">员工数</div>
            <div className="text-lg font-bold mt-1 text-white">
              {Array.isArray(
                settings?.devicePasswordsHash || settings?.devicePasswords,
              )
                ? (settings.devicePasswordsHash || settings.devicePasswords)
                    .length
                : 0}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4 text-xs text-zinc-500">
          <CheckCircle2 size={14} className="text-green-500" />
          老板端与顾客端共用同一套 Supabase
          数据；此处仅做只读统计与员工/店铺信息维护。
        </div>
      </ChartCard>
    </div>
  );
}
