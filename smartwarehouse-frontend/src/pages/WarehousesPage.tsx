import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowsRotate, faBorderAll, faBox, faBoxesStacked,
  faCircleExclamation, faGaugeHigh, faLayerGroup, faLocationDot,
  faMagnifyingGlass, faPen, faPlus, faRightLeft, faRulerCombined,
  faSnowflake, faTrash, faWarehouse,
} from '@fortawesome/free-solid-svg-icons';
import Modal from '../components/Modal';
import StatCard from '../components/StatCard';
import Toast from '../components/Toast';
import { api } from '../services/api';
import type {
  InventoryItem, Order, Warehouse, WarehousePlot,
} from '../types';

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

interface PlotCardProps {
  plot: WarehousePlot;
  onEdit: () => void;
  onMove: () => void;
  onDelete: () => void;
}

function PlotCard({ plot, onEdit, onMove, onDelete }: PlotCardProps) {
  const status = plot.status.toLowerCase();
  const canMove = plot.productId != null && plot.occupiedUnits > 0;

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

      <div className="plot-actions">
        <button type="button" className="mini-button" onClick={onEdit}>
          <FontAwesomeIcon icon={faPen} /> Edit
        </button>
        <button
          type="button"
          className="mini-button"
          onClick={onMove}
          disabled={!canMove}
          title={canMove ? 'Move item to another plot' : 'No assigned stock to move'}
        >
          <FontAwesomeIcon icon={faRightLeft} /> Move
        </button>
        <button type="button" className="mini-button mini-button-danger" onClick={onDelete}>
          <FontAwesomeIcon icon={faTrash} /> Delete
        </button>
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
  plot?: WarehousePlot;
  onClose: () => void;
  onSaved: (plot: WarehousePlot) => void;
}

function PlotForm({ warehouse, items, plot, onClose, onSaved }: PlotFormProps) {
  const [code, setCode] = useState(plot?.code ?? '');
  const [name, setName] = useState(plot?.name ?? '');
  const [plotType, setPlotType] = useState(plot?.plotType ?? PLOT_TYPES[0]);
  const [surfaceArea, setSurfaceArea] = useState(plot ? String(plot.surfaceArea) : '100');
  const [occupiedArea, setOccupiedArea] = useState(plot ? String(plot.occupiedArea) : '0');
  const [productId, setProductId] = useState(
    plot?.productId != null ? String(plot.productId) : '',
  );
  const [capacityUnits, setCapacityUnits] = useState(plot ? String(plot.capacityUnits) : '0');
  const [occupiedUnits, setOccupiedUnits] = useState(plot ? String(plot.occupiedUnits) : '0');
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
      const payload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        plotType,
        surfaceArea: surface,
        occupiedArea: occupied,
        productId: productId === '' ? null : Number(productId),
        capacityUnits: capacity,
        occupiedUnits: occupiedQty,
      };
      const saved = plot
        ? await api.updateWarehousePlot(warehouse.id, plot.id, payload)
        : await api.createWarehousePlot(warehouse.id, payload);

      onSaved(saved);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the plot.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      eyebrow={`WAREHOUSE ${warehouse.code}`}
      title={plot ? 'Edit plot or bucket' : 'Add plot or bucket'}
      subtitle={plot
        ? `Update ${plot.code} in ${warehouse.name}.`
        : `Create a physical storage location in ${warehouse.name}.`}
      onClose={onClose}
      footer={<>
        <button type="button" className="button button-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" form="plot-form" className="button button-primary" disabled={busy}>
          {busy ? 'Saving...' : plot ? 'Save changes' : 'Add plot'}
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
          <span>Assigning an item links this plot to inventory. Leave it unassigned for staging or reserve space. Use <strong>Move</strong> on a plot card to transfer stocked units.</span>
        </div>
      </form>
    </Modal>
  );
}

interface MovePlotFormProps {
  warehouse: Warehouse;
  plot: WarehousePlot;
  onClose: () => void;
  onMoved: () => void;
}

