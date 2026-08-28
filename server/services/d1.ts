import * as dotenv from 'dotenv';
dotenv.config();
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_D1_DB_ID = process.env.CLOUDFLARE_D1_DB_ID;

export async function queryD1(sql: string, params: any[] = []) {
  if (!CF_API_TOKEN || !CF_ACCOUNT_ID || !CF_D1_DB_ID) throw new Error('Cloudflare D1 not configured');
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DB_ID}/query`;
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${CF_API_TOKEN}`, 'Content-Type':'application/json' }, body: JSON.stringify({ sql, params }) });
  if (!res.ok) { const t=await res.text(); console.error('[D1]',t); throw new Error(`D1 ${res.status}`); }
  const data:any=await res.json();
  if(!data.success){ console.error('[D1]',data.errors); throw new Error('D1 query failed'); }
  return data.result[0];
}
export function isD1Configured(){ return !!(CF_API_TOKEN && CF_ACCOUNT_ID && CF_D1_DB_ID); }
