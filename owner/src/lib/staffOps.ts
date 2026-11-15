/**
 * 员工协同数据层：员工账号 / 任务派发 / 每日抽盘 / 采购申报
 *
 * 表：staff_members, task_templates, staff_tasks, stocktake_rules,
 *     stocktake_tasks, purchase_requests（见 supabase_owner_all.sql 6.5 节）
 * 员工端(/staff.html)只查询这几张表，绝不触碰经营/成本/供应商数据。
 */
import { supabase, isConfigured } from "./supabase";
import { businessDayKey } from "./businessDay";

// ───────────────────────── 类型 ─────────────────────────

export const ROLES = ["waiter", "helper", "cleaner", "other"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  waiter: "服务员",
  helper: "帮厨",
  cleaner: "保洁",
  other: "其他",
};

export const TASK_STATUSES = [
  "pending",
  "submitted",
  "approved",
  "rejected",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "待完成",
  submitted: "待验收",
  approved: "已通过",
  rejected: "已驳回",
  cancelled: "已取消",
};

export interface ChecklistItem {
  text: string;
  done?: boolean;
}

export interface StaffMember {
  id: string;
  name: string;
  roles: Role[];
  status: "active" | "disabled";
  phone: string;
  note: string;
  created_at?: string;
}

export interface TaskTemplate {
  id: string;
  name: string;
  task_type: "daily" | "weekly" | "monthly" | "adhoc";
  roles: Role[];
  checklist: ChecklistItem[];
  require_photo: boolean;
  due_hours: number;
  description: string;
  /** 每天自动派发（打开老板端时触发，一天一次） */
  auto_dispatch?: boolean;
}

export interface StaffTask {
  id: string;
  batch_id: string | null;
  template_id: string | null;
  title: string;
  description: string;
  checklist: ChecklistItem[];
  require_photo: boolean;
  priority: "low" | "normal" | "high";
  assigned_to: string | null;
  assignee_name: string;
  assignee_roles: Role[];
  due_at: string | null;
  status: TaskStatus;
  note: string;
  photos: string[];
  submitted_at: string | null;
  review_note: string;
  reviewed_at: string | null;
  resubmit_count: number;
  created_at: string;
}

export interface StocktakeRule {
  id?: string;
  enabled: boolean;
  items_per_day: number;
  strategy: "stale_first" | "zone_rotate" | "random";
  zones: string[];
  due_time: string;
  require_photo: boolean;
  show_book_qty: boolean;
  allow_draft: boolean;
  auto_by_category?: boolean; // 按分类自动派发总开关（老数据无此列）
}

/** 分类拆分方式 */
export type SplitMode =
  | "average" // 平均拆分（轮流，负载均衡）
  | "zone" // 按区域/货架拆分（同区整块给一人）
  | "category_group" // 整组一人（整个分类给任务最少的人）
  | "random" // 随机拆分（按日期种子，结果稳定）
  | "rotate"; // 按上次责任人轮换

export const SPLIT_MODE_LABEL: Record<SplitMode, string> = {
  average: "平均拆分",
  zone: "按区域/货架拆分",
  category_group: "整组给一人",
  random: "随机拆分",
  rotate: "按上次责任人轮换",
};

export interface StocktakeCategoryRule {
  id?: string;
  category: string; // 规范分类（中文键）
  roles: Role[]; // 责任角色，可多选
  split_mode: SplitMode;
  enabled: boolean; // 停用=该分类当天不自动派发
  updated_at?: string;
}

/** 内置默认映射（数据库无记录时兜底；与 SQL 6.6 默认值一致） */
export const DEFAULT_CATEGORY_RULES: StocktakeCategoryRule[] = [
  { category: "蔬菜", roles: ["helper"], split_mode: "average", enabled: true },
  { category: "肉类", roles: ["helper"], split_mode: "average", enabled: true },
  { category: "水产", roles: ["helper"], split_mode: "average", enabled: true },
  { category: "调料", roles: ["helper"], split_mode: "average", enabled: true },
  { category: "粮油", roles: ["helper"], split_mode: "average", enabled: true },
  { category: "饮料", roles: ["helper"], split_mode: "average", enabled: true },
  { category: "耗材", roles: ["waiter"], split_mode: "average", enabled: true },
  { category: "其他", roles: [], split_mode: "average", enabled: true },
];

/** 自动派发的物品输入 */
export interface AutoAssignItem {
  itemId: string;
  category: string;
  zone: string;
  lastStaffId?: string | null; // 上次盘点责任人（rotate 模式用）
}

/** 自动派发的员工输入 */
export interface AutoAssignStaff {
  id: string;
  name: string;
  roles: Role[];
  status: "active" | "disabled";
}

/** 未派发原因 */
export type AssignReason = "no_category" | "no_rule" | "no_staff";

export const ASSIGN_REASON_LABEL: Record<AssignReason, string> = {
  no_category: "物品未分类，请先在库存管理补分类",
  no_rule: "该分类未配置/已停用责任角色",
  no_staff: "该分类对应角色无在职员工",
};

export interface AutoAssignResult {
  assignments: { itemId: string; staffId: string; staffName: string }[];
  unassigned: { itemId: string; category: string; reason: AssignReason }[];
}

