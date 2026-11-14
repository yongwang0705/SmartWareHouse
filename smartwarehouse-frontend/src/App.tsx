import { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowUpRightFromSquare, faBoxesStacked, faCheck, faChevronRight,
  faCircleExclamation, faClipboardList, faPlus, faRotate, faSackDollar, faTruckFast, faWarehouse,
} from '@fortawesome/free-solid-svg-icons';
import Sidebar, { type Page } from './components/Sidebar';
import Topbar from './components/Topbar';
import StatCard from './components/StatCard';
import OrderModal from './components/OrderModal';
import { api } from './services/api';
import type { InventoryItem, Order } from './types';
import ProductionPage from './pages/ProductionPage';
import BOMPage from './pages/BOMPage';
import KanbanPage from './pages/KanbanPage';

const pageMeta: Record<Page, { title: string; subtitle: string }> = {
  dashboard: { title: 'Overview', subtitle: 'Here is what is happening across your warehouse today.' },
  orders: { title: 'Orders', subtitle: 'Create, monitor and manage customer orders.' },
  inventory: { title: 'Inventory', subtitle: 'Track stock levels, reservations and product availability.' },
  kanban: { title: 'JIT Kanban', subtitle: 'Just-in-time replenishment board for product inventory.' },
  warehouses: { title: 'Warehouses', subtitle: 'Warehouse locations and stock distribution.' },
  suppliers: { title: 'Suppliers', subtitle: 'Supplier management and procurement workspace.' },
  production: { title: 'Production', subtitle: 'Plans, Gantt schedule, resources and production routings' },
  bom: { title: 'Bill of Materials', subtitle: 'Material structure and manufacturing components' },
};

