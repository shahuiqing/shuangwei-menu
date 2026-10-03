import { existsSync, lstatSync, readdirSync, rmdirSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";

const target = resolve(process.argv[2] ?? "dist");

function clean(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = lstatSync(full);
    if (stat.isSymbolicLink() || stat.isFile()) {
      unlinkSync(full);
    } else if (stat.isDirectory()) {
      clean(full);
      rmdirSync(full);
    }
  }
}

clean(target);
console.log(`cleaned ${target}`);
