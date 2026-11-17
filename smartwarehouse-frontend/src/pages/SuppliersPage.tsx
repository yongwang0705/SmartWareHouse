import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowsRotate, faBoxOpen, faChevronRight, faCircleExclamation,
  faClipboardCheck, faClipboardList, faPlus, faTrash, faTruck,
  faUserPlus,
} from '@fortawesome/free-solid-svg-icons';
import Modal from '../components/Modal';
import StatCard from '../components/StatCard';
import Toast from '../components/Toast';
import { api } from '../services/api';
import {
  addDays, formatDate, formatDateTime, friendlyStatus, statusClass, toDateInput,
} from '../utils/format';
import type {
  InventoryItem, PurchaseOrder, Supplier,
} from '../types';

const STATUS_FILTERS = ['ALL', 'ORDERED', 'RECEIVED', 'CANCELLED'];

const available = (item: InventoryItem) =>
  item.availableQuantity ?? item.quantity - item.reservedQuantity;

const units = (value: number) =>
  Number(value || 0).toLocaleString('en-CA');

interface PurchaseOrderFormProps {
  suppliers: Supplier[];
  materials: InventoryItem[];
  defaultSupplierId?: number;
  onClose: () => void;
  onSaved: (order: PurchaseOrder) => void;
}

interface LineDraft {
  key: string;
  productId: string;
  quantity: string;
}

let lineSequence = 0;
const nextLineKey = () => `po-line-${++lineSequence}`;

const expectedFor = (supplier?: Supplier) =>
  toDateInput(addDays(new Date(), supplier?.leadTimeDays ?? 7));