export interface StocktakeTask {
  id: string;
  count_date: string;
  item_id: string;
  item_name: string;
  unit: string;
  zone: string;
  book_qty: number | null;
  actual_qty: number | null;
  note: string;
  photos: string[];
  assigned_to: string | null;
  assignee_name: string;
  status:
    | "pending"
    | "drafted"
    | "submitted"
    | "rejected"
    | "calibrated"
    | "cancelled";
  submitted_at: string | null;
  review_note: string;
  reviewed_at: string | null;
  calibrated_at: string | null;
}

export type PurchaseStatus = "pending" | "approved" | "rejected" | "purchased";

export const PURCHASE_STATUS_LABEL: Record<PurchaseStatus, string> = {
  pending: "待审批",
  approved: "已通过",
  rejected: "已驳回",
  purchased: "已采购",
};

export interface PurchaseRequest {
  id: string;
  staff_id: string | null;
  staff_name: string;
  item_name: string;
  quantity: number;
  unit: string;
  category: string;
  urgency: "normal" | "urgent";
  expected_date: string | null;
  note: string;
  photos: string[];
  status: PurchaseStatus;
  reject_reason: string;
  /** 入库溯源:被哪张入库单消化(空=尚未入库) */
  purchase_id?: string;
  /** 关联的库存物品(自动匹配或老板手动关联;空=待确认) */
  inventory_item_id?: string;
  created_at: string;
}

// ───────────────────────── 纯函数（可测） ─────────────────────────

