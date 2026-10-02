import { supabase } from "./supabase";

export interface Staff {
  name: string;
  password: string;
}

export async function fetchOrders(limit = 3000): Promise<any[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[owner] fetchOrders:", error.message);
    return [];
  }
  return data || [];
}

export async function fetchSettings(): Promise<any | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("settings")
    .select("*")
    .eq("id", "global")
    .maybeSingle();
  return data || null;
}

export async function fetchStaff(): Promise<Staff[]> {
  const s = await fetchSettings();
  const list = s?.devicePasswordsHash || s?.devicePasswords || [];
  return Array.isArray(list)
    ? list.filter((x: any) => x && (x.name || x.password))
    : [];
}

export async function saveStaff(list: Staff[]): Promise<boolean> {
  if (!supabase) return false;
  const clean = (list || []).filter((s) => s.name.trim() && s.password.trim());
  const { error } = await supabase
    .from("settings")
    .update({ devicePasswordsHash: clean, devicePasswords: clean })
    .eq("id", "global");
  if (error) {
    // 若没有 devicePasswords 列，退一步只写 devicePasswordsHash
    const r2 = await supabase
      .from("settings")
      .update({ devicePasswordsHash: clean })
      .eq("id", "global");
    if (r2.error) {
      console.warn("[owner] saveStaff:", r2.error.message);
      return false;
    }
  }
  return true;
}
