import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyThemeAttr, ThemeProvider } from "./lib/theme";
import "./index.css";

// 首屏前应用已保存主题，避免闪黑/闪白
try {
  applyThemeAttr(
    localStorage.getItem("shuangwei-owner-theme") === "light"
      ? "light"
      : "dark",
  );
} catch {
  applyThemeAttr("dark");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);

// PWA：生产环境注册 Service Worker（离线可打开外壳页 + 静态资源缓存）
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js", { scope: "./" })
      .catch((e) => console.warn("[owner] SW register:", e?.message || e));
  });
}
