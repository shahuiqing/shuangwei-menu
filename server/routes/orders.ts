import { Router } from "express";
import path from "path";
import { requireAdmin } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { writeFileAtomic, readJsonSafe } from "../utils/atomicWrite";

const router = Router();
const LOCAL_ORDERS_FILE = path.join(
  process.env.NODE_ENV === "production" ? "/tmp" : process.cwd(),
  "local-orders.json",
);

router.post("/", rateLimit(60_000, 20), (req, res) => {
  try {
    const payload: any = req.body;
    if (
      !payload.items ||
      !Array.isArray(payload.items) ||
      payload.items.length === 0
    ) {
      console.warn(
        `[${new Date().toISOString()}] [warn] [orders] create validation failed: items empty`,
      );
      return res
        .status(400)
        .json({ error: "items required", code: "E_ORDERS_VALIDATE" });
    }
    payload.timestamp = new Date().toISOString();
    if (!payload.orderNumber)
      payload.orderNumber = "ORD-" + Math.floor(Math.random() * 1000000);
    console.log(
      `[${new Date().toISOString()}] [info] [orders] create ${payload.orderNumber} table=${payload.table_no || payload.customerName} items=${payload.items.length}`,
    );
    let orders: any[] = readJsonSafe(LOCAL_ORDERS_FILE, []);
    if (!Array.isArray(orders)) orders = [];
    orders.push(payload);
    try {
      writeFileAtomic(LOCAL_ORDERS_FILE, JSON.stringify(orders, null, 2));
    } catch (e) {
      console.error("[orders] write local failed", e);
      return res
        .status(500)
        .json({ error: "write failed", code: "E_ORDERS_WRITE" });
    }
    const url =
      process.env.PRINT_WORKER_URL ||
      "https://dayin.shahuiqing2024.workers.dev/";
    const token = process.env.PRINT_WORKER_TOKEN;
    if (url) {
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }).catch((e) => console.error("[print]", e));
    }
    console.log(
      `[${new Date().toISOString()}] [info] [orders] created ${payload.orderNumber}`,
    );
    res.json({ success: true, order: payload });
  } catch (e: any) {
    console.error("[orders] create error", e);
    res.status(500).json({ error: e.message, code: "E_ORDERS_WRITE" });
  }
});

router.post("/webhooks/orders", rateLimit(60_000, 30), (req, res) => {
  const expected = process.env.PRINT_WORKER_TOKEN || process.env.ADMIN_SECRET;
  if (expected) {
    const got =
      (req.headers["x-webhook-token"] as string) ||
      (req.headers.authorization as string)?.replace("Bearer ", "") ||
      (req.body as any)?.token;
    if (got !== expected)
      return res.status(401).json({ error: "Unauthorized webhook" });
  }
  try {
    const p: any = req.body;
    const order = {
      orderNumber: p.orderNumber || "EXT-" + Date.now(),
      customerName: p.customerName || "External",
      items: p.items || [],
      total: p.total || 0,
      notes: p.notes || "",
      timestamp: new Date().toISOString(),
      isExternal: true,
    };
    const orders: any[] = readJsonSafe(LOCAL_ORDERS_FILE, []);
    orders.push(order);
    writeFileAtomic(LOCAL_ORDERS_FILE, JSON.stringify(orders, null, 2));
    res.json({ success: true, order });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/", rateLimit(60_000, 60), (req, res) => {
  try {
    const limit = Math.min(
      parseInt((req.query.limit as string) || "200", 10) || 200,
      1000,
    );
    let orders: any[] = readJsonSafe(LOCAL_ORDERS_FILE, []);
    if (!Array.isArray(orders)) orders = [];
    // 按时间倒序截断，避免一次返回数千单
    if (orders.length > limit) orders = orders.slice(-limit);
    res.setHeader("X-Total-Count", String(orders.length));
    res.json(orders);
  } catch (e: any) {
    console.error("[orders] list error", e);
    res.status(500).json({ error: e.message, code: "E_ORDERS_READ" });
  }
});

router.delete("/", requireAdmin, (_req, res) => {
  try {
    writeFileAtomic(LOCAL_ORDERS_FILE, JSON.stringify([], null, 2));
    res.json({ success: true });
  } catch (e: any) {
    console.error("[orders] clear failed", e);
    res.status(500).json({ error: e.message, code: "E_ORDERS_WRITE" });
  }
});

export default router;
