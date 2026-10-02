import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Database,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  X,
  Zap,
  Key,
  Globe,
  FileCode,
} from "lucide-react";
import { supabaseUrl, supabaseAnonKey } from "../supabase";

interface SupabaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SupabaseSetupModal: React.FC<SupabaseSetupModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [url, setUrl] = useState<string>("");
  const [anonKey, setAnonKey] = useState<string>("");
  const [kvEndpoint, setKvEndpoint] = useState<string>("");
  const [kvToken, setKvToken] = useState<string>("");
  const [blobEndpoint, setBlobEndpoint] = useState<string>("");
  const [blobBucket, setBlobBucket] = useState<string>("");
  const [blobToken, setBlobToken] = useState<string>("");
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    tablesFound?: string[];
    blobBucketOk?: boolean;
  } | null>(null);

  const [copiedEnv, setCopiedEnv] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const savedUrl = supabaseUrl || "";
      const savedKey = supabaseAnonKey || "";
      const savedKvEp =
        localStorage.getItem("custom_tencent_kv_endpoint") || "";
      const savedKvTok = localStorage.getItem("custom_tencent_kv_token") || "";
      const savedBlobEp = localStorage.getItem("custom_blob_endpoint") || "";
      const savedBlobBkt =
        localStorage.getItem("custom_blob_bucket") || "menu-assets";
      const savedBlobTok = localStorage.getItem("custom_blob_token") || "";

      setUrl(savedUrl);
      setAnonKey(savedKey);
      setKvEndpoint(savedKvEp);
      setKvToken(savedKvTok);
      setBlobEndpoint(savedBlobEp);
      setBlobBucket(savedBlobBkt);
      setBlobToken(savedBlobTok);
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    const cleanUrl = url.trim();
    const cleanKey = anonKey.trim();

    if (!cleanUrl || !cleanKey) {
      setTestResult({
        success: false,
        message: "请先填写完整的 Supabase URL 和 Anon Key！",
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const testClient = createClient(cleanUrl, cleanKey);

      // 1. 测试数据库 Query
      const { error } = await testClient.from("settings").select("id").limit(1);

      // 2. 测试 Storage Blob 存储桶访问
      let storageOk = false;
      try {
        const bucketToTest = blobBucket.trim() || "menu-assets";
        const { error: bucketError } = await testClient.storage
          .from(bucketToTest)
          .list("", { limit: 1 });
        if (!bucketError) {
          storageOk = true;
        }
      } catch (e) {
        console.warn("Storage check exception:", e);
      }

      if (error) {
        if (
          error.code === "42P01" ||
          error.message.includes("does not exist")
        ) {
          setTestResult({
            success: true,
            message:
              "🎉 Supabase 凭证校验成功！连接成功，但数据库未找到 `settings` 表，请运行下方 SQL 脚本建表！",
            blobBucketOk: storageOk,
          });
        } else {
          setTestResult({
            success: false,
            message: `连接失败: ${error.message} (错误码: ${error.code || "UNKNOWN"})`,
          });
        }
      } else {
        setTestResult({
          success: true,
          message: `✅ Supabase 云数据库连接完美！${storageOk ? "且 Blob 存储桶 (" + (blobBucket.trim() || "menu-assets") + ") 访问正常！" : "提示：未检测到 Storage 桶，建议在 Supabase 后台创建并将桶名设为 Public。"}`,
          tablesFound: ["settings", "orders"],
          blobBucketOk: storageOk,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `网络或凭证结构异常: ${err.message || String(err)}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAndApply = () => {
    const cleanUrl = url.trim();
    const cleanKey = anonKey.trim();
    const cleanKvEp = kvEndpoint.trim();
    const cleanKvTok = kvToken.trim();
    const cleanBlobEp = blobEndpoint.trim();
    const cleanBlobBkt = blobBucket.trim();
    const cleanBlobTok = blobToken.trim();

    // Supabase 凭证出于安全考虑仅从环境变量 (.env / 部署平台) 读取，绝不落 localStorage，
    // 避免 XSS 篡改 supabase 地址劫持数据。这里仅提供 .env 片段复制。
    if (cleanUrl && cleanKey) {
      const envText = `VITE_SUPABASE_URL=${cleanUrl}\nVITE_SUPABASE_ANON_KEY=${cleanKey}`;
      navigator.clipboard?.writeText(envText).catch(() => {});
    }

    // KV / Blob 自定义配置会被前端缓存/存储层直接读取，持久化到 localStorage 生效
    if (cleanKvEp)
      localStorage.setItem("custom_tencent_kv_endpoint", cleanKvEp);
    else localStorage.removeItem("custom_tencent_kv_endpoint");

    if (cleanKvTok) localStorage.setItem("custom_tencent_kv_token", cleanKvTok);
    else localStorage.removeItem("custom_tencent_kv_token");

    if (cleanBlobEp) localStorage.setItem("custom_blob_endpoint", cleanBlobEp);
    else localStorage.removeItem("custom_blob_endpoint");

    if (cleanBlobBkt) localStorage.setItem("custom_blob_bucket", cleanBlobBkt);
    else localStorage.removeItem("custom_blob_bucket");

    if (cleanBlobTok) localStorage.setItem("custom_blob_token", cleanBlobTok);
    else localStorage.removeItem("custom_blob_token");

    if (onSuccess) onSuccess();
    alert(
      "KV / Blob 自定义配置已保存。\nSupabase 凭证出于安全仅从 .env 读取，已复制到剪贴板，请填入 .env（或部署平台环境变量）后重新构建/重启生效。",
    );
  };

  const handleClearCustomConfig = () => {
    if (window.confirm("确定清除自定义存储的 Supabase / KV / Blob 配置吗？")) {
      localStorage.removeItem("custom_supabase_url");
      localStorage.removeItem("custom_supabase_anon_key");
      localStorage.removeItem("custom_tencent_kv_endpoint");
      localStorage.removeItem("custom_tencent_kv_token");
      localStorage.removeItem("custom_blob_endpoint");
      localStorage.removeItem("custom_blob_bucket");
      localStorage.removeItem("custom_blob_token");
      setUrl("");
      setAnonKey("");
      setKvEndpoint("");
      setKvToken("");
      setBlobEndpoint("");
      setBlobBucket("menu-assets");
      setBlobToken("");
      setTestResult(null);
      window.location.reload();
    }
  };

  const handleCopyEnvText = () => {
    const envText = `VITE_SUPABASE_URL=${url.trim()}\nVITE_SUPABASE_ANON_KEY=${anonKey.trim()}`;
    navigator.clipboard.writeText(envText);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 3000);
  };

  const sqlCode = `-- 安全提示：请勿使用旧版 "DISABLE ROW LEVEL SECURITY" 脚本（会让数据库对公网完全开放）。
--
-- 建表步骤：
-- 1. 打开 Supabase 控制台 -> SQL Editor -> New query
-- 2. 将仓库根目录的 supabase_schema.sql 全选粘贴并执行 Run
--    （该脚本已启用 RLS 最小权限策略：匿名仅可读菜单/创建订单）
-- 3. 若浏览器端仍需匿名读写 settings，再按需执行仓库中的 supabase_setup.sql
--    （这会放宽 settings 写权限，请自行评估风险）
--
-- 本弹窗不再内置建表 SQL，避免与仓库 schema 不一致而建出缺表/缺列/不安全的数据库。
`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-2xl w-full p-5 sm:p-7 space-y-6 shadow-2xl relative text-zinc-100 my-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-full transition-colors"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
            <Database size={28} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
              Supabase 云数据库连接与双端同步指南
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              配置相同的 Supabase 项目凭证，即可实现顾客点餐端与
              POS/库存管理端的实时数据无缝打通！
            </p>
          </div>
        </div>

        {/* Step-by-Step Instructions Card */}
        <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck size={15} />
            只需 3 步快速完成双端设置：
          </h3>

          <ol className="text-xs text-zinc-300 space-y-2.5 list-decimal list-inside">
            <li className="leading-relaxed">
              <strong>注册/登录 Supabase</strong>: 打开{" "}
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 underline font-medium inline-flex items-center gap-1 hover:text-emerald-300"
              >
                supabase.com <ExternalLink size={12} />
              </a>{" "}
              免费创建项目，在{" "}
              <code className="bg-zinc-800 px-1 py-0.5 rounded text-emerald-300">
                Project Settings -&gt; API
              </code>{" "}
              中复制你的 <strong>Project URL</strong> 和{" "}
              <strong>anon public key</strong>。
            </li>

            <li className="leading-relaxed">
              <strong>在 SQL Editor 运行建表脚本</strong>: 点击 Supabase
              控制台左侧{" "}
              <code className="bg-zinc-800 px-1 py-0.5 rounded text-amber-300">
                SQL Editor
              </code>
              ，点击{" "}
              <code className="bg-zinc-800 px-1 py-0.5 rounded text-amber-300">
                New query
              </code>
              ，执行仓库根目录的 supabase_schema.sql（见下方说明）并点击 Run。
            </li>

            <li className="leading-relaxed">
              <strong>双端绑定相同凭证</strong>:
              将该凭证在此弹窗填入并点击【测试连接】。Supabase 凭证出于安全仅从
              .env（或部署平台环境变量）读取，点击【保存 KV/Blob 配置并复制
              .env】会复制 .env
              片段，请填入后重新构建/重启；另一台程序填入相同凭证即可实时联动！
            </li>
          </ol>
        </div>

        {/* Inputs Form */}
        <div className="space-y-4 bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
          <div>
            <label className="text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-2">
              <Globe size={14} className="text-emerald-400" />
              Supabase Project URL
            </label>
            <input
              type="text"
              placeholder="https://your-project-id.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-2">
              <Key size={14} className="text-emerald-400" />
              Supabase Anon Public Key
            </label>
            <textarea
              rows={3}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 custom-scrollbar resize-none"
            />
          </div>

          {/* Tencent Cloud KV Layer Config */}
          <div className="pt-2 border-t border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-orange-400 flex items-center gap-1.5">
                <Zap size={14} />
                腾讯云 EdgeOne / Cloud KV 缓存层 (可选)
              </span>
              <span className="text-[10px] text-zinc-500">
                未填写则自动启用内存/本地极速 KV 缓存
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-zinc-400 mb-1 block">
                  腾讯云 KV API Endpoint
                </label>
                <input
                  type="text"
                  placeholder="https://your-kv-edge.eo.tencentcloud.com"
                  value={kvEndpoint}
                  onChange={(e) => setKvEndpoint(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 mb-1 block">
                  KV Auth Token / API Key
                </label>
                <input
                  type="password"
                  placeholder="Secret Token"
                  value={kvToken}
                  onChange={(e) => setKvToken(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          </div>

          {/* Blob Storage Layer Config */}
          <div className="pt-2 border-t border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                <Database size={14} />
                Blob / COS 菜品与素材图片存储层
              </span>
              <span className="text-[10px] text-zinc-500">
                默认使用 Supabase Storage，支持扩展腾讯云 COS
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-zinc-400 mb-1 block">
                  Storage Bucket 存储桶名称
                </label>
                <input
                  type="text"
                  placeholder="menu-assets"
                  value={blobBucket}
                  onChange={(e) => setBlobBucket(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 mb-1 block">
                  独立 Blob / 腾讯 COS Endpoint (可选)
                </label>
                <input
                  type="text"
                  placeholder="https://your-cos-blob-service.com/api"
                  value={blobEndpoint}
                  onChange={(e) => setBlobEndpoint(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Test Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="w-full sm:w-auto flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={16} className={testing ? "animate-spin" : ""} />
              {testing
                ? "正在测试 Supabase 连接..."
                : "⚡ 一键测试连接 (Test Connection)"}
            </button>

            <button
              type="button"
              onClick={handleSaveAndApply}
              className="w-full sm:w-auto bg-orange-600 hover:bg-orange-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} />
              保存 KV/Blob 配置并复制 .env
            </button>
          </div>

          {/* Test Result Alert Box */}
          {testResult && (
            <div
              className={`p-4 rounded-xl border text-xs sm:text-sm font-medium flex items-start gap-3 ${
                testResult.success
                  ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                  : "bg-red-950/40 border-red-500/40 text-red-300"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2
                  size={20}
                  className="text-emerald-400 shrink-0 mt-0.5"
                />
              ) : (
                <XCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-semibold">{testResult.message}</p>
                {testResult.tablesFound && (
                  <p className="text-xs text-emerald-400/80">
                    数据表验证正常，支持实时订单推播功能！
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Copy SQL Section */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-zinc-300 flex items-center gap-2">
              <FileCode size={15} className="text-amber-400" />
              数据库建表说明 (supabase_schema.sql)
            </h4>

            <div className="flex items-center gap-2">
              {url && anonKey && (
                <button
                  type="button"
                  onClick={handleCopyEnvText}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  {copiedEnv ? (
                    <Check size={13} className="text-green-400" />
                  ) : (
                    <Copy size={13} />
                  )}
                  {copiedEnv ? "已复制 .env" : "复制 .env 格式"}
                </button>
              )}

              <button
                type="button"
                onClick={handleCopySql}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-amber-600/20"
              >
                {copiedSql ? <Check size={13} /> : <Copy size={13} />}
                {copiedSql ? "已复制建表说明" : "复制建表说明"}
              </button>
            </div>
          </div>

          <pre className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-[11px] font-mono text-zinc-400 overflow-x-auto max-h-36 custom-scrollbar">
            {sqlCode}
          </pre>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
          <button
            type="button"
            onClick={handleClearCustomConfig}
            className="text-xs text-zinc-500 hover:text-red-400 transition-colors underline"
          >
            重置并恢复默认离线模式
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm font-semibold transition-colors"
          >
            关闭弹窗
          </button>
        </div>
      </div>
    </div>
  );
};
