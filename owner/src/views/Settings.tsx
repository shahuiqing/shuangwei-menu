import { useEffect, useState, type ChangeEvent } from "react";
import {
  Store,
  KeyRound,
  Eye,
  EyeOff,
  Gauge,
  Download,
  Upload,
  Percent,
  Scale,
} from "lucide-react";
import { ChartCard } from "../components/ui";
import { toast } from "../components/Toast";
import {
  changeOwnerPassword,
  verifyOwnerPassword,
  MIN_PASSWORD_LEN,
} from "../lib/auth";
import { getDailyQuota, setDailyQuota, todayQuotaKey } from "../lib/dailyQuota";
import { businessDayKey } from "../lib/businessDay";
import {
  exportLocalData,
  importLocalData,
  downloadText,
  localDataStats,
  DB_VERSION,
} from "../lib/localdb";
import { STORE_NAME } from "../lib/supabase";
import { saveSettingsField } from "../lib/data";
import {
  BIZ_LABEL,
  benchmarks,
  getBizType,
  pctText,
  setBizType,
  type BizType,
} from "../lib/industry";
import { logAction } from "../lib/auditLog";
import { getCommissionRate, setCommissionRate } from "../lib/platform";
import LlmCard from "./settings/LlmCard";
import NotifyCard from "./settings/NotifyCard";
import BackfillCard from "./settings/BackfillCard";
import SnapshotCard from "./settings/SnapshotCard";
import LogsCard from "./settings/LogsCard";
import UsageCard from "./settings/UsageCard";

const SETTINGS_SECTIONS: { id: string; label: string }[] = [
  { id: "set-store", label: "店铺" },
  { id: "set-account", label: "密码" },
  { id: "set-ai", label: "AI" },
  { id: "set-notify", label: "通知" },
  { id: "set-quota", label: "定额" },
  { id: "set-biz", label: "业态" },
  { id: "set-platform", label: "平台" },
  { id: "set-snapshot", label: "快照" },
  { id: "set-backfill", label: "补录" },
  { id: "set-export", label: "导出" },
  { id: "set-logs", label: "日志" },
  { id: "set-usage", label: "用量" },
  { id: "set-formula", label: "口径" },
];

