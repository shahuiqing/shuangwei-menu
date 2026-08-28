import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// 原子写：先写临时文件再 rename，避免多并发截断
export function writeFileAtomic(filePath: string, data: string){
  const dir=path.dirname(filePath);
  if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
  const tmp=filePath+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
  fs.writeFileSync(tmp, data, 'utf-8');
  fs.renameSync(tmp, filePath);
}
export function readJsonSafe(filePath: string, fallback: any = []){
  try{
    if(!fs.existsSync(filePath)) return fallback;
    const raw=fs.readFileSync(filePath,'utf-8');
    if(!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch(e){
    console.error(`[atomic] read ${filePath} failed`, e);
    // 尝试读备份
    try{
      const bak=filePath+'.bak';
      if(fs.existsSync(bak)) return JSON.parse(fs.readFileSync(bak,'utf-8'));
    } catch{}
    return fallback;
  }
}
