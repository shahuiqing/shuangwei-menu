const fs = require('fs');
let code = fs.readFileSync('src/api.ts', 'utf8');

// Replace verifyOrderValidity and addOrder
const verifyAndAddOrderCode = `  verifyOrderValidity: async (customerNameOrTable: string): Promise<{ hasActiveOrder: boolean; activeOrder: any | null }> => {
    const custName = customerNameOrTable || "A1";

    // 1. Check local storage
    const localOrdersStr = localStorage.getItem("local_orders");
    const localOrders = localOrdersStr ? JSON.parse(localOrdersStr) : [];
    const localActive = localOrders.map(normalizeOrder).find((o: any) => isOrderMatchingTable(o, custName) && isOrderActive(o));

    // 2. Check memory cache
    const memActive = Array.from(broadcastOrdersMemoryCache.values())
      .map(normalizeOrder)
      .find((o: any) => isOrderMatchingTable(o, custName) && isOrderActive(o));

    // 3. Check DB
    let dbActive: any = null;
    if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
      try {
        const cols = (await getTableColumns("orders")) || KNOWN_COLUMNS["orders"] || [];
        let query = supabase.from("orders").select("*").neq("status", "completed").neq("status", "cancelled");
        
        const validMatchCols = ["table_no", "customer_name", "customerName", "tableNo"].filter(c => cols.includes(c));
        const targetNorm = normalizeTableString(custName);
        if (validMatchCols.length > 0) {
          const matchValues = Array.from(new Set([custName, targetNorm, \`桌号 \${custName}\`, \`桌号 \${targetNorm}\`, \`\${targetNorm}号桌\`])).filter(Boolean);
          const conditions = [];
          validMatchCols.forEach(col => {
            matchValues.forEach(val => {
              conditions.push(\`\${col}.eq.\${val}\`);
            });
          });
          if (conditions.length > 0) {
            query = query.or(conditions.join(","));
          }
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const sorted = data.map(normalizeOrder).sort((a, b) => 
            new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
          );
          dbActive = sorted[0];
        }
      } catch (e) {
        console.warn("[verifyOrderValidity] server verification failed:", e);
      }
    }

    const candidates = [localActive, memActive, dbActive].filter(Boolean);
    if (candidates.length > 0) {
      candidates.sort((a, b) => 
        new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
      );
      return { hasActiveOrder: true, activeOrder: candidates[0] };
    }

    return { hasActiveOrder: false, activeOrder: null };
  },

  addOrder: async (order: any) => {
    const custName = order.customerName || order.customer_name || "A1";
    const tableNo = order.tableNo || order.table_no || custName || "A1";

    const verification = await api.verifyOrderValidity(tableNo || custName);

    const newId = order.id || order._id || "ORD-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    const sanitizedItems = [];
    if (order.items && Array.isArray(order.items)) {
      for (const item of order.items) {
        const cleanImage = await ensureNoBase64Image(item.image, "order_dishes");
        sanitizedItems.push({ ...item, image: cleanImage });
      }
    }

    const localOrdersStr = localStorage.getItem("local_orders");
    let localOrders = localOrdersStr ? JSON.parse(localOrdersStr) : [];

    let fullOrder = null;

    if (verification.hasActiveOrder && verification.activeOrder) {
      // Merge items as addition (加菜)
      const existingActive = verification.activeOrder;
      const activeLocalIdx = localOrders.findIndex((o) => 
        String(o._id) === String(existingActive._id) || String(o.id) === String(existingActive._id)
      );

      const baseOrder = activeLocalIdx !== -1 ? localOrders[activeLocalIdx] : existingActive;

      const addedItems = sanitizedItems.map((item) => ({ ...item, isAdded: true }));
      const newItems = [...(baseOrder.items || []), ...addedItems];
      const currentUnprinted = baseOrder.unprintedAdditions || [];
      const newUnprinted = [...currentUnprinted, { items: addedItems, timestamp: new Date().toISOString() }];
      const newTotal = Number((Number(baseOrder.total || baseOrder.total_amount || 0) + Number(order.total || 0)).toFixed(2));

      fullOrder = normalizeOrder({
        ...baseOrder,
        items: newItems,
        unprintedAdditions: newUnprinted,
        total: newTotal,
        total_amount: newTotal,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        unprintedNewOrder: baseOrder.unprintedNewOrder !== false
      });

      if (activeLocalIdx !== -1) {
        localOrders[activeLocalIdx] = fullOrder;
      } else {
        localOrders.push(fullOrder);
      }
      localStorage.setItem("local_orders", JSON.stringify(localOrders));
      broadcastOrdersMemoryCache.set(String(fullOrder._id), fullOrder);

      if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
        try {
          const dbPayload = await filterPayloadByTable("orders", fullOrder);
          const cols = (await getTableColumns("orders")) || KNOWN_COLUMNS["orders"] || [];
          let queryBuilder = supabase.from("orders").update(dbPayload);
          if (cols.includes("_id")) {
            queryBuilder = queryBuilder.eq("_id", fullOrder._id);
          } else {
            queryBuilder = queryBuilder.eq("id", fullOrder._id);
          }
          const { error: updateError } = await queryBuilder;
          if (updateError) console.warn("[addOrder] Supabase update error:", updateError);
        } catch (dbErr) {
          console.warn("[addOrder] Supabase update sync failed:", dbErr);
        }
      }
    } else {
      // Brand new order
      fullOrder = normalizeOrder({
        id: newId,
        _id: newId,
        orderNumber: order.orderNumber || ("ORD-" + Math.floor(Math.random() * 1000000)),
        customerName: custName,
        customer_name: custName,
        table_no: tableNo,
        tableNo: tableNo,
        status: order.status || "pending",
        items: sanitizedItems,
        total: Number(order.total || 0),
        total_amount: Number(order.total || 0),
        timestamp: order.timestamp || new Date().toISOString(),
        created_at: order.timestamp || new Date().toISOString(),
        createdAt: order.timestamp || new Date().toISOString(),
        notes: order.notes || "",
        unprintedNewOrder: true,
        unprintedAdditions: order.unprintedAdditions || []
      });

      localOrders.push(fullOrder);
      localStorage.setItem("local_orders", JSON.stringify(localOrders));
      broadcastOrdersMemoryCache.set(String(fullOrder._id), fullOrder);

      if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
        try {
          const dbPayload = await filterPayloadByTable("orders", fullOrder);
          const { error: insertError } = await supabase.from("orders").insert(dbPayload);
          if (insertError) console.warn("[addOrder] Supabase insert error:", insertError);
        } catch (dbErr) {
          console.warn("[addOrder] Supabase insert sync failed:", dbErr);
        }
      }
    }

    triggerLocalOrdersChange();
    triggerBroadcast('orders_changed', { action: 'upsert', order: fullOrder });
    api.deductInventoryForOrderItems(order.items);
    return fullOrder;
  },`;

// Find where verifyOrderValidity starts and replace up to end of addOrder
const startIdx = code.indexOf("verifyOrderValidity: async (customerNameOrTable: string)");
const endIdx = code.indexOf("clearOrders: async");

if (startIdx !== -1 && endIdx !== -1) {
  code = code.substring(0, startIdx) + verifyAndAddOrderCode + "\n\n  " + code.substring(endIdx);
  console.log("verifyOrderValidity and addOrder updated");
} else {
  console.error("Could not find targets for verifyOrderValidity/addOrder");
}

fs.writeFileSync('src/api.ts', code);