export default function Settings({
  settings,
  onSaved,
}: {
  settings: any;
  onSaved: () => void;
}) {
  const [storeName, setStoreName] = useState(
    settings?.restaurantName || STORE_NAME,
  );
  const [savingStore, setSavingStore] = useState(false);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [quotaDraft, setQuotaDraft] = useState(() => {
    const q = getDailyQuota(todayQuotaKey());
    return q === null ? "" : String(q);
  });

  const [biz, setBiz] = useState<BizType>(() => getBizType());

  const [commission, setCommission] = useState(() => getCommissionRate());

  // 浏览器原生存储用量（含 IndexedDB 图片），供判断剩余空间
  const [originStorage, setOriginStorage] = useState("");
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const est = await (
          navigator as Navigator & {
            storage?: { estimate?: () => Promise<StorageEstimate> };
          }
        ).storage?.estimate?.();
        if (!alive || !est?.quota) return;
        setOriginStorage(
          `${((est.usage || 0) / 1048576).toFixed(1)} / ${(
            est.quota / 1048576
          ).toFixed(0)} MB`,
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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

  const changePw = async () => {
    if (!(await verifyOwnerPassword(curPw))) return toast.error("当前密码错误");
    if (newPw.trim().length < MIN_PASSWORD_LEN)
      return toast.error(`新密码至少 ${MIN_PASSWORD_LEN} 位`);
    const r = await changeOwnerPassword(curPw, newPw.trim());
    if (!r.ok) return toast.error(`新密码至少 ${MIN_PASSWORD_LEN} 位`);
    setCurPw("");
    setNewPw("");
    toast.success(
      r.cloud
        ? "密码已修改（本机 + 云端已同步）"
        : "密码已修改（本机生效；云端未配置或不可达）",
    );
  };

  const saveQuota = () => {
    const v = setDailyQuota(todayQuotaKey(), Number(quotaDraft));
    setQuotaDraft(v === null ? "" : String(v));
    toast.success(v === null ? "已清除今日定额" : `今日定额已设为 ${v} 元`);
  };

  const saveCommission = () => {
    const r = setCommissionRate(commission);
    setCommission(r);
    toast.success(`平台抽成率已保存（${Math.round(r * 100)}%）`);
  };

  const exportBackup = () => {
    downloadText(
      `shuangwei-backup-${businessDayKey(Date.now())}.json`,
      exportLocalData(),
    );
    logAction("导出本地数据");
    toast.success("已导出本地数据备份");
  };

  const importBackup = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const n = importLocalData(String(reader.result || ""));
        e.target.value = "";
        logAction("导入本地数据", `${n} 项`);
        toast.success(`已导入 ${n} 项本地数据`);
        onSaved();
      } catch {
        toast.error("导入失败：文件格式不对");
      }
    };
    reader.readAsText(f);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="lg:col-span-2 flex items-center gap-2 overflow-x-auto pb-0.5 -mt-1">
        {SETTINGS_SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() =>
              document
                .getElementById(s.id)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white hover:border-orange-500/40 transition-colors"
          >
            {s.label}
          </button>
        ))}
      </div>

      <ChartCard
        id="set-store"
        title="店铺信息"
        subtitle="同步到顾客端与云端"
        action={<Store size={18} className="text-orange-500" />}
      >
        <label className="text-sm text-zinc-400">店铺名称</label>
        <input
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          className="w-full mt-1.5 bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
        />
        <button
          onClick={saveStore}
          disabled={savingStore}
          className="mt-3 w-full py-3 rounded-xl btn-brand text-white font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {savingStore ? "保存中…" : "保存店铺名称"}
        </button>
      </ChartCard>

      <ChartCard
        id="set-account"
        title="老板端登录密码"
        subtitle="仅存本机，不依赖数据库"
        action={<KeyRound size={18} className="text-orange-500" />}
      >
        <label className="text-sm text-zinc-400">当前密码</label>
        <div className="relative mb-3">
          <input
            type={showPw ? "text" : "password"}
            value={curPw}
            onChange={(e) => setCurPw(e.target.value)}
            className="w-full mt-1.5 bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 pr-11 text-white focus:outline-none focus:border-orange-500"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
          >
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <label className="text-sm text-zinc-400">新密码</label>
        <input
          type={showPw ? "text" : "password"}
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          className="w-full mt-1.5 bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
        />
        <button
          onClick={changePw}
          className="mt-3 w-full py-3 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white font-semibold active:scale-[0.98] transition-transform"
        >
          修改密码
        </button>
      </ChartCard>

      <LlmCard />

      <NotifyCard />

      <ChartCard
        id="set-quota"
        title="每日定额"
        subtitle="今日食材成本上限 · 超出部分计为损耗"
        action={<Gauge size={18} className="text-orange-500" />}
      >
        <label className="text-sm text-zinc-400">
          今日食材成本定额（元，按营业日，凌晨 3 点分界）
        </label>
        <div className="flex items-center gap-2 mt-1.5">
          <input
            type="number"
            min={0}
            value={quotaDraft}
            onChange={(e) => setQuotaDraft(e.target.value)}
            placeholder="未设置"
            className="flex-1 bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
          />
          <button
            onClick={saveQuota}
            className="px-4 py-3 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold active:scale-95 transition-transform"
          >
            保存
          </button>
        </div>
        <p className="text-[11px] text-zinc-600 mt-1.5">
          实际食材成本超过定额的差额，会在盘点/损耗分析中标记为「定额超出」。
        </p>
      </ChartCard>

      <ChartCard
        id="set-biz"
        title="行业基准"
        subtitle="按业态给出的参考区间 · 看板与损耗页据此对比"
        action={<Gauge size={18} className="text-orange-500" />}
      >
        <label className="text-sm text-zinc-400">餐饮业态</label>
        <select
          value={biz}
          onChange={(e) => {
            const v = e.target.value as BizType;
            setBizType(v);
            setBiz(v);
            toast.success(`已切换「${BIZ_LABEL[v]}」基准`);
          }}
          className="mt-1.5 w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
        >
          {(Object.keys(BIZ_LABEL) as BizType[]).map((t) => (
            <option key={t} value={t}>
              {BIZ_LABEL[t]}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="bg-zinc-950 rounded-xl px-2 py-2.5 text-center">
            <div className="text-[11px] text-zinc-500">食材成本率</div>
            <div className="text-sm font-bold text-white mt-0.5">
              {pctText(benchmarks(biz).foodCost)}
            </div>
          </div>
          <div className="bg-zinc-950 rounded-xl px-2 py-2.5 text-center">
            <div className="text-[11px] text-zinc-500">损耗率上限</div>
            <div className="text-sm font-bold text-white mt-0.5">
              ≤{benchmarks(biz).wasteMax}%
            </div>
          </div>
          <div className="bg-zinc-950 rounded-xl px-2 py-2.5 text-center">
            <div className="text-[11px] text-zinc-500">人工占比</div>
            <div className="text-sm font-bold text-white mt-0.5">
              {pctText(benchmarks(biz).labor)}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-zinc-600 mt-2">
          行业经验值，仅供对比参考；存在本机，换设备需重新选择。
        </p>
      </ChartCard>

      <ChartCard
        id="set-platform"
        title="平台订单口径"
        subtitle="美团/饿了么等外部订单有抽成，营收不能直接当利润"
        action={<Percent size={18} className="text-orange-500" />}
      >
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={Math.round(commission * 100)}
            onChange={(e) =>
              setCommission(
                Math.min(100, Math.max(0, Number(e.target.value) || 0)) / 100,
              )
            }
            className="w-24 bg-zinc-950 border border-white/5 rounded-lg px-3 py-2.5 text-sm text-white text-right focus:outline-none focus:border-orange-500"
          />
          <span className="text-sm text-zinc-400">% 平台抽成</span>
          <button
            onClick={saveCommission}
            className="ml-auto px-4 py-2.5 rounded-lg btn-brand text-white text-sm font-semibold"
          >
            保存
          </button>
        </div>
        <p className="text-[11px] text-zinc-600 mt-2 leading-relaxed">
          平台净营收 = 营收 ×（1 −
          抽成率）；导入的「外卖」订单据此估算净利，避免与堂食混算。
        </p>
      </ChartCard>

      <BackfillCard onSaved={onSaved} />

      <SnapshotCard />

      <ChartCard
        id="set-export"
        title="数据导出"
        subtitle="备份本机暂存数据（订单标记/任务/定额/换算等）"
        action={<Download size={18} className="text-orange-500" />}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={exportBackup}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl btn-brand text-white text-sm font-semibold active:scale-[0.98] transition-transform"
          >
            <Download size={16} /> 导出本地数据
          </button>
          <label className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold cursor-pointer active:scale-[0.98] transition-transform">
            <Upload size={16} /> 导入备份
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={importBackup}
            />
          </label>
        </div>
        <p className="text-[11px] text-zinc-600 mt-2">
          云端数据在 Supabase
          自动保存；这里只备份「本机暂存」的部分（换机/清缓存后可用导入还原）。
        </p>
        {(() => {
          const s = localDataStats();
          return (
            <p className="text-[11px] text-zinc-500 mt-1">
              本机暂存 {s.count} 项 ·{" "}
              {s.bytes < 1024
                ? `${s.bytes} B`
                : `${(s.bytes / 1024).toFixed(1)} KB`}
              · 数据格式 v{DB_VERSION}
              {originStorage ? ` · 浏览器存储 ${originStorage}` : ""}
            </p>
          );
        })()}
      </ChartCard>

      <LogsCard />

      <UsageCard />

      <ChartCard
        id="set-formula"
        title="运行原理 / 计算口径"
        subtitle="每个数字是怎么算出来的 · 便于理解与对账"
        action={<Scale size={18} className="text-orange-500" />}
      >
        <div className="space-y-2.5 text-[13px] text-zinc-300 leading-relaxed">
          <p>
            <b className="text-zinc-100">营收</b>
            ：结账金额（finalTotal 优先，回退 total）。
          </p>
          <p>
            <b className="text-zinc-100">销售成本 COGS</b>
            ：菜品标准配方用量 × 原料单价（标准值，非后厨实际用量）。
          </p>
          <p>
            <b className="text-zinc-100">毛利</b> = 营收 −
            COGS（标准口径，偏乐观）。
          </p>
          <p>
            <b className="text-zinc-100">净利</b> = 营收 − COGS − 损耗 −
            固定成本（固定成本按月金额摊到每日）。
          </p>
          <p>
            <b className="text-zinc-100">固定成本</b>
            ：房租/人工/水电按月录入，按当月自然天数摊到每日。
          </p>
          <p>
            <b className="text-zinc-100">损耗</b>
            ：仅报损登记（显性）；后厨未报的隐性损耗需「成本对账」（真实 COGS −
            标准 COGS）。
          </p>
          <p>
            <b className="text-zinc-100">平台订单</b>
            ：按来源标记，净营收 = 营收 ×（1−抽成率）。
          </p>
          <p>
            <b className="text-zinc-100">临期预警</b>
            ：最近采购日 + 保质期天数 = 到期日，剩余 ≤3 天提示临期。
          </p>
          <p>
            <b className="text-zinc-100">销量预警</b>
            ：近 3 天 vs 前 7 天日均销量降幅 ≥50%。
          </p>
        </div>
      </ChartCard>
    </div>
  );
}
