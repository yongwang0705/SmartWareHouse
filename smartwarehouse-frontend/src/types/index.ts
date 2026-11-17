export interface OrderItem {
  id?: number | null;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal?: number;
}

export type DeliveryMode = 'SEA' | 'AIR' | 'FREIGHT';

export interface DeliverySelection {
  mode: DeliveryMode;
  carrier: string;
  destination: string;
  distanceKm: number;
  transitDays: number;
  price: number;
  container: string;
}

export interface DeliveryQuote extends DeliverySelection {
  label: string;
  available: boolean;
  unavailableReason?: string;
  meetsDeadline: boolean;
  recommended: boolean;
  capacityLabel: string;
  note: string;
}

export interface DeliveryDestination {
  code: string;
  city: string;
  region: string;
  country: 'CA' | 'US' | 'INTL';
  distanceKm: number;
  seaport: boolean;
}

export interface Order {
  id: number;
  customerId: number;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: OrderItem[];
  dueDate?: string;
  priority?: string;
  productionStatus?: string;
  deliveryMode?: DeliveryMode | null;
  deliveryCarrier?: string | null;
  deliveryDestination?: string | null;
  deliveryDistanceKm?: number | null;
  deliveryTransitDays?: number | null;
  deliveryPrice?: number | null;
  deliveryContainer?: string | null;
  deliveredAt?: string | null;
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
  status: 'HEALTHY' | 'LOW' | 'REORDER' | 'CRITICAL' | 'OVERSTOCK' | string;
  fillPercent: number;
  /** Days since the inventory record last changed. */
  stockAgeDays: number | null;
  /** Days since the kanban bin was deployed (or stock last changed). */
  deployedDays: number | null;
  /** Days since the bin last triggered a replenishment signal. */
  daysSinceTrigger: number | null;
}

export interface WarehousePlot {
  id: number;
  code: string;
  name: string;
  plotType: string;
  surfaceArea: number;
  occupiedArea: number;
  occupancyPercent: number;
  productId: number | null;
  productName: string | null;
  isProduct: boolean | null;
  capacityUnits: number;
  occupiedUnits: number;
  status: 'EMPTY' | 'OCCUPIED' | 'FULL' | string;
}

export interface Warehouse {
  id: number;
  code: string;
  name: string;
  address: string | null;
  surfaceArea: number;
  allocatedArea: number;
  occupiedArea: number;
  utilizationPercent: number;
  plotCount: number;
  assignedPlotCount: number;
  plots: WarehousePlot[];
}

export interface CreateWarehousePlotRequest {
  code: string;
  name: string;
  plotType: string;
  surfaceArea: number;
  occupiedArea?: number;
  productId?: number | null;
  capacityUnits?: number;
  occupiedUnits?: number;
}

export interface MovePlotItemsResponse {
  source: WarehousePlot;
  destination: WarehousePlot;
}

export interface StoreOrderAllocation {
  plotId: number;
  productId: number;
  quantity: number;
}

export interface CreateOrderRequest {
  customerId: number;
  items: Array<{ productId: number; quantity: number }>;
  dueDate?: string;
  priority?: string;
}

export interface BOMItem {
  parentProductId: number;
  parentProductName: string;
  componentProductId: number;
  componentProductName: string;
  quantityRequired: number;
}

// ---------------------------------------------------------------------------
// Suppliers and purchase orders (inventory procurement)
// ---------------------------------------------------------------------------

export interface Supplier {
  id: number;
  code: string;
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  leadTimeDays: number;
  status: string;
  createdAt?: string;
}

export interface CreateSupplierRequest {
  code: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  leadTimeDays?: number;
}

export interface PurchaseOrderLine {
  lineId: number;
  productId: number;
  productName: string;
  isProduct?: boolean | null;
  quantity: number;
  receivedQuantity: number;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  supplierId: number;
  supplierCode: string;
  supplierName: string;
  status: 'ORDERED' | 'RECEIVED' | 'CANCELLED' | string;
  expectedDelivery?: string | null;
  createdAt: string;
  receivedAt?: string | null;
  orderedUnits: number;
  receivedUnits: number;
  lines: PurchaseOrderLine[];
}

export interface CreatePurchaseOrderRequest {
  supplierId: number;
  expectedDelivery?: string;
  lines: Array<{ productId: number; quantity: number }>;
}

// ---------------------------------------------------------------------------
// Production Planning (PPS) — mirrors the backend DTOs in
// smartwarehouse-production-planning.
// ---------------------------------------------------------------------------

export interface GeneratePlanRequest {
  planningStart: string;
  planningEnd: string;
  scheduleStart?: string;
  algorithm?: string;
}

export interface ReplenishPlanRequest {
  productId: number;
  targetQuantity: number;
  planningStart: string;
  planningEnd: string;
  scheduleStart?: string;
}

export interface PlanTaskRequest {
  orderId: number;
  productId: number;
  quantity: number;
  startTime: string;
  endTime: string;
  dueDate?: string;
  lineId?: number | null;
  priority?: string;
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

export interface LineAssignment {
  assignmentId: number;
  lineId: number;
  lineCode: string;
  lineName: string;
  startTime: string;
  endTime: string;
  allocatedHours: number;
}

export interface ProductionLine {
  id: number;
  code: string;
  name: string;
  employees: number;
  unitsPerHour: number;
  active: boolean;
}

export interface CreateProductionLineRequest {
  code: string;
  name: string;
  employees: number;
  unitsPerHour: number;
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
  completedAt?: string | null;
  priority: string;
  status: string;
  statusReason?: string | null;
  assignments: Assignment[];
  lineAssignments: LineAssignment[];
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