function PurchaseOrderForm({
  suppliers, materials, defaultSupplierId, onClose, onSaved,
}: PurchaseOrderFormProps) {
  const activeSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplier.status === 'ACTIVE'),
    [suppliers],
  );
  const initialSupplier = activeSuppliers.find(
    (supplier) => supplier.id === defaultSupplierId,
  ) ?? activeSuppliers[0];

  const [supplierId, setSupplierId] = useState(
    initialSupplier ? String(initialSupplier.id) : '',
  );
  const [expectedDelivery, setExpectedDelivery] = useState(
    expectedFor(initialSupplier),
  );
  const [lines, setLines] = useState<LineDraft[]>(() => (
    materials.length > 0
      ? [{
        key: nextLineKey(),
        productId: String(materials[0].productId),
        quantity: '1',
      }]
      : []
  ));
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const selectedSupplier = activeSuppliers.find(
    (supplier) => String(supplier.id) === supplierId,
  );

  const usedProductIds = useMemo(
    () => new Set(
      lines
        .map((line) => Number(line.productId))
        .filter((productId) => Number.isFinite(productId) && productId > 0),
    ),
    [lines],
  );

  const chooseSupplier = (value: string) => {
    setSupplierId(value);
    const supplier = activeSuppliers.find(
      (item) => String(item.id) === value,
    );
    if (supplier) {
      setExpectedDelivery(expectedFor(supplier));
    }
    setFormError('');
  };

  const updateLine = (
    key: string,
    field: 'productId' | 'quantity',
    value: string,
  ) => setLines((current) => current.map((line) => (
    line.key === key ? { ...line, [field]: value } : line
  )));

  const addLine = () => setLines((current) => {
    const used = new Set(current.map((line) => line.productId));
    const next = materials.find(
      (material) => !used.has(String(material.productId)),
    );

    return [...current, {
      key: nextLineKey(),
      productId: next ? String(next.productId) : '',
      quantity: '1',
    }];
  });

  const removeLine = (key: string) =>
    setLines((current) => current.filter((line) => line.key !== key));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');

    if (!selectedSupplier) {
      setFormError('Choose an active supplier.');
      return;
    }

    if (lines.length === 0) {
      setFormError('Add at least one raw material.');
      return;
    }

    if (expectedDelivery && expectedDelivery < toDateInput(new Date())) {
      setFormError('Expected delivery cannot be in the past.');
      return;
    }

    const requested = lines.map((line) => ({
      productId: Number(line.productId),
      quantity: Number(line.quantity),
    }));

    if (requested.some((line) => !line.productId
      || !Number.isInteger(line.quantity)
      || line.quantity <= 0)) {
      setFormError('Choose a material and a positive whole quantity for every line.');
      return;
    }

    if (new Set(requested.map((line) => line.productId)).size
      !== requested.length) {
      setFormError('Each raw material can only appear once on the order.');
      return;
    }

    setBusy(true);
    try {
      const order = await api.createPurchaseOrder({
        supplierId: selectedSupplier.id,
        expectedDelivery: expectedDelivery || undefined,
        lines: requested,
      });
      onSaved(order);
    } catch (err) {
      setFormError(err instanceof Error
        ? err.message
        : 'Could not place the purchase order.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      eyebrow="RAW MATERIAL PROCUREMENT"
      title="Place purchase order"
      subtitle="Order raw materials from a supplier. Receiving the purchase order adds the materials to inventory."
      onClose={onClose}
      footer={<>
        <button type="button" className="button button-ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          type="submit"
          form="purchase-order-form"
          className="button button-primary"
          disabled={busy || activeSuppliers.length === 0}
        >
          {busy ? 'Placing order...' : 'Place purchase order'}
        </button>
      </>}
    >
      {activeSuppliers.length === 0 ? (
        <div className="empty-state">
          No active suppliers. Add a supplier first, then place a purchase order.
        </div>
      ) : (
        <form id="purchase-order-form" onSubmit={submit}>
          <div className="form-grid">
            <label className="field-label">
              Supplier
              <select
                className="form-input"
                value={supplierId}
                onChange={(event) => chooseSupplier(event.target.value)}
                required
              >
                {activeSuppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} · {supplier.code}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-label">
              Expected delivery
              <input
                className="form-input"
                type="date"
                min={toDateInput(new Date())}
                value={expectedDelivery}
                onChange={(event) => setExpectedDelivery(event.target.value)}
              />
            </label>
          </div>

          {selectedSupplier && (
            <div className="detail-summary supplier-order-summary">
              <div>
                <small>CONTACT</small>
                <strong>{selectedSupplier.contactName || '—'}</strong>
              </div>
              <div>
                <small>EMAIL</small>
                <strong>{selectedSupplier.email || '—'}</strong>
              </div>
              <div>
                <small>LEAD TIME</small>
                <strong>{selectedSupplier.leadTimeDays} days</strong>
              </div>
            </div>
          )}

          <div className="form-section-title">
            <span>RAW MATERIALS</span>
            <span>{lines.length} line{lines.length === 1 ? '' : 's'}</span>
          </div>

          <div className="order-lines">
            {lines.map((line) => {
              const options = materials.filter((material) => (
                material.productId === Number(line.productId)
                || !usedProductIds.has(material.productId)
              ));

              return (
                <div className="order-line" key={line.key}>
                  <label className="line-product">
                    <span>Material</span>
                    <select
                      className="form-input"
                      value={line.productId}
                      onChange={(event) => updateLine(
                        line.key,
                        'productId',
                        event.target.value,
                      )}
                      required
                    >
                      <option value="" disabled>Choose material…</option>
                      {options.map((material) => (
                        <option
                          key={material.productId}
                          value={material.productId}
                        >
                          {material.productName} · PRD-{material.productId} · {available(material)} available
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="line-quantity">
                    <span>Qty</span>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      step="1"
                      value={line.quantity}
                      onChange={(event) => updateLine(
                        line.key,
                        'quantity',
                        event.target.value,
                      )}
                      required
                    />
                  </label>

                  <button
                    type="button"
                    className="remove-line"
                    aria-label="Remove material"
                    disabled={lines.length === 1}
                    onClick={() => removeLine(line.key)}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="add-line-button"
            disabled={materials.length === 0 || lines.length >= materials.length}
            onClick={addLine}
          >
            <FontAwesomeIcon icon={faPlus} /> Add another material
          </button>

          {materials.length === 0 && (
            <div className="form-error">
              No raw materials found. Inventory items with
              {' '}<strong>is_product = false</strong> can be purchased.
            </div>
          )}
          {formError && <div className="form-error">{formError}</div>}

          <div className="plan-hint">
            <FontAwesomeIcon icon={faTruck} />
            <span>
              Only raw materials can be purchased. Once the order arrives, use
              {' '}<strong>Receive</strong> on the purchase-order list to add every
              line to inventory.
            </span>
          </div>
        </form>
      )}
    </Modal>
  );
}

interface AddSupplierFormProps {
  onClose: () => void;
  onSaved: (supplier: Supplier) => void;
}

function AddSupplierForm({ onClose, onSaved }: AddSupplierFormProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState('7');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');

    if (!code.trim() || !name.trim()) {
      setFormError('Supplier code and name are required.');
      return;
    }

    const leadTime = Number(leadTimeDays);
    if (!Number.isInteger(leadTime) || leadTime < 0) {
      setFormError('Lead time must be a whole number of days.');
      return;
    }

    setBusy(true);
    try {
      const supplier = await api.createSupplier({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        contactName: contactName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        leadTimeDays: leadTime,
      });
      onSaved(supplier);
    } catch (err) {
      setFormError(err instanceof Error
        ? err.message
        : 'Could not create the supplier.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      eyebrow="SUPPLIER DIRECTORY"
      title="Add supplier"
      subtitle="Register a supplier that can fulfil raw-material purchase orders."
      onClose={onClose}
      footer={<>
        <button type="button" className="button button-ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          type="submit"
          form="add-supplier-form"
          className="button button-primary"
          disabled={busy}
        >
          {busy ? 'Saving...' : 'Add supplier'}
        </button>
      </>}
    >
      <form id="add-supplier-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="field-label">
            Supplier code
            <input
              className="form-input"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="SUP-ACME"
              maxLength={50}
              required
            />
          </label>
          <label className="field-label">
            Supplier name
            <input
              className="form-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Acme Components"
              maxLength={150}
              required
            />
          </label>
          <label className="field-label">
            Contact name
            <input
              className="form-input"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              placeholder="Jordan Lee"
              maxLength={150}
            />
          </label>
          <label className="field-label">
            Email
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="orders@acme.example"
              maxLength={255}
            />
          </label>
          <label className="field-label">
            Phone
            <input
              className="form-input"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+1 416 555 0100"
              maxLength={50}
            />
          </label>
          <label className="field-label">
            Lead time (days)
            <input
              className="form-input"
              type="number"
              min="0"
              max="365"
              step="1"
              value={leadTimeDays}
              onChange={(event) => setLeadTimeDays(event.target.value)}
              required
            />
          </label>
        </div>

        {formError && <div className="form-error">{formError}</div>}
      </form>
    </Modal>
  );
}

interface Props {
  onInventoryChanged: () => void;
}

export default function SuppliersPage({ onInventoryChanged }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [orderForm, setOrderForm] = useState<{ supplierId?: number } | null>(null);
  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  const [receivingId, setReceivingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [supplierData, orderData, inventoryData] = await Promise.all([
        api.getSuppliers(),
        api.getPurchaseOrders(),
        api.getInventory().catch(() => [] as InventoryItem[]),
      ]);
      setSuppliers(Array.isArray(supplierData) ? supplierData : []);
      setPurchaseOrders(Array.isArray(orderData) ? orderData : []);
      setInventory(Array.isArray(inventoryData) ? inventoryData : []);
    } catch (err) {
      setError(err instanceof Error
        ? err.message
        : 'Could not load suppliers and purchase orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 7000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const materials = useMemo(
    () => inventory.filter((item) => item.isProduct !== true),
    [inventory],
  );

  const filteredOrders = useMemo(
    () => purchaseOrders.filter((order) => (
      statusFilter === 'ALL' || order.status === statusFilter
    )),
    [purchaseOrders, statusFilter],
  );

  const receiveOrder = async (order: PurchaseOrder) => {
    if (!window.confirm(
      `Receive ${order.poNumber} from ${order.supplierName}? `
      + `This adds ${units(order.orderedUnits)} units of raw materials to inventory.`,
    )) return;

    setReceivingId(order.id);
    try {
      await api.receivePurchaseOrder(order.id);
      setNotice({
        message: `${order.poNumber} received. ${units(order.orderedUnits)} units added to inventory.`,
        error: false,
      });
      await load();
      onInventoryChanged();
    } catch (err) {
      setNotice({
        message: err instanceof Error
          ? err.message
          : 'Could not receive the purchase order.',
        error: true,
      });
    } finally {
      setReceivingId(null);
    }
  };

  const cancelOrder = async (order: PurchaseOrder) => {
    if (!window.confirm(
      `Cancel ${order.poNumber}? No stock will be added to inventory.`,
    )) return;

    setReceivingId(order.id);
    try {
      await api.cancelPurchaseOrder(order.id);
      setNotice({
        message: `${order.poNumber} cancelled.`,
        error: false,
      });
      await load();
    } catch (err) {
      setNotice({
        message: err instanceof Error
          ? err.message
          : 'Could not cancel the purchase order.',
        error: true,
      });
    } finally {
      setReceivingId(null);
    }
  };

  const openOrders = purchaseOrders.filter(
    (order) => order.status === 'ORDERED',
  );
  const unitsOnOrder = openOrders.reduce(
    (sum, order) => sum + order.orderedUnits,
    0,
  );
  const receivedOrders = purchaseOrders.filter(
    (order) => order.status === 'RECEIVED',
  ).length;

  if (loading) {
    return (
      <div className="loading-panel">
        <span className="spinner" />
        <strong>Loading suppliers...</strong>
        <span>Reading the supplier directory and purchase orders</span>
      </div>
    );
  }

  return (
    <>
      <div className="page-toolbar">
        <div>
          <h2>Supplier procurement</h2>
          <p>Buy raw materials from suppliers and receive them into inventory.</p>
        </div>
        <div className="toolbar-actions">
          <button
            className="button button-primary"
            onClick={() => setOrderForm({})}
            disabled={suppliers.length === 0}
          >
            <FontAwesomeIcon icon={faClipboardList} /> Place purchase order
          </button>
          <button
            className="button button-secondary"
            onClick={() => setSupplierFormOpen(true)}
          >
            <FontAwesomeIcon icon={faUserPlus} /> Add supplier
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
          label="SUPPLIERS"
          value={String(suppliers.length)}
          detail="Registered suppliers"
          icon={faTruck}
          tone="blue"
        />
        <StatCard
          label="OPEN ORDERS"
          value={String(openOrders.length)}
          detail="Awaiting goods receipt"
          icon={faClipboardList}
          tone="amber"
        />
        <StatCard
          label="UNITS ON ORDER"
          value={units(unitsOnOrder)}
          detail="Raw materials in transit"
          icon={faBoxOpen}
          tone="violet"
        />
        <StatCard
          label="RECEIVED ORDERS"
          value={String(receivedOrders)}
          detail="Stock added to inventory"
          icon={faClipboardCheck}
          tone="green"
        />
      </div>

      <div className="procurement-section-head">
        <div>
          <h3>Suppliers</h3>
          <p>Lead times drive the default expected delivery date on new orders.</p>
        </div>
      </div>

      {suppliers.length === 0 ? (
        <div className="table-card">
          <div className="empty-state">
            No suppliers yet. Add a supplier to start purchasing raw materials.
          </div>
        </div>
      ) : (
        <div className="supplier-grid">
          {suppliers.map((supplier) => {
            const openForSupplier = openOrders.filter(
              (order) => order.supplierId === supplier.id,
            ).length;

            return (
              <article className="supplier-card" key={supplier.id}>
                <header className="supplier-card-head">
                  <span className="supplier-avatar">
                    <FontAwesomeIcon icon={faTruck} />
                  </span>
                  <div>
                    <strong>{supplier.name}</strong>
                    <small>{supplier.code}</small>
                  </div>
                  <span className={`status-pill status-${statusClass(supplier.status)}`}>
                    {friendlyStatus(supplier.status)}
                  </span>
                </header>

                <dl className="supplier-facts">
                  <div><dt>Contact</dt><dd>{supplier.contactName || '—'}</dd></div>
                  <div><dt>Email</dt><dd>{supplier.email || '—'}</dd></div>
                  <div><dt>Phone</dt><dd>{supplier.phone || '—'}</dd></div>
                  <div><dt>Lead time</dt><dd>{supplier.leadTimeDays} days</dd></div>
                </dl>

                <footer className="supplier-card-foot">
                  <span>
                    {openForSupplier} open order{openForSupplier === 1 ? '' : 's'}
                  </span>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setOrderForm({ supplierId: supplier.id })}
                  >
                    Order materials <FontAwesomeIcon icon={faChevronRight} />
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      <div className="table-card">
        <div className="table-heading">
          <div>
            <h3>Purchase orders</h3>
            <p>
              {filteredOrders.length} order{filteredOrders.length === 1 ? '' : 's'}
              {' '}· receiving an order adds raw materials to inventory
            </p>
          </div>
          <div className="segmented">
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                className={statusFilter === status ? 'segmented-active' : ''}
                onClick={() => setStatusFilter(status)}
              >
                {status === 'ALL' ? 'All orders' : friendlyStatus(status)}
              </button>
            ))}
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>PO</th>
                <th>SUPPLIER</th>
                <th>MATERIALS</th>
                <th>UNITS</th>
                <th>EXPECTED</th>
                <th>CREATED</th>
                <th>STATUS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id}>
                  <td><strong className="text-dark">{order.poNumber}</strong></td>
                  <td>
                    <span className="product-cell">
                      <span className="product-icon">
                        <FontAwesomeIcon icon={faTruck} />
                      </span>
                      <div>
                        <strong>{order.supplierName}</strong>
                        <div className="cell-sub">{order.supplierCode}</div>
                      </div>
                    </span>
                  </td>
                  <td>
                    <span className="po-materials">
                      {order.lines.map((line) => (
                        <span key={line.lineId}>
                          {line.productName} × {units(line.quantity)}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td>
                    <strong>{units(order.orderedUnits)}</strong> units
                  </td>
                  <td className="muted-cell">{formatDate(order.expectedDelivery)}</td>
                  <td className="muted-cell">{formatDateTime(order.createdAt)}</td>
                  <td>
                    <span className={`status-pill status-${statusClass(order.status)}`}>
                      <i />{friendlyStatus(order.status)}
                    </span>
                    {order.status === 'RECEIVED' && order.receivedAt && (
                      <div className="cell-sub">
                        Received {formatDateTime(order.receivedAt)}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      {order.status === 'ORDERED' ? (
                        <>
                          <button
                            className="mini-button mini-button-success"
                            disabled={receivingId === order.id}
                            onClick={() => void receiveOrder(order)}
                          >
                            <FontAwesomeIcon icon={faClipboardCheck} />
                            {receivingId === order.id ? 'Working…' : 'Receive'}
                          </button>
                          <button
                            className="mini-button mini-button-danger"
                            disabled={receivingId === order.id}
                            onClick={() => void cancelOrder(order)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <span className="muted-cell">
                          {order.status === 'RECEIVED' ? 'Stock added' : '—'}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      {purchaseOrders.length === 0
                        ? 'No purchase orders yet. Place one to buy raw materials.'
                        : 'No purchase orders match this filter.'}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {orderForm && (
        <PurchaseOrderForm
          key={orderForm.supplierId ?? 'any-supplier'}
          suppliers={suppliers}
          materials={materials}
          defaultSupplierId={orderForm.supplierId}
          onClose={() => setOrderForm(null)}
          onSaved={async (order) => {
            setOrderForm(null);
            setNotice({
              message: `${order.poNumber} placed with ${order.supplierName}. Receive it when the materials arrive.`,
              error: false,
            });
            await load();
          }}
        />
      )}

      {supplierFormOpen && (
        <AddSupplierForm
          onClose={() => setSupplierFormOpen(false)}
          onSaved={async (supplier) => {
            setSupplierFormOpen(false);
            setNotice({
              message: `${supplier.name} added to the supplier directory.`,
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
