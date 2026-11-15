import {
  Fragment, useCallback, useEffect, useMemo, useRef, useState, type FormEvent,
} from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowsRotate, faBan, faCheck, faChevronDown, faChevronUp,
  faCircleExclamation, faClipboardList, faFlag, faListCheck, faPen,
  faPlay, faPlus, faTrash, faTriangleExclamation, faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons';
import Modal from '../../components/Modal';
import StatCard from '../../components/StatCard';
import { api } from '../../services/api';
import { useReferenceData } from '../../hooks/useReferenceData';
import {
  addDays, formatDateTime, formatDate, formatHours, formatTime,
  friendlyStatus, statusClass, toDateInput, todayInput,
} from '../../utils/format';
import type {
  GeneratePlanRequest, InventoryItem, Order, PlanDetails, PlanSummary,
  PlanTaskRequest, ProductionLine, ProductionTask,
} from '../../types';

const ALGORITHMS = ['PRIORITY_EARLIEST_DUE_DATE'];

const byNewest = (a: PlanSummary, b: PlanSummary) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : 'Unexpected error';

const toDateTimeInput = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatTimelineTick = (value: number) =>
  new Date(value).toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const startOfWeek = (value: Date) => {
  const date = new Date(value);
  const day = date.getDay();
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate();

const formatWeekRange = (start: Date) => {
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = start.toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
  });
  const endLabel = end.toLocaleDateString('en-CA', sameMonth
    ? { day: 'numeric', year: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });

  return `${startLabel} – ${endLabel}`;
};

