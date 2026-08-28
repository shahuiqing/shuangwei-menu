const fs = require('fs');
let code = fs.readFileSync('src/api.ts', 'utf8');

// 1. Add export helpers right before ordersListeners
const helperCode = `
export const normalizeTableString = (str: any): string => {
  if (!str) return "";
  return String(str)
    .replace(/^(桌号|table|号桌|桌)\s*/i, "")
    .replace(/\s*(桌号|table|号桌|桌)$/i, "")
    .trim()
    .toLowerCase();
};

export const isOrderActive = (o: any): boolean => {
  if (!o) return false;
  const status = String(o.status || "pending").toLowerCase();
  return status !== "completed" && status !== "cancelled";
};

export const isOrderMatchingTable = (o: any, nameOrTable: string): boolean => {
  if (!o || !nameOrTable) return false;
  const targetNorm = normalizeTableString(nameOrTable);
  const rawTarget = String(nameOrTable).trim().toLowerCase();
  if (!targetNorm && !rawTarget) return false;

  const orderCust = String(o.customerName || o.customer_name || "").trim().toLowerCase();
  const orderTable = String(o.table_no || o.tableNo || "").trim().toLowerCase();
  const orderCustNorm = normalizeTableString(orderCust);
  const orderTableNorm = normalizeTableString(orderTable);

  return (
    (rawTarget !== "" && (orderCust === rawTarget || orderTable === rawTarget)) ||
    (targetNorm !== "" && (orderCustNorm === targetNorm || orderTableNorm === targetNorm))
  );
};

let ordersListeners: ((orders: any[]) => void)[] = [];`;

code = code.replace("let ordersListeners: ((orders: any[]) => void)[] = [];", helperCode);

fs.writeFileSync('src/api.ts', code);
console.log("Helpers added successfully");
