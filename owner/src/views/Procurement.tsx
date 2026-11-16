import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  ShoppingCart,
  Plus,
  RefreshCw,
  Download,
  Wallet,
  Truck,
  AlertTriangle,
  Camera,
  X,
  ScanLine,
} from "lucide-react";
import { ChartCard, KpiCard } from "../components/ui";
import { Sheet } from "../components/Sheet";
import { toast } from "../components/Toast";
import { askConfirm } from "../components/Confirm";
import { fmtDateTime, fmtMoney, dayKey } from "../lib/format";
import { todayKey } from "../lib/businessDay";
import {
  alertMap,
  buildPriceAlerts,
  checkUnitPrice,
  flaggedAlerts,
  MAX_SAMPLES,
} from "../lib/priceAlert";
import {
  costImpactForPriceChange,
  createPurchase,
  fetchBoms,
  fetchInventory,
  fetchPurchases,
  newPurchaseId,
  num,
  type InventoryItem,
  type PurchaseOrder,
  type RecipeBom,
} from "../lib/inventory";
import { getItemMeta, unitFactor } from "../lib/masterData";
import {
  saveReceiptImage,
  deleteReceiptImage,
  getReceiptImage,
  linkReceipts,
} from "../lib/receipts";
import { receiptImageDataUrl } from "../lib/image";
import {
  matchInventoryItemAny,
  receiptWarnings,
  recognizeReceipt,
  type ReceiptDraft,
} from "../lib/receiptAi";
import { consumptionByItem } from "../lib/aggregate";
import {
  buildPurchasePlan,
  CONSUMPTION_WINDOW_DAYS,
  dailyFromConsumption,
  mergeRequestsIntoPlan,
  requestsByItem,
} from "../lib/purchasePlan";
import {
  fetchPurchaseRequests,
  markPurchaseRequestsFulfilled,
  type PurchaseRequest,
} from "../lib/staffOps";
import { rivalItems } from "../lib/supplierCompare";
import {
  sameUnit,
  conversionFactor,
  reviewCheckFor,
  type ReviewRow,
  type ReviewCheck,
} from "./procurement/helpers";
import { PriceAlertRow } from "./procurement/PriceAlertRow";
import PlanCard from "./procurement/PlanCard";
import SupplierCompareCard from "./procurement/SupplierCompareCard";
import PurchaseRecordsCard from "./procurement/PurchaseRecordsCard";
import ReceiptReviewSheet from "./procurement/ReceiptReviewSheet";

