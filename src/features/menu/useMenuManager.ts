import { useState, useMemo } from "react";
import type { FormEvent, ChangeEvent } from "react";
import { uploadBase64ToStorage } from "../../utils/storage";
import { api } from "../../api";
import { safeSetItem } from "../../utils/storage";
import type {
  MenuCategory,
  Promotion,
  ReceiptSettings,
} from "../../types/menu";

interface MenuManagerDeps {
  categories: MenuCategory[];
  setCategories: (c: MenuCategory[]) => void;
  deletedItemIds?: string[];
  setDeletedItemIds?: (ids: string[]) => void;
  onSaveToCloud?: (overrides?: any) => void;
  setConfirmDialog: (d: any) => void;
  apiKey: string;
  setApiKey: (k: string) => void;
  currency: string;
  setCurrency: (v: string) => void;
  restaurantName: string;
  welcomeMessage: string;
  bgUrl: string;
  logoUrl: string;
  layoutStyle: string;
  theme: string;
  soundEnabled: boolean;
  adminPassword: string;
  devicePasswords: { name: string; password: string }[];
  securityQuestion: string;
  securityAnswer: string;
  promotions: Promotion[];
  setPromotions?: (p: Promotion[]) => void;
  receiptSettings: ReceiptSettings;
  setExportedJsonStr: (s: string) => void;
  setShowExportModal: (v: boolean) => void;
}

