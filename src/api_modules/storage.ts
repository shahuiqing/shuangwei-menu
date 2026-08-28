import { supabase, isSupabaseConfigured, isSupabaseHealthy } from '../supabase';
import { blobStorage } from '../services/blobStorage';
import { logger, ERR } from '../utils/logger';

export async function uploadBlob(base64:string, basePath:string): Promise<string>{
  logger.info('storage', `uploadBlob start ${basePath}`, { origLen: base64.length });
  let compressed=base64;
  try{
    const { compressBase64Image } = await import('../utils/image');
    compressed=await compressBase64Image(base64,800,800,0.72);
    if(compressed.length>400*1024) compressed=await compressBase64Image(compressed,600,600,0.65);
  } catch(e){ logger.warn('storage','compress failed',e,ERR.STORAGE_UPLOAD); }
  try{
    const url=await blobStorage.uploadImage(compressed, basePath);
    if(url && (url.startsWith('http://')||url.startsWith('https://'))) return url;
    if(url && url.startsWith('data:image/')) compressed=url;
  } catch(e){ console.warn('[uploadBlob] storage',e); }
  if(compressed.startsWith('data:image/') && compressed.length>500*1024){
    try{
      const { compressBase64Image } = await import('../utils/image');
      compressed=await compressBase64Image(compressed,500,500,0.6);
    } catch{}
    if(compressed.length>500*1024){ console.warn('[uploadBlob] still >500KB discard'); return ''; }
  }
  return compressed;
}

export async function getStorageDiagnostics(){
  if(supabase && isSupabaseConfigured && isSupabaseHealthy){
    try{
      const folders=["dishes","backgrounds","bg","logo","promotions","categories"];
      let total=0; const files: any[]=[];
      const { data:root } = await supabase.storage.from('menu-assets').list('');
      if(root) for(const it of root){
        if(it.name==='.emptyFolderPlaceholder') continue;
        const sz=(it as any).metadata?.size||(it as any).size||0;
        if(sz>0){ total+=sz; files.push({name:it.name, path:it.name, size:sz, createdAt:(it as any).created_at||''}); }
        else if(!folders.includes(it.name) && it.name.indexOf('.')===-1) folders.push(it.name);
      }
      for(const folder of folders){
        const { data } = await supabase.storage.from('menu-assets').list(folder);
        if(data) for(const f of data){
          if(f.name==='.emptyFolderPlaceholder') continue;
          const sz=(f as any).metadata?.size||(f as any).size||0;
          total+=sz; files.push({name:f.name, path:`${folder}/${f.name}`, size:sz, createdAt:(f as any).created_at||''});
        }
      }
      files.sort((a,b)=>b.size-a.size);
      return { success:true, totalUsedBytes:total, bucketLimitBytes:1024*1024*1024, files, configured:true };
    } catch(e:any){ return { success:false, error:e.message, configured:true }; }
  }
  return { success:false, error:'Supabase not configured', configured:false };
}

export async function deleteStorageFile(filePath:string){
  if(supabase && isSupabaseConfigured && isSupabaseHealthy){
    try{
      const { error } = await supabase.storage.from('menu-assets').remove([filePath]);
      if(error) throw error;
      return { success:true };
    } catch(e:any){ return { success:false, error:e.message }; }
  }
  return { success:false, error:'not configured' };
}
