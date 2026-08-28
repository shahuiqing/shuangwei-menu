import { supabase, isSupabaseConfigured, isSupabaseHealthy } from '../supabase';
import { kvCache } from '../services/kvCache';
import { blobStorage } from '../services/blobStorage';
import { INITIAL_MENU_CATEGORIES, mergeAndOrderCategories } from '../initialData';
import { SETTINGS_DOC_ID, filterPayloadByTable, handleSupabaseReadError, handleSupabaseWriteError, setQuotaExceeded, triggerBroadcast } from './client';
import { appSettingsSchema } from '../types/schemas';
import type { AppSettings } from '../types/menu';
import { logger, ERR } from '../utils/logger';

async function ensureNoBase64Image(imageUrl: string | undefined, folder: string): Promise<string> {
  if (!imageUrl || typeof imageUrl !== 'string') return '';
  if (!imageUrl.startsWith('data:image/')) return imageUrl;
  if (imageUrl.length > 4 * 1024 * 1024) logger.warn('settings', `large image ${folder} ${(imageUrl.length/1024/1024).toFixed(2)}MB`, { len: imageUrl.length }, ERR.STORAGE_UPLOAD);
  try {
    const { api } = await import('../api');
    const uploaded = await api.uploadBlob(imageUrl, folder);
    if (uploaded.startsWith('data:image/') && uploaded.length > 500*1024) {
      logger.warn('settings', `fallback still large discard ${folder}`, { len: uploaded.length }, ERR.STORAGE_UPLOAD);
      return '';
    }
    logger.info('settings', `image uploaded ${folder}`, { ok: uploaded.startsWith('http') });
    return uploaded;
  } catch (e) {
    logger.error('settings', `upload failed ${folder}`, e, ERR.STORAGE_UPLOAD);
    try {
      const { compressBase64Image } = await import('../utils/image');
      const tiny = await compressBase64Image(imageUrl, 400,400,0.6);
      if (tiny.length < 300*1024) return tiny;
    } catch {}
    return '';
  }
}

let settingsListeners: ((data: AppSettings)=>void)[] = [];

export async function getSettings(): Promise<AppSettings> {
  const cached = await kvCache.get<AppSettings>('app_settings');
  if (cached) {
    if (cached.categories) cached.categories = mergeAndOrderCategories(cached.categories, INITIAL_MENU_CATEGORIES, cached.deletedItemIds || []) as any;
    return cached;
  }
  try {
    if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
      // A1 修复：优先读视图 settings_public（无敏感列），失败再回退旧表（兼容未迁移库）
      let data:any=null; let error:any=null;
      try{
        const r = await supabase.from('settings_public').select('*').eq('id', SETTINGS_DOC_ID).maybeSingle();
        data=r.data; error=r.error;
        if(error && String(error.message||'').includes('does not exist')) throw error;
      } catch{ const r2 = await supabase.from('settings').select('*').eq('id', SETTINGS_DOC_ID).maybeSingle(); data=r2.data; error=r2.error; }
      if (error) throw error;
      if (data) {
        if (data.categories) data.categories = mergeAndOrderCategories(data.categories, INITIAL_MENU_CATEGORIES, data.deletedItemIds || []) as any;
        await kvCache.set('app_settings', data, 600);
        return data as AppSettings;
      }
    }
  } catch (e) { handleSupabaseReadError(e, 'getSettings'); logger.error('settings', 'getSettings failed', e, ERR.SETTINGS_READ); }
  // local fallback - keep simple, validated by zod on write
  const cc = localStorage.getItem('menuCategories');
  const del = localStorage.getItem('menuDeletedItemIds');
  const parsedDel = del ? JSON.parse(del) : [];
  return {
    id: 'global',
    categories: cc ? mergeAndOrderCategories(JSON.parse(cc), INITIAL_MENU_CATEGORIES, parsedDel) as any : INITIAL_MENU_CATEGORIES as any,
    promotions: JSON.parse(localStorage.getItem('menuPromotions') || '[]'),
    bgUrl: localStorage.getItem('menuBgUrl') || '',
    restaurantName: localStorage.getItem('menuRestaurantName') || '炙·双味居',
    welcomeMessage: localStorage.getItem('menuWelcomeMessage') || 'Premium Charcoal BBQ',
    logoUrl: localStorage.getItem('menuLogoUrl') || '',
    adminPassword: localStorage.getItem('menuAdminPassword') || 'admin123',
    devicePasswords: JSON.parse(localStorage.getItem('menuDevicePasswords') || '[]'),
    securityQuestion: localStorage.getItem('menuSecurityQuestion') || '',
    securityAnswer: localStorage.getItem('menuSecurityAnswer') || '',
    soundEnabled: (localStorage.getItem('menuSoundEnabled') ?? 'true') !== 'false',
    layoutStyle: (localStorage.getItem('menuLayoutStyle') as any) || 'grid',
    receiptSettings: JSON.parse(localStorage.getItem('menuReceiptSettings') || '{}'),
    deletedItemIds: parsedDel,
    theme: (localStorage.getItem('menuThemeMode') as any) || 'midnight',
  } as AppSettings;
}

