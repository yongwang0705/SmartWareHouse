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
  /** True when the item is a deliverable product rather than a part/material. */
  isProduct?: boolean | null;
}

export interface KanbanBin {
  binId: string;
  productId: number;
  productName: string;
  capacity: number;
  currentStock: number;
  reservedQuantity: number;
  availableQuantity: number;
  triggerLevel: number;
  jitEnabled: boolean;
  status: 'HEALTHY' | 'LOW' | 'REORDER' | 'CRITICAL' | string;
  fillPercent: number;
  /** Days since the inventory record last changed. */
  stockAgeDays: number | null;
  /** Days since the kanban bin was deployed (or stock last changed). */
  deployedDays: number | null;
  /** Days since the bin last triggered a replenishment signal. */
  daysSinceTrigger: number | null;
}

export interface CreateOrderRequest {
  customerId: number;
  items: Array<{ productId: number; quantity: number }>;
}

export interface BOMItem {
  parentProductId: number;
  parentProductName: string;
  componentProductId: number;
  componentProductName: string;
  quantityRequired: number;
}

// ---------------------------------------------------------------------------
// Production Planning (PPS) — mirrors the backend DTOs in
// smartwarehouse-production-planning.
// ---------------------------------------------------------------------------

export interface GeneratePlanRequest {
  planningStart: string;
  planningEnd: string;
  algorithm?: string;
}

export interface PlanSummary {
  planId: number;
  planNumber: string;
  status: string;
  planningStart: string;
  planningEnd: string;
  algorithm: string;
  totalOrders: number;
  scheduledOrders: number;
  atRiskOrders: number;
  materialShortageOrders: number;
  capacityShortageOrders: number;
  createdAt: string;
}

export interface PlanActionResponse {
  planId: number;
  status: string;
  message: string;
}

export interface Assignment {
  assignmentId: number;
  operationId: number;
  workCenterId: number;
  employeeId: number;
  startTime: string;
  endTime: string;
  allocatedHours: number;
  status: string;
}

export interface MaterialRequirement {
  requirementId: number;
  materialProductId: number;
  requiredQuantity: number;
  reservedQuantity: number;
  status: string;
}

export interface ProductionTask {
  taskId: number;
  planId: number;
  orderId: number;
  productId: number;
  quantity: number;
  startTime?: string | null;
  endTime?: string | null;
  dueDate: string;
  estimatedCompletion?: string | null;
  priority: string;
  status: string;
  statusReason?: string | null;
  assignments: Assignment[];
  materials: MaterialRequirement[];
}

export interface PlanDetails {
  planId: number;
  planNumber: string;
  status: string;
  planningStart: string;
  planningEnd: string;
  algorithm: string;
  reservationReference?: string | null;
  failureReason?: string | null;
  createdAt: string;
  tasks: ProductionTask[];
}

export interface WorkCenter {
  id: number;
  code: string;
  name: string;
  capacityHoursPerDay: number;
  active: boolean;
}

export interface Employee {
  id: number;
  employeeNumber: string;
  name: string;
  active: boolean;
}

export interface EmployeeSkill {
  id: number;
  employeeId: number;
  skillCode: string;
  proficiency: string;
}

export interface EmployeeShift {
  id: number;
  employeeId: number;
  shiftStart: string;
  shiftEnd: string;
  workingDays: string;
  active: boolean;
}

export interface EmployeeUnavailability {
  id: number;
  employeeId: number;
  startTime: string;
  endTime: string;
  reason?: string | null;
}

export interface ProductionRouting {
  id: number;
  productId: number;
  name: string;
  active: boolean;
}

export interface RoutingOperation {
  id: number;
  routingId: number;
  sequenceNumber: number;
  operationName: string;
  workCenterId: number;
  skillCode: string;
  minutesPerUnit: number;
  setupMinutes: number;
}

export interface WorkingCalendarEntry {
  id: number;
  workDate: string;
  workingDay: boolean;
  startTime?: string | null;
  endTime?: string | null;
  description?: string | null;
}

export interface ProductionBom {
  id: number;
  productId: number;
  materialProductId: number;
  quantityPerUnit: number;
  active: boolean;
  createdAt: string;
}
