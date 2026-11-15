import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBoxesStacked, faCircleExclamation, faClock, faIndustry,
  faMagnifyingGlass, faTruckFast, faWarehouse,
} from '@fortawesome/free-solid-svg-icons';
import DeliveryPlanner from '../components/DeliveryPlanner';
import StatCard from '../components/StatCard';
import Toast from '../components/Toast';
import { api } from '../services/api';
import type { DeliveryQuote, Order } from '../types';
import { deadlineDays } from '../utils/delivery';
import {
  formatDate, formatDateTime, friendlyStatus, statusClass,
} from '../utils/format';

const money = (amount: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));

type DeliveryFilter = 'TO_SHIP' | 'SHIPPED' | 'ALL';

interface DeliveryState {
  label: string;
  tone: 'production' | 'warehouse' | 'transit' | 'arrived' | 'shipped' | 'neutral';
}

const orderUnits = (order: Order) =>
  (order.items ?? []).reduce((sum, item) => sum + item.quantity, 0);

const modeLabel = (mode?: string | null) => {
  switch (mode) {
    case 'SEA': return 'Sea freight';
    case 'AIR': return 'Air freight';
    case 'FREIGHT': return 'Truck freight';
    default: return '—';
  }
};

const deliveryState = (order: Order): DeliveryState => {
  if (order.status === 'COMPLETED') {
    return { label: 'Ready to ship · production line', tone: 'production' };
  }
  if (order.status === 'IN_WAREHOUSE') {
    return { label: 'Ready to ship · warehouse', tone: 'warehouse' };
  }
  if (order.status === 'SHIPPED') {
    if (!order.deliveryMode || !order.deliveredAt) {
      return { label: 'Shipped · no delivery plan recorded', tone: 'shipped' };
    }

    const shippedAt = new Date(order.deliveredAt).getTime();
    const transitDays = Number(order.deliveryTransitDays ?? 0);
    const eta = new Date(shippedAt + transitDays * 86_400_000);

    if (Number.isNaN(eta.getTime())) {
      return { label: 'Shipped', tone: 'shipped' };
    }

    if (eta.getTime() > Date.now()) {
      return {
        label: `In transit · ETA ${formatDate(eta.toISOString())}`,
        tone: 'transit',
      };
    }

    return {
      label: `Arrived (est.) ${formatDate(eta.toISOString())}`,
      tone: 'arrived',
    };
  }
  return { label: friendlyStatus(order.status), tone: 'neutral' };
};

const sourceLabel = (order: Order) => {
  if (order.status === 'COMPLETED') return 'Production line (emergent)';
  if (order.status === 'IN_WAREHOUSE') return 'Warehouse storage (normal)';
  if (order.status === 'SHIPPED') return '—';
  return '—';
};

interface Props {
  orders: Order[];
  onOpenOrder: (order: Order) => void;
  onRefresh: () => Promise<void> | void;
}

