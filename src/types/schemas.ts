import { z } from 'zod';

export const menuItemSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(100),
  enTitle: z.string().max(100).optional(),
  frTitle: z.string().max(100).optional(),
  arTitle: z.string().max(100).optional(),
  maTitle: z.string().max(100).optional(),
  price: z.string().max(20), // validated further by parse
  description: z.string().max(500).optional(),
  enDescription: z.string().max(500).optional(),
  frDescription: z.string().max(500).optional(),
  arDescription: z.string().max(500).optional(),
  maDescription: z.string().max(500).optional(),
  image: z.string().max(2_000_000).optional().default(''), // url or base64, size guard 500KB after compress
  allergens: z.array(z.string()).optional(),
  stock: z.union([z.number(), z.string(), z.null()]).optional(),
  isSoldOut: z.boolean().optional(),
});

export const menuCategorySchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  enName: z.string().max(100).optional(),
  frName: z.string().max(100).optional(),
  arName: z.string().max(100).optional(),
  maName: z.string().max(100).optional(),
  items: z.array(menuItemSchema).max(200),
});

export const receiptSettingsSchema = z.object({
  storeName: z.string().max(100),
  showStoreName: z.boolean(),
  showDate: z.boolean(),
  showQrCode: z.boolean(),
  fontSize: z.string().max(20),
  columnWidth: z.string().max(20),
  footerText1: z.string().max(200),
  footerText2: z.string().max(200),
  topLogoUrl: z.string().max(2000).optional().default(''),
  bottomLogoUrl: z.string().max(2000).optional().default(''),
  googleMapsReviewLink: z.string().max(2000).optional(),
}).passthrough();

export const devicePasswordSchema = z.object({
  name: z.string().min(1).max(50),
  password: z.string().min(1).max(100),
});

export const appSettingsSchema = z.object({
  id: z.literal('global').optional().default('global'),
  categories: z.array(menuCategorySchema).max(50),
  promotions: z.array(menuItemSchema.extend({ isActive: z.boolean().optional() })).max(20).optional().default([]),
  bgUrl: z.string().max(2000).optional().default(''),
  restaurantName: z.string().min(1).max(100),
  welcomeMessage: z.string().max(200).optional().default(''),
  logoUrl: z.string().max(2000).optional().default(''),
  adminPassword: z.string().min(4).max(100),
  devicePasswords: z.array(devicePasswordSchema).max(20).optional().default([]),
  securityQuestion: z.string().max(200).optional().default(''),
  securityAnswer: z.string().max(200).optional().default(''),
  soundEnabled: z.boolean().optional().default(true),
  layoutStyle: z.enum(['grid', 'list', 'bento']).optional().default('grid'),
  receiptSettings: receiptSettingsSchema.optional(),
  deletedItemIds: z.array(z.string()).max(500).optional().default([]),
  theme: z.enum(['midnight', 'light']).optional().default('midnight'),
}).passthrough();

export const orderItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  quantity: z.number().int().min(1).max(99),
  price: z.number().min(0).max(10000),
  image: z.string().max(2000).optional(),
  isAdded: z.boolean().optional(),
}).passthrough();

export const orderSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  _id: z.string().optional(),
  table_no: z.string().min(1).max(50),
  customer_name: z.string().max(100).optional(),
  customerName: z.string().max(100).optional(),
  status: z.enum(['pending', 'cooking', 'served', 'completed', 'cancelled']).optional().default('pending'),
  total: z.number().min(0).max(100000),
  total_amount: z.number().min(0).max(100000).optional(),
  items: z.array(orderItemSchema).min(1).max(100),
  notes: z.string().max(500).optional().default(''),
  timestamp: z.string().optional(),
}).passthrough();

export const inventoryItemSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  category: z.string().max(50),
  stock: z.number().min(0).max(1000000),
  unit: z.string().max(20),
  safety_stock: z.number().min(0).max(1000000),
  price: z.number().min(0).max(1000000),
  updated_at: z.string().optional(),
});

export const recipeBomSchema = z.object({
  id: z.string().min(1).max(100),
  menu_item_name: z.string().min(1).max(100),
  inventory_item_id: z.string().min(1).max(50),
  dosage: z.number().min(0).max(10000),
  unit: z.string().max(20),
});

export const purchaseOrderSchema = z.object({
  id: z.string().min(1).max(100),
  supplier: z.string().max(100).default(''),
  item_id: z.string().min(1).max(50),
  item_name: z.string().min(1).max(100),
  quantity: z.number().min(0).max(1000000),
  unit: z.string().max(20),
  unit_price: z.number().min(0).max(1000000),
  total_cost: z.number().min(0).max(1000000),
  purchased_at: z.string(),
  notes: z.string().max(500).optional(),
  created_at: z.string().optional(),
});

export const inventoryTransactionSchema = z.object({
  id: z.string().min(1).max(100),
  item_id: z.string().min(1).max(50),
  item_name: z.string().min(1).max(100),
  type: z.enum(['purchase_in', 'order_out', 'adjustment', 'waste']),
  quantity: z.number().min(0).max(1000000),
  unit: z.string().max(20),
  unit_cost: z.number().min(0).max(1000000),
  reference: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
  created_at: z.string(),
});

export const dailySummarySchema = z.object({
  date: z.string().min(10).max(10),
  revenue: z.number().min(0),
  food_cost: z.number().min(0),
  gross_profit: z.number(),
  gross_margin: z.number(),
  purchases_total: z.number().min(0),
  waste_total: z.number().min(0),
  order_count: z.number().int().min(0),
  updated_at: z.string().optional(),
});
