import { supabase, isSupabaseConfigured, isSupabaseHealthy } from '../supabase';
import { handleSupabaseReadError, handleSupabaseWriteError, triggerBroadcast } from './client';
import { logger, ERR } from '../utils/logger';

let listeners: ((t:any[])=>void)[] = [];

async function getTablesRaw(): Promise<any[]> {
  try{
    if(supabase && isSupabaseConfigured && isSupabaseHealthy){
      const { data, error } = await supabase.from('tables').select('*');
      if(error) throw error;
      if(data) return data;
    }
  } catch(e){ handleSupabaseReadError(e,'getTables'); logger.error('tables','getTables failed',e,ERR.TABLES_READ); }
  return JSON.parse(localStorage.getItem('local_tables')||'[]');
}

export async function createTableQr(tableNo:string){
  logger.info('tables','createTableQr',{tableNo});
  try{
    if(supabase && isSupabaseConfigured && isSupabaseHealthy){
      const { data:ex, error:se } = await supabase.from('tables').select('*').eq('tableNo',tableNo).maybeSingle();
      if(se) throw se;
      if(ex) return ex;
      const rec={ tableNo, key: Math.random().toString(36).slice(2,10), active:true, createdAt: new Date().toISOString() };
      const { error } = await supabase.from('tables').insert(rec);
      if(error) throw error;
      triggerBroadcast('tables_changed'); return rec;
    }
  } catch(e){ handleSupabaseWriteError(e,'createTableQr'); logger.error('tables','createTableQr failed',e,ERR.TABLES_WRITE); }
  const arr=JSON.parse(localStorage.getItem('local_tables')||'[]');
  const idx=arr.findIndex((t:any)=>t.tableNo===tableNo);
  if(idx!==-1) return arr[idx];
  const rec={ tableNo, key: Math.random().toString(36).slice(2,10), active:true, createdAt: new Date().toISOString() };
  arr.push(rec); localStorage.setItem('local_tables', JSON.stringify(arr)); triggerBroadcast('tables_changed'); return rec;
}

export async function getTableQr(tableNo:string){
  try{
    if(supabase && isSupabaseConfigured && isSupabaseHealthy){
      const { data, error } = await supabase.from('tables').select('*').eq('tableNo',tableNo).maybeSingle();
      if(error) throw error;
      if(data) return data;
    }
  } catch(e){ handleSupabaseReadError(e,'getTableQr'); logger.error('tables','getTableQr failed',e,ERR.TABLES_READ); }
  const arr=JSON.parse(localStorage.getItem('local_tables')||'[]');
  return arr.find((t:any)=>t.tableNo===tableNo)||null;
}

export async function updateTableStatus(tableNo:string, active:boolean){
  try{
    if(supabase && isSupabaseConfigured && isSupabaseHealthy){
      const { error } = await supabase.from('tables').update({ active }).eq('tableNo',tableNo);
      if(error) throw error;
      triggerBroadcast('tables_changed');
    }
  } catch(e){ handleSupabaseWriteError(e,'updateTableStatus'); logger.error('tables','updateTableStatus failed',e,ERR.TABLES_WRITE); }
  const arr=JSON.parse(localStorage.getItem('local_tables')||'[]');
  const idx=arr.findIndex((t:any)=>t.tableNo===tableNo);
  if(idx!==-1){ arr[idx].active=active; localStorage.setItem('local_tables', JSON.stringify(arr)); triggerBroadcast('tables_changed'); }
}

export async function deleteTableQr(tableNo:string){
  logger.info('tables','deleteTableQr',{tableNo});
  try{
    if(supabase && isSupabaseConfigured && isSupabaseHealthy){
      const { error } = await supabase.from('tables').delete().eq('tableNo',tableNo);
      if(error) throw error;
      triggerBroadcast('tables_changed');
    }
  } catch(e){ handleSupabaseWriteError(e,'deleteTableQr'); logger.error('tables','deleteTableQr failed',e,ERR.TABLES_WRITE); }
  const arr=(JSON.parse(localStorage.getItem('local_tables')||'[]') as any[]).filter(t=>t.tableNo!==tableNo);
  localStorage.setItem('local_tables', JSON.stringify(arr)); triggerBroadcast('tables_changed');
}

export function subscribeToTables(cb:(t:any[])=>void){
  listeners.push(cb);
  let last='';
  const fetchAndTrigger=async()=>{
    const remote=await getTablesRaw();
    const local=JSON.parse(localStorage.getItem('local_tables')||'[]');
    const merged=[...remote];
    local.forEach((lt:any)=>{ if(!merged.some(rt=>rt.tableNo===lt.tableNo)) merged.push(lt); });
    const j=JSON.stringify(merged);
    if(j!==last){ last=j; cb(merged); listeners.forEach(x=>{ if(x!==cb) x(merged); }); }
  };
  fetchAndTrigger();
  const poll=setInterval(()=>{ if(!isSupabaseConfigured || !isSupabaseHealthy) fetchAndTrigger(); },5000);
  return ()=>{ listeners = listeners.filter(l=>l!==cb); clearInterval(poll); };
}
