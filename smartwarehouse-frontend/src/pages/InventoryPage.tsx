import { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowsRotate, faBoxesStacked, faCircleExclamation, faClipboardList,
  faTableColumns, faWarehouse,
} from '@fortawesome/free-solid-svg-icons';
import StatCard from '../components/StatCard';
import KanbanBoard from '../components/KanbanBoard';
import Toast from '../components/Toast';
import { api } from '../services/api';
import { addDays, toDateInput } from '../utils/format';
import type { InventoryItem, KanbanBin } from '../types';

const available = (item: InventoryItem) =>
  item.availableQuantity ?? item.quantity - item.reservedQuantity;

const stockAgeLabel = (days: number | null | undefined) => {
  if (days == null) return '—';
  if (days <= 0) return 'Today';
  return `${days} day${days === 1 ? '' : 's'}`;
};

interface Props {
  inventory: InventoryItem[];
  onRefreshStock: () => void;
}

type Tab = 'stock' | 'kanban';

export default function InventoryPage({ inventory, onRefreshStock }: Props) {
  const [tab, setTab] = useState<Tab>('stock');
  const [bins, setBins] = useState<KanbanBin[]>([]);
  const [kanbanLoading, setKanbanLoading] = useState(true);
  const [kanbanError, setKanbanError] = useState('');
  const [replenishingProductId, setReplenishingProductId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);

  const loadKanban = useCallback(async () => {
    setKanbanLoading(true);
    setKanbanError('');
    try {
      const data = await api.getKanban();
      setBins(
        (Array.isArray(data) ? data : []).filter((bin) => bin.jitEnabled),
      );
    } catch (err) {
      setKanbanError(
        err instanceof Error ? err.message : 'Could not load the JIT kanban board.',
      );
    } finally {
      setKanbanLoading(false);
    }
  }, []);

  useEffect(() => { void loadKanban(); }, [loadKanban]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 8000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const replenish = async (bin: KanbanBin) => {
    setReplenishingProductId(bin.productId);
    try {
      const plan = await api.replenishPlan({
        productId: bin.productId,
        targetQuantity: bin.capacity,
        planningStart: toDateInput(new Date()),
        planningEnd: toDateInput(addDays(new Date(), 14)),
      });
      setNotice({
        message: `Draft plan ${plan.planNumber} created for ${bin.productName}. Confirm it on the Production page.`,
        error: false,
      });
      await loadKanban();
    } catch (err) {
      setNotice({
        message: `Could not create replenishment plan: ${err instanceof Error ? err.message : 'unknown error'}`,
        error: true,
      });
    } finally {
      setReplenishingProductId(null);
    }
  };

  const refresh = () => {
    onRefreshStock();
    void loadKanban();
  };

  const totalUnits = inventory.reduce((sum, item) => sum + item.quantity, 0);
  const reservedUnits = inventory.reduce(
    (sum, item) => sum + item.reservedQuantity,
    0,
  );
  const lowStock = inventory.filter((item) => available(item) <= 10).length;

  // The kanban endpoint returns JIT-enabled inventory only, so a product's
  // presence here means JIT is on and its server-computed stock age is valid.
  const stockAgeByProduct = useMemo(
    () => new Map(bins.map((bin) => [bin.productId, bin.stockAgeDays])),
    [bins],
  );

  return (
    <div>
      <div className="page-toolbar">
        <div>
          <h2>Inventory levels</h2>
          <p>Stock positions, reservations and JIT replenishment.</p>
        </div>
        <button className="button button-secondary" onClick={refresh}>
          <FontAwesomeIcon icon={faArrowsRotate} /> Refresh data
        </button>
      </div>

      <div className="module-tabs" role="tablist" aria-label="Inventory sections">
        <button
          role="tab"
          aria-selected={tab === 'stock'}
          className={`module-tab ${tab === 'stock' ? 'module-tab-active' : ''}`}
          onClick={() => setTab('stock')}
        >
          <FontAwesomeIcon icon={faBoxesStacked} /> Stock overview
        </button>
        <button
          role="tab"
          aria-selected={tab === 'kanban'}
          className={`module-tab ${tab === 'kanban' ? 'module-tab-active' : ''}`}
          onClick={() => setTab('kanban')}
        >
          <FontAwesomeIcon icon={faTableColumns} /> JIT Kanban
        </button>
      </div>

      {tab === 'stock' ? (
        <>
          <div className="stats-grid stats-grid-small">
            <StatCard
              label="TOTAL PRODUCTS"
              value={String(inventory.length)}
              detail="Registered SKUs"
              icon={faBoxesStacked}
              tone="blue"
            />
            <StatCard
              label="TOTAL UNITS"
              value={totalUnits.toLocaleString('en-CA')}
              detail="Across all products"
              icon={faWarehouse}
              tone="green"
            />
            <StatCard
              label="RESERVED UNITS"
              value={String(reservedUnits)}
              detail="Allocated to orders"
              icon={faClipboardList}
              tone="violet"
            />
            <StatCard
              label="LOW STOCK"
              value={String(lowStock)}
              detail="10 or fewer available"
              icon={faCircleExclamation}
              tone="amber"
            />
          </div>

          <div className="table-card">
            <div className="table-heading">
              <div>
                <h3>Stock overview</h3>
                <p>{inventory.length} products · stock age shown for JIT-enabled items</p>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>PRODUCT</th>
                    <th>SKU</th>
                    <th>IN STOCK</th>
                    <th>RESERVED</th>
                    <th>AVAILABLE</th>
                    <th>STOCK LEVEL</th>
                    <th>STOCK AGE</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item) => {
                    const qty = available(item);
                    const ratio = item.quantity > 0
                      ? Math.min(100, (qty / item.quantity) * 100)
                      : 0;
                    const stockAge = stockAgeByProduct.get(item.productId);
                    const jitEnabled = stockAgeByProduct.has(item.productId);
                    return (
                      <tr key={item.productId}>
                        <td>
                          <span className="product-cell">
                            <span className="product-icon">
                              <FontAwesomeIcon icon={faBoxesStacked} />
                            </span>
                            <strong>{item.productName}</strong>
                            {jitEnabled && <span className="jit-badge">JIT</span>}
                          </span>
                        </td>
                        <td className="muted-cell">PRD-{item.productId}</td>
                        <td>{item.quantity}</td>
                        <td>{item.reservedQuantity}</td>
                        <td>
                          <strong className={qty <= 10 ? 'text-danger' : 'text-dark'}>
                            {qty}
                          </strong>
                        </td>
                        <td>
                          <div className="stock-meter">
                            <div className="stock-track">
                              <span
                                className={qty <= 10 ? 'stock-low' : ''}
                                style={{ width: `${ratio}%` }}
                              />
                            </div>
                            <small>{qty <= 10 ? 'Low stock' : 'Healthy'}</small>
                          </div>
                        </td>
                        <td>
                          {jitEnabled ? (
                            <strong className="text-dark">{stockAgeLabel(stockAge)}</strong>
                          ) : (
                            <span className="muted-cell">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {inventory.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state">No inventory items found.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <KanbanBoard
          bins={bins}
          loading={kanbanLoading}
          error={kanbanError}
          onRetry={() => void loadKanban()}
          onReplenish={replenish}
          replenishingProductId={replenishingProductId}
        />
      )}

      {notice && <Toast message={notice.message} error={notice.error} />}
    </div>
  );
}
