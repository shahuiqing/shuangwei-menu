/**
 * P1-10 SSRF 校验：打印 Worker 外发地址白名单。
 * 仅允许 https，且拒绝本地/环回/私网/链路本地/云元数据等内网目标。
 * 可选 PRINT_WORKER_ALLOWLIST=host1,host2；设置后仅放行白名单主机或 *.workers.dev。
 */
export function isSafePrintUrl(u: string): boolean {
  let url: URL;
  try {
    url = new URL(u);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();

  // 本地/环回
  if (["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(host)) return false;
  if (host.endsWith(".localhost")) return false;

  // IPv4 私网 / 保留 / 云元数据段
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const octets = host.split(".").map(Number);
    const a = octets[0]!;
    const b = octets[1]!;
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) || // link-local + 云元数据 169.254.169.254
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) // CGNAT
    )
      return false;
  }

  // IPv6 链路本地 fe80::/10、唯一本地 fc00::/7、IPv4 映射 ::ffff:
  if (
    /^fe80:/.test(host) ||
    /^f[cd][0-9a-f]{2}:/.test(host) ||
    host.startsWith("::ffff:")
  )
    return false;

  const allow = (process.env.PRINT_WORKER_ALLOWLIST || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length && !allow.includes(host) && !host.endsWith(".workers.dev"))
    return false;

  return true;
}
