import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowsRotate, faBorderAll, faBox, faBoxesStacked,
  faCircleExclamation, faGaugeHigh, faLayerGroup, faLocationDot,
  faMagnifyingGlass, faPlus, faRulerCombined, faSnowflake, faWarehouse,
} from '@fortawesome/free-solid-svg-icons';
import Modal from '../components/Modal';
import StatCard from '../components/StatCard';
import Toast from '../components/Toast';
import { api } from '../services/api';
import type { InventoryItem, Warehouse, WarehousePlot } from '../types';

const PLOT_TYPES = ['RACK', 'BIN', 'FLOOR', 'BULK', 'COLD'];

const area = (value: number) =>
  Number(value).toLocaleString('en-CA', { maximumFractionDigits: 1 });

const squareMetres = (value: number) => `${area(value)} m²`;

const plotIcon = (type: string) => {
  switch (type.toUpperCase()) {
    case 'RACK': return faLayerGroup;
    case 'BIN': return faBox;
    case 'FLOOR': return faBorderAll;
    case 'BULK': return faBoxesStacked;
    case 'COLD': return faSnowflake;
    default: return faWarehouse;
  }
};

function PlotCard({ plot }: { plot: WarehousePlot }) {
  const status = plot.status.toLowerCase();

  return (
    <article className={`plot-card plot-card-${status}`}>
      <div className="plot-top">
        <span className="plot-code">{plot.code}</span>
        <span className="plot-type">
          <FontAwesomeIcon icon={plotIcon(plot.plotType)} /> {plot.plotType}
        </span>
      </div>

      <h5>{plot.name}</h5>

      <div className="plot-assignment">
        {plot.productId != null ? (
          <>
            <span className={`plot-kind ${plot.isProduct ? 'plot-kind-product' : 'plot-kind-material'}`}>
              {plot.isProduct ? 'PRODUCT' : 'MATERIAL'}
            </span>
            <strong>{plot.productName ?? `PRD-${plot.productId}`}</strong>
            <small>PRD-{plot.productId}</small>
          </>
        ) : (
          <span className="plot-unassigned">Unassigned</span>
        )}
      </div>

      <div className="plot-metrics">
        <span><strong>{area(plot.occupiedArea)}</strong> / {area(plot.surfaceArea)} m²</span>
        <span><strong>{plot.occupiedUnits}</strong> / {plot.capacityUnits} units</span>
      </div>

      <div className="plot-meter">
        <span
          className={`plot-fill-${status}`}
          style={{ width: `${Math.min(100, Math.max(0, plot.occupancyPercent))}%` }}
        />
      </div>

      <div className="plot-foot">
        <span className={`plot-status plot-status-${status}`}>{plot.status}</span>
        <span>{plot.occupancyPercent}% occupied</span>
      </div>
    </article>
  );
}

interface PlotTarget {
  id: number;
  name: string;
  code: string;
}

interface PlotFormProps {
  warehouse: PlotTarget;
  items: InventoryItem[];
  onClose: () => void;
  onCreated: (plot: WarehousePlot) => void;
}

