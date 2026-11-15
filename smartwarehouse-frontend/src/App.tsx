import { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowUpRightFromSquare, faCheck, faChevronRight,
  faCircleExclamation, faPlus, faTruckFast,
} from '@fortawesome/free-solid-svg-icons';
import Sidebar, { type Page } from './components/Sidebar';
import Topbar from './components/Topbar';
import OrderModal from './components/OrderModal';
import { api } from './services/api';
import type { InventoryItem, Order } from './types';
import DashboardPage from './pages/DashboardPage';
import ProductionPage from './pages/ProductionPage';
import BOMPage from './pages/BOMPage';
import InventoryPage from './pages/InventoryPage';
import WarehousesPage from './pages/WarehousesPage';

const pageMeta: Record<Page, { title: string; subtitle: string }> = {
  dashboard: { title: 'Overview', subtitle: 'Here is what is happening across your warehouse today.' },
  orders: { title: 'Orders', subtitle: 'Create, monitor and manage customer orders.' },
  inventory: { title: 'Inventory', subtitle: 'Stock positions, reservations and JIT replenishment.' },
  warehouses: { title: 'Warehouses', subtitle: 'Physical sites, storage plots and space utilization.' },
  suppliers: { title: 'Suppliers', subtitle: 'Supplier management and procurement workspace.' },
  production: { title: 'Production', subtitle: 'Plans, Gantt schedule, resources and production routings' },
  bom: { title: 'Bill of Materials', subtitle: 'Material structure and manufacturing components' },
};