export default function PlanningBoard() {
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [tasks, setTasks] = useState<ProductionTask[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);

  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateSeed, setGenerateSeed] = useState<GeneratePlanRequest | null>(null);

  const [details, setDetails] = useState<PlanDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [busyPlanId, setBusyPlanId] = useState<number | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [taskForm, setTaskForm] = useState<{
    mode: 'add' | 'edit';
    task?: ProductionTask;
  } | null>(null);
  const detailsRequest = useRef(0);

  const reference = useReferenceData();

  const workCenterNames = useMemo(
    () => new Map(reference.workCenters.map((center) => [center.id, center.name])),
    [reference.workCenters],
  );
  const employeeNames = useMemo(
    () => new Map(reference.employees.map((employee) => [employee.id, employee.name])),
    [reference.employees],
  );
  const operationNames = useMemo(
    () => new Map(reference.operations.map((operation) => [operation.id, operation.operationName])),
    [reference.operations],
  );

  const productNames = useMemo(
    () => new Map(inventory.map((item) => [item.productId, item.productName])),
    [inventory],
  );

  const productName = (productId: number) =>
    productNames.get(productId) ?? `PRD-${productId}`;

  const taskLineNames = (task: ProductionTask) => {
    const names = [...new Set(
      (task.lineAssignments ?? [])
        .map((assignment) => assignment.lineName)
        .filter(Boolean),
    )];

    return names.length > 0 ? names.join(', ') : '—';
  };

  const planById = useMemo(
    () => new Map(plans.map((plan) => [plan.planId, plan])),
    [plans],
  );

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const weekStartMs = weekStart.getTime();
  const weekEndMs = weekEnd.getTime();
  const weekMs = Math.max(1, weekEndMs - weekStartMs);

  const weekTasks = useMemo(() => tasks.filter((task) => {
    if (task.status === 'CANCELLED' || !task.startTime || !task.endTime) {
      return false;
    }

    const start = new Date(task.startTime).getTime();
    const end = new Date(task.endTime).getTime();

    return start < weekEndMs && end > weekStartMs;
  }), [tasks, weekStartMs, weekEndMs]);

  const unscheduledTasks = useMemo(
    () => tasks.filter(
      (task) => task.status !== 'CANCELLED' && (!task.startTime || !task.endTime),
    ),
    [tasks],
  );

  const weekGroups = useMemo(() => {
    const byPlan = new Map<number, ProductionTask[]>();

    weekTasks.forEach((task) => {
      const list = byPlan.get(task.planId) ?? [];
      list.push(task);
      byPlan.set(task.planId, list);
    });

    return [...byPlan.entries()]
      .map(([planId, planTasks]) => ({
        plan: planById.get(planId),
        tasks: planTasks,
      }))
      .filter((group): group is {
        plan: PlanSummary;
        tasks: ProductionTask[];
      } => group.plan != null && group.plan.status !== 'CANCELLED')
      .sort((a, b) => new Date(a.plan.planningStart).getTime()
        - new Date(b.plan.planningStart).getTime());
  }, [weekTasks, planById]);

  const weekPlanIds = useMemo(
    () => new Set(weekTasks.map((task) => task.planId)),
    [weekTasks],
  );

  const weekPartCount = useMemo(
    () => weekGroups.reduce((sum, group) => sum + group.tasks.length, 0),
    [weekGroups],
  );

  const otherWeekPlans = useMemo(() => plans.filter((plan) => {
    if (plan.status === 'CANCELLED' || weekPlanIds.has(plan.planId)) {
      return false;
    }

    const start = new Date(plan.planningStart).getTime();
    const end = new Date(plan.planningEnd).getTime();

    return start < weekEndMs && end >= weekStartMs;
  }), [plans, weekPlanIds, weekStartMs, weekEndMs]);

  const loadPlans = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const [planData, taskData] = await Promise.all([
        api.getPlans(),
        api.getProductionTasks().catch(() => [] as ProductionTask[]),
      ]);
      setPlans([...planData].sort(byNewest));
      setTasks(Array.isArray(taskData) ? taskData : []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPlans(); }, [loadPlans]);

  useEffect(() => {
    void api.getOrders()
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => setOrders([]));
    void api.getInventory()
      .then((data) => setInventory(Array.isArray(data) ? data : []))
      .catch(() => setInventory([]));
    void api.getProductionLines()
      .then((data) => setLines(Array.isArray(data) ? data : []))
      .catch(() => setLines([]));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 6000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const flash = (message: string, isError = false) => {
    setNotice(message);
    setNoticeError(isError);
  };

  const openDetails = async (planId: number) => {
    const requestId = ++detailsRequest.current;
    setDetailsLoading(true);
    setExpandedTaskId(null);
    try {
      const plan = await api.getPlan(planId);
      if (requestId === detailsRequest.current) setDetails(plan);
    } catch (err) {
      if (requestId === detailsRequest.current) flash(errorMessage(err), true);
    } finally {
      if (requestId === detailsRequest.current) setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    detailsRequest.current += 1;
    setDetails(null);
    setDetailsLoading(false);
  };

  const editable = Boolean(
    details && ['DRAFT', 'VALIDATED'].includes(details.status),
  );

  const detailsSummary = details
    ? plans.find((plan) => plan.planId === details.planId)
    : undefined;

  const handleTaskSaved = async () => {
    setTaskForm(null);
    if (details) await openDetails(details.planId);
    await loadPlans(true);
    flash('Production part saved.');
  };

  const deleteTask = async (task: ProductionTask) => {
    if (!details) return;
    if (!window.confirm(
      `Remove production part #${task.taskId} (${task.quantity} units)?`,
    )) return;

    setBusyTaskId(task.taskId);
    try {
      await api.deletePlanTask(details.planId, task.taskId);
      flash(`Production part #${task.taskId} removed.`);
      await openDetails(details.planId);
      await loadPlans(true);
    } catch (err) {
      flash(errorMessage(err), true);
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleGenerated = async (plan: PlanSummary) => {
    setGenerateOpen(false);
    setGenerateSeed(null);
    flash(`Draft plan ${plan.planNumber} generated.`);
    await loadPlans(true);
    await openDetails(plan.planId);
  };

  const confirmPlan = async (plan: PlanSummary) => {
    if (!window.confirm(
      `Confirm ${plan.planNumber}? This reserves materials and updates the production status of its orders.`,
    )) return;

    setBusyPlanId(plan.planId);
    try {
      const response = await api.confirmPlan(plan.planId);
      flash(response.message);
      await loadPlans(true);
      if (details?.planId === plan.planId) await openDetails(plan.planId);
    } catch (err) {
      flash(errorMessage(err), true);
    } finally {
      setBusyPlanId(null);
    }
  };

  const cancelPlan = async (plan: PlanSummary) => {
    if (!window.confirm(`Cancel ${plan.planNumber}? Reserved materials will be released.`)) return;

    setBusyPlanId(plan.planId);
    try {
      const response = await api.cancelPlan(plan.planId);
      flash(response.message);
      await loadPlans(true);
      if (details?.planId === plan.planId) await openDetails(plan.planId);
    } catch (err) {
      flash(errorMessage(err), true);
    } finally {
      setBusyPlanId(null);
    }
  };

  const startTask = async (task: ProductionTask) => {
    setBusyTaskId(task.taskId);
    try {
      await api.startTask(task.taskId);
      flash(`Task #${task.taskId} started.`);
      await loadPlans(true);
      if (details) await openDetails(details.planId);
    } catch (err) {
      flash(errorMessage(err), true);
    } finally {
      setBusyTaskId(null);
    }
  };

  const completeTask = async (task: ProductionTask) => {
    setBusyTaskId(task.taskId);
    try {
      await api.completeTask(task.taskId);
      flash(`Task #${task.taskId} completed.`);
      await loadPlans(true);
      if (details) await openDetails(details.planId);
    } catch (err) {
      flash(errorMessage(err), true);
    } finally {
      setBusyTaskId(null);
    }
  };

  const recalculate = (plan: PlanSummary) => {
    setGenerateSeed({
      planningStart: toDateInput(new Date(plan.planningStart)),
      planningEnd: toDateInput(new Date(plan.planningEnd)),
      algorithm: plan.algorithm,
    });
    setGenerateOpen(true);
  };

  const latest = plans[0];

  return (
    <div>
      <div className="page-toolbar compact-toolbar">
        <div>
          <h2>Planning board</h2>
          <p>Release-ready view of generated plans, delivery risk and material coverage.</p>
        </div>
        <div className="toolbar-actions">
          <button className="button button-secondary" onClick={() => void loadPlans()} disabled={loading}>
            <FontAwesomeIcon icon={faArrowsRotate} /> Refresh
          </button>
          <button
            className="button button-primary"
            onClick={() => { setGenerateSeed(null); setGenerateOpen(true); }}
          >
            <FontAwesomeIcon icon={faWandMagicSparkles} /> Generate plan
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <FontAwesomeIcon icon={faCircleExclamation} />
          <span>{error}</span>
          <button onClick={() => void loadPlans()}>Retry</button>
        </div>
      )}

      <div className="stats-grid stats-grid-five">
        <StatCard
          label="PLANNED ORDERS"
          value={String(latest?.totalOrders ?? 0)}
          detail={latest ? `Latest: ${latest.planNumber}` : 'No plans generated yet'}
          icon={faClipboardList}
          tone="blue"
        />
        <StatCard
          label="SCHEDULED ORDERS"
          value={String(latest?.scheduledOrders ?? 0)}
          detail="Operations with a time slot"
          icon={faListCheck}
          tone="green"
        />
        <StatCard
          label="AT-RISK ORDERS"
          value={String(latest?.atRiskOrders ?? 0)}
          detail="Completion after due date"
          icon={faTriangleExclamation}
          tone="amber"
        />
        <StatCard
          label="MATERIAL SHORTAGES"
          value={String(latest?.materialShortageOrders ?? 0)}
          detail="BOM requirements uncovered"
          icon={faFlag}
          tone="violet"
        />
        <StatCard
          label="CAPACITY SHORTAGES"
          value={String(latest?.capacityShortageOrders ?? 0)}
          detail="No feasible resource slot"
          icon={faCircleExclamation}
          tone="amber"
        />
      </div>

      <div className="week-toolbar">
        <div className="week-nav">
          <button className="mini-button" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            ← Prev week
          </button>
          <button className="mini-button" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            This week
          </button>
          <button className="mini-button" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            Next week →
          </button>
        </div>
        <span className="week-range">
          {formatWeekRange(weekStart)} · {weekGroups.length} plan
          {weekGroups.length === 1 ? '' : 's'} · {weekPartCount} parts
        </span>
      </div>

      <div className="week-timeline-scroll">
        <div className="week-timeline">
          <div className="week-head">
            <div className="week-label-col">PLAN / ACTIVITY</div>
            <div className="week-days">
              {weekDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className={`week-day ${isSameDay(day, new Date()) ? 'week-day-today' : ''}`}
                >
                  <span>{day.toLocaleDateString('en-CA', { weekday: 'short' })}</span>
                  <strong>{day.getDate()}</strong>
                </div>
              ))}
            </div>
            <div className="week-actions-col" />
          </div>

          {weekGroups.map(({ plan, tasks: planTasks }) => {
            const taskStarts = planTasks.map(
              (task) => new Date(task.startTime!).getTime(),
            );
            const taskEnds = planTasks.map(
              (task) => new Date(task.endTime!).getTime(),
            );
            const spanStart = Math.max(weekStartMs, Math.min(...taskStarts));
            const spanEnd = Math.min(weekEndMs, Math.max(...taskEnds));
            const spanLeft = ((spanStart - weekStartMs) / weekMs) * 100;
            const spanWidth = Math.max(0.5, ((spanEnd - spanStart) / weekMs) * 100);

            return (
              <Fragment key={plan.planId}>
                <div className="week-plan-row">
                  <div className="week-plan-label">
                    <button
                      className="table-primary-link"
                      onClick={() => void openDetails(plan.planId)}
                    >
                      {plan.planNumber}
                    </button>
                    <small>{friendlyStatus(plan.status)} · {plan.algorithm}</small>
                  </div>
                  <div className="week-plan-track">
                    <div className="week-day-grid">
                      {weekDays.map((day) => (
                        <span
                          key={day.toISOString()}
                          className={`week-day-cell ${isSameDay(day, new Date()) ? 'week-day-today' : ''}`}
                        />
                      ))}
                    </div>
                    <span
                      className="week-plan-span"
                      style={{ left: `${spanLeft}%`, width: `${spanWidth}%` }}
                    />
                  </div>
                  <div className="week-actions-col">
                    <button className="mini-button" onClick={() => void openDetails(plan.planId)}>
                      Manage
                    </button>
                  </div>
                </div>

                {planTasks.map((task) => {
                  const start = Math.max(
                    weekStartMs,
                    new Date(task.startTime!).getTime(),
                  );
                  const end = Math.min(
                    weekEndMs,
                    new Date(task.endTime!).getTime(),
                  );
                  const left = ((start - weekStartMs) / weekMs) * 100;
                  const width = Math.max(0.5, ((end - start) / weekMs) * 100);

                  return (
                    <div className="week-task-row" key={task.taskId}>
                      <div className="week-task-label">
                        <strong>
                          {task.orderId < 0 ? 'Replenishment' : `#${task.orderId}`}
                        </strong>
                        <small>
                          {taskLineNames(task)} · {productName(task.productId)} · {task.quantity} units · {friendlyStatus(task.status)}
                        </small>
                      </div>
                      <div className="week-task-track">
                        <div className="week-day-grid">
                          {weekDays.map((day) => (
                            <span
                              key={day.toISOString()}
                              className={`week-day-cell ${isSameDay(day, new Date()) ? 'week-day-today' : ''}`}
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          className={`week-task-bar status-${statusClass(task.status)}`}
                          style={{ left: `${left}%`, width: `${width}%` }}
                          title={`${formatDateTime(task.startTime)} → ${formatDateTime(task.endTime)}`}
                          onClick={() => void openDetails(plan.planId)}
                        >
                          {task.quantity} units
                        </button>
                      </div>
                      <div className="week-actions-col" />
                    </div>
                  );
                })}
              </Fragment>
            );
          })}

          {!loading && weekGroups.length === 0 && (
            <div className="empty-state">
              No production activities this week. Generate a plan or move to another week.
            </div>
          )}
          {loading && (
            <div className="loading-inline">
              <span className="spinner" /> Loading weekly plan...
            </div>
          )}
        </div>
      </div>

      {otherWeekPlans.length > 0 && (
        <div className="week-other-plans">
          <span>Plans in this window without scheduled parts:</span>
          {otherWeekPlans.map((plan) => (
            <button
              key={plan.planId}
              className="mini-button"
              onClick={() => void openDetails(plan.planId)}
            >
              {plan.planNumber}
            </button>
          ))}
        </div>
      )}

      {unscheduledTasks.length > 0 && (
        <div className="week-unscheduled">
          <strong>Unscheduled parts</strong>
          <div className="row-actions">
            {unscheduledTasks.map((task) => (
              <button
                key={task.taskId}
                className="mini-button"
                onClick={() => void openDetails(task.planId)}
              >
                {task.orderId < 0 ? 'Replenishment' : `#${task.orderId}`}
                {' · '}{productName(task.productId)} · {task.quantity}
              </button>
            ))}
          </div>
        </div>
      )}

      {generateOpen && (
        <GeneratePlanForm
          seed={generateSeed}
          orders={orders}
          onClose={() => { setGenerateOpen(false); setGenerateSeed(null); }}
          onGenerated={(plan) => void handleGenerated(plan)}
        />
      )}

      {(details || detailsLoading) && (
        <Modal
          wide
          eyebrow="PRODUCTION PLAN"
          title={details ? details.planNumber : 'Loading plan'}
          subtitle={details ? `${formatDate(details.planningStart)} → ${formatDate(details.planningEnd)} · ${details.algorithm}` : 'Fetching plan details'}
          onClose={closeDetails}
          footer={details && <>
            {detailsSummary && (details.status === 'DRAFT' || details.status === 'VALIDATED') && (
              <button
                className="button button-primary"
                disabled={busyPlanId === details.planId}
                onClick={() => void confirmPlan(detailsSummary)}
              >
                <FontAwesomeIcon icon={faCheck} /> Confirm plan
              </button>
            )}
            {detailsSummary && (
              <button
                className="button button-secondary"
                onClick={() => {
                  closeDetails();
                  recalculate(detailsSummary);
                }}
              >
                <FontAwesomeIcon icon={faArrowsRotate} /> Recalculate
              </button>
            )}
            {detailsSummary && !['CANCELLED', 'COMPLETED', 'IN_PROGRESS'].includes(detailsSummary.status) && (
              <button
                className="button button-danger"
                disabled={busyPlanId === details.planId}
                onClick={() => void cancelPlan(detailsSummary)}
              >
                <FontAwesomeIcon icon={faBan} /> Cancel plan
              </button>
            )}
            <button className="button button-ghost" onClick={closeDetails}>Close</button>
          </>}
        >
          {detailsLoading && !details && (
            <div className="loading-inline"><span className="spinner" /> Loading plan details...</div>
          )}

          {details && (
            <>
              <div className="detail-summary plan-summary">
                <div>
                  <small>STATUS</small>
                  <span className={`status-pill status-${statusClass(details.status)}`}>
                    <i />{friendlyStatus(details.status)}
                  </span>
                </div>
                <div><small>PLANNING START</small><strong>{formatDate(details.planningStart)}</strong></div>
                <div><small>PLANNING END</small><strong>{formatDate(details.planningEnd)}</strong></div>
                <div><small>TASKS</small><strong>{details.tasks.length}</strong></div>
                <div><small>RESERVATION</small><strong>{details.reservationReference || 'Not reserved'}</strong></div>
              </div>

              {details.failureReason && (
                <div className="alert alert-error">
                  <FontAwesomeIcon icon={faCircleExclamation} />
                  <span>{details.failureReason}</span>
                </div>
              )}

              <PlanTimeline tasks={details.tasks} productName={productName} />

              <div className="detail-section-head">
                <h3 className="detail-section-title">Production tasks</h3>
                {editable && (
                  <button className="mini-button" onClick={() => setTaskForm({ mode: 'add' })}>
                    <FontAwesomeIcon icon={faPlus} /> Add production part
                  </button>
                )}
              </div>
              {details.tasks.length === 0 ? (
                <div className="empty-state">This plan has no production tasks.</div>
              ) : (
                <div className="table-scroll detail-table">
                  <table>
                    <thead>
                      <tr>
                        <th>TASK</th>
                        <th>ORDER</th>
                        <th>PRODUCT</th>
                        <th>LINE</th>
                        <th>QTY</th>
                        <th>PRIORITY</th>
                        <th>START</th>
                        <th>END</th>
                        <th>DUE</th>
                        <th>STATUS</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.tasks.map((task) => {
                        const expanded = expandedTaskId === task.taskId;
                        const startable = ['SCHEDULED', 'AT_RISK', 'CONFIRMED'].includes(task.status)
                          && ['CONFIRMED', 'IN_PROGRESS'].includes(details.status);
                        return (
                          <Fragment key={task.taskId}>
                            <tr className={expanded ? 'row-expanded' : ''}>
                              <td>
                                <button className="table-primary-link" onClick={() => setExpandedTaskId(expanded ? null : task.taskId)}>
                                  #{task.taskId}
                                </button>
                              </td>
                              <td>{task.orderId < 0 ? 'Replenishment' : `#${task.orderId}`}</td>
                              <td>{productName(task.productId)}</td>
                              <td>{taskLineNames(task)}</td>
                              <td>{task.quantity}</td>
                              <td>
                                <span className={`priority-pill priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
                              </td>
                              <td className="muted-cell">{formatDateTime(task.startTime)}</td>
                              <td className="muted-cell">{formatDateTime(task.endTime)}</td>
                              <td className="muted-cell">{formatDateTime(task.dueDate)}</td>
                              <td>
                                <span className={`status-pill status-${statusClass(task.status)}`}>
                                  <i />{friendlyStatus(task.status)}
                                </span>
                              </td>
                              <td>
                                <div className="row-actions">
                                  {startable && (
                                    <button className="mini-button" disabled={busyTaskId === task.taskId} onClick={() => void startTask(task)}>
                                      <FontAwesomeIcon icon={faPlay} /> Start
                                    </button>
                                  )}
                                  {task.status === 'IN_PROGRESS' && (
                                    <button className="mini-button mini-button-success" disabled={busyTaskId === task.taskId} onClick={() => void completeTask(task)}>
                                      <FontAwesomeIcon icon={faCheck} /> Complete
                                    </button>
                                  )}
                                  <button className="mini-button" onClick={() => setExpandedTaskId(expanded ? null : task.taskId)}>
                                    <FontAwesomeIcon icon={expanded ? faChevronUp : faChevronDown} /> Details
                                  </button>
                                  {editable && (
                                    <>
                                      <button
                                        className="mini-button"
                                        onClick={() => setTaskForm({ mode: 'edit', task })}
                                      >
                                        <FontAwesomeIcon icon={faPen} /> Edit
                                      </button>
                                      <button
                                        className="mini-button mini-button-danger"
                                        disabled={busyTaskId === task.taskId}
                                        onClick={() => void deleteTask(task)}
                                      >
                                        <FontAwesomeIcon icon={faTrash} /> Remove
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {expanded && (
                              <tr className="expanded-row">
                                <td colSpan={11}>
                                  <div className="task-expanded">
                                    {task.statusReason && (
                                      <p className="task-reason">
                                        <FontAwesomeIcon icon={faCircleExclamation} /> {task.statusReason}
                                      </p>
                                    )}
                                    <div className="expanded-grid">
                                      <div>
                                        <h4>Production line assignments</h4>
                                        {task.lineAssignments.length > 0 ? (
                                          <table className="inner-table">
                                            <thead>
                                              <tr>
                                                <th>LINE</th>
                                                <th>CODE</th>
                                                <th>START</th>
                                                <th>END</th>
                                                <th>HOURS</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {task.lineAssignments.map((assignment) => (
                                                <tr key={assignment.assignmentId}>
                                                  <td>{assignment.lineName}</td>
                                                  <td>{assignment.lineCode}</td>
                                                  <td>{formatTime(assignment.startTime)} · {formatDate(assignment.startTime)}</td>
                                                  <td>{formatTime(assignment.endTime)} · {formatDate(assignment.endTime)}</td>
                                                  <td>{formatHours(assignment.allocatedHours)}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        ) : task.assignments.length > 0 ? (
                                          <>
                                            <h4>Legacy resource assignments</h4>
                                            <table className="inner-table">
                                              <thead>
                                                <tr>
                                                  <th>OPERATION</th>
                                                  <th>WORK CENTER</th>
                                                  <th>EMPLOYEE</th>
                                                  <th>START</th>
                                                  <th>END</th>
                                                  <th>HOURS</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {task.assignments.map((assignment) => (
                                                  <tr key={assignment.assignmentId}>
                                                    <td>{operationNames.get(assignment.operationId) ?? `Op #${assignment.operationId}`}</td>
                                                    <td>{workCenterNames.get(assignment.workCenterId) ?? `WC #${assignment.workCenterId}`}</td>
                                                    <td>{employeeNames.get(assignment.employeeId) ?? `EMP #${assignment.employeeId}`}</td>
                                                    <td>{formatTime(assignment.startTime)} · {formatDate(assignment.startTime)}</td>
                                                    <td>{formatTime(assignment.endTime)} · {formatDate(assignment.endTime)}</td>
                                                    <td>{formatHours(assignment.allocatedHours)}</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </>
                                        ) : (
                                          <p className="empty-inline">No production line assigned.</p>
                                        )}
                                      </div>
                                      <div>
                                        <h4>Material requirements</h4>
                                        {task.materials.length === 0 ? (
                                          <p className="empty-inline">No material requirement recorded.</p>
                                        ) : (
                                          <table className="inner-table">
                                            <thead>
                                              <tr>
                                                <th>MATERIAL</th>
                                                <th>REQUIRED</th>
                                                <th>RESERVED</th>
                                                <th>STATUS</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {task.materials.map((material) => (
                                                <tr key={material.requirementId}>
                                                  <td>{productName(material.materialProductId)}</td>
                                                  <td>{material.requiredQuantity}</td>
                                                  <td>{material.reservedQuantity}</td>
                                                  <td>
                                                    <span className={`status-pill status-${statusClass(material.status)}`}>
                                                      <i />{friendlyStatus(material.status)}
                                                    </span>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        )}
                                      </div>
                                    </div>
                                    <p className="task-meta">
                                      Estimated completion: <strong>{formatDateTime(task.estimatedCompletion)}</strong>
                                      {' · '}Due: <strong>{formatDateTime(task.dueDate)}</strong>
                                    </p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Modal>
      )}

      {taskForm && details && (
        <PlanTaskForm
          plan={details}
          mode={taskForm.mode}
          task={taskForm.task}
          orders={orders}
          inventory={inventory}
          lines={lines}
          onClose={() => setTaskForm(null)}
          onSaved={handleTaskSaved}
        />
      )}

      {notice && (
        <div className={`toast ${noticeError ? 'toast-error' : ''}`}>
          <FontAwesomeIcon icon={noticeError ? faCircleExclamation : faCheck} />
          {notice}
        </div>
      )}
    </div>
  );
}

interface GenerateFormProps {
  seed: GeneratePlanRequest | null;
  orders: Order[];
  onClose: () => void;
  onGenerated: (plan: PlanSummary) => void;
}

function GeneratePlanForm({
  seed, orders, onClose, onGenerated,
}: GenerateFormProps) {
  const [planningStart, setPlanningStart] = useState(seed?.planningStart ?? todayInput());
  const [planningEnd, setPlanningEnd] = useState(
    seed?.planningEnd ?? toDateInput(addDays(new Date(), 7)),
  );
  const [scheduleStart, setScheduleStart] = useState(
    seed?.scheduleStart ?? `${seed?.planningStart ?? todayInput()}T08:00`,
  );
  const [algorithm, setAlgorithm] = useState(seed?.algorithm ?? ALGORITHMS[0]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const windowOrders = useMemo(() => orders
    .filter((order) => {
      if (String(order.status).toUpperCase() !== 'CONFIRMED') return false;
      if (String(order.productionStatus).toUpperCase() !== 'PENDING_PRODUCTION') return false;
      const due = order.dueDate ? order.dueDate.slice(0, 10) : '';
      return due !== '' && due >= planningStart && due <= planningEnd;
    })
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))),
  [orders, planningStart, planningEnd]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!planningStart || !planningEnd || !scheduleStart) {
      setFormError('Planning dates and a production start are required.');
      return;
    }
    if (planningEnd < planningStart) {
      setFormError('Planning end must not be before planning start.');
      return;
    }
    const scheduleDay = scheduleStart.slice(0, 10);
    if (scheduleDay < planningStart || scheduleDay > planningEnd) {
      setFormError('Production start must be within the planning window.');
      return;
    }
    setBusy(true);
    try {
      const plan = await api.generatePlan({
        planningStart,
        planningEnd,
        scheduleStart,
        algorithm,
      });
      onGenerated(plan);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      eyebrow="PRODUCTION PLANNING"
      title="Generate production plan"
      subtitle="Creates a DRAFT plan. Materials are not reserved and orders are not updated until you confirm."
      onClose={onClose}
      footer={<>
        <button type="button" className="button button-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" form="generate-plan-form" className="button button-primary" disabled={busy}>
          {busy ? 'Generating...' : 'Generate draft'}
        </button>
      </>}
    >
      <form id="generate-plan-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="field-label">
            Planning start
            <input
              className="form-input"
              type="date"
              value={planningStart}
              onChange={(event) => setPlanningStart(event.target.value)}
              required
            />
          </label>
          <label className="field-label">
            Planning end
            <input
              className="form-input"
              type="date"
              value={planningEnd}
              onChange={(event) => setPlanningEnd(event.target.value)}
              required
            />
          </label>
          <label className="field-label">
            Production start
            <input
              className="form-input"
              type="datetime-local"
              value={scheduleStart}
              min={`${planningStart}T00:00`}
              max={`${planningEnd}T23:59`}
              onChange={(event) => setScheduleStart(event.target.value)}
              required
            />
          </label>
          <label className="field-label">
            Algorithm
            <select className="form-input" value={algorithm} onChange={(event) => setAlgorithm(event.target.value)}>
              {ALGORITHMS.map((item) => <option key={item} value={item}>{item.replace(/_/g, ' ')}</option>)}
            </select>
          </label>
        </div>

        <div className="form-section-title">
          <span>LINKED ORDERS</span>
          <span>{windowOrders.length}</span>
        </div>
        {windowOrders.length === 0 ? (
          <div className="empty-inline">
            No confirmed orders with pending production in this window.
          </div>
        ) : (
          <div className="generate-order-list">
            {windowOrders.map((order) => (
              <div className="generate-order-row" key={order.id}>
                <div>
                  <strong>#ORD-{order.id}</strong>
                  <small>
                    Customer #{order.customerId}
                    {order.dueDate ? ` · due ${formatDate(order.dueDate)}` : ''}
                  </small>
                </div>
                <div className="generate-order-items">
                  {(order.items ?? []).map((item, index) => (
                    <span key={item.id ?? `${item.productId}-${index}`}>
                      {item.productName} × {item.quantity}
                    </span>
                  ))}
                </div>
                <strong>
                  {(order.items ?? []).reduce(
                    (sum, item) => sum + item.quantity,
                    0,
                  )} units
                </strong>
              </div>
            ))}
          </div>
        )}

        {formError && <div className="form-error">{formError}</div>}
        <div className="plan-hint">
          <FontAwesomeIcon icon={faClipboardList} />
          <span>Generation retrieves eligible orders through gRPC and schedules production from the chosen date and hour, respecting BOM, routing, employee and work-center capacity.</span>
        </div>
      </form>
    </Modal>
  );
}

function PlanTimeline({
  tasks, productName,
}: {
  tasks: ProductionTask[];
  productName: (productId: number) => string;
}) {
  const scheduled = tasks.filter(
    (task): task is ProductionTask & { startTime: string; endTime: string } =>
      task.startTime != null && task.endTime != null,
  );

  const lineLabel = (task: ProductionTask) => {
    const names = [...new Set(
      task.lineAssignments.map((assignment) => assignment.lineName),
    )];
    return names.length > 0 ? names.join(', ') : 'No line';
  };

  if (scheduled.length === 0) {
    return (
      <div className="empty-inline">
        No scheduled parts yet. Add or edit a production part to build the timeline.
      </div>
    );
  }

  const starts = scheduled.map((task) => new Date(task.startTime).getTime());
  const ends = scheduled.map((task) => new Date(task.endTime).getTime());
  let min = Math.min(...starts);
  let max = Math.max(...ends);

  const minimumSpan = 6 * 60 * 60 * 1000;
  const span = Math.max(max - min, minimumSpan);
  const center = (min + max) / 2;
  min = center - span / 2 - 30 * 60 * 1000;
  max = center + span / 2 + 30 * 60 * 1000;
  const range = Math.max(1, max - min);
  const ticks = Array.from({ length: 5 }, (_, index) => min + (range * index) / 4);

  return (
    <div className="plan-timeline">
      <div className="plan-timeline-axis">
        {ticks.map((tick, index) => (
          <span key={index} style={{ left: `${(index / 4) * 100}%` }}>
            {formatTimelineTick(tick)}
          </span>
        ))}
      </div>
      {scheduled.map((task) => {
        const start = new Date(task.startTime).getTime();
        const end = new Date(task.endTime).getTime();
        const left = Math.max(0, ((start - min) / range) * 100);
        const width = Math.max(0.5, ((end - start) / range) * 100);

        return (
          <div className="plan-timeline-row" key={task.taskId}>
            <div className="plan-timeline-label">
              <strong>
                {task.orderId < 0 ? 'Replenishment' : `#${task.orderId}`}
              </strong>
              <small>
                {lineLabel(task)} · {productName(task.productId)} · {task.quantity} units · {friendlyStatus(task.status)}
              </small>
            </div>
            <div className="plan-timeline-track">
              {ticks.map((_, index) => (
                <span
                  key={index}
                  className="plan-timeline-grid"
                  style={{ left: `${(index / 4) * 100}%` }}
                />
              ))}
              <span
                className={`plan-timeline-bar status-${statusClass(task.status)}`}
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`${formatDateTime(task.startTime)} → ${formatDateTime(task.endTime)}`}
              >
                {task.quantity} units
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface PlanTaskFormProps {
  plan: PlanDetails;
  mode: 'add' | 'edit';
  task?: ProductionTask;
  orders: Order[];
  inventory: InventoryItem[];
  lines: ProductionLine[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

function PlanTaskForm({
  plan, mode, task, orders, inventory, lines, onClose, onSaved,
}: PlanTaskFormProps) {
  const confirmedOrders = useMemo(
    () => orders.filter(
      (order) => String(order.status).toUpperCase() === 'CONFIRMED',
    ),
    [orders],
  );

  const orderLines = useMemo(
    () => confirmedOrders.flatMap((order) => (
      (order.items ?? []).map((item) => ({ order, item }))
    )),
    [confirmedOrders],
  );

  const [source, setSource] = useState<'order' | 'replenishment'>(
    task && task.orderId < 0 ? 'replenishment' : 'order',
  );
  const [orderLine, setOrderLine] = useState(
    task && task.orderId > 0
      ? `${task.orderId}:${task.productId}`
      : (orderLines[0]
          ? `${orderLines[0].order.id}:${orderLines[0].item.productId}`
          : ''),
  );
  const [productId, setProductId] = useState(
    String(task?.productId ?? inventory[0]?.productId ?? ''),
  );
  const [lineId, setLineId] = useState(
    String(task?.lineAssignments?.[0]?.lineId ?? lines[0]?.id ?? ''),
  );
  const [quantity, setQuantity] = useState(String(task?.quantity ?? 1));
  const defaultStart = `${toDateInput(new Date(plan.planningStart))}T08:00`;
  const defaultEnd = `${toDateInput(new Date(plan.planningStart))}T09:00`;
  const [startTime, setStartTime] = useState(
    task?.startTime ? toDateTimeInput(task.startTime) : defaultStart,
  );
  const [endTime, setEndTime] = useState(
    task?.endTime ? toDateTimeInput(task.endTime) : defaultEnd,
  );
  const [priority, setPriority] = useState(task?.priority ?? 'NORMAL');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const selectedLine = orderLines.find(
    (line) => `${line.order.id}:${line.item.productId}` === orderLine,
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');

    const qty = Number(quantity);

    if (!Number.isInteger(qty) || qty <= 0) {
      setFormError('Quantity must be a positive whole number.');
      return;
    }
    if (!startTime || !endTime || endTime <= startTime) {
      setFormError('End time must be after start time.');
      return;
    }
    if (source === 'order' && !selectedLine) {
      setFormError('Select an order line.');
      return;
    }
    if (source === 'replenishment' && !productId) {
      setFormError('Select a product for replenishment.');
      return;
    }

    const payload: PlanTaskRequest = {
      orderId: source === 'order' ? selectedLine!.order.id : -1,
      productId: source === 'order'
        ? selectedLine!.item.productId
        : Number(productId),
      quantity: qty,
      startTime,
      endTime,
      dueDate: source === 'order' ? selectedLine!.order.dueDate : undefined,
      lineId: lineId === '' ? null : Number(lineId),
      priority,
    };

    setBusy(true);
    try {
      if (mode === 'edit' && task) {
        await api.updatePlanTask(plan.planId, task.taskId, payload);
      } else {
        await api.createPlanTask(plan.planId, payload);
      }
      await onSaved();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      eyebrow={`PLAN ${plan.planNumber}`}
      title={mode === 'edit' ? 'Edit production part' : 'Add production part'}
      subtitle="Split an order into parts and schedule each part to its own date and hour."
      onClose={onClose}
      footer={<>
        <button type="button" className="button button-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" form="plan-task-form" className="button button-primary" disabled={busy}>
          {busy ? 'Saving...' : mode === 'edit' ? 'Save part' : 'Add part'}
        </button>
      </>}
    >
      <form id="plan-task-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="field-label">
            Source
            <select
              className="form-input"
              value={source}
              onChange={(event) => setSource(event.target.value as 'order' | 'replenishment')}
            >
              <option value="order">Customer order</option>
              <option value="replenishment">Replenishment</option>
            </select>
          </label>

          {source === 'order' ? (
            <label className="field-label">
              Order line
              <select
                className="form-input"
                value={orderLine}
                onChange={(event) => setOrderLine(event.target.value)}
                required
              >
                {orderLines.length === 0 && <option value="">No confirmed orders</option>}
                {orderLines.map(({ order, item }) => (
                  <option
                    key={`${order.id}:${item.productId}`}
                    value={`${order.id}:${item.productId}`}
                  >
                    #ORD-{order.id} · {item.productName} (PRD-{item.productId}) · {item.quantity} ordered
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="field-label">
              Product
              <select
                className="form-input"
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                required
              >
                {inventory.length === 0 && <option value="">No inventory products</option>}
                {inventory.map((item) => (
                  <option key={item.productId} value={item.productId}>
                    {item.productName} (PRD-{item.productId})
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="field-label">
            Production line
            <select
              className="form-input"
              value={lineId}
              onChange={(event) => setLineId(event.target.value)}
            >
              <option value="">Unassigned</option>
              {lines.map((line) => (
                <option key={line.id} value={line.id}>
                  {line.name} ({line.code}) · {line.unitsPerHour} units/h
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Quantity
            <input
              className="form-input"
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
            />
          </label>
          <label className="field-label">
            Priority
            <select
              className="form-input"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            >
              <option value="HIGH">High</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low</option>
            </select>
          </label>
          <label className="field-label">
            Start
            <input
              className="form-input"
              type="datetime-local"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              required
            />
          </label>
          <label className="field-label">
            End
            <input
              className="form-input"
              type="datetime-local"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              required
            />
          </label>
        </div>

        {formError && <div className="form-error">{formError}</div>}

        <div className="plan-hint">
          <FontAwesomeIcon icon={faClipboardList} />
          <span>Create multiple parts for the same order with different start and end times to split production across days.</span>
        </div>
      </form>
    </Modal>
  );
}
