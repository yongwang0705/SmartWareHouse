import { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowsRotate, faChartGantt, faCheck, faCircleExclamation,
  faPlay, faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import Toast from '../../components/Toast';
import { api } from '../../services/api';
import { useReferenceData } from '../../hooks/useReferenceData';
import {
  formatDate, formatDateTime, formatDay, formatHours,
  friendlyStatus, statusClass,
} from '../../utils/format';
import type {
  Assignment, PlanDetails, PlanSummary, ProductionTask,
} from '../../types';

type GroupBy = 'workCenter' | 'employee' | 'operation';

const GROUP_LABELS: Record<GroupBy, string> = {
  workCenter: 'Work center',
  employee: 'Employee',
  operation: 'Operation',
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_WIDTH = 140;

const byNewest = (a: PlanSummary, b: PlanSummary) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : 'Unexpected error';

export default function GanttBoard() {
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [details, setDetails] = useState<PlanDetails | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('workCenter');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState<{ message: string; error: boolean } | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);

  const reference = useReferenceData();

  const workCenters = useMemo(
    () => new Map(reference.workCenters.map((center) => [center.id, center])),
    [reference.workCenters],
  );
  const employees = useMemo(
    () => new Map(reference.employees.map((employee) => [employee.id, employee])),
    [reference.employees],
  );
  const operations = useMemo(
    () => new Map(reference.operations.map((operation) => [operation.id, operation])),
    [reference.operations],
  );

  const showFlash = (message: string, isError = false) => setFlash({ message, error: isError });

  useEffect(() => {
    if (!flash) return;
    const timeout = window.setTimeout(() => setFlash(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [flash]);

  const loadPlans = useCallback(async () => {
    try {
      const data = await api.getPlans();
      const sorted = [...data].sort(byNewest);
      setPlans(sorted);
      setSelectedId((current) => current ?? sorted[0]?.planId ?? null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => { void loadPlans(); }, [loadPlans]);

  const loadDetails = useCallback(async (planId: number) => {
    setLoading(true);
    setError('');
    try {
      setDetails(await api.getPlan(planId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId == null) {
      setDetails(null);
      setLoading(false);
      return;
    }
    void loadDetails(selectedId);
  }, [selectedId, loadDetails]);

  const groupLabel = useCallback((assignment: Assignment) => {
    if (groupBy === 'employee') {
      return employees.get(assignment.employeeId)?.name ?? `Employee #${assignment.employeeId}`;
    }
    if (groupBy === 'operation') {
      return operations.get(assignment.operationId)?.operationName ?? `Operation #${assignment.operationId}`;
    }
    return workCenters.get(assignment.workCenterId)?.name ?? `Work center #${assignment.workCenterId}`;
  }, [groupBy, employees, operations, workCenters]);

  const items = useMemo(() => {
    if (!details) return [];
    return details.tasks.flatMap((task) => task.assignments.map((assignment) => ({
      key: `${task.taskId}-${assignment.assignmentId}`,
      task,
      assignment,
      start: new Date(assignment.startTime).getTime(),
      end: new Date(assignment.endTime).getTime(),
    }))).filter((item) => Number.isFinite(item.start) && Number.isFinite(item.end));
  }, [details]);

  const groups = useMemo(() => {
    const grouped = new Map<string, typeof items>();
    for (const item of items) {
      const label = groupLabel(item.assignment);
      const bucket = grouped.get(label);
      if (bucket) bucket.push(item);
      else grouped.set(label, [item]);
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, groupItems]) => ({
        label,
        items: [...groupItems].sort((a, b) => a.start - b.start),
      }));
  }, [items, groupLabel]);

  const timeline = useMemo(() => {
    const fallbackStart = details ? new Date(details.planningStart).getTime() : Date.now();
    const fallbackEnd = details ? new Date(details.planningEnd).getTime() : Date.now() + DAY_MS;
    const min = items.length ? Math.min(...items.map((item) => item.start)) : fallbackStart;
    const max = items.length ? Math.max(...items.map((item) => item.end)) : fallbackEnd;

    const start = new Date(min);
    start.setHours(0, 0, 0, 0);
    const end = new Date(max);
    end.setHours(24, 0, 0, 0);

    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY_MS));
    return {
      start: start.getTime(),
      days,
      width: days * DAY_WIDTH,
      ticks: Array.from({ length: days }, (_, index) => new Date(start.getTime() + index * DAY_MS)),
    };
  }, [details, items]);

  const dayGrid = `repeating-linear-gradient(to right, transparent 0, transparent ${DAY_WIDTH - 1}px, #eef1f5 ${DAY_WIDTH - 1}px, #eef1f5 ${DAY_WIDTH}px)`;

  const position = (time: number) => ((time - timeline.start) / DAY_MS) * DAY_WIDTH;

  const unscheduled = details?.tasks.filter((task) => task.assignments.length === 0) ?? [];

  const actOnTask = async (task: ProductionTask, action: 'start' | 'complete') => {
    setBusyTaskId(task.taskId);
    try {
      if (action === 'start') await api.startTask(task.taskId);
      else await api.completeTask(task.taskId);
      showFlash(`Task #${task.taskId} ${action === 'start' ? 'started' : 'completed'}.`);
      await loadDetails(task.planId);
      await loadPlans();
    } catch (err) {
      showFlash(errorMessage(err), true);
    } finally {
      setBusyTaskId(null);
    }
  };

  return (
    <div>
      <div className="page-toolbar compact-toolbar">
        <div>
          <h2>Gantt chart</h2>
          <p>Each bar is one allocated operation. Group the timeline by work center, employee or operation.</p>
        </div>
        <div className="toolbar-actions">
          <label className="inline-field">
            <span>Plan</span>
            <select
              className="form-input select-inline"
              value={selectedId ?? ''}
              onChange={(event) => setSelectedId(event.target.value ? Number(event.target.value) : null)}
            >
              {plans.length === 0 && <option value="">No plans available</option>}
              {plans.map((plan) => (
                <option key={plan.planId} value={plan.planId}>
                  {plan.planNumber} · {friendlyStatus(plan.status)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button button-secondary"
            onClick={() => { void loadPlans(); if (selectedId != null) void loadDetails(selectedId); }}
          >
            <FontAwesomeIcon icon={faArrowsRotate} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <FontAwesomeIcon icon={faCircleExclamation} />
          <span>{error}</span>
          <button onClick={() => { void loadPlans(); if (selectedId != null) void loadDetails(selectedId); }}>Retry</button>
        </div>
      )}

      <div className="gantt-toolbar">
        <div className="segmented">
          {(Object.keys(GROUP_LABELS) as GroupBy[]).map((option) => (
            <button
              key={option}
              className={groupBy === option ? 'segmented-active' : ''}
              onClick={() => setGroupBy(option)}
            >
              {GROUP_LABELS[option]}
            </button>
          ))}
        </div>
        {details && (
          <div className="gantt-meta">
            <span className={`status-pill status-${statusClass(details.status)}`}>
              <i />{friendlyStatus(details.status)}
            </span>
            <span>{formatDate(details.planningStart)} → {formatDate(details.planningEnd)}</span>
            <span>{items.length} scheduled operation{items.length === 1 ? '' : 's'}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading-panel"><span className="spinner" /><strong>Loading schedule...</strong><span>Resolving production tasks and assignments</span></div>
      ) : !details ? (
        <div className="table-card">
          <div className="empty-state">
            <FontAwesomeIcon icon={faChartGantt} />
            <p>No production plan selected. Generate a plan on the planning board first.</p>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="table-card">
          <div className="empty-state">
            <FontAwesomeIcon icon={faTriangleExclamation} />
            <p>This plan has no scheduled operations to display on the timeline.</p>
          </div>
        </div>
      ) : (
        <div className="gantt-wrap">
          <div className="gantt-scroll">
            <div className="gantt-inner" style={{ minWidth: timeline.width + 210 }}>
              <div className="gantt-row gantt-head">
                <div className="gantt-label">{GROUP_LABELS[groupBy]}</div>
                <div className="gantt-timeline" style={{ width: timeline.width, backgroundImage: dayGrid }}>
                  {timeline.ticks.map((tick, index) => (
                    <span key={tick.toISOString()} className="gantt-day" style={{ left: index * DAY_WIDTH }}>
                      {formatDay(tick)}
                    </span>
                  ))}
                </div>
              </div>

              {groups.map((group) => (
                <div className="gantt-row" key={group.label}>
                  <div className="gantt-label">
                    <strong>{group.label}</strong>
                    <small>{group.items.length} operation{group.items.length === 1 ? '' : 's'}</small>
                  </div>
                  <div className="gantt-timeline" style={{ width: timeline.width, backgroundImage: dayGrid }}>
                    {group.items.map((item) => {
                      const left = Math.max(0, position(item.start));
                      const width = Math.max(22, position(item.end) - position(item.start));
                      const operation = operations.get(item.assignment.operationId);
                      const title = [
                        `Order #${item.task.orderId}`,
                        `Product PRD-${item.task.productId}`,
                        `Qty ${item.task.quantity}`,
                        operation?.operationName ?? `Operation #${item.assignment.operationId}`,
                        `${formatDateTime(item.assignment.startTime)} → ${formatDateTime(item.assignment.endTime)}`,
                        formatHours(item.assignment.allocatedHours),
                        friendlyStatus(item.task.status),
                      ].join(' · ');
                      return (
                        <div
                          key={item.key}
                          className={`gantt-bar gantt-bar-${statusClass(item.task.status)}`}
                          style={{ left, width }}
                          title={title}
                        >
                          <span>#{item.task.orderId} · PRD-{item.task.productId}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="gantt-legend">
            {['SCHEDULED', 'AT_RISK', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].map((status) => (
              <span key={status} className={`legend-${statusClass(status)}`}>
                <i />{friendlyStatus(status)}
              </span>
            ))}
          </div>
        </div>
      )}

      {unscheduled.length > 0 && (
        <div className="alert alert-warning">
          <FontAwesomeIcon icon={faTriangleExclamation} />
          <span>
            {unscheduled.length} task{unscheduled.length === 1 ? '' : 's'} could not be scheduled:
            {' '}{unscheduled.map((task) => `#${task.taskId} (${friendlyStatus(task.status)})`).join(', ')}
          </span>
        </div>
      )}

      {details && details.tasks.length > 0 && (
        <div className="table-card">
          <div className="table-heading">
            <div>
              <h3>Scheduled tasks</h3>
              <p>Order, timing and status for every task in {details.planNumber}</p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>TASK</th>
                  <th>ORDER</th>
                  <th>PRODUCT</th>
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
                  const startable = ['SCHEDULED', 'AT_RISK', 'CONFIRMED'].includes(task.status)
                    && ['CONFIRMED', 'IN_PROGRESS'].includes(details.status);
                  return (
                    <tr key={task.taskId}>
                      <td>#{task.taskId}</td>
                      <td>#{task.orderId}</td>
                      <td>PRD-{task.productId}</td>
                      <td>{task.quantity}</td>
                      <td><span className={`priority-pill priority-${task.priority.toLowerCase()}`}>{task.priority}</span></td>
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
                            <button className="mini-button" disabled={busyTaskId === task.taskId} onClick={() => void actOnTask(task, 'start')}>
                              <FontAwesomeIcon icon={faPlay} /> Start
                            </button>
                          )}
                          {task.status === 'IN_PROGRESS' && (
                            <button className="mini-button mini-button-success" disabled={busyTaskId === task.taskId} onClick={() => void actOnTask(task, 'complete')}>
                              <FontAwesomeIcon icon={faCheck} /> Complete
                            </button>
                          )}
                          {!startable && task.status !== 'IN_PROGRESS' && <span className="muted-cell">—</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {flash && <Toast message={flash.message} error={flash.error} />}
    </div>
  );
}