function MovePlotForm({ warehouse, plot, onClose, onMoved }: MovePlotFormProps) {
  const destinations = useMemo(
    () => warehouse.plots.filter((candidate) => {
      if (candidate.id === plot.id) return false;
      if (candidate.productId == null) return candidate.occupiedUnits === 0;
      return candidate.productId === plot.productId;
    }),
    [warehouse.plots, plot.id, plot.productId],
  );

  const [destinationPlotId, setDestinationPlotId] = useState(
    destinations[0] ? String(destinations[0].id) : '',
  );
  const [quantity, setQuantity] = useState(String(plot.occupiedUnits));
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');

    const qty = Number(quantity);

    if (!destinationPlotId) {
      setFormError('Choose a destination plot.');
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      setFormError('Quantity must be a positive whole number.');
      return;
    }
    if (qty > plot.occupiedUnits) {
      setFormError(`Only ${plot.occupiedUnits} units are available in ${plot.code}.`);
      return;
    }

    setBusy(true);
    try {
      await api.moveWarehousePlotItems(warehouse.id, plot.id, {
        destinationPlotId: Number(destinationPlotId),
        quantity: qty,
      });
      onMoved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not move the stock.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      eyebrow={`WAREHOUSE ${warehouse.code}`}
      title="Move stock between plots"
      subtitle={`Transfer ${plot.productName ?? `PRD-${plot.productId}`} from ${plot.code}.`}
      onClose={onClose}
      footer={<>
        <button type="button" className="button button-ghost" onClick={onClose}>Cancel</button>
        <button
          type="submit"
          form="move-plot-form"
          className="button button-primary"
          disabled={busy || destinations.length === 0}
        >
          {busy ? 'Moving...' : 'Move stock'}
        </button>
      </>}
    >
      <form id="move-plot-form" onSubmit={submit}>
        <div className="detail-summary">
          <div>
            <small>ITEM</small>
            <strong>{plot.productName ?? `PRD-${plot.productId}`}</strong>
          </div>
          <div>
            <small>SOURCE PLOT</small>
            <strong>{plot.code} · {plot.name}</strong>
          </div>
          <div>
            <small>UNITS IN SOURCE</small>
            <strong>{plot.occupiedUnits} units</strong>
          </div>
        </div>

        <div className="form-grid">
          <label className="field-label">
            Destination plot
            <select
              className="form-input"
              value={destinationPlotId}
              onChange={(event) => setDestinationPlotId(event.target.value)}
              disabled={destinations.length === 0}
            >
              {destinations.length === 0 && <option value="">No compatible destination</option>}
              {destinations.map((destination) => (
                <option key={destination.id} value={destination.id}>
                  {destination.code} · {destination.name} · {destination.productId == null
                    ? 'empty'
                    : `${destination.productName ?? `PRD-${destination.productId}`} (${destination.occupiedUnits} units)`}
                </option>
              ))}
            </select>
          </label>

          <label className="field-label">
            Quantity to move
            <input
              className="form-input"
              type="number"
              min="1"
              max={plot.occupiedUnits}
              step="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
            />
          </label>
        </div>

        {destinations.length === 0 && (
          <div className="form-error">
            No compatible destination plot. The destination must be empty, or already assigned to the same item.
          </div>
        )}

        {formError && <div className="form-error">{formError}</div>}

        <div className="plan-hint">
          <FontAwesomeIcon icon={faRightLeft} />
          <span>
            Moving the full quantity clears the source assignment. Moving into an empty plot assigns the item there;
            moving into a plot with the same item combines the units.
          </span>
        </div>
      </form>
    </Modal>
  );
}

interface StoreDraft {
  key: string;
  productId: number;
  plotId: string;
  quantity: string;
}

let draftKeySequence = 0;
const nextDraftKey = () => `store-draft-${++draftKeySequence}`;

interface RequiredItem {
  productId: number;
  productName: string;
  quantity: number;
}

const aggregateOrderItems = (order?: Order): RequiredItem[] => {
  const items = new Map<number, RequiredItem>();

  (order?.items ?? []).forEach((item) => {
    const existing = items.get(item.productId);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      items.set(item.productId, {
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
      });
    }
  });

  return [...items.values()];
};