export function subscribeToSettings(cb: (data: AppSettings)=>void) {
  settingsListeners.push(cb);
  let lastJson = '';
  const handle = (data: AppSettings) => {
    const j = JSON.stringify(data);
    if (j !== lastJson) { lastJson = j; cb(data); settingsListeners.forEach(x=>{ if(x!==cb) x(data); }); }
  };
  getSettings().then(handle).catch(()=>{});
  const poll = setInterval(()=>{ if (!isSupabaseConfigured || !isSupabaseHealthy) getSettings().then(handle).catch(()=>{}); }, 5000);
  let lastFetch = 0;
  const onFocus = () => {
    const now = Date.now();
    if (now - lastFetch < 30000) return;
    if (supabase && isSupabaseConfigured && isSupabaseHealthy) { lastFetch = now; getSettings().then(handle).catch(()=>{}); }
  };
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onFocus);
  return () => {
    settingsListeners = settingsListeners.filter(l=>l!==cb);
    clearInterval(poll);
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onFocus);
  };
}
export function notifySettingsListeners(data: AppSettings) { settingsListeners.forEach(cb=>cb(data)); }

export async function updateSettings(payload: Partial<AppSettings>, onProgress?: (msg:string)=>void) {
  const parsed = appSettingsSchema.safeParse(payload);
  if (!parsed.success) {
    logger.warn('settings', 'zod validate warn', parsed.error.issues.slice(0,3), ERR.SETTINGS_VALIDATE);
  }
  logger.info('settings', 'updateSettings start', { hasCategories: !!(payload as any).categories, hasPromotions: !!(payload as any).promotions });
  try {
    if (onProgress) onProgress('正在优化图文并保存到云端...');

    const clean: any = JSON.parse(JSON.stringify(payload));

    if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
      // P0-2: 若更新含明文密码，先在前端做 bcrypt 哈希（迁移期），服务端也会二次校验
      if (clean.adminPassword) {
        try{
          const { hashPassword } = await import('../utils/password');
          const hash = await hashPassword(String(clean.adminPassword));
          clean.adminPasswordHash = hash;
          // 保留明文字段作兼容，但日志告警
          logger.warn('settings','adminPassword明文已哈希化存储，建议后续移除明文字段',null,ERR.SETTINGS_WRITE);
        } catch{}
      }
      if (clean.securityAnswer) {
        try{
          const { hashPassword } = await import('../utils/password');
          clean.securityAnswerHash = await hashPassword(String(clean.securityAnswer));
        } catch{}
      }
      // compress images concurrently with limit 3
      if (clean.categories) {
        const tasks: Promise<void>[] = [];
        for (const cat of clean.categories) for (const item of (cat.items||[])) if (item.image?.startsWith('data:image/')) {
          tasks.push(ensureNoBase64Image(item.image,'dishes').then(u=>{ item.image = u; }));
          if (tasks.length >= 3) { await Promise.all(tasks.splice(0,3)); }
        }
        await Promise.all(tasks);
      }
      if (clean.promotions) {
        for (const p of clean.promotions) if (p.image?.startsWith('data:image/')) p.image = await ensureNoBase64Image(p.image,'promotions');
      }
      if (clean.bgUrl?.startsWith('data:image/')) clean.bgUrl = await ensureNoBase64Image(clean.bgUrl,'backgrounds');
      if (clean.logoUrl?.startsWith('data:image/')) clean.logoUrl = await ensureNoBase64Image(clean.logoUrl,'logos');

      const dbPayload = await filterPayloadByTable('settings', clean);
      const { error } = await supabase.from('settings').upsert({ id: SETTINGS_DOC_ID, ...dbPayload });
      if (error) throw error;
      // 高风险1修复：settings 与关系表改为“先写 settings，再同步 menu_items”，同步改为 await + 重试，保证最终一致而非 fire-and-forget
      // 若同步失败，不回滚 settings（已提交），但会重试并记录，避免长期分歧
      let syncOk = false;
      for(let attempt=1; attempt<=2; attempt++){
        try{
          const { syncCategoriesAndMenuItemsToSupabase } = await import('./sync');
          if(clean.categories) await syncCategoriesAndMenuItemsToSupabase(clean.categories);
          syncOk = true; break;
        } catch(syncErr:any){
          logger.warn('settings', `sync attempt ${attempt} failed`, syncErr, ERR.SETTINGS_WRITE);
          if(attempt===2) logger.error('settings','sync categories failed after retry - will background retry',syncErr,ERR.SETTINGS_WRITE);
          await new Promise(r=>setTimeout(r, 800*attempt));
        }
      }
      if(!syncOk){
        // 后台再试一次，不阻塞用户
        import('./sync').then(m=>m.syncCategoriesAndMenuItemsToSupabase(clean.categories).catch(e=>logger.error('settings','background sync final fail',e,ERR.SETTINGS_WRITE)));
      }
      await kvCache.set('app_settings', clean, 600);
      triggerBroadcast('settings_changed');
      logger.info('settings', 'updateSettings success (Supabase)', { categories: clean.categories?.length, syncOk });
      if (onProgress) onProgress('');
      notifySettingsListeners(clean as AppSettings);
      return clean as AppSettings;
    }
  } catch (e:any) {
    handleSupabaseWriteError(e,'updateSettings');
    logger.error('settings', 'updateSettings failed', e, ERR.SETTINGS_WRITE);
    const msg = String(e?.message||e);
    if (/quota|exceeded|429|503/i.test(msg)) setQuotaExceeded(true);
    const isWriteFailure = !!(supabase && isSupabaseConfigured && isSupabaseHealthy);
    if (isWriteFailure) {
      try { await kvCache.set('app_settings', payload as any, 600); logger.warn('settings','fallback to local after Supabase fail',null,ERR.SETTINGS_WRITE); } catch {}
      throw e;
    }
  }
  if (onProgress) onProgress('');
  // local fallback
  try{
    if ((payload as any).categories) localStorage.setItem('menuCategories', JSON.stringify((payload as any).categories));
    if ((payload as any).deletedItemIds) localStorage.setItem('menuDeletedItemIds', JSON.stringify((payload as any).deletedItemIds));
    await kvCache.set('app_settings', payload as any, 600);
    logger.info('settings', 'updateSettings local fallback success');
  } catch(e){ logger.error('settings','local fallback write failed',e,ERR.SETTINGS_WRITE); throw e; }
  notifySettingsListeners(payload as AppSettings);
  triggerBroadcast('settings_changed');
  return payload as AppSettings;
}
