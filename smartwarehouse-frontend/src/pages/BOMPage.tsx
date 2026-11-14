import { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBoxesStacked, faChevronDown, faChevronRight, faCircleExclamation,
  faCube, faLayerGroup, faRotate,
} from '@fortawesome/free-solid-svg-icons';
import { api } from '../services/api';
import type { BOMItem, InventoryItem } from '../types';

interface BomNode {
  productId: number;
  name: string;
  quantity: number;
  children: BomNode[];
}

/** Turn the flat parent/component rows into one tree per deliverable product. */
function buildForest(items: BOMItem[], rootProductIds: Set<number>): BomNode[] {
  const byParent = new Map<number, BOMItem[]>();
  const names = new Map<number, string>();
  const parentIds = new Set<number>();

  for (const item of items) {
    const children = byParent.get(item.parentProductId) ?? [];
    children.push(item);
    byParent.set(item.parentProductId, children);
    names.set(item.parentProductId, item.parentProductName);
    names.set(item.componentProductId, item.componentProductName);
    parentIds.add(item.parentProductId);
  }

  const build = (productId: number, quantity: number, path: Set<number>): BomNode => ({
    productId,
    name: names.get(productId) ?? `Product #${productId}`,
    quantity,
    children: (byParent.get(productId) ?? [])
      .filter((item) => !path.has(item.componentProductId))
      .sort((a, b) => a.componentProductId - b.componentProductId)
      .map((item) => build(
        item.componentProductId,
        item.quantityRequired,
        new Set(path).add(item.componentProductId),
      )),
  });

  // Only inventory items flagged is_product = true can be shown as roots. A
  // product that is still referenced as a component appears as an
  // intermediate part inside another product's tree.
  return [...parentIds]
    .filter((id) => rootProductIds.has(id))
    .sort((a, b) => a - b)
    .map((id) => build(id, 1, new Set([id])));
}

/** Keys of every node that has children, used by "Collapse all". */
function branchKeys(nodes: BomNode[], parentKey = ''): string[] {
  return nodes.flatMap((node) => {
    const key = parentKey ? `${parentKey}/${node.productId}` : String(node.productId);
    return node.children.length > 0
      ? [key, ...branchKeys(node.children, key)]
      : [];
  });
}

interface BomTreeRowProps {
  node: BomNode;
  pathKey: string;
  depth: number;
  stockByProduct: Map<number, number>;
  collapsed: Set<string>;
  onToggle: (key: string) => void;
}

