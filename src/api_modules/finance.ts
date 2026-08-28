import { supabase, isSupabaseConfigured, isSupabaseHealthy } from '../supabase';
import { handleSupabaseReadError, handleSupabaseWriteError, filterPayloadByTable, triggerBroadcast } from './client';
import { purchaseOrderSchema, inventoryTransactionSchema } from '../types/schemas';
import type { PurchaseOrder, InventoryTransaction, DailySummary, WasteAnalysis } from '../types/inventory';
import type { Order } from '../types/order';
import { getOrders, normalizeOrder, parseOrderTimestamp } from './orders';
import { getInventoryItems, getRecipeBoms } from './inventory';
import { logger } from '../utils/logger';

// ============ 本地存储辅助 ============
const lsGet = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch { return fallback; }
};
const lsSet = (key: string, value: any) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
};

// ============ 采购管理 (purchase_orders) ============
export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  try {
    if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
      const { data, error } = await supabase.from('purchase_orders').select('*').order('purchased_at', { ascending: false }).limit(500);
      if (error) throw error;
      if (data && data.length) return data as PurchaseOrder[];
    }
  } catch (e) { handleSupabaseReadError(e, 'getPurchaseOrders'); }
  return lsGet<PurchaseOrder[]>('local_purchase_orders', []);
}

export async function savePurchaseOrder(po: PurchaseOrder) {
  const full: PurchaseOrder = {
    ...po,
    id: po.id || 'PO-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
    total_cost: Number((Number(po.quantity) * Number(po.unit_price)).toFixed(2)),
    created_at: po.created_at || new Date().toISOString()
  };
  const parsed = purchaseOrderSchema.safeParse(full);
  if (!parsed.success) logger.warn('finance', 'purchase zod', parsed.error.issues.slice(0, 2));
  const payload = await filterPayloadByTable('purchase_orders', full);
  try {
    if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
      const { error } = await supabase.from('purchase_orders').upsert(payload, { onConflict: 'id' });
      if (error) throw error;
      triggerBroadcast('inventory_changed');
    }
  } catch (e) { handleSupabaseWriteError(e, 'savePurchaseOrder'); }
  const arr = lsGet<PurchaseOrder[]>('local_purchase_orders', []);
  const idx = arr.findIndex(x => x.id === full.id);
  if (idx !== -1) arr[idx] = full; else arr.unshift(full);
  lsSet('local_purchase_orders', arr);
  triggerBroadcast('inventory_changed');
  return full;
}

export async function deletePurchaseOrder(id: string) {
  try {
    if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
      const { error } = await supabase.from('purchase_orders').delete().eq('id', id);
      if (error) throw error;
      triggerBroadcast('inventory_changed');
    }
  } catch (e) { handleSupabaseWriteError(e, 'deletePurchaseOrder'); }
  lsSet('local_purchase_orders', lsGet<PurchaseOrder[]>('local_purchase_orders', []).filter(x => x.id !== id));
  triggerBroadcast('inventory_changed');
}

// ============ 库存流水 (inventory_transactions) ============
export async function getInventoryTransactions(): Promise<InventoryTransaction[]> {
  try {
    if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
      const { data, error } = await supabase.from('inventory_transactions').select('*').order('created_at', { ascending: false }).limit(1000);
      if (error) throw error;
      if (data && data.length) return data as InventoryTransaction[];
    }
  } catch (e) { handleSupabaseReadError(e, 'getInventoryTransactions'); }
  return lsGet<InventoryTransaction[]>('local_inventory_transactions', []);
}

export async function addInventoryTransaction(tx: InventoryTransaction) {
  const full: InventoryTransaction = {
    ...tx,
    id: tx.id || 'TX-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
    created_at: tx.created_at || new Date().toISOString()
  };
  const parsed = inventoryTransactionSchema.safeParse(full);
  if (!parsed.success) logger.warn('finance', 'tx zod', parsed.error.issues.slice(0, 2));
  const payload = await filterPayloadByTable('inventory_transactions', full);
  try {
    if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
      const { error } = await supabase.from('inventory_transactions').insert(payload);
      if (error) throw error;
      triggerBroadcast('inventory_changed');
    }
  } catch (e) { handleSupabaseWriteError(e, 'addInventoryTransaction'); }
  const arr = lsGet<InventoryTransaction[]>('local_inventory_transactions', []);
  arr.unshift(full);
  if (arr.length > 2000) arr.length = 2000;
  lsSet('local_inventory_transactions', arr);
  triggerBroadcast('inventory_changed');
  return full;
}

// ============ 每日盈亏汇总 ============
function getOrderDate(o: any): string {
  const ts = parseOrderTimestamp(o.timestamp || o.created_at || o.createdAt);
  if (!ts) return new Date().toISOString().slice(0, 10);
  return new Date(ts).toISOString().slice(0, 10);
}

// 统计订单收入：仅计入已完成 (completed/served) 或全部非取消订单
function orderRevenue(o: any): number {
  const status = String(o.status || 'pending').toLowerCase();
  if (status === 'cancelled') return 0;
  return Number(o.total ?? o.total_amount ?? 0) || 0;
}

