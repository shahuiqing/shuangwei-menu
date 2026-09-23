import { safeGetItem } from "../utils/storage";
import { checkpointService } from "../services/checkpoint";
import { lanSync } from "../services/lanSync";
import { useState, useEffect } from "react";
import type { FormEvent, ChangeEvent } from "react";
import { api, parseOrderTimestamp } from "../api";
import { OrdersTab } from "../features/orders/OrdersTab";
import { OrderBoard } from "../features/orders/OrderBoard";
import { QrTab } from "../features/qrcode/QrTab";
import { InventoryTab } from "../features/inventory/InventoryTab";
import { FinanceReports } from "../features/inventory/FinanceReports";
import { MenuTab } from "../features/menu/MenuTab";
import {
  X,
  Lock,
  Image as ImageIcon,
  Key,
  Sparkles,
  Loader2,
  Volume2,
  VolumeX,
  Trash2,
  Archive,
  Printer,
  Maximize,
  CircleDollarSign,
  LayoutList,
  Palette,
  Wrench,
  Shield,
  Database,
  Layout,
  DownloadCloud,
  UploadCloud,
  FileSpreadsheet,
  Copy,
  Check,
  Save,
  Sun,
  Moon,
  List,
  Flame,
  ShoppingBag,
  User,
  CheckCircle,
  Scan,
  HardDrive,
  Cloud,
  AlertTriangle,
  RefreshCw,
  Boxes,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { compressImage } from "../utils/image";
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

const PRESET_BACKGROUNDS = [
  { id: "none", name: "默认暗黑", url: "" },
  {
    id: "fire",
    name: "沉浸炭火",
    url: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=2574&auto=format&fit=crop",
  },
  {
    id: "wood",
    name: "黑金原木",
    url: "https://images.unsplash.com/photo-1550684376-efcbd6e3f031?q=80&w=2670&auto=format&fit=crop",
  },
  {
    id: "spices",
    name: "秘制香辛",
    url: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?q=80&w=2670&auto=format&fit=crop",
  },
  {
    id: "abstract",
    name: "深邃暗影",
    url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2664&auto=format&fit=crop",
  },
];

import { useMenuManager } from "../features/menu/useMenuManager";

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
    | "inventory"
    | "finance"
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
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title?: string;
    stepBadge?: string;
    message: string;
    subDetail?: string;
    onConfirm: () => void;
    onCancel?: () => void;
    isAlert?: boolean;
    confirmText?: string;
    cancelText?: string;
    confirmBtnClass?: string;
  } | null>(null);
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
    adminPassword,
    devicePasswords,
    securityQuestion,
    securityAnswer,
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
    let unsubscribe: (() => void) | undefined;
    if (activeTab === "qr") {
      unsubscribe = api.subscribeToTables((data) => {
        if (Array.isArray(data)) {
          setTables(data);
        }
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [activeTab]);

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

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    setIsAuthed(true);
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

  // Print Settings State
  const [printConfig, setPrintConfig] = useState({
    layout: "grid" as "grid" | "list",
    showLogo: true,
    showBackground: true,
    showImages: true,
    showDescription: true,
    showQrCode: true,
    langs: {
      zh: true,
      en: true,
      fr: true,
      ar: true,
      ma: true,
    },
  });

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

  const handleChangePassword = (e: FormEvent) => {
    e.preventDefault();
    if (!newAdminPassword.trim()) return;
    if (setAdminPassword) {
      setAdminPassword(newAdminPassword);
      setNewAdminPassword("");
      if (onSaveToCloud) {
        onSaveToCloud({ adminPassword: newAdminPassword, silent: true });
        alert(
          "密码修改成功并已同步到云端！ / Password changed and synced to cloud!",
        );
      } else {
        alert(
          "密码修改成功！请别忘了保存到云端。 / Password changed successfully!",
        );
      }
    }
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

  const rawDiscountNum = parseFloat(checkoutDiscountStr) || 0;
  let parsedDiscount = 0;
  if (checkoutDiscountMode === "rate") {
    let rate = rawDiscountNum;
    if (rate > 10 && rate <= 100) rate = rate / 10;
    if (rate > 0 && rate < 10) {
      const total = checkoutOrder?.total || 0;
      parsedDiscount = total * (1 - rate / 10);
    } else if (rate === 10 || rate === 0) {
      parsedDiscount = 0;
    }
  } else {
    parsedDiscount = rawDiscountNum;
  }
  const parsedReceived = parseFloat(checkoutReceivedStr) || 0;

  const handleNumpadInput = (key: string) => {
    const setState =
      activeNumpadField === "discount"
        ? setCheckoutDiscountStr
        : setCheckoutReceivedStr;

    setState((prev) => {
      if (key === "C") return "0";
      if (key === "⌫") return prev.length > 1 ? prev.slice(0, -1) : "0";

      if (key === ".") {
        if (prev.includes(".")) return prev;
        return prev + ".";
      }

      return prev === "0" && key !== "." ? key : prev + key;
    });
  };

  const numpadKeys = [
    "7",
    "8",
    "9",
    "4",
    "5",
    "6",
    "1",
    "2",
    "3",
    "0",
    ".",
    "⌫",
    "C",
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4 font-sans">
      <div className="bg-zinc-900 border-zinc-800 sm:border rounded-none sm:rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl relative flex flex-col h-[100dvh] sm:h-[90vh]">
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

              <div
                onWheel={(e) => {
                  if (e.deltaY !== 0) e.currentTarget.scrollLeft += e.deltaY;
                }}
                className="flex overflow-x-auto space-x-2 border-b border-zinc-800 pb-2 custom-scrollbar pr-8 hide-scrollbar cursor-grab active:cursor-grabbing"
              >
                <button
                  onClick={() => setActiveTab("orders")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === "orders" ? "bg-orange-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                >
                  <ShoppingBag size={16} />
                  订单记录
                </button>
                <button
                  onClick={() => setActiveTab("menu")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === "menu" ? "bg-orange-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                >
                  <LayoutList size={16} />
                  菜单管理
                </button>
                <button
                  onClick={() => setActiveTab("promotions")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === "promotions" ? "bg-orange-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                >
                  <Flame size={16} />
                  活动管理
                </button>
                <button
                  onClick={() => setActiveTab("appearance")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === "appearance" ? "bg-orange-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                >
                  <Palette size={16} />
                  外观设置
                </button>
                <button
                  onClick={() => setActiveTab("tools")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === "tools" ? "bg-orange-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                >
                  <Wrench size={16} />
                  实用工具
                </button>
                <button
                  onClick={() => setActiveTab("qr")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === "qr" ? "bg-orange-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                >
                  <Scan size={16} />
                  扫码点餐
                </button>
                <button
                  onClick={() => setActiveTab("printer")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === "printer" ? "bg-orange-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                >
                  <Printer size={16} />
                  打印机设置
                </button>
                <button
                  onClick={() => setActiveTab("security")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === "security" ? "bg-orange-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                >
                  <Shield size={16} />
                  账户安全
                </button>
                <button
                  onClick={() => setActiveTab("database")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === "database" ? "bg-orange-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                >
                  <Database size={16} />
                  数据与备份 (Database)
                </button>
                <button
                  onClick={() => setActiveTab("inventory")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === "inventory" ? "bg-orange-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                >
                  <Boxes size={16} />
                  库存与BOM联控
                </button>
                <button
                  onClick={() => setActiveTab("finance")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === "finance" ? "bg-emerald-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                >
                  <CircleDollarSign size={16} />
                  经营盈亏与采购
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0 pb-16">
              {activeTab === "orders" && (
                <>
                  <OrdersTab
                    orders={orders}
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
                  <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
                    <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                      <Archive size={20} className="text-orange-500" />{" "}
                      历史订单自动归档清理 (Auto Archive)
                    </h3>
                    <p className="text-xs text-zinc-400 mb-4">
                      自动删除超过设定天数的<strong>已完成订单</strong>，控制
                      Supabase 免费层数据库存储用量。可随时手动执行。
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-zinc-300">
                        保留最近
                        <select
                          value={archiveRetentionDays}
                          onChange={(e) =>
                            setArchiveRetentionDays(Number(e.target.value))
                          }
                          className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500"
                        >
                          <option value={7}>7 天</option>
                          <option value={14}>14 天</option>
                          <option value={30}>30 天</option>
                          <option value={90}>90 天</option>
                          <option value={180}>180 天</option>
                        </select>
                        的已完成订单
                      </label>
                      <button
                        onClick={handleArchiveCleanup}
                        disabled={isCleaningArchive}
                        className="flex items-center gap-1.5 text-xs bg-orange-600 hover:bg-orange-500 text-white font-bold px-4 py-2 rounded-lg transition-all shadow-md shadow-orange-600/20 disabled:opacity-50"
                      >
                        {isCleaningArchive ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            清理中...
                          </>
                        ) : (
                          <>
                            <Trash2 size={14} />
                            立即清理
                          </>
                        )}
                      </button>
                    </div>
                    {archiveCleanMsg && (
                      <p className="text-xs text-emerald-400 mt-3">
                        {archiveCleanMsg}
                      </p>
                    )}
                  </div>
                </>
              )}
              {activeTab === "tools" && (
                <>
                  {/* API Settings */}
                  <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
                    <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                      <Key size={20} className="text-orange-500" /> API 设置
                      (用于 AI 翻译 / 完善图片)
                    </h3>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={handleApiKeyChange}
                      placeholder="在此输入您的 Gemini API Key"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                    />
                    <p className="text-[10px] text-zinc-500 mt-2">
                      API Key 仅本地保存在您的浏览器中。用于一键进行多语言翻译和
                      AI 图片美化增强功能。
                    </p>
                  </div>
                </>
              )}
              {activeTab === "appearance" && (
                <>
                  {/* Layout Settings */}
                  <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <Layout size={20} className="text-orange-500" />
                      菜单布局样式 / Layout Style
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        onClick={() => setLayoutStyle && setLayoutStyle("grid")}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border ${layoutStyle === "grid" ? "border-orange-500 bg-orange-500/10 text-orange-500" : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600"} transition-colors gap-2`}
                      >
                        <div className="w-16 h-12 bg-zinc-800 rounded flex flex-col gap-1 p-1">
                          <div className="w-full h-1/2 bg-zinc-700 rounded-sm"></div>
                          <div className="w-full h-1/4 bg-zinc-600 rounded-sm"></div>
                          <div className="w-1/2 h-1/4 bg-zinc-600 rounded-sm"></div>
                        </div>
                        <span className="text-sm font-semibold mt-1">
                          经典网格 (Grid)
                        </span>
                      </button>
                      <button
                        onClick={() => setLayoutStyle && setLayoutStyle("list")}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border ${layoutStyle === "list" ? "border-orange-500 bg-orange-500/10 text-orange-500" : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600"} transition-colors gap-2`}
                      >
                        <div className="w-16 h-12 bg-zinc-800 rounded flex gap-1 p-1">
                          <div className="w-1/3 h-full bg-zinc-700 rounded-sm"></div>
                          <div className="flex-1 flex flex-col gap-1">
                            <div className="w-full h-1/3 bg-zinc-600 rounded-sm"></div>
                            <div className="w-2/3 h-1/3 bg-zinc-600 rounded-sm"></div>
                          </div>
                        </div>
                        <span className="text-sm font-semibold mt-1">
                          优雅列表 (List)
                        </span>
                      </button>
                      <button
                        onClick={() =>
                          setLayoutStyle && setLayoutStyle("bento")
                        }
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border ${layoutStyle === "bento" ? "border-orange-500 bg-orange-500/10 text-orange-500" : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600"} transition-colors gap-2`}
                      >
                        <div className="w-16 h-12 bg-zinc-800 rounded grid grid-cols-2 grid-rows-2 gap-1 p-1">
                          <div className="col-span-2 row-span-1 bg-zinc-700 rounded-sm"></div>
                          <div className="col-span-1 border border-zinc-700 rounded-sm"></div>
                          <div className="col-span-1 border border-zinc-700 rounded-sm"></div>
                        </div>
                        <span className="text-sm font-semibold mt-1">
                          便当网格 (Bento)
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Theme Settings */}
                  <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <Palette size={20} className="text-orange-500" />
                      界面主题 / Theme Mode
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        onClick={() => setTheme && setTheme("midnight")}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border ${theme === "midnight" ? "border-orange-500 bg-orange-500/10 text-orange-500" : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600"} transition-colors gap-2`}
                      >
                        <Moon
                          size={24}
                          className={
                            theme === "midnight"
                              ? "text-orange-500"
                              : "text-zinc-500"
                          }
                        />
                        <span className="text-sm font-semibold mt-1">
                          暗夜黑 (Midnight)
                        </span>
                      </button>
                      <button
                        onClick={() => setTheme && setTheme("light")}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border ${theme === "light" ? "border-orange-500 bg-orange-500/10 text-orange-500" : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600"} transition-colors gap-2`}
                      >
                        <Sun
                          size={24}
                          className={
                            theme === "light"
                              ? "text-orange-500"
                              : "text-zinc-500"
                          }
                        />
                        <span className="text-sm font-semibold mt-1">
                          明亮白 (Light)
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Sound Settings */}
                  <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                        {soundEnabled ? (
                          <Volume2 size={20} className="text-orange-500" />
                        ) : (
                          <VolumeX size={20} className="text-zinc-500" />
                        )}
                        翻页音效
                      </h3>
                      <p className="text-xs text-zinc-400">
                        开启或关闭菜单页面切换时的高级音效
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setSoundEnabled && setSoundEnabled(!soundEnabled)
                      }
                      className={`w-14 h-8 rounded-full p-1 transition-colors relative flex items-center ${soundEnabled ? "bg-orange-500" : "bg-zinc-700"}`}
                    >
                      <div
                        className={`w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-md ${soundEnabled ? "translate-x-6" : "translate-x-0"}`}
                      />
                    </button>
                  </div>
                </>
              )}
              {activeTab === "tools" && (
                <>
                  {/* Currency Settings */}
                  <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                        <CircleDollarSign
                          size={20}
                          className="text-orange-500"
                        />{" "}
                        全局货币单位 / Global Currency
                      </h3>
                      <p className="text-xs text-zinc-400">
                        一键替换所有菜品价格显示的货币符号。(注意：不会转换汇率数值)
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleGlobalCurrencyChange("MAD")}
                        className="bg-zinc-800 hover:bg-orange-600 text-white text-xs font-bold rounded-lg px-3 py-2 transition-colors border border-zinc-700 hover:border-orange-500"
                      >
                        设为 MAD 迪拉姆
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGlobalCurrencyChange("¥")}
                        className="bg-zinc-800 hover:bg-orange-600 text-white text-xs font-bold rounded-lg px-3 py-2 transition-colors border border-zinc-700 hover:border-orange-500"
                      >
                        设为 CNY 人民币
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGlobalCurrencyChange("€")}
                        className="bg-zinc-800 hover:bg-orange-600 text-white text-xs font-bold rounded-lg px-3 py-2 transition-colors border border-zinc-700 hover:border-orange-500"
                      >
                        设为 EUR 欧元
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGlobalCurrencyChange("$")}
                        className="bg-zinc-800 hover:bg-orange-600 text-white text-xs font-bold rounded-lg px-3 py-2 transition-colors border border-zinc-700 hover:border-orange-500"
                      >
                        设为 USD 美元
                      </button>
                    </div>
                  </div>
                </>
              )}
              {activeTab === "appearance" && (
                <>
                  {/* Fullscreen Action */}
                  <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                        <Maximize size={20} className="text-orange-500" />{" "}
                        全屏模式 / Fullscreen
                      </h3>
                      <p className="text-xs text-zinc-400">
                        切换浏览器全屏模式以获得沉浸式体验 / Toggle fullscreen
                        mode
                      </p>
                    </div>
                    <button
                      onClick={handleFullscreenToggle}
                      className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl px-4 py-2.5 transition-colors text-sm border border-zinc-700 flex items-center gap-2 max-w-fit"
                    >
                      <Maximize size={16} /> 切换全屏 / Toggle
                    </button>
                  </div>
                </>
              )}
              {activeTab === "qr" && (
                <QrTab tables={tables} receiptSettings={receiptSettings} />
              )}
              {activeTab === "printer" && (
                <>
                  {/* Print Menu Action */}
                  <div className="mb-6 bg-zinc-950 rounded-2xl border border-zinc-800/50 overflow-hidden">
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/50 bg-zinc-900/50">
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                          <Printer size={20} className="text-orange-500" />{" "}
                          打印与排版设置 / Print Setup
                        </h3>
                        <p className="text-xs text-zinc-400">
                          定制您的纸质菜单排版和内容 / Customize your physical
                          menu layout.
                        </p>
                      </div>
                      <button
                        onClick={handlePrintMenu}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl px-4 py-2.5 transition-colors text-sm flex items-center justify-center gap-2 max-w-fit"
                      >
                        <Printer size={16} /> 预览 & 打印 (Print PDF)
                      </button>
                    </div>

                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-semibold text-zinc-300 block mb-2">
                            排版风格 / Layout Style
                          </label>
                          <div className="flex bg-zinc-900 p-1 rounded-xl w-full border border-zinc-800">
                            <button
                              onClick={() =>
                                setPrintConfig({
                                  ...printConfig,
                                  layout: "grid",
                                })
                              }
                              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${printConfig.layout === "grid" ? "bg-zinc-700 text-white" : "text-zinc-400"}`}
                            >
                              网格双列 (Grid)
                            </button>
                            <button
                              onClick={() =>
                                setPrintConfig({
                                  ...printConfig,
                                  layout: "list",
                                })
                              }
                              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${printConfig.layout === "list" ? "bg-zinc-700 text-white" : "text-zinc-400"}`}
                            >
                              列表单列 (List)
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-semibold text-zinc-300 block mb-2">
                            包含元素 / Include Elements
                          </label>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer border border-zinc-800 p-2 rounded-lg hover:bg-zinc-800/50">
                              <input
                                type="checkbox"
                                className="rounded text-orange-500 form-checkbox bg-zinc-900 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                                checked={printConfig.showImages}
                                onChange={(e) =>
                                  setPrintConfig({
                                    ...printConfig,
                                    showImages: e.target.checked,
                                  })
                                }
                              />
                              <span className="text-sm text-zinc-400 font-medium">
                                菜品图片 (Images)
                              </span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer border border-zinc-800 p-2 rounded-lg hover:bg-zinc-800/50">
                              <input
                                type="checkbox"
                                className="rounded text-orange-500 form-checkbox bg-zinc-900 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                                checked={printConfig.showDescription}
                                onChange={(e) =>
                                  setPrintConfig({
                                    ...printConfig,
                                    showDescription: e.target.checked,
                                  })
                                }
                              />
                              <span className="text-sm text-zinc-400 font-medium">
                                详细描述 (Descriptions)
                              </span>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="flex items-center gap-2 cursor-pointer border border-zinc-800 p-2 rounded-lg hover:bg-zinc-800/50">
                                <input
                                  type="checkbox"
                                  className="rounded text-orange-500 form-checkbox bg-zinc-900 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                                  checked={printConfig.showBackground}
                                  onChange={(e) =>
                                    setPrintConfig({
                                      ...printConfig,
                                      showBackground: e.target.checked,
                                    })
                                  }
                                />
                                <span className="text-sm text-zinc-400 font-medium">
                                  背景 (Background)
                                </span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer border border-zinc-800 p-2 rounded-lg hover:bg-zinc-800/50">
                                <input
                                  type="checkbox"
                                  className="rounded text-orange-500 form-checkbox bg-zinc-900 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                                  checked={printConfig.showLogo}
                                  onChange={(e) =>
                                    setPrintConfig({
                                      ...printConfig,
                                      showLogo: e.target.checked,
                                    })
                                  }
                                />
                                <span className="text-sm text-zinc-400 font-medium">
                                  Logo
                                </span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer border border-zinc-800 p-2 rounded-lg hover:bg-zinc-800/50">
                                <input
                                  type="checkbox"
                                  className="rounded text-orange-500 form-checkbox bg-zinc-900 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                                  checked={printConfig.showQrCode}
                                  onChange={(e) =>
                                    setPrintConfig({
                                      ...printConfig,
                                      showQrCode: e.target.checked,
                                    })
                                  }
                                />
                                <span className="text-sm text-zinc-400 font-medium">
                                  二维码 (QR)
                                </span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-semibold text-zinc-300 block mb-2">
                            多语言配置 / Printed Languages
                          </label>
                          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-col gap-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                className="rounded text-orange-500 form-checkbox bg-zinc-950 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                                checked={printConfig.langs.zh}
                                onChange={(e) =>
                                  setPrintConfig({
                                    ...printConfig,
                                    langs: {
                                      ...printConfig.langs,
                                      zh: e.target.checked,
                                    },
                                  })
                                }
                              />
                              <span className="text-sm text-zinc-300 font-medium flex-1">
                                中文 (Chinese)
                              </span>
                              <span className="text-xs text-orange-500">
                                主语言
                              </span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                className="rounded text-orange-500 form-checkbox bg-zinc-950 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                                checked={printConfig.langs.en}
                                onChange={(e) =>
                                  setPrintConfig({
                                    ...printConfig,
                                    langs: {
                                      ...printConfig.langs,
                                      en: e.target.checked,
                                    },
                                  })
                                }
                              />
                              <span className="text-sm text-zinc-300 font-medium flex-1">
                                English (英语)
                              </span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                className="rounded text-orange-500 form-checkbox bg-zinc-950 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                                checked={printConfig.langs.fr}
                                onChange={(e) =>
                                  setPrintConfig({
                                    ...printConfig,
                                    langs: {
                                      ...printConfig.langs,
                                      fr: e.target.checked,
                                    },
                                  })
                                }
                              />
                              <span className="text-sm text-zinc-300 font-medium flex-1">
                                Français (法语)
                              </span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                className="rounded text-orange-500 form-checkbox bg-zinc-950 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                                checked={printConfig.langs.ar}
                                onChange={(e) =>
                                  setPrintConfig({
                                    ...printConfig,
                                    langs: {
                                      ...printConfig.langs,
                                      ar: e.target.checked,
                                    },
                                  })
                                }
                              />
                              <span className="text-sm text-zinc-300 font-medium flex-1">
                                العربية (阿拉伯语)
                              </span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                className="rounded text-orange-500 form-checkbox bg-zinc-950 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                                checked={printConfig.langs.ma}
                                onChange={(e) =>
                                  setPrintConfig({
                                    ...printConfig,
                                    langs: {
                                      ...printConfig.langs,
                                      ma: e.target.checked,
                                    },
                                  })
                                }
                              />
                              <span className="text-sm text-zinc-300 font-medium flex-1">
                                الدارجة (摩洛哥方言)
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Receipt Settings */}
                  {receiptSettings && setReceiptSettings && (
                    <div className="mb-6 bg-zinc-950 rounded-2xl border border-zinc-800/50 overflow-hidden">
                      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/50 bg-zinc-900/50">
                        <div>
                          <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                            <Printer size={20} className="text-orange-500" />{" "}
                            小票打印设置 / Receipt Setup
                          </h3>
                          <p className="text-xs text-zinc-400">
                            定制您的热敏小票排版和内容 / Customize your thermal
                            receipt layout.
                          </p>
                        </div>
                        {onSaveToCloud && (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                const testOrder = {
                                  id:
                                    "TEST-" + Math.floor(Math.random() * 10000),
                                  timestamp: new Date().toISOString(),
                                  customerName: "Test Customer (测试)",
                                  items: [
                                    {
                                      name: "Test Item 1",
                                      enTitle: "Test Item 1 English",
                                      frTitle: "Test Item 1 Français",
                                      arTitle: "عنصر اختبار 1",
                                      maTitle: "عنصر اختبار الدارجة 1",
                                      quantity: 2,
                                      price: 50,
                                    },
                                    {
                                      name: "Test Item 2",
                                      enTitle: "Test Item 2 English",
                                      frTitle: "Test Item 2 Français",
                                      arTitle: "عنصر اختبار 2",
                                      maTitle: "عنصر اختبار الدارجة 2",
                                      quantity: 1,
                                      price: 100,
                                    },
                                  ],
                                  total: 200,
                                };
                                import("../lib/print").then((m) =>
                                  m.printReceipt(
                                    testOrder,
                                    currency,
                                    receiptSettings,
                                  ),
                                );
                              }}
                              className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl px-4 py-2.5 transition-colors text-sm flex items-center justify-center gap-2 max-w-fit border border-zinc-700"
                            >
                              <Printer size={16} /> 打印测试 (Test Print)
                            </button>
                            <button
                              onClick={() =>
                                onSaveToCloud({
                                  receiptSettings,
                                  silent: false,
                                })
                              }
                              className="bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl px-4 py-2.5 transition-colors text-sm flex items-center justify-center gap-2 max-w-fit"
                            >
                              保存小票设置
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-semibold text-zinc-300 mb-2">
                              店铺名称 (Store Name)
                            </label>
                            <input
                              type="text"
                              value={receiptSettings.storeName}
                              onChange={(e) =>
                                setReceiptSettings({
                                  ...receiptSettings,
                                  storeName: e.target.value,
                                })
                              }
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm"
                              placeholder="默认使用页面标题"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-zinc-300 mb-2">
                              二维码中心图标 URL (QR Center Logo Image)
                            </label>
                            <input
                              type="text"
                              value={receiptSettings.topLogoUrl || ""}
                              onChange={(e) =>
                                setReceiptSettings({
                                  ...receiptSettings,
                                  topLogoUrl: e.target.value,
                                })
                              }
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm"
                              placeholder="留空则使用默认图标"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-zinc-300 mb-2">
                              二维码配色 (QR Code Colors)
                            </label>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                              {[
                                {
                                  name: "经典黑白",
                                  fg: "#18181b",
                                  bg: "#ffffff",
                                },
                                {
                                  name: "暗夜鎏金",
                                  fg: "#fbbf24",
                                  bg: "#18181b",
                                },
                                {
                                  name: "品牌鲜橙",
                                  fg: "#ea580c",
                                  bg: "#ffffff",
                                },
                                {
                                  name: "极光碧绿",
                                  fg: "#064e3b",
                                  bg: "#ecfdf5",
                                },
                                {
                                  name: "深海湛蓝",
                                  fg: "#1e3a8a",
                                  bg: "#eff6ff",
                                },
                                {
                                  name: "勃艮第红",
                                  fg: "#831843",
                                  bg: "#fdf2f8",
                                },
                              ].map((preset, idx) => (
                                <button
                                  key={idx}
                                  onClick={() =>
                                    setReceiptSettings({
                                      ...receiptSettings,
                                      qrCodeFgColor: preset.fg,
                                      qrCodeBgColor: preset.bg,
                                    })
                                  }
                                  className="flex items-center gap-2 p-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:border-orange-500 transition-colors text-left"
                                >
                                  <div className="flex w-6 h-6 rounded-md overflow-hidden border border-zinc-600 shrink-0">
                                    <div
                                      className="w-1/2 h-full"
                                      style={{ backgroundColor: preset.bg }}
                                    ></div>
                                    <div
                                      className="w-1/2 h-full"
                                      style={{ backgroundColor: preset.fg }}
                                    ></div>
                                  </div>
                                  <span className="text-xs text-zinc-300 truncate">
                                    {preset.name}
                                  </span>
                                </button>
                              ))}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4">
                              <div className="flex-1">
                                <label className="block text-xs text-zinc-500 mb-1">
                                  前景色 (Foreground)
                                </label>
                                <div className="flex gap-2">
                                  <input
                                    type="color"
                                    value={
                                      receiptSettings.qrCodeFgColor || "#18181b"
                                    }
                                    onChange={(e) =>
                                      setReceiptSettings({
                                        ...receiptSettings,
                                        qrCodeFgColor: e.target.value,
                                      })
                                    }
                                    className="w-12 h-10 bg-zinc-900 border border-zinc-700 rounded-lg cursor-pointer shrink-0"
                                  />
                                  <input
                                    type="text"
                                    value={
                                      receiptSettings.qrCodeFgColor || "#18181b"
                                    }
                                    onChange={(e) =>
                                      setReceiptSettings({
                                        ...receiptSettings,
                                        qrCodeFgColor: e.target.value,
                                      })
                                    }
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm font-mono uppercase"
                                    placeholder="#18181B"
                                  />
                                </div>
                              </div>
                              <div className="flex-1">
                                <label className="block text-xs text-zinc-500 mb-1">
                                  背景色 (Background)
                                </label>
                                <div className="flex gap-2">
                                  <input
                                    type="color"
                                    value={
                                      receiptSettings.qrCodeBgColor || "#ffffff"
                                    }
                                    onChange={(e) =>
                                      setReceiptSettings({
                                        ...receiptSettings,
                                        qrCodeBgColor: e.target.value,
                                      })
                                    }
                                    className="w-12 h-10 bg-zinc-900 border border-zinc-700 rounded-lg cursor-pointer shrink-0"
                                  />
                                  <input
                                    type="text"
                                    value={
                                      receiptSettings.qrCodeBgColor || "#ffffff"
                                    }
                                    onChange={(e) =>
                                      setReceiptSettings({
                                        ...receiptSettings,
                                        qrCodeBgColor: e.target.value,
                                      })
                                    }
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm font-mono uppercase"
                                    placeholder="#FFFFFF"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-zinc-300 mb-2">
                              二维码容错率 (QR Error Correction Level)
                            </label>
                            <select
                              value={receiptSettings.qrCodeLevel || "H"}
                              onChange={(e) =>
                                setReceiptSettings({
                                  ...receiptSettings,
                                  qrCodeLevel: e.target.value,
                                })
                              }
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm"
                            >
                              <option value="L">
                                L (7%) - 适合简单二维码，线条较少
                              </option>
                              <option value="M">
                                M (15%) - 适合无中心图标的常规情况
                              </option>
                              <option value="Q">
                                Q (25%) - 适合中心有较小图标
                              </option>
                              <option value="H">
                                H (30%) - 适合中心有较大图标 (推荐)
                              </option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-zinc-300 mb-2">
                              底部 Logo URL (Bottom Logo Image)
                            </label>
                            <input
                              type="text"
                              value={receiptSettings.bottomLogoUrl || ""}
                              onChange={(e) =>
                                setReceiptSettings({
                                  ...receiptSettings,
                                  bottomLogoUrl: e.target.value,
                                })
                              }
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm"
                              placeholder="例如: https://example.com/footer.png"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-zinc-300 mb-2">
                              底部语 1 (Footer Line 1)
                            </label>
                            <input
                              type="text"
                              value={receiptSettings.footerText1}
                              onChange={(e) =>
                                setReceiptSettings({
                                  ...receiptSettings,
                                  footerText1: e.target.value,
                                })
                              }
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-zinc-300 mb-2">
                              底部语 2 (Footer Line 2)
                            </label>
                            <input
                              type="text"
                              value={receiptSettings.footerText2}
                              onChange={(e) =>
                                setReceiptSettings({
                                  ...receiptSettings,
                                  footerText2: e.target.value,
                                })
                              }
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm"
                            />
                          </div>
                          <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-semibold text-zinc-300 mb-2">
                              谷歌地图好评链接 (Google Maps Review Link)
                            </label>
                            <input
                              type="text"
                              value={receiptSettings.googleMapsReviewLink || ""}
                              onChange={(e) =>
                                setReceiptSettings({
                                  ...receiptSettings,
                                  googleMapsReviewLink: e.target.value,
                                })
                              }
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm"
                              placeholder="https://g.page/r/..."
                            />
                            <p className="text-xs text-zinc-500 mt-2">
                              设置后，顾客可以在点餐后的相关界面直接点击链接为您留下好评。
                            </p>
                          </div>
                          <div className="col-span-1 md:col-span-2">
                            <label className="flex items-start gap-3 cursor-pointer p-4 bg-zinc-900 border border-zinc-700 rounded-xl hover:bg-zinc-800/50 transition-colors">
                              <div className="flex items-center h-5">
                                <input
                                  type="checkbox"
                                  className="rounded text-orange-500 form-checkbox bg-zinc-950 border-zinc-600 focus:ring-orange-500 w-5 h-5"
                                  checked={isPrintServer}
                                  onChange={(e) => {
                                    const val = e.target.checked;
                                    setIsPrintServer(val);
                                    if (val) {
                                      localStorage.setItem(
                                        "isPrintServer",
                                        "true",
                                      );
                                    } else {
                                      localStorage.removeItem("isPrintServer");
                                    }
                                  }}
                                />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-white">
                                  将此设备设为打印服务器 (Set this device as
                                  Print Server)
                                </span>
                                <span className="text-xs text-zinc-400 mt-1">
                                  开启后，当有新订单或加菜单时，此设备将自动唤起打印机进行打印。(When
                                  enabled, this device will automatically
                                  trigger the printer for new orders and
                                  additions.)
                                </span>
                              </div>
                            </label>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-zinc-300 mb-2">
                              小票列宽 (Receipt Column Width)
                            </label>
                            <select
                              value={receiptSettings.columnWidth || "80mm"}
                              onChange={(e) =>
                                setReceiptSettings({
                                  ...receiptSettings,
                                  columnWidth: e.target.value,
                                })
                              }
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm"
                            >
                              <option value="58mm">58mm (窄边小票)</option>
                              <option value="80mm">80mm (标准小票)</option>
                              <option value="100%">100% (自适应宽度)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-zinc-300 mb-2">
                              字体大小 (Font Size)
                            </label>
                            <select
                              value={receiptSettings.fontSize || "14px"}
                              onChange={(e) =>
                                setReceiptSettings({
                                  ...receiptSettings,
                                  fontSize: e.target.value,
                                })
                              }
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors text-sm"
                            >
                              <option value="12px">小号 (Small - 12px)</option>
                              <option value="14px">中号 (Medium - 14px)</option>
                              <option value="16px">大号 (Large - 16px)</option>
                              <option value="18px">
                                特大号 (X-Large - 18px)
                              </option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-semibold text-zinc-300 mb-3">
                              显示设置 (Display Options)
                            </label>
                            <div className="space-y-2">
                              <label className="flex items-center gap-2 cursor-pointer border border-zinc-800 p-2 rounded-lg hover:bg-zinc-800/50">
                                <input
                                  type="checkbox"
                                  className="rounded text-orange-500 form-checkbox bg-zinc-900 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                                  checked={receiptSettings.showStoreName}
                                  onChange={(e) =>
                                    setReceiptSettings({
                                      ...receiptSettings,
                                      showStoreName: e.target.checked,
                                    })
                                  }
                                />
                                <span className="text-sm text-zinc-400 font-medium">
                                  打印店铺名称 (Print Store Name)
                                </span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer border border-zinc-800 p-2 rounded-lg hover:bg-zinc-800/50">
                                <input
                                  type="checkbox"
                                  className="rounded text-orange-500 form-checkbox bg-zinc-900 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                                  checked={receiptSettings.showDate}
                                  onChange={(e) =>
                                    setReceiptSettings({
                                      ...receiptSettings,
                                      showDate: e.target.checked,
                                    })
                                  }
                                />
                                <span className="text-sm text-zinc-400 font-medium">
                                  打印日期时间 (Print Date)
                                </span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer border border-zinc-800 p-2 rounded-lg hover:bg-zinc-800/50">
                                <input
                                  type="checkbox"
                                  className="rounded text-orange-500 form-checkbox bg-zinc-900 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                                  checked={receiptSettings.showQrCode}
                                  onChange={(e) =>
                                    setReceiptSettings({
                                      ...receiptSettings,
                                      showQrCode: e.target.checked,
                                    })
                                  }
                                />
                                <span className="text-sm text-zinc-400 font-medium">
                                  打印底部二维码 (Print QR Code)
                                </span>
                              </label>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-zinc-300 mb-3">
                              打印语言 (Print Languages)
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { id: "zh", label: "中文" },
                                { id: "en", label: "English" },
                                { id: "fr", label: "Français" },
                                { id: "ar", label: "العربية" },
                                { id: "ma", label: "Darija" },
                              ].map((lang) => {
                                const currentLangs =
                                  receiptSettings.printLanguages || [
                                    "zh",
                                    "en",
                                    "fr",
                                    "ar",
                                    "ma",
                                  ];
                                const isChecked = currentLangs.includes(
                                  lang.id,
                                );
                                return (
                                  <label
                                    key={lang.id}
                                    className="flex items-center gap-2 cursor-pointer border border-zinc-800 p-2 rounded-lg hover:bg-zinc-800/50"
                                  >
                                    <input
                                      type="checkbox"
                                      className="rounded text-orange-500 form-checkbox bg-zinc-900 border-zinc-700 focus:ring-orange-500 w-4 h-4"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        let newLangs;
                                        if (e.target.checked) {
                                          newLangs = [...currentLangs, lang.id];
                                        } else {
                                          newLangs = currentLangs.filter(
                                            (l: string) => l !== lang.id,
                                          );
                                        }
                                        setReceiptSettings({
                                          ...receiptSettings,
                                          printLanguages: newLangs,
                                        });
                                      }}
                                    />
                                    <span className="text-sm text-zinc-400 font-medium">
                                      {lang.label}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              {activeTab === "appearance" && (
                <>
                  {/* Brand Settings */}
                  <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Sparkles size={20} className="text-orange-500" />{" "}
                      品牌与欢迎语 (Brand & Welcome)
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">
                          店铺名称 / Restaurant Name
                        </label>
                        <input
                          type="text"
                          value={restaurantName}
                          onChange={(e) =>
                            setRestaurantName &&
                            setRestaurantName(e.target.value)
                          }
                          placeholder="例如: 炙·双味居"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">
                          定制欢迎语 / Custom Welcome Message
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={welcomeMessage}
                            onChange={(e) =>
                              setWelcomeMessage &&
                              setWelcomeMessage(e.target.value)
                            }
                            placeholder="例如: Premium Charcoal BBQ"
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                          />
                          <button
                            type="button"
                            onClick={handleAIGenerateWelcomeMessages}
                            disabled={isGeneratingWelcome}
                            className="shrink-0 flex items-center justify-center gap-2 text-xs font-semibold px-4 py-2 bg-orange-600/10 text-orange-500 hover:bg-orange-600 hover:text-white border border-orange-600/50 rounded-xl transition-colors disabled:opacity-50"
                          >
                            {isGeneratingWelcome ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Sparkles size={14} />
                            )}
                            AI 智能生成标语
                          </button>
                        </div>

                        {generatedWelcomes.length > 0 && (
                          <div className="mt-3 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800 border-dashed">
                            <h4 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                              点击选择 AI 生成的标语:
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {generatedWelcomes.map((msg, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() =>
                                    setWelcomeMessage && setWelcomeMessage(msg)
                                  }
                                  className="text-xs text-left px-3 py-2 bg-zinc-800 hover:bg-zinc-700 hover:text-orange-400 transition-colors rounded-lg border border-zinc-700"
                                >
                                  {msg}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Background Settings */}
                  <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <ImageIcon size={20} className="text-orange-500" />{" "}
                      更换背景与 Logo
                    </h3>

                    <div className="space-y-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-zinc-400">
                          背景图片 / Background
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={bgUrl}
                            onChange={(e) => setBgUrl(e.target.value)}
                            placeholder="输入图片 URL 或点击上传"
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                          />
                          <label className="flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl px-4 cursor-pointer transition-colors text-sm font-semibold text-zinc-300">
                            {isUploading ? (
                              <>
                                <Loader2
                                  size={14}
                                  className="animate-spin mr-1"
                                />{" "}
                                上传中
                              </>
                            ) : (
                              <span>上传图片</span>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  try {
                                    setIsUploading(true);
                                    const compressed =
                                      await compressImage(file);
                                    const publicUrl =
                                      await uploadBase64ToStorage(
                                        compressed,
                                        "backgrounds",
                                      );
                                    if (setBgUrl) {
                                      setBgUrl(publicUrl);
                                      if (onSaveToCloud)
                                        onSaveToCloud({
                                          bgUrl: publicUrl,
                                          silent: true,
                                        });
                                    }
                                  } catch (err: any) {
                                    console.error("Image upload failed:", err);
                                    alert(err.message || "上传失败");
                                  } finally {
                                    setIsUploading(false);
                                  }
                                }
                              }}
                            />
                          </label>
                        </div>

                        <div className="mt-3">
                          <div className="text-xs font-medium text-zinc-400 mb-2">
                            预设绝佳主题风格 / Preset Themes:
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {PRESET_BACKGROUNDS.map((preset) => (
                              <button
                                key={preset.id}
                                onClick={() => setBgUrl(preset.url)}
                                className={`flex flex-col items-center justify-center p-2 rounded-xl border ${bgUrl === preset.url ? "border-orange-500 bg-orange-500/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"} transition-colors gap-2 relative overflow-hidden group`}
                              >
                                <div className="w-full h-16 rounded-lg bg-zinc-800 relative z-10 flex items-center justify-center overflow-hidden">
                                  {preset.url ? (
                                    <img
                                      src={preset.url}
                                      alt={preset.name}
                                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-linear-to-b from-zinc-800 to-zinc-950"></div>
                                  )}
                                </div>
                                <span
                                  className={`text-xs font-semibold z-10 ${bgUrl === preset.url ? "text-orange-500" : "text-zinc-400"}`}
                                >
                                  {preset.name}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-4 border-t border-zinc-800/50">
                        <label className="text-xs font-medium text-zinc-400">
                          品牌图标 / Brand Logo
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={logoUrl}
                            onChange={(e) => setLogoUrl(e.target.value)}
                            placeholder="输入 Logo 图片 URL 或点击上传"
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                          />
                          <label className="flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl px-4 cursor-pointer transition-colors text-sm font-semibold text-zinc-300">
                            {isUploading ? (
                              <>
                                <Loader2
                                  size={14}
                                  className="animate-spin mr-1"
                                />{" "}
                                上传中
                              </>
                            ) : (
                              <span>上传 Logo</span>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  try {
                                    setIsUploading(true);
                                    const compressed =
                                      await compressImage(file);
                                    const publicUrl =
                                      await uploadBase64ToStorage(
                                        compressed,
                                        "logos",
                                      );
                                    if (setLogoUrl) {
                                      setLogoUrl(publicUrl);
                                      if (onSaveToCloud)
                                        onSaveToCloud({
                                          logoUrl: publicUrl,
                                          silent: true,
                                        });
                                    }
                                  } catch (err: any) {
                                    console.error("Image upload failed:", err);
                                    alert(err.message || "上传失败");
                                  } finally {
                                    setIsUploading(false);
                                  }
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <p className="text-[10px] text-zinc-500 mt-2">
                      背景留空以使用默认暗黑渐变背景。Logo
                      留空使用系统默认图标。
                    </p>
                  </div>
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
                  handleDeleteCategory={handleDeleteCategory}
                  handleDeleteDish={handleDeleteDish}
                  handleMoveCategory={handleMoveCategory}
                  handleMoveDish={handleMoveDish}
                  handleExportJson={handleExportJson}
                  handleExportCsv={handleExportCsv}
                  handleAITranslate={handleAITranslate}
                  handleAIEnhanceImage={handleAIEnhanceImage}
                  handleApiKeyChange={handleApiKeyChange}
                  setCurrency={setCurrency}
                  setIsUploading={setIsUploading}
                  setUploadingItemId={setUploadingItemId}
                  setPromptDialog={setPromptDialog}
                  setPromptValue={setPromptValue}
                  setSelectedCategory={setSelectedCategory}
                  setSortingCategoryId={setSortingCategoryId}
                  currency={currency}
                  restaurantName={restaurantName}
                  welcomeMessage={welcomeMessage}
                  bgUrl={bgUrl}
                  logoUrl={logoUrl}
                  layoutStyle={layoutStyle}
                  theme={theme}
                  soundEnabled={soundEnabled}
                  receiptSettings={receiptSettings}
                  promotions={promotions}
                  setPromotions={setPromotions}
                  deletedItemIds={deletedItemIds}
                  setDeletedItemIds={setDeletedItemIds}
                  setRestaurantName={setRestaurantName}
                  setWelcomeMessage={setWelcomeMessage}
                  setBgUrl={setBgUrl}
                  setLogoUrl={setLogoUrl}
                  setLayoutStyle={setLayoutStyle}
                  setTheme={setTheme}
                  setSoundEnabled={setSoundEnabled}
                  isUploading={isUploading}
                  promptValue={promptValue}
                  promptDialog={promptDialog}
                  uploadingItemId={uploadingItemId}
                  selectedCategory={selectedCategory}
                  sortingCategoryId={sortingCategoryId}
                  isOptimizing={isOptimizing}
                  optimizationProgress={optimizationProgress}
                  onSaveToCloud={onSaveToCloud}
                  isTranslating={isTranslating}
                  isEnhancing={isEnhancing}
                />
              )}
              {activeTab === "promotions" && (
                <>
                  <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Flame size={20} className="text-orange-500" /> 添加新活动
                      (Add Promotion)
                    </h3>
                    <form onSubmit={handleAddPromotion} className="space-y-4">
                      <div className="flex gap-2 mb-4">
                        <input
                          type="text"
                          value={newPromotion.title}
                          onChange={(e) =>
                            setNewPromotion({
                              ...newPromotion,
                              title: e.target.value,
                            })
                          }
                          placeholder="活动标题 (中文) / Promotion Title"
                          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                          required
                        />
                        <button
                          type="submit"
                          className="bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl px-4 py-2.5 transition-colors text-sm"
                        >
                          添加活动
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-zinc-400 mb-1">
                            图片 URL / Image URL
                          </label>
                          <input
                            type="text"
                            value={newPromotion.image}
                            onChange={(e) =>
                              setNewPromotion({
                                ...newPromotion,
                                image: e.target.value,
                              })
                            }
                            placeholder="活动图片 (必填)"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-400 mb-1">
                            描述 (中)
                          </label>
                          <textarea
                            value={newPromotion.description}
                            onChange={(e) =>
                              setNewPromotion({
                                ...newPromotion,
                                description: e.target.value,
                              })
                            }
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white resize-none"
                            rows={2}
                          />
                        </div>
                        <div className="col-span-1 md:col-span-2 text-xs text-zinc-500 italic mt-2 border-t border-zinc-800 pt-2">
                          多语版本 (Multi-language) - 如果为空将在界面中降级显示
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-400 mb-1">
                            Title (EN)
                          </label>
                          <input
                            type="text"
                            value={newPromotion.enTitle}
                            onChange={(e) =>
                              setNewPromotion({
                                ...newPromotion,
                                enTitle: e.target.value,
                              })
                            }
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-400 mb-1">
                            Description (EN)
                          </label>
                          <textarea
                            value={newPromotion.enDescription}
                            onChange={(e) =>
                              setNewPromotion({
                                ...newPromotion,
                                enDescription: e.target.value,
                              })
                            }
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white resize-none"
                            rows={1}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-400 mb-1">
                            Titre (FR)
                          </label>
                          <input
                            type="text"
                            value={newPromotion.frTitle}
                            onChange={(e) =>
                              setNewPromotion({
                                ...newPromotion,
                                frTitle: e.target.value,
                              })
                            }
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-400 mb-1">
                            Description (FR)
                          </label>
                          <textarea
                            value={newPromotion.frDescription}
                            onChange={(e) =>
                              setNewPromotion({
                                ...newPromotion,
                                frDescription: e.target.value,
                              })
                            }
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white resize-none"
                            rows={1}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-400 mb-1">
                            عنوان (AR)
                          </label>
                          <input
                            type="text"
                            value={newPromotion.arTitle}
                            onChange={(e) =>
                              setNewPromotion({
                                ...newPromotion,
                                arTitle: e.target.value,
                              })
                            }
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white text-right"
                            dir="auto"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-400 mb-1">
                            الوصف (AR)
                          </label>
                          <textarea
                            value={newPromotion.arDescription}
                            onChange={(e) =>
                              setNewPromotion({
                                ...newPromotion,
                                arDescription: e.target.value,
                              })
                            }
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white resize-none text-right"
                            dir="auto"
                            rows={1}
                          />
                        </div>
                      </div>
                    </form>
                  </div>

                  {promotions && promotions.length > 0 && (
                    <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <List size={20} className="text-orange-500" /> 现有活动
                        (Current Promotions)
                      </h3>
                      <div className="space-y-3">
                        {promotions.map((promo) => (
                          <div
                            key={promo.id}
                            className="flex flex-col sm:flex-row items-center gap-4 bg-zinc-900/50 p-3 rounded-xl border border-zinc-800"
                          >
                            {promo.image && (
                              <img
                                src={promo.image}
                                alt="promo"
                                className="w-24 h-16 object-cover rounded-md"
                              />
                            )}
                            <div className="flex-1 text-sm text-white font-medium">
                              <div>{promo.title}</div>
                              <div className="text-xs text-zinc-500 truncate max-w-[200px]">
                                {promo.description}
                              </div>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                              <button
                                onClick={() => {
                                  const newList = promotions.map((p) =>
                                    p.id === promo.id
                                      ? { ...p, isActive: !p.isActive }
                                      : p,
                                  );
                                  if (setPromotions) setPromotions(newList);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${promo.isActive ? "bg-green-900/30 text-green-400 border-green-500/30" : "bg-zinc-800 text-zinc-400 border-zinc-700"}`}
                              >
                                {promo.isActive
                                  ? "可见 (Active)"
                                  : "隐藏 (Hidden)"}
                              </button>
                              <button
                                onClick={() => handleRemovePromotion(promo.id)}
                                className="px-3 py-1.5 bg-zinc-800 text-red-400 hover:bg-red-900/30 border border-zinc-700 hover:border-red-500/30 rounded-lg text-xs font-bold transition-colors"
                              >
                                删除
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
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
                <>
                  {/* Local Backup & Restore */}
                  <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
                    <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                      <Save size={20} className="text-orange-500" />{" "}
                      本地备份与恢复 (Local Backup)
                    </h3>
                    <p className="text-xs text-zinc-400 mb-4">
                      您可以将当前的所有分类、菜品、背景配置下载为 JSON
                      格式备份到本地设备，或导出 Excel/CSV
                      菜品清单表格，也可以从本地恢复菜单。
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        onClick={handleExportJson}
                        className="bg-zinc-900 border border-zinc-800 hover:border-orange-500 text-zinc-300 hover:text-orange-500 px-4 py-3 rounded-xl transition-colors text-sm font-semibold flex flex-col items-center justify-center gap-1.5 active:scale-95"
                      >
                        <DownloadCloud size={22} className="text-orange-400" />
                        <span>导出 JSON 备份</span>
                        <span className="text-[10px] font-normal text-zinc-500">
                          (Export JSON)
                        </span>
                      </button>
                      <button
                        onClick={handleExportCsv}
                        className="bg-zinc-900 border border-zinc-800 hover:border-green-500 text-zinc-300 hover:text-green-500 px-4 py-3 rounded-xl transition-colors text-sm font-semibold flex flex-col items-center justify-center gap-1.5 active:scale-95"
                      >
                        <FileSpreadsheet size={22} className="text-green-400" />
                        <span>导出 Excel / CSV</span>
                        <span className="text-[10px] font-normal text-zinc-500">
                          (Export Spreadsheet)
                        </span>
                      </button>
                      <label className="bg-zinc-900 border border-zinc-800 hover:border-blue-500 text-zinc-300 hover:text-blue-500 px-4 py-3 rounded-xl transition-colors text-sm font-semibold flex flex-col items-center justify-center gap-1.5 cursor-pointer active:scale-95">
                        <UploadCloud size={22} className="text-blue-400" />
                        <span>从本地恢复</span>
                        <span className="text-[10px] font-normal text-zinc-500">
                          (Import JSON)
                        </span>
                        <input
                          type="file"
                          accept=".json"
                          className="hidden"
                          onChange={handleImportJson}
                        />
                      </label>
                    </div>
                  </div>

                  {/* 本地重置点（快照） */}
                  <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
                    <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                      <Archive size={20} className="text-emerald-500" />{" "}
                      本地重置点 / 快照 (Restore Points)
                    </h3>
                    <p className="text-xs text-zinc-400 mb-4">
                      每次成功保存到云端后会自动写入一个「自动重置点」。当菜单异常或数据库不可用时，可一键恢复到任意重置点，快速保证功能可用（数据存于本机，不依赖数据库）。
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <button
                        onClick={handleSaveCheckpoint}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl transition-colors text-sm font-semibold active:scale-95"
                      >
                        💾 保存当前为重置点
                      </button>
                      <span className="text-[11px] text-zinc-500">
                        局域网订单备用通道：
                        {lanConnected
                          ? "已连接"
                          : lanSync.isLanMode()
                            ? "未连接"
                            : "未启用（HTTPS 部署下自动禁用）"}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {checkpoints.length === 0 && (
                        <div className="text-xs text-zinc-500 text-center py-3">
                          暂无重置点
                        </div>
                      )}
                      {checkpoints.map((cp: any) => (
                        <div
                          key={cp.id}
                          className="flex items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="text-sm text-white truncate">
                              {cp.auto ? "🔄 " : "📌 "}
                              {cp.name}
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              {new Date(cp.createdAt).toLocaleString()} ·{" "}
                              {cp.data?.categories?.length || 0} 个分类
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleRestoreCheckpoint(cp)}
                              className="text-xs bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              恢复
                            </button>
                            <button
                              onClick={() => checkpointService.remove(cp.id)}
                              className="text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Image Storage Optimization */}
                  <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
                    <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                      <Sparkles size={20} className="text-orange-500" />{" "}
                      图片托管与空间优化 (Image Storage Optimization)
                    </h3>
                    {base64Count > 0 ? (
                      <div>
                        <p className="text-xs text-zinc-300 mb-3">
                          ⚠️{" "}
                          <strong>
                            检测到您的菜单中含有本地 Base64 图片：
                          </strong>
                          <br />
                          当前有{" "}
                          <span className="text-orange-500 font-bold text-sm">
                            {base64Count}
                          </span>{" "}
                          个菜品的图片以 Base64 内嵌在 Supabase settings
                          设置文档中，会占用较大存储空间并拖慢同步速度。
                        </p>
                        <p className="text-xs text-zinc-400 mb-4">
                          点击下方按钮，系统将自动把所有 Base64
                          格式的菜品图片上传至安全的{" "}
                          <strong>Supabase Storage 云存储空间</strong>
                          ，并在数据库中只保留轻量的图片网址，显著缩小设置体积。
                        </p>
                        <button
                          onClick={handleOptimizeImages}
                          disabled={isOptimizing}
                          className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-orange-600/10 disabled:opacity-50"
                        >
                          {isOptimizing ? (
                            <>
                              <Loader2 size={18} className="animate-spin" />
                              <span>{optimizationProgress}</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={18} />
                              <span>
                                一键优化图片存储 (迁移至 Supabase Storage)
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 p-3 bg-green-500/5 border border-green-500/10 rounded-xl">
                        <CheckCircle
                          size={20}
                          className="text-green-500 shrink-0 mt-0.5"
                        />
                        <div>
                          <p className="text-xs text-green-400 font-semibold mb-1">
                            图片存储状态优良 / All Images Optimized
                          </p>
                          <p className="text-[11px] text-zinc-400">
                            您的所有菜品图片均已托管在 Supabase Storage
                            云存储或外链中，设置文档体积保持精简。
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Supabase Storage System Diagnostics Card */}
                  <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Cloud
                          size={20}
                          className="text-orange-500 animate-pulse"
                        />{" "}
                        Supabase 云数据库与存储空间联控
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setIsSupabaseSetupOpen(true)}
                          className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg transition-all shadow-md shadow-emerald-600/20"
                        >
                          <Database size={13} />
                          <span>配置 / 切换 Supabase 云端凭证</span>
                        </button>

                        <button
                          onClick={runDiagnostics}
                          disabled={isLoadingDiagnostics}
                          className="flex items-center gap-1 text-xs bg-zinc-900 border border-zinc-700 hover:border-orange-500 hover:text-orange-400 text-zinc-300 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <RefreshCw
                            size={12}
                            className={
                              isLoadingDiagnostics ? "animate-spin" : ""
                            }
                          />
                          <span>
                            {isLoadingDiagnostics ? "正在扫描..." : "刷新诊断"}
                          </span>
                        </button>
                      </div>
                    </div>

                    {isLoadingDiagnostics && !diagnosticData ? (
                      <div className="flex flex-col items-center justify-center py-8 text-zinc-500 gap-2">
                        <Loader2
                          className="animate-spin text-orange-500"
                          size={24}
                        />
                        <span className="text-xs">
                          正在深度扫描云端存储桶文件并计算空间占比...
                        </span>
                      </div>
                    ) : diagnosticError ? (
                      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex flex-col gap-2">
                        <p className="flex items-center gap-1.5 font-semibold">
                          <AlertTriangle size={14} /> 诊断异常:{" "}
                          {diagnosticError}
                        </p>
                        <button
                          onClick={runDiagnostics}
                          className="bg-red-500/20 hover:bg-red-500/30 text-white font-semibold py-1.5 px-3 rounded-lg transition-colors text-center self-start"
                        >
                          重新连接并扫描
                        </button>
                      </div>
                    ) : diagnosticData ? (
                      <div className="space-y-4 text-xs">
                        {/* Space Usage Progress */}
                        <div className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/80">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-zinc-400 font-semibold flex items-center gap-1">
                              <HardDrive
                                size={13}
                                className="text-orange-500"
                              />
                              云端存储桶 (menu-assets) 容量状态
                            </span>
                            <span className="text-zinc-400 font-mono">
                              {(
                                diagnosticData.totalUsedBytes /
                                (1024 * 1024)
                              ).toFixed(2)}{" "}
                              MB /{" "}
                              {(
                                diagnosticData.bucketLimitBytes /
                                (1024 * 1024)
                              ).toFixed(0)}{" "}
                              MB
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full h-2 bg-zinc-950 border border-zinc-800 rounded-full overflow-hidden mb-2">
                            <div
                              className={`h-full transition-all duration-500 ${
                                diagnosticData.totalUsedBytes /
                                  diagnosticData.bucketLimitBytes >
                                0.8
                                  ? "bg-red-500 animate-pulse"
                                  : diagnosticData.totalUsedBytes /
                                        diagnosticData.bucketLimitBytes >
                                      0.5
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                              }`}
                              style={{
                                width: `${Math.min(100, Math.max(0.5, (diagnosticData.totalUsedBytes / diagnosticData.bucketLimitBytes) * 100))}%`,
                              }}
                            />
                          </div>

                          <div className="flex justify-between text-[10px] text-zinc-500">
                            <span>
                              可用空间:{" "}
                              {(
                                (diagnosticData.bucketLimitBytes -
                                  diagnosticData.totalUsedBytes) /
                                (1024 * 1024)
                              ).toFixed(2)}{" "}
                              MB
                            </span>
                            <span>
                              已用占比:{" "}
                              {(
                                (diagnosticData.totalUsedBytes /
                                  diagnosticData.bucketLimitBytes) *
                                100
                              ).toFixed(2)}
                              %
                            </span>
                          </div>
                        </div>

                        {/* Production Database Tables Status & Seed/Sync */}
                        <div className="p-3.5 bg-zinc-900/80 rounded-xl border border-zinc-800">
                          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                            <span className="text-zinc-200 font-semibold flex items-center gap-1.5 text-xs">
                              <Database
                                size={14}
                                className="text-emerald-400"
                              />
                              生产环境数据库全表状态 (Production Database
                              Tables)
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSeedDatabase(false)}
                                disabled={isSeedingDb}
                                className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-2.5 py-1 rounded-lg transition-all text-[11px] shadow-sm shadow-emerald-600/20"
                              >
                                {isSeedingDb ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <RefreshCw size={12} />
                                )}
                                <span>一键自动补全空表</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      "确定要对 Supabase 生产环境数据库执行强制全量重置同步吗？这会刷新初始化数据。",
                                    )
                                  ) {
                                    handleSeedDatabase(true);
                                  }
                                }}
                                disabled={isSeedingDb}
                                className="flex items-center gap-1 bg-amber-600/20 border border-amber-500/40 hover:bg-amber-600/30 text-amber-300 disabled:opacity-50 font-semibold px-2.5 py-1 rounded-lg transition-all text-[11px]"
                              >
                                <span>重置初始化</span>
                              </button>
                            </div>
                          </div>

                          {dbTableStats?.tables ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                              {[
                                {
                                  key: "settings",
                                  label: "全局设置",
                                  icon: "⚙️",
                                },
                                {
                                  key: "categories",
                                  label: "菜单分类",
                                  icon: "📁",
                                },
                                {
                                  key: "menu_items",
                                  label: "菜品数据",
                                  icon: "🍖",
                                },
                                {
                                  key: "inventory_items",
                                  label: "原材料库存",
                                  icon: "📦",
                                },
                                {
                                  key: "recipe_boms",
                                  label: "BOM配方",
                                  icon: "🧪",
                                },
                                { key: "tables", label: "QR餐桌", icon: "🪑" },
                                {
                                  key: "orders",
                                  label: "顾客订单",
                                  icon: "🧾",
                                },
                              ].map((item) => {
                                const count =
                                  dbTableStats.tables[item.key] ?? -1;
                                const isEmpty = count === 0;
                                const isError = count === -1;
                                return (
                                  <div
                                    key={item.key}
                                    className={`p-2 rounded-lg border text-left flex flex-col justify-between ${
                                      isError
                                        ? "bg-red-500/5 border-red-500/20 text-red-400"
                                        : isEmpty
                                          ? "bg-amber-500/5 border-amber-500/20 text-amber-300"
                                          : "bg-zinc-950 border-zinc-800 text-zinc-300"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                      <span>
                                        {item.icon} {item.label}
                                      </span>
                                      <span className="font-mono text-[10px] text-zinc-500">
                                        {item.key}
                                      </span>
                                    </div>
                                    <div className="mt-1 flex items-baseline justify-between">
                                      <span className="text-sm font-bold font-mono">
                                        {isError ? "未建表" : `${count} 条`}
                                      </span>
                                      <span className="text-[10px]">
                                        {isError
                                          ? "⚠️"
                                          : isEmpty
                                            ? "需初始化"
                                            : "正常已同步"}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="py-3 text-center text-zinc-500 text-[11px] flex items-center justify-center gap-1.5">
                              <Loader2
                                size={13}
                                className="animate-spin text-emerald-500"
                              />
                              正在获取生产数据库各表记录数...
                            </div>
                          )}

                          {seedLogs && seedLogs.length > 0 && (
                            <div className="mt-2 p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-[11px] font-mono space-y-1 max-h-32 overflow-y-auto">
                              <div className="text-emerald-400 font-bold mb-1 flex items-center gap-1">
                                <Sparkles size={12} /> 同步/初始化结果日志:
                              </div>
                              {seedLogs.map((log, idx) => (
                                <div
                                  key={idx}
                                  className="text-zinc-300 leading-snug"
                                >
                                  {log}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Automatic Compression Rule Announcement */}
                        <div className="p-3 bg-orange-500/5 border border-orange-500/10 rounded-xl text-zinc-400">
                          <p className="font-semibold text-orange-400 mb-1 flex items-center gap-1">
                            <Sparkles size={13} />
                            智能大图自动压缩已生效 (High-Res Smart Compression)
                          </p>
                          <p className="text-[10px] leading-relaxed">
                            为了保障手机端极速加载，系统已应用{" "}
                            <strong>1200px 高清无损压缩算法</strong>。 上传超过
                            1MB
                            的超大菜品图片或背景时，前端将在上传前自动将其压缩至
                            150KB-300KB 的黄金平衡尺寸，在保持高清的同时节省 85%
                            以上的云存储桶空间！
                          </p>
                        </div>

                        {/* File list header */}
                        <div>
                          <div className="flex justify-between text-zinc-400 font-semibold mb-2 items-center px-1">
                            <span>
                              云端文件列表 ({diagnosticData.files.length}{" "}
                              个文件)
                            </span>
                            <span className="text-zinc-500 font-normal">
                              点击垃圾桶可清理冗余/无用大图
                            </span>
                          </div>

                          {diagnosticData.files.length === 0 ? (
                            <div className="p-4 bg-zinc-900/30 rounded-xl border border-zinc-800/30 text-center text-zinc-500">
                              目前云端存储桶没有上传任何菜品大图
                            </div>
                          ) : (
                            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                              {diagnosticData.files.map(
                                (file: any, idx: number) => {
                                  const sizeInKB = file.size / 1024;
                                  const isLarge = sizeInKB > 500;
                                  const isHuge = sizeInKB > 1500;
                                  return (
                                    <div
                                      key={idx}
                                      className="p-2.5 bg-zinc-900/40 border border-zinc-800/60 hover:bg-zinc-900/70 rounded-xl flex items-center justify-between gap-3 transition-colors"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <p
                                          className="font-mono text-[11px] text-zinc-300 truncate"
                                          title={file.path}
                                        >
                                          {file.path}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-zinc-500">
                                          <span>大小: </span>
                                          <span
                                            className={`font-mono font-semibold ${isHuge ? "text-red-500" : isLarge ? "text-amber-500" : "text-zinc-400"}`}
                                          >
                                            {sizeInKB > 1024
                                              ? `${(sizeInKB / 1024).toFixed(2)} MB`
                                              : `${sizeInKB.toFixed(1)} KB`}
                                          </span>
                                          {isHuge && (
                                            <span className="bg-red-500/10 text-red-400 px-1 rounded text-[9px] font-bold border border-red-500/20">
                                              极大
                                            </span>
                                          )}
                                          {!isHuge && isLarge && (
                                            <span className="bg-amber-500/10 text-amber-400 px-1 rounded text-[9px] font-bold border border-amber-500/20">
                                              较大
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteStorageFile(file.path)
                                        }
                                        className="p-1.5 hover:bg-red-500/10 hover:text-red-400 text-zinc-500 rounded-lg transition-colors shrink-0"
                                        title="从云存储彻底删除"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 text-zinc-500 gap-2">
                        <button
                          type="button"
                          onClick={runDiagnostics}
                          className="bg-zinc-900 border border-zinc-700 hover:border-orange-500 hover:text-orange-400 text-white font-semibold py-2 px-4 rounded-xl transition-colors text-xs flex items-center gap-1.5"
                        >
                          <RefreshCw size={14} />
                          开始存储空间诊断与扫描
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === "inventory" && (
                <InventoryTab
                  categories={categories}
                  setCategories={setCategories}
                />
              )}

              {activeTab === "finance" && <FinanceReports />}
            </div>
          </div>
        )}
      </div>

      <SupabaseSetupModal
        isOpen={isSupabaseSetupOpen}
        onClose={() => setIsSupabaseSetupOpen(false)}
      />

      {checkoutOrder && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto touch-pan-y"
          style={{ zIndex: 9999 }}
        >
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl flex flex-col md:flex-row shadow-2xl max-h-[90dvh] my-auto overflow-y-auto custom-scrollbar">
            {/* Left Column: Order Summary & Inputs */}
            <div className="flex-1 p-4 sm:p-6 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
              <h3 className="text-xl font-bold text-white mb-4">
                订单结账 (Checkout)
              </h3>
              <div className="space-y-4 mb-6 flex-1">
                <div>
                  <label className="block text-sm font-semibold text-zinc-400 mb-1">
                    订单总金额 (Total Amount)
                  </label>
                  <div className="text-2xl font-bold text-white">
                    {currency} {checkoutOrder.total}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-400 mb-2">
                    结算方式 (Payment Method)
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {[
                      { id: "微信支付", label: "微信支付", icon: "💬" },
                      { id: "现金", label: "现金", icon: "💵" },
                      { id: "POS机", label: "POS刷卡", icon: "💳" },
                      { id: "支付宝", label: "支付宝", icon: "📱" },
                      { id: "其他", label: "其他", icon: "✨" },
                    ].map((pm) => (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setCheckoutPaymentMethod(pm.id)}
                        className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all border flex flex-col items-center justify-center gap-1 ${
                          checkoutPaymentMethod === pm.id
                            ? "bg-orange-600 text-white border-orange-500 shadow-md shadow-orange-500/20"
                            : "bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
                        }`}
                      >
                        <span>{pm.icon}</span>
                        <span>{pm.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className={`p-3 rounded-xl border transition-all ${
                    activeNumpadField === "discount"
                      ? "border-orange-500 bg-orange-500/10 shadow-sm"
                      : "border-zinc-800 bg-zinc-800/40"
                  }`}
                  onClick={() => setActiveNumpadField("discount")}
                >
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-zinc-300 flex items-center gap-1.5">
                      🏷️ 打折/优惠额度 (Discount)
                    </label>
                    <div className="flex bg-zinc-900 border border-zinc-700 p-0.5 rounded-lg text-xs font-semibold">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCheckoutDiscountMode("amount");
                          setCheckoutDiscountStr("0");
                          setActiveNumpadField("discount");
                        }}
                        className={`px-2.5 py-1 rounded-md transition-all ${
                          checkoutDiscountMode === "amount"
                            ? "bg-orange-600 text-white shadow-sm"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        立减金额 (￥)
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCheckoutDiscountMode("rate");
                          setCheckoutDiscountStr("8.5");
                          setActiveNumpadField("discount");
                        }}
                        className={`px-2.5 py-1 rounded-md transition-all ${
                          checkoutDiscountMode === "rate"
                            ? "bg-orange-600 text-white shadow-sm"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        折率/几折 (折)
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-sm">
                        {checkoutDiscountMode === "amount" ? "￥" : "折"}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={checkoutDiscountStr}
                        onChange={(e) => {
                          setCheckoutDiscountStr(e.target.value);
                        }}
                        onFocus={() => setActiveNumpadField("discount")}
                        placeholder={
                          checkoutDiscountMode === "amount"
                            ? "输入立减金额 (如 15)"
                            : "输入折扣率 (如 8.8)"
                        }
                        className="w-full bg-zinc-950 border border-zinc-700 focus:border-orange-500 rounded-xl pl-8 pr-3 py-2 text-lg font-bold text-white outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {checkoutDiscountMode === "rate" && (
                    <div className="text-xs text-orange-400 font-medium mb-2 bg-orange-500/10 px-2 py-1 rounded border border-orange-500/20">
                      当前为{" "}
                      {rawDiscountNum > 0
                        ? rawDiscountNum > 10
                          ? (rawDiscountNum / 10).toFixed(1)
                          : rawDiscountNum
                        : 10}{" "}
                      折，优惠折算立减 {currency} {parsedDiscount.toFixed(2)}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      { label: "9折", mode: "rate", val: "9" },
                      { label: "8.5折", mode: "rate", val: "8.5" },
                      { label: "8折", mode: "rate", val: "8" },
                      { label: "半价(5折)", mode: "rate", val: "5" },
                      {
                        label: "免单",
                        mode: "amount",
                        val: String(checkoutOrder.total || 0),
                      },
                    ].map((d) => (
                      <button
                        key={d.label}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCheckoutDiscountMode(d.mode as any);
                          setCheckoutDiscountStr(d.val);
                          setActiveNumpadField("received");
                        }}
                        className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-xs font-semibold text-zinc-200 rounded-lg transition-all border border-zinc-700"
                      >
                        {d.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const val = prompt(
                          "请输入自定义打折额度：\n- 输入折扣率（如 8.8 表示 8.8折）\n- 或输入立减金额（如 20 表示减免 20 元）",
                          checkoutDiscountStr || "8.5",
                        );
                        if (val !== null && val.trim() !== "") {
                          const trimmed = val.trim();
                          const num = parseFloat(trimmed);
                          if (!isNaN(num)) {
                            if (num > 0 && num < 10) {
                              setCheckoutDiscountMode("rate");
                              setCheckoutDiscountStr(trimmed);
                            } else {
                              setCheckoutDiscountMode("amount");
                              setCheckoutDiscountStr(trimmed);
                            }
                            setActiveNumpadField("received");
                          }
                        }
                      }}
                      className="px-2.5 py-1 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 active:scale-95 text-xs font-semibold rounded-lg transition-all border border-orange-500/30 flex items-center gap-1"
                    >
                      ✏️ 自定义打折
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-400 mb-1">
                    折后应收 (After Discount)
                  </label>
                  <div className="text-xl font-bold text-orange-500">
                    {currency}{" "}
                    {Math.max(
                      0,
                      (checkoutOrder.total || 0) - parsedDiscount,
                    ).toFixed(2)}
                  </div>
                </div>

                <div
                  className={`p-3 rounded-xl border transition-all ${
                    activeNumpadField === "received"
                      ? "border-orange-500 bg-orange-500/10 shadow-sm"
                      : "border-zinc-800 bg-zinc-800/40"
                  }`}
                  onClick={() => setActiveNumpadField("received")}
                >
                  <label className="block text-sm font-semibold text-zinc-300 mb-1">
                    💵 顾客支付金额 (Amount Received)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-sm">
                      ￥
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={checkoutReceivedStr}
                      onChange={(e) => setCheckoutReceivedStr(e.target.value)}
                      onFocus={() => setActiveNumpadField("received")}
                      placeholder="0.00"
                      className="w-full bg-zinc-950 border border-zinc-700 focus:border-orange-500 rounded-xl pl-8 pr-3 py-2 text-xl font-bold text-white outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-400 mb-1">
                    找零 (Change)
                  </label>
                  <div className="text-xl font-bold text-green-500">
                    {currency}{" "}
                    {Math.max(
                      0,
                      parsedReceived -
                        Math.max(
                          0,
                          (checkoutOrder.total || 0) - parsedDiscount,
                        ),
                    ).toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end whitespace-nowrap pt-4 border-t border-zinc-800">
                <button
                  onClick={() => setCheckoutOrder(null)}
                  className="px-4 py-3 text-sm font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors border border-transparent"
                >
                  取消 (Cancel)
                </button>
                <button
                  onClick={async () => {
                    try {
                      const finalTotalVal = Math.max(
                        0,
                        (checkoutOrder.total || 0) - parsedDiscount,
                      );
                      const changeVal = Math.max(
                        0,
                        parsedReceived - finalTotalVal,
                      );
                      const targetId = checkoutOrder._id || checkoutOrder.id;
                      await api.updateOrder(targetId, {
                        status: "completed",
                        paymentMethod: checkoutPaymentMethod || "微信支付",
                        discountAmount: parsedDiscount,
                        receivedAmount: parsedReceived,
                        changeAmount: changeVal,
                        finalTotal: finalTotalVal,
                        completedAt: new Date().toISOString(),
                      });
                      setCheckoutOrder(null);
                    } catch (e) {
                      console.error("Failed to complete order:", e);
                      alert("结账保存失败 (Failed to complete order)");
                    }
                  }}
                  className="px-6 py-3 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/20 rounded-xl transition-colors"
                >
                  完成结账 (Complete)
                </button>
              </div>
            </div>

            {/* Right Column: Numpad */}
            <div className="w-full md:w-[320px] bg-zinc-950 p-4 sm:p-6 flex items-center justify-center border-t md:border-t-0 md:border-l border-zinc-800">
              <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full max-w-[280px] md:max-w-none mx-auto">
                {numpadKeys.map((key) => (
                  <button
                    key={key}
                    onClick={() => handleNumpadInput(key)}
                    className={`h-12 sm:h-16 rounded-xl sm:rounded-2xl text-lg sm:text-xl font-bold transition-colors shadow-sm flex items-center justify-center
                      ${
                        key === "C"
                          ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                          : key === "⌫"
                            ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                            : "bg-zinc-800 text-white hover:bg-zinc-700"
                      }
                      active:scale-95`}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && confirmDialog.isOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200"
          style={{ zIndex: 9999 }}
        >
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden text-left">
            {confirmDialog.stepBadge && (
              <div className="mb-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                {confirmDialog.stepBadge}
              </div>
            )}
            <h3 className="text-xl font-bold text-white mb-3 flex items-center justify-between">
              <span>
                {confirmDialog.title ||
                  (confirmDialog.isAlert
                    ? "提示 (Alert)"
                    : "确认操作 (Confirm)")}
              </span>
            </h3>
            <p className="text-sm font-medium text-zinc-200 mb-3 whitespace-pre-wrap leading-relaxed">
              {confirmDialog.message}
            </p>
            {confirmDialog.subDetail && (
              <div className="text-xs text-zinc-400 mb-6 bg-zinc-950/80 p-3.5 rounded-xl border border-zinc-800/80 space-y-1.5 whitespace-pre-wrap leading-relaxed font-mono">
                {confirmDialog.subDetail}
              </div>
            )}
            <div className="flex gap-3 justify-end whitespace-nowrap pt-2 border-t border-zinc-800/60">
              {!confirmDialog.isAlert && (
                <button
                  onClick={() => {
                    if (confirmDialog.onCancel) confirmDialog.onCancel();
                    setConfirmDialog(null);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors border border-zinc-700/50"
                >
                  {confirmDialog.cancelText || "取消 (Cancel)"}
                </button>
              )}
              <button
                onClick={confirmDialog.onConfirm}
                className={
                  confirmDialog.confirmBtnClass ||
                  `px-4 py-2 text-sm font-semibold text-white rounded-xl transition-colors shadow-lg ${
                    confirmDialog.isAlert
                      ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
                      : "bg-red-600 hover:bg-red-700 shadow-red-500/20"
                  }`
                }
              >
                {confirmDialog.confirmText || "确认 (Confirm)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {promptDialog && promptDialog.isOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
        >
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-left">
            <h3 className="text-xl font-bold text-white mb-4">
              修改内容 (Edit)
            </h3>
            <p className="text-sm text-zinc-300 mb-4 whitespace-pre-wrap">
              {promptDialog.message}
            </p>
            <input
              type="text"
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  promptDialog.onConfirm(promptValue);
                } else if (e.key === "Escape") {
                  setPromptDialog(null);
                }
              }}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white mb-6 focus:outline-none focus:border-orange-500 transition-colors"
              autoFocus
            />
            <div className="flex gap-3 justify-end whitespace-nowrap">
              <button
                onClick={() => setPromptDialog(null)}
                className="px-4 py-2 text-sm font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors border border-transparent"
              >
                取消 (Cancel)
              </button>
              <button
                onClick={() => promptDialog.onConfirm(promptValue)}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-lg shadow-blue-500/20"
              >
                确认 (Confirm)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Success & Manual Backup Modal */}
      {showExportModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          style={{ zIndex: 9999 }}
        >
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <CheckCircle className="text-green-500" size={24} />
                <h3 className="text-lg font-bold text-white">
                  菜单导出成功 (Export Success)
                </h3>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-zinc-300 mb-4 leading-relaxed">
              系统已尝试触发文件下载。如果您的浏览器或设备拦截了自动下载，可以直接使用以下按钮再次下载、复制
              JSON 备份，或导出 Excel/CSV 菜品列表。
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
              <button
                onClick={handleExportJson}
                className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 active:scale-95 text-white font-medium text-sm py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-orange-600/20"
              >
                <DownloadCloud size={18} />
                <span>再次下载 JSON 备份</span>
              </button>

              <button
                onClick={handleCopyJson}
                className={`flex items-center justify-center gap-2 border active:scale-95 font-medium text-sm py-2.5 px-4 rounded-xl transition-all ${
                  copiedSuccess
                    ? "bg-green-600/20 border-green-500 text-green-400"
                    : "bg-zinc-800 border-zinc-700 hover:border-zinc-500 text-zinc-200"
                }`}
              >
                {copiedSuccess ? <Check size={18} /> : <Copy size={18} />}
                <span>
                  {copiedSuccess ? "已成功复制 JSON!" : "复制 JSON 到剪贴板"}
                </span>
              </button>

              <button
                onClick={handleExportCsv}
                className="col-span-1 sm:col-span-2 flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white font-medium text-sm py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-emerald-700/20"
              >
                <FileSpreadsheet size={18} />
                <span>导出 Excel / CSV 菜品清单表格</span>
              </button>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                <span>备份数据 JSON 预览 (Data Preview):</span>
                <span>{(exportedJsonStr.length / 1024).toFixed(1)} KB</span>
              </div>
              <textarea
                readOnly
                value={exportedJsonStr}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-400 font-mono focus:outline-none focus:border-orange-500/50 resize-none overflow-y-auto"
              />
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setShowExportModal(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors"
              >
                关闭 (Close)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 手机端/桌面端 菜品排序调整弹窗 Dish Sorting Modal */}
      {sortingCategoryId && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-3 sm:p-4 animate-fade-in"
          style={{ zIndex: 9999 }}
        >
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <ArrowUpDown size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    调整菜品顺序 (Dish Sorting)
                  </h3>
                  <p className="text-xs text-zinc-400">
                    分类:{" "}
                    <span className="text-amber-400 font-semibold">
                      {categories.find((c) => c.id === sortingCategoryId)?.name}
                    </span>{" "}
                    (共{" "}
                    {categories.find((c) => c.id === sortingCategoryId)?.items
                      ?.length || 0}{" "}
                    道菜)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSortingCategoryId(null)}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Subtitle / Tip */}
            <div className="px-4 py-2 bg-amber-500/5 border-b border-amber-500/10 text-[11px] text-amber-300 flex items-center justify-between">
              <span>
                💡 提示：点击 [置顶] 或 [↑/↓] 可调整菜品在手机点餐页的排列顺序
              </span>
            </div>

            {/* Dish List */}
            <div className="p-3 sm:p-4 space-y-2 overflow-y-auto custom-scrollbar flex-1">
              {(() => {
                const currentCat = categories.find(
                  (c) => c.id === sortingCategoryId,
                );
                const items = currentCat?.items || [];
                if (items.length === 0) {
                  return (
                    <div className="py-8 text-center text-zinc-500 text-sm">
                      暂无菜品
                    </div>
                  );
                }
                return items.map((item: any, idx: number) => (
                  <div
                    key={item.id}
                    className="p-2.5 bg-zinc-950 border border-zinc-800/80 rounded-xl flex items-center justify-between gap-2 hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Rank Index */}
                      <span className="w-6 h-6 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-mono font-bold text-amber-400 flex-shrink-0">
                        {idx + 1}
                      </span>
                      {/* Image */}
                      {item.image ? (
                        <img
                          src={item.image}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover bg-zinc-800 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-600 flex-shrink-0">
                          <ImageIcon size={16} />
                        </div>
                      )}
                      {/* Info */}
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-white truncate">
                          {item.title}
                        </span>
                        <span className="text-xs text-amber-400/90 font-mono font-medium">
                          {item.price}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons priority mobile */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() =>
                          handleMoveDish(sortingCategoryId, idx, "top")
                        }
                        className="px-2 py-1 text-[11px] font-medium bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500 hover:text-white disabled:opacity-20 rounded-lg transition-colors flex-shrink-0"
                        title="置顶 (Move to Top)"
                      >
                        置顶
                      </button>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() =>
                          handleMoveDish(sortingCategoryId, idx, "up")
                        }
                        className="p-1.5 text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-white disabled:opacity-20 rounded-lg transition-colors flex-shrink-0"
                        title="上移 (Move Up)"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === items.length - 1}
                        onClick={() =>
                          handleMoveDish(sortingCategoryId, idx, "down")
                        }
                        className="p-1.5 text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-white disabled:opacity-20 rounded-lg transition-colors flex-shrink-0"
                        title="下移 (Move Down)"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === items.length - 1}
                        onClick={() =>
                          handleMoveDish(sortingCategoryId, idx, "bottom")
                        }
                        className="px-2 py-1 text-[11px] font-medium bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-20 rounded-lg transition-colors flex-shrink-0"
                        title="置底 (Move to Bottom)"
                      >
                        置底
                      </button>
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSortingCategoryId(null)}
                className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-600/20"
              >
                完成排序 (Done)
              </button>
            </div>
          </div>
        </div>
      )}

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
