import { json, kvListKeys } from "../../_lib/helpers";

/** GET /api/edgeone-kv/list?prefix=&limit=&cursor= */
export async function onRequest(context: { request: Request; env: any }): Promise<Response> {
  try {
    const url = new URL(context.request.url);
    const prefix = url.searchParams.get("prefix") || "";
    const limit = parseInt(url.searchParams.get("limit") || "256", 10) || 256;
    const cursor = url.searchParams.get("cursor") || "";
    const result = await kvListKeys(context.env, prefix, limit, cursor);
    return json({ success: true, ...result });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
}