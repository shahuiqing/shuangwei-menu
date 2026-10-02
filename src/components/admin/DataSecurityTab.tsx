import type { ChangeEvent } from "react";
import {
  ShieldCheck,
  DownloadCloud,
  FileSpreadsheet,
  UploadCloud,
  Archive,
  Save,
  Cloud,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Loader2,
  UtensilsCrossed,
  ImageOff,
  ReceiptText,
  Layers,
} from "lucide-react";

interface DataSecurityTabProps {
  categories: any[];
  orders: any[];
  checkpoints: any[];
  onSaveCheckpoint: () => void;
  onRestoreCheckpoint: (cp: any) => void;
  onRemoveCheckpoint: (id: string) => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  onImportJson: (e: ChangeEvent<HTMLInputElement>) => void;
  base64Count: number;
  dbTableStats: any;
  onRunDiagnostics: () => void;
  isLoadingDiagnostics: boolean;
}

export function DataSecurityTab({
  categories,
  orders,
  checkpoints,
  onSaveCheckpoint,
  onRestoreCheckpoint,
  onRemoveCheckpoint,
  onExportJson,
  onExportCsv,
  onImportJson,
  base64Count,
  dbTableStats,
  onRunDiagnostics,
  isLoadingDiagnostics,
}: DataSecurityTabProps) {
  const totalCats = Array.isArray(categories) ? categories.length : 0;
  const allItems: any[] = Array.isArray(categories)
    ? categories.flatMap((c: any) => c.items || [])
    : [];
  const totalDishes = allItems.length;
  const noPrice = allItems.filter(
    (i) => !i.price || String(i.price).trim() === "",
  ).length;
  const noImage = allItems.filter(
    (i) => !i.image || String(i.image).trim() === "",
  ).length;
  const totalOrders = Array.isArray(orders) ? orders.length : 0;

  const lastSaved = checkpoints?.[0]?.createdAt
    ? new Date(checkpoints[0].createdAt).toLocaleString()
    : "—";
  const cloudConnected = dbTableStats?.connected === true;

  const issues: string[] = [];
  if (base64Count > 0)
    issues.push(
      `${base64Count} 张大图仍是本地 Base64（建议优化，见「数据与备份」）`,
    );
  if (noPrice > 0) issues.push(`${noPrice} 道菜没有价格`);
  if (noImage > 0) issues.push(`${noImage} 道菜没有图片`);

  return (
    <>
      {/* Cloud sync status */}
      <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <ShieldCheck size={20} className="text-emerald-500" /> 数据安全中心
            / 备份与恢复
          </h3>
          <button
            type="button"
            onClick={onRunDiagnostics}
            disabled={isLoadingDiagnostics}
            className="flex items-center gap-1.5 text-xs bg-zinc-900 border border-zinc-700 hover:border-orange-500 hover:text-orange-400 text-zinc-300 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw
              size={13}
              className={isLoadingDiagnostics ? "animate-spin" : ""}
            />
            {isLoadingDiagnostics ? "检测中…" : "刷新云端状态"}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            className={`p-3 rounded-xl border ${cloudConnected ? "bg-emerald-500/5 border-emerald-500/20" : "bg-zinc-900/50 border-zinc-800"}`}
          >
            <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 mb-1">
              <Cloud size={13} className="text-emerald-400" /> 云端数据库
            </div>
            <div
              className={`text-sm font-bold ${cloudConnected ? "text-emerald-400" : "text-zinc-300"}`}
            >
              {dbTableStats?.connected === undefined
                ? "未检测（点右上刷新）"
                : cloudConnected
                  ? "已连接 ✓"
                  : "未连接 / 未配置"}
            </div>
          </div>
          <div className="p-3 rounded-xl border bg-zinc-900/50 border-zinc-800">
            <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 mb-1">
              <Save size={13} className="text-orange-400" /> 最近一次保存
            </div>
            <div className="text-sm font-bold text-zinc-200">{lastSaved}</div>
          </div>
          <div className="p-3 rounded-xl border bg-zinc-900/50 border-zinc-800">
            <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 mb-1">
              <Archive size={13} className="text-blue-400" /> 本地重置点
            </div>
            <div className="text-sm font-bold text-zinc-200">
              {checkpoints?.length || 0} 个
            </div>
          </div>
        </div>
      </div>

      {/* One-click backup + snapshots */}
      <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <Archive size={20} className="text-emerald-500" /> 一键备份与恢复
          (Restore Points)
        </h3>
        <p className="text-xs text-zinc-400 mb-4">
          每次成功保存到云端后会自动生成一个「自动重置点」。重要操作前可手动备份；数据异常或数据库不可用时，可一键恢复到任意重置点（存于本机，不依赖数据库）。
        </p>
        <div className="flex flex-wrap gap-3 mb-4">
          <button
            type="button"
            onClick={onSaveCheckpoint}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl transition-colors text-sm font-semibold active:scale-95"
          >
            <Save size={16} /> 立即备份当前菜单
          </button>
        </div>
        <div className="space-y-2">
          {(!checkpoints || checkpoints.length === 0) && (
            <div className="text-xs text-zinc-500 text-center py-3">
              暂无重置点
            </div>
          )}
          {(checkpoints || []).map((cp: any) => (
            <div
              key={cp.id}
              className="flex items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm text-white truncate">
                  {cp.auto ? "🔄 " : "📌 "}
                  {cp.name}
                </div>
                <div className="text-[10px] text-zinc-500">
                  {new Date(cp.createdAt).toLocaleString()} ·{" "}
                  {cp.data?.categories?.length || 0} 个分类
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => onRestoreCheckpoint(cp)}
                  className="text-xs bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 px-3 py-1.5 rounded-lg transition-colors"
                >
                  恢复
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveCheckpoint(cp.id)}
                  className="text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 px-3 py-1.5 rounded-lg transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Export / import */}
      <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <DownloadCloud size={20} className="text-orange-500" /> 导出 /
          导入备份
        </h3>
        <p className="text-xs text-zinc-400 mb-4">
          导出完整 JSON 备份到本地文件（换机/换设备时用），或导出 Excel/CSV
          菜品表；也可以从本地备份文件恢复。建议每周导出一次留存。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={onExportJson}
            className="bg-zinc-900 border border-zinc-800 hover:border-orange-500 text-zinc-300 hover:text-orange-500 px-4 py-3 rounded-xl transition-colors text-sm font-semibold flex flex-col items-center justify-center gap-1.5 active:scale-95"
          >
            <DownloadCloud size={22} className="text-orange-400" />
            <span>导出 JSON 备份</span>
          </button>
          <button
            type="button"
            onClick={onExportCsv}
            className="bg-zinc-900 border border-zinc-800 hover:border-green-500 text-zinc-300 hover:text-green-500 px-4 py-3 rounded-xl transition-colors text-sm font-semibold flex flex-col items-center justify-center gap-1.5 active:scale-95"
          >
            <FileSpreadsheet size={22} className="text-green-400" />
            <span>导出 Excel / CSV</span>
          </button>
          <label className="bg-zinc-900 border border-zinc-800 hover:border-blue-500 text-zinc-300 hover:text-blue-500 px-4 py-3 rounded-xl transition-colors text-sm font-semibold flex flex-col items-center justify-center gap-1.5 cursor-pointer active:scale-95">
            <UploadCloud size={22} className="text-blue-400" />
            <span>从本地恢复</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={onImportJson}
            />
          </label>
        </div>
      </div>

      {/* Data health */}
      <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <ShieldCheck size={20} className="text-emerald-500" /> 数据体检 (Data
          Health)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: "分类", value: totalCats, icon: Layers },
            { label: "菜品", value: totalDishes, icon: UtensilsCrossed },
            { label: "订单", value: totalOrders, icon: ReceiptText },
            { label: "本地大图", value: base64Count, icon: ImageOff },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="p-3 rounded-xl border bg-zinc-900/50 border-zinc-800"
            >
              <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 mb-1">
                <Icon size={13} className="text-zinc-500" /> {label}
              </div>
              <div className="text-lg font-bold font-mono text-zinc-100">
                {value}
              </div>
            </div>
          ))}
        </div>

        {issues.length === 0 ? (
          <div className="flex items-start gap-3 p-3 bg-green-500/5 border border-green-500/10 rounded-xl">
            <CheckCircle size={20} className="text-green-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-green-400 font-semibold mb-1">
                数据状态良好 / All Good
              </p>
              <p className="text-[11px] text-zinc-400">
                未发现明显的数据异常。记得定期「导出 JSON 备份」留存。
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
            <p className="text-xs text-amber-400 font-semibold flex items-center gap-1.5 mb-2">
              <AlertTriangle size={14} /> 发现 {issues.length} 项可优化
            </p>
            <ul className="text-[11px] text-zinc-300 space-y-1 list-disc pl-5">
              {issues.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        )}

        {isLoadingDiagnostics && (
          <div className="mt-3 text-[11px] text-zinc-500 flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" /> 正在刷新云端诊断…
          </div>
        )}
      </div>
    </>
  );
}
