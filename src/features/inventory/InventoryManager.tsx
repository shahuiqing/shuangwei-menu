import React, { useState, useEffect } from "react";
import {
  Boxes,
  Package,
  Plus,
  Trash2,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  Database,
  Search,
  SlidersHorizontal,
  Flame,
  ArrowDownRight,
  Sparkles,
  FileCode,
  Zap,
  ChevronRight,
  Info
} from "lucide-react";
import { api, DEFAULT_INVENTORY_ITEMS, DEFAULT_RECIPE_BOMS } from "../../api";
import { isSupabaseConfigured, isSupabaseHealthy } from "../../supabase";
import { SupabaseSetupModal } from "../../components/SupabaseSetupModal";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  safety_stock: number;
  price: number;
  updated_at?: string;
}

interface RecipeBom {
  id: string;
  menu_item_name: string;
  inventory_item_id: string;
  dosage: number;
  unit: string;
}

interface InventoryManagerProps {
  menuCategories: any[];
  onUpdateCategories?: (cats: any[]) => void;
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  menuCategories,
  onUpdateCategories
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"items" | "boms" | "sync">("items");
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [boms, setBoms] = useState<RecipeBom[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string>("");

  // Modals state
  const [isItemModalOpen, setIsItemModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemForm, setItemForm] = useState({
    id: "",
    name: "",
    category: "常规物料",
    stock: "10",
    unit: "kg",
    safety_stock: "2",
    price: "0"
  });

  const [isBomModalOpen, setIsBomModalOpen] = useState<boolean>(false);
  const [editingBom, setEditingBom] = useState<RecipeBom | null>(null);
  const [bomForm, setBomForm] = useState({
    id: "",
    menu_item_name: "",
    inventory_item_id: "",
    dosage: "0.1",
    unit: "kg"
  });

  // Stock Adjust Modal
  const [stockModalItem, setStockModalItem] = useState<InventoryItem | null>(null);
  const [stockDelta, setStockDelta] = useState<string>("");

  // Test Order Simulation state
  const [testDishName, setTestDishName] = useState<string>("");
  const [testQty, setTestQty] = useState<number>(1);
  const [simResult, setSimResult] = useState<string>("");

  const loadData = async () => {
    setLoading(true);
    try {
      const invData = await api.getInventoryItems();
      const bomData = await api.getRecipeBoms();
      setInventory(invData || []);
      setBoms(bomData || []);
    } catch (e) {
      console.error("Failed to load inventory:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = api.subscribeToInventory(() => {
      loadData();
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Extract all dishes list from current menu categories
  const allDishes = React.useMemo(() => {
    const list: string[] = [];
    menuCategories.forEach((cat) => {
      if (cat.items && Array.isArray(cat.items)) {
        cat.items.forEach((item: any) => {
          const name = item.title || item.name;
          if (name && !list.includes(name)) {
            list.push(name);
          }
        });
      }
    });
    return list;
  }, [menuCategories]);

  // Inventory categories
  const inventoryCategories = React.useMemo(() => {
    const cats = new Set<string>();
    inventory.forEach((i) => cats.add(i.category || "常规物料"));
    return Array.from(cats);
  }, [inventory]);

  // Filtered inventory
  const filteredInventory = React.useMemo(() => {
    return inventory.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat =
        selectedCategoryFilter === "ALL" || item.category === selectedCategoryFilter;
      const matchesLowStock =
        selectedCategoryFilter === "LOW_STOCK" ? item.stock <= item.safety_stock : true;
      return matchesSearch && matchesCat && matchesLowStock;
    });
  }, [inventory, searchQuery, selectedCategoryFilter]);

  // Summary Metrics
  const lowStockCount = inventory.filter((i) => Number(i.stock) <= Number(i.safety_stock)).length;
  const outOfStockCount = inventory.filter((i) => Number(i.stock) <= 0).length;
  const totalValue = inventory.reduce(
    (sum, i) => sum + Number(i.stock || 0) * Number(i.price || 0),
    0
  );

  const handleOpenItemModal = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item);
      setItemForm({
        id: item.id,
        name: item.name,
        category: item.category || "常规物料",
        stock: String(item.stock),
        unit: item.unit || "kg",
        safety_stock: String(item.safety_stock),
        price: String(item.price || 0)
      });
    } else {
      setEditingItem(null);
      setItemForm({
        id: `INV-${Math.floor(100 + Math.random() * 900)}`,
        name: "",
        category: "常规物料",
        stock: "10",
        unit: "kg",
        safety_stock: "2",
        price: "0"
      });
    }
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.name.trim()) return;

    const newItem: InventoryItem = {
      id: itemForm.id.trim() || `INV-${Date.now()}`,
      name: itemForm.name.trim(),
      category: itemForm.category.trim() || "常规物料",
      stock: parseFloat(itemForm.stock) || 0,
      unit: itemForm.unit.trim() || "kg",
      safety_stock: parseFloat(itemForm.safety_stock) || 0,
      price: parseFloat(itemForm.price) || 0,
      updated_at: new Date().toISOString()
    };

    await api.saveInventoryItem(newItem);
    setIsItemModalOpen(false);
    loadData();
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (window.confirm(`确定删除原材料物料【${name}】吗？`)) {
      await api.deleteInventoryItem(id);
      loadData();
    }
  };

  const handleOpenStockModal = (item: InventoryItem) => {
    setStockModalItem(item);
    setStockDelta("");
  };

  const handleAdjustStock = async (deltaValue: number) => {
    if (!stockModalItem) return;
    const newStock = Math.max(0, Number((stockModalItem.stock + deltaValue).toFixed(2)));
    await api.saveInventoryItem({
      ...stockModalItem,
      stock: newStock
    });
    setStockModalItem(null);
    loadData();
  };

  const handleOpenBomModal = (bom?: RecipeBom) => {
    if (bom) {
      setEditingBom(bom);
      setBomForm({
        id: bom.id,
        menu_item_name: bom.menu_item_name,
        inventory_item_id: bom.inventory_item_id,
        dosage: String(bom.dosage),
        unit: bom.unit || "kg"
      });
    } else {
      setEditingBom(null);
      setBomForm({
        id: "",
        menu_item_name: allDishes[0] || "干饺 (大份)",
        inventory_item_id: inventory[0]?.id || "INV-101",
        dosage: "0.2",
        unit: inventory[0]?.unit || "kg"
      });
    }
    setIsBomModalOpen(true);
  };

  const handleSaveBom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bomForm.menu_item_name || !bomForm.inventory_item_id) return;

    const selectedInv = inventory.find((i) => i.id === bomForm.inventory_item_id);

    const newBom: RecipeBom = {
      id: bomForm.id || `BOM-${Math.random().toString(36).substring(2, 8)}`,
      menu_item_name: bomForm.menu_item_name,
      inventory_item_id: bomForm.inventory_item_id,
      dosage: parseFloat(bomForm.dosage) || 0.1,
      unit: bomForm.unit || selectedInv?.unit || "kg"
    };

    await api.saveRecipeBom(newBom);
    setIsBomModalOpen(false);
    loadData();
  };

  const handleDeleteBom = async (id: string) => {
    if (window.confirm("确定删除该 BOM 扣减配方吗？")) {
      await api.deleteRecipeBom(id);
      loadData();
    }
  };

  const handleSimulateOrderDeduction = async () => {
    if (!testDishName) {
      setSimResult("请先选择模拟菜品！");
      return;
    }
    setSimResult("正在模拟下单并扣减原材料库存...");
    await api.deductInventoryForOrderItems([{ title: testDishName, quantity: testQty }]);
    await loadData();
    setSimResult(`✅ 成功模拟下单【${testDishName}】${testQty} 份！BOM 原材料存量已自动完成扣减。`);
  };

  const handleOneClickSyncSupabase = async () => {
    setSyncing(true);
    setSyncMessage("正在向 Supabase 云数据库双向同步菜品分类与库存...");
    try {
      // 1. Sync Categories and Menu Items
      await api.syncCategoriesAndMenuItemsToSupabase(menuCategories);

      // 2. Upload default inventory if empty
      for (const item of DEFAULT_INVENTORY_ITEMS) {
        await api.saveInventoryItem(item);
      }
      for (const bom of DEFAULT_RECIPE_BOMS) {
        await api.saveRecipeBom(bom);
      }

      await loadData();
      setSyncMessage("🎉 成功！菜单分类、菜品、原材料物料及 BOM 配方已全量同步至 Supabase！");
    } catch (err: any) {
      setSyncMessage(`❌ 同步出现错误: ${err.message || String(err)}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleCopySqlScript = () => {
    const sqlText = `-- ======================================================================
-- 餐饮点餐系统 (Customer Menu) + POS 后厨管理 + 库存管理系统 (Inventory POS)
-- 共用 Supabase 数据库统一初始化 SQL 脚本 (supabase_schema.sql)
-- ======================================================================

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  image_url TEXT,
  description TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id VARCHAR(100) PRIMARY KEY,
  _id VARCHAR(100),
  table_no VARCHAR(50) NOT NULL DEFAULT 'A1',
  customer_name VARCHAR(100),
  type VARCHAR(20) DEFAULT 'dine_in',
  status VARCHAR(20) DEFAULT 'pending',
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total DECIMAL(10, 2) DEFAULT 0,
  items JSONB DEFAULT '[]'::jsonb,
  notes TEXT DEFAULT '',
  "unprintedNewOrder" BOOLEAN DEFAULT false,
  "unprintedAdditions" JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id VARCHAR(100) REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT '常规物料',
  stock DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  safety_stock DECIMAL(10, 2) NOT NULL DEFAULT 5,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.recipe_boms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_name VARCHAR(100) NOT NULL,
  inventory_item_id VARCHAR(50) REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  dosage DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg'
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id VARCHAR(100) PRIMARY KEY,
  supplier VARCHAR(100) DEFAULT '',
  item_id VARCHAR(50) NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id VARCHAR(100) PRIMARY KEY,
  item_id VARCHAR(50) NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'adjustment'
    CHECK (type IN ('purchase_in', 'order_out', 'adjustment', 'waste')),
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  unit_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  reference VARCHAR(200) DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    categories JSONB DEFAULT '[]'::jsonb,
    promotions JSONB DEFAULT '[]'::jsonb,
    "bgUrl" TEXT DEFAULT '',
    "restaurantName" TEXT DEFAULT '',
    "welcomeMessage" TEXT DEFAULT '',
    "logoUrl" TEXT DEFAULT '',
    "adminPassword" TEXT DEFAULT 'admin123',
    "devicePasswords" JSONB DEFAULT '[]'::jsonb,
    "soundEnabled" BOOLEAN DEFAULT true,
    "layoutStyle" TEXT DEFAULT 'grid'
);
INSERT INTO public.settings (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_boms DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recipe_boms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
`;
    navigator.clipboard.writeText(sqlText);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  // Group BOMs by dish name
  const bomsByDish = React.useMemo<Record<string, RecipeBom[]>>(() => {
    const map: Record<string, RecipeBom[]> = {};
    boms.forEach((b) => {
      const dish = b.menu_item_name || "未定义菜品";
      if (!map[dish]) map[dish] = [];
      map[dish].push(b);
    });
    return map;
  }, [boms]);

  return (
    <div className="space-y-6 text-zinc-100">
      {/* Top Banner & Supabase Connection Status */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-orange-950/30 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500">
                <Boxes size={24} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  双程序 Supabase 数据库与 BOM 库存联控系统
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400">
                  共享云数据库架构：支持顾客前端点餐、POS后厨实时接单、BOM食材库配方自动扣减与超低报警
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsSupabaseModalOpen(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border hover:opacity-80 transition-all ${
                isSupabaseConfigured && isSupabaseHealthy
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              }`}
              title="点击配置/切换 Supabase 云端连接凭证"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isSupabaseConfigured && isSupabaseHealthy
                    ? "bg-green-500 animate-pulse"
                    : "bg-amber-500"
                }`}
              />
              {isSupabaseConfigured && isSupabaseHealthy
                ? "Supabase 实时网络通道正常"
                : "设置 Supabase 云端同步 ⚡"}
            </button>

            <button
              onClick={loadData}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors"
              title="刷新库存与配方"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3.5">
            <span className="text-xs text-zinc-400 block mb-1">物料品种总量</span>
            <div className="text-xl sm:text-2xl font-bold text-white flex items-center justify-between">
              <span>{inventory.length}</span>
              <Package size={18} className="text-zinc-500" />
            </div>
          </div>

          <div
            onClick={() => setSelectedCategoryFilter("LOW_STOCK")}
            className="bg-zinc-950/60 border border-amber-500/30 rounded-xl p-3.5 cursor-pointer hover:border-amber-500/60 transition-colors"
          >
            <span className="text-xs text-amber-400 block mb-1">库存预警物料</span>
            <div className="text-xl sm:text-2xl font-bold text-amber-400 flex items-center justify-between">
              <span>{lowStockCount}</span>
              <AlertTriangle size={18} className="text-amber-500" />
            </div>
          </div>

          <div className="bg-zinc-950/60 border border-red-500/30 rounded-xl p-3.5">
            <span className="text-xs text-red-400 block mb-1">已用尽/估清物料</span>
            <div className="text-xl sm:text-2xl font-bold text-red-400 flex items-center justify-between">
              <span>{outOfStockCount}</span>
              <Flame size={18} className="text-red-500" />
            </div>
          </div>

          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3.5">
            <span className="text-xs text-zinc-400 block mb-1">BOM 扣减配方</span>
            <div className="text-xl sm:text-2xl font-bold text-orange-400 flex items-center justify-between">
              <span>{boms.length}</span>
              <Zap size={18} className="text-orange-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex border-b border-zinc-800 space-x-2 pb-2">
        <button
          onClick={() => setActiveSubTab("items")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeSubTab === "items"
              ? "bg-orange-600 text-white shadow-lg shadow-orange-600/20"
              : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
        >
          <Package size={16} />
          原材料物料库存管理 (inventory_items)
        </button>

        <button
          onClick={() => setActiveSubTab("boms")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeSubTab === "boms"
              ? "bg-orange-600 text-white shadow-lg shadow-orange-600/20"
              : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
        >
          <Zap size={16} />
          菜品-食材 BOM 配方关联 (recipe_boms)
        </button>

        <button
          onClick={() => setActiveSubTab("sync")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeSubTab === "sync"
              ? "bg-orange-600 text-white shadow-lg shadow-orange-600/20"
              : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
        >
          <Database size={16} />
          Supabase 架构与 SQL 工具 (Shared DB)
        </button>
      </div>

      {/* SUB-TAB 1: INVENTORY ITEMS */}
      {activeSubTab === "items" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                />
                <input
                  type="text"
                  placeholder="搜索物料名称或编号..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-orange-500"
              >
                <option value="ALL">全部分类 ({inventory.length})</option>
                <option value="LOW_STOCK">⚠️ 预警物料 ({lowStockCount})</option>
                {inventoryCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleOpenItemModal()}
              className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors shrink-0"
            >
              <Plus size={16} />
              添加新物料            </button>
          </div>

          {/* Inventory Table */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden custom-scrollbar">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-zinc-950 text-xs uppercase text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="py-3.5 px-4">物料编号 / 名称</th>
                    <th className="py-3.5 px-4">分类</th>
                    <th className="py-3.5 px-4 text-right">当前可用库存</th>
                    <th className="py-3.5 px-4 text-right">预警安全存量</th>
                    <th className="py-3.5 px-4 text-right">物料参考单价</th>
                    <th className="py-3.5 px-4 text-center">状态</th>
                    <th className="py-3.5 px-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredInventory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-500">
                        暂无符合条件的物料记录。点击【添加新物料】开始创建！
                      </td>
                    </tr>
                  ) : (
                    filteredInventory.map((item) => {
                      const isLow = Number(item.stock) <= Number(item.safety_stock);
                      const isOut = Number(item.stock) <= 0;

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-zinc-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-white flex items-center gap-2">
                              <span>{item.name}</span>
                            </div>
                            <span className="text-xs font-mono text-zinc-500">
                              {item.id}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="bg-zinc-800 text-zinc-300 text-xs px-2.5 py-1 rounded-full border border-zinc-700/50">
                              {item.category || "常规物料"}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-bold text-base">
                            <span
                              className={
                                isOut
                                  ? "text-red-400"
                                  : isLow
                                  ? "text-amber-400"
                                  : "text-green-400"
                              }
                            >
                              {item.stock} {item.unit}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono text-zinc-400">
                            {item.safety_stock} {item.unit}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono text-zinc-300">
                            MAD {item.price || 0} / {item.unit}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {isOut ? (
                              <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-400 border border-red-500/20 text-xs px-2.5 py-1 rounded-full font-medium">
                                <AlertTriangle size={12} />
                                已用尽 (关联菜品估清)
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs px-2.5 py-1 rounded-full font-medium">
                                <AlertTriangle size={12} />
                                库存预警
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-green-500/10 text-green-400 border border-green-500/20 text-xs px-2.5 py-1 rounded-full font-medium">
                                <CheckCircle2 size={12} />
                                充足
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenStockModal(item)}
                                className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-orange-400 rounded-lg text-xs font-semibold border border-zinc-700 transition-colors"
                                title="增减库存"
                              >
                                调库存                              </button>

                              <button
                                onClick={() => handleOpenItemModal(item)}
                                className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
                                title="编辑物料"
                              >
                                <Edit3 size={14} />
                              </button>

                              <button
                                onClick={() => handleDeleteItem(item.id, item.name)}
                                className="p-1.5 bg-zinc-800 hover:bg-red-900/40 text-red-400 rounded-lg transition-colors"
                                title="删除物料"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: RECIPE BOMS */}
      {activeSubTab === "boms" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-zinc-900/80 p-4 rounded-xl border border-zinc-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Zap size={18} className="text-orange-500" />
                菜品与原材料 BOM 扣减配方规则表              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                当顾客在前台或小程序购买某菜品时，系统自动按照本表格定义的消耗剂量自动扣减相应原材料物料库存。              </p>
            </div>

            <button
              onClick={() => handleOpenBomModal()}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors shrink-0"
            >
              <Plus size={16} />
              绑定新配方            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.keys(bomsByDish).length === 0 ? (
              <div className="col-span-full py-12 text-center text-zinc-500 bg-zinc-900/40 rounded-2xl border border-zinc-800">
                暂无配方数据，点击【绑定新配方】为菜品（如干饺 (大份)、煎饺 (大份)、火锅底料）绑定原料消耗公式！
              </div>
            ) : (
              (Object.entries(bomsByDish) as [string, RecipeBom[]][]).map(([dishName, dishBoms]) => (
                <div
                  key={dishName}
                  className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 space-y-3 hover:border-zinc-700 transition-all shadow-md"
                >
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                    <h4 className="font-bold text-white text-base flex items-center gap-2">
                      <Flame size={16} className="text-orange-500" />
                      {dishName}
                    </h4>
                    <span className="text-xs bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/20 font-medium">
                      含 {dishBoms.length} 项主配方
                    </span>
                  </div>

                  <div className="space-y-2">
                    {dishBoms.map((b) => {
                      const inv = inventory.find((i) => i.id === b.inventory_item_id);
                      return (
                        <div
                          key={b.id}
                          className="flex items-center justify-between bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/80 text-xs"
                        >
                          <div>
                            <span className="font-semibold text-zinc-200 block">
                              {inv?.name || b.inventory_item_id}
                            </span>
                            <span className="text-zinc-500 font-mono">
                              每份消耗: {b.dosage} {b.unit}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenBomModal(b)}
                              className="p-1 text-zinc-400 hover:text-white"
                              title="编辑剂量"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteBom(b.id)}
                              className="p-1 text-zinc-400 hover:text-red-400"
                              title="解绑原料"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Test Simulation Box */}
          <div className="bg-gradient-to-r from-orange-950/20 via-zinc-900 to-zinc-900 border border-orange-500/30 rounded-2xl p-5 space-y-3">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <Sparkles size={16} className="text-orange-400" />
              前后台模拟下单自动扣减实验工具 (BOM Auto-Deduction Tester)
            </h4>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <select
                value={testDishName}
                onChange={(e) => setTestDishName(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 flex-1 w-full"
              >
                <option value="">-- 选择需测试下单的菜品 --</option>
                {allDishes.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">数量:</span>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={testQty}
                  onChange={(e) => setTestQty(Number(e.target.value))}
                  className="w-20 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white font-mono text-center"
                />
              </div>

              <button
                onClick={handleSimulateOrderDeduction}
                className="w-full sm:w-auto bg-orange-600 hover:bg-orange-500 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors shrink-0"
              >
                模拟触发下单扣减
              </button>
            </div>

            {simResult && (
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-orange-300 font-mono">
                {simResult}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: SUPABASE SYNC & SQL */}
      {activeSubTab === "sync" && (
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Database size={20} className="text-orange-500" />
                  Supabase 数据库创建 SQL (supabase_schema.sql)
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  将下方的 SQL 脚本复制并在您的 Supabase 后台 SQL Editor 中运行，即可完成两端程序的统一建表！                </p>
              </div>

              <button
                onClick={handleCopySqlScript}
                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors shrink-0"
              >
                {copiedSql ? <Check size={16} /> : <Copy size={16} />}
                {copiedSql ? "已复制 SQL 脚本" : "一键复制 SQL 脚本"}
              </button>
            </div>

            <div className="relative">
              <pre className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs font-mono text-zinc-300 overflow-x-auto max-h-80 custom-scrollbar">
                {`-- 1. 菜单分类表
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 菜单菜品表 (菜单程序 & POS管理系统共用)
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  image_url TEXT,
  description TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 实时订单表 (orders)
CREATE TABLE IF NOT EXISTS public.orders (
  id VARCHAR(100) PRIMARY KEY,
  _id VARCHAR(100),
  table_no VARCHAR(50) NOT NULL DEFAULT 'A1',
  customer_name VARCHAR(100),
  type VARCHAR(20) DEFAULT 'dine_in',
  status VARCHAR(20) DEFAULT 'pending',
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  items JSONB DEFAULT '[]'::jsonb,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 订单明细表 (order_items)
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id VARCHAR(100) REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id),
  name VARCHAR(100) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0
);

