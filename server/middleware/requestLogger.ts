import type { Request, Response, NextFunction } from 'express';
export function requestLogger(req: Request, res: Response, next: NextFunction){
  const start=Date.now();
  const { method, url } = req;
  res.on('finish', ()=>{
    const ms=Date.now()-start;
    const lvl=res.statusCode>=500?'error':res.statusCode>=400?'warn':'info';
    const line=`[${new Date().toISOString()}] [${lvl}] [http] ${method} ${url} -> ${res.statusCode} ${ms}ms`;
    if(lvl==='error') console.error(line);
    else if(lvl==='warn') console.warn(line);
    else console.log(line);
  });
  next();
}
export function errorHandler(err:any, _req:Request, res:Response, _next:NextFunction){
  console.error(`[${new Date().toISOString()}] [error] [http] unhandled`, err);
  res.status(500).json({ error: err?.message || 'Internal Server Error', code: 'E_SERVER' });
}
