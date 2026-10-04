import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyThemeAttr, readInitialTheme, ThemeProvider } from "./lib/theme";
import { toast } from "./components/Toast";
import "./index.css";

// 首屏前应用已保存主题，避免闪黑/闪白
applyThemeAttr(readInitialTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);

// PWA：生产环境注册 Service Worker（离线可打开外壳页 + 静态资源缓存）
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  // 首次访问时 claim 也会触发 controllerchange，不算更新
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    // 新版 SW 接管（sw.js 内 skipWaiting+clients.claim），提示手动刷新换新代码
    toast.info("新版本已生效，刷新页面加载最新界面");
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js", { scope: "./" })
      .catch((e) => console.warn("[owner] SW register:", e?.message || e));
  });
}
