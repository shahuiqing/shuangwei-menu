import { json, kvDeleteKey, checkAdmin } from "../../_lib/helpers";

/** DELETE /api/edgeone-kv/delete?key= （需 admin） */
export async function onRequest(context: { request: Request; env: any }): Promise<Response> {
  try {
    if (!checkAdmin(context.request, context.env)) return json({ error: "Unauthorized", code: "E_AUTH" }, 401);
    const url = new URL(context.request.url);
    const key = url.searchParams.get("key");
    if (!key) return json({ error: "key is required" }, 400);
    await kvDeleteKey(context.env, key);
    return json({ success: true, key });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
}