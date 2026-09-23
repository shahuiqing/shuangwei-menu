import { safeGetItem, safeSetItem } from "./utils/storage";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import type { TouchEvent, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Flame,
  Settings,
  Languages,
  ShoppingBag,
  Bell,
  Plus,
  Minus,
  MapPin,
  Share2,
  X,
  Database,
  Loader2,
  Lock,
  XCircle,
  Download,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { getOptimizedImageUrl } from "./utils/image";
import { checkpointService } from "./services/checkpoint";
import { supabase } from "./supabase";
import { lazy, Suspense } from "react";
const AdminPanel = lazy(() => import("./components/AdminPanel"));
import CartMenu from "./components/CartMenu";
import DiagnosticModal from "./components/DiagnosticModal";
import { playPageTurnSound } from "./utils/audio";
import { ALLERGEN_OPTIONS } from "./constants";
import {
  api,
  onQuotaExceededChange,
  isQuotaExceeded as apiIsQuotaExceeded,
  setQuotaExceeded,
} from "./api";

import {
  INITIAL_MENU_CATEGORIES,
  mergeAndOrderCategories,
} from "./initialData";
import type { MenuCategory, Promotion, MenuItem } from "./types/menu";

import { getLoc, getSubLoc, Language } from "./utils/loc";

const AUTO_PLAY_INTERVAL = 12000; // 12 seconds per category page

const ImageWithSkeleton = ({
  src,
  alt,
  animationDuration,
}: {
  src: string;
  alt?: string;
  animationDuration: number;
}) => {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [errorSrc, setErrorSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!src) return;
    if (loadedSrc === src || errorSrc === src) return;

    let isMounted = true;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const maxAttempts = 3;

    const tryLoad = () => {
      if (!isMounted) return;
      const img = new Image();
      img.onload = () => {
        if (isMounted) setLoadedSrc(src);
      };
      img.onerror = () => {
        if (!isMounted) return;
        attempts += 1;
        if (attempts >= maxAttempts) {
          setErrorSrc(src);
        } else {
          // 网络抖动/临时失败时自动重试，避免图片直接空掉
          timer = setTimeout(tryLoad, 800 * attempts);
        }
      };
      img.src = src;
      if (img.complete && img.naturalWidth > 0) {
        setLoadedSrc(src);
      }
    };

    tryLoad();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [src, loadedSrc, errorSrc]);

  const isLoaded = loadedSrc === src && !!src;
  const hasError = errorSrc === src || !src;

  return (
    <>
      <div
        className={`absolute inset-0 bg-zinc-800/80 animate-pulse transition-opacity duration-500 ${isLoaded || hasError ? "opacity-0" : "opacity-100"}`}
      />
      {!hasError ? (
        <motion.img
          initial={{ scale: 1 }}
          animate={{ scale: animationDuration > 0 ? 1.15 : 1 }}
          transition={{
            duration: animationDuration > 0 ? animationDuration : 0,
            ease: "linear",
          }}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${isLoaded ? "opacity-100" : "opacity-0"}`}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 border-2 border-dashed border-zinc-800">
          <Flame size={32} className="text-zinc-700" />
        </div>
      )}
    </>
  );
};

const HalalBadge = ({
  className = "",
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) => (
  <div
    className={`flex items-center justify-center bg-emerald-950/90 backdrop-blur-md border border-emerald-500/50 rounded flex-shrink-0 shadow-lg shadow-emerald-900/40 pointer-events-none ${className}`}
  >
    <span className="font-bold text-emerald-400 tracking-widest leading-none whitespace-nowrap">
      {showText ? "حلال HALAL" : "حلال"}
    </span>
  </div>
);

export default function App() {
  const [scanSession, setScanSession] = useState<{
    tableNo: string;
    key: string;
  } | null>(null);
  const [scanSessionError, setScanSessionError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tableParam = params.get("table");
    const keyParam = params.get("key");
    if (tableParam && keyParam) {
      api
        .getTableQr(tableParam)
        .then((data) => {
          if (!data || data.key !== keyParam) {
            setScanSessionError(
              "无效的二维码，请扫店家正规码。(Invalid System QR Code)",
            );
          } else if (!data.active) {
            setScanSessionError(
              "桌台未开台，请联系服务员开台后再扫码点餐。(Table is closed. Ask staff to open it before scanning.)",
            );
          } else {
            setScanSession(data);
          }
        })
        .catch(() => {
          setScanSessionError("验证失败 (Validation Failed)");
        });
    } else if (tableParam) {
      setScanSessionError(
        "无效的二维码，未包含安全码。(Invalid QR Code without key)",
      );
    }
  }, []);

  const [categories, setCategories] = useState<MenuCategory[]>(() => {
    const saved = safeGetItem("menuCategories");
    const version = safeGetItem("menuVersion");
    if (saved && version === "2.0") {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const savedDel = safeGetItem("menuDeletedItemIds");
          const delIds = savedDel ? JSON.parse(savedDel) : [];
          return mergeAndOrderCategories(
            parsed,
            INITIAL_MENU_CATEGORIES,
            delIds,
          );
        }
      } catch (e) {
        console.error("Failed to parse categories from local storage:", e);
      }
    }
    // Update local storage gracefully
    setTimeout(() => {
      safeSetItem("menuCategories", JSON.stringify(INITIAL_MENU_CATEGORIES));
      safeSetItem("menuVersion", "2.0");
    }, 100);
    return INITIAL_MENU_CATEGORIES;
  });

  const [promotions, setPromotions] = useState<Promotion[]>(() => {
    const saved = safeGetItem("menuPromotions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return [
      {
        id: "test_promo_halal",
        title: "周末双人甄选套餐",
        enTitle: "Weekend Premium Dinner for Two",
        frTitle: "Menu Dégustation Week-end pour Deux",
        arTitle: "عشاء فاخر لشخصين في عطلة نهاية الأسبوع",
        maTitle: "عشاء فاخر لكوبل ف الويكاند",
        description:
          "精选M9和牛、特级羔羊排，搭配两杯店长推荐特饮。原价 899元，现价仅需 688元。每周五至周日晚市限量供应，请提前预约。",
        enDescription:
          "A selection of M9 Wagyu beef and premium lamb chops, paired with two glasses of the manager's recommended special drinks. Originally $129, now only $99. Available in limited quantities every Friday to Sunday evening.",
        frDescription:
          "Une sélection de bœuf Wagyu M9 et de côtelettes d'agneau de première qualité, accompagnés de deux verres de boissons spéciales. À l'origine 129 €, maintenant seulement 99 €.",
        arDescription:
          "تشكيلة من لحم بقر واغيو M9 وقطع لحم الضأن الفاخرة، تقدم مع مشروبات خاصة. السعر الأصلي 129 دولار، الآن 99 دولار فقط.",
        maDescription:
          "لحم واغيو M9 ولحم غنمي ممتاز، مع جوج كيسان ديال المشروبات اللي كيوصي بيها الشاف. كان بـ 129 دولار، ودابا بـ 99 دولار غير.",
        image:
          "https://images.unsplash.com/photo-1544025162-811114cd6e03?q=80&w=1471&auto=format&fit=crop",
        isActive: true,
      },
    ];
  });
  const [bgUrl, setBgUrl] = useState(() => safeGetItem("menuBgUrl") || "");
  const [restaurantName, setRestaurantName] = useState(
    () => safeGetItem("menuRestaurantName") || "炙·双味居",
  );
  const [welcomeMessage, setWelcomeMessage] = useState(
    () => safeGetItem("menuWelcomeMessage") || "Premium Charcoal BBQ",
  );
  const [logoUrl, setLogoUrl] = useState(
    () => safeGetItem("menuLogoUrl") || "",
  );
  const [adminPassword, setAdminPassword] = useState(
    () =>
      safeGetItem("adminHash") ||
      safeGetItem(
        "menuAdminPassword",
      ) /* migration compat: old plaintext -> will be hashed on next save */ ||
      "admin123",
  );
  const [devicePasswords, setDevicePasswords] = useState<
    { name: string; password: string }[]
  >(() => {
    try {
      return JSON.parse(safeGetItem("menuDevicePasswords") || "[]");
    } catch {
      return [];
    }
  });
  const [securityQuestion, setSecurityQuestion] = useState(
    () =>
      safeGetItem("menuSecurityQuestion") ||
      "你的第一只宠物的名字？ (What is the name of your first pet?)",
  );
  const [securityAnswer, setSecurityAnswer] = useState(
    () => safeGetItem("menuSecurityAnswer") || "小黑",
  );
  const [soundEnabled, setSoundEnabled] = useState(
    () => safeGetItem("menuSoundEnabled") !== "false",
  );
  const [layoutStyle, setLayoutStyle] = useState<"grid" | "list" | "bento">(
    () =>
      (safeGetItem("menuLayoutStyle") as "grid" | "list" | "bento") || "grid",
  );
  const [theme, setTheme] = useState<"midnight" | "light">(
    () => (safeGetItem("menuThemeMode") as "midnight" | "light") || "midnight",
  );
  const [receiptSettings, setReceiptSettings] = useState(() => {
    try {
      const saved = safeGetItem("menuReceiptSettings");
      return saved
        ? JSON.parse(saved)
        : {
            storeName: "炙·双味居",
            showStoreName: true,
            showDate: true,
            showQrCode: true,
            fontSize: "14px",
            columnWidth: "80mm",
            footerText1: "谢谢惠顾，欢迎下次光临！",
            footerText2: "Thank you for your visit!",
            topLogoUrl: "",
            bottomLogoUrl: "",
            googleMapsReviewLink: "",
          };
    } catch {
      return {
        storeName: "炙·双味居",
        showStoreName: true,
        showDate: true,
        showQrCode: true,
        fontSize: "14px",
        columnWidth: "80mm",
        footerText1: "谢谢惠顾，欢迎下次光临！",
        footerText2: "Thank you for your visit!",
        topLogoUrl: "",
        bottomLogoUrl: "",
        googleMapsReviewLink: "",
      };
    }
  });
  const [isSynced, setIsSynced] = useState(false);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>(() => {
    try {
      const saved = safeGetItem("menuDeletedItemIds");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    setIsQuotaExceeded(apiIsQuotaExceeded);
    const unsub = onQuotaExceededChange(() => {
      setIsQuotaExceeded(apiIsQuotaExceeded);
    });
    return unsub;
  }, []);

  useEffect(() => {
    console.log(
      "[Supabase] Initializing settings fetch and realtime listener...",
    );

    const processSettingsData = (data: any) => {
      if (!data) return;

      let currentDeletedIds = deletedItemIds;
      if (
        data.deletedItemIds !== undefined &&
        Array.isArray(data.deletedItemIds)
      ) {
        currentDeletedIds = data.deletedItemIds;
        setDeletedItemIds(data.deletedItemIds);
        safeSetItem("menuDeletedItemIds", JSON.stringify(data.deletedItemIds));
      }

      if (data.categories && Array.isArray(data.categories)) {
        const migratedCategories = mergeAndOrderCategories(
          data.categories,
          INITIAL_MENU_CATEGORIES,
          currentDeletedIds,
        );
        setCategories(migratedCategories);
        safeSetItem("menuCategories", JSON.stringify(migratedCategories));
      }
      if (data.promotions && Array.isArray(data.promotions)) {
        setPromotions(data.promotions);
        safeSetItem("menuPromotions", JSON.stringify(data.promotions));
      }
      if (data.bgUrl !== undefined) {
        setBgUrl(String(data.bgUrl));
        safeSetItem("menuBgUrl", String(data.bgUrl));
      }
      if (data.restaurantName !== undefined) {
        setRestaurantName(String(data.restaurantName));
        safeSetItem("menuRestaurantName", String(data.restaurantName));
      }
      if (data.welcomeMessage !== undefined) {
        setWelcomeMessage(String(data.welcomeMessage));
        safeSetItem("menuWelcomeMessage", String(data.welcomeMessage));
      }
      if (data.logoUrl !== undefined) {
        setLogoUrl(String(data.logoUrl));
        safeSetItem("menuLogoUrl", String(data.logoUrl));
      }
      if ((data as Record<string, unknown>).adminHash !== undefined) {
        setAdminPassword(String((data as Record<string, unknown>).adminHash));
        safeSetItem(
          "adminHash",
          String((data as Record<string, unknown>).adminHash),
        );
      } else if (data.adminPassword !== undefined) {
        // migration compat: old plaintext -> hash on next save
        setAdminPassword(String(data.adminPassword));
        safeSetItem("adminHash", String(data.adminPassword));
      }
      if ((data as Record<string, unknown>).deviceHash !== undefined) {
        setDevicePasswords(
          (data as Record<string, unknown>).deviceHash as {
            name: string;
            password: string;
          }[],
        );
        safeSetItem(
          "deviceHash",
          JSON.stringify((data as Record<string, unknown>).deviceHash),
        );
      } else if (data.devicePasswords !== undefined) {
        setDevicePasswords(
          data.devicePasswords as { name: string; password: string }[],
        );
        safeSetItem("deviceHash", JSON.stringify(data.devicePasswords));
      }
      if (data.securityQuestion !== undefined) {
        setSecurityQuestion(String(data.securityQuestion));
        safeSetItem("menuSecurityQuestion", String(data.securityQuestion));
      }
      if ((data as Record<string, unknown>).secAnswerHash !== undefined) {
        setSecurityAnswer(
          String((data as Record<string, unknown>).secAnswerHash),
        );
        safeSetItem(
          "menuSecurityAnswerHash",
          String((data as Record<string, unknown>).secAnswerHash),
        );
      } else if (data.securityAnswer !== undefined) {
        setSecurityAnswer(String(data.securityAnswer));
        safeSetItem("menuSecurityAnswerHash", String(data.securityAnswer));
      }
      if (data.soundEnabled !== undefined) {
        setSoundEnabled(!!data.soundEnabled);
        safeSetItem("menuSoundEnabled", String(data.soundEnabled));
      }
      if (data.layoutStyle !== undefined) {
        setLayoutStyle(data.layoutStyle);
        safeSetItem("menuLayoutStyle", data.layoutStyle);
      }
      if (data.theme !== undefined) {
        setTheme(data.theme);
        safeSetItem("menuThemeMode", data.theme);
        if (data.theme === "light") {
          document.documentElement.setAttribute("data-theme", "light");
        } else {
          document.documentElement.removeAttribute("data-theme");
        }
      }
      if (data.receiptSettings !== undefined) {
        setReceiptSettings(data.receiptSettings);
        safeSetItem(
          "menuReceiptSettings",
          JSON.stringify(data.receiptSettings),
        );
      }
      if (
        data.deletedItemIds !== undefined &&
        Array.isArray(data.deletedItemIds)
      ) {
        setDeletedItemIds(data.deletedItemIds);
        safeSetItem("menuDeletedItemIds", JSON.stringify(data.deletedItemIds));
      }
    };

    let unsubscribe: () => void;
    const initData = async () => {
      try {
        const data = await api.getSettings();
        if (data && Object.keys(data).length > 0) {
          setIsSynced(true);
          processSettingsData(data);
        } else {
          console.log(
            "[API] Document does not exist, creating default settings...",
          );
          const defaultSettings = {
            id: "global",
            categories: INITIAL_MENU_CATEGORIES,
            bgUrl: "",
            restaurantName: "炙·双味居",
            welcomeMessage: "Premium Charcoal BBQ",
            logoUrl: "",
            adminPassword: "admin123",
            securityQuestion:
              "你的第一只宠物的名字？ (What is the name of your first pet?)",
            securityAnswer: "小黑",
            soundEnabled: true,
            layoutStyle: "grid",
            receiptSettings: {
              storeName: "炙·双味居",
              showStoreName: true,
              showDate: true,
              showQrCode: true,
              fontSize: "14px",
              columnWidth: "80mm",
              footerText1: "谢谢惠顾，欢迎下次光临！",
              footerText2: "Thank you for your visit!",
              topLogoUrl: "",
              bottomLogoUrl: "",
            },
          };
          await api.updateSettings(defaultSettings);
          processSettingsData(defaultSettings);
          setIsSynced(true);
        }

        // Start real-time subscription after initial load/creation
        unsubscribe = api.subscribeToSettings((updatedData) => {
          if (updatedData) {
            processSettingsData(updatedData);
          }
        });
      } catch (err) {
        console.error("[API] Unexpected error:", err);
        try {
          const cachedCategories = localStorage.getItem("menuCategories");
          const cachedPromotions = localStorage.getItem("menuPromotions");
          const cachedBgUrl = localStorage.getItem("menuBgUrl");
          const cachedRestaurantName =
            localStorage.getItem("menuRestaurantName");
          const cachedWelcomeMessage =
            localStorage.getItem("menuWelcomeMessage");
          const cachedLogoUrl = localStorage.getItem("menuLogoUrl");
          const cachedAdminPassword =
            localStorage.getItem("adminHash") ||
            localStorage.getItem("menuAdminPassword"); /* migration compat */
          const cachedDevicePasswords =
            localStorage.getItem("deviceHash") ||
            localStorage.getItem("menuDevicePasswords"); /* migration */
          const cachedSecurityQuestion = localStorage.getItem(
            "menuSecurityQuestion",
          );
          const cachedSecurityAnswer =
            localStorage.getItem("menuSecurityAnswerHash") ||
            localStorage.getItem("menuSecurityAnswer"); /* migration */
          const cachedSoundEnabled = localStorage.getItem("menuSoundEnabled");
          const cachedLayoutStyle = localStorage.getItem("menuLayoutStyle");
          const cachedReceiptSettings = localStorage.getItem(
            "menuReceiptSettings",
          );

          const fallbackSettings = {
            categories: cachedCategories
              ? JSON.parse(cachedCategories)
              : INITIAL_MENU_CATEGORIES,
            promotions: cachedPromotions ? JSON.parse(cachedPromotions) : [],
            bgUrl: cachedBgUrl || "",
            restaurantName: cachedRestaurantName || "炙·双味居",
            welcomeMessage: cachedWelcomeMessage || "Premium Charcoal BBQ",
            logoUrl: cachedLogoUrl || "",
            adminPassword: cachedAdminPassword || "admin123",
            devicePasswords: cachedDevicePasswords
              ? JSON.parse(cachedDevicePasswords)
              : {},
            securityQuestion:
              cachedSecurityQuestion ||
              "你的第一只宠物的名字？ (What is the name of your first pet?)",
            securityAnswer: cachedSecurityAnswer || "小黑",
            soundEnabled: cachedSoundEnabled
              ? cachedSoundEnabled === "true"
              : true,
            layoutStyle: cachedLayoutStyle || "grid",
            receiptSettings: cachedReceiptSettings
              ? JSON.parse(cachedReceiptSettings)
              : {
                  storeName: cachedRestaurantName || "炙·双味居",
                  showStoreName: true,
                  showDate: true,
                  showQrCode: true,
                  fontSize: "14px",
                  columnWidth: "80mm",
                  footerText1: "谢谢惠顾，欢迎下次光临！",
                  footerText2: "Thank you for your visit!",
                  topLogoUrl: "",
                  bottomLogoUrl: "",
                },
          };
          processSettingsData(fallbackSettings);
          setIsSynced(true);
        } catch (localErr) {
          console.error("Local fallback loading failed:", localErr);
        }
      }
    };

    initData();
    return () => {
      if (unsubscribe) unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTestConnection = () => {
    setIsDiagnosticOpen(true);
  };

  const handleUpdateCategories = (newCategories: MenuCategory[]) => {
    setCategories(newCategories);
    try {
      safeSetItem("menuCategories", JSON.stringify(newCategories));
    } catch (e) {
      console.warn(
        "localStorage quota exceeded, skipping local cache update",
        e,
      );
    }

    // Automatically synchronize deleted default item IDs
    const updatedDeletedItemIds = [...deletedItemIds];
    let hasChanges = false;

    INITIAL_MENU_CATEGORIES.forEach((cat) => {
      (cat.items || []).forEach((item: MenuItem) => {
        if (item.id) {
          let found = false;
          for (const c of newCategories) {
            if ((c.items || []).find((i: MenuItem) => i.id === item.id)) {
              found = true;
              break;
            }
          }
          if (!found) {
            if (!updatedDeletedItemIds.includes(item.id)) {
              updatedDeletedItemIds.push(item.id);
              hasChanges = true;
            }
          } else {
            const index = updatedDeletedItemIds.indexOf(item.id);
            if (index > -1) {
              updatedDeletedItemIds.splice(index, 1);
              hasChanges = true;
            }
          }
        }
      });
    });

    if (hasChanges) {
      setDeletedItemIds(updatedDeletedItemIds);
      safeSetItem("menuDeletedItemIds", JSON.stringify(updatedDeletedItemIds));
    }
  };

  const handleUpdatePromotions = (newPromotions: Promotion[]) => {
    setPromotions(newPromotions);
    try {
      safeSetItem("menuPromotions", JSON.stringify(newPromotions));
    } catch (e) {
      console.warn("localStorage quota exceeded", e);
    }
    // autosave disabled
  };

  const handleUpdateBgUrl = (newBgUrl: string) => {
    setBgUrl(newBgUrl);
    safeSetItem("menuBgUrl", newBgUrl);
  };

  const handleUpdateRestaurantName = (newName: string) => {
    setRestaurantName(newName);
    safeSetItem("menuRestaurantName", newName);
  };

  const handleUpdateWelcomeMessage = (newMessage: string) => {
    setWelcomeMessage(newMessage);
    safeSetItem("menuWelcomeMessage", newMessage);
  };

  const handleUpdateLogoUrl = (newLogoUrl: string) => {
    setLogoUrl(newLogoUrl);
    safeSetItem("menuLogoUrl", newLogoUrl);
  };

  const handleUpdateAdminPassword = async (newPassword: string) => {
    setAdminPassword(newPassword);
    try {
      const { hashPassword } = await import("./utils/password");
      const h = await hashPassword(newPassword);
      safeSetItem("adminHash", h);
      // migration: 清理旧明文
      try {
        localStorage.removeItem("menuAdminPassword");
      } catch {}
    } catch {
      // fallback 兼容期仍存哈希（明文已不再写入）
      safeSetItem("adminHash", newPassword);
    }
  };

  const handleUpdateDevicePasswords = (
    passwords: { name: string; password: string }[],
  ) => {
    setDevicePasswords(passwords);
    safeSetItem("menuDevicePasswords", JSON.stringify(passwords));
  };

  const handleUpdateSecurity = (question: string, answer: string) => {
    setSecurityQuestion(question);
    setSecurityAnswer(answer);
    safeSetItem("menuSecurityQuestion", question);
    safeSetItem("menuSecurityAnswer", answer);
  };

  const handleUpdateSoundEnabled = (enabled: boolean) => {
    setSoundEnabled(enabled);
    safeSetItem("menuSoundEnabled", String(enabled));
  };

  const handleUpdateLayoutStyle = (style: "grid" | "list" | "bento") => {
    setLayoutStyle(style);
    safeSetItem("menuLayoutStyle", style);
  };

  const handleUpdateTheme = (newTheme: "midnight" | "light") => {
    setTheme(newTheme);
    safeSetItem("menuThemeMode", newTheme);
    if (newTheme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  };

  async function handleSaveToCloud(overrides?: any) {
    try {
      setSyncProgress("正在保存...");

      const updatedDeletedItemIds = Array.from(
        new Set([...deletedItemIds, ...(overrides?.deletedItemIds || [])]),
      );
      const catsToSave = overrides?.categories || categories;

      INITIAL_MENU_CATEGORIES.forEach((cat) => {
        const catFound = catsToSave.find(
          (c: MenuCategory) =>
            c.id === cat.id ||
            c.name === cat.name ||
            (c as any).title === cat.title,
        );
        if (!catFound) {
          if (cat.id && !updatedDeletedItemIds.includes(cat.id))
            updatedDeletedItemIds.push(cat.id);
          if (cat.name && !updatedDeletedItemIds.includes(cat.name))
            updatedDeletedItemIds.push(cat.name);
          if (cat.title && !updatedDeletedItemIds.includes(cat.title))
            updatedDeletedItemIds.push(cat.title);
          (cat.items || []).forEach((item: MenuItem) => {
            if (item.id && !updatedDeletedItemIds.includes(item.id))
              updatedDeletedItemIds.push(item.id);
            if (item.title && !updatedDeletedItemIds.includes(item.title))
              updatedDeletedItemIds.push(item.title);
            if (item.name && !updatedDeletedItemIds.includes(item.name))
              updatedDeletedItemIds.push(item.name);
          });
        } else {
          (cat.items || []).forEach((item: MenuItem) => {
            const itemFound = (catFound.items || []).find(
              (i: MenuItem) =>
                i.id === item.id ||
                i.title === item.title ||
                i.name === item.name,
            );
            if (!itemFound) {
              if (item.id && !updatedDeletedItemIds.includes(item.id))
                updatedDeletedItemIds.push(item.id);
              if (item.title && !updatedDeletedItemIds.includes(item.title))
                updatedDeletedItemIds.push(item.title);
              if (item.name && !updatedDeletedItemIds.includes(item.name))
                updatedDeletedItemIds.push(item.name);
            }
          });
        }
      });

      setDeletedItemIds(updatedDeletedItemIds);
      safeSetItem("menuDeletedItemIds", JSON.stringify(updatedDeletedItemIds));

      await api.updateSettings(
        {
          categories: overrides?.categories || categories,
          deletedItemIds: updatedDeletedItemIds,
          promotions: overrides?.promotions || promotions,
          bgUrl: overrides?.bgUrl !== undefined ? overrides.bgUrl : bgUrl,
          restaurantName:
            overrides?.restaurantName !== undefined
              ? overrides.restaurantName
              : restaurantName,
          welcomeMessage:
            overrides?.welcomeMessage !== undefined
              ? overrides.welcomeMessage
              : welcomeMessage,
          logoUrl:
            overrides?.logoUrl !== undefined ? overrides.logoUrl : logoUrl,
          adminPassword:
            overrides?.adminPassword !== undefined
              ? overrides.adminPassword
              : adminPassword,
          devicePasswords: overrides?.devicePasswords || devicePasswords,
          securityQuestion:
            overrides?.securityQuestion !== undefined
              ? overrides.securityQuestion
              : securityQuestion,
          securityAnswer:
            overrides?.securityAnswer !== undefined
              ? overrides.securityAnswer
              : securityAnswer,
          soundEnabled:
            overrides?.soundEnabled !== undefined
              ? overrides.soundEnabled
              : soundEnabled,
          layoutStyle: overrides?.layoutStyle || layoutStyle,
          theme: overrides?.theme || theme,
          receiptSettings: overrides?.receiptSettings || receiptSettings,
        },
        setSyncProgress,
      );
      // 自动重置点：每次成功保存后写入本地快照，便于数据库异常时快速恢复
      try {
        checkpointService.autoSave({
          categories: overrides?.categories || categories,
          promotions: overrides?.promotions || promotions,
          restaurantName:
            overrides?.restaurantName !== undefined
              ? overrides.restaurantName
              : restaurantName,
          welcomeMessage:
            overrides?.welcomeMessage !== undefined
              ? overrides.welcomeMessage
              : welcomeMessage,
          bgUrl: overrides?.bgUrl !== undefined ? overrides.bgUrl : bgUrl,
          logoUrl:
            overrides?.logoUrl !== undefined ? overrides.logoUrl : logoUrl,
          layoutStyle: overrides?.layoutStyle || layoutStyle,
          theme: overrides?.theme || theme,
          soundEnabled:
            overrides?.soundEnabled !== undefined
              ? overrides.soundEnabled
              : soundEnabled,
          receiptSettings: overrides?.receiptSettings || receiptSettings,
          deletedItemIds: updatedDeletedItemIds,
        });
      } catch {}
      if (!overrides?.silent) {
        alert("✅ 成功保存到云端 (Saved to cloud successfully)");
      }
    } catch (err) {
      alert(
        "❌ 保存到云端失败 (Cloud sync failed): " +
          ((err as Error)?.message || err),
      );
    } finally {
      setSyncProgress("保存完成");
      setTimeout(() => setSyncProgress(""), 1000);
    }
  }

  async function handleRestoreBackup(data: any) {
    try {
      setSyncProgress("正在还原备份...");

      // 1. Update React local states
      if (data.categories) {
        setCategories(data.categories);
        safeSetItem("menuCategories", JSON.stringify(data.categories));
      }
      if (data.promotions) {
        setPromotions(data.promotions);
        safeSetItem("menuPromotions", JSON.stringify(data.promotions));
      }
      if (data.restaurantName !== undefined) {
        setRestaurantName(data.restaurantName);
        safeSetItem("menuRestaurantName", data.restaurantName);
      }
      if (data.welcomeMessage !== undefined) {
        setWelcomeMessage(data.welcomeMessage);
        safeSetItem("menuWelcomeMessage", data.welcomeMessage);
      }
      if (data.bgUrl !== undefined) {
        setBgUrl(data.bgUrl);
        safeSetItem("menuBgUrl", data.bgUrl);
      }
      if (data.logoUrl !== undefined) {
        setLogoUrl(data.logoUrl);
        safeSetItem("menuLogoUrl", data.logoUrl);
      }
      if (data.layoutStyle !== undefined) {
        setLayoutStyle(data.layoutStyle);
        safeSetItem("menuLayoutStyle", data.layoutStyle);
      }
      if (data.theme !== undefined) {
        setTheme(data.theme);
        safeSetItem("menuThemeMode", data.theme);
        if (data.theme === "light") {
          document.documentElement.setAttribute("data-theme", "light");
        } else {
          document.documentElement.removeAttribute("data-theme");
        }
      }
      if (data.soundEnabled !== undefined) {
        setSoundEnabled(data.soundEnabled);
        safeSetItem("menuSoundEnabled", String(data.soundEnabled));
      }
      if ((data as Record<string, unknown>).adminHash !== undefined) {
        setAdminPassword(String((data as Record<string, unknown>).adminHash));
        safeSetItem(
          "adminHash",
          String((data as Record<string, unknown>).adminHash),
        );
      } else if (data.adminPassword !== undefined) {
        setAdminPassword(data.adminPassword);
        safeSetItem("adminHash", data.adminPassword);
      }
      if ((data as Record<string, unknown>).deviceHash !== undefined) {
        setDevicePasswords(
          (data as Record<string, unknown>).deviceHash as {
            name: string;
            password: string;
          }[],
        );
        safeSetItem(
          "deviceHash",
          JSON.stringify((data as Record<string, unknown>).deviceHash),
        );
      } else if (data.devicePasswords !== undefined) {
        setDevicePasswords(data.devicePasswords);
        safeSetItem("deviceHash", JSON.stringify(data.devicePasswords));
      }
      if (
        data.securityQuestion !== undefined &&
        (data.securityAnswer !== undefined ||
          (data as Record<string, unknown>).secAnswerHash !== undefined)
      ) {
        setSecurityQuestion(data.securityQuestion);
        safeSetItem("menuSecurityQuestion", data.securityQuestion);
        const ansHash =
          (data as Record<string, unknown>).secAnswerHash ??
          data.securityAnswer;
        setSecurityAnswer(ansHash);
        safeSetItem("menuSecurityAnswerHash", ansHash);
      }

      // 2. Perform a single database write with the complete payload
      await api.updateSettings({
        categories: data.categories || categories,
        promotions: data.promotions || promotions,
        bgUrl: data.bgUrl !== undefined ? data.bgUrl : bgUrl,
        restaurantName:
          data.restaurantName !== undefined
            ? data.restaurantName
            : restaurantName,
        welcomeMessage:
          data.welcomeMessage !== undefined
            ? data.welcomeMessage
            : welcomeMessage,
        logoUrl: data.logoUrl !== undefined ? data.logoUrl : logoUrl,
        adminPassword:
          data.adminPassword !== undefined ? data.adminPassword : adminPassword,
        devicePasswords: data.devicePasswords || devicePasswords,
        securityQuestion:
          data.securityQuestion !== undefined
            ? data.securityQuestion
            : securityQuestion,
        securityAnswer:
          data.securityAnswer !== undefined
            ? data.securityAnswer
            : securityAnswer,
        soundEnabled:
          data.soundEnabled !== undefined ? data.soundEnabled : soundEnabled,
        layoutStyle: data.layoutStyle || layoutStyle,
        theme: data.theme || theme,
        receiptSettings: data.receiptSettings || receiptSettings,
      });
    } catch (err) {
      console.error("Failed to restore backup in DB:", err);
      throw err;
    } finally {
      setSyncProgress("");
    }
  }

  useEffect(() => {
    if (theme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [theme]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [appMode, setAppMode] = useState<"menu" | "promotions">("menu");
  const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null);

  const allDishes = useMemo(() => {
    return categories.reduce<MenuItem[]>(
      (acc, cat) => [...acc, ...(cat.items || [])],
      [],
    );
  }, [categories]);

  const handleDishSwipe = (direction: "left" | "right") => {
    if (!selectedDish) return;
    const idx = allDishes.findIndex((d: MenuItem) => d.id === selectedDish.id);
    if (idx === -1) return;

    if (direction === "left" && idx < allDishes.length - 1) {
      setSelectedDish(allDishes[idx + 1] ?? null);
    } else if (direction === "right" && idx > 0) {
      setSelectedDish(allDishes[idx - 1] ?? null);
    }
  };
  const modalTouchStartX = useRef(0);
  const modalTouchEndX = useRef(0);

  const handleModalTouchStart = (e: TouchEvent) => {
    modalTouchStartX.current = e.targetTouches[0]?.clientX ?? 0;
    modalTouchEndX.current = e.targetTouches[0]?.clientX ?? 0; // initialize to start in case of just tap
  };

  const handleModalTouchMove = (e: TouchEvent) => {
    modalTouchEndX.current = e.targetTouches[0]?.clientX ?? 0;
  };

  const handleModalTouchEnd = () => {
    if (!modalTouchStartX.current || !modalTouchEndX.current) return;
    const distance = modalTouchStartX.current - modalTouchEndX.current;
    const minDistance = 50;

    if (distance > minDistance) {
      handleDishSwipe("left");
    } else if (distance < -minDistance) {
      handleDishSwipe("right");
    }

    // Reset
    modalTouchStartX.current = 0;
    modalTouchEndX.current = 0;
  };

  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isSettingsOpenRef = useRef(isSettingsOpen);
  useEffect(() => {
    isSettingsOpenRef.current = isSettingsOpen;
  }, [isSettingsOpen]);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareFormat] = useState<"standard" | "stand">("standard");
  const [shareQrFgColor, setShareQrFgColor] = useState("");
  const [shareQrBgColor, setShareQrBgColor] = useState("");

  useEffect(() => {
    if (isShareOpen) {
      setShareQrFgColor(receiptSettings?.qrCodeFgColor || "#18181b");
      setShareQrBgColor(receiptSettings?.qrCodeBgColor || "#ffffff");
    }
  }, [isShareOpen, receiptSettings]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof navigator !== "undefined" && navigator.language) {
      const sysLang = navigator.language.toLowerCase();
      if (sysLang.startsWith("zh")) return "zh";
      if (sysLang.startsWith("fr")) return "fr";
      if (sysLang === "ar-ma") return "ma";
      if (sysLang.startsWith("ar")) return "ar";
      if (sysLang.startsWith("en")) return "en";
      return "en"; // Default to English if not matched
    }
    return "en";
  });
  const [showSplash, setShowSplash] = useState(true);
  const [isAdminAuthed, setIsAdminAuthed] = useState(false);
  // Supabase Auth 会话：登录后自动恢复，登出后清除（真正的鉴权，写操作受 RLS 保护）
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setIsAdminAuthed(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsAdminAuthed(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  const [isDeviceAuthed, setIsDeviceAuthed] = useState(() => {
    const savedToken = safeGetItem("deviceAuthToken");
    const expiry = safeGetItem("deviceAuthTokenExpiry");
    return !!(savedToken && expiry && Date.now() < parseInt(expiry, 10));
  });
  const [isWaiterLoginOpen, setIsWaiterLoginOpen] = useState(false);
  const [waiterPasswordInput, setWaiterPasswordInput] = useState("");
  const [waiterLoginError, setWaiterLoginError] = useState("");

  const handleWaiterLogin = (e: FormEvent) => {
    e.preventDefault();
    const matchedDevice = devicePasswords?.find(
      (d) => d.password === waiterPasswordInput,
    );
    if (matchedDevice) {
      safeSetItem("deviceAuthToken", matchedDevice.password);
      safeSetItem("deviceAuthTokenExpiry", (Date.now() + 432000000).toString());
      setIsDeviceAuthed(true);
      setIsWaiterLoginOpen(false);
      setWaiterPasswordInput("");
      setWaiterLoginError("");
      alert(
        `✅ 服务员 [${matchedDevice.name}] 已认证，点单功能已解锁 (Waiter Authenticated)`,
      );
    } else {
      setWaiterLoginError("密码错误 / Incorrect Password");
    }
  };

  // Play sound on category change
  const isFirstRender = useRef(true);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const categoryBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (appMode === "menu" && categoryBtnRefs.current[currentIndex]) {
      categoryBtnRefs.current[currentIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [currentIndex, appMode]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    playPageTurnSound(!soundEnabled);
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, [currentIndex, soundEnabled]);
  const [cart, setCart] = useState<Record<string, number>>(() => {
    try {
      const saved = safeGetItem("cart");
      return saved ? JSON.parse(saved) || {} : {};
    } catch {
      return {};
    }
  });

  const [bucketWarning] = useState<string>("");

  const isInternalCartUpdateRef = useRef(false);

  useEffect(() => {
    if (scanSession && scanSession.tableNo) {
      // 通知管理员：顾客已扫码（Supabase Realtime broadcast，替代原 WebSocket）
      api.notifyAdmin({
        table: scanSession.tableNo,
        notifyType: "scan",
        message: `桌号 ${scanSession.tableNo} 的顾客已扫码开始点餐`,
        action: "Customer Scanned QR",
      });

      // 订阅同桌购物车实时同步（Supabase Realtime broadcast，替代原 WebSocket cartHub）
      const unsubscribe = api.subscribeCart(
        scanSession.tableNo,
        (syncedCart) => {
          isInternalCartUpdateRef.current = true;
          setCart(syncedCart);
        },
      );

      return () => {
        unsubscribe();
      };
    }
  }, [scanSession]);

  useEffect(() => {
    safeSetItem("cart", JSON.stringify(cart));
    if (!isInternalCartUpdateRef.current && scanSession?.tableNo) {
      api.broadcastCart(scanSession.tableNo, cart);
    }
    isInternalCartUpdateRef.current = false;
  }, [cart, scanSession]);

  // Purge deleted dishes from local cart whenever categories or deletedItemIds change
  useEffect(() => {
    if (!cart || Object.keys(cart).length === 0) return;
    const activeItemIds = new Set<string>();
    categories.forEach((cat) => {
      (cat.items || []).forEach((item: MenuItem) => {
        if (item.id) activeItemIds.add(String(item.id));
      });
    });

    const deletedSet = new Set(
      (deletedItemIds || []).map((id) => String(id).trim().toLowerCase()),
    );

    let cartChanged = false;
    const newCart: Record<string, number> = {};

    Object.entries(cart).forEach(([itemId, qty]) => {
      const normId = String(itemId).trim().toLowerCase();
      if (activeItemIds.has(itemId) && !deletedSet.has(normId)) {
        newCart[itemId] = Number(qty);
      } else {
        cartChanged = true;
      }
    });

    if (cartChanged) {
      setCart(newCart);
      safeSetItem("cart", JSON.stringify(newCart));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, deletedItemIds]);

  const [callWaiterFeedback, setCallWaiterFeedback] = useState(false);

  const handleCallWaiter = () => {
    if (scanSession?.tableNo) {
      api.notifyAdmin({
        table: scanSession.tableNo,
        notifyType: "call_waiter",
        message: `桌号 ${scanSession.tableNo} 呼叫服务员！`,
        action: "Call Waiter",
      });
      setCallWaiterFeedback(true);
      setTimeout(() => setCallWaiterFeedback(false), 3000);
    }
  };

  const updateCart = (id: string, delta: number) => {
    setCart((prev) => {
      if (delta > 0) {
        // Find item in categories to check its stock
        let itemObj: MenuItem | null = null;
        for (const cat of categories) {
          const found = (cat.items || []).find((it: MenuItem) => it.id === id);
          if (found) {
            itemObj = found;
            break;
          }
        }

        if (itemObj) {
          if (itemObj.isSoldOut) {
            setTimeout(() => {
              alert(
                language === "zh"
                  ? "抱歉，该菜品已售罄 (Sorry, this dish is sold out)!"
                  : "Sorry, this dish is sold out!",
              );
            }, 10);
            return prev;
          }

          if (itemObj.stock !== undefined && itemObj.stock !== null) {
            const maxStock = Number(itemObj.stock);
            const currentQty = prev[id] || 0;
            if (!isNaN(maxStock) && currentQty + delta > maxStock) {
              setTimeout(() => {
                alert(
                  language === "zh"
                    ? `抱歉，该菜品仅剩 ${maxStock} 份 (Sorry, only ${maxStock} portions left!)`
                    : `Sorry, only ${maxStock} portions left!`,
                );
              }, 10);
              return prev;
            }
          }
        }
      }

      const qty = (prev[id] || 0) + delta;
      if (qty <= 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: qty };
    });
  };

  const clearCart = () => setCart({});

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const [slideDirection, setSlideDirection] = useState(1);

  const handleNext = () => {
    if (!categories.length) return;
    setSlideDirection(1);
    setCurrentIndex((prev) => (prev + 1) % categories.length);
  };

  const handlePrev = () => {
    if (!categories.length) return;
    setSlideDirection(-1);
    setCurrentIndex(
      (prev) => (prev - 1 + categories.length) % categories.length,
    );
  };

  // Touch handlers for mobile swipe
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.targetTouches[0]?.clientX ?? null;
    touchStartY.current = e.targetTouches[0]?.clientY ?? null;
  };

  const handleTouchMove = (e: TouchEvent) => {
    touchEndX.current = e.targetTouches[0]?.clientX ?? null;
    touchEndY.current = e.targetTouches[0]?.clientY ?? null;
  };

  const handleTouchEnd = () => {
    if (
      !touchStartX.current ||
      !touchEndX.current ||
      !touchStartY.current ||
      !touchEndY.current
    )
      return;

    const distanceX = touchStartX.current - touchEndX.current;
    const distanceY = touchStartY.current - touchEndY.current;

    // Only trigger swipe if horizontal distance is significantly larger than vertical distance
    if (Math.abs(distanceX) > Math.abs(distanceY) * 2) {
      // Swipe left (next)
      if (distanceX > 50) {
        handleNext();
      }
      // Swipe right (prev)
      if (distanceX < -50) {
        handlePrev();
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
    touchStartY.current = null;
    touchEndY.current = null;
  };

  // Mouse drag & scroll handlers for Desktop
  const isMouseDownRef = useRef(false);
  const mouseDownStartXRef = useRef(0);
  const mouseDownStartYRef = useRef(0);
  const initialScrollTopRef = useRef(0);
  const isMouseDraggingRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isMouseDownRef.current = true;
    isMouseDraggingRef.current = false;
    mouseDownStartXRef.current = e.clientX;
    mouseDownStartYRef.current = e.clientY;
    if (mainScrollRef.current) {
      initialScrollTopRef.current = mainScrollRef.current.scrollTop;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current) return;
    const deltaX = e.clientX - mouseDownStartXRef.current;
    const deltaY = e.clientY - mouseDownStartYRef.current;

    if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
      isMouseDraggingRef.current = true;
    }

    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = initialScrollTopRef.current - deltaY;
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current) return;
    const deltaX = e.clientX - mouseDownStartXRef.current;
    const deltaY = e.clientY - mouseDownStartYRef.current;

    if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < -60) {
        handleNext();
      } else if (deltaX > 60) {
        handlePrev();
      }
    }

    isMouseDownRef.current = false;
    setTimeout(() => {
      isMouseDraggingRef.current = false;
    }, 100);
  };

  // Category Selector Horizontal Mouse Drag & Wheel
  const isCatMouseDownRef = useRef(false);
  const catStartXRef = useRef(0);
  const catScrollLeftRef = useRef(0);

  const handleCatMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    isCatMouseDownRef.current = true;
    catStartXRef.current = e.clientX;
    catScrollLeftRef.current = e.currentTarget.scrollLeft;
  };

  const handleCatMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCatMouseDownRef.current) return;
    const deltaX = e.clientX - catStartXRef.current;
    e.currentTarget.scrollLeft = catScrollLeftRef.current - deltaX;
  };

  const handleCatMouseUp = () => {
    isCatMouseDownRef.current = false;
  };

  const handleCatWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle auto-play logic
  useEffect(() => {
    if (!isAutoPlaying || categories.length === 0 || !isDesktop) return;

    const timer = setTimeout(() => {
      handleNext();
    }, AUTO_PLAY_INTERVAL);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, isAutoPlaying, categories.length, isDesktop]);

  const safeCurrentIndex = currentIndex % Math.max(1, categories.length);
  const category = categories[safeCurrentIndex] || {
    id: "empty",
    name: "暂无菜单分类",
    enName: "No Menu Categories",
    frName: "Aucune Catégorie",
    arName: "لا توجد فئات",
    maName: "لا توجد فئات",
    items: [],
  };

  if (scanSessionError) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Ambient background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className="w-[40rem] h-[40rem] bg-red-900/30 rounded-full blur-3xl mix-blend-screen" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
          className="bg-zinc-900/80 backdrop-blur-xl p-8 sm:p-10 rounded-3xl border border-red-500/20 shadow-2xl text-center max-w-md w-full relative z-10"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", bounce: 0.6 }}
            className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <XCircle size={48} className="text-red-500" strokeWidth={1.5} />
          </motion.div>
          <h2 className="text-2xl font-bold mb-4 text-zinc-100">
            {scanSessionError}
          </h2>
          <p className="text-zinc-400 text-sm mb-2 leading-relaxed">
            该二维码可能已过期或无效，请联系服务员重新生成。
          </p>
          <p className="text-zinc-500 text-xs mt-1 uppercase tracking-wider">
            Invalid or expired QR Code. Please ask staff for assistance.
          </p>

          <div className="mt-8 pt-6 border-t border-zinc-800/50">
            <button
              onClick={() => (window.location.href = window.location.pathname)}
              className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-xl transition-colors w-full"
            >
              返回首页 / Home
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[100dvh] bg-zinc-950 text-white overflow-hidden font-sans flex flex-col">
      {bgUrl && (
        <motion.div
          className="absolute inset-0 z-0 pointer-events-none"
          animate={{
            backgroundPositionX: `${50 + (currentIndex - (categories.length || 1) / 2) * 5}%`,
          }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          style={{
            backgroundImage: `url(${bgUrl})`,
            backgroundSize: "cover",
            backgroundPositionY: "center",
          }}
        />
      )}
      <AnimatePresence>
        {syncProgress && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] bg-zinc-900/90 backdrop-blur border border-zinc-700/50 shadow-2xl px-4 py-2 rounded-full flex items-center gap-3 text-sm font-medium text-zinc-100 whitespace-nowrap"
          >
            <Loader2 className="animate-spin text-orange-500" size={16} />
            {syncProgress}
          </motion.div>
        )}
        {isQuotaExceeded && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[9999] bg-zinc-900/95 border-2 border-orange-500/50 shadow-2xl p-4 rounded-2xl backdrop-blur flex flex-col gap-2"
          >
            <div className="flex items-start gap-2.5">
              <span className="text-xl shrink-0">⚠️</span>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-orange-400">
                  数据库已达今日免费上限 (Database Quota Reached)
                </h4>
                <p className="text-[10px] text-zinc-300 leading-normal mt-1">
                  因云端数据库今日免费额度用尽，系统已自动启用
                  <strong>「本地离线备用模式」</strong>
                  。您的所有点餐、修改及设置都将完美保存在此设备的本地浏览器中，请放心正常使用！
                </p>
              </div>
              <button
                onClick={() => {
                  setIsQuotaExceeded(false);
                  setQuotaExceeded(false);
                }}
                className="text-zinc-500 hover:text-zinc-300 text-xs font-bold px-1.5 py-0.5 rounded shrink-0"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Splash Screen */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, filter: "blur(10px)" }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-0 z-[200] bg-zinc-950 flex flex-col items-center justify-center"
          >
            {/* Hidden Waiter Login Trigger */}
            <div
              className="absolute top-0 left-0 w-24 h-24 z-50 cursor-default"
              onClick={() => setIsWaiterLoginOpen(true)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex flex-col items-center gap-6 md:gap-8"
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="w-20 h-20 md:w-28 md:h-28 bg-orange-600 rounded-full flex items-center justify-center text-zinc-50 shadow-2xl shadow-orange-500/40 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-orange-500 rounded-full animate-ping opacity-20"></div>
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="w-full h-full object-cover z-10"
                  />
                ) : (
                  <Flame
                    size={48}
                    strokeWidth={2.5}
                    className="md:w-16 md:h-16 relative z-10"
                  />
                )}
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="flex flex-col items-center gap-2 relative z-10 w-full px-4"
              >
                <div className="flex items-center justify-center gap-3 md:gap-4 flex-wrap">
                  <span className="font-serif text-3xl md:text-5xl font-bold tracking-[0.3em] text-zinc-100 drop-shadow-lg ml-2 md:ml-4 text-center">
                    {restaurantName}
                  </span>
                  <HalalBadge
                    className="px-2 py-1 [&>span]:text-[10px] md:[&>span]:text-xs"
                    showText={true}
                  />
                </div>
                <span className="text-orange-500 text-xs md:text-sm tracking-[0.4em] uppercase font-semibold text-center mt-2">
                  {welcomeMessage}
                </span>

                <AnimatePresence>
                  {scanSession?.tableNo && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{
                        duration: 0.6,
                        delay: 0.8,
                        type: "spring",
                        bounce: 0.5,
                      }}
                      className="mt-8 px-8 py-3 bg-gradient-to-r from-orange-500/10 via-orange-500/20 to-orange-500/10 text-orange-400 border border-orange-500/30 rounded-full font-bold tracking-widest text-sm shadow-lg shadow-orange-500/10 backdrop-blur-md flex items-center gap-3"
                    >
                      <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                      欢迎入座 {scanSession.tableNo} 桌
                      <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background darker overlay to ensure text readability if bg image is used */}
      {bgUrl && (
        <div className="absolute inset-0 bg-zinc-950/80 pointer-events-none" />
      )}

      {/* Background ambient glow matching branding */}
      <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-orange-950/20 blur-[120px] rounded-full pointer-events-none" />

      {bucketWarning && (
        <div className="absolute top-0 inset-x-0 z-[160] bg-red-900/95 border-b border-red-500/50 backdrop-blur-md text-white text-[10px] md:text-xs font-medium py-2 px-4 flex items-center justify-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
          <span className="whitespace-pre-line text-center">
            {bucketWarning}
          </span>
        </div>
      )}

      {/* Offline/Cached Mode Warning Removed - relying purely on the database icon indicator for a cleaner UI */}

      {/* Unified Fixed Top Header */}
      <div className="shrink-0 relative z-50 bg-zinc-950/85 backdrop-blur-xl border-b border-zinc-800/50 shadow-2xl pb-4 sm:pb-6 px-3 sm:px-6 md:px-12 pt-8 sm:pt-10 md:pt-12 flex flex-col gap-4 sm:gap-6 md:gap-8">
        {/* Hidden Waiter Login Trigger */}
        <div
          className="absolute top-0 left-0 w-24 h-24 z-50 cursor-default"
          onClick={() => setIsWaiterLoginOpen(true)}
        />
        <div className="flex justify-between items-start sm:items-center w-full">
          {/* Brand Logo & Info */}
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-orange-600 rounded-full flex items-center justify-center text-zinc-50 shadow-lg shadow-orange-500/30 shrink-0 overflow-hidden">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Flame size={24} className="sm:w-7 sm:h-7" strokeWidth={2.5} />
              )}
            </div>
            <div className="flex flex-col min-w-0 pr-1 sm:pr-2">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="font-serif text-lg sm:text-xl md:text-2xl font-bold tracking-[0.1em] sm:tracking-[0.2em] text-zinc-100 drop-shadow-md truncate max-w-[90px] sm:max-w-[150px] md:max-w-none">
                  {restaurantName}
                </span>
                <HalalBadge
                  className="hidden sm:flex px-1.5 py-0.5 [&>span]:text-[8px] sm:[&>span]:text-[9px]"
                  showText={false}
                />
              </div>
              <a
                href="https://www.google.com/maps/search/?api=1&query=142+Av.+2+Mars,+Casablanca+20250"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 mt-0.5 sm:mt-1 text-zinc-400 hover:text-orange-400 transition-colors cursor-pointer group"
              >
                <MapPin
                  size={10}
                  className="sm:w-3 sm:h-3 group-hover:-translate-y-0.5 transition-transform shrink-0"
                />
                <span className="text-[8px] sm:text-[10px] md:text-[11px] tracking-wider truncate max-w-[100px] sm:max-w-[150px] md:max-w-[250px]">
                  142 Av. 2 Mars, Casablanca 20250
                </span>
              </a>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3 flex-wrap justify-end max-w-[55%] sm:max-w-none">
            {promotions && promotions.length > 0 && (
              <div className="flex bg-zinc-900/50 backdrop-blur-md rounded-full border border-zinc-800 p-1 mr-2 sm:mr-4 shrink-0 overflow-hidden">
                <button
                  onClick={() => setAppMode("menu")}
                  className={`px-3 py-1 md:py-1.5 md:px-4 text-[10px] md:text-xs font-semibold rounded-full transition-colors whitespace-nowrap ${appMode === "menu" ? "bg-orange-600 text-white" : "text-zinc-400 hover:text-white"}`}
                >
                  {language === "zh"
                    ? "菜单"
                    : language === "fr"
                      ? "Menu"
                      : language === "ar"
                        ? "القائمة"
                        : language === "ma"
                          ? "المينو"
                          : "Menu"}
                </button>
                <button
                  onClick={() => setAppMode("promotions")}
                  className={`px-3 py-1 md:py-1.5 md:px-4 text-[10px] md:text-xs font-semibold rounded-full transition-colors whitespace-nowrap ${appMode === "promotions" ? "bg-orange-600 text-white" : "text-zinc-400 hover:text-white"}`}
                >
                  {language === "zh"
                    ? "本周活动"
                    : language === "fr"
                      ? "Promotions"
                      : language === "ar"
                        ? "العروض"
                        : language === "ma"
                          ? "عروض"
                          : "Promotions"}
                </button>
              </div>
            )}
            {/* Supabase Connection Status & Test */}
            <button
              onClick={handleTestConnection}
              className="relative w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer group shadow-lg shrink-0"
              title="Test Database Connection"
            >
              <Database
                size={16}
                className="sm:w-5 sm:h-5 group-hover:scale-110 transition-transform duration-500"
              />
              <span
                className={`absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full border-2 border-zinc-950 ${isSynced ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"}`}
              />
            </button>
            {(isAdminAuthed || isDeviceAuthed || scanSession) && (
              <div className="flex items-center gap-2 md:gap-3">
                {scanSession && (
                  <button
                    onClick={handleCallWaiter}
                    className={`relative w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 backdrop-blur-md border rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg shrink-0 ${callWaiterFeedback ? "bg-green-500 border-green-500 text-white" : "bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-white hover:bg-orange-500 hover:border-orange-500 group"}`}
                    title="呼叫服务员 (Call Waiter)"
                  >
                    <Bell
                      size={16}
                      className={`sm:w-5 sm:h-5 transition-transform duration-500 ${callWaiterFeedback ? "scale-110" : "group-hover:scale-110"}`}
                    />
                  </button>
                )}
                <button
                  onClick={() => setIsCartOpen(true)}
                  className="relative w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-orange-500 hover:border-orange-500 transition-all cursor-pointer group shadow-lg shrink-0"
                  title="Shopping Cart"
                >
                  <ShoppingBag
                    size={16}
                    className="sm:w-5 sm:h-5 group-hover:scale-110 transition-transform duration-500"
                  />
                  {(Object.values(cart || {}) as unknown as number[]).reduce(
                    (sum, q) => sum + q,
                    0,
                  ) > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 sm:w-5 sm:h-5 bg-orange-600 text-white text-[8px] sm:text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-zinc-950">
                      {(
                        Object.values(cart || {}) as unknown as number[]
                      ).reduce((sum, q) => sum + q, 0)}
                    </span>
                  )}
                </button>
              </div>
            )}
            <button
              onClick={() => setIsLanguageOpen(true)}
              className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-orange-500 hover:border-orange-500 transition-all cursor-pointer group shadow-lg shrink-0"
              title="Change Language"
            >
              <Languages size={15} className="sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={() => setIsShareOpen(true)}
              className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-orange-500 hover:border-orange-500 transition-all cursor-pointer group shadow-lg shrink-0"
              title="Share Menu"
            >
              <Share2
                size={16}
                className="sm:w-5 sm:h-5 group-hover:scale-110 transition-transform duration-500"
              />
            </button>
            {!scanSession && (
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-orange-500 hover:border-orange-500 transition-all cursor-pointer group shadow-lg shrink-0"
                title="Admin Settings"
              >
                <Settings
                  size={16}
                  className="sm:w-5 sm:h-5 group-hover:rotate-90 transition-transform duration-500"
                />
              </button>
            )}
          </div>
        </div>

        {/* Category / App Mode Title with Animation */}
        <div className="flex justify-between items-end">
          <AnimatePresence mode="wait">
            <motion.div
              key={appMode === "promotions" ? "promotions" : currentIndex}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col"
            >
              <h1
                className="text-3xl md:text-5xl font-serif text-zinc-50 mb-1 md:mb-2 tracking-tight transition-all"
                dir={language === "ar" || language === "ma" ? "rtl" : "ltr"}
              >
                {appMode === "promotions"
                  ? language === "zh"
                    ? "特别活动"
                    : language === "fr"
                      ? "Promotions Spéciales"
                      : language === "ar"
                        ? "عروض خاصة"
                        : language === "ma"
                          ? "عروض خاصة"
                          : "Special Promotions"
                  : getLoc(category, language, "name")}
              </h1>
              <h2
                className="text-xs md:text-sm text-orange-500 tracking-[0.4em] uppercase font-semibold transition-all"
                dir={language === "ar" || language === "ma" ? "rtl" : "ltr"}
              >
                {appMode === "promotions"
                  ? language === "zh"
                    ? "Special Promotions"
                    : "特别活动"
                  : getSubLoc(category, language, "name")}
              </h2>
            </motion.div>
          </AnimatePresence>

          {appMode === "menu" && (
            <div className="text-zinc-500 font-serif text-lg tracking-widest hidden sm:block">
              <span className="text-zinc-300">
                {String(currentIndex + 1).padStart(2, "0")}
              </span>
              <span className="mx-2">/</span>
              {String(categories.length).padStart(2, "0")}
            </div>
          )}
        </div>

        {/* Horizontal Scrollable Category Selector */}
        <div
          className="w-full overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] -mx-3 px-3 sm:mx-0 sm:px-0 mt-2 sm:mt-3 cursor-grab active:cursor-grabbing select-none"
          onWheel={handleCatWheel}
          onMouseDown={handleCatMouseDown}
          onMouseMove={handleCatMouseMove}
          onMouseUp={handleCatMouseUp}
          onMouseLeave={handleCatMouseUp}
        >
          <div className="flex items-center gap-2 pb-1 scroll-smooth whitespace-nowrap">
            {categories.map((cat, idx) => {
              const isSelected = appMode === "menu" && idx === currentIndex;
              return (
                <button
                  key={cat.id}
                  ref={(el) => {
                    categoryBtnRefs.current[idx] = el;
                  }}
                  onClick={() => {
                    setSlideDirection(idx > currentIndex ? 1 : -1);
                    setCurrentIndex(idx);
                    setAppMode("menu");
                    setIsAutoPlaying(false);
                  }}
                  className={`px-4 py-2.5 sm:px-5 sm:py-3 text-xs font-bold rounded-full border transition-all duration-300 flex items-center gap-2 shrink-0 cursor-pointer ${
                    isSelected
                      ? "bg-orange-600 text-white border-orange-500 shadow-md shadow-orange-500/30 scale-[1.03]"
                      : "bg-zinc-900/60 text-zinc-400 border-zinc-800/60 hover:text-white hover:bg-zinc-800"
                  }`}
                >
                  <span>{getLoc(cat, language, "name")}</span>
                </button>
              );
            })}

            {promotions && promotions.length > 0 && (
              <button
                ref={(el) => {
                  categoryBtnRefs.current[categories.length] = el;
                }}
                onClick={() => {
                  setAppMode("promotions");
                  setIsAutoPlaying(false);
                }}
                className={`px-4 py-2.5 sm:px-5 sm:py-3 text-xs font-bold rounded-full border transition-all duration-300 flex items-center gap-2 shrink-0 cursor-pointer ${
                  appMode === "promotions"
                    ? "bg-orange-600 text-white border-orange-500 shadow-md shadow-orange-500/30 scale-[1.03]"
                    : "bg-zinc-900/60 text-zinc-400 border-zinc-800/60 hover:text-white hover:bg-zinc-800"
                }`}
              >
                <span>
                  {language === "zh"
                    ? "特别活动"
                    : language === "fr"
                      ? "Promotions"
                      : language === "ar"
                        ? "العروض"
                        : language === "ma"
                          ? "عروض"
                          : "Promotions"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        ref={mainScrollRef}
        className="flex-1 w-full h-full pt-4 md:pt-6 pb-32 px-6 md:px-12 lg:px-24 flex flex-col justify-start relative z-10 overflow-y-auto custom-scrollbar touch-pan-x touch-pan-y cursor-grab active:cursor-grabbing select-none"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent 0px, black 30px, black calc(100% - 40px), transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0px, black 30px, black calc(100% - 40px), transparent 100%)",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={appMode === "promotions" ? "promotions" : currentIndex}
            initial={{
              opacity: 0,
              x: slideDirection * 60,
              filter: "blur(8px)",
            }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{
              opacity: 0,
              x: slideDirection * -60,
              filter: "blur(8px)",
            }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[1500px] mx-auto flex flex-col min-h-min origin-top"
          >
            {appMode === "promotions" ? (
              !promotions ||
              promotions.filter((p: Promotion) => p.isActive).length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-20 px-4 text-zinc-500 gap-4 mt-12 bg-zinc-900/30 rounded-3xl border border-zinc-800/50 backdrop-blur-sm">
                  <Flame size={48} className="text-zinc-700 mx-auto" />
                  <div>
                    <h3 className="text-xl font-medium text-zinc-300 mb-2">
                      暂无活动。
                    </h3>
                    <p className="text-sm">敬请期待更多优惠。</p>
                    <p className="text-xs mt-1">
                      No promotions available right now.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
                  {promotions
                    .filter((p: Promotion) => p.isActive)
                    .map((promo: Promotion, idx: number) => (
                      <motion.div
                        key={promo.id}
                        initial={{ opacity: 0, x: slideDirection * 20, y: 10 }}
                        animate={{ opacity: 1, x: 0, y: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 24,
                          delay: idx * 0.04,
                        }}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.98 }}
                        className="bg-zinc-900/60 rounded-3xl overflow-hidden border border-zinc-800/80 backdrop-blur-md flex flex-col group shadow-2xl relative cursor-pointer"
                      >
                        {/* Promo Image */}
                        <div className="h-48 md:h-64 relative overflow-hidden shrink-0">
                          {promo.image && (
                            <ImageWithSkeleton
                              src={getOptimizedImageUrl(promo.image, 900)}
                              alt={promo.title}
                              animationDuration={0.8}
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-900/20 to-transparent transition-opacity duration-300 group-hover:opacity-80" />

                          {/* Hover overlay content */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40 backdrop-blur-[2px]">
                            <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 text-center px-4">
                              <span className="text-white text-sm font-medium tracking-widest uppercase mb-2 block drop-shadow-lg">
                                {language === "zh"
                                  ? "查看详情"
                                  : language === "fr"
                                    ? "Voir les détails"
                                    : "View Details"}
                              </span>
                            </div>
                          </div>

                          {/* Halal Badge Overlay */}
                          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 transition-transform duration-300 group-hover:-translate-y-1">
                            <HalalBadge
                              className="px-2.5 py-1 [&>span]:text-[9px] sm:[&>span]:text-[10px]"
                              showText={true}
                            />
                          </div>
                        </div>
                        <div className="flex-1 p-6 flex flex-col pt-0 shrink-0 min-h-0 relative -top-6 transition-transform duration-300 group-hover:-translate-y-2">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <h3
                              className="text-xl sm:text-2xl font-bold text-zinc-50 tracking-wide line-clamp-2 leading-snug drop-shadow-md transition-colors duration-300 group-hover:text-orange-400"
                              dir={
                                language === "ar" || language === "ma"
                                  ? "rtl"
                                  : "ltr"
                              }
                            >
                              {getLoc(promo, language, "title")}
                            </h3>
                          </div>
                          <p
                            className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed line-clamp-3 sm:line-clamp-4 mt-2 transition-opacity duration-300 group-hover:opacity-100"
                            dir={
                              language === "ar" || language === "ma"
                                ? "rtl"
                                : "ltr"
                            }
                          >
                            {getLoc(promo, language, "desc")}
                          </p>

                          {/* Hover extra info & actions */}
                          <div className="mt-4 overflow-hidden grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-in-out">
                            <div className="min-h-0 flex flex-col gap-3 pt-4 border-t border-zinc-800/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
                              <p
                                className="text-[11px] sm:text-xs text-zinc-500 font-medium"
                                dir={
                                  language === "ar" || language === "ma"
                                    ? "rtl"
                                    : "ltr"
                                }
                              >
                                ✨{" "}
                                {language === "zh"
                                  ? "限定活动，先到先得"
                                  : language === "fr"
                                    ? "Offre limitée"
                                    : "Limited offer"}
                              </p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAppMode("menu");
                                }}
                                className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 active:scale-95"
                              >
                                <ShoppingBag size={16} />
                                {language === "zh"
                                  ? "去点餐"
                                  : language === "fr"
                                    ? "Commander"
                                    : "Order Now"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                </div>
              )
            ) : /* Grid display for multiple dishes */
            category.items?.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-20 px-4 text-zinc-500 gap-4 mt-12 bg-zinc-900/30 rounded-3xl border border-zinc-800/50 backdrop-blur-sm">
                <Settings size={48} className="text-zinc-700 mx-auto" />
                <div>
                  <h3 className="text-xl font-medium text-zinc-300 mb-2">
                    暂无菜单分类。
                  </h3>
                  <p className="text-sm">
                    点击页面顶部的设置按钮（齿轮图标）并在后台添加您的菜单或通过
                    Supabase 实时同步添加内容。
                  </p>
                  <p className="text-xs mt-1">
                    No menu categories available. Please open the settings to
                    add or sync menus.
                  </p>
                </div>
              </div>
            ) : (
              <div
                className={
                  layoutStyle === "list"
                    ? "grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8"
                    : layoutStyle === "bento"
                      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6"
                      : `grid grid-cols-1 sm:grid-cols-2 ${category.items?.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-6 lg:gap-8`
                }
              >
                {category.items?.map((item: MenuItem, idx: number) => (
                  <motion.div
                    key={item.id}
                    onClick={() => {
                      if (!isMouseDraggingRef.current) {
                        setSelectedDish(item);
                      }
                    }}
                    initial={{ opacity: 0, x: slideDirection * 20, y: 10 }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 24,
                      delay: idx * 0.04,
                    }}
                    className={`cursor-pointer ring-0 hover:ring-2 hover:ring-orange-500/50 transition-all bg-zinc-900/60 rounded-3xl overflow-hidden border border-zinc-800/80 backdrop-blur-md flex group shadow-2xl ${
                      layoutStyle === "list"
                        ? "flex-row h-40 md:h-48"
                        : layoutStyle === "bento"
                          ? `flex-col h-full min-h-[300px] ${idx === 0 ? "sm:col-span-2 sm:row-span-2" : ""}`
                          : "flex-col h-full"
                    }`}
                  >
                    {/* Image container */}
                    <div
                      className={`relative overflow-hidden ${
                        layoutStyle === "list"
                          ? "w-32 md:w-48 h-full shrink-0"
                          : layoutStyle === "bento" && idx === 0
                            ? "h-64 sm:h-full shrink-0 min-h-[220px] sm:absolute sm:inset-0 sm:w-full"
                            : "h-48 md:h-52 lg:h-[220px]"
                      }`}
                    >
                      <ImageWithSkeleton
                        src={getOptimizedImageUrl(item.image, 600)}
                        alt={item.title}
                        animationDuration={AUTO_PLAY_INTERVAL / 1000}
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-zinc-900 via-transparent to-transparent opacity-90" />

                      {item.isSoldOut && (
                        <>
                          <div className="absolute inset-0 bg-zinc-950/70 z-10 backdrop-blur-[3px] transition-all duration-300" />
                          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20">
                            <div className="bg-red-600/90 backdrop-blur-md text-white px-3 py-1.5 rounded-lg border border-red-500/50 shadow-[0_4px_20px_rgba(220,38,38,0.4)] font-black text-sm md:text-base tracking-widest flex items-center gap-1.5 transform rotate-3">
                              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]"></span>
                              {language === "zh"
                                ? "已售罄"
                                : language === "en"
                                  ? "SOLD OUT"
                                  : language === "fr"
                                    ? "ÉPUISÉ"
                                    : language === "ar" || language === "ma"
                                      ? "مباع"
                                      : "SOLD OUT"}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Halal Badge Overlay */}
                      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10">
                        <HalalBadge
                          className="px-2 py-1 [&>span]:text-[8px] sm:[&>span]:text-[9px]"
                          showText={true}
                        />
                      </div>

                      {/* Price Tag overlay */}
                      <div className="absolute bottom-4 left-5 right-5 flex justify-between items-end">
                        <div className="text-2xl font-serif font-bold text-white drop-shadow-md">
                          {item.price}
                        </div>
                      </div>
                    </div>

                    {/* Details section */}
                    <div
                      className={`p-4 md:p-6 flex-1 flex flex-col bg-linear-to-b from-zinc-900 to-zinc-950/80 ${
                        layoutStyle === "bento" && idx === 0
                          ? "sm:relative sm:z-10 sm:mt-auto sm:bg-linear-to-t sm:from-zinc-950/95 sm:via-zinc-900/80 sm:to-transparent pt-12"
                          : ""
                      }`}
                    >
                      <h3
                        className="text-lg md:text-xl text-zinc-100 font-serif mb-1 leading-tight tracking-wide line-clamp-2"
                        dir={
                          language === "ar" || language === "ma" ? "rtl" : "ltr"
                        }
                      >
                        {getLoc(item, language, "title")}
                        {item.stock !== undefined && item.stock !== null && (
                          <span className="text-xs text-orange-400 font-sans ml-2 whitespace-nowrap bg-orange-950/40 px-1.5 py-0.5 rounded border border-orange-500/20 font-medium">
                            {language === "zh"
                              ? `余${item.stock}`
                              : `${item.stock} left`}
                          </span>
                        )}
                      </h3>
                      <p
                        className="text-[10px] text-orange-500 uppercase tracking-widest mb-2 opacity-90 line-clamp-1"
                        dir={
                          language === "ar" || language === "ma" ? "rtl" : "ltr"
                        }
                      >
                        {getSubLoc(item, language, "title")}
                      </p>

                      {item.allergens && item.allergens.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {item.allergens.map((allergenId: string) => {
                            const opt = ALLERGEN_OPTIONS.find(
                              (o) => o.id === allergenId,
                            );
                            if (!opt) return null;
                            return (
                              <span
                                key={allergenId}
                                title={opt.label}
                                className="text-xs bg-zinc-800/80 border border-zinc-700/50 rounded-md px-1 py-0.5 flex items-center justify-center cursor-help transition-colors hover:bg-zinc-700"
                              >
                                {opt.icon}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      <p
                        className="text-zinc-400 text-sm leading-relaxed font-light line-clamp-3 mb-4"
                        dir={
                          language === "ar" || language === "ma" ? "rtl" : "ltr"
                        }
                      >
                        {getLoc(item, language, "desc")}
                      </p>

                      <div className="mt-auto pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                        {(isAdminAuthed || isDeviceAuthed || scanSession) &&
                          (cart[item.id] ? (
                            <div className="flex items-center gap-2 md:gap-3 bg-zinc-800/50 rounded-xl p-1 md:p-1.5 border border-zinc-700 w-full justify-between">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateCart(item.id, -1);
                                }}
                                className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
                              >
                                <Minus size={18} />
                              </button>
                              <span className="text-base font-bold w-6 text-center text-orange-500">
                                {cart[item.id]}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!item.isSoldOut) {
                                    updateCart(item.id, 1);
                                  }
                                }}
                                disabled={item.isSoldOut}
                                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${item.isSoldOut ? "text-zinc-600 bg-zinc-800 cursor-not-allowed" : "text-zinc-400 hover:text-white hover:bg-orange-600"}`}
                              >
                                <Plus size={18} />
                              </button>
                            </div>
                          ) : item.isSoldOut ? (
                            <button
                              disabled
                              className="w-full h-10 md:h-12 flex items-center justify-center gap-2 px-3 md:px-4 rounded-xl bg-zinc-800/50 text-zinc-500 text-xs md:text-sm font-semibold border border-zinc-800 cursor-not-allowed"
                            >
                              {language === "zh"
                                ? "已售罄"
                                : language === "en"
                                  ? "Sold Out"
                                  : language === "fr"
                                    ? "Épuisé"
                                    : language === "ar" || language === "ma"
                                      ? "مباع"
                                      : "Sold Out"}
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateCart(item.id, 1);
                              }}
                              className="w-full h-10 md:h-12 flex items-center justify-center gap-2 px-3 md:px-4 rounded-xl bg-zinc-800/80 hover:bg-orange-600 text-zinc-300 hover:text-white text-xs md:text-sm font-semibold transition-colors border border-zinc-700 hover:border-orange-500 group-hover:border-zinc-500"
                            >
                              <ShoppingBag size={18} />
                              {language === "zh"
                                ? "加入购物车"
                                : language === "fr"
                                  ? "Ajouter"
                                  : language === "ar"
                                    ? "أضف"
                                    : language === "ma"
                                      ? "أضف"
                                      : "Add to Cart"}
                            </button>
                          ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dish Details Modal */}
      <AnimatePresence>
        {selectedDish && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-md bg-zinc-950/80">
            <button
              onClick={() => handleDishSwipe("right")}
              className="absolute left-4 md:left-8 hidden md:flex w-12 h-12 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full items-center justify-center text-white z-[110] backdrop-blur-md transition-all active:scale-95"
            >
              <ChevronLeft size={24} />
            </button>

            <button
              onClick={() => handleDishSwipe("left")}
              className="absolute right-4 md:right-8 hidden md:flex w-12 h-12 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full items-center justify-center text-white z-[110] backdrop-blur-md transition-all active:scale-95"
            >
              <ChevronRight size={24} />
            </button>

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3 }}
              onTouchStart={handleModalTouchStart}
              onTouchMove={handleModalTouchMove}
              onTouchEnd={handleModalTouchEnd}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative hide-scrollbar"
            >
              <button
                onClick={() => setSelectedDish(null)}
                className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-zinc-950/50 text-white hover:bg-zinc-800 transition-colors backdrop-blur-sm shadow-xl border border-zinc-700 hover:border-zinc-500"
              >
                <X size={20} />
              </button>

              <motion.div
                key={selectedDish.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col md:flex-row w-full min-h-full"
              >
                <div className="w-full md:w-1/2 h-64 md:h-auto min-h-[300px] md:min-h-[500px] relative shrink-0">
                  <ImageWithSkeleton
                    src={getOptimizedImageUrl(selectedDish.image, 1000)}
                    alt={selectedDish.title}
                    animationDuration={0} // Disable skeleton animation since it's static
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent opacity-80 md:hidden" />

                  {selectedDish.isSoldOut && (
                    <>
                      <div className="absolute inset-0 bg-zinc-950/70 z-10 backdrop-blur-[3px] transition-all duration-300" />
                      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
                        <div className="bg-red-600/90 backdrop-blur-md text-white px-4 py-2 rounded-xl border border-red-500/50 shadow-[0_4px_30px_rgba(220,38,38,0.5)] font-black text-lg sm:text-xl tracking-widest flex items-center gap-2 transform rotate-3">
                          <span className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_10px_rgba(255,255,255,0.8)]"></span>
                          {language === "zh"
                            ? "已售罄"
                            : language === "en"
                              ? "SOLD OUT"
                              : language === "fr"
                                ? "ÉPUISÉ"
                                : language === "ar" || language === "ma"
                                  ? "مباع"
                                  : "SOLD OUT"}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex-1 p-6 sm:p-8 flex flex-col bg-zinc-900">
                  <div className="mb-2">
                    <h2
                      className="text-3xl font-serif text-zinc-50 mb-1 leading-tight tracking-wide drop-shadow-sm"
                      dir={
                        language === "ar" || language === "ma" ? "rtl" : "ltr"
                      }
                    >
                      {getLoc(selectedDish, language, "title")}
                    </h2>
                    <p
                      className="text-sm text-orange-500 uppercase tracking-widest font-semibold"
                      dir={
                        language === "ar" || language === "ma" ? "rtl" : "ltr"
                      }
                    >
                      {getSubLoc(selectedDish, language, "title")}
                    </p>
                  </div>

                  <div className="text-3xl font-serif text-white font-bold my-4">
                    {selectedDish.price}
                  </div>

                  {selectedDish.allergens &&
                    selectedDish.allergens.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-6 border-y border-zinc-800 py-4">
                        {selectedDish.allergens.map((allergenId: string) => {
                          const opt = ALLERGEN_OPTIONS.find(
                            (o) => o.id === allergenId,
                          );
                          if (!opt) return null;
                          return (
                            <div
                              key={allergenId}
                              className="text-xs bg-zinc-800 rounded flex items-center justify-center gap-1.5 px-2.5 py-1 text-zinc-300"
                            >
                              <span>{opt.icon}</span>
                              <span>{opt.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  <div
                    className="prose prose-invert prose-sm max-w-none text-zinc-400 font-light leading-relaxed mb-6"
                    dir={language === "ar" || language === "ma" ? "rtl" : "ltr"}
                  >
                    {getLoc(selectedDish, language, "desc")}
                  </div>

                  <div className="mt-auto pt-6 w-full flex-col gap-3 hidden md:flex">
                    {/* Multilingual Preview Section (Optional, nice to have for admin/gastronomy context) */}
                    <details className="text-xs text-zinc-500 mt-2 bg-zinc-950 rounded-xl border border-zinc-800 p-3 group">
                      <summary className="cursor-pointer font-medium hover:text-zinc-300 select-none flex items-center focus:outline-none">
                        <Languages
                          size={14}
                          className="mr-2 opacity-70 group-hover:text-amber-500 transition-colors"
                        />
                        View All Translations / 查看所有语言翻译
                      </summary>
                      <div className="mt-3 space-y-3 pt-3 border-t border-zinc-800/50">
                        {selectedDish.enTitle && (
                          <div>
                            <div className="text-zinc-600 font-bold mb-1 uppercase tracking-wider text-[10px]">
                              English
                            </div>
                            <div className="text-zinc-300 font-medium">
                              {selectedDish.enTitle}
                            </div>
                            <div className="text-zinc-400 whitespace-pre-wrap mt-0.5">
                              {selectedDish.enDescription}
                            </div>
                          </div>
                        )}
                        {selectedDish.frTitle && (
                          <div>
                            <div className="text-zinc-600 font-bold mb-1 uppercase tracking-wider text-[10px]">
                              Français
                            </div>
                            <div className="text-zinc-300 font-medium">
                              {selectedDish.frTitle}
                            </div>
                            <div className="text-zinc-400 whitespace-pre-wrap mt-0.5">
                              {selectedDish.frDescription}
                            </div>
                          </div>
                        )}
                        {selectedDish.arTitle && (
                          <div dir="rtl" className="text-right">
                            <div className="text-zinc-600 font-bold mb-1 uppercase tracking-wider text-[10px] text-left">
                              العربية
                            </div>
                            <div className="text-zinc-300 font-medium">
                              {selectedDish.arTitle}
                            </div>
                            <div className="text-zinc-400 whitespace-pre-wrap mt-0.5">
                              {selectedDish.arDescription}
                            </div>
                          </div>
                        )}
                        {selectedDish.maTitle && (
                          <div dir="rtl" className="text-right">
                            <div className="text-zinc-600 font-bold mb-1 uppercase tracking-wider text-[10px] text-left">
                              Moroccan Arabic
                            </div>
                            <div className="text-zinc-300 font-medium">
                              {selectedDish.maTitle}
                            </div>
                            <div className="text-zinc-400 whitespace-pre-wrap mt-0.5">
                              {selectedDish.maDescription}
                            </div>
                          </div>
                        )}
                      </div>
                    </details>
                  </div>

                  {/* Mobile Fixed Bottom Action Bar */}
                  {(isAdminAuthed || isDeviceAuthed || scanSession) && (
                    <div className="sticky bottom-0 mt-auto -mx-6 sm:-mx-8 -mb-6 sm:-mb-8 p-4 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800 md:relative md:border-t-0 md:bg-transparent md:mx-0 md:mb-0 md:p-0 md:mt-auto z-20">
                      {cart[selectedDish.id] ? (
                        <div className="flex items-center gap-3 bg-zinc-800/80 rounded-xl p-1.5 border border-zinc-700 w-full justify-between">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateCart(selectedDish.id, -1);
                            }}
                            className="flex-1 h-12 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
                          >
                            <Minus size={20} />
                          </button>
                          <span className="text-xl font-bold w-12 text-center text-orange-500">
                            {cart[selectedDish.id]}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!selectedDish.isSoldOut) {
                                updateCart(selectedDish.id, 1);
                              }
                            }}
                            disabled={selectedDish.isSoldOut}
                            className={`flex-1 h-12 flex items-center justify-center rounded-lg transition-colors ${selectedDish.isSoldOut ? "text-zinc-600 bg-zinc-800 cursor-not-allowed" : "text-zinc-400 hover:text-white hover:bg-orange-600"}`}
                          >
                            <Plus size={20} />
                          </button>
                        </div>
                      ) : selectedDish.isSoldOut ? (
                        <button
                          disabled
                          className="w-full h-12 md:h-14 flex items-center justify-center gap-2 px-4 rounded-xl bg-zinc-800/50 text-zinc-500 text-base font-bold border border-zinc-800 cursor-not-allowed"
                        >
                          {language === "zh"
                            ? "已售罄"
                            : language === "en"
                              ? "Sold Out"
                              : language === "fr"
                                ? "Épuisé"
                                : language === "ar" || language === "ma"
                                  ? "مباع"
                                  : "Sold Out"}
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateCart(selectedDish.id, 1);
                          }}
                          className="w-full h-12 md:h-14 flex items-center justify-center gap-2 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-base font-bold shadow-lg transition-colors"
                        >
                          <ShoppingBag size={20} />
                          {language === "zh"
                            ? "加入购物车"
                            : language === "fr"
                              ? "Ajouter"
                              : language === "ar"
                                ? "أضف"
                                : language === "ma"
                                  ? "أضف"
                                  : "Add to Cart"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Control Bar & Progress Indicator */}
      <div className="absolute bottom-0 left-0 w-full h-24 md:h-28 bg-linear-to-t from-zinc-950 via-zinc-950/90 to-transparent flex flex-col md:flex-row items-center justify-between px-6 md:px-12 z-50 pt-2 pb-2">
        {/* Navigation Controls */}
        <div className="flex items-center gap-4 md:gap-6 mb-3 md:mb-0 w-full md:w-auto justify-center md:justify-start">
          <div className="flex gap-2">
            <button
              onClick={handlePrev}
              className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={() => setIsAutoPlaying(!isAutoPlaying)}
              className="hidden lg:flex w-12 h-12 md:w-14 md:h-14 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              title={isAutoPlaying ? "Pause autoplay" : "Start autoplay"}
            >
              {isAutoPlaying ? (
                <Pause size={22} fill="currentColor" />
              ) : (
                <Play size={22} fill="currentColor" className="ml-1" />
              )}
            </button>
            <button
              onClick={handleNext}
              className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>

        {/* Category Progress Timeline */}
        <div className="hidden lg:flex flex-1 md:ml-16 gap-2 sm:gap-4 md:gap-6 lg:gap-8 w-full max-w-5xl">
          {categories.map((cat, idx) => {
            const isCurrent = idx === currentIndex;
            const isCompleted = idx < currentIndex;

            return (
              <div
                key={cat.id}
                className="flex flex-col flex-1 cursor-pointer group"
                onClick={() => {
                  setSlideDirection(idx > currentIndex ? 1 : -1);
                  setCurrentIndex(idx);
                  setIsAutoPlaying(false);
                }}
              >
                <span
                  className={`text-[10px] md:text-xs font-bold tracking-widest mb-1.5 md:mb-2 transition-colors duration-300 truncate hidden sm:block ${isCurrent ? "text-orange-500" : "text-zinc-600 group-hover:text-zinc-400"}`}
                  dir={language === "ar" || language === "ma" ? "rtl" : "ltr"}
                >
                  {getLoc(cat, language, "name")}
                </span>
                <div
                  className={`w-full h-1.5 md:h-2 rounded-full overflow-hidden relative transition-colors ${isCompleted || isCurrent ? "bg-zinc-800" : "bg-zinc-800/50"}`}
                >
                  {/* Completed state */}
                  {isCompleted && (
                    <div className="absolute inset-0 bg-orange-700/60" />
                  )}
                  {/* Current playing state */}
                  {isCurrent && isAutoPlaying && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{
                        duration: AUTO_PLAY_INTERVAL / 1000,
                        ease: "linear",
                      }}
                      className="absolute inset-0 bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]"
                    />
                  )}
                  {/* Current paused state */}
                  {isCurrent && !isAutoPlaying && (
                    <div className="absolute inset-0 bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cart Sidebar */}
      <CartMenu
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        updateCart={updateCart}
        clearCart={clearCart}
        categories={categories}
        language={language}
        isAdminAuthed={isAdminAuthed || isDeviceAuthed}
        devicePasswords={devicePasswords}
        scanSession={scanSession}
        receiptSettings={receiptSettings}
        onUpdateCategories={handleUpdateCategories}
      />

      {/* Language Modal */}
      <AnimatePresence>
        {isLanguageOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsLanguageOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: "100%", scale: 1 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: "100%", scale: 1 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative bg-zinc-900 border-t border-zinc-800 sm:border rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 w-full max-w-sm shadow-2xl z-10 flex flex-col max-h-[85vh] overflow-hidden"
            >
              <div className="w-12 h-1.5 bg-zinc-700/50 rounded-full mx-auto mb-6 sm:hidden" />
              <button
                onClick={() => setIsLanguageOpen(false)}
                className="absolute top-4 sm:top-6 right-4 sm:right-6 w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                title="Close"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-3 mb-6 px-2">
                <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center shrink-0">
                  <Languages size={20} className="text-orange-500" />
                </div>
                <div>
                  <h2 className="text-xl font-serif font-bold text-white">
                    Select Language
                  </h2>
                  <p className="text-zinc-400 text-xs mt-0.5">
                    Choose your preferred language
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto px-2 pb-6 custom-scrollbar">
                {[
                  { id: "zh", name: "中文", native: "Chinese" },
                  { id: "en", name: "English", native: "English" },
                  { id: "fr", name: "Français", native: "French" },
                  { id: "ar", name: "العربية", native: "Arabic", dir: "rtl" },
                  {
                    id: "ma",
                    name: "الدارجة",
                    native: "Moroccan Arabic",
                    dir: "rtl",
                  },
                ].map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => {
                      setLanguage(lang.id as Language);
                      setIsLanguageOpen(false);
                    }}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                      language === lang.id
                        ? "bg-orange-500/10 border-orange-500 text-white shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]"
                        : "bg-zinc-800/30 border-zinc-700/50 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600"
                    }`}
                  >
                    <div className="flex flex-col items-start gap-1">
                      <span
                        className="font-medium text-lg"
                        dir={lang.dir || "ltr"}
                      >
                        {lang.name}
                      </span>
                      <span
                        className={`text-xs ${language === lang.id ? "text-orange-400/80" : "text-zinc-500"}`}
                      >
                        {lang.native}
                      </span>
                    </div>
                    {language === lang.id && (
                      <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {isShareOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsShareOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center z-10"
            >
              <button
                onClick={() => setIsShareOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
              >
                <X size={16} />
              </button>

              <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mb-6">
                <Share2 size={32} className="text-orange-500" />
              </div>

              <h2 className="text-2xl font-serif font-bold text-white mb-2">
                分享菜单 / Share Menu
              </h2>
              <p className="text-zinc-400 text-center text-sm mb-6">
                {language === "zh"
                  ? "顾客扫码即可在手机上查看当前电子菜单。"
                  : "Scan the QR code to view the menu on your phone."}
              </p>

              <div className="flex flex-col items-center justify-center min-h-[220px] w-full mb-6">
                <div className="bg-white p-6 rounded-3xl relative overflow-hidden shadow-2xl border-[6px] border-zinc-100 group">
                  <div className="absolute top-2 left-2 w-8 h-8 border-t-[6px] border-l-[6px] border-orange-500 rounded-tl-2xl transition-all group-hover:scale-110 origin-top-left"></div>
                  <div className="absolute top-2 right-2 w-8 h-8 border-t-[6px] border-r-[6px] border-orange-500 rounded-tr-2xl transition-all group-hover:scale-110 origin-top-right"></div>
                  <div className="absolute bottom-2 left-2 w-8 h-8 border-b-[6px] border-l-[6px] border-orange-500 rounded-bl-2xl transition-all group-hover:scale-110 origin-bottom-left"></div>
                  <div className="absolute bottom-2 right-2 w-8 h-8 border-b-[6px] border-r-[6px] border-orange-500 rounded-br-2xl transition-all group-hover:scale-110 origin-bottom-right"></div>

                  <div className="p-4 bg-white">
                    <QRCodeCanvas
                      id="main-share-qr"
                      value={window.location.href}
                      size={200}
                      level={receiptSettings?.qrCodeLevel || "H"}
                      fgColor={shareQrFgColor || "#18181b"}
                      bgColor={shareQrBgColor || "#ffffff"}
                      imageSettings={{
                        src:
                          receiptSettings?.topLogoUrl ||
                          "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZjU5ZTBiIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTMgMnY3YzAgMS4xLjkgMiAyIDJoNGEyIDIgMCAwIDAgMi0yVjIiLz48cGF0aCBkPSJNNyAydjIwIi8+PHBhdGggZD0iTTIxIDE1VjJ2MGE1IDUgMCAwIDAtNSA1djZjMCAxLjEuOSAyIDIgMmgzWm0wIDB2NyIvPjwvc3ZnPg==",
                        height: 48,
                        width: 48,
                        excavate: true,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-center mb-6 w-full">
                <button
                  onClick={() => {
                    const canvas = document.getElementById(
                      "main-share-qr",
                    ) as HTMLCanvasElement;
                    if (canvas) {
                      const url = canvas.toDataURL("image/png");
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `menu-qr.png`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }
                  }}
                  className="w-full py-3 text-sm bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg"
                >
                  <Download size={16} />
                  {shareFormat === "standard"
                    ? "下载二维码 / Download QR"
                    : "下载桌牌 / Download Card"}
                </button>
              </div>

              <p className="text-xs text-zinc-500 text-center font-mono break-all px-4">
                {window.location.href}
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Settings Modal */}
      {isSettingsOpen && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center text-white">
              加载中...
            </div>
          }
        >
          <AdminPanel
            categories={categories}
            setCategories={handleUpdateCategories}
            deletedItemIds={deletedItemIds}
            setDeletedItemIds={setDeletedItemIds}
            promotions={promotions}
            setPromotions={handleUpdatePromotions}
            restaurantName={restaurantName}
            setRestaurantName={handleUpdateRestaurantName}
            welcomeMessage={welcomeMessage}
            setWelcomeMessage={handleUpdateWelcomeMessage}
            bgUrl={bgUrl}
            setBgUrl={handleUpdateBgUrl}
            logoUrl={logoUrl}
            setLogoUrl={handleUpdateLogoUrl}
            layoutStyle={layoutStyle}
            setLayoutStyle={handleUpdateLayoutStyle}
            theme={theme}
            setTheme={handleUpdateTheme}
            adminPassword={adminPassword}
            setAdminPassword={handleUpdateAdminPassword}
            devicePasswords={devicePasswords}
            setDevicePasswords={handleUpdateDevicePasswords}
            securityQuestion={securityQuestion}
            securityAnswer={securityAnswer}
            setSecurity={handleUpdateSecurity}
            soundEnabled={soundEnabled}
            setSoundEnabled={handleUpdateSoundEnabled}
            isAuthed={isAdminAuthed}
            setIsAuthed={setIsAdminAuthed}
            onDeviceAuthed={() => setIsDeviceAuthed(true)}
            isSynced={isSynced}
            onSaveToCloud={handleSaveToCloud}
            onRestoreBackup={handleRestoreBackup}
            receiptSettings={receiptSettings}
            setReceiptSettings={setReceiptSettings}
            onClose={() => setIsSettingsOpen(false)}
          />
        </Suspense>
      )}

      {/* Waiter Login Modal */}
      <AnimatePresence>
        {isWaiterLoginOpen && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 relative overflow-hidden"
            >
              <button
                onClick={() => {
                  setIsWaiterLoginOpen(false);
                  setWaiterPasswordInput("");
                  setWaiterLoginError("");
                }}
                className="absolute top-3 right-3 text-zinc-400 hover:text-white bg-black/20 hover:bg-black/40 p-2 rounded-full transition-colors z-20 custom-cursor-pointer"
              >
                <X size={20} />
              </button>

              <form
                onSubmit={handleWaiterLogin}
                className="flex flex-col items-center"
              >
                <div className="w-16 h-16 bg-orange-600/20 text-orange-500 rounded-full flex items-center justify-center mb-6">
                  <Lock size={32} />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  服务员解锁 (Waiter Unlock)
                </h2>
                <p className="text-sm text-zinc-400 mb-8 text-center">
                  请输入服务员专属密码以解锁点单功能
                </p>
                <input
                  type="password"
                  value={waiterPasswordInput}
                  onChange={(e) => setWaiterPasswordInput(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 mb-4"
                  autoFocus
                />
                {waiterLoginError && (
                  <p className="text-red-400 text-sm mb-4">
                    {waiterLoginError}
                  </p>
                )}
                <button
                  type="submit"
                  className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition-colors custom-cursor-pointer shadow-lg shadow-orange-500/20"
                >
                  验证解锁 (Unlock)
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Real-time Diagnostics Modal */}
      <DiagnosticModal
        isOpen={isDiagnosticOpen}
        onClose={() => setIsDiagnosticOpen(false)}
      />
    </div>
  );
}
