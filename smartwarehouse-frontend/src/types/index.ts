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

export interface ProductionWorkOrder {
  workOrderId: number;
  productId: number;
  quantity: number;
  status: string;
  createdAt: string;
  completedAt?: string;
}

export interface BOMItem {
  parentProductId: number;
  parentProductName: string;
  componentProductId: number;
  componentProductName: string;
  quantityRequired: number;
}
