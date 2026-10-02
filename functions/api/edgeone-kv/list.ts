import { json, kvListKeys, checkAdmin } from "../../_lib/helpers";

/** GET /api/edgeone-kv/list?prefix=&limit=&cursor=（需 admin，避免键枚举泄露） */
export async function onRequest(context: {
  request: Request;
  env: any;
}): Promise<Response> {
  try {
    if (!checkAdmin(context.request, context.env))
      return json({ error: "Unauthorized", code: "E_AUTH" }, 401);
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