/** 按岗位展开指派人：岗位里的每个在职员工各得一条任务（责任到人） */
export function expandRoleAssignees(
  roles: Role[],
  staff: StaffMember[],
): StaffMember[] {
  const active = staff.filter((s) => s.status === "active");
  const picked = active.filter((s) => s.roles.some((r) => roles.includes(r)));
  // 去重（同一员工可能被多岗位命中）
  const seen = new Set<string>();
  return picked.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

/** 截止时间：dueHours 小时后 */
export function dueFromHours(hours: number, now = Date.now()): string {
  return new Date(now + hours * 3600_000).toISOString();
}

/** 任务/盘点是否逾期 */
export function isOverdue(dueAt: string | null, now = Date.now()): boolean {
  if (!dueAt) return false;
  return new Date(dueAt).getTime() < now;
}

/** 实盘与账面差异数量（null 表示未填） */
export function stocktakeDiff(
  book: number | null,
  actual: number | null,
): number | null {
  if (book === null || actual === null) return null;
  return Math.round((actual - book) * 100) / 100;
}

/**
 * 每日抽盘选品：
 * - stale_first：上次盘点最久优先（从未盘过视为最久），同分按名称稳定排序
 * - zone_rotate：按 zones 顺序轮换，取该 zone 的物品（先久未盘）
 * - random：随机抽 n 个（用 countDate 作种子，同一天结果稳定，可复现）
 * 排除：今天已生成过盘点任务的物品
 */
export function pickDailyStocktakeItems(
  items: {
    id: string;
    name: string;
    zone: string;
    lastCountedAt: string | null;
  }[],
  rule: Pick<StocktakeRule, "items_per_day" | "strategy" | "zones">,
  countDate: string,
  alreadyPlannedIds: string[] = [],
): typeof items {
  const planned = new Set(alreadyPlannedIds);
  const pool = items.filter((it) => !planned.has(it.id));
  if (pool.length === 0) return [];

  const byStale = (a: (typeof pool)[number], b: (typeof pool)[number]) => {
    const ta = a.lastCountedAt ? new Date(a.lastCountedAt).getTime() : 0;
    const tb = b.lastCountedAt ? new Date(b.lastCountedAt).getTime() : 0;
    if (ta !== tb) return ta - tb; // 0(从未盘) 最前
    return a.name.localeCompare(b.name, "zh");
  };

  let candidates: typeof pool;
  if (rule.strategy === "zone_rotate" && rule.zones.length > 0) {
    // 按 countDate 距 epoch 天数决定今天轮到第几个 zone
    const dayIndex = Math.floor(
      new Date(countDate + "T00:00:00").getTime() / 86400_000,
    );
    const zone = rule.zones[dayIndex % rule.zones.length];
    const inZone = pool.filter((it) => it.zone === zone);
    candidates = inZone.length > 0 ? inZone.sort(byStale) : pool.sort(byStale);
  } else if (rule.strategy === "random") {
    // 稳定随机：countDate 做种子的 LCG
    let seed = 0;
    for (const ch of countDate) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    candidates = [...pool].sort(() => rand() - 0.5);
  } else {
    candidates = [...pool].sort(byStale);
  }
  return candidates.slice(0, Math.max(1, rule.items_per_day));
}

// ────────────────────────── 分类→角色→人 自动派发 ──────────────────────────

/** 确定性伪随机（与 pickDailyStocktakeItems 同款 LCG，seed 可传日期保证当天结果稳定） */
function seededRand(seedStr: string) {
  let seed = 0;
  for (const ch of seedStr) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
}

/**
 * 按库存分类自动派发盘点任务：
 * 1. 物品按分类分组；无分类 → no_category
 * 2. 查「分类→责任角色」映射；无映射/映射停用/角色为空 → no_rule
 * 3. 取该角色在职员工；无 → no_staff
 * 4. 按拆分方式分到人（跨分类做全局负载均衡，一人多角色不重复派同一物品）
 */
export function autoAssignStocktakes(
  items: AutoAssignItem[],
  rules: StocktakeCategoryRule[],
  staff: AutoAssignStaff[],
  seed = "",
): AutoAssignResult {
  const result: AutoAssignResult = {
    assignments: [],
    unassigned: [],
  };
  const active = staff.filter((s) => s.status === "active");
  const ruleByCat = new Map(rules.map((r) => [r.category, r]));

  // 每人当前负载（跨分类累计，保证多分类之间也均衡）
  const load = new Map<string, number>();

  // 分类名稳定排序，保证结果确定性
  const categories = [...new Set(items.map((it) => it.category || ""))].sort(
    (a, b) => a.localeCompare(b, "zh"),
  );

  for (const cat of categories) {
    const catItems = items.filter((it) => (it.category || "") === cat);
    if (!cat) {
      for (const it of catItems)
        result.unassigned.push({
          itemId: it.itemId,
          category: cat,
          reason: "no_category",
        });
      continue;
    }
    const rule = ruleByCat.get(cat);
    if (!rule || !rule.enabled || rule.roles.length === 0) {
      for (const it of catItems)
        result.unassigned.push({
          itemId: it.itemId,
          category: cat,
          reason: "no_rule",
        });
      continue;
    }
    // 该分类责任角色下的在职员工（按姓名稳定排序）
    const eligible = active
      .filter((s) => s.roles.some((r) => rule.roles.includes(r)))
      .sort((a, b) => a.name.localeCompare(b.name, "zh"));
    if (eligible.length === 0) {
      for (const it of catItems)
        result.unassigned.push({
          itemId: it.itemId,
          category: cat,
          reason: "no_staff",
        });
      continue;
    }

    const pick = (staffId: string, itemId: string) => {
      result.assignments.push({
        itemId,
        staffId,
        staffName: eligible.find((s) => s.id === staffId)?.name || "",
      });
      load.set(staffId, (load.get(staffId) || 0) + 1);
    };
    const leastLoaded = (pool = eligible) =>
      pool
        .slice()
        .sort((a, b) => (load.get(a.id) || 0) - (load.get(b.id) || 0))[0].id;
    const roundRobin = (ordered: AutoAssignItem[]) => {
      let i = 0;
      for (const it of ordered) {
        // 轮流 + 负载校正：选当前负载最小的，先按轮转顺序打破平局
        const minLoad = Math.min(...eligible.map((s) => load.get(s.id) || 0));
        const candidates = eligible.filter(
          (s) => (load.get(s.id) || 0) === minLoad,
        );
        pick(candidates[i % candidates.length].id, it.itemId);
        i++;
      }
    };

    if (rule.split_mode === "category_group") {
      const target = leastLoaded();
      for (const it of catItems) pick(target, it.itemId);
      continue;
    }

    if (rule.split_mode === "zone") {
      // 同区（zone）整块给同一人；无 zone 信息时退化为平均拆分
      const zones = [...new Set(catItems.map((it) => it.zone || ""))];
      if (zones.length <= 1 && (zones[0] || "") === "") {
        roundRobin([...catItems]);
        continue;
      }
      // 区块大的优先，整块塞给当前负载最小的人
      const blocks = zones
        .map((z) => ({
          z,
          items: catItems.filter((it) => (it.zone || "") === z),
        }))
        .sort((a, b) => b.items.length - a.items.length);
      for (const b of blocks) {
        const target = leastLoaded();
        for (const it of b.items) pick(target, it.itemId);
      }
      continue;
    }

    if (rule.split_mode === "random") {
      const rand = seededRand(seed + "|" + cat);
      roundRobin([...catItems].sort(() => rand() - 0.5));
      continue;
    }

    if (rule.split_mode === "rotate") {
      // 上次盘过且还在职的人优先接着盘；其余负载均衡轮流
      const byLast: AutoAssignItem[] = [];
      const rest: AutoAssignItem[] = [];
      const eligibleIds = new Set(eligible.map((s) => s.id));
      for (const it of catItems) {
        if (it.lastStaffId && eligibleIds.has(it.lastStaffId)) byLast.push(it);
        else rest.push(it);
      }
      for (const it of byLast) pick(it.lastStaffId!, it.itemId);
      roundRobin(rest);
      continue;
    }

    // average（默认）
    roundRobin([...catItems]);
  }

  return result;
}

// ───────────────────────── 错误包装 ─────────────────────────

/** crypto.randomUUID 在非 HTTPS 环境可能不存在，兜底 */
function uuid(): string {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    )
      return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return (
    "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12)
  );
}

function warn(op: string, error: { message: string } | null): boolean {
  if (error) {
    console.warn(`[staffOps] ${op}:`, error.message);
    return false;
  }
  return true;
}

// ───────────────────────── 员工账号 ─────────────────────────

/** 员工表可读列（password_hash 已收回前端读取权限） */
const STAFF_COLS = "id,name,roles,status,phone,note,created_at,updated_at";

export async function fetchStaffMembers(): Promise<StaffMember[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("staff_members")
    .select(STAFF_COLS)
    .order("created_at", { ascending: true });
  if (!warn("fetchStaffMembers", error)) return [];
  return (data || []).map((s: any) => ({
    ...s,
    roles: Array.isArray(s.roles) ? s.roles : [],
  }));
}

/**
 * 新增/更新员工资料（不含密码）。
 * 密码必须通过 setStaffPassword 单独设置（需老板密码授权）。
 */
