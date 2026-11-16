import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./../index.css";
import { applyThemeAttr, ThemeProvider } from "../lib/theme";

// 注意：员工端不注册 Service Worker，避免与老板端 PWA 缓存互相干扰

// 员工端固定使用「东家账本」主题：与老板端同一品牌视觉，
// 组件类名经主题变量反转重映射（zinc-950 → 宣纸白、orange → 朱砂）。
applyThemeAttr("zhangben");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
