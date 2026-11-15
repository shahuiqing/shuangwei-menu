import { useEffect, useMemo, useState } from "react";
import { Sparkles, Send, Copy } from "lucide-react";
import { ChartCard } from "../components/ui";
import { Sheet, SheetField } from "../components/Sheet";
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
  fetchStaffMembers,
  fetchStaffTasks,
  fetchStocktakeTasks,
  dispatchTasks,
  isOverdue,
  ROLE_LABEL,
  ROLES,
  type Role,
  type StaffMember,
} from "../lib/staffOps";
import { useOpsSignals } from "../lib/useOpsSignals";
import { buildDailyBrief } from "../lib/brief";
import {
  buildAdvice,
  advisorPrompt,
  AREA_LABEL,
  type AdviceItem,
} from "../lib/advisor";
import { buildSitePlan, sitePlanPrompt } from "../lib/siteAudit";
import {
  loadReviewFacts,
  buildReview,
  reviewPrompt,
  type ReviewReport,
  type ReviewPeriod,
} from "../lib/review";
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
import { createTask } from "../lib/tasks";
import {
  loadAiPrefs,
  saveAiPrefs,
  FOCUS_LABEL,
  STYLE_LABEL,
  type AiPrefs,
  type AiFocus,
} from "../lib/aiPrefs";

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
  const [sitePlan, setSitePlan] = useState<
    { source: "rule"; lines: string[] } | { source: "ai"; text: string } | null
  >(null);
  const [siteBusy, setSiteBusy] = useState(false);
  const [reviewPeriod, setReviewPeriod] = useState<ReviewPeriod>("week");
  const [review, setReview] = useState<
    | { source: "rule"; report: ReviewReport }
    | { source: "ai"; text: string; period: ReviewPeriod }
    | null
  >(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  /** 派工弹窗 */
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [dispatchQueue, setDispatchQueue] = useState<
    { title: string; desc: string; checklist: string[]; tab: string }[] | null
  >(null);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [pickedRoles, setPickedRoles] = useState<Role[]>([]);
  const [dueHours, setDueHours] = useState(8);
  const [alsoTask, setAlsoTask] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  /** 助手偏好（关注点/回答风格） */
  const [prefs, setPrefs] = useState<AiPrefs>(() => loadAiPrefs());
  const updatePrefs = (patch: Partial<AiPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveAiPrefs(next);
  };
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
        buildChatSystemPrompt(snap, prefs),
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

  /** 把建议转成任务中心的待办（自动同步云端） */
  const addTask = (
    title: string,
    finding: string,
    actions: string[],
    kind: string,
  ) => {
    createTask({
      id: `ai-${kind}`,
      kind,
      title,
      desc: [finding, ...actions.map((a) => `· ${a}`)].join("\n"),
      impact: 0,
      evidence: [],
      suggestion: actions[0] || "",
      tab: kind,
    });
    toast.success("已加入任务中心，可在「任务中心」跟踪");
  };

  // 员工名单（派工用）
  useEffect(() => {
    let alive = true;
    void fetchStaffMembers().then((list) => {
      if (alive) setStaff(list.filter((s) => s.status === "active"));
    });
    return () => {
      alive = false;
    };
  }, [version]);

  /** 打开派工弹窗（建议/复盘/网站检查共用） */
  const openDispatch = (item: {
    title: string;
    desc: string;
    checklist: string[];
    tab: string;
  }) => {
    setDispatchQueue([item]);
    setPickedIds([]);
    setPickedRoles([]);
    setDueHours(8);
    setAlsoTask(true);
  };

  /** 批量派发（如复盘的下期重点） */
  const openBatchDispatch = (
    items: { title: string; desc: string; checklist: string[]; tab: string }[],
  ) => {
    if (items.length === 0) return;
    setDispatchQueue(items);
    setPickedIds([]);
    setPickedRoles([]);
    setDueHours(8);
    setAlsoTask(true);
  };

  const submitDispatch = async () => {
    const queue = dispatchQueue;
    if (!queue || queue.length === 0) return;
    if (pickedIds.length === 0 && pickedRoles.length === 0)
      return toast.error("请选择岗位或员工");
    setDispatching(true);
    let total = 0;
    for (const item of queue) {
      const n = await dispatchTasks({
        title: item.title,
        description: item.desc,
        checklist: item.checklist.map((text) => ({ text })),
        due_hours: dueHours,
        roles: pickedIds.length > 0 ? undefined : pickedRoles,
        assigneeIds: pickedIds.length > 0 ? pickedIds : undefined,
      });
      total += n;
      if (alsoTask) addTask(item.title, item.desc, item.checklist, item.tab);
    }
    setDispatching(false);
    if (total > 0) {
      toast.success(
        `已派发 ${queue.length} 项任务（共 ${total} 条到人）${
          alsoTask ? "，并加入你的任务中心" : ""
        }`,
      );
      setDispatchQueue(null);
    } else {
      toast.error("派发失败：该岗位可能没有在职员工");
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
      const { system, user } = advisorPrompt(snap, prefs);
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

  /** 网站改进计划：AI 优先，失败用规则版 */
  const runSitePlan = async () => {
    if (siteBusy || !snapshot?.site) return;
    setSiteBusy(true);
    if (hasLlm()) {
      const { system, user } = sitePlanPrompt(snapshot.site);
      const reply = await chatLLM(system, user);
      if (reply) {
        setSitePlan({ source: "ai", text: reply });
        setSiteBusy(false);
        return;
      }
      toast.info("AI 暂不可用，已用规则版改进计划");
    }
    setSitePlan({ source: "rule", lines: buildSitePlan(snapshot.site) });
    setSiteBusy(false);
  };

  const copySitePlan = () => {
    if (!sitePlan) return;
    const text =
      sitePlan.source === "ai" ? sitePlan.text : sitePlan.lines.join("\n");
    try {
      navigator.clipboard?.writeText(text).then(
        () => toast.success("改进计划已复制"),
        () => toast.error("复制失败"),
      );
    } catch {
      toast.error("复制失败");
    }
  };

  /** 周报/月报复盘 */
  const runReview = async (period: ReviewPeriod = reviewPeriod) => {
    if (reviewBusy) return;
    setReviewBusy(true);
    const facts = await loadReviewFacts(period);
    const nextActions = snapshot
      ? buildAdvice(snapshot)
          .slice(0, 3)
          .map((a) => a.actions[0] || a.title)
      : [];
    if (hasLlm()) {
      const { system, user } = reviewPrompt(facts, nextActions, prefs);
      const reply = await chatLLM(system, user);
      if (reply) {
        setReview({ source: "ai", text: reply, period });
        setReviewBusy(false);
        return;
      }
      toast.info("AI 暂不可用，已用规则版复盘");
    }
    setReview({
      source: "rule",
      report: buildReview(facts, nextActions),
    });
    setReviewBusy(false);
  };

  const copyReview = () => {
    if (!review) return;
    const text =
      review.source === "ai"
        ? review.text
        : [
            ...review.report.summary,
            "",
            "亮点与问题：",
            ...review.report.highlights.map((x) => `· ${x}`),
            "",
            "下期重点：",
            ...review.report.next.map((x, i) => `${i + 1}. ${x}`),
          ].join("\n");
    try {
      navigator.clipboard?.writeText(text).then(
        () => toast.success("复盘已复制"),
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
        title="周期复盘"
        subtitle="周报 / 月报：本期结论、亮点与问题、下期重点"
        action={
          <span className="text-[11px] text-zinc-500">
            {reviewBusy ? "分析中…" : "可复制发群"}
          </span>
        }
      >
        <div className="flex items-center gap-2 mb-3">
          {(["week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => {
                setReviewPeriod(p);
                if (review) void runReview(p);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                reviewPeriod === p
                  ? "bg-orange-600 text-white"
                  : "bg-zinc-950 border border-white/5 text-zinc-400"
              }`}
            >
              {p === "week" ? "周报（近 7 天）" : "月报（近 30 天）"}
            </button>
          ))}
          <button
            onClick={() => runReview()}
            disabled={reviewBusy}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold btn-brand text-white disabled:opacity-60"
          >
            <Sparkles size={13} />
            {reviewBusy ? "生成中…" : review ? "重新生成" : "生成复盘"}
          </button>
        </div>

        {!review ? (
          <div className="rounded-xl bg-zinc-950 px-4 py-4 text-sm text-zinc-500">
            选择周报或月报后点「生成复盘」，会对比上期数据，给出结论、问题和下期重点。
          </div>
        ) : (
          <div className="rounded-xl bg-zinc-950 px-4 py-3.5 space-y-3">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  review.source === "ai"
                    ? "bg-orange-500 text-white"
                    : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {review.source === "ai" ? "AI" : "规则版"} ·{" "}
                {reviewPeriod === "week" ? "周报" : "月报"}
              </span>
              <button
                onClick={copyReview}
                className="ml-auto inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300"
              >
                <Copy size={12} /> 复制
              </button>
            </div>
            {review.source === "ai" ? (
              <div className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                {review.text}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  {review.report.summary.map((line, i) => (
                    <p
                      key={i}
                      className="text-sm text-zinc-200 leading-relaxed"
                    >
                      {line}
                    </p>
                  ))}
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-400 mb-1">
                    亮点与问题
                  </div>
                  <ul className="space-y-1">
                    {review.report.highlights.map((x, i) => (
                      <li
                        key={i}
                        className="flex gap-1.5 text-xs text-zinc-300"
                      >
                        <span className="text-orange-400">·</span>
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-400 mb-1">
                    下期重点
                  </div>
                  <ol className="space-y-1">
                    {review.report.next.map((x, i) => (
                      <li
                        key={i}
                        className="flex flex-wrap items-center gap-2 text-xs text-zinc-300"
                      >
                        <span className="text-orange-400 font-bold">
                          {i + 1}.
                        </span>
                        <span className="flex-1">{x}</span>
                        <button
                          onClick={() =>
                            openDispatch({
                              title: x,
                              desc: `${reviewPeriod === "week" ? "周报" : "月报"}·下期重点：${x}`,
                              checklist: [],
                              tab: "ai-review",
                            })
                          }
                          className="text-[11px] text-sky-400 hover:text-sky-300"
                        >
                          派给员工
                        </button>
                      </li>
                    ))}
                  </ol>
                  <button
                    onClick={() =>
                      openBatchDispatch(
                        review.report.next.map((x) => ({
                          title: x,
                          desc: `${
                            reviewPeriod === "week" ? "周报" : "月报"
                          }·下期重点：${x}`,
                          checklist: [],
                          tab: "ai-review",
                        })),
                      )
                    }
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-sky-400 hover:text-sky-300"
                  >
                    <Send size={11} /> 批量派发下期重点
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
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
                  <div className="ml-auto flex items-center gap-2 shrink-0">
                    <button
                      onClick={() =>
                        addTask(it.title, it.finding, it.actions, it.area)
                      }
                      className="text-[11px] text-zinc-500 hover:text-zinc-300"
                    >
                      加入任务
                    </button>
                    <button
                      onClick={() =>
                        openDispatch({
                          title: it.title,
                          desc: [
                            it.finding,
                            ...it.actions.map((a) => `· ${a}`),
                          ].join("\n"),
                          checklist: it.actions,
                          tab: it.area,
                        })
                      }
                      className="text-[11px] text-zinc-500 hover:text-sky-400"
                    >
                      派给员工
                    </button>
                    {onTab && (
                      <button
                        onClick={() => onTab(it.tab)}
                        className="text-[11px] text-orange-400 hover:text-orange-300"
                      >
                        去处理 →
                      </button>
                    )}
                  </div>
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
        title="网站体检"
        subtitle="分析顾客端菜单与品牌设置，指出影响下单的问题"
        action={
          <button
            onClick={runSitePlan}
            disabled={siteBusy || !snapshot?.site}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-50"
          >
            <Sparkles size={13} />
            {siteBusy ? "生成中…" : sitePlan ? "重新生成计划" : "生成改进计划"}
          </button>
        }
      >
        {!snapshot?.site ? (
          <div className="rounded-xl bg-zinc-950 px-4 py-4 text-sm text-zinc-500">
            正在读取网站与菜单数据…
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-4 bg-zinc-950 rounded-xl px-4 py-3">
              <div className="text-3xl font-bold text-orange-400 tnum">
                {snapshot.site.score}
              </div>
              <div className="text-[11px] text-zinc-500 leading-relaxed">
                网站评分（满分 100）
                <br />
                {snapshot.site.categories} 个分类 · {snapshot.site.dishes}{" "}
                个菜品 · 缺图 {snapshot.site.missingImage} · 缺描述{" "}
                {snapshot.site.missingDesc}
              </div>
            </div>

            {snapshot.site.checks.length === 0 ? (
              <div className="text-sm text-teal-400">
                没有发现明显问题，菜单信息完整。
              </div>
            ) : (
              <div className="space-y-1.5">
                {snapshot.site.checks.map((c) => {
                  const sev =
                    c.severity === "high"
                      ? "bg-rose-500/15 text-rose-400"
                      : c.severity === "medium"
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-zinc-800 text-zinc-400";
                  return (
                    <div
                      key={c.id}
                      className="bg-zinc-950 rounded-lg px-3 py-2.5 space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${sev}`}
                        >
                          {c.severity === "high"
                            ? "优先"
                            : c.severity === "medium"
                              ? "建议"
                              : "可选"}
                        </span>
                        <span className="text-sm text-zinc-100 font-medium">
                          {c.title}
                        </span>
                        {c.tab && (
                          <button
                            onClick={() =>
                              addTask(
                                c.title,
                                `${c.finding}\n建议：${c.recommendation}`,
                                [c.recommendation],
                                "site-audit",
                              )
                            }
                            className="ml-auto text-[11px] text-zinc-500 hover:text-zinc-300"
                          >
                            加入任务
                          </button>
                        )}
                        {c.tab && (
                          <button
                            onClick={() =>
                              openDispatch({
                                title: c.title,
                                desc: `${c.finding}\n建议：${c.recommendation}`,
                                checklist: [c.recommendation],
                                tab: "site-audit",
                              })
                            }
                            className="text-[11px] text-zinc-500 hover:text-sky-400"
                          >
                            派给员工
                          </button>
                        )}
                        {onTab && c.tab && (
                          <button
                            onClick={() => onTab(c.tab)}
                            className={`${
                              c.tab ? "" : "ml-auto "
                            }text-[11px] text-orange-400 hover:text-orange-300`}
                          >
                            去处理 →
                          </button>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500">{c.finding}</div>
                      <div className="text-xs text-zinc-400">
                        建议：{c.recommendation}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {sitePlan && (
              <div className="rounded-xl bg-zinc-950 px-4 py-3.5 space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      sitePlan.source === "ai"
                        ? "bg-orange-500 text-white"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {sitePlan.source === "ai"
                      ? "AI 改进计划"
                      : "规则版改进计划"}
                  </span>
                  <button
                    onClick={copySitePlan}
                    className="ml-auto inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300"
                  >
                    <Copy size={12} /> 复制
                  </button>
                </div>
                {sitePlan.source === "ai" ? (
                  <div className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                    {sitePlan.text}
                  </div>
                ) : (
                  <ol className="space-y-1.5">
                    {sitePlan.lines.map((line, i) => (
                      <li
                        key={i}
                        className="text-sm text-zinc-200 leading-relaxed"
                      >
                        {line}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
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
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
              <span>关注：</span>
              {(Object.keys(FOCUS_LABEL) as AiFocus[]).map((f) => (
                <button
                  key={f}
                  onClick={() =>
                    updatePrefs({
                      focus: prefs.focus.includes(f)
                        ? prefs.focus.filter((x) => x !== f)
                        : [...prefs.focus, f],
                    })
                  }
                  className={`px-2 py-0.5 rounded-full font-semibold ${
                    prefs.focus.includes(f)
                      ? "bg-orange-600/20 text-orange-400"
                      : "bg-zinc-900 border border-white/5 text-zinc-500"
                  }`}
                >
                  {FOCUS_LABEL[f]}
                </button>
              ))}
              <span className="ml-2">风格：</span>
              {(["brief", "detailed"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => updatePrefs({ style: s })}
                  className={`px-2 py-0.5 rounded-full font-semibold ${
                    prefs.style === s
                      ? "bg-orange-600/20 text-orange-400"
                      : "bg-zinc-900 border border-white/5 text-zinc-500"
                  }`}
                >
                  {STYLE_LABEL[s]}
                </button>
              ))}
            </div>
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
                        onClick={() =>
                          addTask(
                            m.content.split("\n")[0]?.slice(0, 60) ||
                              "经营建议待处理",
                            m.content,
                            [],
                            "ai-chat",
                          )
                        }
                        className="ml-auto inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-orange-400"
                      >
                        转成任务
                      </button>
                      <button
                        onClick={() => copyMessage(m.content)}
                        className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300"
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

      {/* 派工弹窗：把建议/复盘重点变成员工任务 */}
      <Sheet
        open={!!dispatchQueue}
        title="派给员工"
        subtitle={
          dispatchQueue
            ? dispatchQueue.length === 1
              ? dispatchQueue[0].title
              : `批量派发 ${dispatchQueue.length} 项`
            : undefined
        }
        onClose={() => setDispatchQueue(null)}
      >
        {dispatchQueue && (
          <>
            {dispatchQueue.length === 1 ? (
              <SheetField
                label="任务标题"
                value={dispatchQueue[0].title}
                onChange={(v) =>
                  setDispatchQueue([{ ...dispatchQueue[0], title: v }])
                }
              />
            ) : (
              <ul className="space-y-1">
                {dispatchQueue.map((it, i) => (
                  <li key={i} className="text-xs text-zinc-300">
                    {i + 1}. {it.title}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3">
              <div className="text-xs text-zinc-500 mb-1.5">按岗位派发</div>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    onClick={() =>
                      setPickedRoles((prev) =>
                        prev.includes(r)
                          ? prev.filter((x) => x !== r)
                          : [...prev, r],
                      )
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                      pickedRoles.includes(r)
                        ? "bg-sky-500/15 text-sky-400 border-transparent"
                        : "bg-zinc-950 border-white/5 text-zinc-500"
                    }`}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <div className="text-xs text-zinc-500 mb-1.5">
                或指定员工（{staff.length} 人在职）
              </div>
              <div className="flex flex-wrap gap-2">
                {staff.length === 0 ? (
                  <span className="text-xs text-zinc-600">
                    还没有在职员工，先去「员工管理」添加
                  </span>
                ) : (
                  staff.map((s) => (
                    <button
                      key={s.id}
                      onClick={() =>
                        setPickedIds((prev) =>
                          prev.includes(s.id)
                            ? prev.filter((x) => x !== s.id)
                            : [...prev, s.id],
                        )
                      }
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                        pickedIds.includes(s.id)
                          ? "bg-orange-500/15 text-orange-400 border-transparent"
                          : "bg-zinc-950 border-white/5 text-zinc-500"
                      }`}
                    >
                      {s.name}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-zinc-500">截止</span>
              <select
                value={dueHours}
                onChange={(e) => setDueHours(Number(e.target.value))}
                className="bg-zinc-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
              >
                {[4, 8, 12, 24].map((h) => (
                  <option key={h} value={h}>
                    {h} 小时内
                  </option>
                ))}
              </select>
            </div>

            <label className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={alsoTask}
                onChange={(e) => setAlsoTask(e.target.checked)}
                className="accent-orange-500"
              />
              同时加入我的任务中心（跟进这条建议）
            </label>

            {dispatchQueue.length === 1 &&
              dispatchQueue[0].checklist.length > 0 && (
                <div className="mt-3 text-[11px] text-zinc-600 leading-relaxed">
                  检查项：{dispatchQueue[0].checklist.join(" / ")}
                </div>
              )}

            <button
              disabled={dispatching}
              onClick={submitDispatch}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl btn-brand text-white font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              <Send size={16} />
              {dispatching ? "派发中…" : "确认派发"}
            </button>
          </>
        )}
      </Sheet>
    </div>
  );
}