const money = (amount: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 }).format(Number(amount || 0));
const dateTime = (value?: string) => value ? new Date(value).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const statusClass = (status: string) => status.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const productionLabel = (status?: string) => {
  switch (status) {
    case 'AWAITING_CONFIRMATION': return 'Awaiting confirmation';
    case 'READY': return 'Ready to fulfil';
    case 'PENDING_PRODUCTION': return 'Production required';
    case 'PLANNED': return 'Planned';
    case 'IN_PRODUCTION': return 'In production';
    case 'PRODUCTION_COMPLETED': return 'Production complete — confirm to finish';
    case 'FULFILLED': return 'Fulfilled';
    default: return status ? status.replace(/_/g, ' ').toLowerCase() : '—';
  }
};

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const loadData = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const [orderData, inventoryData] = await Promise.all([api.getOrders(), api.getInventory()]);
      setOrders(Array.isArray(orderData) ? orderData : []);
      setInventory(Array.isArray(inventoryData) ? inventoryData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect to the API Gateway.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const matchesSearch = `${order.id} ${order.customerId} ${order.status}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || order.status?.toUpperCase() === statusFilter;
    return matchesSearch && matchesStatus;
  }), [orders, search, statusFilter]);

  const createOrder = async (
    customerId: number,
    items: Array<{ productId: number; quantity: number }>,
    dueDate?: string,
  ) => {
    await api.createOrder({ customerId, items, dueDate });
    setShowOrderModal(false);
    setNotice('Order created. Confirm it to check inventory or arrange production.');
    await loadData(true);
  };

  const confirmOrder = async (order: Order) => {
    try {
      const updated = await api.confirmOrder(order.id);
      setSelectedOrder(updated);
      setNotice(updated.productionStatus === 'READY'
        ? `Order #${order.id} confirmed. Inventory reserved.`
        : `Order #${order.id} confirmed. Production is required.`);
      await loadData(true);
    } catch (err) {
      setNotice(`Failed: ${err instanceof Error ? err.message : 'unable to confirm order'}`);
    }
  };

  const completeOrder = async (order: Order): Promise<boolean> => {
    if (!window.confirm(`Complete order #${order.id}? Fulfilled inventory will be deducted.`)) return false;
    try {
      const updated = await api.completeOrder(order.id);
      setSelectedOrder(updated);
      setNotice(`Order #${order.id} completed.`);
      await loadData(true);
      return true;
    } catch (err) {
      setNotice(`Failed: ${err instanceof Error ? err.message : 'unable to complete order'}`);
      return false;
    }
  };

  const cancelOrder = async (order: Order) => {
    if (!window.confirm(`Cancel order #${order.id}? Reserved inventory will be released.`)) return;
    try {
      await api.cancelOrder(order.id);
      setNotice(`Order #${order.id} cancelled. Reserved inventory was released.`);
      if (selectedOrder?.id === order.id) setSelectedOrder(null);
      await loadData(true);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to cancel order.');
    }
  };

  const openOrder = async (order: Order) => {
    try { setSelectedOrder(await api.getOrder(order.id)); }
    catch { setSelectedOrder(order); }
  };

  const renderOrders = (compact = false) => <div className={`table-card ${compact ? 'compact-table' : ''}`}>
    <div className="table-heading"><div><h3>{compact ? 'Recent orders' : 'All orders'}</h3><p>{compact ? 'Latest activity from your order pipeline' : `${filteredOrders.length} orders found`}</p></div>{compact && <button className="text-link" onClick={() => setPage('orders')}>View all <FontAwesomeIcon icon={faChevronRight} /></button>}</div>
    <div className="table-scroll"><table><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>DATE</th><th>DUE</th><th>ITEMS</th><th>QTY</th><th>AMOUNT</th><th>STATUS</th><th /></tr></thead><tbody>
      {(compact ? orders.slice(0, 5) : filteredOrders).map((order) => <tr key={order.id}>
        <td><button className="table-primary-link" onClick={() => void openOrder(order)}>#ORD-{order.id}</button></td>
        <td><span className="customer-cell"><span className="customer-avatar">{String(order.customerId).slice(-2)}</span>Customer #{order.customerId}</span></td>
        <td className="muted-cell">{dateTime(order.createdAt)}</td>
        <td className="muted-cell">{order.dueDate ? dateTime(order.dueDate) : '—'}</td>
        <td>{order.items?.length ?? 0} items</td>
        <td><strong>{(order.items ?? []).reduce((sum, item) => sum + item.quantity, 0)}</strong> units</td>
        <td className="amount-cell">{money(order.totalAmount)}</td>
        <td><span className={`status-pill status-${statusClass(order.status || 'unknown')}`}><i />{order.status || 'UNKNOWN'}</span><div className="cell-sub">{productionLabel(order.productionStatus)}</div></td>
        <td><button className="row-action" title="View order" onClick={() => void openOrder(order)}><FontAwesomeIcon icon={faArrowUpRightFromSquare} /></button></td>
      </tr>)}
      {(!compact && filteredOrders.length === 0) && <tr><td colSpan={9}><div className="empty-state">No orders match your search.</div></td></tr>}
      {(compact && orders.length === 0) && <tr><td colSpan={9}><div className="empty-state">No orders yet. Create your first order to get started.</div></td></tr>}
    </tbody></table></div>
  </div>;

  const content = page === 'dashboard' ? (
    <DashboardPage
      orders={orders}
      inventory={inventory}
      onOpenOrder={openOrder}
      onCompleteOrder={completeOrder}
    />
  ) : page === 'orders' ? <>
    <div className="page-toolbar"><div><h2>Order pipeline</h2><p>Review customer orders and manage their lifecycle.</p></div><button className="button button-primary" onClick={() => setShowOrderModal(true)}><FontAwesomeIcon icon={faPlus} /> Create order</button></div>
    <div className="filter-bar"><div className="filter-tabs">{['ALL', 'CREATED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].map((status) => <button key={status} className={statusFilter === status ? 'filter-active' : ''} onClick={() => setStatusFilter(status)}>{status === 'ALL' ? 'All orders' : status.charAt(0) + status.slice(1).toLowerCase()}</button>)}</div><span className="result-count">{filteredOrders.length} results</span></div>
    {renderOrders(false)}
  </> : page === 'inventory' ? <InventoryPage inventory={inventory} onRefreshStock={() => void loadData(true)} /> : page === 'production' ? <ProductionPage /> : page === 'bom' ? <BOMPage /> : page === 'warehouses' ? <WarehousesPage /> : <div className="coming-soon-card"><div className="coming-soon-icon"><FontAwesomeIcon icon={faTruckFast} /></div><span className="eyebrow">COMING NEXT</span><h2>Supplier management</h2><p>This section is part of the planned SmartWarehouse roadmap. The current backend exposes order and inventory operations; this module can be connected when its service is ready.</p><button className="button button-secondary" onClick={() => setPage('dashboard')}>Back to dashboard</button></div>;

  return <div className="app-shell">
    <Sidebar page={page} onNavigate={setPage} open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
    <main className="main-area">
      <Topbar title={pageMeta[page].title} subtitle={pageMeta[page].subtitle} onMenu={() => setMobileNavOpen(true)} onSearch={setSearch} />
      <div className="page-content">
        {error && <div className="alert alert-error"><FontAwesomeIcon icon={faCircleExclamation} /><span>{error}. Check that the API Gateway and backend services are running.</span><button onClick={() => void loadData()}>Retry</button></div>}
        {loading ? <div className="loading-panel"><span className="spinner" /><strong>Loading warehouse data...</strong><span>Connecting to your services</span></div> : <>{content}</>}
      </div>
      <footer className="app-footer"><span>© 2026 SmartWarehouse</span><span><i className="footer-dot" /> API Gateway <strong>Connected when data loads</strong></span><span>Built for smarter operations</span></footer>
    </main>
    {showOrderModal && <OrderModal inventory={inventory} onClose={() => setShowOrderModal(false)} onSubmit={createOrder} />}
    {selectedOrder && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedOrder(null); }}><section className="modal-card order-detail-modal" role="dialog" aria-modal="true"><div className="modal-header"><div><div className="eyebrow">ORDER DETAILS</div><h2>Order #ORD-{selectedOrder.id}</h2><p>Created {dateTime(selectedOrder.createdAt)}</p></div><button className="icon-button" onClick={() => setSelectedOrder(null)} aria-label="Close">×</button></div><div className="detail-summary"><div><small>CUSTOMER</small><strong>#{selectedOrder.customerId}</strong></div><div><small>DUE DATE</small><strong>{selectedOrder.dueDate ? dateTime(selectedOrder.dueDate) : '—'}</strong></div><div><small>TOTAL</small><strong>{money(selectedOrder.totalAmount)}</strong></div><div><small>STATUS</small><span className={`status-pill status-${statusClass(selectedOrder.status)}`}><i />{selectedOrder.status}</span></div><div><small>PRODUCTION</small><strong>{productionLabel(selectedOrder.productionStatus)}</strong></div></div><h3 className="detail-section-title">Order items</h3><div className="detail-items">{selectedOrder.items?.map((item, index) => <div className="detail-item" key={item.id ?? `${item.productId}-${index}`}><div><strong>{item.productName}</strong><small>SKU #{item.productId} · Qty {item.quantity}</small></div><strong>{money(item.subtotal ?? item.unitPrice * item.quantity)}</strong></div>)}</div><div className="detail-total"><span>Order total</span><strong>{money(selectedOrder.totalAmount)}</strong></div><div className="modal-footer">{selectedOrder.status === 'CREATED' && <button className="button button-primary" onClick={() => void confirmOrder(selectedOrder)}>Confirm order</button>}{selectedOrder.status === 'CONFIRMED' && ['READY', 'PRODUCTION_COMPLETED'].includes(selectedOrder.productionStatus || '') && <button className="button button-primary" onClick={() => void completeOrder(selectedOrder)}>Complete order</button>}{['CREATED', 'CONFIRMED'].includes(selectedOrder.status || '') && !['PLANNED', 'IN_PRODUCTION', 'PRODUCTION_COMPLETED'].includes(selectedOrder.productionStatus || '') && <button className="button button-danger" onClick={() => void cancelOrder(selectedOrder)}>Cancel order</button>}<button className="button button-ghost" onClick={() => setSelectedOrder(null)}>Close</button></div></section></div>}
    {notice && <div className={`toast ${notice.toLowerCase().includes('unable') || notice.toLowerCase().includes('failed') || notice.toLowerCase().includes('insufficient') ? 'toast-error' : ''}`}><FontAwesomeIcon icon={faCheck} />{notice}</div>}
  </div>;
}
