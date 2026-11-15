import { useEffect, useMemo, useState } from "react";
import { Sparkles, Send, Copy } from "lucide-react";
import { ChartCard } from "../components/ui";
import { Dictation } from "../components/Dictation";
import { toast } from "../components/Toast";
import { STORE_NAME } from "../lib/supabase";
import {
  rangeToIso,
  salesSummary,
  dishStats,
  costSummary,
} from "../lib/aggregate";
import { fetchBoms, fetchInventory, lowStockItems } from "../lib/inventory";
import { dishMargins, sumCost } from "../lib/cost";
import { buildProblems, topProblem } from "../lib/problems";
import { stocktakeDue } from "../lib/stocktakeReminder";
import { lateOrders, loadLateConfig } from "../lib/lateOrders";
import { todayKey } from "../lib/businessDay";
import {
  fetchPurchaseRequests,
  fetchStaffTasks,
  fetchStocktakeTasks,
  isOverdue,
} from "../lib/staffOps";
import { useOpsSignals } from "../lib/useOpsSignals";
import { buildDailyBrief } from "../lib/brief";
import {
  buildAdvice,
  advisorPrompt,
  AREA_LABEL,
  type AdviceItem,
} from "../lib/advisor";
import { type OpsFacts } from "../lib/assistant";
import {
  loadBusinessSnapshot,
  buildChatSystemPrompt,
  buildChatUserMessage,
  answerWithoutLlm,
  type BusinessSnapshot,
  type ChatTurn,
} from "../lib/aiContext";
import { chatLLM, hasLlm } from "../lib/llm";
import { actionDraft } from "../lib/actionDraft";

const CHAT_SUGGESTIONS = [
  "今天最该先处理什么？",
  "菜单上哪些菜该调整？",
  "哪些原料快没货或快过期？",
  "近 7 天损耗正常吗？",
  "采购价有异常吗？",
  "员工任务完成得怎么样？",
];

