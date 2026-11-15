import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// 独立构建：输出到 owner/dist，使用相对路径便于部署到任意子路径
// 双入口：index.html = 老板端；staff.html = 员工端（同一构建，独立应用）
// 注意：input 用相对路径即可，避免依赖 node:path/__dirname（部署环境无 @types/node）
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        main: "index.html",
        staff: "staff.html",
      },
    },
  },
});
