import { Key, CircleDollarSign } from "lucide-react";

export function ToolsTab({
  apiKey,
  onApiKeyChange,
  onGlobalCurrencyChange,
}: {
  apiKey: string;
  onApiKeyChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGlobalCurrencyChange: (currency: string) => void;
}) {
  return (
    <>
      {/* API Settings */}
      <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <Key size={20} className="text-orange-500" /> API 设置 (用于 AI 翻译 /
          完善图片)
        </h3>
        <input
          type="password"
          value={apiKey}
          onChange={onApiKeyChange}
          placeholder="在此输入您的 Gemini API Key"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
        />
        <p className="text-[10px] text-zinc-500 mt-2">
          API Key 仅本地保存在您的浏览器中。用于一键进行多语言翻译和 AI
          图片美化增强功能。
        </p>
      </div>

      {/* Currency Settings */}
      <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <CircleDollarSign size={20} className="text-orange-500" />{" "}
            全局货币单位 / Global Currency
          </h3>
          <p className="text-xs text-zinc-400">
            一键替换所有菜品价格显示的货币符号。(注意：不会转换汇率数值)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onGlobalCurrencyChange("MAD")}
            className="bg-zinc-800 hover:bg-orange-600 text-white text-xs font-bold rounded-lg px-3 py-2 transition-colors border border-zinc-700 hover:border-orange-500"
          >
            设为 MAD 迪拉姆
          </button>
          <button
            type="button"
            onClick={() => onGlobalCurrencyChange("¥")}
            className="bg-zinc-800 hover:bg-orange-600 text-white text-xs font-bold rounded-lg px-3 py-2 transition-colors border border-zinc-700 hover:border-orange-500"
          >
            设为 CNY 人民币
          </button>
          <button
            type="button"
            onClick={() => onGlobalCurrencyChange("€")}
            className="bg-zinc-800 hover:bg-orange-600 text-white text-xs font-bold rounded-lg px-3 py-2 transition-colors border border-zinc-700 hover:border-orange-500"
          >
            设为 EUR 欧元
          </button>
          <button
            type="button"
            onClick={() => onGlobalCurrencyChange("$")}
            className="bg-zinc-800 hover:bg-orange-600 text-white text-xs font-bold rounded-lg px-3 py-2 transition-colors border border-zinc-700 hover:border-orange-500"
          >
            设为 USD 美元
          </button>
        </div>
      </div>
    </>
  );
}
