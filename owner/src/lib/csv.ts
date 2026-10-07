/* ============ 订单 CSV 导入（纯解析，无 IO） ============
 * 支持两种行式：
 *  - 明细模式：每行一个菜品（菜名+数量+单价），同单号/同时段桌号聚合成一单
 *  - 汇总模式：只有金额列（本端「导出 CSV」的格式），一行=一单，items 为空
 * 列头宽松匹配（时间/桌号/菜名/数量/单价/单号/金额/状态/支付方式 及英文别名）。
 * 导入写库走 aggregate.importOrders（RPC 绕 BOM 触发器，幂等）。
 */

export interface ImportItem {
  name: string;
  quantity: number;
  price: number;
}

export interface ImportOrder {
  id: string;
  timestamp: string; // ISO
  tableNo: string;
  customerName: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  total: number;
  items: ImportItem[];
  /** 来源为美团/饿了么等外部平台（「来源」列命中关键词） */
  isExternal?: boolean;
}

export interface ParseOrdersResult {
  orders: ImportOrder[];
  /** 被跳过的数据行数（时间/菜名无法识别等） */
  skipped: number;
  /** 前几条错误说明（给用户看） */
  errors: string[];
  mode: "detail" | "summary";
}

/** CSV 解析（引号包裹、双引号转义、CRLF、BOM；空行忽略） */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const COL = {
  time: ["时间", "日期", "下单时间", "datetime", "time", "date"],
  table: ["桌号", "台号", "桌台", "table", "tableno"],
  customer: ["客户", "客人", "顾客", "customer", "guest"],
  dish: ["菜名", "菜品", "商品", "商品名称", "item", "dish", "name"],
  qty: ["数量", "份数", "qty", "quantity"],
  price: ["单价", "价格", "price", "unitprice"],
  orderNo: ["单号", "订单号", "orderno", "ordernumber", "order"],
  total: ["金额", "总额", "合计", "总价", "total", "amount"],
  status: ["状态", "status"],
  pay: ["支付方式", "支付", "payment", "pay"],
  source: ["来源", "平台", "渠道", "source", "channel", "platform"],
};

const EXTERNAL_SRC =
  /美团|饿了么|外卖|meituan|eleme|ele\.me|waimai|dianping|外部|platform/i;

function findCol(headers: string[], keys: string[]): number {
  const norm = headers.map((h) => h.trim().toLowerCase().replace(/[\s_]/g, ""));
  return norm.findIndex((h) => keys.includes(h));
}

const STATUS_ALIAS: Record<string, string> = {
  待接单: "pending",
  制作中: "cooking",
  已上菜: "served",
  已结账: "completed",
  已完成: "completed",
  完成: "completed",
  已取消: "cancelled",
  取消: "cancelled",
  已退款: "cancelled",
  pending: "pending",
  cooking: "cooking",
  served: "served",
  completed: "completed",
  cancelled: "cancelled",
};

/** 本地时间 → ISO；识别 2026-10-04 12:30[:ss]、2026/10/4、ISO 等 */
export function parseTime(v: string): string | null {
  const t = (v || "").trim();
  if (!t) return null;
  const m = t.match(
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (m) {
    const d = new Date(
      +m[1],
      +m[2] - 1,
      +m[3],
      +(m[4] || 0),
      +(m[5] || 0),
      +(m[6] || 0),
    );
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** 确定性短哈希（同 CSV 重复导入 → 同 id → RPC 幂等跳过） */
export function hashKey(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function num(v: string | undefined): number {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function parseOrdersCsv(text: string): ParseOrdersResult {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    throw new Error("CSV 至少需要表头和 1 行数据");
  }
  const headers = rows[0];
  const iT = findCol(headers, COL.time);
  const iDish = findCol(headers, COL.dish);
  const iQty = findCol(headers, COL.qty);
  const iPrice = findCol(headers, COL.price);
  const iTable = findCol(headers, COL.table);
  const iCustomer = findCol(headers, COL.customer);
  const iNo = findCol(headers, COL.orderNo);
  const iTotal = findCol(headers, COL.total);
  const iStatus = findCol(headers, COL.status);
  const iPay = findCol(headers, COL.pay);
  const iSrc = findCol(headers, COL.source);

  if (iT < 0) throw new Error("找不到「时间」列（时间/日期/datetime）");
  const mode: "detail" | "summary" =
    iDish >= 0 && iQty >= 0 ? "detail" : "summary";
  if (mode === "summary" && iTotal < 0) {
    throw new Error("需要「金额」列，或「菜名+数量」两列");
  }

  const map = new Map<string, ImportOrder>();
  let skipped = 0;
  const errors: string[] = [];
  const pushErr = (msg: string) => {
    skipped++;
    if (errors.length < 3) errors.push(msg);
  };

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const time = parseTime(row[iT] ?? "");
    if (!time) {
      pushErr(
        `第 ${r + 1} 行：时间无法识别（${(row[iT] || "").slice(0, 20)}）`,
      );
      continue;
    }
    const table = (iTable >= 0 ? (row[iTable] || "").trim() : "") || "导入";
    const cust = (iCustomer >= 0 ? (row[iCustomer] || "").trim() : "") || "";
    const no = (iNo >= 0 ? (row[iNo] || "").trim() : "") || "";
    const status =
      (iStatus >= 0
        ? STATUS_ALIAS[(row[iStatus] || "").trim().toLowerCase()]
        : "") || "completed";
    const pay = (iPay >= 0 ? (row[iPay] || "").trim() : "") || "";
    const src = (iSrc >= 0 ? (row[iSrc] || "").trim() : "") || "";
    const key = no || `${time}|${table}`;

    let o = map.get(key);
    if (!o) {
      o = {
        id: `imp-${hashKey(key)}`,
        timestamp: time,
        tableNo: table,
        customerName: cust,
        orderNumber: no,
        status,
        paymentMethod: pay,
        total: 0,
        items: [],
        isExternal: EXTERNAL_SRC.test(src),
      };
      map.set(key, o);
    }

    if (mode === "detail") {
      const name = (row[iDish] || "").trim();
      const qty = Math.floor(num(row[iQty]));
      if (!name || qty <= 0) {
        pushErr(`第 ${r + 1} 行：菜名或数量无效`);
        continue;
      }
      o.items.push({
        name,
        quantity: qty,
        price: iPrice >= 0 ? num(row[iPrice]) : 0,
      });
    }
    if (iTotal >= 0 && o.total <= 0) {
      const t = num(row[iTotal]);
      if (t > 0) o.total = t;
    }
  }

  const orders: ImportOrder[] = [];
  for (const o of map.values()) {
    if (!o.total && o.items.length) {
      o.total = o.items.reduce((s, it) => s + it.quantity * it.price, 0);
    }
    if (o.total <= 0 && !o.items.length) {
      pushErr(`单号 ${o.orderNumber || o.id}：金额为 0，已跳过`);
      continue;
    }
    orders.push(o);
  }
  orders.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return { orders, skipped, errors, mode };
}