export default function DeliveryPage({ orders, onOpenOrder, onRefresh }: Props) {
  const [filter, setFilter] = useState<DeliveryFilter>('TO_SHIP');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);

  const eligible = useMemo(
    () => orders.filter((order) => ['COMPLETED', 'IN_WAREHOUSE'].includes(order.status)),
    [orders],
  );
  const shipped = useMemo(
    () => orders.filter((order) => order.status === 'SHIPPED'),
    [orders],
  );
  const fromProduction = eligible.filter((order) => order.status === 'COMPLETED').length;
  const fromWarehouse = eligible.filter((order) => order.status === 'IN_WAREHOUSE').length;
  const inTransit = shipped.filter(
    (order) => deliveryState(order).tone === 'transit',
  ).length;

  const visibleOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders
      .filter((order) => {
        if (!['COMPLETED', 'IN_WAREHOUSE', 'SHIPPED'].includes(order.status)) {
          return false;
        }
        if (filter === 'TO_SHIP' && !['COMPLETED', 'IN_WAREHOUSE'].includes(order.status)) {
          return false;
        }
        if (filter === 'SHIPPED' && order.status !== 'SHIPPED') {
          return false;
        }
        if (!query) return true;

        return [
          order.id,
          order.customerId,
          order.status,
          order.deliveryMode,
          order.deliveryCarrier,
          order.deliveryDestination,
        ].join(' ').toLowerCase().includes(query);
      })
      .sort((a, b) => {
        const aReady = ['COMPLETED', 'IN_WAREHOUSE'].includes(a.status) ? 0 : 1;
        const bReady = ['COMPLETED', 'IN_WAREHOUSE'].includes(b.status) ? 0 : 1;
        if (aReady !== bReady) return aReady - bReady;

        return new Date(a.dueDate ?? a.createdAt).getTime()
          - new Date(b.dueDate ?? b.createdAt).getTime();
      });
  }, [orders, filter, search]);

  const openDelivery = (order: Order) => {
    setSelectedOrder(order);
    setSelectedDelivery(null);
  };

  const closeDelivery = () => {
    setSelectedOrder(null);
    setSelectedDelivery(null);
  };

  const ship = async () => {
    if (!selectedOrder || !selectedDelivery) return;

    const lateBy = Math.max(
      0,
      selectedDelivery.transitDays - deadlineDays(selectedOrder),
    );
    const lateWarning = !selectedDelivery.meetsDeadline
      ? ` This option misses the deadline by ${lateBy} day${lateBy === 1 ? '' : 's'}.`
      : '';

    if (!window.confirm(
      `Ship order #${selectedOrder.id} with ${selectedDelivery.label} via ${selectedDelivery.carrier} for ${money(selectedDelivery.price)}?${lateWarning} Shipped inventory will be deducted.`,
    )) return;

    setBusy(true);
    try {
      await api.shipOrder(selectedOrder.id, {
        mode: selectedDelivery.mode,
        carrier: selectedDelivery.carrier,
        destination: selectedDelivery.destination,
        distanceKm: selectedDelivery.distanceKm,
        transitDays: selectedDelivery.transitDays,
        price: selectedDelivery.price,
        container: selectedDelivery.container,
      });

      const orderId = selectedOrder.id;
      setNotice({
        message: `Order #${orderId} shipped with ${selectedDelivery.label} via ${selectedDelivery.carrier}.`,
        error: false,
      });
      closeDelivery();
      await onRefresh();
    } catch (err) {
      setNotice({
        message: err instanceof Error ? err.message : 'Unable to ship the order.',
        error: true,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-toolbar">
        <div>
          <h2>Delivery control</h2>
          <p>Check delivery status and choose how orders leave production or the warehouse.</p>
        </div>
        <button className="button button-secondary" onClick={() => void onRefresh()}>
          <FontAwesomeIcon icon={faTruckFast} /> Refresh
        </button>
      </div>

      <div className="stats-grid stats-grid-small">
        <StatCard
          label="AWAITING DELIVERY"
          value={String(eligible.length)}
          detail="Completed or stored orders"
          icon={faTruckFast}
          tone="blue"
        />
        <StatCard
          label="FROM PRODUCTION"
          value={String(fromProduction)}
          detail="Emergent direct shipments"
          icon={faIndustry}
          tone="violet"
        />
        <StatCard
          label="IN WAREHOUSE"
          value={String(fromWarehouse)}
          detail="Normal orders ready to ship"
          icon={faWarehouse}
          tone="amber"
        />
        <StatCard
          label="IN TRANSIT"
          value={String(inTransit)}
          detail={`${shipped.length} shipped orders total`}
          icon={faClock}
          tone="green"
        />
      </div>

      <div className="filter-bar">
        <div className="filter-tabs">
          {([
            ['TO_SHIP', 'Awaiting delivery'],
            ['SHIPPED', 'Shipped'],
            ['ALL', 'All deliveries'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              className={filter === value ? 'filter-active' : ''}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="warehouse-search">
          <FontAwesomeIcon icon={faMagnifyingGlass} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search order, carrier, destination"
          />
        </label>
      </div>

      <div className="table-card">
        <div className="table-heading">
          <div>
            <h3>Delivery queue</h3>
            <p>{visibleOrders.length} orders in this view</p>
          </div>
          <span className="result-count">
            <FontAwesomeIcon icon={faBoxesStacked} /> {eligible.reduce(
              (sum, order) => sum + orderUnits(order),
              0,
            ).toLocaleString('en-CA')} units awaiting delivery
          </span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ORDER</th>
                <th>CUSTOMER</th>
                <th>QUANTITY</th>
                <th>SOURCE</th>
                <th>DELIVERY STATUS</th>
                <th>DELIVERY PLAN</th>
                <th>DUE / SHIPPED</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((order) => {
                const state = deliveryState(order);
                const units = orderUnits(order);
                const isReady = ['COMPLETED', 'IN_WAREHOUSE'].includes(order.status);

                return (
                  <tr key={order.id}>
                    <td>
                      <button
                        className="table-primary-link"
                        onClick={() => onOpenOrder(order)}
                      >
                        #ORD-{order.id}
                      </button>
                    </td>
                    <td>Customer #{order.customerId}</td>
                    <td className="quantity-cell">
                      <strong>{units.toLocaleString('en-CA')}</strong> units
                    </td>
                    <td>{sourceLabel(order)}</td>
                    <td>
                      <span className={`status-pill delivery-state delivery-state-${state.tone}`}>
                        <i />{state.label}
                      </span>
                    </td>
                    <td>
                      {order.deliveryMode ? (
                        <div>
                          <strong>{modeLabel(order.deliveryMode)} · {order.deliveryCarrier}</strong>
                          <div className="cell-sub">{order.deliveryDestination ?? '—'}</div>
                        </div>
                      ) : (
                        <span className="muted-cell">Not selected</span>
                      )}
                    </td>
                    <td className="muted-cell">
                      {order.status === 'SHIPPED'
                        ? (order.deliveredAt ? formatDateTime(order.deliveredAt) : '—')
                        : formatDate(order.dueDate)}
                    </td>
                    <td>
                      <div className="row-actions">
                        {isReady && (
                          <button
                            className="mini-button mini-button-success"
                            onClick={() => openDelivery(order)}
                          >
                            Choose delivery
                          </button>
                        )}
                        {!isReady && (
                          <button
                            className="mini-button"
                            onClick={() => onOpenOrder(order)}
                          >
                            View
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleOrders.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      {filter === 'TO_SHIP'
                        ? 'No completed or warehouse orders are waiting for delivery.'
                        : 'No orders match this delivery view.'}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOrder && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDelivery();
          }}
        >
          <section
            className="modal-card order-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delivery-order-title"
          >
            <div className="modal-header">
              <div>
                <div className="eyebrow">DELIVERY</div>
                <h2 id="delivery-order-title">Order #ORD-{selectedOrder.id}</h2>
                <p>{unitsLabel(selectedOrder)}</p>
              </div>
              <button className="icon-button" onClick={closeDelivery} aria-label="Close">×</button>
            </div>

            <div className="detail-summary">
              <div>
                <small>STATUS</small>
                <span className={`status-pill status-${statusClass(selectedOrder.status)}`}>
                  <i />{friendlyStatus(selectedOrder.status)}
                </span>
              </div>
              <div>
                <small>QUANTITY</small>
                <strong>{orderUnits(selectedOrder).toLocaleString('en-CA')} units</strong>
              </div>
              <div>
                <small>SOURCE</small>
                <strong>{sourceLabel(selectedOrder)}</strong>
              </div>
              <div>
                <small>DUE DATE</small>
                <strong>{formatDate(selectedOrder.dueDate)}</strong>
              </div>
            </div>

            <DeliveryPlanner
              key={selectedOrder.id}
              order={selectedOrder}
              onChange={setSelectedDelivery}
            />

            <div className="plan-hint">
              <FontAwesomeIcon icon={faCircleExclamation} />
              <span>
                {selectedOrder.status === 'COMPLETED'
                  ? 'Emergent order: shipping directly from production.'
                  : 'Normal order: shipping from warehouse storage; the reserved plots will be released after shipment.'}
              </span>
            </div>

            <div className="modal-footer">
              <button className="button button-ghost" onClick={closeDelivery}>Cancel</button>
              <button
                className="button button-primary"
                disabled={busy || !selectedDelivery}
                onClick={() => void ship()}
              >
                {busy ? 'Shipping...' : selectedDelivery ? 'Ship order' : 'Choose a delivery option'}
              </button>
            </div>
          </section>
        </div>
      )}

      {notice && <Toast message={notice.message} error={notice.error} />}
    </>
  );
}

function unitsLabel(order: Order) {
  return `${orderUnits(order).toLocaleString('en-CA')} units · ${friendlyStatus(order.status)}`;
}
