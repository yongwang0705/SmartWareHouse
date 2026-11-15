import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons';
import { addDays, toDateInput } from '../utils/format';
import type { InventoryItem } from '../types';

interface Props {
  inventory: InventoryItem[];
  onClose: () => void;
  onSubmit: (
    customerId: number,
    items: Array<{ productId: number; quantity: number }>,
    dueDate?: string,
  ) => Promise<void>;
}

const available = (item: InventoryItem) =>
  item.availableQuantity ?? item.quantity - item.reservedQuantity;

export default function OrderModal({ inventory, onClose, onSubmit }: Props) {
  // List every deliverable product regardless of current stock. Orders for
  // out-of-stock products are accepted and queued for production on confirm.
  const orderableProducts = useMemo(
    () => inventory.filter((item) => item.isProduct === true),
    [inventory],
  );
  const [customerId, setCustomerId] = useState('1001');
  const [dueDate, setDueDate] = useState(toDateInput(addDays(new Date(), 7)));
  const [lines, setLines] = useState([
    { productId: orderableProducts[0]?.productId ?? 0, quantity: 1 },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const updateLine = (index: number, field: 'productId' | 'quantity', value: number) =>
    setLines((current) => current.map((line, i) => i === index ? { ...line, [field]: value } : line));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!customerId || Number(customerId) <= 0 || lines.some((line) => line.quantity <= 0)) {
      setError('Enter a valid customer ID and positive quantities.');
      return;
    }
    if (!dueDate) {
      setError('A delivery deadline is required.');
      return;
    }
    if (dueDate < toDateInput(new Date())) {
      setError('Delivery deadline cannot be in the past.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit(Number(customerId), lines, dueDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create order.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="create-order-title">
      <div className="modal-header"><div><div className="eyebrow">ORDER MANAGEMENT</div><h2 id="create-order-title">Create new order</h2><p>Add products and quantities to this order.</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><FontAwesomeIcon icon={faXmark} /></button></div>
      <form onSubmit={submit}>
        <label className="field-label">Customer ID<input className="form-input" type="number" min="1" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required /></label>
        <label className="field-label">Delivery deadline<input className="form-input" type="date" min={toDateInput(new Date())} value={dueDate} onChange={(e) => setDueDate(e.target.value)} required /></label>
        <div className="form-section-title"><span>ORDER ITEMS</span><span>{lines.length} line{lines.length === 1 ? '' : 's'}</span></div>
        <div className="order-lines">
          {lines.map((line, index) => <div className="order-line" key={index}>
            <label className="line-product"><span>Product</span><select className="form-input" value={line.productId} onChange={(e) => updateLine(index, 'productId', Number(e.target.value))} required>
              {orderableProducts.map((product) => <option key={product.productId} value={product.productId}>{product.productName} · #{product.productId} · {available(product)} available</option>)}
            </select></label>
            <label className="line-quantity"><span>Qty</span><input className="form-input" type="number" min="1" value={line.quantity} onChange={(e) => updateLine(index, 'quantity', Number(e.target.value))} required /></label>
            <button type="button" className="remove-line" aria-label="Remove item" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, i) => i !== index))}><FontAwesomeIcon icon={faTrash} /></button>
          </div>)}
        </div>
        <button type="button" className="add-line-button" disabled={orderableProducts.length === 0} onClick={() => setLines((current) => [...current, { productId: orderableProducts[0]?.productId ?? 0, quantity: 1 }])}><FontAwesomeIcon icon={faPlus} /> Add another product</button>
        {orderableProducts.length === 0 && <div className="form-error">No deliverable products found. Mark inventory with <strong>is_product = true</strong> to order it.</div>}
        {error && <div className="form-error">{error}</div>}
        <div className="modal-footer"><button type="button" className="button button-ghost" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={busy || orderableProducts.length === 0}>{busy ? 'Creating...' : 'Create order'}</button></div>
      </form>
    </section>
  </div>;
}
