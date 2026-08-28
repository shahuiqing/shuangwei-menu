import { getStore } from "@edgeone/pages-blob";
import { json, checkAdmin } from "../../_lib/helpers";

/** POST /api/edgeone-blob/set { key, value, storeName }（需 admin） */
export async function onRequest(context: { request: Request; env: any }): Promise<Response> {
  try {
    if (!checkAdmin(context.request, context.env)) return json({ error: "Unauthorized", code: "E_AUTH" }, 401);
    const { key, value, storeName = "my-store" } = await context.request.json().catch(() => ({}));
    if (!key) return json({ error: "key is required" }, 400);
    const store = getStore(storeName);
    await store.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
    return json({ success: true, key });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
}