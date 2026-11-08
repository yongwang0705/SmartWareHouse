import type { CreateOrderRequest, InventoryItem, Order } from '../types';

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

export const api = {
  getOrders: () => request<Order[]>('/api/orders'),
  getOrder: (id: number) => request<Order>(`/api/orders/${id}`),
  createOrder: (payload: CreateOrderRequest) =>
    request<Order>('/api/orders', { method: 'POST', body: JSON.stringify(payload) }),
  cancelOrder: (id: number) =>
    request<{ message?: string }>(`/api/orders/${id}`, { method: 'DELETE' }),
  getInventory: () => request<InventoryItem[]>('/api/inventory'),
};
