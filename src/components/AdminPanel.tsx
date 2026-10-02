import { safeGetItem, safeSetItem } from "../utils/storage";
import { checkpointService } from "../services/checkpoint";
import { lanSync } from "../services/lanSync";
import {
  verifyAdminPassword,
  saveAdminPassword,
  markAdminAuthed,
  clearAdminAuthed,
} from "../utils/adminAuth";
import { useState, useEffect } from "react";
import type { FormEvent, ChangeEvent } from "react";
import { api, parseOrderTimestamp } from "../api";
import { OrdersTab } from "../features/orders/OrdersTab";
import { OrderBoard } from "../features/orders/OrderBoard";
import { QrTab } from "../features/qrcode/QrTab";
import { MenuTab } from "../features/menu/MenuTab";
import { X, Lock, Shield, Database, User } from "lucide-react";
import { uploadBase64ToStorage } from "../utils/storage";
import { SupabaseSetupModal } from "./SupabaseSetupModal";
import type { MenuCategory, Promotion, ReceiptSettings } from "../types/menu";

interface AdminPanelProps {
  categories: MenuCategory[];
  setCategories: (categories: MenuCategory[]) => void;
  deletedItemIds?: string[];
  setDeletedItemIds?: (ids: string[]) => void;
  promotions?: Promotion[];
  setPromotions?: (promotions: Promotion[]) => void;
  restaurantName?: string;
  setRestaurantName?: (name: string) => void;
  welcomeMessage?: string;
  setWelcomeMessage?: (msg: string) => void;
  bgUrl: string;
  setBgUrl: (url: string) => void;
  logoUrl: string;
  setLogoUrl: (url: string) => void;
  layoutStyle?: "grid" | "list" | "bento";
  setLayoutStyle?: (style: "grid" | "list" | "bento") => void;
  theme?: "midnight" | "light";
  setTheme?: (theme: "midnight" | "light") => void;
  adminPassword?: string;
  setAdminPassword?: (password: string) => void;
  devicePasswords?: { name: string; password: string }[];
  setDevicePasswords?: (
    passwords: { name: string; password: string }[],
  ) => void;
  securityQuestion?: string;
  securityAnswer?: string;
  setSecurity?: (question: string, answer: string) => void;
  soundEnabled?: boolean;
  setSoundEnabled?: (enabled: boolean) => void;
  onClose: () => void;
  isAuthed: boolean;
  setIsAuthed: (authed: boolean) => void;
  onDeviceAuthed?: () => void;
  isSynced?: boolean;
  onSaveToCloud?: (overrides?: any) => void;
  onRestoreBackup?: (data: any) => Promise<void>;
  receiptSettings: ReceiptSettings;
  setReceiptSettings?: (settings: ReceiptSettings) => void;
}

import { useMenuManager } from "../features/menu/useMenuManager";
import { AdminTabNav } from "./admin/AdminTabNav";
import {
  ConfirmDialog,
  PromptDialog,
  type ConfirmDialogState,
} from "./admin/AdminDialogs";
import { ExportModal } from "./admin/ExportModal";
import { CheckoutModal } from "./admin/CheckoutModal";
import { PromotionsTab } from "./admin/PromotionsTab";
import { DishSortingModal } from "./admin/DishSortingModal";
import { PrintSetupCard } from "./admin/PrintSetupCard";
import { ReceiptSetupCard } from "./admin/ReceiptSetupCard";
import { DatabaseTab } from "./admin/DatabaseTab";
import { AppearanceTab } from "./admin/AppearanceTab";
import { ToolsTab } from "./admin/ToolsTab";
import { ArchiveCleanupCard } from "./admin/ArchiveCleanupCard";

