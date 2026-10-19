// 扫码入口：校验店铺码 → 签发/续期 HttpOnly 身份 Cookie → 302 到中转页
// 运行环境：EdgeOne Pages Edge Functions（V8 引擎，无 Node 内置模块，签名用 Web Crypto API）

const COOKIE_NAME = 'mid';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 天，对齐 Safari ITP 限制；每次扫码自动续期

// ===== base64url（Cookie 值安全） =====
function b64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

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

async function makeToken(payload, secret) {
  const b64 = b64urlEncode(JSON.stringify(payload));
  const sig = await sign(b64, secret);
  return `${b64}.${sig}`;
}

function newUid() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getCookieValue(cookieHeader, name) {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

// ===== 主处理函数 =====
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env.HMAC_SECRET) {
    return new Response('HMAC_SECRET not configured', { status: 500 });
  }
  if (!env.STORE_KV) {
    return new Response('STORE_KV not bound', { status: 500 });
  }

  const code = url.searchParams.get('code');
  const storeRaw = code ? await env.STORE_KV.get(`store:${code}`) : null;

  if (!storeRaw) {
    return Response.redirect(new URL('/invalid.html', url.origin), 302);
  }

  const store = JSON.parse(storeRaw);

  // 已有合法 Cookie → 复用匿名 uid 并续期；无 Cookie / Cookie 非法 → 签发新身份
  const existing = getCookieValue(request.headers.get('Cookie') || '', COOKIE_NAME);
  const existingPayload = existing ? await verify(existing, env.HMAC_SECRET) : null;

  const now = Date.now();
  const payload = {
    sid: store.id,
    uid: (existingPayload && existingPayload.uid) || newUid(),
    vip: !!store.vip,
    iat: now,
    exp: now + 7 * 24 * 60 * 60 * 1000,
  };

  const token = await makeToken(payload, env.HMAC_SECRET);
  const response = Response.redirect(new URL('/', url.origin), 302);

  response.headers.set('Cache-Control', 'no-store');
  response.headers.set(
    'Set-Cookie',
    [
      `${COOKIE_NAME}=${token}`,
      'Path=/',
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
      `Max-Age=${COOKIE_MAX_AGE}`,
    ].join('; ')
  );

  return response;
}
