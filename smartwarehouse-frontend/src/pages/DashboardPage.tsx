import { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowsRotate, faBoxesStacked, faCircleExclamation, faClipboardList,
  faSackDollar, faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import StatCard from '../components/StatCard';
import { api } from '../services/api';
import {
  formatDate, formatDateTime, friendlyStatus, statusClass,
} from '../utils/format';
import type {
  InventoryItem, Order, PlanSummary, ProductionTask, RoutingOperation,
  WorkCenter,
} from '../types';

const money = (amount: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));

const available = (item: InventoryItem) =>
  item.availableQuantity ?? item.quantity - item.reservedQuantity;

const productionLabel = (status?: string) => {
  switch (status) {
    case 'AWAITING_CONFIRMATION': return 'Awaiting confirmation';
    case 'READY': return 'Ready to fulfil';
    case 'PENDING_PRODUCTION': return 'Production required';
    case 'PLANNED': return 'Planned';
    case 'IN_PRODUCTION': return 'In production';
    case 'PRODUCTION_COMPLETED': return 'Production complete';
    case 'FULFILLED': return 'Fulfilled';
    default: return status ? friendlyStatus(status) : '—';
  }
};

interface Props {
  orders: Order[];
  inventory: InventoryItem[];
  onOpenOrder: (order: Order) => void;
  onCompleteOrder: (order: Order) => Promise<boolean>;
}

interface Progress {
  value: number;
  label: string;
  tone: 'done' | 'active' | 'idle' | 'warn';
}

function ProgressBar({ progress }: { progress: Progress }) {
  return (
    <div className="track-progress">
      <div className="track-meter">
        <span
          className={`track-fill-${progress.tone}`}
          style={{ width: `${Math.min(100, Math.max(0, progress.value))}%` }}
        />
      </div>
      <span className="track-progress-label">{progress.label}</span>
    </div>
  );
}

const ACTIVE_PLAN_STATUSES = new Set([
  'DRAFT', 'VALIDATING', 'VALIDATED', 'CONFIRMED', 'IN_PROGRESS',
]);