export async function upsertStaffMember(
  member: Partial<StaffMember> & { id?: string; name: string },
): Promise<{ ok: boolean; id?: string }> {
  if (!supabase) return { ok: false };
  const patch: Record<string, unknown> = {
    name: member.name.trim(),
    roles: member.roles || [],
    status: member.status || "active",
    phone: member.phone || "",
    note: member.note || "",
    updated_at: new Date().toISOString(),
  };
  if (member.id) {
    const { error } = await supabase
      .from("staff_members")
      .update(patch)
      .eq("id", member.id);
    return { ok: warn("upsertStaffMember", error), id: member.id };
  }
  const { data, error } = await supabase
    .from("staff_members")
    .insert(patch)
    .select("id")
    .single();
  if (!warn("insertStaffMember", error)) return { ok: false };
  return { ok: true, id: data?.id };
}

/**
 * 设置/重置员工登录密码：由数据库函数校验老板密码（bcrypt 在库内完成），
 * 哈希不会经过前端；老板密码不对或云端未配置时会返回明确错误。
 */
export async function setStaffPassword(
  staffId: string,
  password: string,
  ownerPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "not configured" };
  const { data, error } = await supabase.rpc("owner_set_staff_password", {
    p_owner_password: ownerPassword,
    p_staff_id: staffId,
    p_password: password,
  });
  if (error) {
    warn("setStaffPassword", error);
    return { ok: false, error: error.message };
  }
  const res = data as { ok?: boolean; error?: string } | null;
  if (res?.ok) return { ok: true };
  return { ok: false, error: res?.error || "failed" };
}

export async function deleteStaffMember(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("staff_members").delete().eq("id", id);
  return warn("deleteStaffMember", error);
}

// ───────────────────────── 任务模板 ─────────────────────────

export async function fetchTaskTemplates(): Promise<TaskTemplate[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("task_templates")
    .select("*")
    .order("created_at", { ascending: true });
  if (!warn("fetchTaskTemplates", error)) return [];
  return data || [];
}

export async function upsertTaskTemplate(
  tpl: Partial<TaskTemplate> & { id?: string; name: string },
): Promise<boolean> {
  if (!supabase) return false;
  const patch = {
    name: tpl.name.trim(),
    task_type: tpl.task_type || "daily",
    roles: tpl.roles || [],
    checklist: tpl.checklist || [],
    require_photo: !!tpl.require_photo,
    due_hours: tpl.due_hours ?? 8,
    description: tpl.description || "",
    auto_dispatch: !!tpl.auto_dispatch,
  };
  if (tpl.id) {
    const { error } = await supabase
      .from("task_templates")
      .update(patch)
      .eq("id", tpl.id);
    return warn("upsertTaskTemplate", error);
  }
  const { error } = await supabase.from("task_templates").insert(patch);
  return warn("insertTaskTemplate", error);
}

export async function deleteTaskTemplate(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("task_templates").delete().eq("id", id);
  return warn("deleteTaskTemplate", error);
}

// ───────────────────────── 任务派发 ─────────────────────────

export interface DispatchInput {
  title: string;
  description?: string;
  checklist?: ChecklistItem[];
  require_photo?: boolean;
  priority?: "low" | "normal" | "high";
  roles?: Role[]; // 按岗位派发（展开到人）
  assigneeIds?: string[]; // 或指定员工
  due_hours?: number;
  template_id?: string;
  /** 自动派发的营业日（手动派发留空） */
  dispatch_day?: string;
}

/** 派发：按岗位展开为每人一条；返回成功条数 */
export async function dispatchTasks(input: DispatchInput): Promise<number> {
  if (!supabase || !isConfigured) return 0;
  const staff = await fetchStaffMembers();
  let targets: StaffMember[];
  if (input.assigneeIds && input.assigneeIds.length > 0) {
    targets = staff.filter(
      (s) => s.status === "active" && input.assigneeIds!.includes(s.id),
    );
  } else {
    targets = expandRoleAssignees(input.roles || [], staff);
  }
  if (targets.length === 0) return 0;
  const batchId = uuid();
  const now = new Date().toISOString();
  const rows = targets.map((s) => ({
    batch_id: batchId,
    template_id: input.template_id || null,
    dispatch_day: input.dispatch_day || null,
    title: input.title.trim(),
    description: input.description || "",
    checklist: (input.checklist || []).map((c) => ({
      text: c.text,
      done: false,
    })),
    require_photo: !!input.require_photo,
    priority: input.priority || "normal",
    assigned_to: s.id,
    assignee_name: s.name,
    assignee_roles: s.roles,
    due_at: dueFromHours(input.due_hours ?? 8),
    status: "pending",
    created_at: now,
  }));
  const { error } = await supabase.from("staff_tasks").insert(rows);
  if (!warn("dispatchTasks", error)) return 0;
  return rows.length;
}

