const fs = require('fs');
let code = fs.readFileSync('src/api.ts', 'utf8');

const updateOrderCode = `  updateOrder: async (orderId: string, updatePayload: any) => {
    const sId = String(orderId);
    if (broadcastOrdersMemoryCache.has(sId)) {
      const prev = broadcastOrdersMemoryCache.get(sId);
      const updated = normalizeOrder({ ...prev, ...updatePayload, timestamp: new Date().toISOString() });
      broadcastOrdersMemoryCache.set(sId, updated);
    }

    try {
      if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
        const cols = (await getTableColumns("orders")) || KNOWN_COLUMNS["orders"] || [];
        const dbPayload = await filterPayloadByTable("orders", updatePayload);
        let queryBuilder = supabase.from("orders").update(dbPayload);
        if (cols.includes("_id")) {
          queryBuilder = queryBuilder.eq("_id", orderId);
        } else {
          queryBuilder = queryBuilder.eq("id", orderId);
        }
        const { error } = await queryBuilder;
        if (error) handleSupabaseError(error, "updateOrder");
      }
    } catch (e: any) {
      handleSupabaseError(e, "updateOrder");
    }

    const localOrdersStr = localStorage.getItem("local_orders");
    if (localOrdersStr) {
      let localOrders = JSON.parse(localOrdersStr);
      const idx = localOrders.findIndex((o: any) => String(o._id) === sId || String(o.id) === sId);
      if (idx !== -1) {
        localOrders[idx] = normalizeOrder({
          ...localOrders[idx],
          ...updatePayload,
          timestamp: new Date().toISOString()
        });
        localStorage.setItem("local_orders", JSON.stringify(localOrders));
      }
    }
    triggerLocalOrdersChange();
    triggerBroadcast('orders_changed', { action: 'upsert', orderId, ...updatePayload });
  },`;

code = code.replace("clearOrders: async", updateOrderCode + "\n\n  clearOrders: async");
fs.writeFileSync('src/api.ts', code);
console.log("updateOrder restored");
