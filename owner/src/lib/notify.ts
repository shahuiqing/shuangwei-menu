import { fmtMoney, STATUS_TEXT, tableName } from "./format";

/* ============ 本地系统通知（零后端） ============
 * 只在页面/PWA 打开时触发（无服务端，不做离线推送），
 * 优先走 Service Worker showNotification，失败回落 Notification 构造函数。
 */

/** 是否开启「新订单通知」（本机） */
export const NOTIFY_KEY = "owner:notify:orders";

export type NotifyPermission = "unsupported" | NotificationPermission;

export function notifySupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notifyPermission(): NotifyPermission {
  if (!notifySupported()) return "unsupported";
  return Notification.permission;
}

export function notifyEnabled(): boolean {
  if (!notifySupported() || Notification.permission !== "granted") return false;
  try {
    return localStorage.getItem(NOTIFY_KEY) === "1";
  } catch {
    return false;
  }
}

export function setNotifyEnabled(on: boolean): void {
  try {
    localStorage.setItem(NOTIFY_KEY, on ? "1" : "0");
  } catch {
    /* 隐身模式等忽略 */
  }
}

/** 用户手势里调用，返回最新权限态 */
export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (!notifySupported()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/**
 * 弹一条系统通知；无权限/不支持直接返回 false（不抛错）。
 * PWA 下优先用 SW 的 showNotification（图标路径与作用域更可控）。
 */
export async function showNotify(
  title: string,
  body: string,
  opts: { tag?: string } = {},
): Promise<boolean> {
  if (!notifySupported() || Notification.permission !== "granted") return false;
  const payload = {
    body,
    tag: opts.tag,
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    dir: "auto" as const,
    lang: "zh-CN",
  };

  // SW 未注册时 ready 可能永远 pending → 超时回落
  try {
    const reg = await Promise.race([
      navigator.serviceWorker?.ready as
        Promise<ServiceWorkerRegistration> | undefined,
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("sw")), 1200),
      ),
    ]);
    if (reg) {
      await reg.showNotification(title, payload);
      return true;
    }
  } catch {
    /* 走回落 */
  }

  try {
    new Notification(title, payload);
    return true;
  } catch {
    return false;
  }
}

/* ---- 事件 → 通知 的纯逻辑（便于测试） ---- */

/** 是否需要通知：待接单且未通知过（避免刷新/重复订阅刷屏） */
export function shouldNotifyOrder(
  order: { id?: string; _id?: string; status?: string } | null | undefined,
  seen: ReadonlySet<string>,
): boolean {
  const id = String(order?.id || order?._id || "").trim();
  if (!id || seen.has(id)) return false;
  return String(order?.status || "") === "pending";
}

export function orderId(
  order: { id?: string; _id?: string } | null | undefined,
): string {
  return String(order?.id || order?._id || "").trim();
}

/** 新订单通知文案 */
export function orderNotice(
  order: any,
  storeName: string,
): { title: string; body: string } {
  const table = tableName(order) || "堂食";
  const total = Number(
    order?.finalTotal ?? order?.total ?? order?.total_amount ?? 0,
  );
  const status = STATUS_TEXT[String(order?.status || "pending")] || "待接单";
  return {
    title: `${storeName} · 新订单 ${table}`,
    body: `${fmtMoney(total)} · ${status}，请尽快接单`,
  };
}