export default function Assistant({
  recentOrders,
  settings,
  version = 0,
  onTab,
}: {
  recentOrders: any[];
  settings: any;
  version?: number;
  onTab?: (tab: any) => void;
}) {
  const ops = useOpsSignals(version);
  const [q, setQ] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string; source?: "ai" | "rule" }[]
  >([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [snapshot, setSnapshot] = useState<BusinessSnapshot | null>(null);
  const [draft, setDraft] = useState<string[] | null>(null);
  const [advice, setAdvice] = useState<
    | { source: "rule"; items: AdviceItem[] }
    | { source: "ai"; text: string }
    | null
  >(null);
  const [advBusy, setAdvBusy] = useState(false);
  const [summary, setSummary] = useState({ revenue: 0, orders: 0, cogs: 0 });
  const [topDish, setTopDish] = useState<{ name: string; qty: number } | null>(
    null,
  );
  /** 员工协同事实（任务/盘点/申报） */
  const [staffFacts, setStaffFacts] = useState({
    pendingTasks: 0,
    overdueTasks: 0,
    pendingStocktakes: 0,
    pendingRequests: 0,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const b = rangeToIso("today");
      const [sum, ds, boms, inv, cs, tasks, stk, prs] = await Promise.all([
        salesSummary(b.start, b.end),
        dishStats(b.start, b.end),
        fetchBoms(),
        fetchInventory(),
        costSummary(b.start, b.end),
        fetchStaffTasks(),
        fetchStocktakeTasks(todayKey()),
        fetchPurchaseRequests(),
      ]);
      if (!alive) return;
      setSummary({
        revenue: sum.revenue,
        orders: sum.orders,
        cogs: cs ? cs.cogs : sumCost(dishMargins(ds, boms, inv)),
      });
      const top = [...ds].sort((a, c) => c.qty - a.qty)[0];
      setTopDish(top ? { name: top.name, qty: top.qty } : null);
      const pending = tasks.filter((t) => t.status === "pending");
      setStaffFacts({
        pendingTasks: pending.length,
        overdueTasks: pending.filter((t) => isOverdue(t.due_at)).length,
        pendingStocktakes: stk.filter(
          (s) => s.status === "pending" || s.status === "drafted",
        ).length,
        pendingRequests: prs.filter((r) => r.status === "pending").length,
      });
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

  // 全店经营快照：对话助手的上下文（随数据版本刷新）
  useEffect(() => {
    let alive = true;
    void loadBusinessSnapshot().then((s) => {
      if (alive) setSnapshot(s);
    });
    return () => {
      alive = false;
    };
  }, [version]);

  /** 库存/采购/员工事实，供规则问答、简报和 LLM 上下文共用 */
  const opsFacts = useMemo<OpsFacts>(() => {
    const low = lowStockItems(ops.low)
      .map((i) => ({
        name: i.name,
        stock: Number(i.stock) || 0,
        unit: i.unit,
        safety: Number(i.safety_stock) || 0,
      }))
      .sort((a, b) => a.stock - a.safety - (b.stock - b.safety));
    return {
      lowStock: low,
      priceAlerts: ops.alerts
        .filter((a) => a.changePct > 0)
        .map((a) => ({ name: a.itemName, pct: a.changePct * 100 }))
        .sort((a, b) => b.pct - a.pct),
      ...staffFacts,
    };
  }, [ops.low, ops.alerts, staffFacts]);

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
      ops: opsFacts,
    };
  }, [summary, ops.todayWaste, problems, opsFacts]);
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
        ops: {
          lowCount: opsFacts.lowStock.length,
          lowNames: opsFacts.lowStock.slice(0, 3).map((i) => i.name),
          pendingRequests: staffFacts.pendingRequests,
          pendingTasks: staffFacts.pendingTasks,
          overdueTasks: staffFacts.overdueTasks,
        },
      }),
    [storeName, data, topDish, opsFacts, staffFacts],
  );

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || chatBusy) return;
    const history: ChatTurn[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    setQ("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setChatBusy(true);

    let snap = snapshot;
    if (!snap) {
      snap = await loadBusinessSnapshot();
      setSnapshot(snap);
    }

    if (hasLlm()) {
      const reply = await chatLLM(
        buildChatSystemPrompt(snap),
        buildChatUserMessage(history, question),
      );
      if (reply) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: reply, source: "ai" },
        ]);
        setChatBusy(false);
        return;
      }
      toast.info("AI 暂不可用，已用规则版回答");
    }

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: answerWithoutLlm(snap, question),
        source: "rule",
      },
    ]);
    setChatBusy(false);
  };

  const clearChat = () => setMessages([]);

  const copyMessage = (content: string) => {
    try {
      navigator.clipboard?.writeText(content).then(
        () => toast.success("已复制"),
        () => toast.error("复制失败"),
      );
    } catch {
      toast.error("复制失败");
    }
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

  /** 生成经营顾问建议：优先 AI，失败/未配置用规则版 */
  const runAdvice = async () => {
    if (advBusy) return;
    setAdvBusy(true);
    let snap = snapshot;
    if (!snap) {
      snap = await loadBusinessSnapshot();
      setSnapshot(snap);
    }
    if (hasLlm()) {
      const { system, user } = advisorPrompt(snap);
      const reply = await chatLLM(system, user);
      if (reply) {
        setAdvice({ source: "ai", text: reply });
        setAdvBusy(false);
        return;
      }
      toast.info("AI 暂不可用，已用规则版建议");
    }
    setAdvice({ source: "rule", items: buildAdvice(snap) });
    setAdvBusy(false);
  };

  const copyAdvice = () => {
    if (!advice) return;
    const text =
      advice.source === "ai"
        ? advice.text
        : advice.items
            .map(
              (it, i) =>
                `${i + 1}. 【${AREA_LABEL[it.area]}】${it.title}\n${it.finding}\n` +
                it.actions.map((a) => `· ${a}`).join("\n") +
                (it.impact ? `\n影响：${it.impact}` : ""),
            )
            .join("\n\n");
    try {
      navigator.clipboard?.writeText(text).then(
        () => toast.success("建议已复制"),
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
        title="经营顾问建议"
        subtitle="按板块给出发现、建议动作和预期影响 · 可直接去处理"
        action={
          <button
            onClick={runAdvice}
            disabled={advBusy}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full btn-brand text-white disabled:opacity-60"
          >
            <Sparkles size={13} />
            {advBusy ? "分析中…" : advice ? "重新生成" : "生成建议"}
          </button>
        }
      >
        {!advice ? (
          <div className="rounded-xl bg-zinc-950 px-4 py-4 text-sm text-zinc-500">
            {hasLlm()
              ? "点右上角「生成建议」，AI 会按销售、菜单、成本、库存、采购、损耗、员工给出可执行建议。"
              : "点右上角生成，系统会按真实数据给出优先级建议（未配置 AI 时为规则版）。"}
          </div>
        ) : advice.source === "ai" ? (
          <div className="rounded-xl bg-zinc-950 px-4 py-3.5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500 text-white">
                AI
              </span>
              <button
                onClick={copyAdvice}
                className="ml-auto inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300"
              >
                <Copy size={12} /> 复制
              </button>
            </div>
            <div className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
              {advice.text}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                规则版
              </span>
              <button
                onClick={copyAdvice}
                className="ml-auto inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300"
              >
                <Copy size={12} /> 复制全部
              </button>
            </div>
            {advice.items.map((it, i) => (
              <div
                key={i}
                className="bg-zinc-950 rounded-xl px-3.5 py-3 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 font-bold">
                    {AREA_LABEL[it.area]}
                  </span>
                  <span className="text-sm font-semibold text-zinc-100">
                    {it.title}
                  </span>
                  {onTab && (
                    <button
                      onClick={() => onTab(it.tab)}
                      className="ml-auto text-[11px] text-orange-400 hover:text-orange-300"
                    >
                      去处理 →
                    </button>
                  )}
                </div>
                <div className="text-xs text-zinc-400">{it.finding}</div>
                <ul className="space-y-1">
                  {it.actions.map((a, j) => (
                    <li key={j} className="flex gap-1.5 text-xs text-zinc-300">
                      <span className="text-orange-400">·</span>
                      {a}
                    </li>
                  ))}
                </ul>
                {it.impact && (
                  <div className="text-[11px] text-zinc-500">
                    预期影响：{it.impact}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      <ChartCard
        title="经营助手"
        subtitle={
          snapshot
            ? "懂今天和近 7 天的销售、菜单、库存、采购、损耗与员工任务 · 可连续追问"
            : "正在汇总全店数据…"
        }
        action={
          messages.length > 0 ? (
            <button
              onClick={clearChat}
              className="text-[11px] text-zinc-500 hover:text-zinc-300"
            >
              清空对话
            </button>
          ) : (
            <Sparkles size={18} className="text-orange-500" />
          )
        }
      >
        {messages.length === 0 ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-zinc-950 px-4 py-3.5 text-sm text-zinc-400">
              {snapshot
                ? "直接问经营问题即可，回答会结合全店数据；也可以追问上一句。"
                : "正在加载经营数据，稍等也可以先提问。"}
            </div>
            <div className="flex flex-wrap gap-2">
              {CHAT_SUGGESTIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-zinc-950 border border-white/5 text-zinc-300 hover:border-orange-500/40 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-orange-600 text-white"
                      : "bg-zinc-950 border border-white/5 text-zinc-200"
                  }`}
                >
                  {m.role === "assistant" && (
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          m.source === "ai"
                            ? "bg-orange-500 text-white"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {m.source === "ai" ? "AI" : "规则版"}
                      </span>
                      <button
                        onClick={() => copyMessage(m.content)}
                        className="ml-auto inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300"
                      >
                        <Copy size={11} /> 复制
                      </button>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              </div>
            ))}
            {chatBusy && (
              <div className="text-xs text-zinc-500 animate-pulse pl-1">
                思考中…
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mt-3">
          <div className="relative flex-1">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(q)}
              placeholder="问经营问题，可连续追问…"
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
            disabled={chatBusy}
            className="shrink-0 w-10 h-10 rounded-xl btn-brand text-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
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