export default function AdminPanel({
  categories,
  setCategories,
  deletedItemIds = [],
  setDeletedItemIds,
  promotions = [],
  setPromotions,
  restaurantName = "炙·双味居",
  setRestaurantName,
  welcomeMessage = "Premium Charcoal BBQ",
  setWelcomeMessage,
  bgUrl,
  setBgUrl,
  logoUrl,
  setLogoUrl,
  layoutStyle = "grid",
  setLayoutStyle,
  theme = "midnight",
  setTheme,
  adminPassword = "admin123",
  setAdminPassword,
  devicePasswords = [],
  setDevicePasswords,
  securityQuestion = "",
  securityAnswer = "",
  setSecurity,
  soundEnabled = true,
  setSoundEnabled,
  onClose,
  isAuthed,
  setIsAuthed,
  onDeviceAuthed: _onDeviceAuthed,
  isSynced = true,
  onSaveToCloud,
  onRestoreBackup,
  receiptSettings,
  setReceiptSettings,
}: AdminPanelProps) {
  const [currency, setCurrency] = useState("MAD");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSupabaseSetupOpen, setIsSupabaseSetupOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    | "menu"
    | "promotions"
    | "appearance"
    | "tools"
    | "security"
    | "database"
    | "orders"
    | "printer"
    | "qr"
  >("orders");

  // Settings State
  const [apiKey, setApiKey] = useState(() => safeGetItem("geminiApiKey") || "");
  const [isPrintServer, setIsPrintServer] = useState(
    () => safeGetItem("isPrintServer") === "true",
  );
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newSecurityQuestion, setNewSecurityQuestion] = useState(
    securityQuestion || "",
  );
  const [newSecurityAnswer, setNewSecurityAnswer] = useState(
    securityAnswer || "",
  );
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(
    null,
  );
  const [checkoutOrder, setCheckoutOrder] = useState<any | null>(null);
  const [checkoutDiscountStr, setCheckoutDiscountStr] = useState<string>("0");
  const [checkoutDiscountMode, setCheckoutDiscountMode] = useState<
    "amount" | "rate"
  >("amount");
  const [checkoutReceivedStr, setCheckoutReceivedStr] = useState<string>("0");
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] =
    useState<string>("微信支付");
  const [activeNumpadField, setActiveNumpadField] = useState<
    "discount" | "received"
  >("received");

  const [addDishTargetOrder, setAddDishTargetOrder] = useState<any | null>(
    null,
  );
  const [mergeSourceOrder, setMergeSourceOrder] = useState<any | null>(null);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportedJsonStr, setExportedJsonStr] = useState("");
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [orderView, setOrderView] = useState<"active" | "history">("active");
  const [importProgress, setImportProgress] = useState("");

  // 本地重置点（快照）+ 局域网备用通道状态
  const [checkpoints, setCheckpoints] = useState(() =>
    checkpointService.list(),
  );
  const [lanConnected, setLanConnected] = useState(false);
  useEffect(
    () =>
      checkpointService.subscribe(() =>
        setCheckpoints(checkpointService.list()),
      ),
    [],
  );
  useEffect(() => lanSync.subscribeStatus(setLanConnected), []);

  const handleSaveCheckpoint = () => {
    const name = window.prompt(
      "给这个重置点起个名字（可留空）",
      "手动重置点 " + new Date().toLocaleString(),
    );
    if (name === null) return;
    checkpointService.save(name, {
      categories,
      promotions,
      restaurantName,
      welcomeMessage,
      bgUrl,
      logoUrl,
      layoutStyle,
      theme,
      soundEnabled,
      receiptSettings,
      deletedItemIds: deletedItemIds || [],
    });
    alert("✅ 已保存重置点（存于本机，不依赖数据库）");
  };

  const handleRestoreCheckpoint = (cp: any) => {
    setConfirmDialog({
      isOpen: true,
      title: "恢复重置点确认",
      message: `确定要恢复到【${cp.name}】吗？当前未保存的修改会被覆盖。`,
      subDetail: `${new Date(cp.createdAt).toLocaleString()} · ${cp.data?.categories?.length || 0} 个分类`,
      confirmText: "确认恢复",
      confirmBtnClass:
        "px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors",
      onConfirm: async () => {
        if (onRestoreBackup) await onRestoreBackup(cp.data);
        setConfirmDialog(null);
      },
    });
  };

  const menuManager = useMenuManager({
    categories,
    setCategories,
    deletedItemIds,
    setDeletedItemIds,
    onSaveToCloud,
    setConfirmDialog,
    apiKey,
    setApiKey,
    currency,
    setCurrency,
    restaurantName,
    welcomeMessage,
    bgUrl,
    logoUrl,
    layoutStyle,
    theme,
    soundEnabled,
    securityQuestion,
    promotions,
    setPromotions,
    receiptSettings,
    setExportedJsonStr,
    setShowExportModal,
  });
  const {
    selectedCategory,
    setSelectedCategory,
    newCategory,
    setNewCategory,
    newDish,
    setNewDish,
    uploadingItemId,
    setUploadingItemId,
    isUploading,
    setIsUploading,
    promptDialog,
    setPromptDialog,
    promptValue,
    setPromptValue,
    isOptimizing,
    optimizationProgress,
    sortingCategoryId,
    setSortingCategoryId,
    isTranslating,
    isEnhancing,
    handleMoveCategory,
    handleMoveDish,
    handleAddCategory,
    handleDeleteCategory,
    handleDeleteDish,
    handleAddDish,
    handleQuickAddDish,
    handleEditDish,
    handleCancelEdit,
    editingDishId,
    handleAITranslate,
    handleAIEnhanceImage,
    handleApiKeyChange,
    handleExportJson,
    handleExportCsv,
    handleOptimizeImages,
    base64Count,
  } = menuManager;

  const [diagnosticData, setDiagnosticData] = useState<any>(null);
  const [isLoadingDiagnostics, setIsLoadingDiagnostics] = useState(false);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);

  // 订单自动归档清理（Supabase 免费层配额保护）
  const [archiveRetentionDays, setArchiveRetentionDays] = useState(30);
  const [isCleaningArchive, setIsCleaningArchive] = useState(false);
  const [archiveCleanMsg, setArchiveCleanMsg] = useState<string | null>(null);
  const handleArchiveCleanup = async () => {
    setIsCleaningArchive(true);
    setArchiveCleanMsg(null);
    try {
      const removed = await api.cleanupOldOrders(archiveRetentionDays);
      setArchiveCleanMsg(
        removed > 0
          ? `已清理 ${removed} 条 ${archiveRetentionDays} 天前的已完成订单`
          : `没有超过 ${archiveRetentionDays} 天的已完成订单需要清理`,
      );
    } catch (e: any) {
      setArchiveCleanMsg(`清理失败: ${e?.message || e}`);
    } finally {
      setIsCleaningArchive(false);
    }
  };

  const [dbTableStats, setDbTableStats] = useState<{
    connected: boolean;
    tables: Record<string, number>;
  } | null>(null);
  const [isSeedingDb, setIsSeedingDb] = useState(false);
  const [seedLogs, setSeedLogs] = useState<string[] | null>(null);
  const runDiagnostics = async () => {
    try {
      setIsLoadingDiagnostics(true);
      setDiagnosticError(null);
      const [res, stats] = await Promise.all([
        api.getStorageDiagnostics(),
        api.getProductionDatabaseStats(),
      ]);
      if (res.success) {
        setDiagnosticData(res);
      } else {
        setDiagnosticError(res.error || "获取诊断信息失败");
      }
      setDbTableStats(stats);
    } catch (err: any) {
      setDiagnosticError(err.message || "系统诊断出错");
    } finally {
      setIsLoadingDiagnostics(false);
    }
  };

  const handleSeedDatabase = async (force: boolean = false) => {
    try {
      setIsSeedingDb(true);
      setSeedLogs(null);
      const res = await api.seedProductionDatabase(force);
      setSeedLogs(res.logs || []);
      const stats = await api.getProductionDatabaseStats();
      setDbTableStats(stats);
    } catch (err: any) {
      setSeedLogs(["❌ 执行初始化失败: " + (err.message || err)]);
    } finally {
      setIsSeedingDb(false);
    }
  };

  const handleDeleteStorageFile = async (path: string) => {
    if (
      !window.confirm(
        `确定要从云存储中彻底删除此文件吗？此操作无法撤销：\n${path}`,
      )
    ) {
      return;
    }
    try {
      setIsLoadingDiagnostics(true);
      const res = await api.deleteStorageFile(path);
      if (res.success) {
        alert("文件删除成功！");
        await runDiagnostics();
      } else {
        alert("删除失败：" + (res.error || "未知错误"));
      }
    } catch (err: any) {
      alert("删除出错：" + err.message);
    } finally {
      setIsLoadingDiagnostics(false);
    }
  };

  const [orders, setOrders] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<
    { id: string; message: string; time: Date }[]
  >([]);

  useEffect(() => {
    // EdgeOne 部署：管理员通知经 Supabase Realtime broadcast（替代原 WebSocket）
    const unsubscribe = api.subscribeAdminNotifications((data: any) => {
      setNotifications((prev) =>
        [
          {
            id: Date.now().toString(),
            message: data?.message || "",
            time: new Date(),
          },
          ...prev,
        ].slice(0, 10),
      );
      // Auto-remove notification after 8 seconds
      setTimeout(() => {
        setNotifications((prev) =>
          prev.filter((n) => Date.now() - n.time.getTime() < 8000),
        );
      }, 8000);

      // Play a sound for prominence
      try {
        const ctx = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 1);
        osc.stop(ctx.currentTime + 1);
      } catch {}
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = api.subscribeToOrders((data) => {
      if (Array.isArray(data)) {
        data.forEach((order) => {
          if (isPrintServer) {
            let needsUpdate = false;
            const updatePayload: any = {};

            if (order.unprintedNewOrder) {
              import("../lib/print").then((m) => {
                m.printReceipt(order, currency, receiptSettings, true); // print kitchen ticket
              });
              needsUpdate = true;
              updatePayload.unprintedNewOrder = false;
            }

            if (
              order.unprintedAdditions &&
              order.unprintedAdditions.length > 0
            ) {
              import("../lib/print").then((m) => {
                order.unprintedAdditions.forEach((addition: any) => {
                  const dummyOrder = { ...order, items: addition.items };
                  m.printReceipt(
                    dummyOrder,
                    currency,
                    receiptSettings,
                    false,
                    "addition",
                  );
                });
              });
              needsUpdate = true;
              updatePayload.unprintedAdditions = [];
            }

            if (needsUpdate) {
              api.updateOrder(order._id, updatePayload).catch(console.error);
            }
          }
        });
        const sorted = [...data].sort((a, b) => {
          const statusA = a.status || "pending";
          const statusB = b.status || "pending";
          if (statusA === "pending" && statusB !== "pending") return -1;
          if (statusA !== "pending" && statusB === "pending") return 1;
          return (
            parseOrderTimestamp(b.timestamp) - parseOrderTimestamp(a.timestamp)
          );
        });
        setOrders(sorted);
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currency, receiptSettings, isPrintServer]);

  // 局域网订单备用通道：接收同网段服务器广播来的订单（数据库不可用时的备用手段）
  useEffect(() => {
    const unsub = lanSync.subscribeOrders((order) => {
      api.receiveLanOrder(order);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    // 始终订阅桌位，供「订单 → 桌位看板」使用（不只是扫码页）
    const unsubscribe = api.subscribeToTables((data) => {
      if (Array.isArray(data)) {
        setTables(data);
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (activeTab === "database") {
      runDiagnostics();
    }
  }, [activeTab]);

  // Form state
  const handleSimulateExternalOrder = async () => {
    try {
      const order = {
        orderNumber: "SW-" + Date.now(),
        customerName: "网站客户",
        items: [
          {
            name: "测试商品A",
            enTitle: "Test Item A",
            frTitle: "Produit Test A",
            quantity: 2,
            price: 15.0,
          },
          {
            name: "测试商品B",
            enTitle: "Test Item B",
            quantity: 1,
            price: 20.0,
          },
        ],
        total: 50.0,
        notes: "来自 shuangwei 网站的直连订单",
        timestamp: new Date().toISOString(),
        isExternal: true,
        deviceInfo: "模拟设备 (Simulated Device)",
      };

      await api.addOrder(order);
      alert("✅ 模拟外部订单成功接收并打印！");
      import("../lib/print").then((m) =>
        m.printReceipt(order, currency, receiptSettings),
      );
    } catch (error) {
      console.error("网络请求失败:", error);
      alert("网络请求失败：" + error);
    }
  };

  const [newPromotion, setNewPromotion] = useState({
    title: "",
    enTitle: "",
    frTitle: "",
    arTitle: "",
    maTitle: "",
    description: "",
    enDescription: "",
    frDescription: "",
    arDescription: "",
    maDescription: "",
    image: "",
  });
  const [generatedWelcomes, setGeneratedWelcomes] = useState<string[]>([]);
  const [isGeneratingWelcome, setIsGeneratingWelcome] = useState(false);

  const [isForgotMode, setIsForgotMode] = useState(false);
  const [verifyAnswer, setVerifyAnswer] = useState("");

  const handleVerifySecurity = (e: FormEvent) => {
    e.preventDefault();
    if (verifyAnswer.trim() === securityAnswer) {
      alert(
        `验证成功！您的密码是：\n(Verification successful! Your password is:)\n${adminPassword}`,
      );
      setVerifyAnswer("");
      setIsForgotMode(false);
      setError("");
    } else {
      setError("安全问题答案错误 / Incorrect Answer");
    }
  };

  const [currentWaiter, setCurrentWaiter] = useState<{
    name: string;
    password: string;
  } | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("deviceAuthToken");
    const expiry = localStorage.getItem("deviceAuthTokenExpiry");
    if (savedToken && expiry && Date.now() < parseInt(expiry, 10)) {
      const matched = devicePasswords?.find((d) => d.password === savedToken);
      if (matched) setCurrentWaiter(matched);
    }
  }, [devicePasswords, isAuthed]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    // 本地密码校验，不依赖数据库（数据库挂了也能登录）
    const ok = await verifyAdminPassword(password);
    if (ok) {
      markAdminAuthed();
      setIsAuthed(true);
      localStorage.setItem("menuAdminPassword", password);
      if (setAdminPassword) setAdminPassword(password);
      return;
    }
    setError("密码错误 / Incorrect Password");
  };

  const handleCopyJson = () => {
    if (!exportedJsonStr) return;
    navigator.clipboard
      .writeText(exportedJsonStr)
      .then(() => {
        setCopiedSuccess(true);
        setTimeout(() => setCopiedSuccess(false), 2000);
      })
      .catch(() => {
        alert("复制失败，请在下方框内全选并手动复制。");
      });
  };

  const handleImportJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setImportProgress("正在读取并解析备份文件... (Reading file...)");
        const obj = JSON.parse(event.target?.result as string);

        if (!obj.categories || !Array.isArray(obj.categories)) {
          setImportProgress("");
          alert("无效的备份文件结构！/ Invalid backup file structure!");
          return;
        }

        // Count base64 images
        let totalImages = 0;
        let uploadedCount = 0;
        for (const cat of obj.categories) {
          if (cat.items && Array.isArray(cat.items)) {
            for (const item of cat.items) {
              if (item.image && item.image.startsWith("data:image/")) {
                totalImages++;
              }
            }
          }
        }

        if (totalImages > 0) {
          setImportProgress(`正在优化并上传备份中的图片 (0/${totalImages})...`);

          for (let i = 0; i < obj.categories.length; i++) {
            const cat = obj.categories[i];
            if (cat.items && Array.isArray(cat.items)) {
              for (let j = 0; j < cat.items.length; j++) {
                const item = cat.items[j];
                if (item.image && item.image.startsWith("data:image/")) {
                  uploadedCount++;
                  setImportProgress(
                    `正在优化并托管图片 [${uploadedCount}/${totalImages}]: ${item.title || "菜品"}`,
                  );
                  try {
                    const publicUrl = await uploadBase64ToStorage(
                      item.image,
                      "dishes",
                    );
                    item.image = publicUrl;
                  } catch (err) {
                    console.warn(
                      "Failed to upload/compress restored image",
                      err,
                    );
                  }
                }
              }
            }
          }
        }

        setImportProgress("图片处理完成，正在应用数据设置...");

        if (onRestoreBackup) {
          setImportProgress("正在应用并同步恢复的数据到云端数据库...");
          await onRestoreBackup(obj);
        } else {
          // Fallback if not provided
          setCategories(obj.categories);
          if (obj.promotions && setPromotions) setPromotions(obj.promotions);
          if (obj.restaurantName !== undefined && setRestaurantName)
            setRestaurantName(obj.restaurantName);
          if (obj.welcomeMessage !== undefined && setWelcomeMessage)
            setWelcomeMessage(obj.welcomeMessage);
          if (obj.bgUrl !== undefined && setBgUrl) setBgUrl(obj.bgUrl);
          if (obj.logoUrl !== undefined && setLogoUrl) setLogoUrl(obj.logoUrl);
          if (obj.layoutStyle !== undefined && setLayoutStyle)
            setLayoutStyle(obj.layoutStyle);
          if (obj.theme !== undefined && setTheme) setTheme(obj.theme);
          if (obj.soundEnabled !== undefined && setSoundEnabled)
            setSoundEnabled(obj.soundEnabled);
          if (obj.adminPassword !== undefined && setAdminPassword)
            setAdminPassword(obj.adminPassword);
          if (obj.devicePasswords !== undefined && setDevicePasswords)
            setDevicePasswords(obj.devicePasswords);
          if (
            obj.securityQuestion !== undefined &&
            obj.securityAnswer !== undefined &&
            setSecurity
          ) {
            setSecurity(obj.securityQuestion, obj.securityAnswer);
          }

          if (onSaveToCloud) {
            setImportProgress("正在将恢复的数据同步保存到云端数据库...");
            await onSaveToCloud({
              categories: obj.categories,
              promotions: obj.promotions || promotions,
              restaurantName:
                obj.restaurantName !== undefined
                  ? obj.restaurantName
                  : restaurantName,
              welcomeMessage:
                obj.welcomeMessage !== undefined
                  ? obj.welcomeMessage
                  : welcomeMessage,
              bgUrl: obj.bgUrl !== undefined ? obj.bgUrl : bgUrl,
              logoUrl: obj.logoUrl !== undefined ? obj.logoUrl : logoUrl,
              layoutStyle:
                obj.layoutStyle !== undefined ? obj.layoutStyle : layoutStyle,
              theme: obj.theme !== undefined ? obj.theme : theme,
              soundEnabled:
                obj.soundEnabled !== undefined
                  ? obj.soundEnabled
                  : soundEnabled,
              adminPassword:
                obj.adminPassword !== undefined
                  ? obj.adminPassword
                  : adminPassword,
              devicePasswords:
                obj.devicePasswords !== undefined
                  ? obj.devicePasswords
                  : devicePasswords,
              securityQuestion:
                obj.securityQuestion !== undefined
                  ? obj.securityQuestion
                  : securityQuestion,
              securityAnswer:
                obj.securityAnswer !== undefined
                  ? obj.securityAnswer
                  : securityAnswer,
              silent: true,
            });
          }
        }

        setImportProgress("");
        alert(
          "🎉 恢复成功！数据已成功加载并同步到云端数据库。/ Restored and synced successfully!",
        );
      } catch (err) {
        console.error("Error during JSON import:", err);
        setImportProgress("");
        alert("解析文件失败！/ Failed to parse file!");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset input
  };

  const handleAIGenerateWelcomeMessages = async () => {
    if (!apiKey) {
      alert("请先在上方输入 Gemini API Key");
      return;
    }

    setIsGeneratingWelcome(true);
    setGeneratedWelcomes([]);
    try {
      const { GoogleGenAI, Type } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: apiKey });

      const cuisineConcepts = categories.map((c) => c.name).join(", ");

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `You are an expert restaurant marketing copywriter. 
        The restaurant name is "${restaurantName}". 
        The cuisine style includes: ${cuisineConcepts}.
        
        Please generate 4 short, catchy welcome phrases or slogans (max 4-6 words each) in multiple tones. 
        Tone 1: Premium & Elegant (e.g. Premium Charcoal BBQ, Fine Dining Experience)
        Tone 2: Warm & Inviting (e.g. Welcome to Our Table, Taste the Tradition)
        Tone 3: Modern & Trendy
        Tone 4: Local/Authentic flavor focused
        
        You may output in English or a mix depending on what sounds best as a short subtitle.
        Return ONLY a JSON list of strings representing the 4 options.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      });

      const jsonStr = response.text?.trim() || "[]";
      const options = JSON.parse(jsonStr);
      if (Array.isArray(options) && options.length > 0) {
        setGeneratedWelcomes(options);
      } else {
        alert("AI 未能生成有效的欢迎语选项");
      }
    } catch (err: any) {
      console.error(err);
      alert("生成失败，请检查 API Key 或网络连通性：" + err.message);
    } finally {
      setIsGeneratingWelcome(false);
    }
  };

  const handleAddPromotion = (e: FormEvent) => {
    e.preventDefault();
    if (!setPromotions || !promotions) return;
    if (!newPromotion.title.trim()) {
      alert("请填写活动标题 (Please enter a promotion title)");
      return;
    }
    const updatedPromotions = [
      ...promotions,
      {
        id: Math.random().toString(36).substr(2, 9),
        ...newPromotion,
        isActive: true,
      },
    ];
    setPromotions(updatedPromotions);
    setNewPromotion({
      title: "",
      enTitle: "",
      frTitle: "",
      arTitle: "",
      maTitle: "",
      description: "",
      enDescription: "",
      frDescription: "",
      arDescription: "",
      maDescription: "",
      image: "",
    });
    alert("活动添加成功！/ Promotion added!");
  };

  const handleRemovePromotion = (promotionId: string) => {
    if (!setPromotions || !promotions) return;
    setConfirmDialog({
      isOpen: true,
      message:
        "确定要删除此活动吗？ (Are you sure you want to delete this promotion?)",
      onConfirm: () => {
        const updatedPromotions = promotions.filter(
          (p) => p.id !== promotionId,
        );
        setPromotions(updatedPromotions);
        setConfirmDialog(null);
      },
    });
  };

  const handleGlobalCurrencyChange = (newCurrency: string) => {
    setConfirmDialog({
      isOpen: true,
      message: `确定要将所有菜品价格符号更新为 ${newCurrency} 吗？\nAre you sure you want to update all price symbols to ${newCurrency}?`,
      onConfirm: () => {
        const regex = /(MAD|CNY|¥|€|\$|£|dh|迪拉姆|元)/gi;

        const updatedCategories = categories.map((cat) => ({
          ...cat,
          items: (cat.items || []).map((item: any) => {
            let priceStr = item.price || "";
            if (regex.test(priceStr)) {
              priceStr = priceStr.replace(regex, newCurrency);
            } else {
              priceStr = `${newCurrency}${priceStr}`;
            }
            priceStr = priceStr.replace(/\s+/g, " ").trim();
            return { ...item, price: priceStr };
          }),
        }));

        setCategories(updatedCategories);
        // autosave disabled
        alert("货币显示符号更新成功！/ Currency symbols updated!");
        setConfirmDialog(null);
      },
    });
  };

  const handleFullscreenToggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Print Settings State（持久化到 localStorage，刷新不再丢失）
  const [printConfig, setPrintConfig] = useState(() => {
    const def = {
      layout: "grid" as "grid" | "list",
      showLogo: true,
      showBackground: true,
      showImages: true,
      showDescription: true,
      showQrCode: true,
      langs: { zh: true, en: true, fr: true, ar: true, ma: true },
    };
    try {
      const raw = safeGetItem("printConfig");
      if (raw) {
        const p = JSON.parse(raw);
        return {
          ...def,
          ...p,
          langs: { ...def.langs, ...(p?.langs || {}) },
        };
      }
    } catch {
      /* ignore */
    }
    return def;
  });
  useEffect(() => {
    try {
      safeSetItem("printConfig", JSON.stringify(printConfig));
    } catch {
      /* ignore */
    }
  }, [printConfig]);

  const handlePrintMenu = () => {
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Menu</title>
        <meta charset="utf-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Noto+Kufi+Arabic:wght@400;700&display=swap');
          :root {
            --bg-url: ${printConfig.showBackground && bgUrl ? `url("${bgUrl}")` : "none"};
          }
          * { box-sizing: border-box; }
          body { 
            font-family: 'Inter', sans-serif; 
            color: #111; 
            padding: 40px; 
            max-width: 900px; 
            margin: 0 auto;
            position: relative;
            background-color: #fff;
          }
          .background-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background-image: var(--bg-url);
            background-size: cover;
            background-position: center;
            opacity: 0.15;
            z-index: -1;
            pointer-events: none;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header { text-align: center; margin-bottom: 40px; }
          .logo { max-width: 150px; max-height: 150px; margin-bottom: 20px; border-radius: 10px; }
          h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 10px; font-weight: 700; font-size: 32px; text-transform: uppercase; letter-spacing: 2px; }
          .category { margin-top: 40px; break-inside: avoid; }
          .category-title-wrapper { border-bottom: 2px solid #e5e5e5; padding-bottom: 10px; margin-bottom: 20px; }
          .category-title { font-size: 24px; font-weight: bold; color: #000; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
          .category-subtitle { font-size: 14px; color: #555; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; display: flex; flex-wrap: wrap; gap: 15px; margin-top: 6px; }
          
          .grid { display: grid; grid-template-columns: ${printConfig.layout === "list" ? "1fr" : "1fr 1fr"}; gap: 40px 30px; }
          .item { display: flex; margin-bottom: 20px; break-inside: avoid; }
          .item-image { width: 90px; height: 90px; object-fit: cover; border-radius: 8px; margin-right: 15px; flex-shrink: 0; }
          .item-content { flex: 1; display: flex; flex-direction: column; }
          .item-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px dotted #ccc; padding-bottom: 6px; margin-bottom: 8px; }
          .item-name-group { display: flex; flex-direction: column; flex: 1; padding-right: 15px; gap: 3px; }
          .item-title-primary { font-weight: 700; font-size: 16px; color: #000; }
          .item-title-secondary { font-weight: 600; font-size: 14px; color: #333; }
          .item-title-tertiary { font-size: 14px; color: #444; font-family: 'Noto Kufi Arabic', sans-serif; text-align: left; }
          .item-desc-wrapper { display: ${printConfig.showDescription ? "flex" : "none"}; flex-direction: column; gap: 4px; }
          .item-desc { font-size: 12px; color: #555; line-height: 1.4; text-align: justify; }
          .item-desc.arabic { font-family: 'Noto Kufi Arabic', sans-serif; text-align: right; color: #555; font-size: 11px; }
          .item-price { font-weight: bold; font-size: 18px; white-space: nowrap; color: #000; margin-top: 2px; }
          
          @media print {
            body { padding: 0; }
            .grid { grid-template-columns: ${printConfig.layout === "list" ? "1fr" : "1fr 1fr"}; gap: 30px; }
            @page { margin: 1cm; size: A4; }
          }
        </style>
      </head>
      <body>
        <div class="background-overlay"></div>
        <div class="header">
          ${printConfig.showLogo && logoUrl ? `<img class="logo" src="${logoUrl}" alt="Logo" />` : ""}
          <h1>Menu</h1>
        </div>
    `;

    categories.forEach((cat) => {
      if (cat.items && cat.items.length > 0) {
        const titleLangs = [
          printConfig.langs.en ? cat.enName : "",
          printConfig.langs.fr ? cat.frName : "",
          printConfig.langs.ar ? cat.arName : "",
          printConfig.langs.ma ? cat.maName : "",
        ]
          .filter(Boolean)
          .filter((n) => n !== cat.name);

        html += `
          <div class="category">
            <div class="category-title-wrapper">
                <div class="category-title">${printConfig.langs.zh ? cat.name : titleLangs[0] || cat.name}</div>
                ${titleLangs.length > 0 && printConfig.langs.zh ? `<div class="category-subtitle"><span>${titleLangs.join("</span> • <span>")}</span></div>` : ""}
            </div>
            <div class="grid">
        `;
        cat.items.forEach((item: any) => {
          const mainTitle = printConfig.langs.zh
            ? item.title
            : printConfig.langs.en
              ? item.enTitle
              : printConfig.langs.fr
                ? item.frTitle
                : item.title;
          const subTitles = [
            printConfig.langs.en && mainTitle !== item.enTitle
              ? item.enTitle
              : "",
            printConfig.langs.fr && mainTitle !== item.frTitle
              ? item.frTitle
              : "",
          ]
            .filter(Boolean)
            .join(" / ");

          const arTitles = [
            printConfig.langs.ar ? item.arTitle : "",
            printConfig.langs.ma ? item.maTitle : "",
          ]
            .filter(Boolean)
            .filter((t) => t !== mainTitle)
            .join(" • ");

          const finalPrice = item.price.includes(" / ")
            ? item.price
            : `${item.price}`;

          html += `
            <div class="item">
              ${printConfig.showImages && item.image ? `<img src="${item.image}" class="item-image" />` : ""}
              <div class="item-content">
                <div class="item-header">
                  <div class="item-name-group">
                    <span class="item-title-primary">${mainTitle}</span>
                    ${subTitles ? `<span class="item-title-secondary">${subTitles}</span>` : ""}
                    ${arTitles ? `<span class="item-title-tertiary" dir="rtl" style="text-align: right;">${arTitles}</span>` : ""}
                  </div>
                  <span class="item-price">${finalPrice}</span>
                </div>
                <div class="item-desc-wrapper">
                  ${printConfig.langs.zh && item.description ? `<div class="item-desc">${item.description}</div>` : ""}
                  ${printConfig.langs.en && item.enDescription ? `<div class="item-desc">${item.enDescription}</div>` : ""}
                  ${printConfig.langs.fr && item.frDescription ? `<div class="item-desc">${item.frDescription}</div>` : ""}
                  ${printConfig.langs.ar && item.arDescription ? `<div class="item-desc arabic" dir="rtl">${item.arDescription}</div>` : ""}
                  ${printConfig.langs.ma && item.maDescription ? `<div class="item-desc arabic" dir="rtl">${item.maDescription}</div>` : ""}
                </div>
              </div>
            </div>
          `;
        });
        html += `
            </div>
          </div>
        `;
      }
    });

    html += `
        ${
          printConfig.showQrCode
            ? `
          <div style="margin-top: 60px; text-align: center;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin)}" alt="Menu QR Code" style="width: 150px; height: 150px; display: block; margin: 0 auto; border-radius: 10px;" />
            <p style="margin-top: 15px; font-size: 14px; font-weight: bold; color: #555;">Scan to view online menu</p>
          </div>
        `
            : ""
        }
      </body>
      </html>
    `;

    // Use hidden offscreen iframe to print directly in current page
    const existingIframe = document.getElementById("print-menu-iframe");
    if (existingIframe && existingIframe.parentNode) {
      existingIframe.parentNode.removeChild(existingIframe);
    }

    const iframe = document.createElement("iframe");
    iframe.id = "print-menu-iframe";
    iframe.style.position = "absolute";
    iframe.style.top = "-9999px";
    iframe.style.left = "-9999px";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.border = "none";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }

    setTimeout(() => {
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        }
      } catch (e) {
        console.error("Print failed:", e);
        alert("打印失败，请重试");
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 3000);
      }
    }, 300);

    // Fallback cleanup
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 60000);
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!newAdminPassword.trim()) return;
    await saveAdminPassword(newAdminPassword);
    if (setAdminPassword) setAdminPassword(newAdminPassword);
    setNewAdminPassword("");
    alert("密码修改成功！/ Password changed successfully!");
  };

  const handleAdminLogout = () => {
    clearAdminAuthed();
    setIsAuthed(false);
    if (onClose) onClose();
  };

  const handleChangeSecurity = (e: FormEvent) => {
    e.preventDefault();
    if (!newSecurityQuestion.trim() || !newSecurityAnswer.trim()) return;
    if (setSecurity) {
      setSecurity(newSecurityQuestion, newSecurityAnswer);
      if (onSaveToCloud) {
        onSaveToCloud({
          securityQuestion: newSecurityQuestion,
          securityAnswer: newSecurityAnswer,
          silent: true,
        });
        alert(
          "密保问题修改成功并已同步到云端！ / Security question changed and synced to cloud!",
        );
      } else {
        alert("密保问题设置成功！/ Security question configured!");
      }
    }
  };

  const [localDevicePasswords, setLocalDevicePasswords] =
    useState<{ name: string; password: string }[]>(devicePasswords);

  useEffect(() => {
    setLocalDevicePasswords(devicePasswords);
  }, [devicePasswords]);

  const handleSaveDevicePasswords = (e: FormEvent) => {
    e.preventDefault();
    if (setDevicePasswords) {
      const updatedPasswords = localDevicePasswords.filter(
        (d) => d.name.trim() && d.password.trim(),
      );
      setDevicePasswords(updatedPasswords);
      if (onSaveToCloud) {
        onSaveToCloud({ devicePasswords: updatedPasswords, silent: true });
        alert(
          "服务员密码设置成功并已同步到云端！ / Waiter passwords saved and synced to cloud!",
        );
      } else {
        alert(
          "服务员密码设置成功！请别忘了保存到云端。/ Waiter passwords saved! Don't forget to save to cloud.",
        );
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4 font-sans">
      <div className="bg-zinc-900 border-zinc-800 sm:border rounded-none sm:rounded-3xl w-full max-w-4xl lg:max-w-6xl overflow-hidden shadow-2xl relative flex flex-col h-[100dvh] sm:h-[90vh]">
        {/* Notifications Overlay */}
        {notifications.length > 0 && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-3 pointer-events-none w-[90%] sm:w-[500px]">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className="bg-orange-600/95 backdrop-blur-xl text-white px-6 py-4 rounded-2xl shadow-[0_10px_40px_rgba(249,115,22,0.6)] border-2 border-orange-400 flex items-center gap-4 font-bold animate-in slide-in-from-top-10 fade-in duration-300"
              >
                <div className="w-3 h-3 rounded-full bg-white animate-pulse shadow-[0_0_10px_white]" />
                <span className="text-base md:text-lg tracking-wide">
                  {notif.message}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="absolute top-4 right-14 flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-950/50 border border-zinc-800 pointer-events-none z-10 hidden sm:flex">
          <div
            className={`w-2 h-2 rounded-full ${isSynced ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"}`}
          />
          <span className="text-[10px] text-zinc-400 font-medium tracking-wide">
            {isSynced ? "EDGEONE SYNCED" : "OFFLINE"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-zinc-400 hover:text-white bg-black/20 hover:bg-black/40 p-2 rounded-full transition-colors z-20 custom-cursor-pointer"
        >
          <X size={20} />
        </button>

        {!isAuthed ? (
          isForgotMode ? (
            <form
              onSubmit={handleVerifySecurity}
              className="p-8 flex flex-col items-center flex-1 justify-center"
            >
              <div className="w-16 h-16 bg-orange-600/20 text-orange-500 rounded-full flex items-center justify-center mb-6">
                <Shield size={32} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                安全问题验证
              </h2>
              <p className="text-sm text-zinc-400 mb-8">{securityQuestion}</p>
              <input
                type="text"
                value={verifyAnswer}
                onChange={(e) => {
                  setVerifyAnswer(e.target.value);
                  setError("");
                }}
                placeholder="输入答案 / Enter Answer"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors mb-4"
                autoFocus
              />
              {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
              <button
                type="submit"
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl px-4 py-3 transition-colors mb-4"
              >
                验证并解锁
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsForgotMode(false);
                  setError("");
                }}
                className="text-sm text-zinc-400 hover:text-white transition-colors"
              >
                返回密码登录
              </button>
            </form>
          ) : (
            <form
              onSubmit={handleLogin}
              className="p-8 flex flex-col items-center flex-1 justify-center"
            >
              <div className="w-16 h-16 bg-orange-600/20 text-orange-500 rounded-full flex items-center justify-center mb-6">
                <Lock size={32} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">身份验证</h2>
              <p className="text-sm text-zinc-400 mb-6 text-center">
                请输入管理员密码进入后台
                <br />
                或输入服务员密码以解锁点单
              </p>

              {currentWaiter && (
                <div className="w-full bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center text-green-500">
                      <User size={20} />
                    </div>
                    <div className="text-left">
                      <p className="text-green-400 text-sm font-bold">
                        已登录服务员
                      </p>
                      <p className="text-zinc-300 text-sm">
                        {currentWaiter.name}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem("deviceAuthToken");
                      localStorage.removeItem("deviceAuthTokenExpiry");
                      setCurrentWaiter(null);
                      alert("已退出服务员登录");
                      window.location.reload();
                    }}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-2 rounded-lg transition-colors border border-zinc-700 cursor-pointer"
                  >
                    退出
                  </button>
                </div>
              )}

              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="Enter Password"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors mb-4"
                autoFocus
              />
              {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
              <button
                type="submit"
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl px-4 py-3 transition-colors mb-4"
              >
                解锁 / Unlock
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!securityQuestion || !securityAnswer) {
                    setError(
                      "未配置安全问题，无法找回密码。请联系超级管理员重置数据。",
                    );
                  } else {
                    setIsForgotMode(true);
                    setError("");
                  }
                }}
                className="text-sm text-zinc-400 hover:text-white transition-colors"
              >
                忘记密码？ (Forgot Password?)
              </button>
            </form>
          )
        ) : (
          <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
            <div className="p-4 sm:p-6 pb-0 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4 pr-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  设置控制面板
                </h2>
                {onSaveToCloud && (
                  <button
                    onClick={onSaveToCloud}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-xl transition-colors shrink-0"
                  >
                    <Database size={16} />
                    保存到云端 (Save to Cloud)
                  </button>
                )}
              </div>

              <AdminTabNav
                activeTab={activeTab}
                onChange={(tab) => setActiveTab(tab)}
              />
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar flex-1 min-h-0 pb-16">
              {activeTab === "orders" && (
                <>
                  <OrdersTab
                    orders={orders}
                    tables={tables}
                    orderView={orderView}
                    setOrderView={setOrderView}
                    currency={currency}
                    receiptSettings={receiptSettings}
                    onSimulateExternal={handleSimulateExternalOrder}
                    onConfirmDialog={setConfirmDialog}
                    onAddDish={(order) => {
                      setAddDishTargetOrder(order);
                    }}
                    onMerge={(order) => {
                      setMergeSourceOrder(order);
                    }}
                    onCheckout={(order) => {
                      setCheckoutOrder(order);
                      setCheckoutPaymentMethod(
                        order?.paymentMethod || "微信支付",
                      );
                      setCheckoutDiscountStr("0");
                      setCheckoutDiscountMode("amount");
                      setCheckoutReceivedStr(String(order.total || 0));
                      setActiveNumpadField("received");
                    }}
                  />
                  {/* 订单自动归档清理（Supabase 免费层配额保护） */}
                  <ArchiveCleanupCard
                    archiveRetentionDays={archiveRetentionDays}
                    setArchiveRetentionDays={setArchiveRetentionDays}
                    onArchiveCleanup={handleArchiveCleanup}
                    isCleaningArchive={isCleaningArchive}
                    archiveCleanMsg={archiveCleanMsg}
                  />
                </>
              )}
              {activeTab === "tools" && (
                <ToolsTab
                  apiKey={apiKey}
                  onApiKeyChange={handleApiKeyChange}
                  onGlobalCurrencyChange={handleGlobalCurrencyChange}
                />
              )}
              {activeTab === "appearance" && (
                <AppearanceTab
                  layoutStyle={layoutStyle}
                  setLayoutStyle={setLayoutStyle}
                  theme={theme}
                  setTheme={setTheme}
                  soundEnabled={soundEnabled}
                  setSoundEnabled={setSoundEnabled}
                  onFullscreenToggle={handleFullscreenToggle}
                  restaurantName={restaurantName}
                  setRestaurantName={setRestaurantName}
                  welcomeMessage={welcomeMessage}
                  setWelcomeMessage={setWelcomeMessage}
                  onGenerateWelcome={handleAIGenerateWelcomeMessages}
                  isGeneratingWelcome={isGeneratingWelcome}
                  generatedWelcomes={generatedWelcomes}
                  bgUrl={bgUrl}
                  setBgUrl={setBgUrl}
                  logoUrl={logoUrl}
                  setLogoUrl={setLogoUrl}
                  isUploading={isUploading}
                  setIsUploading={setIsUploading}
                  onSaveToCloud={onSaveToCloud}
                />
              )}
              {activeTab === "qr" && (
                <QrTab tables={tables} receiptSettings={receiptSettings} />
              )}
              {activeTab === "printer" && (
                <>
                  <PrintSetupCard
                    printConfig={printConfig}
                    onPrintConfigChange={setPrintConfig}
                    onPrint={handlePrintMenu}
                  />
                  {receiptSettings && setReceiptSettings && (
                    <ReceiptSetupCard
                      receiptSettings={receiptSettings}
                      onReceiptSettingsChange={setReceiptSettings}
                      onSaveToCloud={onSaveToCloud}
                      currency={currency}
                      isPrintServer={isPrintServer}
                      setIsPrintServer={setIsPrintServer}
                    />
                  )}
                </>
              )}
              {activeTab === "menu" && (
                <MenuTab
                  categories={categories}
                  setCategories={setCategories}
                  newCategory={newCategory}
                  setNewCategory={setNewCategory}
                  newDish={newDish}
                  setNewDish={setNewDish}
                  handleAddCategory={handleAddCategory}
                  handleAddDish={handleAddDish}
                  handleQuickAddDish={handleQuickAddDish}
                  handleDeleteCategory={handleDeleteCategory}
                  handleDeleteDish={handleDeleteDish}
                  handleEditDish={handleEditDish}
                  handleCancelEdit={handleCancelEdit}
                  editingDishId={editingDishId}
                  handleMoveCategory={handleMoveCategory}
                  handleMoveDish={handleMoveDish}
                  handleExportJson={handleExportJson}
                  handleExportCsv={handleExportCsv}
                  handleAITranslate={handleAITranslate}
                  handleAIEnhanceImage={handleAIEnhanceImage}
                  setCurrency={setCurrency}
                  setIsUploading={setIsUploading}
                  setUploadingItemId={setUploadingItemId}
                  setPromptDialog={setPromptDialog}
                  setPromptValue={setPromptValue}
                  setSelectedCategory={setSelectedCategory}
                  setSortingCategoryId={setSortingCategoryId}
                  currency={currency}
                  isUploading={isUploading}
                  uploadingItemId={uploadingItemId}
                  selectedCategory={selectedCategory}
                  onSaveToCloud={onSaveToCloud}
                  isTranslating={isTranslating}
                  isEnhancing={isEnhancing}
                />
              )}
              {activeTab === "promotions" && (
                <PromotionsTab
                  newPromotion={newPromotion}
                  onNewPromotionChange={setNewPromotion}
                  onAddPromotion={handleAddPromotion}
                  promotions={promotions}
                  setPromotions={setPromotions}
                  onRemovePromotion={handleRemovePromotion}
                />
              )}
              {activeTab === "security" && (
                <>
                  {/* Change Password Settings */}
                  <form
                    onSubmit={handleChangePassword}
                    className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50"
                  >
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Lock size={20} className="text-orange-500" />{" "}
                      更改管理员密码
                    </h3>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={newAdminPassword}
                        onChange={(e) => setNewAdminPassword(e.target.value)}
                        placeholder="输入新密码"
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                        required
                      />
                      <button
                        type="submit"
                        className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl px-4 py-2.5 transition-colors text-sm border border-zinc-700"
                      >
                        确认更改
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-2">
                      一旦更改，所有设备下次登录都需要使用新密码。
                    </p>
                  </form>

                  {/* 管理员登录状态 / 退出 */}
                  <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <Lock size={20} className="text-red-500" /> 管理员登录状态
                    </h3>
                    <p className="text-xs text-zinc-400 mb-3">
                      已通过本地密码登录（不依赖数据库，数据库挂了也能进）。退出后本机需要重新输入密码。
                    </p>
                    <button
                      type="button"
                      onClick={handleAdminLogout}
                      className="bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl px-4 py-2.5 transition-colors text-sm"
                    >
                      退出登录 (Log out)
                    </button>
                  </div>

                  {/* Config Device Passwords */}
                  <form
                    onSubmit={handleSaveDevicePasswords}
                    className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50"
                  >
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Lock size={20} className="text-orange-500" />{" "}
                      服务员模式配置 (Waiter Mode Passwords)
                    </h3>
                    <div className="flex flex-col gap-3">
                      {[0, 1, 2, 3, 4].map((index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <span className="text-zinc-500 text-xs w-6">
                            {index + 1}.
                          </span>
                          <input
                            type="text"
                            value={localDevicePasswords[index]?.name || ""}
                            onChange={(e) => {
                              const newArr = [...localDevicePasswords];
                              if (!newArr[index])
                                newArr[index] = { name: "", password: "" };
                              newArr[index].name = e.target.value;
                              setLocalDevicePasswords(newArr);
                            }}
                            placeholder="服务员工号/姓名 (Waiter ID/Name)"
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                          />
                          <input
                            type="text"
                            value={localDevicePasswords[index]?.password || ""}
                            onChange={(e) => {
                              const newArr = [...localDevicePasswords];
                              if (!newArr[index])
                                newArr[index] = { name: "", password: "" };
                              newArr[index].password = e.target.value;
                              setLocalDevicePasswords(newArr);
                            }}
                            placeholder="服务员密码 (Password)"
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                          />
                        </div>
                      ))}
                      <button
                        type="submit"
                        className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl px-4 py-2.5 transition-colors text-sm border border-zinc-700 self-end mt-2"
                      >
                        保存服务员密码 (Save Waiter Passwords)
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-2">
                      配置后，服务员可通过在登录界面输入此密码直接解锁点单功能。最多配置5个服务员。
                      (Configure passwords to allow waiters to unlock ordering
                      directly. Max 5 waiters.)
                    </p>
                  </form>

                  {/* Config Security Question */}
                  <form
                    onSubmit={handleChangeSecurity}
                    className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50"
                  >
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Shield size={20} className="text-orange-500" />{" "}
                      设置密码找回密保
                    </h3>
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={newSecurityQuestion}
                        onChange={(e) => setNewSecurityQuestion(e.target.value)}
                        placeholder="例如：我的第一只宠物叫什么？"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                        required
                      />
                      <input
                        type="text"
                        value={newSecurityAnswer}
                        onChange={(e) => setNewSecurityAnswer(e.target.value)}
                        placeholder="输入密保答案"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                        required
                      />
                      <button
                        type="submit"
                        className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl px-4 py-2.5 transition-colors text-sm border border-zinc-700 self-end mt-2"
                      >
                        保存密保设置
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-2">
                      开启密保后，如遗忘密码，可通过回答问题查看最新密码。
                    </p>
                  </form>
                </>
              )}
              {activeTab === "database" && (
                <DatabaseTab
                  onExportJson={handleExportJson}
                  onExportCsv={handleExportCsv}
                  onImportJson={handleImportJson}
                  checkpoints={checkpoints}
                  onSaveCheckpoint={handleSaveCheckpoint}
                  onRestoreCheckpoint={handleRestoreCheckpoint}
                  onRemoveCheckpoint={(id) => checkpointService.remove(id)}
                  lanConnected={lanConnected}
                  isLanMode={lanSync.isLanMode()}
                  base64Count={base64Count}
                  onOptimizeImages={handleOptimizeImages}
                  isOptimizing={isOptimizing}
                  optimizationProgress={optimizationProgress}
                  onOpenSupabaseSetup={() => setIsSupabaseSetupOpen(true)}
                  onRunDiagnostics={runDiagnostics}
                  isLoadingDiagnostics={isLoadingDiagnostics}
                  diagnosticData={diagnosticData}
                  diagnosticError={diagnosticError}
                  onSeedDatabase={handleSeedDatabase}
                  isSeedingDb={isSeedingDb}
                  dbTableStats={dbTableStats}
                  seedLogs={seedLogs}
                  onDeleteStorageFile={handleDeleteStorageFile}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <SupabaseSetupModal
        isOpen={isSupabaseSetupOpen}
        onClose={() => setIsSupabaseSetupOpen(false)}
      />

      {checkoutOrder && (
        <CheckoutModal
          order={checkoutOrder}
          currency={currency}
          paymentMethod={checkoutPaymentMethod}
          onPaymentMethodChange={setCheckoutPaymentMethod}
          discountMode={checkoutDiscountMode}
          onDiscountModeChange={setCheckoutDiscountMode}
          discountStr={checkoutDiscountStr}
          onDiscountStrChange={setCheckoutDiscountStr}
          receivedStr={checkoutReceivedStr}
          onReceivedStrChange={setCheckoutReceivedStr}
          activeField={activeNumpadField}
          onActiveFieldChange={setActiveNumpadField}
          onCancel={() => setCheckoutOrder(null)}
          onComplete={async ({
            finalTotal,
            discountAmount,
            receivedAmount,
            changeAmount,
          }) => {
            try {
              const targetId = checkoutOrder._id || checkoutOrder.id;
              await api.updateOrder(targetId, {
                status: "completed",
                paymentMethod: checkoutPaymentMethod || "微信支付",
                discountAmount,
                receivedAmount,
                changeAmount,
                finalTotal,
                completedAt: new Date().toISOString(),
              });
              setCheckoutOrder(null);
            } catch (e) {
              console.error("Failed to complete order:", e);
              alert("结账保存失败 (Failed to complete order)");
            }
          }}
        />
      )}

      <ConfirmDialog
        dialog={confirmDialog}
        onClose={() => setConfirmDialog(null)}
      />

      <PromptDialog
        dialog={promptDialog}
        value={promptValue}
        onChange={setPromptValue}
        onClose={() => setPromptDialog(null)}
      />

      {/* Export Success & Manual Backup Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        exportedJsonStr={exportedJsonStr}
        copiedSuccess={copiedSuccess}
        onExportJson={handleExportJson}
        onCopyJson={handleCopyJson}
        onExportCsv={handleExportCsv}
      />

      {/* 手机端/桌面端 菜品排序调整弹窗 Dish Sorting Modal */}
      <DishSortingModal
        categoryId={sortingCategoryId}
        categories={categories}
        onMoveDish={handleMoveDish}
        onClose={() => setSortingCategoryId(null)}
      />

      {importProgress && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4 animate-fade-in"
          style={{ zIndex: 10000 }}
        >
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full border-4 border-orange-500/20 border-t-orange-500 animate-spin mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">
              正在导入备份数据...
            </h3>
            <p className="text-sm text-zinc-400 whitespace-pre-wrap leading-relaxed">
              {importProgress}
            </p>
          </div>
        </div>
      )}

      {/* OrderBoard 弹窗（加菜/合并） - 已抽离至 features/orders/OrderBoard.tsx */}
      <OrderBoard
        orders={orders}
        categories={categories}
        setCategories={setCategories}
        currency={currency}
        receiptSettings={receiptSettings}
        onSaveToCloud={onSaveToCloud}
        onConfirmDialog={setConfirmDialog}
        addDishTargetOrder={addDishTargetOrder}
        setAddDishTargetOrder={setAddDishTargetOrder}
        mergeSourceOrder={mergeSourceOrder}
        setMergeSourceOrder={setMergeSourceOrder}
      />
    </div>
  );
}