const draftsForOrder = (order?: Order): StoreDraft[] =>
  aggregateOrderItems(order).map((item) => ({
    key: nextDraftKey(),
    productId: item.productId,
    plotId: '',
    quantity: String(item.quantity),
  }));

interface StoreOrderFormProps {
  orders: Order[];
  warehouses: Warehouse[];
  onClose: () => void;
  onStored: () => void;
}

function StoreOrderForm({
  orders, warehouses, onClose, onStored,
}: StoreOrderFormProps) {
  const storableOrders = useMemo(
    () => orders.filter((order) => order.status === 'COMPLETED'),
    [orders],
  );
  const [orderId, setOrderId] = useState(
    storableOrders[0] ? String(storableOrders[0].id) : '',
  );
  const selectedOrder = storableOrders.find(
    (order) => String(order.id) === orderId,
  );
  const [drafts, setDrafts] = useState<StoreDraft[]>(
    () => draftsForOrder(storableOrders[0]),
  );
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const requiredItems = useMemo(
    () => aggregateOrderItems(selectedOrder),
    [selectedOrder],
  );

  const chooseOrder = (value: string) => {
    setOrderId(value);
    const order = storableOrders.find(
      (item) => String(item.id) === value,
    );
    setDrafts(draftsForOrder(order));
    setFormError('');
  };

  const updateDraft = (
    key: string,
    field: 'plotId' | 'quantity',
    value: string,
  ) => setDrafts((current) => current.map((draft) => (
    draft.key === key ? { ...draft, [field]: value } : draft
  )));

  const addDraft = (item: RequiredItem) => setDrafts((current) => {
    const allocated = current
      .filter((draft) => draft.productId === item.productId)
      .reduce((sum, draft) => sum + Number(draft.quantity || 0), 0);

    return [...current, {
      key: nextDraftKey(),
      productId: item.productId,
      plotId: '',
      quantity: String(Math.max(0, item.quantity - allocated)),
    }];
  });

  const removeDraft = (key: string) =>
    setDrafts((current) => current.filter((draft) => draft.key !== key));

  const plotTaken = (plotId: number, exceptKey: string) =>
    drafts.some((draft) => draft.key !== exceptKey
      && draft.plotId === String(plotId));

  const plotCompatible = (
    plot: WarehousePlot,
    productId: number,
    draftKey: string,
  ) => {
    if (plotTaken(plot.id, draftKey)) return false;
    if (plot.productId != null && plot.productId !== productId) return false;
    if (plot.productId == null && plot.occupiedUnits > 0) return false;
    if (plot.capacityUnits > 0
        && plot.occupiedUnits >= plot.capacityUnits) return false;
    return true;
  };

  const allocatedFor = (productId: number) => drafts
    .filter((draft) => draft.productId === productId)
    .reduce((sum, draft) => sum + Number(draft.quantity || 0), 0);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');

    if (!selectedOrder) {
      setFormError('Choose a completed order.');
      return;
    }

    const allocations = drafts.map((draft) => ({
      plotId: Number(draft.plotId),
      productId: draft.productId,
      quantity: Number(draft.quantity),
    }));

    if (allocations.some((allocation) => !allocation.plotId
      || !Number.isInteger(allocation.quantity)
      || allocation.quantity <= 0)) {
      setFormError('Choose a plot and a positive whole quantity for every allocation.');
      return;
    }

    for (const item of requiredItems) {
      const allocated = allocatedFor(item.productId);
      if (allocated !== item.quantity) {
        setFormError(
          `${item.productName}: allocate exactly ${item.quantity} units (currently ${allocated}).`,
        );
        return;
      }
    }

    setBusy(true);
    try {
      await api.storeOrder(selectedOrder.id, allocations);
      onStored();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not store the order.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      eyebrow="WAREHOUSE STORAGE"
      title="Store products in warehouse"
      subtitle="Place a completed order's units into one or more plots before shipping."
      onClose={onClose}
      wide
      footer={<>
        <button type="button" className="button button-ghost" onClick={onClose}>Cancel</button>
        <button
          type="submit"
          form="store-order-form"
          className="button button-primary"
          disabled={busy || !selectedOrder}
        >
          {busy ? 'Storing...' : 'Store order'}
        </button>
      </>}
    >
      {storableOrders.length === 0 ? (
        <div className="empty-state">
          No completed orders are waiting to be stored. Complete an order first.
        </div>
      ) : (
        <form id="store-order-form" onSubmit={submit}>
          <label className="field-label">
            Completed order
            <select
              className="form-input"
              value={orderId}
              onChange={(event) => chooseOrder(event.target.value)}
            >
              {storableOrders.map((order) => {
                const units = (order.items ?? []).reduce(
                  (sum, item) => sum + item.quantity,
                  0,
                );
                return (
                  <option key={order.id} value={order.id}>
                    #ORD-{order.id} · Customer #{order.customerId} · {units} units
                  </option>
                );
              })}
            </select>
          </label>

          <div className="store-items">
            {requiredItems.map((item) => {
              const itemDrafts = drafts.filter(
                (draft) => draft.productId === item.productId,
              );
              const allocated = allocatedFor(item.productId);
              const remaining = item.quantity - allocated;

              return (
                <section className="store-item" key={item.productId}>
                  <header className="store-item-head">
                    <div>
                      <strong>{item.productName}</strong>
                      <small>PRD-{item.productId}</small>
                    </div>
                    <span className={`store-item-count ${remaining === 0 ? 'store-item-count-done' : ''}`}>
                      {allocated} / {item.quantity} units allocated
                    </span>
                  </header>

                  {itemDrafts.map((draft) => (
                    <div className="store-allocation-row" key={draft.key}>
                      <select
                        className="form-input"
                        value={draft.plotId}
                        onChange={(event) => updateDraft(draft.key, 'plotId', event.target.value)}
                        required
                      >
                        <option value="">Choose plot…</option>
                        {warehouses.map((warehouse) => {
                          const plots = warehouse.plots.filter(
                            (plot) => plotCompatible(plot, item.productId, draft.key),
                          );
                          if (plots.length === 0) return null;

                          return (
                            <optgroup key={warehouse.id} label={`${warehouse.code} · ${warehouse.name}`}>
                              {plots.map((plot) => (
                                <option key={plot.id} value={plot.id}>
                                  {plot.code} · {plot.name} · {plot.productId == null
                                    ? 'empty'
                                    : plot.productName ?? `PRD-${plot.productId}`} · {plot.occupiedUnits}/{plot.capacityUnits || '∞'}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </select>

                      <input
                        className="form-input store-quantity"
                        type="number"
                        min="1"
                        max={item.quantity}
                        step="1"
                        value={draft.quantity}
                        onChange={(event) => updateDraft(draft.key, 'quantity', event.target.value)}
                        required
                      />

                      <button
                        type="button"
                        className="remove-line"
                        aria-label="Remove allocation"
                        onClick={() => removeDraft(draft.key)}
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="add-line-button"
                    onClick={() => addDraft(item)}
                  >
                    <FontAwesomeIcon icon={faPlus} /> Add another plot
                  </button>
                </section>
              );
            })}
          </div>

          {formError && <div className="form-error">{formError}</div>}

          <div className="plan-hint">
            <FontAwesomeIcon icon={faWarehouse} />
            <span>
              Allocate every ordered unit across one or more plots. The order moves to
              <strong> In warehouse</strong>, and shipping later releases the plots.
              If free capacity is too low, add or clear a plot first.
            </span>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [storeOpen, setStoreOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<number | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [plotForm, setPlotForm] = useState<{
    warehouse: PlotTarget;
    plot?: WarehousePlot;
  } | null>(null);
  const [moveForm, setMoveForm] = useState<{
    warehouse: Warehouse;
    plot: WarehousePlot;
  } | null>(null);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [warehouseData, inventoryData, orderData] = await Promise.all([
        api.getWarehouses(),
        api.getInventory().catch(() => [] as InventoryItem[]),
        api.getOrders().catch(() => [] as Order[]),
      ]);
      setWarehouses(Array.isArray(warehouseData) ? warehouseData : []);
      setItems(Array.isArray(inventoryData) ? inventoryData : []);
      setOrders(Array.isArray(orderData) ? orderData : []);
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

  const openMove = (warehouseId: number, plot: WarehousePlot) => {
    const warehouse = warehouses.find((item) => item.id === warehouseId);
    if (warehouse) setMoveForm({ warehouse, plot });
  };

  const deletePlot = async (warehouseId: number, plot: WarehousePlot) => {
    const contents = plot.productId != null
      ? ` It currently holds ${plot.occupiedUnits} units of ${plot.productName ?? `PRD-${plot.productId}`}.`
      : '';
    if (!window.confirm(
      `Delete plot ${plot.code} (${plot.name})?${contents} This removes the storage location only; inventory stock is unchanged.`,
    )) return;

    try {
      await api.deleteWarehousePlot(warehouseId, plot.id);
      setNotice({ message: `Plot ${plot.code} deleted.`, error: false });
      await load();
    } catch (err) {
      setNotice({
        message: err instanceof Error ? err.message : 'Could not delete the plot.',
        error: true,
      });
    }
  };

  const completedOrders = orders.filter(
    (order) => order.status === 'COMPLETED',
  ).length;

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
          <p>Physical sites, storage plots and the units placed in them. Inventory availability excludes reserved stock.</p>
        </div>
        <div className="toolbar-actions">
          <button className="button button-primary" onClick={() => setStoreOpen(true)}>
            <FontAwesomeIcon icon={faBox} /> Store products
            {completedOrders > 0 ? ` (${completedOrders})` : ''}
          </button>
          <button className="button button-secondary" onClick={() => void load()}>
            <FontAwesomeIcon icon={faArrowsRotate} /> Refresh data
          </button>
        </div>
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
                    onClick={() => setPlotForm({
                      warehouse: {
                        id: warehouse.id,
                        name: warehouse.name,
                        code: warehouse.code,
                      },
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
                  <PlotCard
                    key={plot.id}
                    plot={plot}
                    onEdit={() => setPlotForm({
                      warehouse: {
                        id: warehouse.id,
                        name: warehouse.name,
                        code: warehouse.code,
                      },
                      plot,
                    })}
                    onMove={() => openMove(warehouse.id, plot)}
                    onDelete={() => void deletePlot(warehouse.id, plot)}
                  />
                ))}
                {warehouse.plots.length === 0 && (
                  <div className="empty-state">No plots match this search.</div>
                )}
              </div>
            </section>
          );
        })
      )}

      {plotForm && (
        <PlotForm
          key={plotForm.plot?.id ?? 'new'}
          warehouse={plotForm.warehouse}
          items={items}
          plot={plotForm.plot}
          onClose={() => setPlotForm(null)}
          onSaved={async (saved) => {
            const warehouseName = plotForm.warehouse.name;
            const editing = plotForm.plot != null;
            setPlotForm(null);
            setNotice({
              message: editing
                ? `Plot ${saved.code} updated.`
                : `Plot ${saved.code} added to ${warehouseName}.`,
              error: false,
            });
            await load();
          }}
        />
      )}

      {moveForm && (
        <MovePlotForm
          warehouse={moveForm.warehouse}
          plot={moveForm.plot}
          onClose={() => setMoveForm(null)}
          onMoved={async () => {
            const source = moveForm.plot;
            setMoveForm(null);
            setNotice({
              message: `Stock moved from plot ${source.code}.`,
              error: false,
            });
            await load();
          }}
        />
      )}

      {storeOpen && (
        <StoreOrderForm
          orders={orders}
          warehouses={warehouses}
          onClose={() => setStoreOpen(false)}
          onStored={async () => {
            setStoreOpen(false);
            setNotice({
              message: 'Order stored in the warehouse. It is ready to ship.',
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
