import bcrypt from 'bcryptjs';

// 前端仅做格式校验，真正哈希在服务端；此处提供一致的 hash/compare 供迁移期双端使用
export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  // 兼容旧明文：若 hash 不是 bcrypt 格式（$2a$），直接明文比对
  if (!hash.startsWith('$2')) return plain === hash;
  return bcrypt.compare(plain, hash);
}
