export interface InventoryItem {
  id: string; // e.g. INV-101
  name: string;
  category: string;
  stock: number;
  unit: string; // kg, L, pcs
  safety_stock: number;
  price: number;
  updated_at: string; // ISO
}

export interface RecipeBom {
  id: string; // BOM-101
  menu_item_name: string; // FK by name (legacy)
  inventory_item_id: string; // FK to inventory_items.id
  dosage: number;
  unit: string;
}

export interface TableQr {
  tableNo: string; // PK
  key: string;
  active: boolean;
  createdAt: string;
}

// 采购记录
export interface PurchaseOrder {
  id: string;
  supplier: string;
  item_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_cost: number;
  purchased_at: string;
  notes?: string;
  created_at?: string;
}

// 库存流水
export interface InventoryTransaction {
  id: string;
  item_id: string;
  item_name: string;
  type: 'purchase_in' | 'order_out' | 'adjustment' | 'waste';
  quantity: number;
  unit: string;
  unit_cost: number;
  reference?: string;
  notes?: string;
  created_at: string;
}

// 每日盈亏汇总
export interface DailySummary {
  date: string; // YYYY-MM-DD
  revenue: number;
  food_cost: number;
  gross_profit: number;
  gross_margin: number;
  purchases_total: number;
  waste_total: number;
  order_count: number;
  updated_at?: string;
}

// 损耗分析报告
export interface WasteAnalysis {
  period_start: string;
  period_end: string;
  item_id: string;
  item_name: string;
  opening_stock: number;
  purchases: number;
  theoretical_consumption: number;
  actual_consumption: number;
  waste_quantity: number;
  waste_rate: number;
  waste_cost: number;
  unit: string;
}
