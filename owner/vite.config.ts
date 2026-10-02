import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// 独立构建：输出到 owner/dist，使用相对路径便于部署到任意子路径
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 900,
  },
});