-- 5. 原材料库存物料表 (inventory_items)
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT '常规物料',
  stock DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  safety_stock DECIMAL(10, 2) NOT NULL DEFAULT 5,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 菜品-食材配方关联表 (recipe_boms)
CREATE TABLE IF NOT EXISTS public.recipe_boms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_name VARCHAR(100) NOT NULL,
  inventory_item_id VARCHAR(50) REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  dosage DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg'
);

-- 7. 采购记录表 (purchase_orders) - 经营盈亏/采购管理
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id VARCHAR(100) PRIMARY KEY,
  supplier VARCHAR(100) DEFAULT '',
  item_id VARCHAR(50) NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 库存流水表 (inventory_transactions) - 损耗测算
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id VARCHAR(100) PRIMARY KEY,
  item_id VARCHAR(50) NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'adjustment'
    CHECK (type IN ('purchase_in', 'order_out', 'adjustment', 'waste')),
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  unit_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  reference VARCHAR(200) DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recipe_boms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;`}
              </pre>
            </div>

            <div className="pt-2 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-zinc-400 flex items-center gap-2">
                <Info size={14} className="text-orange-400" />
                点击下方按钮可自动将当前菜单及默认 BOM 原材料推送初始化到 Supabase 中：
              </div>

              <button
                onClick={handleOneClickSyncSupabase}
                disabled={syncing}
                className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-colors shrink-0 disabled:opacity-50"
              >
                <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
                一键推送与同步数据至 Supabase
              </button>
            </div>

            {syncMessage && (
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-green-400 font-mono">
                {syncMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ITEM ADD / EDIT */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              {editingItem ? "编辑原材料物料" : "添加新原材料物料"}
            </h3>

            <form onSubmit={handleSaveItem} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">物料编号 (ID)</label>
                <input
                  type="text"
                  required
                  value={itemForm.id}
                  disabled={!!editingItem}
                  onChange={(e) => setItemForm({ ...itemForm, id: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">物料名称</label>
                <input
                  type="text"
                  required
                  placeholder="如：牛肉馅、朝天椒、高汤"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">物料分类</label>
                  <input
                    type="text"
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 block mb-1">计量单位</label>
                  <input
                    type="text"
                    value={itemForm.unit}
                    onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                    placeholder="kg, L, 份, 包"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">初始/可用存量</label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemForm.stock}
                    onChange={(e) => setItemForm({ ...itemForm, stock: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 block mb-1">预警存量阈值</label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemForm.safety_stock}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, safety_stock: e.target.value })
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 block mb-1">单价 (MAD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemForm.price}
                    onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl text-sm"
                >
                  保存保存物料
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BOM ADD / EDIT */}
      {isBomModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              {editingBom ? "编辑 BOM 配方规则" : "绑定菜品与原材料配方"}
            </h3>

            <form onSubmit={handleSaveBom} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">选择对应菜品</label>
                <select
                  value={bomForm.menu_item_name}
                  onChange={(e) => setBomForm({ ...bomForm, menu_item_name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                >
                  {allDishes.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">消耗的原材料物料</label>
                <select
                  value={bomForm.inventory_item_id}
                  onChange={(e) => {
                    const selected = inventory.find((i) => i.id === e.target.value);
                    setBomForm({
                      ...bomForm,
                      inventory_item_id: e.target.value,
                      unit: selected?.unit || bomForm.unit
                    });
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                >
                  {inventory.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.id}) - 库存 {i.stock} {i.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">每份消耗剂量</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={bomForm.dosage}
                    onChange={(e) => setBomForm({ ...bomForm, dosage: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 block mb-1">单位</label>
                  <input
                    type="text"
                    value={bomForm.unit}
                    onChange={(e) => setBomForm({ ...bomForm, unit: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsBomModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl text-sm"
                >
                  保存配方规则
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: QUICK STOCK ADJUSTMENT */}
      {stockModalItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Package size={18} className="text-orange-500" />
              快捷调整【{stockModalItem.name}】存量            </h3>

            <p className="text-xs text-zinc-400">
              当前存量: <span className="font-bold text-white">{stockModalItem.stock} {stockModalItem.unit}</span>
            </p>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleAdjustStock(1)}
                className="py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold"
              >
                +1 {stockModalItem.unit}
              </button>
              <button
                onClick={() => handleAdjustStock(5)}
                className="py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold"
              >
                +5 {stockModalItem.unit}
              </button>
              <button
                onClick={() => handleAdjustStock(10)}
                className="py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold"
              >
                +10 {stockModalItem.unit}
              </button>
            </div>

            <div className="space-y-2 pt-2 border-t border-zinc-800">
              <label className="text-xs text-zinc-400 block">自定义设为绝对存量值:</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="输入具体数字"
                  value={stockDelta}
                  onChange={(e) => setStockDelta(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white flex-1 focus:outline-none focus:border-orange-500"
                />
                <button
                  onClick={async () => {
                    const num = parseFloat(stockDelta);
                    if (!isNaN(num) && num >= 0) {
                      await api.saveInventoryItem({
                        ...stockModalItem,
                        stock: num
                      });
                      setStockModalItem(null);
                      loadData();
                    }
                  }}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl text-sm"
                >
                  一键同步                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setStockModalItem(null)}
                className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-xl text-xs"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUPABASE SETUP MODAL */}
      <SupabaseSetupModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onSuccess={() => loadData()}
      />
    </div>
  );
};