export default function DashboardPage({
  orders, inventory, onOpenOrder, onCompleteOrder,
}: Props) {
  const [tasks, setTasks] = useState<ProductionTask[]>([]);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [operations, setOperations] = useState<RoutingOperation[]>([]);
  const [productionLoading, setProductionLoading] = useState(true);
  const [productionError, setProductionError] = useState('');
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);

  const loadProduction = useCallback(async () => {
    setProductionLoading(true);
    setProductionError('');
    try {
      const [taskData, planData, workCenterData, operationData] =
        await Promise.all([
          api.getProductionTasks(),
          api.getPlans(),
          api.getWorkCenters().catch(() => [] as WorkCenter[]),
          api.getAllRoutingOperations().catch(() => [] as RoutingOperation[]),
        ]);
      setTasks(Array.isArray(taskData) ? taskData : []);
      setPlans(Array.isArray(planData) ? planData : []);
      setWorkCenters(Array.isArray(workCenterData) ? workCenterData : []);
      setOperations(Array.isArray(operationData) ? operationData : []);
    } catch (err) {
      setProductionError(
        err instanceof Error ? err.message : 'Could not load production tracking.',
      );
    } finally {
      setProductionLoading(false);
    }
  }, []);

  useEffect(() => { void loadProduction(); }, [loadProduction, orders]);

  const totalUnits = inventory.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  );
  const lowStock = inventory.filter((item) => available(item) <= 10).length;
  const totalRevenue = orders
    .filter((order) => order.status?.toUpperCase() !== 'CANCELLED')
    .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const activeOrders = orders.filter(
    (order) => !['CANCELLED', 'COMPLETED'].includes(
      String(order.status).toUpperCase(),
    ),
  ).length;

  const tasksByOrder = useMemo(() => {
    const map = new Map<number, ProductionTask[]>();

    tasks.forEach((task) => {
      if (task.orderId > 0 && task.status !== 'CANCELLED') {
        const list = map.get(task.orderId) ?? [];
        list.push(task);
        map.set(task.orderId, list);
      }
    });

    return map;
  }, [tasks]);

  const trackedOrders = useMemo(() => orders
    .filter((order) => String(order.status).toUpperCase() === 'CONFIRMED')
    .map((order) => {
      const orderTasks = tasksByOrder.get(order.id) ?? [];
      const required = orderTasks.reduce(
        (sum, task) => sum + task.quantity,
        0,
      );
      const completed = orderTasks
        .filter((task) => task.status === 'COMPLETED')
        .reduce((sum, task) => sum + task.quantity, 0);
      const productionStatus = String(order.productionStatus || '');

      let progress = 0;
      let label = '0%';
      let tone: Progress['tone'] = 'idle';

      if (productionStatus === 'READY') {
        progress = 100;
        label = 'Ready';
        tone = 'done';
      } else if (productionStatus === 'PRODUCTION_COMPLETED') {
        progress = 100;
        label = 'Complete';
        tone = 'done';
      } else if (required > 0) {
        progress = Math.round((completed / required) * 100);
        label = `${progress}%`;
        tone = progress > 0 ? 'active' : 'idle';
      } else if (productionStatus === 'PENDING_PRODUCTION') {
        label = 'Awaiting production';
        tone = 'warn';
      }

      return {
        order,
        required,
        completed,
        progress: { value: progress, label, tone },
      };
    })
    .sort((a, b) => new Date(
      a.order.dueDate ?? a.order.createdAt,
    ).getTime() - new Date(
      b.order.dueDate ?? b.order.createdAt,
    ).getTime()),
  [orders, tasksByOrder]);

  const workCenterNames = useMemo(
    () => new Map(workCenters.map((center) => [center.id, center.name])),
    [workCenters],
  );

  const operationNames = useMemo(
    () => new Map(operations.map((operation) => [operation.id, operation.operationName])),
    [operations],
  );

  const productNames = useMemo(
    () => new Map(inventory.map((item) => [item.productId, item.productName])),
    [inventory],
  );

  const orderProgress = useMemo(
    () => new Map(trackedOrders.map((row) => [row.order.id, row.progress])),
    [trackedOrders],
  );

  const planProgress = useMemo(() => {
    const map = new Map<number, Progress>();
    const byPlan = new Map<number, ProductionTask[]>();

    tasks.forEach((task) => {
      if (task.status === 'CANCELLED') return;
      const list = byPlan.get(task.planId) ?? [];
      list.push(task);
      byPlan.set(task.planId, list);
    });

    byPlan.forEach((list, planId) => {
      const required = list.reduce((sum, task) => sum + task.quantity, 0);
      const completed = list
        .filter((task) => task.status === 'COMPLETED')
        .reduce((sum, task) => sum + task.quantity, 0);
      const pct = required > 0
        ? Math.round((completed / required) * 100)
        : 0;

      map.set(planId, pct >= 100
        ? { value: 100, label: 'Complete', tone: 'done' }
        : { value: pct, label: `${pct}%`, tone: pct > 0 ? 'active' : 'idle' });
    });

    return map;
  }, [tasks]);

  const productionRows = useMemo(() => {
    const trackedOrderIds = new Set(
      trackedOrders.map((row) => row.order.id),
    );
    const activePlanIds = new Set(
      plans
        .filter((plan) => ACTIVE_PLAN_STATUSES.has(String(plan.status).toUpperCase()))
        .map((plan) => plan.planId),
    );

    return tasks
      .filter((task) => {
        if (task.status === 'CANCELLED') return false;
        if (task.orderId > 0) return trackedOrderIds.has(task.orderId);
        return activePlanIds.has(task.planId);
      })
      .sort((a, b) => b.taskId - a.taskId);
  }, [tasks, plans, trackedOrders]);

  const taskName = (task: ProductionTask) => {
    const names = task.assignments
      .map((assignment) => operationNames.get(assignment.operationId))
      .filter((name): name is string => Boolean(name));

    return names.length > 0
      ? [...new Set(names)].join(' · ')
      : `Production ${productNames.get(task.productId) ?? `PRD-${task.productId}`}`;
  };

  const taskWorkCenters = (task: ProductionTask) => {
    const lineNames = [...new Set(
      task.lineAssignments.map((assignment) => assignment.lineName),
    )];

    if (lineNames.length > 0) {
      return lineNames.join(', ');
    }

    const names = task.assignments
      .map((assignment) => workCenterNames.get(assignment.workCenterId))
      .filter((name): name is string => Boolean(name));

    return names.length > 0 ? [...new Set(names)].join(', ') : '—';
  };

  const finishOrder = async (order: Order) => {
    setBusyOrderId(order.id);
    const completed = await onCompleteOrder(order);
    setBusyOrderId(null);

    if (completed) {
      await loadProduction();
    }
  };

  return (
    <div>
      <div className="welcome-row">
        <div>
          <h2>Good day, Warehouse Admin <span>✦</span></h2>
          <p>Order and production progress at a glance.</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          label="TOTAL ORDERS"
          value={String(orders.length)}
          detail={`${activeOrders} active orders`}
          icon={faClipboardList}
          tone="blue"
        />
        <StatCard
          label="INVENTORY UNITS"
          value={totalUnits.toLocaleString('en-CA')}
          detail={`${inventory.length} products tracked`}
          icon={faBoxesStacked}
          tone="green"
        />
        <StatCard
          label="ORDER VALUE"
          value={money(totalRevenue)}
          detail="Excluding cancelled orders"
          icon={faSackDollar}
          tone="violet"
        />
        <StatCard
          label="LOW STOCK ALERTS"
          value={String(lowStock)}
          detail={lowStock ? 'Requires your attention' : 'All stock levels healthy'}
          icon={faCircleExclamation}
          tone="amber"
        />
      </div>

      {productionError && (
        <div className="alert alert-error">
          <FontAwesomeIcon icon={faTriangleExclamation} />
          <span>{productionError}</span>
          <button onClick={() => void loadProduction()}>Retry</button>
        </div>
      )}

      <div className="table-card track-card">
        <div className="table-heading">
          <div>
            <h3>Order tracking</h3>
            <p>Confirmed orders and production progress. Finished orders leave this table.</p>
          </div>
          <button className="mini-button" onClick={() => void loadProduction()}>
            <FontAwesomeIcon icon={faArrowsRotate} /> Refresh
          </button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ORDER</th>
                <th>CUSTOMER</th>
                <th>ITEMS</th>
                <th>PRODUCTION</th>
                <th>PROGRESS</th>
                <th>DUE</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {trackedOrders.map(({ order, progress }) => {
                const productionStatus = String(order.productionStatus || '');
                const finishable = productionStatus === 'READY'
                  || productionStatus === 'PRODUCTION_COMPLETED';

                return (
                  <tr key={order.id}>
                    <td>
                      <button
                        className="table-primary-link"
                        onClick={() => onOpenOrder(order)}
                      >
                        #ORD-{order.id}
                      </button>
                    </td>
                    <td>Customer #{order.customerId}</td>
                    <td>
                      {order.items?.length ?? 0} lines ·{' '}
                      {(order.items ?? []).reduce(
                        (sum, item) => sum + item.quantity,
                        0,
                      )} units
                    </td>
                    <td>
                      <span className={`status-pill status-${statusClass(productionStatus || 'unknown')}`}>
                        <i />{productionLabel(productionStatus)}
                      </span>
                    </td>
                    <td><ProgressBar progress={progress} /></td>
                    <td className="muted-cell">{formatDate(order.dueDate)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="mini-button" onClick={() => onOpenOrder(order)}>
                          View
                        </button>
                        {finishable && (
                          <button
                            className="mini-button mini-button-success"
                            disabled={busyOrderId === order.id}
                            onClick={() => void finishOrder(order)}
                          >
                            {busyOrderId === order.id ? 'Finishing...' : 'Mark finished'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {trackedOrders.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      {productionLoading
                        ? 'Loading order tracking...'
                        : 'No confirmed orders in tracking. Confirm a created order to start.'}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-card track-card">
        <div className="table-heading">
          <div>
            <h3>Production status tracking</h3>
            <p>Task status for tracked orders and active replenishment plans. Progress follows the order's production progress.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>TASK</th>
                <th>TASK NAME</th>
                <th>LINE / WORK CENTER</th>
                <th>ORDER ID</th>
                <th>DUE DATE</th>
                <th>ACTUAL COMPLETION</th>
                <th>STATUS</th>
                <th>PROGRESS</th>
              </tr>
            </thead>
            <tbody>
              {productionRows.map((task) => {
                const progress: Progress = task.orderId > 0
                  ? orderProgress.get(task.orderId) ?? { value: 0, label: '0%', tone: 'idle' }
                  : planProgress.get(task.planId) ?? { value: 0, label: '0%', tone: 'idle' };

                return (
                  <tr key={task.taskId}>
                    <td className="muted-cell">#{task.taskId}</td>
                    <td>{taskName(task)}</td>
                    <td>{taskWorkCenters(task)}</td>
                    <td>{task.orderId < 0 ? 'Replenishment' : `#${task.orderId}`}</td>
                    <td className="muted-cell">{formatDate(task.dueDate)}</td>
                    <td className="muted-cell">
                      {task.completedAt ? formatDateTime(task.completedAt) : '—'}
                    </td>
                    <td>
                      <span className={`status-pill status-${statusClass(task.status)}`}>
                        <i />{friendlyStatus(task.status)}
                      </span>
                    </td>
                    <td><ProgressBar progress={progress} /></td>
                  </tr>
                );
              })}
              {productionRows.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      {productionLoading
                        ? 'Loading production tracking...'
                        : 'No production tasks for tracked orders or active replenishment plans.'}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
