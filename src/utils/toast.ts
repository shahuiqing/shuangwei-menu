import { logger } from './logger';

type ToastType = 'success' | 'error' | 'info' | 'warn';

let container: HTMLDivElement | null = null;

function ensureContainer(){
  if(container) return container;
  container = document.createElement('div');
  container.id='__app_toast_container';
  container.style.cssText='position:fixed;top:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
  document.body.appendChild(container);
  return container;
}

export function toast(msg:string, type:ToastType='info', duration=3000){
  const c=ensureContainer();
  const el=document.createElement('div');
  const bg = type==='success'?'#16a34a': type==='error'?'#dc2626': type==='warn'?'#ea580c':'#27272a';
  el.style.cssText=`background:${bg};color:#fff;padding:10px 14px;border-radius:10px;font-size:13px;max-width:360px;box-shadow:0 8px 24px rgba(0,0,0,.3);pointer-events:auto;opacity:0;transform:translateY(-8px);transition:all .2s`;
  el.textContent=msg;
  c.appendChild(el);
  requestAnimationFrame(()=>{ el.style.opacity='1'; el.style.transform='translateY(0)'; });
  setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateY(-8px)'; setTimeout(()=>el.remove(),200); }, duration);
  if(type==='error') logger.error('ui', msg, null, 'E_UI');
  else if(type==='warn') logger.warn('ui', msg);
  else logger.info('ui', msg);
}

// 快捷：CRUD 操作结果提示
export const notify = {
  created: (name:string)=> toast(`✅ 已创建 ${name}`, 'success'),
  updated: (name:string)=> toast(`✅ 已更新 ${name}`, 'success'),
  deleted: (name:string)=> toast(`🗑️ 已删除 ${name}`, 'info'),
  error: (action:string, err:any)=> {
    const msg = err?.message || String(err) || '未知错误';
    toast(`❌ ${action}失败: ${msg}`, 'error', 4000);
  }
};
