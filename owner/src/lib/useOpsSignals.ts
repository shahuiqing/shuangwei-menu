import { useEffect, useState } from "react";
import {
  fetchInventory,
  fetchPurchases,
  fetchTransactions,
  lowStockItems,
  type InventoryItem,
} from "./inventory";
import { buildPriceAlerts, flaggedAlerts } from "./priceAlert";
import { todayWasteAmount } from "./waste";
import { fetchOrdersPage } from "./aggregate";

/* ============ 问题信号（共享取数） ============
 * 任务中心 / AI 助手 / 看板共用：库存预警、采购价异常、今日损耗、待接单数。
 * 免费额度友好：只拉必要的小结果集。
 */

export interface OpsSignals {
  low: InventoryItem[];
  alerts: ReturnType<typeof flaggedAlerts>;
  todayWaste: number;
  pending: number;
  purchaseCount: number;
  ready: boolean;
}

export function useOpsSignals(version = 0): OpsSignals {
  const [ops, setOps] = useState<OpsSignals>({
    low: [],
    alerts: [],
    todayWaste: 0,
    pending: 0,
    purchaseCount: 0,
    ready: false,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const tomorrow = new Date(Date.now() + 86400000).toISOString();
      const [inv, pur, wt, pg] = await Promise.all([
        fetchInventory(),
        fetchPurchases(300),
        fetchTransactions(300, "waste", todayStart.toISOString()),
        fetchOrdersPage({
          start: monthAgo,
          end: tomorrow,
          status: "pending",
          limit: 1,
        }),
      ]);
      if (!alive) return;
      setOps({
        low: lowStockItems(inv),
        alerts: flaggedAlerts(buildPriceAlerts(pur)),
        todayWaste: todayWasteAmount(wt),
        pending: pg.count,
        purchaseCount: pur.length,
        ready: true,
      });
    })();
    return () => {
      alive = false;
    };
  }, [version]);

  return ops;
}
