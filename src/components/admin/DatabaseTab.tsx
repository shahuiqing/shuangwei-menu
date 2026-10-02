import type { ChangeEvent } from "react";
import {
  Save,
  DownloadCloud,
  FileSpreadsheet,
  UploadCloud,
  Archive,
  Sparkles,
  CheckCircle,
  Loader2,
  Cloud,
  Database,
  RefreshCw,
  AlertTriangle,
  HardDrive,
  Trash2,
} from "lucide-react";

export function DatabaseTab({
  onExportJson,
  onExportCsv,
  onImportJson,
  checkpoints,
  onSaveCheckpoint,
  onRestoreCheckpoint,
  onRemoveCheckpoint,
  lanConnected,
  isLanMode,
  base64Count,
  onOptimizeImages,
  isOptimizing,
  optimizationProgress,
  onOpenSupabaseSetup,
  onRunDiagnostics,
  isLoadingDiagnostics,
  diagnosticData,
  diagnosticError,
  onSeedDatabase,
  isSeedingDb,
  dbTableStats,
  seedLogs,
  onDeleteStorageFile,
}: {
  onExportJson: () => void;
  onExportCsv: () => void;
  onImportJson: (e: ChangeEvent<HTMLInputElement>) => void;
  checkpoints: any[];
  onSaveCheckpoint: () => void;
  onRestoreCheckpoint: (cp: any) => void;
  onRemoveCheckpoint: (id: string) => void;
  lanConnected: boolean;
  isLanMode: boolean;
  base64Count: number;
  onOptimizeImages: () => void;
  isOptimizing: boolean;
  optimizationProgress: string;
  onOpenSupabaseSetup: () => void;
  onRunDiagnostics: () => void;
  isLoadingDiagnostics: boolean;
  diagnosticData: any;
  diagnosticError: string | null;
  onSeedDatabase: (force: boolean) => void;
  isSeedingDb: boolean;
  dbTableStats: any;
  seedLogs: string[] | null;
  onDeleteStorageFile: (path: string) => void;
}) {
  return (
    <>
      {/* Local Backup & Restore */}
      <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <Save size={20} className="text-orange-500" /> 本地备份与恢复 (Local
          Backup)
        </h3>
        <p className="text-xs text-zinc-400 mb-4">
          您可以将当前的所有分类、菜品、背景配置下载为 JSON
          格式备份到本地设备，或导出 Excel/CSV
          菜品清单表格，也可以从本地恢复菜单。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={onExportJson}
            className="bg-zinc-900 border border-zinc-800 hover:border-orange-500 text-zinc-300 hover:text-orange-500 px-4 py-3 rounded-xl transition-colors text-sm font-semibold flex flex-col items-center justify-center gap-1.5 active:scale-95"
          >
            <DownloadCloud size={22} className="text-orange-400" />
            <span>导出 JSON 备份</span>
            <span className="text-[10px] font-normal text-zinc-500">
              (Export JSON)
            </span>
          </button>
          <button
            onClick={onExportCsv}
            className="bg-zinc-900 border border-zinc-800 hover:border-green-500 text-zinc-300 hover:text-green-500 px-4 py-3 rounded-xl transition-colors text-sm font-semibold flex flex-col items-center justify-center gap-1.5 active:scale-95"
          >
            <FileSpreadsheet size={22} className="text-green-400" />
            <span>导出 Excel / CSV</span>
            <span className="text-[10px] font-normal text-zinc-500">
              (Export Spreadsheet)
            </span>
          </button>
          <label className="bg-zinc-900 border border-zinc-800 hover:border-blue-500 text-zinc-300 hover:text-blue-500 px-4 py-3 rounded-xl transition-colors text-sm font-semibold flex flex-col items-center justify-center gap-1.5 cursor-pointer active:scale-95">
            <UploadCloud size={22} className="text-blue-400" />
            <span>从本地恢复</span>
            <span className="text-[10px] font-normal text-zinc-500">
              (Import JSON)
            </span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={onImportJson}
            />
          </label>
        </div>
      </div>

      {/* 本地重置点（快照） */}
      <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <Archive size={20} className="text-emerald-500" /> 本地重置点 / 快照
          (Restore Points)
        </h3>
        <p className="text-xs text-zinc-400 mb-4">
          每次成功保存到云端后会自动写入一个「自动重置点」。当菜单异常或数据库不可用时，可一键恢复到任意重置点，快速保证功能可用（数据存于本机，不依赖数据库）。
        </p>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <button
            onClick={onSaveCheckpoint}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl transition-colors text-sm font-semibold active:scale-95"
          >
            💾 保存当前为重置点
          </button>
          <span className="text-[11px] text-zinc-500">
            局域网订单备用通道：
            {lanConnected
              ? "已连接"
              : isLanMode
                ? "未连接"
                : "未启用（HTTPS 部署下自动禁用）"}
          </span>
        </div>
        <div className="space-y-2">
          {checkpoints.length === 0 && (
            <div className="text-xs text-zinc-500 text-center py-3">
              暂无重置点
            </div>
          )}
          {checkpoints.map((cp: any) => (
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
                  onClick={() => onRestoreCheckpoint(cp)}
                  className="text-xs bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 px-3 py-1.5 rounded-lg transition-colors"
                >
                  恢复
                </button>
                <button
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

      {/* Image Storage Optimization */}
      <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <Sparkles size={20} className="text-orange-500" /> 图片托管与空间优化
          (Image Storage Optimization)
        </h3>
        {base64Count > 0 ? (
          <div>
            <p className="text-xs text-zinc-300 mb-3">
              ⚠️ <strong>检测到您的菜单中含有本地 Base64 图片：</strong>
              <br />
              当前有{" "}
              <span className="text-orange-500 font-bold text-sm">
                {base64Count}
              </span>{" "}
              个菜品的图片以 Base64 内嵌在 Supabase settings
              设置文档中，会占用较大存储空间并拖慢同步速度。
            </p>
            <p className="text-xs text-zinc-400 mb-4">
              点击下方按钮，系统将自动把所有 Base64 格式的菜品图片上传至安全的{" "}
              <strong>Supabase Storage 云存储空间</strong>
              ，并在数据库中只保留轻量的图片网址，显著缩小设置体积。
            </p>
            <button
              onClick={onOptimizeImages}
              disabled={isOptimizing}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-orange-600/10 disabled:opacity-50"
            >
              {isOptimizing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>{optimizationProgress}</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>一键优化图片存储 (迁移至 Supabase Storage)</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-3 bg-green-500/5 border border-green-500/10 rounded-xl">
            <CheckCircle size={20} className="text-green-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-green-400 font-semibold mb-1">
                图片存储状态优良 / All Images Optimized
              </p>
              <p className="text-[11px] text-zinc-400">
                您的所有菜品图片均已托管在 Supabase Storage
                云存储或外链中，设置文档体积保持精简。
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Supabase Storage System Diagnostics Card */}
      <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Cloud size={20} className="text-orange-500 animate-pulse" />{" "}
            Supabase 云数据库与存储空间联控
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSupabaseSetup}
              className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg transition-all shadow-md shadow-emerald-600/20"
            >
              <Database size={13} />
              <span>配置 / 切换 Supabase 云端凭证</span>
            </button>

            <button
              onClick={onRunDiagnostics}
              disabled={isLoadingDiagnostics}
              className="flex items-center gap-1 text-xs bg-zinc-900 border border-zinc-700 hover:border-orange-500 hover:text-orange-400 text-zinc-300 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw
                size={12}
                className={isLoadingDiagnostics ? "animate-spin" : ""}
              />
              <span>{isLoadingDiagnostics ? "正在扫描..." : "刷新诊断"}</span>
            </button>
          </div>
        </div>

        {isLoadingDiagnostics && !diagnosticData ? (
          <div className="flex flex-col items-center justify-center py-8 text-zinc-500 gap-2">
            <Loader2 className="animate-spin text-orange-500" size={24} />
            <span className="text-xs">
              正在深度扫描云端存储桶文件并计算空间占比...
            </span>
          </div>
        ) : diagnosticError ? (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex flex-col gap-2">
            <p className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle size={14} /> 诊断异常: {diagnosticError}
            </p>
            <button
              onClick={onRunDiagnostics}
              className="bg-red-500/20 hover:bg-red-500/30 text-white font-semibold py-1.5 px-3 rounded-lg transition-colors text-center self-start"
            >
              重新连接并扫描
            </button>
          </div>
        ) : diagnosticData ? (
          <div className="space-y-4 text-xs">
            {/* Space Usage Progress */}
            <div className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/80">
              <div className="flex justify-between items-center mb-1">
                <span className="text-zinc-400 font-semibold flex items-center gap-1">
                  <HardDrive size={13} className="text-orange-500" />
                  云端存储桶 (menu-assets) 容量状态
                </span>
                <span className="text-zinc-400 font-mono">
                  {(diagnosticData.totalUsedBytes / (1024 * 1024)).toFixed(2)}{" "}
                  MB /{" "}
                  {(diagnosticData.bucketLimitBytes / (1024 * 1024)).toFixed(0)}{" "}
                  MB
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-zinc-950 border border-zinc-800 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full transition-all duration-500 ${
                    diagnosticData.totalUsedBytes /
                      diagnosticData.bucketLimitBytes >
                    0.8
                      ? "bg-red-500 animate-pulse"
                      : diagnosticData.totalUsedBytes /
                            diagnosticData.bucketLimitBytes >
                          0.5
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(0.5, (diagnosticData.totalUsedBytes / diagnosticData.bucketLimitBytes) * 100))}%`,
                  }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-zinc-500">
                <span>
                  可用空间:{" "}
                  {(
                    (diagnosticData.bucketLimitBytes -
                      diagnosticData.totalUsedBytes) /
                    (1024 * 1024)
                  ).toFixed(2)}{" "}
                  MB
                </span>
                <span>
                  已用占比:{" "}
                  {(
                    (diagnosticData.totalUsedBytes /
                      diagnosticData.bucketLimitBytes) *
                    100
                  ).toFixed(2)}
                  %
                </span>
              </div>
            </div>

            {/* Production Database Tables Status & Seed/Sync */}
            <div className="p-3.5 bg-zinc-900/80 rounded-xl border border-zinc-800">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <span className="text-zinc-200 font-semibold flex items-center gap-1.5 text-xs">
                  <Database size={14} className="text-emerald-400" />
                  生产环境数据库全表状态 (Production Database Tables)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSeedDatabase(false)}
                    disabled={isSeedingDb}
                    className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-2.5 py-1 rounded-lg transition-all text-[11px] shadow-sm shadow-emerald-600/20"
                  >
                    {isSeedingDb ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <RefreshCw size={12} />
                    )}
                    <span>一键自动补全空表</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          "确定要对 Supabase 生产环境数据库执行强制全量重置同步吗？这会刷新初始化数据。",
                        )
                      ) {
                        onSeedDatabase(true);
                      }
                    }}
                    disabled={isSeedingDb}
                    className="flex items-center gap-1 bg-amber-600/20 border border-amber-500/40 hover:bg-amber-600/30 text-amber-300 disabled:opacity-50 font-semibold px-2.5 py-1 rounded-lg transition-all text-[11px]"
                  >
                    <span>重置初始化</span>
                  </button>
                </div>
              </div>

              {dbTableStats?.tables ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                  {[
                    {
                      key: "settings",
                      label: "全局设置",
                      icon: "⚙️",
                    },
                    {
                      key: "categories",
                      label: "菜单分类",
                      icon: "📁",
                    },
                    {
                      key: "menu_items",
                      label: "菜品数据",
                      icon: "🍖",
                    },
                    { key: "tables", label: "QR餐桌", icon: "🪑" },
                    {
                      key: "orders",
                      label: "顾客订单",
                      icon: "🧾",
                    },
                  ].map((item) => {
                    const count = dbTableStats.tables[item.key] ?? -1;
                    const isEmpty = count === 0;
                    const isError = count === -1;
                    return (
                      <div
                        key={item.key}
                        className={`p-2 rounded-lg border text-left flex flex-col justify-between ${
                          isError
                            ? "bg-red-500/5 border-red-500/20 text-red-400"
                            : isEmpty
                              ? "bg-amber-500/5 border-amber-500/20 text-amber-300"
                              : "bg-zinc-950 border-zinc-800 text-zinc-300"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] text-zinc-400">
                          <span>
                            {item.icon} {item.label}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-500">
                            {item.key}
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline justify-between">
                          <span className="text-sm font-bold font-mono">
                            {isError ? "未建表" : `${count} 条`}
                          </span>
                          <span className="text-[10px]">
                            {isError
                              ? "⚠️"
                              : isEmpty
                                ? "需初始化"
                                : "正常已同步"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-3 text-center text-zinc-500 text-[11px] flex items-center justify-center gap-1.5">
                  <Loader2
                    size={13}
                    className="animate-spin text-emerald-500"
                  />
                  正在获取生产数据库各表记录数...
                </div>
              )}

              {seedLogs && seedLogs.length > 0 && (
                <div className="mt-2 p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-[11px] font-mono space-y-1 max-h-32 overflow-y-auto">
                  <div className="text-emerald-400 font-bold mb-1 flex items-center gap-1">
                    <Sparkles size={12} /> 同步/初始化结果日志:
                  </div>
                  {seedLogs.map((log, idx) => (
                    <div key={idx} className="text-zinc-300 leading-snug">
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Automatic Compression Rule Announcement */}
            <div className="p-3 bg-orange-500/5 border border-orange-500/10 rounded-xl text-zinc-400">
              <p className="font-semibold text-orange-400 mb-1 flex items-center gap-1">
                <Sparkles size={13} />
                智能大图自动压缩已生效 (High-Res Smart Compression)
              </p>
              <p className="text-[10px] leading-relaxed">
                为了保障手机端极速加载，系统已应用{" "}
                <strong>1200px 高清无损压缩算法</strong>。 上传超过 1MB
                的超大菜品图片或背景时，前端将在上传前自动将其压缩至 150KB-300KB
                的黄金平衡尺寸，在保持高清的同时节省 85% 以上的云存储桶空间！
              </p>
            </div>

            {/* File list header */}
            <div>
              <div className="flex justify-between text-zinc-400 font-semibold mb-2 items-center px-1">
                <span>云端文件列表 ({diagnosticData.files.length} 个文件)</span>
                <span className="text-zinc-500 font-normal">
                  点击垃圾桶可清理冗余/无用大图
                </span>
              </div>

              {diagnosticData.files.length === 0 ? (
                <div className="p-4 bg-zinc-900/30 rounded-xl border border-zinc-800/30 text-center text-zinc-500">
                  目前云端存储桶没有上传任何菜品大图
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {diagnosticData.files.map((file: any, idx: number) => {
                    const sizeInKB = file.size / 1024;
                    const isLarge = sizeInKB > 500;
                    const isHuge = sizeInKB > 1500;
                    return (
                      <div
                        key={idx}
                        className="p-2.5 bg-zinc-900/40 border border-zinc-800/60 hover:bg-zinc-900/70 rounded-xl flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p
                            className="font-mono text-[11px] text-zinc-300 truncate"
                            title={file.path}
                          >
                            {file.path}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-zinc-500">
                            <span>大小: </span>
                            <span
                              className={`font-mono font-semibold ${isHuge ? "text-red-500" : isLarge ? "text-amber-500" : "text-zinc-400"}`}
                            >
                              {sizeInKB > 1024
                                ? `${(sizeInKB / 1024).toFixed(2)} MB`
                                : `${sizeInKB.toFixed(1)} KB`}
                            </span>
                            {isHuge && (
                              <span className="bg-red-500/10 text-red-400 px-1 rounded text-[9px] font-bold border border-red-500/20">
                                极大
                              </span>
                            )}
                            {!isHuge && isLarge && (
                              <span className="bg-amber-500/10 text-amber-400 px-1 rounded text-[9px] font-bold border border-amber-500/20">
                                较大
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onDeleteStorageFile(file.path)}
                          className="p-1.5 hover:bg-red-500/10 hover:text-red-400 text-zinc-500 rounded-lg transition-colors shrink-0"
                          title="从云存储彻底删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-zinc-500 gap-2">
            <button
              type="button"
              onClick={onRunDiagnostics}
              className="bg-zinc-900 border border-zinc-700 hover:border-orange-500 hover:text-orange-400 text-white font-semibold py-2 px-4 rounded-xl transition-colors text-xs flex items-center gap-1.5"
            >
              <RefreshCw size={14} />
              开始存储空间诊断与扫描
            </button>
          </div>
        )}
      </div>
    </>
  );
}