// 计算某日期区间内的采购总额（按采购日期）
async function purchasesTotalByDate(from: string, to: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const pos = await getPurchaseOrders();
  pos.forEach(p => {
    if (!p.purchased_at) return;
    const d = String(p.purchased_at).slice(0, 10);
    if (d < from || d > to) return;
    map.set(d, (map.get(d) || 0) + Number(p.total_cost || 0));
  });
  return map;
}

// 计算某日期的理论食材成本：根据 orders.items 与 BOM 剂量计算消耗量，再乘以物料单价
async function foodCostByDate(from: string, to: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const inv = await getInventoryItems();
  const boms = await getRecipeBoms();
  const priceMap = new Map<string, number>();
  inv.forEach(i => priceMap.set(i.id, Number(i.price || 0)));

  const processItems = (items: any[]) => {
    if (!Array.isArray(items)) return 0;
    let cost = 0;
    items.forEach((oi: any) => {
      const id = String(oi.id || '');
      const name = String(oi.title || oi.name || '').trim();
      const qty = Number(oi.quantity || oi.count || 1);
      if ((!id && !name) || isNaN(qty) || qty <= 0) return;
      let matched = [] as any[];
      if (id) matched = boms.filter(b => String((b as any).menu_item_id || '').toLowerCase() === id.toLowerCase() || b.menu_item_name.trim().toLowerCase() === name.toLowerCase());
      else matched = boms.filter(b => b.menu_item_name.trim().toLowerCase() === name.toLowerCase());
      matched.forEach(bom => {
        const unitPrice = priceMap.get(bom.inventory_item_id) || 0;
        cost += Number(bom.dosage) * qty * unitPrice;
      });
    });
    return cost;
  };

  const orders = await getOrders(2000);
  orders.forEach(o => {
    const status = String(o.status || 'pending').toLowerCase();
    if (status === 'cancelled') return;
    const d = getOrderDate(o);
    if (d < from || d > to) return;
    const cost = processItems(o.items || []);
    map.set(d, (map.get(d) || 0) + cost);
  });
  return map;
}

// 获取每日盈亏汇总 (含理论成本；无 purchase/transaction 表时也可工作)
export async function getDailySummaries(from: string, to: string): Promise<DailySummary[]> {
  const revenueMap = new Map<string, number>();
  const orderCountMap = new Map<string, number>();
  const orders = await getOrders(2000);
  orders.forEach(o => {
    const d = getOrderDate(o);
    if (d < from || d > to) return;
    revenueMap.set(d, (revenueMap.get(d) || 0) + orderRevenue(o));
    orderCountMap.set(d, (orderCountMap.get(d) || 0) + 1);
  });

  const [purchasesMap, costMap] = await Promise.all([
    purchasesTotalByDate(from, to),
    foodCostByDate(from, to)
  ]);

  const days: string[] = [];
  const cursor = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days.map(d => {
    const revenue = Number((revenueMap.get(d) || 0).toFixed(2));
    const foodCost = Number((costMap.get(d) || 0).toFixed(2));
    const purchases = Number((purchasesMap.get(d) || 0).toFixed(2));
    const grossProfit = Number((revenue - foodCost).toFixed(2));
    const margin = revenue > 0 ? Number(((grossProfit / revenue) * 100).toFixed(1)) : 0;
    return {
      date: d,
      revenue,
      food_cost: foodCost,
      gross_profit: grossProfit,
      gross_margin: margin,
      purchases_total: purchases,
      waste_total: 0,
      order_count: orderCountMap.get(d) || 0
    };
  });
}

