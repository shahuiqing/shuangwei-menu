export type OrderStatus = 'pending' | 'cooking' | 'served' | 'completed' | 'cancelled';
export type OrderType = 'dine_in' | 'takeaway' | 'delivery';

export interface OrderItem {
  id?: string;
  name: string;
  enTitle?: string;
  frTitle?: string;
  arTitle?: string;
  maTitle?: string;
  quantity: number;
  price: number; // unit price
  subtotal?: number;
  image?: string;
  isAdded?: boolean; // true if added via appendDishes
}

export interface OrderAddition {
  items: OrderItem[];
  timestamp: string;
}

export interface Order {
  id: string; // VARCHAR(100) PK
  _id: string; // alias
  orderNumber?: string;
  table_no: string;
  tableNo?: string; // alias
  customer_name: string;
  customerName: string;
  type?: OrderType;
  status: OrderStatus;
  total: number;
  total_amount: number;
  items: OrderItem[];
  notes: string;
  timestamp: string; // ISO
  created_at?: string;
  createdAt?: string;
  unprintedNewOrder: boolean;
  unprintedAdditions: OrderAddition[];
  isExternal?: boolean;
}
