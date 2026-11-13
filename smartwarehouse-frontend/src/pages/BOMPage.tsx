import { useCallback, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBoxesStacked, faCircleExclamation, faCube, faLayerGroup, faRotate
} from '@fortawesome/free-solid-svg-icons';
import { api } from '../services/api';
import type { BOMItem, InventoryItem } from '../types';

export default function BOMPage() {
  const [bomItems, setBomItems] = useState<BOMItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedParent, setSelectedParent] = useState<number | 'ALL'>('ALL');

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch BOM data from backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  // Group BOM items by parent product
  const parentMap = new Map<number, { name: string; components: BOMItem[] }>();

  bomItems.forEach((item) => {
    if (!parentMap.has(item.parentProductId)) {
      parentMap.set(item.parentProductId, {
        name: item.parentProductName,
        components: [],
      });
    }
    parentMap.get(item.parentProductId)!.components.push(item);
  });

  const parentProducts = Array.from(parentMap.entries());

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
          <p>Multi-level product structures and component requirements for manufacturing 1 unit of finished product.</p>
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
            <span className="stat-label">FINISHED PRODUCTS WITH BOM</span>
            <span className="stat-icon"><FontAwesomeIcon icon={faCube} /></span>
          </div>
          <div className="stat-value">{parentProducts.length}</div>
          <div className="stat-detail">Configured parent products</div>
        </div>

        <div className="stat-card tone-green">
          <div className="stat-header">
            <span className="stat-label">TOTAL COMPONENTS MAPPED</span>
            <span className="stat-icon"><FontAwesomeIcon icon={faLayerGroup} /></span>
          </div>
          <div className="stat-value">{bomItems.length}</div>
          <div className="stat-detail">Sub-assembly relations</div>
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

      {/* Parent Filter */}
      <div className="filter-bar">
        <div className="filter-tabs">
          <button
            className={selectedParent === 'ALL' ? 'filter-active' : ''}
            onClick={() => setSelectedParent('ALL')}
          >
            All Products ({parentProducts.length})
          </button>
          {parentProducts.map(([pid, pData]) => (
            <button
              key={pid}
              className={selectedParent === pid ? 'filter-active' : ''}
              onClick={() => setSelectedParent(pid)}
            >
              {pData.name} (#{pid})
            </button>
          ))}
        </div>
      </div>

      {/* BOM Cards List */}
      {parentProducts.length === 0 ? (
        <div className="table-card">
          <div className="empty-state">No Bill of Materials configured in backend database.</div>
        </div>
      ) : (
        parentProducts
          .filter(([pid]) => selectedParent === 'ALL' || selectedParent === pid)
          .map(([pid, pData]) => (
            <div key={pid} className="table-card" style={{ marginBottom: 24 }}>
              <div className="table-heading">
                <div>
                  <h3>
                    <FontAwesomeIcon icon={faCube} style={{ marginRight: 8, color: '#6366f1' }} />
                    {pData.name} <span className="muted-cell" style={{ fontSize: '0.85em', fontWeight: 400 }}>(SKU #{pid})</span>
                  </h3>
                  <p>Bill of Materials required to produce 1 unit of {pData.name}</p>
                </div>
                <span className="status-pill status-created">
                  {pData.components.length} Components
                </span>
              </div>

              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>COMPONENT NAME</th>
                      <th>SKU</th>
                      <th>QUANTITY PER UNIT</th>
                      <th>PURPOSE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pData.components.map((comp) => (
                      <tr key={comp.componentProductId}>
                        <td>
                          <span className="product-cell">
                            <span className="product-icon">
                              <FontAwesomeIcon icon={faLayerGroup} />
                            </span>
                            <strong>{comp.componentProductName}</strong>
                          </span>
                        </td>
                        <td className="muted-cell">PRD-{comp.componentProductId}</td>
                        <td>
                          <strong style={{ fontSize: '1.05em' }}>{comp.quantityRequired}×</strong>
                        </td>
                        <td>
                          <span className="status-pill status-confirmed">Manufacturing Sub-assembly</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
      )}
    </div>
  );
}
