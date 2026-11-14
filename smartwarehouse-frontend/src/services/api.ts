import type {
  BOMItem, CreateOrderRequest, Employee, EmployeeShift, EmployeeSkill,
  EmployeeUnavailability, GeneratePlanRequest, InventoryItem, KanbanBin, Order,
  PlanActionResponse, PlanDetails, PlanSummary, ProductionBom,
  ProductionRouting, ProductionTask, RoutingOperation, WorkCenter,
  WorkingCalendarEntry,
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
  cancelOrder: (id: number) =>
    request<{ message?: string }>(`/api/orders/${id}`, { method: 'DELETE' }),

  // Inventory
  getInventory: () => request<InventoryItem[]>('/api/inventory'),
  getBOM: () => request<BOMItem[]>('/api/inventory/bom'),
  getKanban: () => request<KanbanBin[]>('/api/inventory/kanban'),

  // -------------------------------------------------------------------------
  // Production Planning
  // -------------------------------------------------------------------------
  getPlans: () => request<PlanSummary[]>('/api/production/plans'),
  getPlan: (id: number) => request<PlanDetails>(`/api/production/plans/${id}`),
  generatePlan: (payload: GeneratePlanRequest) =>
    post<PlanSummary>('/api/production/plans/generate', payload),
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

  // Resources / configuration
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