// ============ 周期损耗测算 ============
// 理论消耗 = Σ(BOM剂量 × 售出数量)  [来自订单]
// 实际消耗 = 期初库存 + 采购入库 - 期末库存
// 损耗量 = 实际消耗 - 理论消耗；损耗率 = 损耗量 / 实际消耗
export async function getWasteAnalysis(periodStart: string, periodEnd: string): Promise<WasteAnalysis[]> {
  const inv = await getInventoryItems();
  const boms = await getRecipeBoms();
  const orders = await getOrders(2000);
  const pos = await getPurchaseOrders();
  const txs = await getInventoryTransactions();

  // 每个物料的期初/期末/采购/理论消耗
  const opening = new Map<string, number>();
  const closing = new Map<string, number>();
  const purchasesQty = new Map<string, number>();
  const theoretical = new Map<string, number>();
  const unitCost = new Map<string, number>();
  const units = new Map<string, string>();

  // 期初库存：取周期开始前最近一次库存快照
  // 简化：若存在流水则按交易推算，否则用当前库存作为期末
  const priceMap = new Map<string, number>();
  inv.forEach(i => {
    priceMap.set(i.id, Number(i.price || 0));
    unitCost.set(i.id, Number(i.price || 0));
    units.set(i.id, i.unit || '');
  });

  // 理论消耗计算
  orders.forEach(o => {
    const d = getOrderDate(o);
    if (d < periodStart || d > periodEnd) return;
    const status = String(o.status || 'pending').toLowerCase();
    if (status === 'cancelled') return;
    (o.items || []).forEach((oi: any) => {
      const id = String(oi.id || '');
      const name = String(oi.title || oi.name || '').trim();
      const qty = Number(oi.quantity || oi.count || 1);
      if ((!id && !name) || isNaN(qty) || qty <= 0) return;
      let matched: any[] = [];
      if (id) matched = boms.filter(b => String((b as any).menu_item_id || '').toLowerCase() === id.toLowerCase() || b.menu_item_name.trim().toLowerCase() === name.toLowerCase());
      else matched = boms.filter(b => b.menu_item_name.trim().toLowerCase() === name.toLowerCase());
      matched.forEach(bom => {
        theoretical.set(bom.inventory_item_id, (theoretical.get(bom.inventory_item_id) || 0) + Number(bom.dosage) * qty);
      });
    });
  });

  // 采购数量
  pos.forEach(p => {
    const d = String(p.purchased_at || '').slice(0, 10);
    if (d < periodStart || d > periodEnd) return;
    purchasesQty.set(p.item_id, (purchasesQty.get(p.item_id) || 0) + Number(p.quantity || 0));
  });

  // 流水推算期初/期末
  txs.forEach(tx => {
    const d = String(tx.created_at || '').slice(0, 10);
    const qty = Number(tx.quantity || 0);
    const isIn = tx.type === 'purchase_in';
    if (d < periodStart) {
      // 周期前发生，影响期初
      opening.set(tx.item_id, (opening.get(tx.item_id) || 0) + (isIn ? qty : -qty));
    } else if (d > periodEnd) {
      // 周期后发生，不影响
    } else {
      // 周期内发生，影响期末（但期初不含周期内变动）
      closing.set(tx.item_id, (closing.get(tx.item_id) || 0) + (isIn ? qty : -qty));
    }
  });

  const results: WasteAnalysis[] = [];
  inv.forEach(i => {
    const itemId = i.id;
    const theo = Number((theoretical.get(itemId) || 0).toFixed(2));
    const purch = Number((purchasesQty.get(itemId) || 0).toFixed(2));
    // 期末实际 = 当前库存；期初 = 当前库存 + 理论消耗 - 采购（若无流水快照）
    const currentStock = Number(i.stock || 0);
    let op: number;
    let cl: number;
    if (txs.some(t => t.item_id === itemId)) {
      // 有流水：期末 = 当前库存，期初 = 期末 - 周期内净变动
      const periodNet = Number((closing.get(itemId) || 0).toFixed(2));
      cl = currentStock;
      op = Number((currentStock - periodNet).toFixed(2));
    } else {
      // 无流水：期初 = 期末 + 理论消耗 - 采购
      op = Number((currentStock + theo - purch).toFixed(2));
      cl = currentStock;
    }
    const actual = Number((op + purch - cl).toFixed(2));
    const wasteQty = Number((actual - theo).toFixed(2));
    const wasteRate = actual > 0 ? Number(((wasteQty / actual) * 100).toFixed(1)) : 0;
    const cost = Number((wasteQty * (unitCost.get(itemId) || 0)).toFixed(2));
    results.push({
      period_start: periodStart,
      period_end: periodEnd,
      item_id: itemId,
      item_name: i.name,
      opening_stock: op,
      purchases: purch,
      theoretical_consumption: theo,
      actual_consumption: actual,
      waste_quantity: wasteQty,
      waste_rate: wasteRate,
      waste_cost: cost,
      unit: i.unit || ''
    });
  });

  return results;
}

// ============ 周期汇总 ============
export interface PeriodTotals {
  revenue: number;
  food_cost: number;
  gross_profit: number;
  gross_margin: number;
  purchases: number;
  waste_cost: number;
  waste_rate: number;
  order_count: number;
}

export async function getPeriodTotals(from: string, to: string): Promise<PeriodTotals> {
  const summaries = await getDailySummaries(from, to);
  const waste = await getWasteAnalysis(from, to);
  const revenue = summaries.reduce((s, d) => s + d.revenue, 0);
  const foodCost = summaries.reduce((s, d) => s + d.food_cost, 0);
  const purchases = summaries.reduce((s, d) => s + d.purchases_total, 0);
  const orderCount = summaries.reduce((s, d) => s + d.order_count, 0);
  const wasteCost = waste.reduce((s, w) => s + w.waste_cost, 0);
  const grossProfit = revenue - foodCost;
  const wasteRate = foodCost > 0 ? Number(((wasteCost / foodCost) * 100).toFixed(1)) : 0;
  return {
    revenue: Number(revenue.toFixed(2)),
    food_cost: Number(foodCost.toFixed(2)),
    gross_profit: Number(grossProfit.toFixed(2)),
    gross_margin: revenue > 0 ? Number(((grossProfit / revenue) * 100).toFixed(1)) : 0,
    purchases: Number(purchases.toFixed(2)),
    waste_cost: Number(wasteCost.toFixed(2)),
    waste_rate: wasteRate,
    order_count: orderCount
  };
}

// 让订单模块新增订单后触发本地缓存刷新
export { normalizeOrder, parseOrderTimestamp };
