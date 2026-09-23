import express from "express";
import path from "path";
import cors from "cors";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import * as dotenv from "dotenv";
import { WebSocketServer } from "ws";
import { requestLogger, errorHandler } from "./server/middleware/requestLogger";
import authRouter from "./server/routes/auth";
import { requireAdmin } from "./server/middleware/auth";
import { rateLimit } from "./server/middleware/rateLimit";
import * as cartHub from "./server/services/cartHub";
import crypto from "crypto";

// P1-10 SSRF 校验：仅允许 https 外发至白名单或 workers.dev
function isSafePrintUrl(u: string): boolean {
  try {
    const url = new URL(u);
    if (url.protocol !== "https:") return false;
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return false;
    if (
      /^10\./.test(url.hostname) ||
      /^192\.168\./.test(url.hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(url.hostname)
    )
      return false;
    // 额外白名单：可配 PRINT_WORKER_ALLOWLIST=host1,host2
    const allow = (process.env.PRINT_WORKER_ALLOWLIST || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (
      allow.length &&
      !allow.includes(url.hostname) &&
      !url.hostname.endsWith(".workers.dev")
    )
      return false;
    return true;
  } catch {
    return false;
  }
}
// P0-5 原子写
function writeFileAtomic(filePath: string, data: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = filePath + "." + crypto.randomBytes(6).toString("hex") + ".tmp";
  fs.writeFileSync(tmp, data, "utf-8");
  fs.renameSync(tmp, filePath);
}

dotenv.config();

const app = express();
const PORT = 3000;

// P1-7 CORS 白名单 - B1 修复：生产未配则默认拒绝
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const isProdCors = process.env.NODE_ENV === "production";
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.length === 0) {
        if (isProdCors)
          return cb(
            new Error("CORS blocked: CORS_ORIGINS not configured"),
            false,
          );
        return cb(null, true);
      }
      if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes("*"))
        return cb(null, true);
      return cb(new Error("CORS blocked"), false);
    },
    credentials: true,
  }),
);
app.use(requestLogger);
app.use(express.json({ limit: "1mb" }));
app.use("/api/auth", authRouter);

const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_D1_DB_ID = process.env.CLOUDFLARE_D1_DB_ID;

const LOCAL_DB_FILE = path.join(process.cwd(), "local-settings.json");

async function queryD1(sql: string, params: any[] = []) {
  if (!CF_API_TOKEN || !CF_ACCOUNT_ID || !CF_D1_DB_ID) {
    throw new Error("Cloudflare configuration is missing.");
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DB_ID}/query`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("D1 Query Error:", errText);
    throw new Error(
      `D1 query failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  if (!data.success) {
    console.error("D1 Error details:", JSON.stringify(data.errors));
    throw new Error("D1 query returned unsuccessful result.");
  }

  return data.result[0];
}