function PlotForm({ warehouse, items, onClose, onCreated }: PlotFormProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [plotType, setPlotType] = useState(PLOT_TYPES[0]);
  const [surfaceArea, setSurfaceArea] = useState('100');
  const [occupiedArea, setOccupiedArea] = useState('0');
  const [productId, setProductId] = useState('');
  const [capacityUnits, setCapacityUnits] = useState('0');
  const [occupiedUnits, setOccupiedUnits] = useState('0');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');

    const surface = Number(surfaceArea);
    const occupied = Number(occupiedArea || 0);
    const capacity = Number(capacityUnits || 0);
    const occupiedQty = Number(occupiedUnits || 0);

    if (!code.trim()) {
      setFormError('Plot code is required.');
      return;
    }
    if (!name.trim()) {
      setFormError('Plot name is required.');
      return;
    }
    if (!Number.isFinite(surface) || surface <= 0) {
      setFormError('Surface area must be greater than zero.');
      return;
    }
    if (occupied < 0 || occupied > surface) {
      setFormError('Occupied area must be between 0 and the surface area.');
      return;
    }
    if (capacity < 0 || occupiedQty < 0) {
      setFormError('Unit counts cannot be negative.');
      return;
    }
    if (capacity > 0 && occupiedQty > capacity) {
      setFormError('Occupied units cannot exceed capacity.');
      return;
    }

    setBusy(true);
    try {
      onCreated(await api.createWarehousePlot(warehouse.id, {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        plotType,
        surfaceArea: surface,
        occupiedArea: occupied,
        productId: productId === '' ? null : Number(productId),
        capacityUnits: capacity,
        occupiedUnits: occupiedQty,
      }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add the plot.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      eyebrow={`WAREHOUSE ${warehouse.code}`}
      title="Add plot or bucket"
      subtitle={`Create a physical storage location in ${warehouse.name}.`}
      onClose={onClose}
      footer={<>
        <button type="button" className="button button-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" form="plot-form" className="button button-primary" disabled={busy}>
          {busy ? 'Adding...' : 'Add plot'}
        </button>
      </>}
    >
      <form id="plot-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="field-label">
            Plot code
            <input
              className="form-input"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="A-04"
              required
            />
          </label>
          <label className="field-label">
            Plot name
            <input
              className="form-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Reserve rack A-04"
              required
            />
          </label>
          <label className="field-label">
            Type
            <select
              className="form-input"
              value={plotType}
              onChange={(event) => setPlotType(event.target.value)}
            >
              {PLOT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label className="field-label">
            Surface area (m²)
            <input
              className="form-input"
              type="number"
              min="0.01"
              step="0.01"
              value={surfaceArea}
              onChange={(event) => setSurfaceArea(event.target.value)}
              required
            />
          </label>
          <label className="field-label">
            Occupied area (m²)
            <input
              className="form-input"
              type="number"
              min="0"
              step="0.01"
              value={occupiedArea}
              onChange={(event) => setOccupiedArea(event.target.value)}
            />
          </label>
          <label className="field-label">
            Assigned item
            <select
              className="form-input"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              <option value="">Unassigned</option>
              {items.map((item) => (
                <option key={item.productId} value={item.productId}>
                  {item.productName} (PRD-{item.productId})
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Capacity (units)
            <input
              className="form-input"
              type="number"
              min="0"
              value={capacityUnits}
              onChange={(event) => setCapacityUnits(event.target.value)}
            />
          </label>
          <label className="field-label">
            Occupied units
            <input
              className="form-input"
              type="number"
              min="0"
              value={occupiedUnits}
              onChange={(event) => setOccupiedUnits(event.target.value)}
            />
          </label>
        </div>

        {formError && <div className="form-error">{formError}</div>}

        <div className="plan-hint">
          <FontAwesomeIcon icon={faWarehouse} />
          <span>Assigning an item links this plot to inventory. Leave it unassigned for staging or reserve space.</span>
        </div>
      </form>
    </Modal>
  );
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<number | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [plotTarget, setPlotTarget] = useState<PlotTarget | null>(null);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [warehouseData, inventoryData] = await Promise.all([
        api.getWarehouses(),
        api.getInventory().catch(() => [] as InventoryItem[]),
      ]);
      setWarehouses(Array.isArray(warehouseData) ? warehouseData : []);
      setItems(Array.isArray(inventoryData) ? inventoryData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the warehouse layout.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const query = search.trim().toLowerCase();

  const visibleWarehouses = useMemo(() => warehouses
    .filter((warehouse) => selected === 'ALL' || warehouse.id === selected)
    .map((warehouse) => ({
      ...warehouse,
      plots: warehouse.plots.filter((plot) => {
        if (!query) return true;
        return `${plot.code} ${plot.name} ${plot.plotType} ${plot.productId ?? ''} ${plot.productName ?? ''}`
          .toLowerCase()
          .includes(query);
      }),
    }))
    .filter((warehouse) => !query || warehouse.plots.length > 0),
  [warehouses, selected, query]);

  const totalSurface = warehouses.reduce((sum, warehouse) => sum + warehouse.surfaceArea, 0);
  const totalOccupied = warehouses.reduce((sum, warehouse) => sum + warehouse.occupiedArea, 0);
  const utilization = totalSurface > 0
    ? Math.round((totalOccupied / totalSurface) * 1000) / 10
    : 0;

  if (loading) {
    return (
      <div className="loading-panel">
        <span className="spinner" />
        <strong>Loading warehouses...</strong>
        <span>Reading physical layout and plot assignments</span>
      </div>
    );
  }

  return (
    <>
      <div className="page-toolbar">
        <div>
          <h2>Warehouse footprint</h2>
          <p>Physical sites, storage plots and how much space is taken.</p>
        </div>
        <button className="button button-secondary" onClick={() => void load()}>
          <FontAwesomeIcon icon={faArrowsRotate} /> Refresh data
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
          label="WAREHOUSES"
          value={String(warehouses.length)}
          detail="Active physical sites"
          icon={faWarehouse}
          tone="blue"
        />
        <StatCard
          label="TOTAL SURFACE"
          value={squareMetres(totalSurface)}
          detail="Registered floor area"
          icon={faRulerCombined}
          tone="green"
        />
        <StatCard
          label="OCCUPIED AREA"
          value={squareMetres(totalOccupied)}
          detail="Taken by stored goods"
          icon={faBoxesStacked}
          tone="violet"
        />
        <StatCard
          label="UTILIZATION"
          value={`${utilization}%`}
          detail="Occupied / total surface"
          icon={faGaugeHigh}
          tone="amber"
        />
      </div>

      <div className="warehouse-toolbar">
        <div className="segmented section-tabs warehouse-filter">
          <button
            className={selected === 'ALL' ? 'segmented-active' : ''}
            onClick={() => setSelected('ALL')}
          >
            All warehouses ({warehouses.length})
          </button>
          {warehouses.map((warehouse) => (
            <button
              key={warehouse.id}
              className={selected === warehouse.id ? 'segmented-active' : ''}
              onClick={() => setSelected(warehouse.id)}
            >
              {warehouse.code}
            </button>
          ))}
        </div>

        <label className="warehouse-search">
          <FontAwesomeIcon icon={faMagnifyingGlass} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search plot, SKU or assigned item"
          />
        </label>
      </div>

      {visibleWarehouses.length === 0 ? (
        <div className="table-card">
          <div className="empty-state">
            {warehouses.length === 0
              ? 'No warehouses configured in the backend database.'
              : 'No plots match this search.'}
          </div>
        </div>
      ) : (
        visibleWarehouses.map((warehouse) => {
          const assigned = warehouse.plots.filter((plot) => plot.productId != null).length;

          return (
            <section key={warehouse.id} className="warehouse-card">
              <header className="warehouse-head">
                <div>
                  <div className="warehouse-title">
                    <FontAwesomeIcon icon={faWarehouse} />
                    <h3>{warehouse.name}</h3>
                    <span className="warehouse-code">{warehouse.code}</span>
                  </div>
                  {warehouse.address && (
                    <p className="warehouse-address">
                      <FontAwesomeIcon icon={faLocationDot} /> {warehouse.address}
                    </p>
                  )}
                </div>
                <div className="warehouse-head-actions">
                  <button
                    className="mini-button"
                    onClick={() => setPlotTarget({
                      id: warehouse.id,
                      name: warehouse.name,
                      code: warehouse.code,
                    })}
                  >
                    <FontAwesomeIcon icon={faPlus} /> Add plot
                  </button>
                  <span className="status-pill status-confirmed">ACTIVE</span>
                </div>
              </header>

              <div className="warehouse-metrics">
                <div><small>SURFACE AREA</small><strong>{squareMetres(warehouse.surfaceArea)}</strong></div>
                <div><small>ALLOCATED TO PLOTS</small><strong>{squareMetres(warehouse.allocatedArea)}</strong></div>
                <div><small>OCCUPIED</small><strong>{squareMetres(warehouse.occupiedArea)}</strong></div>
                <div><small>UTILIZATION</small><strong>{warehouse.utilizationPercent}%</strong></div>
                <div className="warehouse-meter" title={`${warehouse.utilizationPercent}% of total surface occupied`}>
                  <span style={{ width: `${Math.min(100, Math.max(0, warehouse.utilizationPercent))}%` }} />
                </div>
              </div>

              <div className="warehouse-plot-head">
                <h4>Plots &amp; buckets</h4>
                <span>{warehouse.plots.length} locations · {assigned} assigned</span>
              </div>

              <div className="warehouse-plot-grid">
                {warehouse.plots.map((plot) => (
                  <PlotCard key={plot.id} plot={plot} />
                ))}
                {warehouse.plots.length === 0 && (
                  <div className="empty-state">No plots match this search.</div>
                )}
              </div>
            </section>
          );
        })
      )}

      {plotTarget && (
        <PlotForm
          warehouse={plotTarget}
          items={items}
          onClose={() => setPlotTarget(null)}
          onCreated={async (plot) => {
            const warehouseName = plotTarget.name;
            setPlotTarget(null);
            setNotice({
              message: `Plot ${plot.code} added to ${warehouseName}.`,
              error: false,
            });
            await load();
          }}
        />
      )}

      {notice && <Toast message={notice.message} error={notice.error} />}
    </>
  );
}
