import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./../index.css";

// 注意：员工端不注册 Service Worker，避免与老板端 PWA 缓存互相干扰

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