export async function fetchStaffTasks(): Promise<StaffTask[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("staff_tasks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (!warn("fetchStaffTasks", error)) return [];
  return data || [];
}

// ───────────────────────── 任务按天自动派发 ─────────────────────────

export interface AutoDispatchTask {
  templateId: string;
  staffId: string;
  staffName: string;
  staffRoles: Role[];
  title: string;
  description: string;
  checklist: ChecklistItem[];
  require_photo: boolean;
  due_hours: number;
}

/**
 * 计算某天还缺哪些自动任务（纯函数）：
 * - 只处理开启 auto_dispatch 且有岗位的模板
 * - 按模板岗位展开到在职员工
 * - 已存在（同模板+同员工+同一天）的不再重复生成
 */
export function planAutoDispatch(
  templates: TaskTemplate[],
  staff: StaffMember[],
  day: string,
  existing: {
    template_id: string | null;
    assigned_to: string | null;
    dispatch_day: string | null;
  }[],
): AutoDispatchTask[] {
  const done = new Set(
    existing
      .filter((e) => e.dispatch_day === day && e.template_id && e.assigned_to)
      .map((e) => `${e.template_id}|${e.assigned_to}`),
  );
  const out: AutoDispatchTask[] = [];
  for (const tpl of templates) {
    if (!tpl.auto_dispatch || !tpl.id || !(tpl.roles || []).length) continue;
    for (const s of expandRoleAssignees(tpl.roles, staff)) {
      if (done.has(`${tpl.id}|${s.id}`)) continue;
      out.push({
        templateId: tpl.id,
        staffId: s.id,
        staffName: s.name,
        staffRoles: s.roles,
        title: tpl.name,
        description: tpl.description || "",
        checklist: (tpl.checklist || []).map((c) => ({ text: c.text })),
        require_photo: !!tpl.require_photo,
        due_hours: tpl.due_hours ?? 8,
      });
    }
  }
  return out;
}

/**
 * 执行当天自动派发（幂等：数据库唯一索引 + 预计算去重）。
 * 返回 ok=false 时调用方不要标记「今天已完成」，下次打开会重试。
 */
export async function runAutoDispatch(
  day = businessDayKey(Date.now()),
): Promise<{ ok: boolean; count: number }> {
  if (!supabase || !isConfigured) return { ok: false, count: 0 };
  const [templates, staff] = await Promise.all([
    fetchTaskTemplates(),
    fetchStaffMembers(),
  ]);
  const { data: existing, error } = await supabase
    .from("staff_tasks")
    .select("template_id,assigned_to,dispatch_day")
    .eq("dispatch_day", day)
    .limit(1000);
  if (error) {
    warn("runAutoDispatch/existing", error);
    return { ok: false, count: 0 };
  }
  const plan = planAutoDispatch(templates, staff, day, existing || []);
  if (plan.length === 0) return { ok: true, count: 0 };

  const now = new Date().toISOString();
  const rows = plan.map((p) => ({
    batch_id: `auto-${p.templateId}-${day}`,
    template_id: p.templateId,
    dispatch_day: day,
    title: p.title,
    description: p.description,
    checklist: p.checklist.map((c) => ({ text: c.text, done: false })),
    require_photo: p.require_photo,
    priority: "normal",
    assigned_to: p.staffId,
    assignee_name: p.staffName,
    assignee_roles: p.staffRoles,
    due_at: dueFromHours(p.due_hours),
    status: "pending",
    created_at: now,
  }));
  const { error: insErr } = await supabase.from("staff_tasks").insert(rows);
  if (insErr) {
    warn("runAutoDispatch", insErr);
    return { ok: false, count: 0 };
  }
  return { ok: true, count: rows.length };
}

/** 验收：通过 / 驳回（驳回后员工端可重新提交） */
export async function reviewStaffTask(
  id: string,
  approve: boolean,
  note = "",
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("staff_tasks")
    .update({
      status: approve ? "approved" : "rejected",
      review_note: note,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  return warn("reviewStaffTask", error);
}

export async function cancelStaffTask(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("staff_tasks")
    .update({ status: "cancelled" })
    .eq("id", id);
  return warn("cancelStaffTask", error);
}

// ───────────────────────── 盘点 ─────────────────────────

export async function fetchStocktakeRule(): Promise<StocktakeRule> {
  const fallback: StocktakeRule = {
    enabled: false,
    items_per_day: 5,
    strategy: "stale_first",
    zones: [],
    due_time: "22:00",
    require_photo: false,
    show_book_qty: false,
    allow_draft: true,
  };
  if (!supabase) return fallback;
  const { data, error } = await supabase
    .from("stocktake_rules")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (!warn("fetchStocktakeRule", error) || !data) return fallback;
  return data as StocktakeRule;
}

export async function saveStocktakeRule(rule: StocktakeRule): Promise<boolean> {
  if (!supabase) return false;
  const patch = { ...rule, updated_at: new Date().toISOString() };
  if (rule.id) {
    const { error } = await supabase
      .from("stocktake_rules")
      .update(patch)
      .eq("id", rule.id);
    return warn("saveStocktakeRule", error);
  }
  delete (patch as any).id;
  const { error } = await supabase.from("stocktake_rules").insert(patch);
  if (!warn("insertStocktakeRule", error)) return false;
  return true;
}

/** 分类→责任角色映射（表为空时回退内置默认） */
export async function fetchStocktakeCategoryRules(): Promise<
  StocktakeCategoryRule[]
> {
  if (!supabase) return DEFAULT_CATEGORY_RULES;
  const { data, error } = await supabase
    .from("stocktake_category_rules")
    .select("*")
    .order("category", { ascending: true });
  if (!warn("fetchStocktakeCategoryRules", error) || !data || data.length === 0)
    return DEFAULT_CATEGORY_RULES;
  return data as StocktakeCategoryRule[];
}

export async function upsertStocktakeCategoryRule(
  r: StocktakeCategoryRule,
): Promise<boolean> {
  if (!supabase) return false;
  const patch = { ...r, updated_at: new Date().toISOString() };
  if (r.id) {
    const { error } = await supabase
      .from("stocktake_category_rules")
      .update(patch)
      .eq("id", r.id);
    return warn("upsertStocktakeCategoryRule", error);
  }
  delete (patch as any).id;
  const { error } = await supabase
    .from("stocktake_category_rules")
    .upsert(patch, { onConflict: "category" });
  return warn("insertStocktakeCategoryRule", error);
}

export async function deleteStocktakeCategoryRule(
  id: string,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("stocktake_category_rules")
    .delete()
    .eq("id", id);
  return warn("deleteStocktakeCategoryRule", error);
}

/** 每个物品上次盘点责任人（rotate 拆分用）：item_id → staff_id */
export async function fetchLastCountedBy(
  itemIds: string[],
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  if (!supabase || itemIds.length === 0) return out;
  const { data, error } = await supabase
    .from("stocktake_tasks")
    .select("item_id, assigned_to, created_at")
    .in("item_id", itemIds)
    .not("assigned_to", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);
  if (!warn("fetchLastCountedBy", error)) return out;
  for (const row of data || []) {
    if (!(row.item_id in out)) out[row.item_id] = row.assigned_to;
  }
  return out;
}

/**
 * 把自动分配结果写入今日任务。
 * 只覆盖「未指派且未开始」（pending + assigned_to 为空）的任务；
 * 已指派/已提交的不动——要整体重派请先调 resetStocktakeAssignments。
 */
export async function applyStocktakeAutoAssign(
  countDate: string,
  assignments: { itemId: string; staffId: string; staffName: string }[],
): Promise<number> {
  if (!supabase || assignments.length === 0) return 0;
  // 按人分批更新（一员工一批 in 查询）
  const byStaff = new Map<string, string[]>();
  for (const a of assignments) {
    if (!byStaff.has(a.staffId)) byStaff.set(a.staffId, []);
    byStaff.get(a.staffId)!.push(a.itemId);
  }
  let n = 0;
  for (const [staffId, itemIds] of byStaff) {
    const name =
      assignments.find((a) => a.staffId === staffId)?.staffName || "";
    const { data, error } = await supabase
      .from("stocktake_tasks")
      .update({
        assigned_to: staffId,
        assignee_name: name,
      })
      .eq("count_date", countDate)
      .in("item_id", itemIds)
      .in("status", ["pending", "drafted"])
      .is("assigned_to", null)
      .select("id");
    if (error) {
      warn("applyStocktakeAutoAssign", error);
      continue;
    }
    n += data?.length || 0;
  }
  return n;
}

/** 撤回重派：把当日未开始的任务清空指派（已提交/已校准不受影响） */
export async function resetStocktakeAssignments(
  countDate: string,
): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase
    .from("stocktake_tasks")
    .update({ assigned_to: null, assignee_name: "" })
    .eq("count_date", countDate)
    .in("status", ["pending", "drafted"])
    .not("assigned_to", "is", null)
    .select("id");
  if (error) {
    warn("resetStocktakeAssignments", error);
    return 0;
  }
  return data?.length || 0;
}

/** 转派：把某人未完成（pending/drafted）的盘点任务转给另一人 */
export async function transferStocktakeTasks(
  fromStaffId: string,
  to: { id: string; name: string },
  countDate?: string,
): Promise<number> {
  if (!supabase || !fromStaffId) return 0;
  let q = supabase
    .from("stocktake_tasks")
    .update({ assigned_to: to.id, assignee_name: to.name })
    .eq("assigned_to", fromStaffId)
    .in("status", ["pending", "drafted"])
    .select("id");
  if (countDate) q = q.eq("count_date", countDate);
  const { data, error } = await q;
  if (error) {
    warn("transferStocktakeTasks", error);
    return 0;
  }
  return data?.length || 0;
}

export async function fetchStocktakeTasks(
  countDate?: string,
): Promise<StocktakeTask[]> {
  if (!supabase) return [];
  let q = supabase
    .from("stocktake_tasks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (countDate) q = q.eq("count_date", countDate);
  const { data, error } = await q;
  if (!warn("fetchStocktakeTasks", error)) return [];
  return data || [];
}

/** 生成今日盘点清单（含账面数量快照）；返回创建条数 */
export async function createStocktakeTasks(
  countDate: string,
  items: {
    id: string;
    name: string;
    unit: string;
    zone?: string;
    stock: number;
  }[],
  assignedTo?: { id: string; name: string } | null,
): Promise<number> {
  if (!supabase || items.length === 0) return 0;
  const rows = items.map((it) => ({
    count_date: countDate,
    item_id: it.id,
    item_name: it.name,
    unit: it.unit,
    zone: it.zone || "",
    book_qty: it.stock,
    assigned_to: assignedTo?.id || null,
    assignee_name: assignedTo?.name || "",
    status: "pending",
  }));
  // 同日重复的物品跳过：先查已存在
  const existing = await fetchStocktakeTasks(countDate);
  const existIds = new Set(existing.map((t) => t.item_id));
  const fresh = rows.filter((r) => !existIds.has(r.item_id));
  if (fresh.length === 0) return 0;
  const { error } = await supabase.from("stocktake_tasks").insert(fresh);
  if (!warn("createStocktakeTasks", error)) return 0;
  return fresh.length;
}

/** 指派/转派（必须具体到人） */
export async function assignStocktakeTask(
  id: string,
  member: { id: string; name: string } | null,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("stocktake_tasks")
    .update({
      assigned_to: member?.id || null,
      assignee_name: member?.name || "",
    })
    .eq("id", id);
  return warn("assignStocktakeTask", error);
}

export async function cancelStocktakeTask(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("stocktake_tasks")
    .update({ status: "cancelled" })
    .eq("id", id);
  return warn("cancelStocktakeTask", error);
}

/** 盘点审核：通过即校准库存（diff 写入库存流水），驳回则退回员工复核 */
export async function reviewStocktakeTask(
  task: StocktakeTask,
  approve: boolean,
  item: { id: string; stock: number; price: number } | undefined,
  reviewNote = "",
): Promise<boolean> {
  if (!supabase) return false;
  if (!approve) {
    const { error } = await supabase
      .from("stocktake_tasks")
      .update({
        status: "rejected",
        review_note: reviewNote,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", task.id);
    return warn("reviewStocktakeTask", error);
  }
  // 通过：若差异 ≠ 0，校准库存
  if (item && task.actual_qty !== null && task.actual_qty !== item.stock) {
    const delta = Math.round((task.actual_qty - item.stock) * 100) / 100;
    const { adjustStock } = await import("./inventory");
    const ok = await adjustStock(
      { ...item, stock: item.stock } as any,
      delta,
      "adjustment",
      `每日抽盘校准 ${task.count_date} · 盘点人 ${task.assignee_name || "未署名"}`,
      "stocktake",
    );
    if (!ok) return false;
  }
  const now = new Date().toISOString();
  const { error: e2 } = await supabase
    .from("stocktake_tasks")
    .update({
      status: "calibrated",
      book_qty: item ? item.stock : task.book_qty, // 校准前账面留档
      review_note: reviewNote,
      reviewed_at: now,
      calibrated_at: now,
    })
    .eq("id", task.id);
  if (!warn("calibrateStocktakeTask", e2)) return false;
  // 记录物品上次盘点时间
  await supabase
    .from("inventory_items")
    .update({ last_counted_at: now })
    .eq("id", task.item_id);
  // 同步到全局盘点提醒/历史（与「库存管理」全量盘点同一口径）
  if (task.actual_qty !== null) {
    const [
      { markStocktake, lastStocktakeDay },
      { pushStocktake },
      { todayKey },
    ] = await Promise.all([
      import("./stocktakeReminder"),
      import("./stocktakeHistory"),
      import("./businessDay"),
    ]);
    // 同一天多次审核只算一次盘点事件（避免置信度虚高）
    if (lastStocktakeDay() !== todayKey()) markStocktake();
    const price = item ? num2(item.price) : 0;
    const diffQty =
      task.book_qty === null ? 0 : task.actual_qty - task.book_qty;
    pushStocktake({
      items: 1,
      diffs: Math.abs(diffQty) > 1e-9 ? 1 : 0,
      netValue: Math.round(diffQty * price * 100) / 100,
      stockValue: Math.round(task.actual_qty * price * 100) / 100,
    });
  }
  return true;
}

/** 本地数字兜底（避免 staffOps 顶层再依赖 inventory 的 num） */
function num2(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ───────────────────────── 采购申报 ─────────────────────────

export async function fetchPurchaseRequests(): Promise<PurchaseRequest[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("purchase_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (!warn("fetchPurchaseRequests", error)) return [];
  return data || [];
}

export async function reviewPurchaseRequest(
  id: string,
  approve: boolean,
  rejectReason = "",
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("purchase_requests")
    .update({
      status: approve ? "approved" : "rejected",
      reject_reason: rejectReason,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id);
  return warn("reviewPurchaseRequest", error);
}

export async function markPurchasePurchased(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("purchase_requests")
    .update({ status: "purchased", purchased_at: new Date().toISOString() })
    .eq("id", id);
  return warn("markPurchasePurchased", error);
}

/**
 * 申报闭环:入库成功后批量把 approved 申报置为 purchased。
 * purchaseId 记录消化这批申报的入库单(溯源,可空)。
 */
export async function markPurchaseRequestsFulfilled(
  requestIds: string[],
  purchaseId = "",
): Promise<number> {
  if (!supabase || requestIds.length === 0) return 0;
  const { data, error } = await supabase
    .from("purchase_requests")
    .update({
      status: "purchased",
      purchased_at: new Date().toISOString(),
      purchase_id: purchaseId,
    })
    .in("id", requestIds)
    .eq("status", "approved")
    .select("id");
  if (error) {
    warn("markPurchaseRequestsFulfilled", error);
    return 0;
  }
  return data?.length || 0;
}

/** 手动把申报关联到库存物品（待确认 → 可进采购计划） */
export async function linkPurchaseRequestItem(
  id: string,
  itemId: string,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("purchase_requests")
    .update({ inventory_item_id: itemId })
    .eq("id", id);
  return warn("linkPurchaseRequestItem", error);
}

// ───────────────────────── 员工端（登录/提交） ─────────────────────────

/** 员工侧：我的任务（只查派给自己的） */
export async function fetchMyTasks(staffId: string): Promise<StaffTask[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("staff_tasks")
    .select("*")
    .eq("assigned_to", staffId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (!warn("fetchMyTasks", error)) return [];
  return data || [];
}

/** 员工侧：我的盘点任务（默认今天，含待复核） */
export async function fetchMyStocktakes(
  staffId: string,
  countDate?: string,
): Promise<StocktakeTask[]> {
  if (!supabase) return [];
  let q = supabase
    .from("stocktake_tasks")
    .select("*")
    .eq("assigned_to", staffId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (countDate) q = q.eq("count_date", countDate);
  const { data, error } = await q;
  if (!warn("fetchMyStocktakes", error)) return [];
  return data || [];
}

/** 员工侧：我的采购申报 */
export async function fetchMyPurchaseRequests(
  staffId: string,
): Promise<PurchaseRequest[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("purchase_requests")
    .select("*")
    .eq("staff_id", staffId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (!warn("fetchMyPurchaseRequests", error)) return [];
  return data || [];
}

export interface StaffSession {
  staffId: string;
  name: string;
  roles: Role[];
  exp: number;
}

const SESSION_KEY = "staff_session";
const SESSION_MS = 7 * 86400_000;

export function loadStaffSession(): Omit<StaffSession, "exp"> | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StaffSession;
    if (!s.staffId || Date.now() > s.exp) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return { staffId: s.staffId, name: s.name, roles: s.roles || [] };
  } catch {
    return null;
  }
}

export function saveStaffSession(s: Omit<StaffSession, "exp">) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ ...s, exp: Date.now() + SESSION_MS }),
  );
}

export function clearStaffSession() {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * 员工登录：姓名+密码。
 * bcrypt 比对在数据库函数 owner_verify_staff 内完成（哈希不出库、前端无法读取）。
 */
export async function staffLogin(
  name: string,
  password: string,
): Promise<Omit<StaffSession, "exp"> | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("owner_verify_staff", {
    p_name: name.trim(),
    p_password: password,
  });
  if (error) {
    warn("staffLogin", error);
    return null;
  }
  const res = data as {
    ok?: boolean;
    staff?: { id: string; name: string; roles?: string[] };
  } | null;
  if (!res?.ok || !res.staff) return null;
  return {
    staffId: res.staff.id,
    name: res.staff.name,
    roles: Array.isArray(res.staff.roles) ? (res.staff.roles as Role[]) : [],
  };
}

/** 员工提交任务完成情况 */
export async function submitStaffTask(
  taskId: string,
  checklist: ChecklistItem[],
  note: string,
  photos: string[],
  resubmitting: boolean,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("staff_tasks")
    .update({
      checklist,
      note,
      photos,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      ...(resubmitting ? { resubmit_count: 1 } : {}),
    })
    .eq("id", taskId);
  return warn("submitStaffTask", error);
}

/** 员工提交盘点（actual 为空视为暂存 drafted） */
export async function submitStocktakeTask(
  taskId: string,
  actualQty: number | null,
  note: string,
  photos: string[],
  allowDraft: boolean,
): Promise<"drafted" | "submitted" | false> {
  if (!supabase) return false;
  const status =
    actualQty === null ? (allowDraft ? "drafted" : "submitted") : "submitted";
  const { error } = await supabase
    .from("stocktake_tasks")
    .update({
      actual_qty: actualQty,
      note,
      photos,
      status,
      submitted_at: actualQty === null ? null : new Date().toISOString(),
    })
    .eq("id", taskId);
  if (!warn("submitStocktakeTask", error)) return false;
  return status;
}

/** 员工新建采购申报 */
export async function createPurchaseRequest(
  session: { staffId: string; name: string },
  input: {
    item_name: string;
    quantity: number;
    unit: string;
    category: string;
    urgency: "normal" | "urgent";
    expected_date: string | null;
    note: string;
    photos: string[];
  },
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("purchase_requests").insert({
    staff_id: session.staffId,
    staff_name: session.name,
    ...input,
    status: "pending",
  });
  return warn("createPurchaseRequest", error);
}

/** 员工侧改报被驳回的申报 → 重置为待审批 */
export async function resubmitPurchaseRequest(
  id: string,
  patch: Partial<
    Pick<
      PurchaseRequest,
      | "item_name"
      | "quantity"
      | "unit"
      | "category"
      | "urgency"
      | "expected_date"
      | "note"
      | "photos"
    >
  >,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("purchase_requests")
    .update({
      ...patch,
      status: "pending",
      reject_reason: "",
      decided_at: null,
    })
    .eq("id", id);
  return warn("resubmitPurchaseRequest", error);
}

// ───────────────────────── 图片压缩（员工端拍照） ─────────────────────────

/** 压缩到 ~200KB 以内的 jpeg dataURL，避免 JSONB 行过大 */
export async function compressPhoto(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  try {
    const bitmap = await createImageBitmap(
      await fetch(dataUrl).then((r) => r.blob()),
    );
    const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas
      .getContext("2d")
      ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let q = 0.7;
    let out = canvas.toDataURL("image/jpeg", q);
    while (out.length > 280_000 && q > 0.3) {
      q -= 0.15;
      out = canvas.toDataURL("image/jpeg", q);
    }
    return out;
  } catch {
    return dataUrl;
  }
}
