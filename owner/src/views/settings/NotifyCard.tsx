import { useState } from "react";
import { Bell } from "lucide-react";
import { ChartCard } from "../../components/ui";
import { toast } from "../../components/Toast";
import {
  notifyEnabled,
  notifyPermission,
  requestNotifyPermission,
  setNotifyEnabled,
  type NotifyPermission,
} from "../../lib/notify";
import { useLateConfig } from "../../lib/lateOrders";

/** 消息通知 + 漏单提醒阈值 */
export default function NotifyCard() {
  const [notifyOn, setNotifyOn] = useState(() => notifyEnabled());
  const [perm, setPerm] = useState<NotifyPermission>(() => notifyPermission());

  const [lateCfg, setLateCfg] = useLateConfig();
  const [pendingDraft, setPendingDraft] = useState(String(lateCfg.pendingMin));
  const [cookingDraft, setCookingDraft] = useState(String(lateCfg.cookingMin));

  const saveLate = () => {
    const next = setLateCfg({
      pendingMin: Number(pendingDraft),
      cookingMin: Number(cookingDraft),
    });
    setPendingDraft(String(next.pendingMin));
    setCookingDraft(String(next.cookingMin));
    toast.success(
      `漏单阈值已保存（待接单 ${next.pendingMin} 分 / 制作 ${next.cookingMin} 分）`,
    );
  };

  const toggleNotify = async () => {
    if (notifyOn) {
      setNotifyEnabled(false);
      setNotifyOn(false);
      toast.success("已关闭新订单通知");
      return;
    }
    if (perm === "unsupported") return toast.error("当前浏览器不支持系统通知");
    let p: NotifyPermission = perm;
    if (p !== "granted") p = await requestNotifyPermission();
    setPerm(p);
    if (p !== "granted")
      return toast.error(
        p === "denied"
          ? "通知已被拒绝：请在浏览器地址栏的站点设置里改为「允许」"
          : "未授予通知权限",
      );
    setNotifyEnabled(true);
    setNotifyOn(true);
    toast.success("已开启：有新订单时弹系统通知");
  };

  return (
    <ChartCard
      id="set-notify"
      title="消息通知"
      subtitle="系统通知 · 仅在页面或安装的应用打开时生效"
      action={<Bell size={18} className="text-orange-500" />}
    >
      <div className="flex items-center justify-between gap-3 bg-zinc-950 rounded-xl px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm text-zinc-200">新订单提醒</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            {perm === "unsupported"
              ? "当前浏览器不支持系统通知"
              : perm === "denied"
                ? "权限被拒绝"
                : perm === "default"
                  ? "未授权，点右侧开启"
                  : notifyOn
                    ? "已开启"
                    : "已关闭"}
          </div>
        </div>
        <button
          onClick={toggleNotify}
          className={`shrink-0 px-4 py-2 rounded-lg text-sm font-semibold active:scale-95 transition-transform ${
            notifyOn
              ? "bg-zinc-700 hover:bg-zinc-600 text-white"
              : "btn-brand text-white"
          }`}
        >
          {notifyOn ? "关闭" : "开启"}
        </button>
      </div>

      <div className="mt-4">
        <div className="text-sm text-zinc-200 mb-1.5">漏单提醒阈值</div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-zinc-400">
            待接单超时(分钟)
            <input
              type="number"
              min={1}
              max={240}
              value={pendingDraft}
              onChange={(e) => setPendingDraft(e.target.value)}
              className="block mt-1 w-24 bg-zinc-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-zinc-400">
            制作中超时(分钟)
            <input
              type="number"
              min={1}
              max={240}
              value={cookingDraft}
              onChange={(e) => setCookingDraft(e.target.value)}
              className="block mt-1 w-24 bg-zinc-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white"
            />
          </label>
          <button
            onClick={saveLate}
            className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold active:scale-95 transition-transform"
          >
            保存阈值
          </button>
        </div>
        <p className="text-[11px] text-zinc-600 mt-1.5">
          超过阈值的订单会在「今日待办」置顶标红、订单页标红，并在开启通知时弹出系统提醒。
        </p>
      </div>

      <p className="text-[11px] text-zinc-600 mt-2">
        零后端：不联网也能用。顾客下单后只要本应用开着（含安装到主屏幕的
        PWA），就会弹出系统通知；关闭页面不会推送。
      </p>
    </ChartCard>
  );
}
