/**
 * KV Storage Utility Helper Functions
 * Supports EdgeOne Pages KV / Cloudflare KV / Local Storage Fallback with full logging and error handling.
 */

import { kvCache } from "../services/kvCache";

export interface ListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

export interface ListResult {
  complete: boolean;
  cursor: string | null;
  keys: Array<{ key: string }>;
}

/**
 * Get a value from KV storage by key.
 * @param key Key identifier
 * @param defaultValue Fallback value if key is not found or error occurs
 * @param type Return type format ("text" | "json")
 */
export async function kvGet<T = any>(
  key: string,
  defaultValue: T | null = null,
  type: "text" | "json" = "json",
): Promise<T | null> {
  try {
    console.log(`[KV Log] Fetching key "${key}" (type: ${type})...`);

    // 1. Try reading directly from EdgeOne Server KV endpoint if in browser
    if (typeof window !== "undefined") {
      try {
        const res = await fetch(
          `/api/edgeone-kv/get?key=${encodeURIComponent(key)}&type=${type}`,
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.value !== null && data.value !== undefined) {
            console.log(
              `[KV Log] Successfully retrieved key "${key}" from EdgeOne KV.`,
            );
            return data.value as T;
          }
        }
      } catch (apiErr) {
        console.warn(
          `[KV Warning] Server EdgeOne KV fetch failed for "${key}", falling back:`,
          apiErr,
        );
      }
    }

    // 2. Fallback to KVCacheManager
    const cached = await kvCache.get<T>(key);
    if (cached !== null && cached !== undefined) {
      console.log(
        `[KV Log] Retrieved key "${key}" from local KV cache manager.`,
      );
      return cached;
    }

    console.log(`[KV Log] Key "${key}" not found. Returning default value.`);
    return defaultValue;
  } catch (error) {
    console.error(`[KV Error] Failed to get key "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Save or update a value in EdgeOne KV storage.
 * @param key Key identifier (length <= 512 B)
 * @param value Value to store (<= 25 MB)
 * @param ttlSeconds Optional Time-To-Live in seconds
 */
export async function kvPut<T = any>(
  key: string,
  value: T,
  ttlSeconds?: number,
): Promise<boolean> {
  try {
    console.log(`[KV Log] Putting key "${key}" to EdgeOne KV...`);

    // 1. Push to Server EdgeOne KV endpoint
    if (typeof window !== "undefined") {
      try {
        await fetch("/api/edgeone-kv/put", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value }),
        });
      } catch (apiErr) {
        console.warn(
          `[KV Warning] Server API kvPut failed for key "${key}":`,
          apiErr,
        );
      }
    }

    // 2. Update local memory and localStorage cache
    await kvCache.set(key, value, ttlSeconds);
    console.log(`[KV Log] Successfully stored key "${key}".`);
    return true;
  } catch (error) {
    console.error(`[KV Error] Failed to put key "${key}":`, error);
    return false;
  }
}

/**
 * Delete a key from EdgeOne KV storage.
 * @param key Key identifier to delete
 */
export async function kvDelete(key: string): Promise<boolean> {
  try {
    console.log(`[KV Log] Deleting key "${key}" from EdgeOne KV...`);

    if (typeof window !== "undefined") {
      try {
        await fetch(`/api/edgeone-kv/delete?key=${encodeURIComponent(key)}`, {
          method: "DELETE",
        });
      } catch (apiErr) {
        console.warn(
          `[KV Warning] Server API kvDelete failed for key "${key}":`,
          apiErr,
        );
      }
    }

    // Invalidate local and remote KV cache
    await kvCache.invalidate(key);

    console.log(`[KV Log] Successfully deleted key "${key}".`);
    return true;
  } catch (error) {
    console.error(`[KV Error] Failed to delete key "${key}":`, error);
    return false;
  }
}

/**
 * List keys in EdgeOne KV storage with optional prefix and pagination cursor.
 * @param options Prefix, limit, cursor
 */
export async function kvList(options: ListOptions = {}): Promise<ListResult> {
  try {
    const { prefix = "", limit = 256, cursor = "" } = options;
    console.log(
      `[KV Log] Listing keys (prefix: "${prefix}", limit: ${limit}, cursor: "${cursor}")...`,
    );

    if (typeof window !== "undefined") {
      const query = new URLSearchParams({
        prefix,
        limit: String(limit),
        cursor,
      }).toString();
      const res = await fetch(`/api/edgeone-kv/list?${query}`);
      if (res.ok) {
        const data = await res.json();
        return {
          complete: data.complete ?? true,
          cursor: data.cursor ?? null,
          keys: data.keys || [],
        };
      }
    }

    return { complete: true, cursor: null, keys: [] };
  } catch (error) {
    console.error(`[KV Error] Failed to list keys:`, error);
    return { complete: true, cursor: null, keys: [] };
  }
}
