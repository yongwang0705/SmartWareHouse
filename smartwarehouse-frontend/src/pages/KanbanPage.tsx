import { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowsRotate, faBell, faCalendarDays, faCircleExclamation,
  faClock, faGaugeHigh, faTableColumns, faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import StatCard from '../components/StatCard';
import { api } from '../services/api';
import type { KanbanBin } from '../types';

type Tone = 'healthy' | 'low' | 'reorder' | 'critical';

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
];

const daysLabel = (days: number | null | undefined) => {
  if (days == null) return '—';
  if (days <= 0) return 'today';
  return `${days}d ago`;
};

const percent = (value: number) => `${Math.round(Math.min(100, Math.max(0, value)))}%`;

function KanbanCard({ bin, tone }: { bin: KanbanBin; tone: Tone }) {
  const width = Math.min(100, Math.max(0, bin.fillPercent));

  return (
    <article className={`kanban-card kanban-card-${tone}`}>
      <div className="kanban-card-top">
        <div>
          <h4>{bin.productName}</h4>
          <span className="kanban-sku">PRD-{bin.productId} · {bin.binId}</span>
        </div>
        <span className={`kanban-jit ${bin.jitEnabled ? '' : 'kanban-jit-off'}`}>
          {bin.jitEnabled ? 'JIT' : 'STD'}
        </span>
      </div>

      <div className="kanban-stock-row">
        <div>
          <span className="kanban-stock-label">AVAILABLE / CAPACITY</span>
          <span className="kanban-stock-value">
            {bin.availableQuantity}<small> / {bin.capacity}</small>
          </span>
        </div>
        <span className="kanban-fill-label">{percent(bin.fillPercent)}</span>
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
    </article>
  );
}

export default function KanbanPage() {
  const [bins, setBins] = useState<KanbanBin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [jitOnly, setJitOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getKanban();
      setBins(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the JIT kanban board.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(
    () => (jitOnly ? bins.filter((bin) => bin.jitEnabled) : bins),
    [bins, jitOnly],
  );

  const grouped = useMemo(() => {
    const result = new Map<string, KanbanBin[]>();
    COLUMNS.forEach((column) => result.set(column.status, []));

    visible.forEach((bin) => {
      const key = COLUMNS.some((column) => column.status === bin.status)
        ? bin.status
        : 'HEALTHY';
      result.get(key)!.push(bin);
    });

    result.forEach((items) => items.sort(
      (a, b) => a.fillPercent - b.fillPercent || a.productId - b.productId,
    ));

    return result;
  }, [visible]);

  const jitCount = bins.filter((bin) => bin.jitEnabled).length;
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
      <div className="page-content">
        <div className="loading-panel">
          <span className="spinner" />
          <strong>Loading JIT kanban...</strong>
          <span>Reading bin capacity and inventory positions</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-toolbar">
        <div>
          <h2>JIT Kanban</h2>
          <p>Just-in-time replenishment board. Products move from healthy to reorder as stock is consumed.</p>
        </div>
        <button className="button button-secondary" onClick={() => void load()}>
          <FontAwesomeIcon icon={faArrowsRotate} /> Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <FontAwesomeIcon icon={faCircleExclamation} />
          <span>{error}</span>
          <button onClick={() => void load()}>Retry</button>
        </div>
      )}

      <div className="stats-grid stats-grid-small">
        <StatCard
          label="KANBAN BINS"
          value={String(bins.length)}
          detail={`${visible.length} in view`}
          icon={faTableColumns}
          tone="blue"
        />
        <StatCard
          label="JIT ENABLED"
          value={String(jitCount)}
          detail="Just-in-time replenishment"
          icon={faGaugeHigh}
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
        <div className="segmented">
          <button
            className={!jitOnly ? 'segmented-active' : ''}
            onClick={() => setJitOnly(false)}
          >
            All products ({bins.length})
          </button>
          <button
            className={jitOnly ? 'segmented-active' : ''}
            onClick={() => setJitOnly(true)}
          >
            JIT enabled ({jitCount})
          </button>
        </div>
        <span className="kanban-legend">
          <i className="kanban-dot kanban-dot-healthy" /> Healthy
          <i className="kanban-dot kanban-dot-low" /> Low
          <i className="kanban-dot kanban-dot-reorder" /> Reorder
          <i className="kanban-dot kanban-dot-critical" /> Out
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
                  <KanbanCard key={bin.productId} bin={bin} tone={column.tone} />
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
    </div>
  );
}
