/**
 * 局域网订单备用通道
 *
 * 目的：当 Supabase 数据库不可用时，通过局域网在同一网络内的设备间传输订单，
 * 作为备用手段，不完全依赖数据库。
 *
 * 启用条件：应用由本机 server.ts 提供服务（http://局域网IP:3000）。
 * 若部署在 EdgeOne（HTTPS），浏览器禁止从 HTTPS 页面连接 HTTP/ws，故自动禁用。
 */

type OrderListener = (order: any) => void;
type StatusListener = (connected: boolean) => void;

class LanSyncManager {
  private ws: WebSocket | null = null;
  private listeners: OrderListener[] = [];
  private statusListeners: StatusListener[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  private connected = false;

  /** 是否处于局域网模式（由本机 server 提供服务，HTTP） */
  isLanMode(): boolean {
    if (typeof window === "undefined") return false;
    return window.location.protocol === "http:";
  }

  get isConnected(): boolean {
    return this.connected;
  }

  init() {
    if (this.started) return;
    if (!this.isLanMode()) return;
    this.started = true;
    this.connect();
  }

  private connect() {
    if (typeof window === "undefined") return;
    if (!this.isLanMode()) return;
    try {
      const ws = new WebSocket(`ws://${window.location.host}`);
      this.ws = ws;
      ws.onopen = () => {
        this.connected = true;
        this.statusListeners.forEach((cb) => cb(true));
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data?.type === "order_received" && data.order) {
            this.listeners.forEach((cb) => cb(data.order));
          }
        } catch {
          /* ignore malformed */
        }
      };
      ws.onclose = () => {
        this.connected = false;
        this.statusListeners.forEach((cb) => cb(false));
        this.scheduleReconnect();
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  /** 通过局域网发送订单（备用通道），返回是否走了 WebSocket */
  sendOrder(order: any): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: "new-order", order }));
        return true;
      } catch {
        /* fallthrough to HTTP */
      }
    }
    // HTTP 兜底（server.ts 的 /api/orders）
    try {
      fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order),
      }).catch(() => {});
    } catch {
      /* ignore */
    }
    return false;
  }

  subscribeOrders(cb: OrderListener): () => void {
    this.init();
    this.listeners.push(cb);
    return () => {
      const i = this.listeners.indexOf(cb);
      if (i > -1) this.listeners.splice(i, 1);
    };
  }

  subscribeStatus(cb: StatusListener): () => void {
    this.init();
    this.statusListeners.push(cb);
    cb(this.connected);
    return () => {
      const i = this.statusListeners.indexOf(cb);
      if (i > -1) this.statusListeners.splice(i, 1);
    };
  }
}

export const lanSync = new LanSyncManager();
