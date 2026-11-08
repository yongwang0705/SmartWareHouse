export interface OrderItem {
  id?: number | null;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal?: number;
}

export interface Order {
  id: number;
  customerId: number;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: OrderItem[];
}

export interface InventoryItem {
  id?: number;
  productId: number;
  productName: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity?: number;
  updatedAt?: string;
}

export interface CreateOrderRequest {
  customerId: number;
  items: Array<{ productId: number; quantity: number }>;
}
