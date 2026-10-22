// 中转页数据接口：按 Cookie 状态返回 会员 / 降级 / 游客 内容
// 核心原则：降级而非拒绝——风险高时只隐藏群组入口，不弹任何提示，用户无感知

// ===== base64url =====
function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return atob(s);
}

// ===== HMAC 签名（Web Crypto API） =====
async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function sign(payloadB64, secret) {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verify(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expected = await sign(payloadB64, secret);
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(payloadB64));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ===== 数据获取（KV 读取） =====
async function kvGet(env, key) {
  const raw = await env.STORE_KV.get(key);
  return raw ? JSON.parse(raw) : null;
}

function getCookieValue(cookieHeader, name) {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

// ===== 风控：设备指纹与 IP 段比对 =====
async function checkRisk(env, uid, fp, ip) {
  if (!uid) return { risk: 0, mode: 'guest' };

  const ipPrefix = ip.split('.').slice(0, 2).join('.');
  const bindRaw = await env.STORE_KV.get(`bind:${uid}`);

  if (!bindRaw) {
    await env.STORE_KV.put(
      `bind:${uid}`,
      JSON.stringify({ fp, ip: ipPrefix, t: Date.now() })
    );
    return { risk: 0, mode: 'member' };
  }

  const bind = JSON.parse(bindRaw);
  let risk = 0;

  // 指纹不一致：+2 风险分
  if (fp && bind.fp && fp !== bind.fp) risk += 2;
  // IP 段（前两段）不一致：+1 风险分
  if (bind.ip && bind.ip !== ipPrefix) risk += 1;

  const mode = risk >= 2 ? 'limited' : 'member';

  // 仅在指纹或 IP 段变化时更新绑定记录，避免每次请求都写 KV
  if ((fp && bind.fp !== fp) || bind.ip !== ipPrefix) {
    await env.STORE_KV.put(
      `bind:${uid}`,
      JSON.stringify({ fp: fp || bind.fp, ip: ipPrefix, t: Date.now() })
    );
  }

  return { risk, mode };
}

function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

// ===== 主处理函数 =====
export async function onRequest(context) {
  const { request, env } = context;

  if (!env.HMAC_SECRET || !env.STORE_KV) {
    return new Response('Service not configured', { status: 500 });
  }

  const token = getCookieValue(request.headers.get('Cookie') || '', 'mid');
  const fp = request.headers.get('X-Device-FP') || '';
  const ip =
    request.headers.get('CF-Connecting-IP') ||
    (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim() ||
    '0.0.0.0';

  const payload = token ? await verify(token, env.HMAC_SECRET) : null;

  // 无有效 Cookie → 游客内容（基础菜单 + 社交媒体，无群组）
  if (!payload) {
    const [menus, socials] = await Promise.all([
      kvGet(env, 'menus:public'),
      kvGet(env, 'socials:all'),
    ]);
    return jsonResponse({
      mode: 'guest',
      menus: menus || [],
      socials: socials || [],
      groups: [],
    });
  }

  // 有效 Cookie → 会员内容 + 风控检查
  const { risk, mode } = await checkRisk(env, payload.uid, fp, ip);
  const isMember = mode === 'member';

  const [memberMenus, publicMenus, socials, groups, storeConfig] = await Promise.all([
    kvGet(env, `menus:member:${payload.sid}`),
    kvGet(env, 'menus:public'),
    kvGet(env, 'socials:all'),
    isMember ? kvGet(env, `groups:${payload.sid}`) : Promise.resolve(null),
    kvGet(env, `config:${payload.sid}`),
  ]);

  const menus = isMember
    ? [...(memberMenus || []), ...(publicMenus || [])]
    : publicMenus || [];

  return jsonResponse({
    mode,
    risk,
    store: storeConfig ? { name: storeConfig.name, logo: storeConfig.logo } : null,
    menus,
    socials: socials || [],
    groups: isMember ? groups || [] : [],
  });
}
