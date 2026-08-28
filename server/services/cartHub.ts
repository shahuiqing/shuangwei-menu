import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import lockfile from 'proper-lockfile';
export const clients = new Set<{ ws:any; table:string; role:string }>();
// U1 D1 主写 + proper-lockfile 防 TOCTOU
const CART_FILE = path.join(process.env.NODE_ENV==='production'? '/tmp' : process.cwd(), 'cart-hub.json');
function loadCarts(): Record<string, Record<string,number>>{
  try{ if(fs.existsSync(CART_FILE)) return JSON.parse(fs.readFileSync(CART_FILE,'utf-8')); } catch{}
  return {};
}
async function saveCarts(c: Record<string, Record<string,number>>){
  const dataStr=JSON.stringify(c);
  // 1) D1 主写（若配置）
  let d1Ok=false;
  try{
    const m=await import('./d1');
    if(m.isD1Configured()){
      await m.queryD1('CREATE TABLE IF NOT EXISTS cart_hub (id TEXT PRIMARY KEY, data TEXT)',[]);
      await m.queryD1('INSERT INTO cart_hub (id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',['global',dataStr]);
      d1Ok=true;
    }
  } catch(e){ console.warn('[cartHub] D1 persist failed, fallback file',e); }
  if(d1Ok) return;
  // 2) 文件降级 + proper-lockfile 防并发截断/丢失更新
  let release:(()=>Promise<void>)|null=null;
  try{
    if(!fs.existsSync(CART_FILE)) fs.writeFileSync(CART_FILE,'{}');
    release=await lockfile.lock(CART_FILE, { retries:{ retries:5, minTimeout:20, maxTimeout:100 } });
    const tmp=CART_FILE+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
    fs.writeFileSync(tmp, dataStr);
    fs.renameSync(tmp, CART_FILE);
  } catch(e){ console.warn('[cartHub] file persist',e); }
  finally{ try{ await release?.(); } catch{} }
}
export const tableCarts: Record<string, Record<string,number>> = loadCarts();
// 预热：启动时若 D1 有数据则覆盖文件
(async()=>{
  try{
    const m=await import('./d1');
    if(m.isD1Configured()){
      const r=await m.queryD1('SELECT data FROM cart_hub WHERE id=?',['global']);
      const d=r?.results?.[0]?.data;
      if(d){ const obj=JSON.parse(d); Object.assign(tableCarts, obj); }
    }
  } catch{}
})();

export async function setCart(table:string, cart:Record<string,number>){
  tableCarts[table]=cart; await saveCarts(tableCarts);
}
export async function clearCart(table:string){ delete tableCarts[table]; await saveCarts(tableCarts); }

export function broadcastCart(table:string, cart:Record<string,number>, excludeWs?:any){
  clients.forEach(c=>{
    if(c.table===table && c.role==='customer' && c.ws.readyState===1 && c.ws!==excludeWs){
      c.ws.send(JSON.stringify({ type:'cart_sync', cart }));
    }
  });
}
export function broadcastAdmin(payload:any){
  clients.forEach(c=>{
    if((c.role==='admin' || c.table==='admin') && c.ws.readyState===1){
      c.ws.send(JSON.stringify({ type:'admin_notification', ...payload }));
    }
  });
}
