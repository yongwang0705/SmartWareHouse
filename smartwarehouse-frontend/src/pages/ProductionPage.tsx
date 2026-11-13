import { useCallback, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTruckLoading } from '@fortawesome/free-solid-svg-icons';
import { api } from '../services/api';
import type { ProductionWorkOrder } from '../types';

export default function ProductionPage() {
  const [workOrders, setWorkOrders] = useState<ProductionWorkOrder[]>([]);

  const loadData = useCallback(async () => {
    const wo = await api.getOrders();
    setWorkOrders(
      Array.isArray(wo) ? wo.map((o: any) => ({
        workOrderId: o.id,
        productId: 101,
        quantity: o.items?.length ?? 5,
        status: o.status === 'CREATED' ? 'IN_PROGRESS' : o.status,
        createdAt: o.createdAt,
      })) : []
    );
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const completeWorkOrder = async (id: number) => {
    setWorkOrders(prev => prev.map(wo => wo.workOrderId === id ? { ...wo, status: 'COMPLETED' } : wo));
  };


  return (
    <div className="page-content">
      <h2>Production Operations</h2>

      {/* 1. KANBAN SIMULATION */}
      <div className="section-card">
        <h3>Kanban Production Line (Real-time Simulation)</h3>
        <div className="kanban-board" style={{ display: 'flex', gap: '20px' }}>
          {workOrders.map(wo => (
            <div key={wo.workOrderId} className="kanban-card" style={{ border: '1px solid #ccc', padding: '10px' }}>
              <h4>WO #{wo.workOrderId}</h4>
              <p>Status: <strong>{wo.status}</strong></p>
              {wo.status === 'IN_PROGRESS' && (
                <div className="progress-bar" style={{ height: '10px', background: '#eee' }}>
                  <div style={{ width: '60%', background: 'green', height: '100%' }}></div>
                </div>
              )}
              {wo.status === 'IN_PROGRESS' && (
                <button onClick={() => completeWorkOrder(wo.workOrderId)} className="button">Finish Production</button>
              )}
              {wo.status === 'COMPLETED' && (
                <button onClick={() => alert('Transferring to Warehouse...')} className="button button-primary">
                  <FontAwesomeIcon icon={faTruckLoading} /> Transfer to Warehouse
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
