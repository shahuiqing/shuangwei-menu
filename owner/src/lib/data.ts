import { supabase } from "./supabase";
import { saveSnap, snapFallback } from "./snapshot";

export async function fetchSettings(): Promise<any | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("id", "global")
    .maybeSingle();
  if (error) {
    console.warn("[owner] fetchSettings:", error.message);
    return snapFallback<any>("settings", null);
  }
  if (data) saveSnap("settings", data);
  return data || null;
}

export async function saveSettingsField(
  patch: Record<string, unknown>,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("settings")
    .update(patch)
    .eq("id", "global");
  if (error) {
    console.warn("[owner] saveSettingsField:", error.message);
    return false;
  }
  return true;
}
