import type {
  BOMItem, CreateOrderRequest, CreateProductionLineRequest,
  CreatePurchaseOrderRequest, CreateSupplierRequest, CreateWarehousePlotRequest,
  DeliverySelection, Employee, EmployeeShift,
  EmployeeSkill, EmployeeUnavailability, GeneratePlanRequest, InventoryItem,
  KanbanBin, MovePlotItemsResponse, Order, PlanActionResponse, PlanDetails,
  PlanSummary, PlanTaskRequest, ProductionBom, ProductionLine,
  ProductionRouting, ProductionTask, PurchaseOrder, ReplenishPlanRequest,
  RoutingOperation, StoreOrderAllocation, Supplier, Warehouse, WarehousePlot,
  WorkCenter, WorkingCalendarEntry,
} from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      message = payload.message || payload.error || message;
    } catch {
      const body = await response.text().catch(() => '');
      if (body) message = body;
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, body === undefined
    ? { method: 'POST' }
    : { method: 'POST', body: JSON.stringify(body) });

export const api = {
  // Orders
  getOrders: () => request<Order[]>('/api/orders'),
  getOrder: (id: number) => request<Order>(`/api/orders/${id}`),
  createOrder: (payload: CreateOrderRequest) =>
    post<Order>('/api/orders', payload),
  confirmOrder: (id: number) =>
    post<Order>(`/api/orders/${id}/confirm`),
  completeOrder: (id: number) =>
    post<Order>(`/api/orders/${id}/complete`),
  storeOrder: (id: number, allocations: StoreOrderAllocation[]) =>
    post<Order>(`/api/orders/${id}/store`, { allocations }),
  shipOrder: (id: number, delivery: DeliverySelection) =>
    post<Order>(`/api/orders/${id}/ship`, delivery),
  cancelOrder: (id: number) =>
    request<{ message?: string }>(`/api/orders/${id}`, { method: 'DELETE' }),

  // Inventory
  getInventory: () => request<InventoryItem[]>('/api/inventory'),
  getBOM: () => request<BOMItem[]>('/api/inventory/bom'),
  getKanban: () => request<KanbanBin[]>('/api/inventory/kanban'),
  getWarehouses: () => request<Warehouse[]>('/api/inventory/warehouses'),
  createWarehousePlot: (warehouseId: number, payload: CreateWarehousePlotRequest) =>
    post<WarehousePlot>(`/api/inventory/warehouses/${warehouseId}/plots`, payload),
  updateWarehousePlot: (
    warehouseId: number,
    plotId: number,
    payload: CreateWarehousePlotRequest,
  ) => request<WarehousePlot>(
    `/api/inventory/warehouses/${warehouseId}/plots/${plotId}`,
    { method: 'PUT', body: JSON.stringify(payload) },
  ),
  deleteWarehousePlot: (warehouseId: number, plotId: number) =>
    request<void>(
      `/api/inventory/warehouses/${warehouseId}/plots/${plotId}`,
      { method: 'DELETE' },
    ),
  moveWarehousePlotItems: (
    warehouseId: number,
    plotId: number,
    payload: { destinationPlotId: number; quantity: number },
  ) => post<MovePlotItemsResponse>(
    `/api/inventory/warehouses/${warehouseId}/plots/${plotId}/move`,
    payload,
  ),

  // Suppliers and procurement
  getSuppliers: () => request<Supplier[]>('/api/inventory/suppliers'),
  createSupplier: (payload: CreateSupplierRequest) =>
    post<Supplier>('/api/inventory/suppliers', payload),
  getPurchaseOrders: () =>
    request<PurchaseOrder[]>('/api/inventory/purchase-orders'),
  createPurchaseOrder: (payload: CreatePurchaseOrderRequest) =>
    post<PurchaseOrder>('/api/inventory/purchase-orders', payload),
  receivePurchaseOrder: (orderId: number) =>
    post<PurchaseOrder>(`/api/inventory/purchase-orders/${orderId}/receive`),
  cancelPurchaseOrder: (orderId: number) =>
    post<PurchaseOrder>(`/api/inventory/purchase-orders/${orderId}/cancel`),

  // -------------------------------------------------------------------------
  // Production Planning
  // -------------------------------------------------------------------------
  getPlans: () => request<PlanSummary[]>('/api/production/plans'),
  getPlan: (id: number) => request<PlanDetails>(`/api/production/plans/${id}`),
  generatePlan: (payload: GeneratePlanRequest) =>
    post<PlanSummary>('/api/production/plans/generate', payload),
  replenishPlan: (payload: ReplenishPlanRequest) =>
    post<PlanSummary>('/api/production/plans/replenish', payload),
  confirmPlan: (id: number) =>
    post<PlanActionResponse>(`/api/production/plans/${id}/confirm`),
  cancelPlan: (id: number) =>
    post<PlanActionResponse>(`/api/production/plans/${id}/cancel`),

  // Tasks
  getProductionTasks: (planId?: number) =>
    request<ProductionTask[]>(`/api/production/tasks${planId ? `?planId=${planId}` : ''}`),
  getProductionTask: (id: number) =>
    request<ProductionTask>(`/api/production/tasks/${id}`),
  startTask: (id: number) =>
    post<ProductionTask>(`/api/production/tasks/${id}/start`),
  completeTask: (id: number) =>
    post<ProductionTask>(`/api/production/tasks/${id}/complete`),

  // Manual plan editing (split an order into scheduled parts)
  createPlanTask: (planId: number, payload: PlanTaskRequest) =>
    post<ProductionTask>(`/api/production/plans/${planId}/tasks`, payload),
  updatePlanTask: (planId: number, taskId: number, payload: PlanTaskRequest) =>
    request<ProductionTask>(`/api/production/plans/${planId}/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deletePlanTask: (planId: number, taskId: number) =>
    request<void>(`/api/production/plans/${planId}/tasks/${taskId}`, {
      method: 'DELETE',
    }),

  // Resources / configuration
  getProductionLines: () => request<ProductionLine[]>('/api/production/lines'),
  createProductionLine: (payload: CreateProductionLineRequest) =>
    post<ProductionLine>('/api/production/lines', payload),
  updateProductionLine: (id: number, payload: CreateProductionLineRequest) =>
    request<ProductionLine>(`/api/production/lines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  getWorkCenters: () => request<WorkCenter[]>('/api/production/work-centers'),
  createWorkCenter: (payload: Omit<WorkCenter, 'id'>) =>
    post<WorkCenter>('/api/production/work-centers', payload),

  getEmployees: () => request<Employee[]>('/api/production/employees'),
  createEmployee: (payload: Omit<Employee, 'id'>) =>
    post<Employee>('/api/production/employees', payload),

  getEmployeeSkills: (employeeId: number) =>
    request<EmployeeSkill[]>(`/api/production/employees/${employeeId}/skills`),
  createEmployeeSkill: (employeeId: number, payload: { skillCode: string; proficiency?: string }) =>
    post<EmployeeSkill>(`/api/production/employees/${employeeId}/skills`, payload),

  getEmployeeShifts: (employeeId: number) =>
    request<EmployeeShift[]>(`/api/production/employees/${employeeId}/shifts`),
  createEmployeeShift: (employeeId: number, payload: { shiftStart: string; shiftEnd: string; workingDays?: string }) =>
    post<EmployeeShift>(`/api/production/employees/${employeeId}/shifts`, payload),

  getEmployeeUnavailability: (employeeId: number) =>
    request<EmployeeUnavailability[]>(`/api/production/employees/${employeeId}/unavailability`),
  createEmployeeUnavailability: (
    employeeId: number,
    payload: { startTime: string; endTime: string; reason?: string },
  ) => post<EmployeeUnavailability>(`/api/production/employees/${employeeId}/unavailability`, payload),

  getRoutings: () => request<ProductionRouting[]>('/api/production/routings'),
  createRouting: (payload: Omit<ProductionRouting, 'id'>) =>
    post<ProductionRouting>('/api/production/routings', payload),

  getRoutingOperations: (routingId: number) =>
    request<RoutingOperation[]>(`/api/production/routings/${routingId}/operations`),
  createRoutingOperation: (
    routingId: number,
    payload: {
      sequenceNumber: number;
      operationName: string;
      workCenterId: number;
      skillCode: string;
      minutesPerUnit: number;
      setupMinutes?: number;
    },
  ) => post<RoutingOperation>(`/api/production/routings/${routingId}/operations`, payload),

  getWorkingCalendar: (from: string, to: string) =>
    request<WorkingCalendarEntry[]>(`/api/production/working-calendar?from=${from}&to=${to}`),
  createWorkingCalendarEntry: (payload: Omit<WorkingCalendarEntry, 'id'>) =>
    post<WorkingCalendarEntry>('/api/production/working-calendar', payload),

  getProductionBom: (productId: number) =>
    request<ProductionBom[]>(`/api/production/bom/${productId}`),
  createProductionBom: (payload: { productId: number; materialProductId: number; quantityPerUnit: number }) =>
    post<ProductionBom>('/api/production/bom', payload),

  // Convenience: PPS exposes operations per routing, so aggregate them here.
  getAllRoutingOperations: async () => {
    const routings = await request<ProductionRouting[]>('/api/production/routings');
    const nested = await Promise.all(
      routings.map((routing) =>
        request<RoutingOperation[]>(`/api/production/routings/${routing.id}/operations`)
          .catch(() => [] as RoutingOperation[]),
      ),
    );
    return nested.flat();
  },
};
