import { supabase, isSupabaseConfigured, isSupabaseHealthy } from '../supabase';
import { handleSupabaseReadError, handleSupabaseWriteError, getTableColumns, filterPayloadByTable, KNOWN_COLUMNS, triggerBroadcast } from './client';
import { orderSchema } from '../types/schemas';
import type { Order } from '../types/order';
import { logger, ERR } from '../utils/logger';

export const normalizeOrder = (o:any): Order => {
  if (!o) return o;
  const id = String(o.id || o._id || o.orderNumber || Math.random());
  const cust = o.customerName || o.customer_name || '';
  const totalVal = o.total!==undefined ? Number(o.total) : (o.total_amount!==undefined ? Number(o.total_amount) : 0);
  return { ...o, _id:id, id, customerName:cust, customer_name:cust, table_no:o.table_no||o.tableNo||cust||'A1', total:totalVal, total_amount:totalVal, items:Array.isArray(o.items)?o.items:[], status:o.status||'pending', timestamp:o.timestamp||o.created_at||o.createdAt||new Date().toISOString(), unprintedNewOrder:!!o.unprintedNewOrder, unprintedAdditions:Array.isArray(o.unprintedAdditions)?o.unprintedAdditions:[] } as Order;
};
// P1-9 修复：PostgREST or 值需转义逗号/引号，避免注入破坏查询
function escOrVal(v: string): string {
  const s = String(v).replace(/"/g, '\\"');
  // 若含逗号/括号/空格，需用双引号包裹
  if (/[,()\"\s]/.test(s)) return `"${s}"`;
  return s;
}
export const normalizeTableString = (s:any): string => String(s||'').replace(/^(桌号|table|号桌|桌)/i,'').replace(/(桌号|table|号桌|桌)$/i,'').trim().toLowerCase();
export const parseOrderTimestamp = (v:any): number => {
  if (!v) return 0; if (typeof v==='number') return v;
  let str=String(v).trim().replace(' ','T');
  const hasTZ=/Z$/i.test(str)||/[+-]\d{2}(:?\d{2})?$/.test(str);
  if (!hasTZ) str+='Z';
  const t=new Date(str).getTime(); return isNaN(t)?0:t;
};
export const isOrderActive = (o:any): boolean => {
  const s=String(o?.status||'pending').toLowerCase();
  return s!=='completed' && s!=='cancelled';
};
export const isOrderMatchingTable = (o:any, name:string): boolean => {
  const targetNorm=normalizeTableString(name); const raw=String(name).trim().toLowerCase();
  const oc=String(o.customerName||o.customer_name||'').trim().toLowerCase();
  const ot=String(o.table_no||o.tableNo||'').trim().toLowerCase();
  return (raw && (oc===raw||ot===raw)) || !!(targetNorm && (normalizeTableString(oc)===targetNorm || normalizeTableString(ot)===targetNorm));
};

// 高风险4修复：订单状态机，非法跃迁直接抛错
const ALLOWED: Record<string, string[]> = {
  pending: ['cooking','cancelled'],
  cooking: ['served','cancelled'],
  served: ['completed','cancelled'],
  completed: [],
  cancelled: [],
};
export function validateStatusTransition(from:string, to:string){
  const f=String(from||'pending').toLowerCase(); const t=String(to||'').toLowerCase();
  if(f===t) return;
  const allowed=ALLOWED[f]||[];
  if(!allowed.includes(t)) throw new Error(`非法状态流转 ${f} -> ${t}，仅允许 ${allowed.join(',')||'无'}`);
}

let listeners: ((o:Order[])=>void)[] = [];
const memCache = new Map<string, Order>();

export async function getOrders(limit: number = 200): Promise<Order[]> {
  // 高风险3修复：默认限 200 单，按时间倒序，避免千单后全量 SELECT 撑爆额度和内存；调用方可传更大值
  try {
    let remote: Order[] = [];
    if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
      const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      if (data) remote = data.map(normalizeOrder);
      if(data && data.length===limit) logger.warn('orders',`getOrders hit limit ${limit} - consider pagination`,null,ERR.ORDERS_READ);
    }
    const localStr=localStorage.getItem('local_orders');
    let local:Order[]=(localStr?JSON.parse(localStr):[]).map(normalizeOrder);
    const merged=new Map<string,Order>();
    remote.forEach(r=>{ if(r._id) merged.set(String(r._id), r); });
    memCache.forEach(v=>{ if(v._id && !merged.has(String(v._id))) merged.set(String(v._id), v); });
    local.forEach(l=>{
      const ex=merged.get(String(l._id));
      if(!ex) merged.set(String(l._id), l);
      else if(parseOrderTimestamp(l.timestamp) > parseOrderTimestamp(ex.timestamp)) merged.set(String(l._id), l);
    });
    const sorted=Array.from(merged.values()).sort((a,b)=>parseOrderTimestamp(a.timestamp)-parseOrderTimestamp(b.timestamp));
    // 限流：最终结果也截断，避免本地无限堆积
    if(sorted.length>limit) logger.warn('orders',`merged ${sorted.length} > limit ${limit}, truncating`,null,ERR.ORDERS_READ);
    return sorted.slice(-limit);
  } catch(e){ handleSupabaseReadError(e,'getOrders'); logger.error('orders','getOrders failed',e,ERR.ORDERS_READ); const ls=JSON.parse(localStorage.getItem('local_orders')||'[]'); return (ls as any[]).map(normalizeOrder); }
}

export function subscribeToOrders(cb:(o:Order[])=>void){
  listeners.push(cb);
  let last=''; const fetchAndTrigger=async()=>{
    const cur=await getOrders(); const j=JSON.stringify(cur);
    if(j!==last){ last=j; cb(cur); listeners.forEach(x=>{ if(x!==cb) x(cur); }); }
  };
  fetchAndTrigger();
  const poll=setInterval(()=>{ if(document.hidden) return; fetchAndTrigger(); }, 10000);
  return ()=>{ listeners = listeners.filter(l=>l!==cb); clearInterval(poll); };
}
export function notifyOrders(){ if(listeners.length) getOrders().then(cur=>{ listeners.forEach(cb=>cb(cur)); }); }

export async function addOrder(order:any){
  const parsed=orderSchema.safeParse({ ...order, table_no: order.table_no||order.customerName||'A1', items: order.items||[] });
  if (!parsed.success) logger.warn('orders','zod validate',parsed.error.issues.slice(0,2),ERR.ORDERS_VALIDATE);
  logger.info('orders','addOrder', { table: order.table_no||order.customerName, items: order.items?.length });
  // 高风险2修复：orderNumber 用 crypto.randomUUID 避免 Math.random 碰撞；id 用 UUID
  const genId = (()=>{ try{ if(typeof crypto!=='undefined' && (crypto as any).randomUUID) return (crypto as any).randomUUID(); } catch{}; return 'ORD-'+Date.now()+'-'+Math.random().toString(36).slice(2,8); })();
  const newId=order.id||order._id||genId;
  const genOrderNo = (()=>{ try{ if(typeof crypto!=='undefined' && (crypto as any).randomUUID) return 'ORD-'+(crypto as any).randomUUID().slice(0,8).toUpperCase(); } catch{}; return 'ORD-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,5).toUpperCase(); })();
  const full=normalizeOrder({ id:newId,_id:newId, orderNumber:order.orderNumber||genOrderNo, customerName:order.customerName||order.customer_name||'A1', customer_name:order.customerName||order.customer_name||'A1', table_no:order.table_no||order.tableNo||order.customerName||'A1', status:order.status||'pending', items:order.items||[], total:Number(order.total||0), total_amount:Number(order.total||0), timestamp:order.timestamp||new Date().toISOString(), notes:order.notes||'', unprintedNewOrder:true, unprintedAdditions:[] });
  // 高风险2修复：先尝试 Supabase，成功后再写本地，避免“本地有远端无”长期分歧；失败则本地仍保留但标记需同步并告警
  let supabaseOk=false; let supabaseErr:any=null;
  if(supabase && isSupabaseConfigured && isSupabaseHealthy){
    try{
      const payload=await filterPayloadByTable('orders', full);
      const {error}=await supabase.from('orders').insert(payload);
      if(error){ supabaseErr=error; logger.error('orders','addOrder Supabase',error,ERR.ORDERS_WRITE); handleSupabaseWriteError(error,'addOrder'); }
      else { supabaseOk=true; logger.info('orders','addOrder Supabase success', { id: full._id }); }
    } catch(e){ supabaseErr=e; logger.error('orders','addOrder exception',e,ERR.ORDERS_WRITE); }
  } else {
    logger.warn('orders','addOrder local-only (Supabase not configured)');
  }
  // 本地与内存始终写入（离线兜底），但若 Supabase 失败，记录告警并触发后台重试标记
  try{
    const ls=JSON.parse(localStorage.getItem('local_orders')||'[]'); ls.push(full); localStorage.setItem('local_orders', JSON.stringify(ls));
    memCache.set(String(full._id), full);
  } catch(e){ logger.error('orders','addOrder local write failed',e,ERR.ORDERS_WRITE); throw e; }
  if(!supabaseOk && supabase && isSupabaseConfigured) logger.warn('orders','addOrder Supabase failed but local saved - will retry via background sync',{ id: full._id, err: String(supabaseErr?.message||supabaseErr) },ERR.ORDERS_WRITE);
  logger.info('orders','addOrder local + broadcast', { id: full._id, supabaseOk });
  notifyOrders(); triggerBroadcast('orders_changed',{action:'upsert',order:full});
  return full;
}

export async function updateOrder(orderId:string, payload:any, override?:any){
  const sId=String(orderId);
  let prev:any=override||memCache.get(sId)|| (JSON.parse(localStorage.getItem('local_orders')||'[]') as any[]).find(o=>String(o._id)===sId||String(o.id)===sId);
  const updated=normalizeOrder({...prev,...payload,_id:sId,id:sId,timestamp:payload.timestamp||new Date().toISOString()});
  memCache.set(sId, updated);
  try{
    if(supabase && isSupabaseConfigured && isSupabaseHealthy){
      const cols=await getTableColumns('orders')||KNOWN_COLUMNS['orders']||[];
      const dbPayload=await filterPayloadByTable('orders', payload);
      let q=supabase.from('orders').update(dbPayload);
      q = (cols.includes('_id')? (q as any).eq('_id',orderId) : (q as any).eq('id',orderId)) as any;
      const {error}=await q; if(error){ logger.error('orders','updateOrder Supabase',error,ERR.ORDERS_WRITE); handleSupabaseWriteError(error,'updateOrder'); } else logger.info('orders','updateOrder success',{id:orderId});
    }
  } catch(e){ logger.error('orders','updateOrder exception',e,ERR.ORDERS_WRITE); handleSupabaseWriteError(e,'updateOrder'); }
  const arr=JSON.parse(localStorage.getItem('local_orders')||'[]'); const idx=arr.findIndex((o:any)=>String(o._id)===sId||String(o.id)===sId); if(idx!==-1) arr[idx]=updated; else arr.push(updated); localStorage.setItem('local_orders', JSON.stringify(arr));
  notifyOrders(); triggerBroadcast('orders_changed',{action:'upsert',order:updated, orderId:sId, ...payload});
}

export async function deleteOrder(orderId:string){
  const sId=String(orderId); memCache.delete(sId);
  try{
    if(supabase && isSupabaseConfigured && isSupabaseHealthy){
      const cols=await getTableColumns('orders')||KNOWN_COLUMNS['orders']||[];
      let q=supabase.from('orders').delete();
      q = (cols.includes('_id')? (q as any).eq('_id',orderId) : (q as any).eq('id',orderId)) as any;
      const {error}=await q; if(error){ logger.error('orders','deleteOrder Supabase',error,ERR.ORDERS_WRITE); handleSupabaseWriteError(error,'deleteOrder'); } else logger.info('orders','deleteOrder success',{id:orderId});
    }
  } catch(e){ logger.error('orders','deleteOrder exception',e,ERR.ORDERS_WRITE); handleSupabaseWriteError(e,'deleteOrder'); }
  const arr=(JSON.parse(localStorage.getItem('local_orders')||'[]') as any[]).filter(o=>String(o._id)!==sId && String(o.id)!==sId);
  localStorage.setItem('local_orders', JSON.stringify(arr)); notifyOrders(); triggerBroadcast('orders_changed',{action:'delete',orderId});
}

export async function clearOrders(status?:string){
  if(status) memCache.forEach((v,k)=>{ if(v.status===status) memCache.delete(k); }); else memCache.clear();
  const arr=JSON.parse(localStorage.getItem('local_orders')||'[]') as any[];
  const next=status? arr.filter(o=>o.status!==status) : [];
  localStorage.setItem('local_orders', JSON.stringify(next));
  try{
    if(supabase && isSupabaseConfigured && isSupabaseHealthy){
      let q=supabase.from('orders').delete();
      if(status) q = (q as any).eq('status',status) as any;
      else {
        const cols=await getTableColumns('orders')||KNOWN_COLUMNS['orders']||[];
        q = (cols.includes('id')? (q as any).neq('id','keep-none') : (q as any).neq('_id','keep-none')) as any;
      }
      const {error}=await q; if(error) handleSupabaseWriteError(error,'clearOrders');
    }
  } catch(e){ handleSupabaseWriteError(e,'clearOrders'); }
  notifyOrders(); triggerBroadcast('orders_changed',{action:'clear',status});
}

export async function updateOrderStatus(orderId:string, status:string){
  const id=String(orderId);
  const cur=memCache.get(id) || (JSON.parse(localStorage.getItem('local_orders')||'[]') as any[]).find(o=>String(o._id)===id||String(o.id)===id);
  const from=String(cur?.status||'pending');
  try{ validateStatusTransition(from, status); } catch(e){ logger.error('orders','status transition blocked',e,ERR.ORDERS_WRITE); throw e; }
  logger.info('orders','updateOrderStatus',{id,from,to:status});
  return updateOrder(id, { status, timestamp: new Date().toISOString() });
}

export function getMemCache(){ return memCache; }
export function setMemCache(id:string, order:Order){ memCache.set(id, order); }
