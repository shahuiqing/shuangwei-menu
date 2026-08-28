import { json, kvWrite, checkAdmin } from "../../_lib/helpers";

/** POST /api/edgeone-kv/put { key, value }（需 admin） */
export async function onRequest(context: { request: Request; env: any }): Promise<Response> {
  try {
    if (!checkAdmin(context.request, context.env)) return json({ error: "Unauthorized: Invalid admin token", code: "E_AUTH" }, 401);
    const { key, value } = await context.request.json().catch(() => ({}));
    if (!key) return json({ error: "key is required" }, 400);
    const source = await kvWrite(context.env, key, value);
    return json({ success: true, key, source });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
}
