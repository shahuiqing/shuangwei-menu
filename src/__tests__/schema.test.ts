import { describe, it, expect } from "vitest";
import fs from "fs";

// 回归：前端会写 settings.deletedItemIds（软删除菜品），
// 三个 SQL 文件都必须定义该列，否则云端保存报 column does not exist
describe("settings schema drift", () => {
  const files = ["supabase_schema.sql", "supabase_setup.sql"];
  for (const f of files) {
    it(`${f} defines deletedItemIds column`, () => {
      const sql = fs.readFileSync(f, "utf-8");
      expect(sql).toContain('"deletedItemIds"');
    });
  }
});
