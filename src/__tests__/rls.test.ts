import { describe, it, expect } from 'vitest';

// T10 灰度两用例：anon settings 403 / ADMIN_SECRET 缺失 500

describe('RLS and auth gray cases', ()=>{
  it('anon settings should be via view (settings_public) not table', async ()=>{
    // 静态取证：supabase_schema.sql 已删 anon_read_settings，视图存在
    const fs = await import('fs');
    const sql = fs.readFileSync('supabase_schema.sql','utf-8');
    expect(sql).not.toContain('CREATE POLICY "anon_read_settings" ON public.settings');
    expect(sql).toContain('CREATE OR REPLACE VIEW public.settings_public');
    expect(sql).toContain('GRANT SELECT ON public.settings_public TO anon');
  });
  it('ADMIN_SECRET missing in production should 500 E_CONFIG', async ()=>{
    const { requireAdmin } = await import('../../server/middleware/auth');
    // mock request
    const req: any = { headers:{}, body:{}, query:{} };
    let status=0; let body:any=null;
    const res:any = { status:(c:number)=>{ status=c; return { json:(b:any)=>{ body=b; } } } };
    const next=()=>{ status=200; };
    const origEnv=process.env.ADMIN_SECRET;
    const origNodeEnv=process.env.NODE_ENV;
    delete process.env.ADMIN_SECRET;
    process.env.NODE_ENV='production';
    // re-evaluate auth module cache - call directly
    // requireAdmin 动态读 env，所以直接调用应 500
    requireAdmin(req,res,next);
    expect(status).toBe(500);
    expect(body?.code).toBe('E_CONFIG');
    process.env.ADMIN_SECRET=origEnv;
    process.env.NODE_ENV=origNodeEnv;
  });
});