const money = (amount: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 }).format(Number(amount || 0));
const dateTime = (value?: string) => value ? new Date(value).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const available = (item: InventoryItem) => item.availableQuantity ?? item.quantity - item.reservedQuantity;
const statusClass = (status: string) => status.toLowerCase().replace(/[^a-z0-9]+/g, '-');

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

  const filteredInventory = useMemo(() => inventory.filter((item) =>
    `${item.productId} ${item.productName}`.toLowerCase().includes(search.toLowerCase())), [inventory, search]);

  const totalRevenue = orders.filter((order) => order.status?.toUpperCase() !== 'CANCELLED').reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const activeOrders = orders.filter((order) => order.status?.toUpperCase() !== 'CANCELLED').length;
  const lowStock = inventory.filter((item) => available(item) <= 10).length;
  const totalUnits = inventory.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const createOrder = async (customerId: number, items: Array<{ productId: number; quantity: number }>) => {
    await api.createOrder({ customerId, items });
    setShowOrderModal(false);
    setNotice('Order created successfully. Inventory has been reserved.');
    await loadData(true);
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
    <div className="table-scroll"><table><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>DATE</th><th>ITEMS</th><th>AMOUNT</th><th>STATUS</th><th /></tr></thead><tbody>
      {(compact ? orders.slice(0, 5) : filteredOrders).map((order) => <tr key={order.id}>
        <td><button className="table-primary-link" onClick={() => void openOrder(order)}>#ORD-{order.id}</button></td>
        <td><span className="customer-cell"><span className="customer-avatar">{String(order.customerId).slice(-2)}</span>Customer #{order.customerId}</span></td>
        <td className="muted-cell">{dateTime(order.createdAt)}</td>
        <td>{order.items?.length ?? 0} items</td>
        <td className="amount-cell">{money(order.totalAmount)}</td>
        <td><span className={`status-pill status-${statusClass(order.status || 'unknown')}`}><i />{order.status || 'UNKNOWN'}</span></td>
        <td><button className="row-action" title="View order" onClick={() => void openOrder(order)}><FontAwesomeIcon icon={faArrowUpRightFromSquare} /></button></td>
      </tr>)}
      {(!compact && filteredOrders.length === 0) && <tr><td colSpan={7}><div className="empty-state">No orders match your search.</div></td></tr>}
      {(compact && orders.length === 0) && <tr><td colSpan={7}><div className="empty-state">No orders yet. Create your first order to get started.</div></td></tr>}
    </tbody></table></div>
  </div>;

  const renderInventory = (compact = false) => <div className={`table-card ${compact ? 'compact-table' : ''}`}>
    <div className="table-heading"><div><h3>{compact ? 'Inventory snapshot' : 'Stock overview'}</h3><p>{compact ? 'Current product availability' : `${filteredInventory.length} products in inventory`}</p></div>{compact && <button className="text-link" onClick={() => setPage('inventory')}>View inventory <FontAwesomeIcon icon={faChevronRight} /></button>}</div>
    <div className="table-scroll"><table><thead><tr><th>PRODUCT</th><th>SKU</th><th>IN STOCK</th><th>RESERVED</th><th>AVAILABLE</th><th>STOCK LEVEL</th></tr></thead><tbody>
      {(compact ? inventory.slice(0, 5) : filteredInventory).map((item) => {
        const qty = available(item); const ratio = item.quantity > 0 ? Math.min(100, (qty / item.quantity) * 100) : 0;
        return <tr key={item.productId}><td><span className="product-cell"><span className="product-icon"><FontAwesomeIcon icon={faBoxesStacked} /></span><strong>{item.productName}</strong></span></td><td className="muted-cell">PRD-{item.productId}</td><td>{item.quantity}</td><td>{item.reservedQuantity}</td><td><strong className={qty <= 10 ? 'text-danger' : 'text-dark'}>{qty}</strong></td><td><div className="stock-meter"><div className="stock-track"><span className={qty <= 10 ? 'stock-low' : ''} style={{ width: `${ratio}%` }} /></div><small>{qty <= 10 ? 'Low stock' : 'Healthy'}</small></div></td></tr>;
      })}
      {(!compact && filteredInventory.length === 0) && <tr><td colSpan={6}><div className="empty-state">No inventory items found.</div></td></tr>}
      {(compact && inventory.length === 0) && <tr><td colSpan={6}><div className="empty-state">Inventory data is not available.</div></td></tr>}
    </tbody></table></div>
  </div>;

  const dashboard = <>
    <div className="welcome-row"><div><h2>Good day, Warehouse Admin <span>✦</span></h2><p>Here is your supply chain performance at a glance.</p></div><button className="button button-primary" onClick={() => setShowOrderModal(true)}><FontAwesomeIcon icon={faPlus} /> Create order</button></div>
    <div className="stats-grid">
      <StatCard label="TOTAL ORDERS" value={String(orders.length)} detail={`${activeOrders} active orders`} icon={faClipboardList} tone="blue" />
      <StatCard label="INVENTORY UNITS" value={totalUnits.toLocaleString('en-CA')} detail={`${inventory.length} products tracked`} icon={faBoxesStacked} tone="green" />
      <StatCard label="ORDER VALUE" value={money(totalRevenue)} detail="Excluding cancelled orders" icon={faSackDollar} tone="violet" />
      <StatCard label="LOW STOCK ALERTS" value={String(lowStock)} detail={lowStock ? 'Requires your attention' : 'All stock levels healthy'} icon={faCircleExclamation} tone="amber" />
    </div>
    <div className="dashboard-grid"><section>{renderOrders(true)}</section><section className="inventory-section">{renderInventory(true)}</section></div>
    <div className="insight-strip"><div className="insight-icon"><FontAwesomeIcon icon={faWarehouse} /></div><div><strong>Inventory visibility</strong><p>Reserved quantities are synchronized with the Inventory Service through gRPC.</p></div><span className="integration-tag"><i /> INTEGRATED</span></div>
  </>;

  const content = page === 'dashboard' ? dashboard : page === 'orders' ? <>
    <div className="page-toolbar"><div><h2>Order pipeline</h2><p>Review customer orders and manage their lifecycle.</p></div><button className="button button-primary" onClick={() => setShowOrderModal(true)}><FontAwesomeIcon icon={faPlus} /> Create order</button></div>
    <div className="filter-bar"><div className="filter-tabs">{['ALL', 'CREATED', 'CONFIRMED', 'CANCELLED'].map((status) => <button key={status} className={statusFilter === status ? 'filter-active' : ''} onClick={() => setStatusFilter(status)}>{status === 'ALL' ? 'All orders' : status.charAt(0) + status.slice(1).toLowerCase()}</button>)}</div><span className="result-count">{filteredOrders.length} results</span></div>
    {renderOrders(false)}
  </> : page === 'inventory' ? <>
    <div className="page-toolbar"><div><h2>Inventory levels</h2><p>Monitor on-hand, reserved and available quantities.</p></div><button className="button button-secondary" onClick={() => void loadData(true)}><FontAwesomeIcon icon={faRotate} /> Refresh data</button></div>
    <div className="stats-grid stats-grid-small"><StatCard label="TOTAL PRODUCTS" value={String(inventory.length)} detail="Registered SKUs" icon={faBoxesStacked} tone="blue" /><StatCard label="TOTAL UNITS" value={totalUnits.toLocaleString('en-CA')} detail="Across all products" icon={faWarehouse} tone="green" /><StatCard label="RESERVED UNITS" value={String(inventory.reduce((sum, item) => sum + item.reservedQuantity, 0))} detail="Allocated to orders" icon={faClipboardList} tone="violet" /><StatCard label="LOW STOCK" value={String(lowStock)} detail="10 or fewer available" icon={faCircleExclamation} tone="amber" /></div>
    {renderInventory(false)}
  </> : page === 'kanban' ? <KanbanPage /> : page === 'production' ? <ProductionPage /> : page === 'bom' ? <BOMPage /> : <div className="coming-soon-card"><div className="coming-soon-icon"><FontAwesomeIcon icon={page === 'warehouses' ? faWarehouse : faTruckFast} /></div><span className="eyebrow">COMING NEXT</span><h2>{page === 'warehouses' ? 'Warehouse management' : 'Supplier management'}</h2><p>This section is part of the planned SmartWarehouse roadmap. The current backend exposes order and inventory operations; this module can be connected when its service is ready.</p><button className="button button-secondary" onClick={() => setPage('dashboard')}>Back to dashboard</button></div>;

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
    {selectedOrder && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedOrder(null); }}><section className="modal-card order-detail-modal" role="dialog" aria-modal="true"><div className="modal-header"><div><div className="eyebrow">ORDER DETAILS</div><h2>Order #ORD-{selectedOrder.id}</h2><p>Created {dateTime(selectedOrder.createdAt)}</p></div><button className="icon-button" onClick={() => setSelectedOrder(null)} aria-label="Close">×</button></div><div className="detail-summary"><div><small>CUSTOMER</small><strong>#{selectedOrder.customerId}</strong></div><div><small>TOTAL</small><strong>{money(selectedOrder.totalAmount)}</strong></div><div><small>STATUS</small><span className={`status-pill status-${statusClass(selectedOrder.status)}`}><i />{selectedOrder.status}</span></div></div><h3 className="detail-section-title">Order items</h3><div className="detail-items">{selectedOrder.items?.map((item, index) => <div className="detail-item" key={item.id ?? `${item.productId}-${index}`}><div><strong>{item.productName}</strong><small>SKU #{item.productId} · Qty {item.quantity}</small></div><strong>{money(item.subtotal ?? item.unitPrice * item.quantity)}</strong></div>)}</div><div className="detail-total"><span>Order total</span><strong>{money(selectedOrder.totalAmount)}</strong></div><div className="modal-footer">{selectedOrder.status?.toUpperCase() !== 'CANCELLED' && <button className="button button-danger" onClick={() => void cancelOrder(selectedOrder)}>Cancel order</button>}<button className="button button-ghost" onClick={() => setSelectedOrder(null)}>Close</button></div></section></div>}
    {notice && <div className={`toast ${notice.toLowerCase().includes('unable') || notice.toLowerCase().includes('failed') || notice.toLowerCase().includes('insufficient') ? 'toast-error' : ''}`}><FontAwesomeIcon icon={faCheck} />{notice}</div>}
  </div>;
}
