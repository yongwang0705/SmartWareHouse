import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons';
import type { InventoryItem } from '../types';

interface Props {
  inventory: InventoryItem[];
  onClose: () => void;
  onSubmit: (customerId: number, items: Array<{ productId: number; quantity: number }>) => Promise<void>;
}

export default function OrderModal({ inventory, onClose, onSubmit }: Props) {
  const [customerId, setCustomerId] = useState('1001');
  const [lines, setLines] = useState([{ productId: inventory[0]?.productId ?? 101, quantity: 1 }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const usableInventory = useMemo(() => inventory.filter((p) => (p.availableQuantity ?? p.quantity - p.reservedQuantity) > 0), [inventory]);

  const updateLine = (index: number, field: 'productId' | 'quantity', value: number) =>
    setLines((current) => current.map((line, i) => i === index ? { ...line, [field]: value } : line));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!customerId || Number(customerId) <= 0 || lines.some((line) => line.quantity <= 0)) {
      setError('Enter a valid customer ID and positive quantities.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit(Number(customerId), lines);
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
        <div className="form-section-title"><span>ORDER ITEMS</span><span>{lines.length} line{lines.length === 1 ? '' : 's'}</span></div>
        <div className="order-lines">
          {lines.map((line, index) => <div className="order-line" key={index}>
            <label className="line-product"><span>Product</span><select className="form-input" value={line.productId} onChange={(e) => updateLine(index, 'productId', Number(e.target.value))} required>
              {usableInventory.map((product) => <option key={product.productId} value={product.productId}>{product.productName} · #{product.productId} · {product.availableQuantity ?? product.quantity - product.reservedQuantity} available</option>)}
            </select></label>
            <label className="line-quantity"><span>Qty</span><input className="form-input" type="number" min="1" value={line.quantity} onChange={(e) => updateLine(index, 'quantity', Number(e.target.value))} required /></label>
            <button type="button" className="remove-line" aria-label="Remove item" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, i) => i !== index))}><FontAwesomeIcon icon={faTrash} /></button>
          </div>)}
        </div>
        <button type="button" className="add-line-button" disabled={usableInventory.length === 0} onClick={() => setLines((current) => [...current, { productId: usableInventory[0]?.productId ?? 0, quantity: 1 }])}><FontAwesomeIcon icon={faPlus} /> Add another product</button>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-footer"><button type="button" className="button button-ghost" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={busy || usableInventory.length === 0}>{busy ? 'Creating...' : 'Create order'}</button></div>
      </form>
    </section>
  </div>;
}