const newLocalId = () =>
  `INV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export default function Procurement({ version = 0 }: { version?: number }) {
  const [list, setList] = useState<PurchaseOrder[]>([]);
  const [q, setQ] = useState("");
  const [inv, setInv] = useState<InventoryItem[]>([]);
  const [boms, setBoms] = useState<RecipeBom[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    supplier: "",
    itemId: "",
    itemName: "",
    unit: "kg",
    quantity: "",
    unit_price: "",
    notes: "",
    purchased_at: todayKey(),
  });
  const [isNew, setIsNew] = useState(false);
  const [coverage, setCoverage] = useState(7);
  const [cons, setCons] = useState<{ key: string; qty: number }[]>([]);
  const [bulk, setBulk] = useState(false);
  const [buyUnit, setBuyUnit] = useState("");
  const [images, setImages] = useState<
    { id: string; name: string; url: string }[]
  >([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [draft, setDraft] = useState<ReceiptDraft | null>(null);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  /** 员工采购申报（已审批的并入采购计划） */
  const [reqs, setReqs] = useState<PurchaseRequest[]>([]);

  const load = async () => {
    setLoading(true);
    const end = new Date();
    const start = new Date(end.getTime() - CONSUMPTION_WINDOW_DAYS * 86400000);
    const [p, i, b, c, rq] = await Promise.all([
      fetchPurchases(),
      fetchInventory(),
      fetchBoms(),
      consumptionByItem(start.toISOString(), end.toISOString()),
      fetchPurchaseRequests(),
    ]);
    setList(p);
    setInv(i);
    setBoms(b);
    setCons(c);
    setReqs(rq);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [version]);

  const monthKey = dayKey(Date.now()).slice(0, 7);
  const stats = useMemo(() => {
    const total = list.reduce((s, p) => s + num(p.total_cost), 0);
    const month = list
      .filter(
        (p) => dayKey(p.purchased_at || p.created_at).slice(0, 7) === monthKey,
      )
      .reduce((s, p) => s + num(p.total_cost), 0);
    const suppliers = new Set(list.map((p) => p.supplier).filter(Boolean)).size;
    return { total, month, suppliers };
  }, [list, monthKey]);

  const alerts = useMemo(() => buildPriceAlerts(list), [list]);
  const byItem = useMemo(() => alertMap(alerts), [alerts]);
  const flagged = useMemo(() => flaggedAlerts(alerts), [alerts]);
  const daily = useMemo(() => {
    // 新店/停业日：按「最早采购以来实际天数」折算日均消耗，避免固定 ÷30 低估
    const now = Date.now();
    let earliest = now;
    for (const p of list) {
      const at = p.purchased_at
        ? new Date(p.purchased_at).getTime()
        : p.created_at
          ? new Date(p.created_at).getTime()
          : 0;
      if (at && at < earliest) earliest = at;
    }
    const trackedDays = Math.max(
      1,
      Math.min(CONSUMPTION_WINDOW_DAYS, Math.ceil((now - earliest) / 86400000)),
    );
    return dailyFromConsumption(cons, trackedDays);
  }, [cons, list]);
  /** 已审批未入库的申报 */
  const approvedReqs = useMemo(
    () => reqs.filter((r) => r.status === "approved"),
    [reqs],
  );
  /** 申报 → 库存物品 聚合（匹配不到的进 unmatched，页面提示待确认） */
  const reqByItem = useMemo(
    () => requestsByItem(approvedReqs, inv),
    [approvedReqs, inv],
  );
  const plan = useMemo(
    () =>
      mergeRequestsIntoPlan(
        buildPurchasePlan({
          items: inv,
          daily,
          alerts,
          coverageDays: coverage,
        }),
        reqByItem.byItem,
        inv,
      ),
    [inv, daily, alerts, coverage, reqByItem],
  );

  // 供应商比价（≥2 家供应商的原料）
  const rivals = useMemo(() => rivalItems(list), [list]);

  // 采购单位换算：按最小单位归一（采购价异常判定/成本影响都用归一的单价）
  const selectedMeta = useMemo(
    () => (!isNew && form.itemId ? getItemMeta(form.itemId) : null),
    [isNew, form.itemId],
  );
  const buyUnits = selectedMeta ? Object.keys(selectedMeta.conversions) : [];
  const selectedUnit =
    !isNew && form.itemId
      ? inv.find((i) => i.id === form.itemId)?.unit || ""
      : "";
  const factor =
    !isNew && form.itemId ? unitFactor(selectedMeta ?? undefined, buyUnit) : 1;
  const pricePerMin =
    factor !== 1 ? num(form.unit_price) / factor : num(form.unit_price);

  const priceCheck = useMemo(
    () => checkUnitPrice(byItem.get(form.itemId), pricePerMin),
    [byItem, form.itemId, pricePerMin],
  );

  const impacts = useMemo(
    () =>
      !isNew && form.itemId
        ? costImpactForPriceChange(form.itemId, pricePerMin, boms, inv)
        : [],
    [isNew, form.itemId, pricePerMin, boms, inv],
  );

  const reviewChecks = useMemo(() => {
    const map = new Map<string, ReviewCheck>();
    for (const row of reviewRows) {
      map.set(row.key, reviewCheckFor(row, inv, list));
    }
    return map;
  }, [reviewRows, inv, list]);
  const reviewFlags = useMemo(() => {
    let price = 0;
    let unit = 0;
    for (const row of reviewRows) {
      if (!row.included) continue;
      const check = reviewChecks.get(row.key);
      if (!check) continue;
      if (check.mismatch && check.factor <= 0) unit += 1;
      if (
        check.history &&
        (check.history.level === "high" || check.history.level === "warn")
      ) {
        price += 1;
      }
    }
    return { price, unit };
  }, [reviewRows, reviewChecks]);

  const reviewSelected = reviewRows.filter((r) => r.included);
  const reviewSum = reviewSelected.reduce(
    (sum, r) => sum + num(r.quantity) * num(r.unitPrice),
    0,
  );
  const liveWarnings = useMemo(() => {
    if (!draft) return [];
    return receiptWarnings({
      ...draft,
      items: reviewSelected.map((r) => ({
        name: r.name,
        nameZh: r.nameZh,
        quantity: num(r.quantity),
        unit: r.unit,
        unitPrice: num(r.unitPrice),
        amount: num(r.quantity) * num(r.unitPrice),
        confidence: r.confidence,
      })),
    });
  }, [draft, reviewSelected]);

  const preselect = (item: { id: string; gap: number; price: number }) => {
    setIsNew(false);
    setForm((f) => ({
      ...f,
      itemId: item.id,
      quantity: String(item.gap > 0 ? item.gap : "1"),
      unit_price: String(item.price || ""),
    }));
    setOpen(true);
  };

  /**
   * 入库后回写员工申报：买够申报量才标记已采购，
   * 买少了保留 approved 状态，等下次补货。
   */
  const fulfillMatchedRequests = async (
    itemId: string,
    purchasedQty: number,
    purchaseId: string,
  ): Promise<number> => {
    const info = reqByItem.byItem.get(itemId);
    if (!info || info.requestIds.length === 0) return 0;
    if (purchasedQty + 1e-9 < info.qty) return 0;
    return markPurchaseRequestsFulfilled(info.requestIds, purchaseId);
  };

  /** 按计划一次性生成采购记录并入库（逐条走既有 RPC，失败不阻断） */
  const bulkBuy = async () => {
    if (bulk || !plan.rows.length) return;
    const reqCount = plan.rows.reduce(
      (n, r) => n + (r.requestIds?.length || 0),
      0,
    );
    if (
      !(await askConfirm(
        `按计划采购 ${plan.rows.length} 项原料，合计约 ${fmtMoney(plan.totalCost)}？${
          reqCount > 0
            ? `\n其中 ${reqCount} 条员工申报将自动标记为已采购。`
            : ""
        }\n将生成采购记录并入库。`,
      ))
    )
      return;
    setBulk(true);
    let ok = 0;
    let fulfilled = 0;
    for (const r of plan.rows) {
      const pid = newPurchaseId();
      const done = await createPurchase({
        id: pid,
        supplier: "",
        inventory_item_id: r.id,
        item_name: r.name,
        quantity: r.gap,
        unit: r.unit,
        unit_price: r.refPrice,
        notes: `采购计划 · 覆盖 ${plan.coverageDays} 天`,
      });
      if (done) {
        ok += 1;
        if (r.requestIds?.length)
          fulfilled += await fulfillMatchedRequests(r.id, r.gap, pid);
      }
    }
    setBulk(false);
    if (ok)
      toast.success(
        `已生成 ${ok} 条采购记录并入库${
          fulfilled > 0 ? `，${fulfilled} 条员工申报已标记已采购` : ""
        }`,
      );
    else toast.error("生成失败，请稍后重试");
    await load();
  };

  const clearReview = () => {
    setReviewOpen(false);
    setDraft(null);
    setReviewRows([]);
  };

  const onPickImages = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      const id = await saveReceiptImage(f, f.name || "receipt");
      if (id) {
        setImages((prev) => [
          ...prev,
          { id, name: f.name || "票据", url: URL.createObjectURL(f) },
        ]);
      }
    }
    clearReview();
    e.target.value = "";
  };
  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((im) => im.id !== id));
    deleteReceiptImage(id);
    clearReview();
  };

  const patchReviewRow = (key: string, patch: Partial<ReviewRow>) => {
    setReviewRows((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  };

  const recognize = async () => {
    if (aiBusy) return;
    if (!images.length) return toast.error("请先拍照或上传票据");
    setAiBusy(true);
    try {
      const urls = (
        await Promise.all(
          images.slice(0, 4).map(async (im) => {
            const saved = await getReceiptImage(im.id);
            return saved ? receiptImageDataUrl(saved.blob) : null;
          }),
        )
      ).filter((url): url is string => Boolean(url));
      if (!urls.length) return toast.error("票据图片读取失败，请重新拍照");
      const result = await recognizeReceipt(urls);
      if (!result.ok) return toast.error(result.error);
      const rows: ReviewRow[] = result.draft.items.map((item, i) => {
        const match = matchInventoryItemAny(
          [item.nameZh, item.name].filter(Boolean),
          inv,
        );
        const matched = match ? inv.find((x) => x.id === match.id) : undefined;
        const price =
          item.unitPrice ||
          (item.amount && item.quantity ? item.amount / item.quantity : 0);
        const aiUnit = item.unit.trim();
        return {
          key: `ai-${Date.now()}-${i}`,
          included: true,
          name: item.name,
          sourceName: item.name,
          nameZh: item.nameZh,
          itemId: matched?.id || "",
          quantity: item.quantity ? String(item.quantity) : "",
          unit:
            matched && sameUnit(aiUnit, matched.unit)
              ? matched.unit
              : aiUnit || matched?.unit || "",
          unitPrice: price ? String(Number(price.toFixed(2))) : "",
          confidence: item.confidence || result.draft.confidence,
          matchScore: match?.score || 0,
        };
      });
      setDraft(result.draft);
      setReviewRows(rows);
      setReviewOpen(true);
      toast.success("识别完成，请逐项人工复核");
    } finally {
      setAiBusy(false);
    }
  };

  const saveReview = async () => {
    if (aiSaving || !draft) return;
    const selected = reviewRows.filter((r) => r.included);
    if (!selected.length) return toast.error("请至少勾选一项入库");

    const payloads: {
      name: string;
      itemId: string;
      qty: number;
      unit: string;
      price: number;
    }[] = [];
    for (const row of selected) {
      const item = row.itemId
        ? inv.find((i) => i.id === row.itemId)
        : undefined;
      const qty = num(row.quantity);
      const price = num(row.unitPrice);
      const name = (item?.name || row.name).trim();
      if (!name) return toast.error("存在未填写的原料名称");
      if (!(qty > 0)) return toast.error(`「${name}」数量需大于 0`);
      if (price < 0) return toast.error(`「${name}」单价不能为负数`);
      let finalQty = qty;
      let finalUnit = item?.unit || row.unit.trim() || "kg";
      let finalPrice = price;
      if (item) {
        const buyUnit = row.unit.trim() || item.unit;
        if (!sameUnit(buyUnit, item.unit)) {
          const factor = conversionFactor(item.id, buyUnit);
          if (!(factor > 0)) {
            return toast.error(
              `「${name}」单位 ${buyUnit} 与库存单位 ${item.unit} 不一致，请先换算或改为新原料`,
            );
          }
          finalQty = qty * factor;
          finalPrice = price / factor;
        }
      }
      payloads.push({
        name,
        itemId: item?.id || newLocalId(),
        qty: finalQty,
        unit: finalUnit,
        price: finalPrice,
      });
    }

    const total = payloads.reduce((sum, p) => sum + p.qty * p.price, 0);
    const priceNote = reviewFlags.price
      ? `\n其中 ${reviewFlags.price} 项价格异常，请确认已核对历史采购价。`
      : "";
    if (
      !(await askConfirm(
        `确认将 ${payloads.length} 项采购入库，合计 ${fmtMoney(total)}？${priceNote}\n入库后库存与成本会立即更新。`,
      ))
    )
      return;

    setAiSaving(true);
    const when = draft.date
      ? new Date(`${draft.date}T12:00:00`).toISOString()
      : undefined;
    const notes = [
      draft.invoiceNumber ? `票据号 ${draft.invoiceNumber}` : "",
      "AI识别·人工复核",
      draft.notes,
    ]
      .filter(Boolean)
      .join(" · ");
    let ok = 0;
    let fulfilled = 0;
    for (const p of payloads) {
      const pid = newPurchaseId();
      const done = await createPurchase({
        id: pid,
        supplier: draft.supplier,
        inventory_item_id: p.itemId,
        item_name: p.name,
        quantity: p.qty,
        unit: p.unit,
        unit_price: p.price,
        notes,
        purchased_at: when,
      });
      if (done) {
        ok += 1;
        if (images.length)
          linkReceipts(
            pid,
            images.map((im) => im.id),
          );
        // 匹配到员工申报且买够数量 → 自动标记已采购
        if (!String(p.itemId).startsWith("INV-"))
          fulfilled += await fulfillMatchedRequests(p.itemId, p.qty, pid);
      }
    }
    setAiSaving(false);
    if (!ok) return toast.error("入库失败（检查库存/采购表权限）");
    toast.success(
      `已入库 ${ok} 项${ok < payloads.length ? `，${payloads.length - ok} 项失败` : ""}${
        fulfilled > 0 ? `；${fulfilled} 条员工申报已标记已采购` : ""
      }`,
    );
    images.forEach((im) => URL.revokeObjectURL(im.url));
    setImages([]);
    setForm({
      ...form,
      itemId: "",
      itemName: "",
      quantity: "",
      unit_price: "",
      notes: "",
    });
    setBuyUnit("");
    setIsNew(false);
    clearReview();
    setOpen(false);
    load();
  };

  const submit = async () => {
    const name = isNew
      ? form.itemName.trim()
      : inv.find((i) => i.id === form.itemId)?.name;
    const id = isNew ? newLocalId() : form.itemId;
    if (!name || !id) return toast.error("请选择或填写原料");
    if (!num(form.quantity)) return toast.error("请输入数量");
    const isExisting = inv.some((i) => i.id === id);
    const unit =
      isNew || !isExisting
        ? form.unit
        : inv.find((i) => i.id === id)?.unit || form.unit;
    // 单位换算：采购单位数量 → 最小单位；单价摊回最小单位（总金额不变）
    const qty = num(form.quantity) * factor;
    const pid = newPurchaseId();
    const ok = await createPurchase({
      id: pid,
      supplier: form.supplier,
      inventory_item_id: id,
      item_name: name,
      quantity: qty,
      unit,
      unit_price: pricePerMin,
      notes: form.notes,
      purchased_at: form.purchased_at
        ? new Date(`${form.purchased_at}T12:00:00`).toISOString()
        : undefined,
    });
    if (!ok) return toast.error("采购入库失败（检查库存/采购表权限）");
    if (images.length)
      linkReceipts(
        pid,
        images.map((im) => im.id),
      );
    images.forEach((im) => URL.revokeObjectURL(im.url));
    // 匹配到员工申报且买够数量 → 自动标记已采购
    const fulfilled = isExisting
      ? await fulfillMatchedRequests(id, qty, pid)
      : 0;
    toast.success(
      fulfilled > 0
        ? `采购已入库，${fulfilled} 条员工申报已标记已采购`
        : "采购已入库",
    );
    setOpen(false);
    setForm({
      ...form,
      itemId: "",
      itemName: "",
      quantity: "",
      unit_price: "",
      notes: "",
    });
    setBuyUnit("");
    setImages([]);
    setIsNew(false);
    load();
  };

  const exportCsv = () => {
    if (!list.length) return toast.error("没有可导出的数据");
    const rows = [
      [
        "采购单号",
        "供应商",
        "原料",
        "数量",
        "单位",
        "单价",
        "金额",
        "时间",
        "备注",
      ],
      ...list.map((p) => [
        p.id,
        p.supplier || "",
        p.item_name,
        num(p.quantity),
        p.unit,
        num(p.unit_price),
        num(p.total_cost),
        fmtDateTime(p.purchased_at || p.created_at),
        p.notes || "",
      ]),
    ];
    const csv =
      "\uFEFF" +
      rows
        .map((r) =>
          r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","),
        )
        .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `purchase_${todayKey()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("已导出采购记录");
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          icon={Wallet}
          label="累计采购支出"
          value={fmtMoney(stats.total)}
          valueNum={stats.total}
          format={fmtMoney}
        />
        <KpiCard
          icon={ShoppingCart}
          label="本月采购支出"
          value={fmtMoney(stats.month)}
          valueNum={stats.month}
          format={fmtMoney}
          accent="text-blue-400"
          bg="bg-blue-500/10"
        />
        <KpiCard
          icon={Truck}
          label="供应商数"
          value={String(stats.suppliers)}
          valueNum={stats.suppliers}
          accent="text-teal-400"
          bg="bg-teal-500/10"
        />
        <KpiCard
          icon={AlertTriangle}
          label="价格异常"
          value={String(flagged.length)}
          valueNum={flagged.length}
          accent={flagged.length ? "text-red-400" : "text-teal-400"}
          bg={flagged.length ? "bg-red-500/10" : "bg-teal-500/10"}
        />
      </div>

      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-3">
        <button
          onClick={() => setOpen(true)}
          className="col-span-2 sm:order-last flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-white btn-brand rounded-xl active:scale-[0.98] transition-transform"
        >
          <Plus size={16} /> 新建采购
        </button>
        <button
          onClick={load}
          className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm text-zinc-300 bg-zinc-900 border border-white/5 rounded-xl hover:bg-zinc-800"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> 刷新
        </button>
        <button
          onClick={exportCsv}
          className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm text-zinc-300 bg-zinc-900 border border-white/5 rounded-xl hover:bg-zinc-800"
        >
          <Download size={16} /> 导出
        </button>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索原料 / 供应商"
          className="col-span-2 sm:flex-1 min-w-0 sm:min-w-[160px] bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
        />
      </div>

      {flagged.length > 0 && (
        <ChartCard
          title="价格异常"
          subtitle={`与最近 ${MAX_SAMPLES} 次采购单价的中位价比对`}
          action={<AlertTriangle size={18} className="text-red-400" />}
        >
          <div className="space-y-1.5">
            {flagged.map((a) => (
              <PriceAlertRow key={a.itemId} alert={a} />
            ))}
          </div>
        </ChartCard>
      )}

      {plan.rows.length > 0 && (
        <PlanCard
          plan={plan}
          coverage={coverage}
          onCoverage={setCoverage}
          bulk={bulk}
          onBulkBuy={bulkBuy}
          approvedCount={approvedReqs.length}
          onPick={(r) => preselect({ id: r.id, gap: r.gap, price: r.refPrice })}
        />
      )}

      {reqByItem.unmatched.length > 0 && (
        <ChartCard
          title="申报待确认"
          subtitle="这些申报没匹配到库存物品，去「采购申报」页手动关联库存物品"
          action={<AlertTriangle size={18} className="text-amber-400" />}
        >
          <div className="flex flex-wrap gap-1.5">
            {reqByItem.unmatched.map((r) => (
              <span
                key={r.id}
                className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300"
              >
                {r.item_name} · {r.quantity}
                {r.unit}（{r.staff_name}）
              </span>
            ))}
          </div>
        </ChartCard>
      )}

      {rivals.length > 0 && <SupplierCompareCard list={list} />}

      <PurchaseRecordsCard list={list} loading={loading} q={q} />

      <Sheet
        open={open}
        title="新建采购入库"
        subtitle="保存后自动增加库存并写入成本流水"
        onClose={() => {
          setOpen(false);
          clearReview();
        }}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={isNew}
              onChange={(e) => setIsNew(e.target.checked)}
            />
            新原料（库存中不存在）
          </div>

          {isNew ? (
            <>
              <input
                placeholder="原料名称"
                value={form.itemName}
                onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                className="w-full bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white"
              />
              <input
                placeholder="单位（如 kg / 个 / 包）"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white"
              />
            </>
          ) : (
            <select
              value={form.itemId}
              onChange={(e) => {
                setForm({ ...form, itemId: e.target.value });
                setBuyUnit("");
              }}
              className="w-full bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white"
            >
              <option value="">选择原料…</option>
              {inv.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}（现存 {num(i.stock)}
                  {i.unit}）
                </option>
              ))}
            </select>
          )}

          <input
            placeholder="供应商（选填）"
            value={form.supplier}
            onChange={(e) => setForm({ ...form, supplier: e.target.value })}
            className="w-full bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white"
          />

          {!isNew && buyUnits.length > 0 && (
            <div className="flex items-center gap-3">
              <select
                value={buyUnit}
                onChange={(e) => setBuyUnit(e.target.value)}
                className="flex-1 bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              >
                <option value="">按最小单位（{selectedUnit}）</option>
                {buyUnits.map((u) => (
                  <option key={u} value={u}>
                    {u}（1{u}={selectedMeta!.conversions[u]}
                    {selectedUnit}）
                  </option>
                ))}
              </select>
              {factor !== 1 && (
                <span className="text-xs text-zinc-400 whitespace-nowrap">
                  = {num(form.quantity) * factor} {selectedUnit}
                </span>
              )}
            </div>
          )}

          <div>
            <div className="text-xs text-zinc-400 mb-1.5">
              票据照片（存本机，可拍照或从相册选择）
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 bg-zinc-950 border border-white/5 rounded-xl cursor-pointer active:scale-[0.99] transition-transform">
                <Camera size={16} /> 拍照 / 上传
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={onPickImages}
                />
              </label>
              <button
                onClick={recognize}
                disabled={aiBusy || !images.length}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm text-orange-300 bg-orange-500/10 border border-orange-500/30 rounded-xl hover:bg-orange-500/15 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] transition-transform"
              >
                <ScanLine size={16} className={aiBusy ? "animate-pulse" : ""} />
                {aiBusy ? "AI 识别中…" : "AI 识别票据"}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">
              支持发票 / 小票 / 手写收据，最多识别前 4 张；图片会发送到设置中的
              AI 服务，识别后必须人工复核。
            </p>
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {images.map((im) => (
                  <div
                    key={im.id}
                    className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/10"
                  >
                    <img
                      src={im.url}
                      alt={im.name}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeImage(im.id)}
                      className="absolute top-0 right-0 bg-black/60 text-white w-5 h-5 flex items-center justify-center rounded-bl-lg"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              placeholder="数量"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white"
            />
            <input
              type="number"
              placeholder="单价(成本)"
              value={form.unit_price}
              onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
              className={`bg-zinc-950 border rounded-xl px-3 py-2.5 text-sm text-white ${
                priceCheck.level === "ok"
                  ? "border-white/5"
                  : priceCheck.level === "high"
                    ? "border-red-500/60 focus:border-red-400"
                    : "border-amber-500/60 focus:border-amber-400"
              }`}
            />
          </div>
          {priceCheck.message && (
            <div
              className={`-mt-1 text-xs leading-relaxed ${
                priceCheck.level === "high" ? "text-red-400" : "text-amber-400"
              }`}
            >
              {priceCheck.message}
            </div>
          )}
          <input
            type="date"
            value={form.purchased_at}
            onChange={(e) => setForm({ ...form, purchased_at: e.target.value })}
            className="w-full bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white"
          />
          <input
            placeholder="备注（选填）"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white"
          />
          <div className="text-right text-sm text-zinc-400">
            合计{" "}
            <span className="text-orange-400 font-bold">
              {fmtMoney(num(form.quantity) * num(form.unit_price))}
            </span>
          </div>

          {impacts.length > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl px-3 py-2.5">
              <div className="text-[11px] text-amber-400 mb-1">
                采购价变动会影响以下菜品成本：
              </div>
              <div className="space-y-1">
                {impacts.slice(0, 6).map((c) => (
                  <div
                    key={c.dish}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-zinc-300 truncate mr-2">
                      {c.dish}
                    </span>
                    <span
                      className={
                        c.delta >= 0 ? "text-red-400" : "text-green-400"
                      }
                    >
                      {c.delta >= 0 ? "+" : ""}
                      {fmtMoney(c.delta)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={submit}
          className="mt-4 w-full py-3 rounded-xl btn-brand text-white font-semibold active:scale-[0.98] transition-transform"
        >
          保存并入库
        </button>
      </Sheet>

      <ReceiptReviewSheet
        open={reviewOpen && !!draft}
        draft={draft}
        rows={reviewRows}
        inv={inv}
        checks={reviewChecks}
        flags={reviewFlags}
        warnings={liveWarnings}
        selectedCount={reviewSelected.length}
        sum={reviewSum}
        aiSaving={aiSaving}
        onPatchRow={patchReviewRow}
        onRemoveRow={(key) =>
          setReviewRows((rows) => rows.filter((r) => r.key !== key))
        }
        onDraft={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
        onSave={saveReview}
        onClose={clearReview}
      />
    </div>
  );
}
