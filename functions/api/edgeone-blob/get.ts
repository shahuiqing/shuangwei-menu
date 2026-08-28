import { getStore } from "@edgeone/pages-blob";
import { json } from "../../_lib/helpers";

/** GET /api/edgeone-blob/get?key=&storeName=&consistency= */
export async function onRequest(context: { request: Request; env: any }): Promise<Response> {
  try {
    const url = new URL(context.request.url);
    const key = url.searchParams.get("key");
    const storeName = url.searchParams.get("storeName") || "my-store";
    const consistency = url.searchParams.get("consistency") as "strong" | "eventual" | null;
    if (!key) return json({ error: "key is required" }, 400);
    const store = getStore(storeName);
    const content = await store.get(key, { type: "text", consistency: consistency === "strong" ? "strong" : "eventual" });
    return json({ success: true, value: content ?? null });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
}