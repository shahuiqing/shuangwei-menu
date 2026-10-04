/* 构建后给 dist/sw.js 盖上唯一缓存版本号：
 * 每次发布 → 新 VERSION → activate 阶段自动清掉上一版的全部缓存
 * （旧构建的哈希文件不会越积越多），源码 public/sw.js 保持占位符不变。 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const target = fileURLToPath(new URL("../dist/sw.js", import.meta.url));

let sw;
try {
  sw = readFileSync(target, "utf8");
} catch (e) {
  console.error("[stamp-sw] 读取 dist/sw.js 失败:", e.message);
  process.exit(1);
}

const stamped = `const VERSION = "shuangwei-owner-${Date.now()}"`;
const next = sw.replace(/const VERSION = "[^"]+"/, stamped);

if (next === sw) {
  console.error("[stamp-sw] 未找到 VERSION 占位，检查 public/sw.js");
  process.exit(1);
}

writeFileSync(target, next);
console.log("[stamp-sw]", stamped);
