import { json, kvRead, checkAdmin } from "../../_lib/helpers";

/** GET /api/edgeone-kv/get?key=&type=（需 admin，避免任意读取） */
export async function onRequest(context: {
  request: Request;
  env: any;
}): Promise<Response> {
  try {
    if (!checkAdmin(context.request, context.env))
      return json({ error: "Unauthorized", code: "E_AUTH" }, 401);
    const url = new URL(context.request.url);
    const key = url.searchParams.get("key");
    const type = url.searchParams.get("type") || "text";
    if (!key) return json({ error: "key is required" }, 400);
    const value = await kvRead(context.env, key, type);
    return json({ success: true, value });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
}
