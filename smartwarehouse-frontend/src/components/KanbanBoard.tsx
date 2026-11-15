import { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowsRotate, faBell, faBoxesStacked, faCalendarDays, faCircleExclamation,
  faClock, faGaugeHigh, faTableColumns, faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import StatCard from './StatCard';
import type { KanbanBin } from '../types';

type Tone = 'healthy' | 'low' | 'reorder' | 'critical' | 'over';

interface Column {
  status: string;
  label: string;
  hint: string;
  tone: Tone;
}

const COLUMNS: Column[] = [
  { status: 'HEALTHY', label: 'Healthy', hint: 'Above reorder point', tone: 'healthy' },
  { status: 'LOW', label: 'Low stock', hint: '50% or less of capacity', tone: 'low' },
  { status: 'REORDER', label: 'Reorder now', hint: 'At or below JIT trigger', tone: 'reorder' },
  { status: 'CRITICAL', label: 'Out of stock', hint: 'No available units', tone: 'critical' },
  { status: 'OVERSTOCK', label: 'Over capacity', hint: 'Above bin capacity', tone: 'over' },
];

const daysLabel = (days: number | null | undefined) => {
  if (days == null) return '—';
  if (days <= 0) return 'today';
  return `${days}d ago`;
};

const percent = (value: number) => `${Math.round(Math.min(100, Math.max(0, value)))}%`;

interface KanbanCardProps {
  bin: KanbanBin;
  tone: Tone;
  replenishing: boolean;
  onReplenish?: (bin: KanbanBin) => void;
}

function KanbanCard({ bin, tone, replenishing, onReplenish }: KanbanCardProps) {
  const width = Math.min(100, Math.max(0, bin.fillPercent));

  return (
    <article className={`kanban-card kanban-card-${tone}`}>
      <div className="kanban-card-top">
        <div>
          <h4>{bin.productName}</h4>
          <span className="kanban-sku">PRD-{bin.productId} · {bin.binId}</span>
        </div>
        <span className="kanban-jit">JIT</span>
      </div>

      <div className="kanban-stock-row">
        <div>
          <span className="kanban-stock-label">AVAILABLE / CAPACITY</span>
          <span className="kanban-stock-value">
            {bin.availableQuantity}<small> / {bin.capacity}</small>
          </span>
        </div>
        <span className="kanban-fill-label">
          {bin.status === 'OVERSTOCK'
            ? `+${(bin.availableQuantity - bin.capacity).toLocaleString('en-CA')} over`
            : percent(bin.fillPercent)}
        </span>
      </div>

      <div className="kanban-meter">
        <span className={`kanban-fill-${tone}`} style={{ width: `${width}%` }} />
      </div>

      <div className="kanban-facts">
        <span>On hand <strong>{bin.currentStock}</strong></span>
        <span>Reserved <strong>{bin.reservedQuantity}</strong></span>
        <span>Trigger <strong>{bin.triggerLevel}</strong></span>
      </div>

      <div className="kanban-ages">
        <span title="Days since the inventory record last changed">
          <FontAwesomeIcon icon={faClock} /> Updated {daysLabel(bin.stockAgeDays)}
        </span>
        <span title="Days since this kanban bin was deployed">
          <FontAwesomeIcon icon={faCalendarDays} /> Deployed {daysLabel(bin.deployedDays)}
        </span>
        {bin.daysSinceTrigger != null && (
          <span className="kanban-trigger-age">
            <FontAwesomeIcon icon={faBell} /> Triggered {daysLabel(bin.daysSinceTrigger)}
          </span>
        )}
      </div>

      {onReplenish && ['LOW', 'REORDER', 'CRITICAL'].includes(bin.status) && (
        <div className="kanban-actions">
          <button
            type="button"
            className="mini-button"
            disabled={replenishing}
            onClick={() => onReplenish(bin)}
          >
            <FontAwesomeIcon icon={faArrowsRotate} />
            {replenishing ? 'Planning...' : 'Replenish to capacity'}
          </button>
        </div>
      )}
    </article>
  );
}

interface Props {
  bins: KanbanBin[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onReplenish?: (bin: KanbanBin) => void;
  replenishingProductId?: number | null;
}

export default function KanbanBoard({
  bins, loading, error, onRetry, onReplenish, replenishingProductId,
}: Props) {
  const grouped = useMemo(() => {
    const result = new Map<string, KanbanBin[]>();
    COLUMNS.forEach((column) => result.set(column.status, []));

    bins.forEach((bin) => {
      const key = COLUMNS.some((column) => column.status === bin.status)
        ? bin.status
        : 'HEALTHY';
      result.get(key)!.push(bin);
    });

    result.forEach((items) => items.sort(
      (a, b) => a.fillPercent - b.fillPercent || a.productId - b.productId,
    ));

    return result;
  }, [bins]);

  const totalUnits = bins.reduce((sum, bin) => sum + bin.currentStock, 0);
  const needsReplenishment = bins.filter(
    (bin) => bin.status === 'REORDER' || bin.status === 'CRITICAL',
  ).length;
  const stockAges = bins
    .map((bin) => bin.stockAgeDays)
    .filter((value): value is number => value != null);
  const averageAge = stockAges.length > 0
    ? Math.round(stockAges.reduce((sum, value) => sum + value, 0) / stockAges.length)
    : null;

  if (loading) {
    return (
      <div className="loading-panel">
        <span className="spinner" />
        <strong>Loading JIT kanban...</strong>
        <span>Reading bin capacity and inventory positions</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <FontAwesomeIcon icon={faCircleExclamation} />
        <span>{error}</span>
        <button onClick={onRetry}>Retry</button>
      </div>
    );
  }

  return (
    <>
      <div className="stats-grid stats-grid-small">
        <StatCard
          label="KANBAN BINS"
          value={String(bins.length)}
          detail="JIT-enabled inventory"
          icon={faTableColumns}
          tone="blue"
        />
        <StatCard
          label="ON-HAND UNITS"
          value={totalUnits.toLocaleString('en-CA')}
          detail="Across JIT inventory"
          icon={faBoxesStacked}
          tone="green"
        />
        <StatCard
          label="NEEDS REPLENISHMENT"
          value={String(needsReplenishment)}
          detail="Reorder or out of stock"
          icon={faTriangleExclamation}
          tone="amber"
        />
        <StatCard
          label="AVG STOCK AGE"
          value={averageAge == null ? '—' : `${averageAge}d`}
          detail="Since last inventory update"
          icon={faClock}
          tone="violet"
        />
      </div>

      <div className="kanban-toolbar">
        <span className="kanban-scope">
          <FontAwesomeIcon icon={faGaugeHigh} /> Showing JIT-enabled inventory only
        </span>
        <span className="kanban-legend">
          <i className="kanban-dot kanban-dot-healthy" /> Healthy
          <i className="kanban-dot kanban-dot-low" /> Low
          <i className="kanban-dot kanban-dot-reorder" /> Reorder
          <i className="kanban-dot kanban-dot-critical" /> Out
          <i className="kanban-dot kanban-dot-over" /> Over
        </span>
      </div>

      <div className="kanban-board">
        {COLUMNS.map((column) => {
          const items = grouped.get(column.status) ?? [];
          return (
            <section key={column.status} className={`kanban-column kanban-column-${column.tone}`}>
              <header className="kanban-column-head">
                <div>
                  <div className="kanban-column-title">
                    <span className={`kanban-dot kanban-dot-${column.tone}`} />
                    <h3>{column.label}</h3>
                  </div>
                  <p>{column.hint}</p>
                </div>
                <span className="kanban-count">{items.length}</span>
              </header>

              <div className="kanban-cards">
                {items.map((bin) => (
                  <KanbanCard
                    key={bin.productId}
                    bin={bin}
                    tone={column.tone}
                    replenishing={replenishingProductId === bin.productId}
                    onReplenish={onReplenish}
                  />
                ))}
                {items.length === 0 && <div className="kanban-empty">No products</div>}
              </div>
            </section>
          );
        })}
      </div>

      <p className="kanban-note">
        <FontAwesomeIcon icon={faClock} />
        Stock age is measured from the last inventory update. Deployed is measured from the
        kanban bin record. Reorder signals fire when available stock reaches the bin trigger level.
      </p>
    </>
  );
}
