import { useEffect, useMemo, useState } from "react";
import { Sparkles, Send, Copy } from "lucide-react";
import { ChartCard, SkeletonRows } from "../components/ui";
import { Dictation } from "../components/Dictation";
import { toast } from "../components/Toast";
import { STORE_NAME } from "../lib/supabase";
import { rangeToIso, salesSummary, dishStats } from "../lib/aggregate";
import { fetchBoms, fetchInventory } from "../lib/inventory";
import { dishMargins, sumCost } from "../lib/cost";
import { buildProblems, topProblem } from "../lib/problems";
import { stocktakeDue } from "../lib/stocktakeReminder";
import { lateOrders, loadLateConfig } from "../lib/lateOrders";
import { useOpsSignals } from "../lib/useOpsSignals";
import { buildDailyBrief } from "../lib/brief";
import { ask, PRESET_QUESTIONS, llmSystemPrompt } from "../lib/assistant";
import { chatLLM, hasLlm } from "../lib/llm";
import { actionDraft } from "../lib/actionDraft";

export default function Assistant({
  recentOrders,
  settings,
  version = 0,
}: {
  recentOrders: any[];
  settings: any;
  version?: number;
}) {
  const ops = useOpsSignals(version);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [aiAnswer, setAiAnswer] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [draft, setDraft] = useState<string[] | null>(null);
  const [summary, setSummary] = useState({ revenue: 0, orders: 0, cogs: 0 });
  const [topDish, setTopDish] = useState<{ name: string; qty: number } | null>(
    null,
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const b = rangeToIso("today");
      const [sum, ds, boms, inv] = await Promise.all([
        salesSummary(b.start, b.end),
        dishStats(b.start, b.end),
        fetchBoms(),
        fetchInventory(),
      ]);
      if (!alive) return;
      setSummary({
        revenue: sum.revenue,
        orders: sum.orders,
        cogs: sumCost(dishMargins(ds, boms, inv)),
      });
      const top = [...ds].sort((a, c) => c.qty - a.qty)[0];
      setTopDish(top ? { name: top.name, qty: top.qty } : null);
    })();
    return () => {
      alive = false;
    };
  }, [version]);

  const late = useMemo(
    () => lateOrders(recentOrders, loadLateConfig(), Date.now()),
    [recentOrders],
  );
  const problems = useMemo(
    () =>
      buildProblems({
        priceAlerts: ops.alerts,
        low: ops.low,
        todayWaste: ops.todayWaste,
        late,
        stocktakeDue: stocktakeDue(),
      }),
    [ops, late],
  );

  const data = useMemo(() => {
    const aov = summary.orders ? summary.revenue / summary.orders : 0;
    const rate = summary.revenue ? (summary.cogs / summary.revenue) * 100 : 0;
    return {
      revenue: summary.revenue,
      orders: summary.orders,
      aov,
      foodCost: summary.cogs,
      foodCostRate: rate,
      waste: ops.todayWaste,
      profit: summary.revenue - summary.cogs,
      topProblem: topProblem(problems)?.title ?? null,
    };
  }, [summary, ops.todayWaste, problems]);
  const topP = topProblem(problems);

  const storeName = settings?.restaurantName || STORE_NAME;
  const brief = useMemo(
    () =>
      buildDailyBrief({
        storeName,
        dateLabel: "今天",
        revenue: data.revenue,
        orders: data.orders,
        aov: data.aov,
        foodCost: data.foodCost,
        foodCostRate: data.foodCostRate,
        waste: data.waste,
        topProblem: data.topProblem,
        topDish,
      }),
    [storeName, data, topDish],
  );

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || thinking) return;
    setQ("");
    setAnswer(null);
    setAiAnswer(false);
    if (hasLlm()) {
      setThinking(true);
      const reply = await chatLLM(llmSystemPrompt(data, brief), t);
      setThinking(false);
      if (reply) {
        setAnswer(reply);
        setAiAnswer(true);
        return;
      }
      toast.info("AI 暂不可用，已用规则版回答");
    }
    setAnswer(ask(t, data));
  };

  const copyBrief = () => {
    const text = brief.join("\n");
    try {
      navigator.clipboard?.writeText(text).then(
        () => toast.success("简报已复制"),
        () => toast.error("复制失败"),
      );
    } catch {
      toast.error("复制失败");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <ChartCard
        title="每日简报"
        subtitle="模板 + 真实数据自动生成"
        action={
          <button
            onClick={copyBrief}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            <Copy size={13} /> 复制
          </button>
        }
      >
        <div className="rounded-xl bg-zinc-950 px-4 py-3.5 space-y-2">
          {brief.map((line, i) => (
            <p key={i} className="text-sm text-zinc-300 leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      </ChartCard>

      <ChartCard
        title="经营问答"
        subtitle="先问这几个常见问题"
        action={<Sparkles size={18} className="text-orange-500" />}
      >
        {!ops.ready ? (
          <SkeletonRows rows={2} />
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_QUESTIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-zinc-950 border border-white/5 text-zinc-300 hover:border-orange-500/40 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send(q)}
                  placeholder="问我经营相关的问题…"
                  className="w-full bg-zinc-950 border border-white/5 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                />
                <Dictation
                  value={q}
                  onChange={setQ}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5"
                />
              </div>
              <button
                onClick={() => send(q)}
                disabled={thinking}
                className="shrink-0 w-10 h-10 rounded-xl btn-brand text-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </div>
            {thinking && (
              <div className="mt-3 rounded-xl bg-zinc-950 border border-white/5 px-3.5 py-3 text-sm text-zinc-400 animate-pulse">
                AI 思考中…
              </div>
            )}
            {answer && (
              <div className="mt-3 rounded-xl bg-orange-500/5 border border-orange-500/20 px-3.5 py-3 text-sm text-zinc-200 leading-relaxed">
                <span
                  className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mb-1.5 ${
                    aiAnswer
                      ? "bg-orange-500 text-white"
                      : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {aiAnswer ? "AI" : "规则版"}
                </span>
                <div className="whitespace-pre-wrap">{answer}</div>
              </div>
            )}
          </>
        )}
      </ChartCard>

      {topP && (
        <ChartCard title="执行草稿" subtitle="基于当前最大问题自动生成操作步骤">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-zinc-300 truncate">{topP.title}</span>
            <button
              onClick={() => setDraft(actionDraft(topP.kind))}
              className="shrink-0 px-3 py-2 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 active:scale-95 transition-transform"
            >
              生成步骤
            </button>
          </div>
          {draft && (
            <ol className="mt-3 space-y-1.5">
              {draft.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-zinc-200">
                  <span className="text-orange-400 font-bold shrink-0">
                    {i + 1}.
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          )}
        </ChartCard>
      )}
    </div>
  );
}