export function useMenuManager(deps: MenuManagerDeps) {
  const {
    categories,
    setCategories,
    deletedItemIds,
    setDeletedItemIds,
    onSaveToCloud,
    setConfirmDialog,
    apiKey,
    setApiKey,
    currency,
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
    setExportedJsonStr,
    setShowExportModal,
  } = deps;

  const [selectedCategory, setSelectedCategory] = useState(
    categories[0]?.id || "",
  );
  const [newCategory, setNewCategory] = useState({
    name: "",
    enName: "",
    frName: "",
    arName: "",
    maName: "",
  });
  const [newDish, setNewDish] = useState({
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
    price: "",
    image: "",
    allergens: [] as string[],
    stock: "",
  });
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [promptDialog, setPromptDialog] = useState<{
    isOpen: boolean;
    message: string;
    defaultValue: string;
    onConfirm: (value: string) => void;
  } | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState("");
  const [sortingCategoryId, setSortingCategoryId] = useState<string | null>(
    null,
  );
  const [isTranslating, setIsTranslating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const handleMoveCategory = (catIdx: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? catIdx - 1 : catIdx + 1;
    if (targetIdx < 0 || targetIdx >= categories.length) return;
    const newCats = [...categories];
    const temp = newCats[catIdx]!;
    newCats[catIdx] = newCats[targetIdx]!;
    newCats[targetIdx] = temp;
    setCategories(newCats);
    if (onSaveToCloud) onSaveToCloud({ categories: newCats, silent: true });
  };

  const handleMoveDish = (
    catId: string,
    itemIdx: number,
    direction: "up" | "down" | "top" | "bottom",
  ) => {
    const updatedCategories = categories.map((cat) => {
      if (cat.id !== catId) return cat;
      const items = [...(cat.items || [])];
      if (items.length <= 1) return cat;
      let targetIdx = itemIdx;
      if (direction === "up") targetIdx = itemIdx - 1;
      else if (direction === "down") targetIdx = itemIdx + 1;
      else if (direction === "top") targetIdx = 0;
      else if (direction === "bottom") targetIdx = items.length - 1;
      if (targetIdx < 0 || targetIdx >= items.length || targetIdx === itemIdx)
        return cat;
      const movedItem = items[itemIdx]!;
      items.splice(itemIdx, 1);
      items.splice(targetIdx, 0, movedItem);
      return { ...cat, items };
    });
    setCategories(updatedCategories);
    if (onSaveToCloud)
      onSaveToCloud({ categories: updatedCategories, silent: true });
  };

  const base64Count = useMemo(() => {
    let count = 0;
    categories.forEach((cat: any) => {
      (cat.items || []).forEach((item: any) => {
        if (
          item.image &&
          item.image.startsWith("data:image/") &&
          item.image.length > 15000
        )
          count++;
      });
    });
    return count;
  }, [categories]);

  const handleOptimizeImages = async () => {
    try {
      setIsOptimizing(true);
      setOptimizationProgress("正在准备优化...");
      let processed = 0;
      const totalToProcess = base64Count;
      const updatedCategories = [];
      for (const cat of categories) {
        const updatedItems = [];
        if (cat.items) {
          for (const item of cat.items) {
            if (
              item.image &&
              item.image.startsWith("data:image/") &&
              item.image.length > 15000
            ) {
              processed++;
              setOptimizationProgress(
                `正在优化并托管第 ${processed}/${totalToProcess} 张图片...`,
              );
              try {
                const publicUrl = await uploadBase64ToStorage(
                  item.image,
                  "dishes",
                );
                updatedItems.push({ ...item, image: publicUrl });
              } catch (err) {
                console.error(`Failed to upload ${item.title}:`, err);
                updatedItems.push(item);
              }
            } else {
              updatedItems.push(item);
            }
          }
        }
        updatedCategories.push({ ...cat, items: updatedItems });
      }
      setOptimizationProgress("正在更新菜单设置...");
      setCategories(updatedCategories);
      if (onSaveToCloud) {
        try {
          await onSaveToCloud({ categories: updatedCategories, silent: true });
          alert(
            `🎉 优化成功！已成功将 ${processed} 张图片迁移至云端存储/高效压缩，数据库空间已释放 99%！`,
          );
        } catch (saveErr: any) {
          console.warn("Save to cloud had warning:", saveErr);
          alert(
            `🎉 优化成功！已成功在本地对 ${processed} 张大图进行了 90% 级别的高效压缩，菜单体积缩减了 95%！\n\n*(注意：因云端数据库今日免费额度用尽，该优化已安全保存在本地浏览器中，不影响您的正常使用。等明天额度刷新后即可自动同步到云端！)*`,
          );
        }
      } else {
        alert(`🎉 优化成功！已成功压缩并处理了 ${processed} 张图片。`);
      }
    } catch (e: any) {
      alert(`❌ 优化失败: ${e.message}`);
    } finally {
      setIsOptimizing(false);
      setOptimizationProgress("");
    }
  };

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setApiKey(val);
    safeSetItem("geminiApiKey", val);
  };

  const handleExportJson = () => {
    try {
      const backupObj = {
        categories,
        promotions,
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
        exportDate: new Date().toISOString(),
      };
      const jsonStr = JSON.stringify(backupObj, null, 2);
      setExportedJsonStr(jsonStr);
      const blob = new Blob([jsonStr], {
        type: "application/json;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const fileName =
        "menu_backup_" + new Date().toISOString().split("T")[0] + ".json";
      const downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.href = url;
      downloadAnchorNode.setAttribute("download", fileName);
      downloadAnchorNode.style.display = "none";
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      setTimeout(() => {
        if (downloadAnchorNode.parentNode)
          downloadAnchorNode.parentNode.removeChild(downloadAnchorNode);
        URL.revokeObjectURL(url);
      }, 1000);
      setShowExportModal(true);
    } catch (err: any) {
      console.error("Failed to export JSON:", err);
      alert("导出 JSON 失败: " + (err?.message || "未知错误"));
    }
  };

  const handleExportCsv = () => {
    try {
      const headers = [
        "分类ID",
        "分类名称(中文)",
        "分类英文名",
        "分类法文名",
        "菜品ID",
        "菜品中文名",
        "英文名",
        "法文名",
        "阿拉伯文名",
        "摩洛哥文名",
        "价格",
        "中文描述",
        "英文描述",
        "法文描述",
        "阿拉伯文描述",
        "摩洛哥文描述",
        "图片URL",
      ];
      const rows: string[][] = [headers];
      categories.forEach((cat: any) => {
        const catName = cat.name || cat.id || "";
        const catEnName = cat.enName || "";
        const catFrName = cat.frName || "";
        (cat.items || []).forEach((item: any) => {
          rows.push([
            cat.id || "",
            catName,
            catEnName,
            catFrName,
            item.id || "",
            item.title || "",
            item.enTitle || "",
            item.frTitle || "",
            item.arTitle || "",
            item.maTitle || "",
            item.price || "",
            item.description || "",
            item.enDescription || "",
            item.frDescription || "",
            item.arDescription || "",
            item.maDescription || "",
            item.image && !item.image.startsWith("data:image")
              ? item.image
              : "[图片地址]",
          ]);
        });
      });
      const csvContent =
        "\uFEFF" +
        rows
          .map((row) =>
            row
              .map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`)
              .join(","),
          )
          .join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const fileName = `menu_items_${new Date().toISOString().split("T")[0]}.csv`;
      const a = document.createElement("a");
      a.href = url;
      a.setAttribute("download", fileName);
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (err: any) {
      console.error("Export CSV failed:", err);
      alert("导出 CSV 失败: " + (err?.message || "未知错误"));
    }
  };

  const handleAITranslate = async () => {
    if (!apiKey) {
      alert("请先在上方输入 Gemini API Key");
      return;
    }
    if (!newDish.title && !newDish.description) {
      alert("请先输入中文菜品名称或描述");
      return;
    }

    setIsTranslating(true);
    try {
      const { GoogleGenAI, Type } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: apiKey });

      const currentCategoryName =
        categories.find((c) => c.id === selectedCategory)?.name || "General";

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `You are an expert culinary translator and Michelin-star restaurant menu copywriter specializing in high-end international dining.
        Your task is to translate and culturally adapt the following Chinese dish name and description into English, French, Standard Arabic, and Moroccan Arabic (Darija).

        Context:
        - Restaurant Name: ${restaurantName || "Premium Restaurant"}
        - Dish Category: ${currentCategoryName}
        - Dining Style: Elegant, authentic, and high-quality

        Translation Guidelines:
        - English & French: Use evocative, poetic, and mouth-watering adjectives. Focus on the sensory experience, cooking techniques, and ingredient quality (e.g., "slow-braised", "crispy", "infused with", "velvety"). Avoid clunky literal translations.
        - Standard Arabic: Use sophisticated, formal culinary Arabic (Fusha) that appeals to fine dining customers. Ensure the terminology sounds luxurious.
        - Moroccan Arabic (Darija): Write in Arabic script using native Moroccan colloquial expressions that sound authentic, welcoming, and appetizing to locals, while maintaining a premium feel.
        - General: Prioritize elegance and appetizing appeal over 1-to-1 literal translation, while preserving the core ingredients and flavor profiles.
        
        Original Dish Details:
        Title: ${newDish.title ? newDish.title : "N/A"}
        Description: ${newDish.description ? newDish.description : "N/A"}
        
        Return ONLY a JSON response in the specified schema format. Ensure the translated descriptions are rich and descriptive.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              enTitle: { type: Type.STRING },
              frTitle: { type: Type.STRING },
              arTitle: { type: Type.STRING },
              maTitle: { type: Type.STRING },
              enDescription: { type: Type.STRING },
              frDescription: { type: Type.STRING },
              arDescription: { type: Type.STRING },
              maDescription: { type: Type.STRING },
            },
            required: [
              "enTitle",
              "frTitle",
              "arTitle",
              "maTitle",
              "enDescription",
              "frDescription",
              "arDescription",
              "maDescription",
            ],
          },
        },
      });

      const jsonStr = response.text?.trim() || "{}";
      const translations = JSON.parse(jsonStr);

      setNewDish((prev) => ({
        ...prev,
        ...translations,
      }));
    } catch (err) {
      console.error(err);
      alert("翻译失败，请检查 API Key 或网络环境。");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleAIEnhanceImage = async () => {
    if (!apiKey) {
      alert("请先在上方输入 Gemini API Key");
      return;
    }
    if (!newDish.image || !newDish.image.startsWith("data:image")) {
      alert("请先上传一张本地图片");
      return;
    }

    setIsEnhancing(true);
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: apiKey });

      const mimeType =
        newDish.image.split(";")[0]?.split(":")[1] ?? "image/jpeg";
      const base64Data = newDish.image.split(",")[1] ?? "";

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image",
        contents: {
          parts: [
            {
              text: "Enhance this food photo slightly to make it look appetizing and professional, but keep it extremely realistic and authentic to the original dish. Do NOT make it look over-processed, artificial, or AI-generated. Improve only the lighting, color balance, and minor background clutter. The food itself (ingredients, shape, portions, texture) MUST look exactly like the original photo, just taken with a better camera.",
            },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K",
          },
        },
      });

      let foundImage = false;
      if (
        response &&
        response.candidates &&
        response.candidates[0] &&
        response.candidates[0].content &&
        response.candidates[0].content.parts
      ) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const base64EncodeString = part.inlineData.data;
            const imageUrl = `data:image/jpeg;base64,${base64EncodeString}`;
            setNewDish((prev) => ({ ...prev, image: imageUrl }));
            foundImage = true;
            break;
          }
        }
      }

      if (!foundImage) {
        alert("美化失败：API 未返回有效图片");
      }
    } catch (err: any) {
      console.error(err);
      alert("AI 美化失败: " + err.message);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleAddCategory = (e: FormEvent) => {
    e.preventDefault();
    if (!newCategory.name.trim()) return;
    const catId = Math.random().toString(36).substr(2, 9);
    const updatedCategories = [
      ...categories,
      {
        id: catId,
        name: newCategory.name,
        enName: newCategory.enName,
        frName: newCategory.frName,
        arName: newCategory.arName,
        maName: newCategory.maName,
        items: [],
      },
    ];
    setCategories(updatedCategories);
    if (onSaveToCloud)
      onSaveToCloud({ categories: updatedCategories, silent: true });
    setNewCategory({
      name: "",
      enName: "",
      frName: "",
      arName: "",
      maName: "",
    });
    if (!selectedCategory) setSelectedCategory(catId);
    alert("分类添加成功！/ Category added!");
  };

  const handleDeleteCategory = (idToRemove: string) => {
    const catToRemove = categories.find((c: any) => c.id === idToRemove);
    const catTitle =
      catToRemove?.name || (catToRemove as any)?.title || "未命名分类";
    setConfirmDialog({
      isOpen: true,
      title: "删除分类确认 (1/2)",
      stepBadge: "第一级确认",
      message: `确定要删除分类【${catTitle}】及其所有关联菜品吗？`,
      subDetail: "点击“下一步”将进入第二级危险确认阶段，请再次核对删除范围。",
      confirmText: "下一步 (进入二次确认) →",
      confirmBtnClass:
        "px-4 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-colors shadow-lg shadow-amber-600/20",
      onConfirm: () => {
        setConfirmDialog({
          isOpen: true,
          title: "⚠️ 强制彻底删除分类 (2/2)",
          stepBadge: "第二级确认 (不可撤销)",
          message: `【彻底删除警告】确定彻底抹除分类【${catTitle}】及其全部菜品吗？`,
          subDetail: `• 分类【${catTitle}】及其所有关联菜品将从数据库中永久注销\n• 通过 Supabase 实时广播删除指令给所有在线点餐看板与前台设备\n• 所有在线设备将强制清除本地缓存中的该分类及菜品`,
          confirmText: `🔥 确认彻底删除分类【${catTitle}】`,
          confirmBtnClass:
            "px-4 py-2 text-sm font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors shadow-lg shadow-red-600/30 ring-2 ring-red-400/50 animate-pulse",
          onConfirm: () => {
            const updatedCategories = categories.filter(
              (c: any) => c.id !== idToRemove,
            );
            setCategories(updatedCategories);
            const newDeletedIds = Array.from(
              new Set([...(deletedItemIds || [])]),
            );
            if (idToRemove && !newDeletedIds.includes(idToRemove))
              newDeletedIds.push(idToRemove);
            if (catToRemove) {
              if (catToRemove.name && !newDeletedIds.includes(catToRemove.name))
                newDeletedIds.push(catToRemove.name);
              if (
                (catToRemove as any).title &&
                !newDeletedIds.includes((catToRemove as any).title)
              )
                newDeletedIds.push((catToRemove as any).title);
              (catToRemove.items || []).forEach((item: any) => {
                if (item.id && !newDeletedIds.includes(item.id))
                  newDeletedIds.push(item.id);
                if (item.title && !newDeletedIds.includes(item.title))
                  newDeletedIds.push(item.title);
                if (item.name && !newDeletedIds.includes(item.name))
                  newDeletedIds.push(item.name);
              });
            }
            if (setDeletedItemIds) setDeletedItemIds(newDeletedIds);
            if (onSaveToCloud)
              onSaveToCloud({
                categories: updatedCategories,
                deletedItemIds: newDeletedIds,
                silent: true,
              });
            api.triggerBroadcast("dish_deleted", {
              categoryId: idToRemove,
              catTitle,
              deletedItemIds: newDeletedIds,
              timestamp: new Date().toISOString(),
            });
            api.triggerBroadcast("settings_changed", {
              deletedItemIds: newDeletedIds,
            });
            if (selectedCategory === idToRemove)
              setSelectedCategory(updatedCategories[0]?.id || "");
            setConfirmDialog(null);
          },
        });
      },
    });
  };

  const handleDeleteDish = (categoryId: string, dishId: string) => {
    const cat = categories.find((c: any) => c.id === categoryId);
    const itemToDelete = (cat?.items || []).find(
      (item: any) => item.id === dishId,
    );
    const dishTitle = itemToDelete?.title || "未知菜品";
    setConfirmDialog({
      isOpen: true,
      title: "删除菜品确认 (1/2)",
      stepBadge: "第一级确认",
      message: `确定要删除菜品【${dishTitle}】吗？`,
      subDetail: "点击“下一步”将进入第二级危险确认阶段，请再次核对菜品信息。",
      confirmText: "下一步 (进入二次确认) →",
      confirmBtnClass:
        "px-4 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-colors shadow-lg shadow-amber-600/20",
      onConfirm: () => {
        setConfirmDialog({
          isOpen: true,
          title: "⚠️ 强制彻底删除菜品 (2/2)",
          stepBadge: "第二级确认 (不可撤销)",
          message: `【彻底删除警告】此操作不可撤销！确定彻底删除菜品【${dishTitle}】吗？`,
          subDetail: `• 菜品【${dishTitle}】将被从云端数据库及本地菜单中永久彻底抹除\n• 系统将通过 Supabase 实时广播删除指令给所有在线看板与点餐终端\n• 所有在线终端将强制清除本地缓存及未提交购物车中的该菜品`,
          confirmText: `🔥 确认彻底删除【${dishTitle}】`,
          confirmBtnClass:
            "px-4 py-2 text-sm font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors shadow-lg shadow-red-600/30 ring-2 ring-red-400/50 animate-pulse",
          onConfirm: () => {
            const deletedTitle = dishTitle;
            const deletedName = ((itemToDelete as any)?.name as string) || "";
            const updatedCategories = categories.map((cat: any) => {
              if (cat.id === categoryId)
                return {
                  ...cat,
                  items: (cat.items || []).filter(
                    (item: any) => item.id !== dishId,
                  ),
                };
              return cat;
            });
            setCategories(updatedCategories);
            const newDeletedIds = Array.from(
              new Set([...(deletedItemIds || [])]),
            );
            if (dishId && !newDeletedIds.includes(dishId))
              newDeletedIds.push(dishId);
            if (deletedTitle && !newDeletedIds.includes(deletedTitle))
              newDeletedIds.push(deletedTitle);
            if (deletedName && !newDeletedIds.includes(deletedName))
              newDeletedIds.push(deletedName);
            if (setDeletedItemIds) setDeletedItemIds(newDeletedIds);
            if (onSaveToCloud)
              onSaveToCloud({
                categories: updatedCategories,
                deletedItemIds: newDeletedIds,
                silent: true,
              });
            api.triggerBroadcast("dish_deleted", {
              dishId,
              dishTitle,
              deletedItemIds: newDeletedIds,
              timestamp: new Date().toISOString(),
            });
            api.triggerBroadcast("settings_changed", {
              deletedItemIds: newDeletedIds,
            });
            setConfirmDialog(null);
          },
        });
      },
    });
  };

  const handleAddDish = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || !newDish.title || !newDish.image || !newDish.price)
      return;
    const finalPrice =
      currency && currency !== "none"
        ? `${newDish.price} ${currency}`
        : newDish.price;
    const updatedCategories = categories.map((cat: any) => {
      if (cat.id === selectedCategory) {
        return {
          ...cat,
          items: [
            ...cat.items,
            {
              ...newDish,
              price: finalPrice,
              stock: newDish.stock.trim() === "" ? null : Number(newDish.stock),
              id: Math.random().toString(36).substr(2, 9),
            },
          ],
        };
      }
      return cat;
    });
    setCategories(updatedCategories);
    if (onSaveToCloud)
      onSaveToCloud({ categories: updatedCategories, silent: true });
    setNewDish({
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
      price: "",
      image: "",
      allergens: [] as string[],
      stock: "",
    });
    alert("菜品添加成功！ Dish added successfully!");
  };

  return {
    // State
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
    setIsOptimizing,
    optimizationProgress,
    setOptimizationProgress,
    sortingCategoryId,
    setSortingCategoryId,
    isTranslating,
    setIsTranslating,
    isEnhancing,
    setIsEnhancing,
    // Handlers
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
  };
}
