/**
 * 腾讯云 EdgeOne KV / 高速 Key-Value 缓存层服务
 * 负责高频读取数据（如菜单、分类、物料库存、设置）的高速缓存与主动失效
 */

export interface KVCacheConfig {
  endpoint?: string;
  namespace?: string;
  apiToken?: string;
  ttlSeconds?: number;
}

const DEFAULT_TTL = 300; // 默认 5 分钟缓存

class KVCacheManager {
  ariaMemoryCache = new Map<string, { value: any; expiresAt: number }>();

  // 获取缓存配置
  getConfig(): KVCacheConfig {
    if (typeof window === "undefined") return {};
    return {
      endpoint:
        localStorage.getItem("custom_tencent_kv_endpoint") ||
        import.meta.env.VITE_TENCENT_KV_ENDPOINT ||
        "",
      namespace:
        localStorage.getItem("custom_tencent_kv_namespace") ||
        import.meta.env.VITE_TENCENT_KV_NAMESPACE ||
        "restaurant_kv",
      apiToken:
        localStorage.getItem("custom_tencent_kv_token") ||
        import.meta.env.VITE_TENCENT_KV_TOKEN ||
        "",
      ttlSeconds:
        Number(localStorage.getItem("custom_tencent_kv_ttl")) || DEFAULT_TTL,
    };
  }

  // 保存缓存配置
  saveConfig(config: KVCacheConfig) {
    if (typeof window === "undefined") return;
    if (config.endpoint !== undefined)
      localStorage.setItem("custom_tencent_kv_endpoint", config.endpoint);
    if (config.namespace !== undefined)
      localStorage.setItem("custom_tencent_kv_namespace", config.namespace);
    if (config.apiToken !== undefined)
      localStorage.setItem("custom_tencent_kv_token", config.apiToken);
    if (config.ttlSeconds !== undefined)
      localStorage.setItem("custom_tencent_kv_ttl", String(config.ttlSeconds));
  }

  // 从 KV 缓存读取
  async get<T>(key: string): Promise<T | null> {
    const now = Date.now();

    // 1. 优先从内存极速 KV 缓存读取
    const memEntry = this.ariaMemoryCache.get(key);
    if (memEntry && memEntry.expiresAt > now) {
      return memEntry.value as T;
    }

    // 2. 尝试从腾讯云 KV 接口获取 (若配置了远程 Endpoint)
    const config = this.getConfig();
    if (config.endpoint && config.apiToken) {
      try {
        const response = await fetch(
          `${config.endpoint}/get?namespace=${config.namespace}&key=${encodeURIComponent(key)}`,
          {
            headers: {
              Authorization: `Bearer ${config.apiToken}`,
            },
          },
        );
        if (response.ok) {
          const data = await response.json();
          if (data && data.value !== undefined) {
            const parsed =
              typeof data.value === "string"
                ? JSON.parse(data.value)
                : data.value;
            this.ariaMemoryCache.set(key, {
              value: parsed,
              expiresAt: now + (config.ttlSeconds || DEFAULT_TTL) * 1000,
            });
            return parsed as T;
          }
        }
      } catch (err) {
        console.warn(`[Tencent KV] Failed to fetch key ${key}:`, err);
      }
    }

    // 3. 本地存储 Local KV 备用层
    try {
      const localStr = localStorage.getItem(`kv_cache_${key}`);
      if (localStr) {
        const item = JSON.parse(localStr);
        if (item.expiresAt > now) {
          this.ariaMemoryCache.set(key, {
            value: item.value,
            expiresAt: item.expiresAt,
          });
          return item.value as T;
        } else {
          localStorage.removeItem(`kv_cache_${key}`);
        }
      }
    } catch (e) {
      console.warn(`[Local KV] Parse error for ${key}:`, e);
    }

    return null;
  }

  // 写入 KV 缓存
  async set(key: string, value: any, customTtl?: number): Promise<void> {
    const config = this.getConfig();
    const ttl = customTtl || config.ttlSeconds || DEFAULT_TTL;
    const expiresAt = Date.now() + ttl * 1000;

    // 1. 写入内存极速缓存
    this.ariaMemoryCache.set(key, { value, expiresAt });

    // 2. 写入本地 Local KV 缓存
    try {
      localStorage.setItem(
        `kv_cache_${key}`,
        JSON.stringify({ value, expiresAt }),
      );
    } catch {
      console.warn(`[Local KV] Storage limit reached for ${key}`);
    }

    // 3. 异步推送到腾讯云 EdgeOne KV
    if (config.endpoint && config.apiToken) {
      try {
        await fetch(`${config.endpoint}/set`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiToken}`,
          },
          body: JSON.stringify({
            namespace: config.namespace,
            key,
            value: typeof value === "object" ? JSON.stringify(value) : value,
            ttl,
          }),
        });
      } catch (err) {
        console.warn(`[Tencent KV] Remote set failed for ${key}:`, err);
      }
    }
  }

  // 使某个 Key 的缓存失效
  async invalidate(key: string): Promise<void> {
    this.ariaMemoryCache.delete(key);
    try {
      localStorage.removeItem(`kv_cache_${key}`);
    } catch {}

    const config = this.getConfig();
    if (config.endpoint && config.apiToken) {
      try {
        await fetch(`${config.endpoint}/delete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiToken}`,
          },
          body: JSON.stringify({
            namespace: config.namespace,
            key,
          }),
        });
      } catch (err) {
        console.warn(`[Tencent KV] Remote delete failed for ${key}:`, err);
      }
    }
  }

  // 清空所有本地 KV 缓存
  clearAll() {
    this.ariaMemoryCache.clear();
    if (typeof window !== "undefined") {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("kv_cache_")) {
          localStorage.removeItem(k);
        }
      });
    }
  }
}

export const kvCache = new KVCacheManager();
