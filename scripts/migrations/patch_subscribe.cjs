const fs = require('fs');
let code = fs.readFileSync('src/api.ts', 'utf8');

const subscribeCode = `  subscribeToCustomerOrder: (customerName: string, callback: (order: any) => void) => {
    let isCancelled = false;

    const getLatestActiveLocalOrMem = () => {
      const memOrders = Array.from(broadcastOrdersMemoryCache.values())
        .map(normalizeOrder)
        .filter((o) => isOrderMatchingTable(o, customerName) && isOrderActive(o));
      const localOrdersStr = localStorage.getItem("local_orders");
      const localOrders = localOrdersStr ? JSON.parse(localOrdersStr) : [];
      const localActive = localOrders
        .map(normalizeOrder)
        .filter((o) => isOrderMatchingTable(o, customerName) && isOrderActive(o));
      
      const all = [...memOrders, ...localActive];
      if (all.length === 0) return null;
      all.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      return all[0];
    };

    const fetchAndCallback = async () => {
      try {
        let dbOrder = null;
        if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
          const cols = (await getTableColumns("orders")) || KNOWN_COLUMNS["orders"] || [];
          let query = supabase.from("orders").select("*").neq("status", "completed").neq("status", "cancelled");

          const validMatchCols = ["table_no", "customer_name", "customerName", "tableNo"].filter(c => cols.includes(c));
          const targetNorm = normalizeTableString(customerName);
          if (validMatchCols.length > 0) {
            const matchValues = Array.from(new Set([customerName, targetNorm, \`桌号 \${customerName}\`, \`桌号 \${targetNorm}\`, \`\${targetNorm}号桌\`])).filter(Boolean);
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

          if (cols.includes("timestamp")) {
            query = query.order("timestamp", { ascending: false });
          } else if (cols.includes("created_at")) {
            query = query.order("created_at", { ascending: false });
          }
          const { data, error } = await query;
          if (error) handleSupabaseReadError(error, "subscribeToCustomerOrder");
          if (isCancelled) return;

          if (data && data.length > 0) {
            dbOrder = normalizeOrder(data[0]);
          }
        }

        const localMemOrder = getLatestActiveLocalOrMem();

        if (dbOrder && localMemOrder) {
          const dbTime = new Date(dbOrder.timestamp || 0).getTime();
          const localTime = new Date(localMemOrder.timestamp || 0).getTime();
          if (localTime >= dbTime) {
            callback(localMemOrder);
          } else {
            callback(dbOrder);
          }
        } else if (localMemOrder) {
          callback(localMemOrder);
        } else if (dbOrder) {
          callback(dbOrder);
        } else {
          callback(null);
        }
      } catch (e) {
        handleSupabaseReadError(e, "subscribeToCustomerOrder fetchAndCallback");
        const localMemOrder = getLatestActiveLocalOrMem();
        callback(localMemOrder);
      }
    };

    const listenerObj = { customerName, callback, fetchAndCallback };
    customerOrderListeners.push(listenerObj);

    fetchAndCallback();

    return () => {
      isCancelled = true;
      customerOrderListeners = customerOrderListeners.filter(l => l !== listenerObj);
    };
  },`;

const startIdx = code.indexOf("subscribeToCustomerOrder: (customerName: string");
const endIdx = code.indexOf("updateOrderStatus: async");

if (startIdx !== -1 && endIdx !== -1) {
  code = code.substring(0, startIdx) + subscribeCode + "\n\n  " + code.substring(endIdx);
  console.log("subscribeToCustomerOrder patched");
} else {
  console.error("Could not locate subscribeToCustomerOrder start/end");
}

fs.writeFileSync('src/api.ts', code);