// Ensure the table exists
app.post("/api/init-db", requireAdmin, async (req, res) => {
  try {
    if (CF_API_TOKEN && CF_ACCOUNT_ID && CF_D1_DB_ID) {
      const result = await queryD1(
        "CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, data TEXT)",
      );
      res.json({ success: true, result });
    } else {
      res.json({ success: true, localOnly: true });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check DB Status
app.get("/api/db-status", async (req, res) => {
  try {
    if (CF_API_TOKEN && CF_ACCOUNT_ID && CF_D1_DB_ID) {
      // Test query
      await queryD1("SELECT 1");
      res.json({ connected: true, type: "cloudflare-d1" });
    } else {
      res.json({ connected: true, type: "local-json" });
    }
  } catch (error: any) {
    res.json({ connected: false, error: error.message });
  }
});

// Get settings
app.get("/api/settings", async (req, res) => {
  try {
    if (CF_API_TOKEN && CF_ACCOUNT_ID && CF_D1_DB_ID) {
      const result = await queryD1("SELECT data FROM settings WHERE id = ?", [
        "global",
      ]);
      if (result.results && result.results.length > 0) {
        const dataStr = result.results[0].data;
        res.json(JSON.parse(dataStr));
      } else {
        res.json(null);
      }
    } else {
      // Local fallback
      if (fs.existsSync(LOCAL_DB_FILE)) {
        res.json(JSON.parse(fs.readFileSync(LOCAL_DB_FILE, "utf-8")));
      } else {
        res.json(null);
      }
    }
  } catch (error: any) {
    console.error("Failed to get settings:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update settings
app.post("/api/settings", requireAdmin, async (req, res) => {
  try {
    const payload = req.body;
    const dataStr = JSON.stringify(payload);

    if (CF_API_TOKEN && CF_ACCOUNT_ID && CF_D1_DB_ID) {
      // Insert or Replace (Upsert)
      await queryD1(
        "INSERT INTO settings (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
        ["global", dataStr],
      );
    } else {
      // Local fallback - P0-5 原子写
      writeFileAtomic(LOCAL_DB_FILE, dataStr);
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error("Failed to update settings:", error);
    res.status(500).json({ error: error.message });
  }
});

// Post orders
// fallback to /tmp to avoid EROFS in Cloud Run
const LOCAL_ORDERS_FILE = path.join(
  process.env.NODE_ENV === "production" ? "/tmp" : process.cwd(),
  "local-orders.json",
);
if (
  process.env.NODE_ENV === "production" &&
  !fs.existsSync(LOCAL_ORDERS_FILE)
) {
  const bakedIn = path.join(process.cwd(), "local-orders.json");
  if (fs.existsSync(bakedIn)) {
    try {
      fs.copyFileSync(bakedIn, LOCAL_ORDERS_FILE);
    } catch {}
  }
}
// P0-5 原子写 + 无锁改原子
function writeOrdersSafely(filePath: string, orders: any[]) {
  writeFileAtomic(filePath, JSON.stringify(orders, null, 2));
}

app.post("/api/orders", rateLimit(60_000, 20), async (req, res) => {
  try {
    const payload = req.body;
    payload.timestamp = new Date().toISOString();
    if (!payload.orderNumber) {
      payload.orderNumber = "ORD-" + Math.floor(Math.random() * 1000000);
    }
    // Log the order received
    console.log("Received local order:", payload);

    // Save to local-orders.json safely
    let orders = [];
    if (fs.existsSync(LOCAL_ORDERS_FILE)) {
      try {
        orders = JSON.parse(fs.readFileSync(LOCAL_ORDERS_FILE, "utf-8"));
        if (!Array.isArray(orders)) orders = [];
      } catch {}
    }
    orders.push(payload);
    writeOrdersSafely(LOCAL_ORDERS_FILE, orders);

    // Send the order to external worker (可配置) - P1-10 SSRF 校验
    const printWorkerUrl =
      process.env.PRINT_WORKER_URL ||
      "https://dayin.shahuiqing2024.workers.dev/";
    const printWorkerToken = process.env.PRINT_WORKER_TOKEN;
    if (printWorkerUrl) {
      if (!isSafePrintUrl(printWorkerUrl)) {
        console.warn(
          `[security] blocked unsafe PRINT_WORKER_URL: ${printWorkerUrl}`,
        );
      } else {
        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (printWorkerToken)
            headers["Authorization"] = `Bearer ${printWorkerToken}`;
          fetch(printWorkerUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
          }).catch((err) =>
            console.error("Error sending to external worker:", err),
          );
        } catch (e) {
          console.error("Failed to initiate external worker request", e);
        }
      }
    }

    res.json({
      success: true,
      message: "Order received successfully",
      order: payload,
    });
  } catch (error: any) {
    console.error("Failed to post order:", error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook for receiving external orders - 需配置 PRINT_WORKER_TOKEN 或 ADMIN_SECRET 二选一
app.post("/api/webhooks/orders", rateLimit(60_000, 30), async (req, res) => {
  const expectedToken =
    process.env.PRINT_WORKER_TOKEN || process.env.ADMIN_SECRET;
  if (expectedToken) {
    const got =
      (req.headers["x-webhook-token"] as string) ||
      (req.headers["authorization"] as string)?.replace("Bearer ", "") ||
      (req.body as any)?.token;
    if (got !== expectedToken) {
      return res.status(401).json({ error: "Unauthorized webhook token" });
    }
  }
  try {
    const payload = req.body;
    console.log("Received Webhook Order:", payload);

    const order = {
      orderNumber: payload.orderNumber || "EXT-" + Date.now(),
      customerName: payload.customerName || "External Customer",
      items: payload.items || [],
      total: payload.total || 0,
      notes: payload.notes || "",
      timestamp: new Date().toISOString(),
      isExternal: true,
    };

    let orders = [];
    if (fs.existsSync(LOCAL_ORDERS_FILE)) {
      try {
        orders = JSON.parse(fs.readFileSync(LOCAL_ORDERS_FILE, "utf-8"));
      } catch {}
    }
    orders.push(order);
    writeFileAtomic(LOCAL_ORDERS_FILE, JSON.stringify(orders, null, 2));

    res.json({ success: true, message: "Order received via Webhook", order });
  } catch (error: any) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/orders", rateLimit(60_000, 60), async (req, res) => {
  try {
    let orders = [];
    if (fs.existsSync(LOCAL_ORDERS_FILE)) {
      try {
        orders = JSON.parse(fs.readFileSync(LOCAL_ORDERS_FILE, "utf-8"));
      } catch {}
    }
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/orders", requireAdmin, async (req, res) => {
  try {
    writeFileAtomic(LOCAL_ORDERS_FILE, JSON.stringify([], null, 2));
    res.json({ success: true, message: "Orders cleared successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// EdgeOne Pages Blob & KV API - 写入需鉴权，读取公开
app.post("/api/edgeone-kv/put", requireAdmin, async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: "key is required" });

    // 尝试直接调用 EdgeOne 原生环境绑定的全局对象 (如 my_kv)
    const globalKv =
      (globalThis as any).my_kv || (globalThis as any).env?.my_kv;
    if (globalKv && typeof globalKv.put === "function") {
      await globalKv.put(
        key,
        typeof value === "object" ? JSON.stringify(value) : String(value),
      );
      return res.json({ success: true, key, source: "edgeone-native-kv" });
    }

    // 尝试调用 EdgeOne Blob / 本地文件模拟层
    try {
      const { getStore } = await import("@edgeone/pages-blob");
      const store = getStore("my-store");
      await store.set(
        key,
        typeof value === "object" ? JSON.stringify(value) : String(value),
      );
    } catch {
      const storageDir = path.join(
        process.env.NODE_ENV === "production" ? "/tmp" : process.cwd(),
        "kv-data",
      );
      if (!fs.existsSync(storageDir))
        fs.mkdirSync(storageDir, { recursive: true });
      const safeKey = String(key).replace(/[/\\?%*:|"<>]/g, "_");
      writeFileAtomic(
        path.join(storageDir, safeKey),
        typeof value === "object" ? JSON.stringify(value) : String(value),
      );
    }
    res.json({ success: true, key });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/edgeone-kv/get", async (req, res) => {
  try {
    const key = req.query.key as string;
    const type = (req.query.type as string) || "text";
    if (!key) return res.status(400).json({ error: "key is required" });

    // 优先尝试 EdgeOne 原生环境 my_kv.get()
    const globalKv =
      (globalThis as any).my_kv || (globalThis as any).env?.my_kv;
    if (globalKv && typeof globalKv.get === "function") {
      const val = await globalKv.get(
        key,
        type === "json" ? { type: "json" } : "text",
      );
      return res.json({
        success: true,
        value: val,
        source: "edgeone-native-kv",
      });
    }

    try {
      const { getStore } = await import("@edgeone/pages-blob");
      const store = getStore("my-store");
      const content = await store.get(key, { consistency: "strong" });
      let val = content;
      if (type === "json" && typeof content === "string") {
        try {
          val = JSON.parse(content);
        } catch {}
      }
      return res.json({ success: true, value: val });
    } catch {
      const storageDir = path.join(
        process.env.NODE_ENV === "production" ? "/tmp" : process.cwd(),
        "kv-data",
      );
      const safeKey = String(key).replace(/[/\\?%*:|"<>]/g, "_");
      const filePath = path.join(storageDir, safeKey);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        let val: any = raw;
        if (type === "json") {
          try {
            val = JSON.parse(raw);
          } catch {}
        }
        return res.json({ success: true, value: val });
      }
      return res.json({ success: true, value: null });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/edgeone-kv/delete", requireAdmin, async (req, res) => {
  try {
    const key = (req.query.key as string) || req.body?.key;
    if (!key) return res.status(400).json({ error: "key is required" });

    const globalKv =
      (globalThis as any).my_kv || (globalThis as any).env?.my_kv;
    if (globalKv && typeof globalKv.delete === "function") {
      await globalKv.delete(key);
      return res.json({ success: true, key, source: "edgeone-native-kv" });
    }

    const storageDir = path.join(
      process.env.NODE_ENV === "production" ? "/tmp" : process.cwd(),
      "kv-data",
    );
    const safeKey = String(key).replace(/[/\\?%*:|"<>]/g, "_");
    const filePath = path.join(storageDir, safeKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.json({ success: true, key });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/edgeone-kv/list", async (req, res) => {
  try {
    const prefix = (req.query.prefix as string) || "";
    const limit = parseInt((req.query.limit as string) || "256", 10);
    const cursor = (req.query.cursor as string) || "";

    const globalKv =
      (globalThis as any).my_kv || (globalThis as any).env?.my_kv;
    if (globalKv && typeof globalKv.list === "function") {
      const listRes = await globalKv.list({ prefix, limit, cursor });
      return res.json({
        success: true,
        ...listRes,
        source: "edgeone-native-kv",
      });
    }

    // 本地存储目录遍历
    const storageDir = path.join(
      process.env.NODE_ENV === "production" ? "/tmp" : process.cwd(),
      "kv-data",
    );
    if (!fs.existsSync(storageDir)) {
      return res.json({
        success: true,
        complete: true,
        cursor: null,
        keys: [],
      });
    }

    let files = fs.readdirSync(storageDir);
    if (prefix) {
      files = files.filter((f) => f.startsWith(prefix));
    }
    files.sort();

    const keys = files.slice(0, limit).map((f) => ({ key: f }));
    res.json({
      success: true,
      complete: files.length <= limit,
      cursor: files.length > limit ? files[limit - 1] : null,
      keys,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// EdgeOne Pages Blob API (兼容保留) - 写入需鉴权
app.post("/api/edgeone-blob/set", requireAdmin, async (req, res) => {
  try {
    const { key, value, storeName = "my-store" } = req.body;
    if (!key) return res.status(400).json({ error: "key is required" });

    try {
      const { getStore } = await import("@edgeone/pages-blob");
      const store = getStore(storeName);
      await store.set(key, value);
    } catch {
      const storageDir = path.join(
        process.env.NODE_ENV === "production" ? "/tmp" : process.cwd(),
        "blob-data",
      );
      if (!fs.existsSync(storageDir))
        fs.mkdirSync(storageDir, { recursive: true });
      const safeKey = String(key).replace(/[/\\?%*:|"<>]/g, "_");
      writeFileAtomic(
        path.join(storageDir, safeKey),
        typeof value === "object" ? JSON.stringify(value) : String(value),
      );
    }
    res.json({ success: true, key });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/edgeone-blob/get", async (req, res) => {
  try {
    const key = req.query.key as string;
    const storeName = (req.query.storeName as string) || "my-store";
    const consistency = req.query.consistency as string;

    if (!key) return res.status(400).json({ error: "key is required" });

    try {
      const { getStore } = await import("@edgeone/pages-blob");
      const store = getStore(storeName);
      const content = await store.get(
        key,
        consistency === "strong"
          ? ({ consistency: "strong" } as any)
          : undefined,
      );
      return res.json({ success: true, value: content });
    } catch {
      const storageDir = path.join(
        process.env.NODE_ENV === "production" ? "/tmp" : process.cwd(),
        "blob-data",
      );
      const safeKey = String(key).replace(/[/\\?%*:|"<>]/g, "_");
      const filePath = path.join(storageDir, safeKey);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        return res.json({ success: true, value: content });
      }
      return res.json({ success: true, value: null });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.use(errorHandler);

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // V1 切 cartHub 统一（消内存直写）
  const { clients, tableCarts } = cartHub;

  app.post("/api/sync-cart", rateLimit(60_000, 60), async (req, res) => {
    const { table, cart } = req.body;
    if (!table) return res.status(400).json({ error: "table required" });
    await cartHub.setCart(table, cart);
    cartHub.broadcastCart(table, cart);
    res.json({ success: true });
  });

  app.post("/api/notify-admin", rateLimit(60_000, 60), (req, res) => {
    const { message, notifyType, table, action } = req.body;
    cartHub.broadcastAdmin({ message, notifyType, table, action });
    res.json({ success: true });
  });

  app.post("/api/clear-table-cart", rateLimit(60_000, 30), async (req, res) => {
    const { table } = req.body;
    if (table && tableCarts[table]) {
      await cartHub.clearCart(table);
      cartHub.broadcastCart(table, {});
    }
    res.json({ success: true });
  });

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const table = url.searchParams.get("table") || "admin";
    const role = url.searchParams.get("role") || "customer";

    const client = { ws, table, role };
    clients.add(client);

    if (role === "customer" && tableCarts[table]) {
      ws.send(JSON.stringify({ type: "cart_sync", cart: tableCarts[table] }));
    }

    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === "sync-cart") {
          await cartHub.setCart(data.table, data.cart);
          cartHub.broadcastCart(data.table, data.cart, ws);
        } else if (data.type === "notify-admin") {
          cartHub.broadcastAdmin({
            message: data.message,
            notifyType: data.notifyType,
            table: data.table,
            action: data.action,
          });
        } else if (data.type === "clear-table-cart") {
          if (data.table && tableCarts[data.table]) {
            await cartHub.clearCart(data.table);
            cartHub.broadcastCart(data.table, {});
          }
        } else if (data.type === "new-order" && data.order) {
          // 局域网订单备用通道：广播给所有在线设备（后厨/管理端），并落本地文件
          const msg = JSON.stringify({
            type: "order_received",
            order: data.order,
          });
          for (const c of clients) {
            try {
              c.ws.send(msg);
            } catch {}
          }
          try {
            let orders: any[] = [];
            if (fs.existsSync(LOCAL_ORDERS_FILE)) {
              try {
                orders = JSON.parse(
                  fs.readFileSync(LOCAL_ORDERS_FILE, "utf-8"),
                );
              } catch {}
              if (!Array.isArray(orders)) orders = [];
            }
            orders.push(data.order);
            writeOrdersSafely(LOCAL_ORDERS_FILE, orders);
          } catch {}
        }
      } catch {}
    });

    ws.on("close", () => {
      clients.delete(client);
    });
  });

  // Keep server cached orders intact; orders should only be removed when managed or cleared by administrator.
}

startServer();
