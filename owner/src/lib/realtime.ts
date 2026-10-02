/**
 * 老板端实时同步（Supabase Realtime）
 * - 独立频道 owner-sync，避免与顾客端 restaurant-sync 互相干扰
 * - 只订阅 orders / settings 的变更，事件成本低
 * - 断线自动重建
 */
import { supabase } from "./supabase";

export interface OrderChange {
  eventType: "INSERT" | "UPDATE" | "DELETE" | string;
  new: any;
  old: any;
}

export interface OwnerRealtimeHandlers {
  onOrder: (c: OrderChange) => void;
  onSettings: () => void;
  onStatus?: (status: string) => void;
}

export function subscribeOwner(handlers: OwnerRealtimeHandlers): () => void {
  if (!supabase) return () => {};
  let channel: any = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const connect = () => {
    if (closed || !supabase) return;
    channel = supabase.channel("owner-sync", {
      config: { broadcast: { self: true } },
    });
    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload: any) =>
          handlers.onOrder({
            eventType: payload.eventType,
            new: payload.new,
            old: payload.old,
          }),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "settings",
          filter: "id=eq.global",
        },
        () => handlers.onSettings(),
      )
      .subscribe((status: string) => {
        handlers.onStatus?.(status);
        if (
          status === "CLOSED" ||
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          try {
            if (channel) supabase!.removeChannel(channel);
          } catch {
            /* ignore */
          }
          channel = null;
          if (!retry) {
            retry = setTimeout(() => {
              retry = null;
              connect();
            }, 3000);
          }
        }
      });
  };

  connect();

  return () => {
    closed = true;
    if (retry) clearTimeout(retry);
    try {
      if (channel) supabase!.removeChannel(channel);
    } catch {
      /* ignore */
    }
  };
}
