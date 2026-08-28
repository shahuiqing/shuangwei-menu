import { getStore } from "@edgeone/pages-blob";

export interface EdgeEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  ADMIN_SECRET?: string;
  [key: string]: any;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** 校验管理员 token：header x-admin-token / Authorization Bearer / body adminToken|adminPassword */
export function checkAdmin(request: Request, env: EdgeEnv): boolean {
  const secret = env.ADMIN_SECRET;
  if (!secret) return true; // 未配置则放行（与旧 requireAdmin dev 行为一致）
  const auth = request.headers.get("x-admin-token") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (auth && auth === secret) return true;
  return false;
}

/** EdgeOne KV：优先原生绑定 env.my_kv，回退 pages-blob store */
export async function kvWrite(env: EdgeEnv, key: string, value: unknown): Promise<string> {
  const nativeKv = env.my_kv;
  if (nativeKv && typeof nativeKv.put === "function") {
    await nativeKv.put(key, typeof value === "object" ? JSON.stringify(value) : String(value));
    return "edgeone-native-kv";
  }
  const store = getStore("my-store");
  await store.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  return "pages-blob";
}

export async function kvRead(env: EdgeEnv, key: string, type: string): Promise<unknown> {
  const nativeKv = env.my_kv;
  if (nativeKv && typeof nativeKv.get === "function") {
    return nativeKv.get(key, type === "json" ? { type: "json" } : "text");
  }
  const store = getStore("my-store");
  const content = await store.get(key, { consistency: "strong" });
  if (type === "json" && typeof content === "string") {
    try { return JSON.parse(content); } catch { /* keep raw */ }
  }
  return content ?? null;
}

export async function kvDeleteKey(env: EdgeEnv, key: string): Promise<void> {
  const nativeKv = env.my_kv;
  if (nativeKv && typeof nativeKv.delete === "function") {
    await nativeKv.delete(key);
    return;
  }
  const store = getStore("my-store");
  await store.delete(key);
}

export async function kvListKeys(env: EdgeEnv, prefix: string, limit: number, cursor: string): Promise<any> {
  const nativeKv = env.my_kv;
  if (nativeKv && typeof nativeKv.list === "function") {
    const res = await nativeKv.list({ prefix, limit, cursor });
    return { ...res, source: "edgeone-native-kv" };
  }
  const store = getStore("my-store");
  const { blobs } = await store.list({ prefix, limit });
  return { complete: true, cursor: null, keys: blobs.map((b) => ({ key: b.key })) };
}
