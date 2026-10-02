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