function BomTreeRow({
  node, pathKey, depth, stockByProduct, collapsed, onToggle,
}: BomTreeRowProps) {
  const hasChildren = node.children.length > 0;
  const open = hasChildren && !collapsed.has(pathKey);
  const available = stockByProduct.get(node.productId);
  const type = depth === 0
    ? 'Deliverable product'
    : hasChildren ? 'Intermediate part' : 'Raw material';
  const typeClass = depth === 0
    ? 'deliverable'
    : hasChildren ? 'intermediate' : 'raw';

  return (
    <li className="bom-tree-node">
      <div className={`bom-tree-row ${depth === 0 ? 'bom-tree-root' : ''}`}>
        <div className="bom-tree-main" style={{ paddingLeft: depth * 24 }}>
          <button
            type="button"
            className={`bom-tree-toggle ${hasChildren ? '' : 'bom-tree-toggle-empty'}`}
            onClick={() => hasChildren && onToggle(pathKey)}
            aria-expanded={hasChildren ? open : undefined}
            aria-label={hasChildren ? `${open ? 'Collapse' : 'Expand'} ${node.name}` : undefined}
            tabIndex={hasChildren ? 0 : -1}
          >
            {hasChildren && <FontAwesomeIcon icon={open ? faChevronDown : faChevronRight} />}
          </button>
          <span className={`product-icon bom-tree-icon ${hasChildren ? 'bom-tree-icon-branch' : ''}`}>
            <FontAwesomeIcon icon={hasChildren ? faCube : faLayerGroup} />
          </span>
          <span className="bom-tree-name">
            <strong>{node.name}</strong>
          </span>
        </div>

        <span className="muted-cell">PRD-{node.productId}</span>

        <strong className="bom-tree-qty">{node.quantity}×</strong>

        <span className="bom-tree-stock">
          {available == null ? (
            <span className="muted-cell">Not stocked</span>
          ) : (
            <>
              <span className={`bom-stock-dot ${available === 0 ? 'bom-stock-out' : available <= 20 ? 'bom-stock-low' : ''}`} />
              {available} available
            </>
          )}
        </span>

        <span className={`bom-type-pill bom-type-${typeClass}`}>{type}</span>
      </div>

      {open && (
        <ul className="bom-tree-children">
          {node.children.map((child) => (
            <BomTreeRow
              key={`${pathKey}/${child.productId}`}
              node={child}
              pathKey={`${pathKey}/${child.productId}`}
              depth={depth + 1}
              stockByProduct={stockByProduct}
              collapsed={collapsed}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function BOMPage() {
  const [bomItems, setBomItems] = useState<BOMItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [bomData, invData] = await Promise.all([
        api.getBOM(),
        api.getInventory(),
      ]);
      setBomItems(Array.isArray(bomData) ? bomData : []);
      setInventory(Array.isArray(invData) ? invData : []);
      setCollapsed(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch BOM data from backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const bomParentIds = useMemo(
    () => new Set(bomItems.map((item) => item.parentProductId)),
    [bomItems],
  );

  const deliveryProducts = useMemo(
    () => inventory.filter(
      (item) => item.isProduct === true && bomParentIds.has(item.productId),
    ),
    [inventory, bomParentIds],
  );

  const stockByProduct = useMemo(
    () => new Map(inventory.map((item) => [
      item.productId,
      item.availableQuantity ?? item.quantity - item.reservedQuantity,
    ])),
    [inventory],
  );

  const forest = useMemo(() => {
    const rootProductIds = new Set(deliveryProducts.map((item) => item.productId));
    return buildForest(bomItems, rootProductIds);
  }, [bomItems, deliveryProducts]);

  const toggle = useCallback((key: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="page-content">
        <div className="loading-panel">
          <span className="spinner" />
          <strong>Loading Bill of Materials...</strong>
          <span>Fetching component hierarchy from backend</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-toolbar">
        <div>
          <h2>Bill of Materials (BOM)</h2>
          <p>Delivery products with their intermediate parts and raw materials.</p>
        </div>
        <button className="button button-secondary" onClick={() => void loadData()}>
          <FontAwesomeIcon icon={faRotate} /> Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <FontAwesomeIcon icon={faCircleExclamation} />
          <span>{error}</span>
          <button onClick={() => void loadData()}>Retry</button>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="stats-grid stats-grid-small">
        <div className="stat-card tone-blue">
          <div className="stat-header">
            <span className="stat-label">DELIVERY PRODUCTS WITH BOM</span>
            <span className="stat-icon"><FontAwesomeIcon icon={faCube} /></span>
          </div>
          <div className="stat-value">{deliveryProducts.length}</div>
          <div className="stat-detail">Configured delivery products</div>
        </div>

        <div className="stat-card tone-green">
          <div className="stat-header">
            <span className="stat-label">TOTAL COMPONENTS MAPPED</span>
            <span className="stat-icon"><FontAwesomeIcon icon={faLayerGroup} /></span>
          </div>
          <div className="stat-value">{bomItems.length}</div>
          <div className="stat-detail">Part and material relations</div>
        </div>

        <div className="stat-card tone-violet">
          <div className="stat-header">
            <span className="stat-label">CATALOG SKUs</span>
            <span className="stat-icon"><FontAwesomeIcon icon={faBoxesStacked} /></span>
          </div>
          <div className="stat-value">{inventory.length}</div>
          <div className="stat-detail">Active inventory items</div>
        </div>
      </div>

      {bomItems.length === 0 ? (
        <div className="table-card">
          <div className="empty-state">No Bill of Materials configured in backend database.</div>
        </div>
      ) : forest.length === 0 ? (
        <div className="table-card">
          <div className="empty-state">
            No delivery products found. Set <strong>is_product = true</strong> on an inventory item to show its BOM tree here.
          </div>
        </div>
      ) : (
        <div className="table-card bom-tree-card">
          <div className="table-heading">
            <div>
              <h3>
                <FontAwesomeIcon icon={faLayerGroup} style={{ marginRight: 8, color: '#6366f1' }} />
                Product structure
              </h3>
              <p>Each delivery product is a root. Expand a root to trace its intermediate parts and raw materials.</p>
            </div>
            <div className="row-actions">
              <button className="mini-button" onClick={() => setCollapsed(new Set())}>
                Expand all
              </button>
              <button className="mini-button" onClick={() => setCollapsed(new Set(branchKeys(forest)))}>
                Collapse all
              </button>
            </div>
          </div>

          <div className="bom-tree-scroll">
            <div className="bom-tree-head">
              <span>PRODUCT</span>
              <span>SKU</span>
              <span>QTY / UNIT</span>
              <span>AVAILABLE STOCK</span>
              <span>TYPE</span>
            </div>
            <ul className="bom-tree">
              {forest.map((node) => (
                <BomTreeRow
                  key={node.productId}
                  node={node}
                  pathKey={String(node.productId)}
                  depth={0}
                  stockByProduct={stockByProduct}
                  collapsed={collapsed}
                  onToggle={toggle}
                />
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
