import { useState } from "react";
import { Sparkles, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { ChartCard } from "../../components/ui";
import { toast } from "../../components/Toast";
import {
  getLlmConfig,
  setLlmConfig,
  testLlmEndpoints,
  newLlmEndpointId,
  isLlmEndpointComplete,
  LLM_MAX_ENDPOINTS,
  type LlmConfig,
  type LlmEndpoint,
  type LlmProbe,
} from "../../lib/llm";
import { logAction } from "../../lib/auditLog";

const AI_INPUT_CLS =
  "w-full mt-1 bg-zinc-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500";

/** AI 接口调度（可选）：多接口容灾配置，Key 只存本机 */
export default function LlmCard() {
  const [llm, setLlm] = useState<LlmConfig>(() => getLlmConfig());
  const [showKey, setShowKey] = useState<Set<string>>(() => new Set());
  const [probes, setProbes] = useState<Record<string, LlmProbe>>({});
  const [testingLlm, setTestingLlm] = useState(false);

  const patchEndpoint = (id: string, patch: Partial<LlmEndpoint>) => {
    setLlm((prev) => ({
      endpoints: prev.endpoints.map((endpoint) =>
        endpoint.id === id ? { ...endpoint, ...patch } : endpoint,
      ),
    }));
    if ("baseUrl" in patch || "apiKey" in patch || "model" in patch) {
      setProbes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const addEndpoint = () => {
    setLlm((prev) => {
      if (prev.endpoints.length >= LLM_MAX_ENDPOINTS) return prev;
      return {
        endpoints: [
          ...prev.endpoints,
          {
            id: newLlmEndpointId(),
            name: `接口 ${prev.endpoints.length + 1}`,
            baseUrl: "",
            apiKey: "",
            model: "",
            enabled: true,
          },
        ],
      };
    });
  };

  const removeEndpoint = (id: string) => {
    setLlm((prev) => ({
      endpoints: prev.endpoints.filter((endpoint) => endpoint.id !== id),
    }));
    setProbes((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const toggleReveal = (id: string) => {
    setShowKey((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const prepareEndpoints = (): LlmEndpoint[] | null => {
    const partial = llm.endpoints.find((endpoint) => {
      if (!endpoint.enabled) return false;
      const filled = [endpoint.baseUrl, endpoint.apiKey, endpoint.model].filter(
        (value) => value.trim(),
      ).length;
      return filled > 0 && filled < 3;
    });
    if (partial) {
      toast.error(
        `「${partial.name || "未命名接口"}」的 Base URL、API Key、模型需填写完整`,
      );
      return null;
    }
    return llm.endpoints.slice(0, LLM_MAX_ENDPOINTS).map((endpoint, index) => ({
      ...endpoint,
      name: endpoint.name.trim() || `接口 ${index + 1}`,
      baseUrl: endpoint.baseUrl.trim().replace(/\/+$/, ""),
      apiKey: endpoint.apiKey.trim(),
      model: endpoint.model.trim(),
    }));
  };

  const saveLlm = () => {
    const endpoints = prepareEndpoints();
    if (!endpoints) return;
    const next = setLlmConfig({ endpoints });
    setLlm(next);
    setProbes({});
    logAction(
      "保存 AI 调度配置",
      endpoints.length ? `${endpoints.length} 个接口` : "已清空",
    );
    toast.success(
      endpoints.length
        ? `已保存 ${endpoints.length} 个接口（仅本机）`
        : "已清空 AI 配置",
    );
  };

  const checkLlm = async () => {
    const endpoints = prepareEndpoints();
    if (!endpoints) return;
    if (!endpoints.some(isLlmEndpointComplete)) {
      return toast.error("请先填写至少一个完整接口");
    }
    setLlmConfig({ endpoints });
    setLlm(getLlmConfig());
    setTestingLlm(true);
    setProbes({});
    try {
      const report = await testLlmEndpoints();
      setProbes(
        Object.fromEntries(report.results.map((result) => [result.id, result])),
      );
      report.ok ? toast.success(report.msg) : toast.error(report.msg);
    } finally {
      setTestingLlm(false);
    }
  };

  return (
    <ChartCard
      id="set-ai"
      title="AI 接口调度（可选）"
      subtitle="多个 OpenAI 兼容接口 · 失败自动切换 · 票据识别需 vision 模型"
      action={<Sparkles size={18} className="text-orange-500" />}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="max-w-md text-[11px] leading-relaxed text-zinc-500">
          优先尝试新接口，之后选择失败少、延迟低的接口；请求失败立即切换下一个，异常接口短暂冷却。
        </p>
        <button
          type="button"
          onClick={addEndpoint}
          disabled={llm.endpoints.length >= LLM_MAX_ENDPOINTS}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={13} />
          添加接口
        </button>
      </div>

      {llm.endpoints.length ? (
        <div className="mt-3 space-y-3">
          {llm.endpoints.map((endpoint, index) => {
            const probe = probes[endpoint.id];
            const statusClass = !endpoint.enabled
              ? "bg-zinc-600"
              : probe
                ? probe.ok
                  ? "bg-green-400"
                  : "bg-red-400"
                : "bg-zinc-500";
            return (
              <div
                key={endpoint.id}
                className="rounded-xl border border-white/5 bg-zinc-950/70 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${statusClass}`}
                  />
                  <input
                    value={endpoint.name}
                    onChange={(e) =>
                      patchEndpoint(endpoint.id, { name: e.target.value })
                    }
                    maxLength={40}
                    placeholder={`接口 ${index + 1}`}
                    aria-label="接口名称"
                    className="min-w-0 flex-1 !border-0 !bg-transparent text-sm font-semibold text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
                  />
                  <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-zinc-400">
                    <input
                      type="checkbox"
                      checked={endpoint.enabled}
                      onChange={(e) =>
                        patchEndpoint(endpoint.id, {
                          enabled: e.target.checked,
                        })
                      }
                      className="h-3.5 w-3.5 accent-orange-500"
                    />
                    启用
                  </label>
                  <button
                    type="button"
                    onClick={() => removeEndpoint(endpoint.id)}
                    aria-label="移除接口"
                    className="shrink-0 rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <label className="mt-2 block text-[11px] text-zinc-500">
                  Base URL（到 /v1 为止）
                  <input
                    value={endpoint.baseUrl}
                    onChange={(e) =>
                      patchEndpoint(endpoint.id, {
                        baseUrl: e.target.value,
                      })
                    }
                    placeholder="https://api.deepseek.com/v1"
                    className={AI_INPUT_CLS}
                  />
                </label>

                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="block text-[11px] text-zinc-500">
                    API Key
                    <div className="relative">
                      <input
                        type={showKey.has(endpoint.id) ? "text" : "password"}
                        value={endpoint.apiKey}
                        onChange={(e) =>
                          patchEndpoint(endpoint.id, {
                            apiKey: e.target.value,
                          })
                        }
                        placeholder="sk-…"
                        className={`${AI_INPUT_CLS} pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => toggleReveal(endpoint.id)}
                        aria-label="显示或隐藏 Key"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300"
                      >
                        {showKey.has(endpoint.id) ? (
                          <EyeOff size={15} />
                        ) : (
                          <Eye size={15} />
                        )}
                      </button>
                    </div>
                  </label>
                  <label className="block text-[11px] text-zinc-500">
                    模型名
                    <input
                      value={endpoint.model}
                      onChange={(e) =>
                        patchEndpoint(endpoint.id, {
                          model: e.target.value,
                        })
                      }
                      placeholder="deepseek-chat"
                      className={AI_INPUT_CLS}
                    />
                  </label>
                </div>

                {probe && (
                  <div
                    className={`mt-2 text-[11px] ${
                      probe.ok ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {probe.msg}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-white/10 bg-zinc-950/60 px-4 py-6 text-center">
          <p className="text-sm text-zinc-300">还没有 AI 接口</p>
          <p className="mt-1 text-[11px] text-zinc-500">
            添加多个接口后，识别和问答会自动选择可用线路。
          </p>
          <button
            type="button"
            onClick={addEndpoint}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-700"
          >
            <Plus size={14} />
            添加第一个接口
          </button>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={saveLlm}
          disabled={testingLlm}
          className="flex-1 py-2.5 rounded-xl btn-brand text-white text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          保存配置
        </button>
        <button
          onClick={checkLlm}
          disabled={testingLlm || !llm.endpoints.length}
          className="flex-1 py-2.5 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {testingLlm ? "测试中…" : "测试全部"}
        </button>
      </div>
      <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
        Key 只存本机浏览器，不上传、不随备份导出；请求由浏览器直连各接口。
        票据识别需要模型支持图片输入（vision），且接口需允许浏览器跨域访问。
        Gemini 兼容地址为
        https://generativelanguage.googleapis.com/v1beta/openai 。
      </p>
    </ChartCard>
  );
}
