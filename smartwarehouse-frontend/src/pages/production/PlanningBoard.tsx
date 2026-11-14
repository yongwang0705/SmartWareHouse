import {
  Fragment, useCallback, useEffect, useMemo, useRef, useState, type FormEvent,
} from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowsRotate, faBan, faCheck, faChevronDown, faChevronUp,
  faCircleExclamation, faClipboardList, faFlag, faListCheck,
  faPlay, faTriangleExclamation, faWandMagicSparkles,
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
  GeneratePlanRequest, PlanDetails, PlanSummary, ProductionTask,
} from '../../types';

const ALGORITHMS = ['PRIORITY_EARLIEST_DUE_DATE'];

const byNewest = (a: PlanSummary, b: PlanSummary) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : 'Unexpected error';

export default function PlanningBoard() {
  const [plans, setPlans] = useState<PlanSummary[]>([]);
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

  const loadPlans = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const data = await api.getPlans();
      setPlans([...data].sort(byNewest));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPlans(); }, [loadPlans]);

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

      <div className="table-card">
        <div className="table-heading">
          <div>
            <h3>Production plans</h3>
            <p>{plans.length} plan{plans.length === 1 ? '' : 's'} — newest first</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>PLAN</th>
                <th>STATUS</th>
                <th>PLANNING WINDOW</th>
                <th>ORDERS</th>
                <th>SCHEDULED</th>
                <th>AT RISK</th>
                <th>SHORTAGES</th>
                <th>CREATED</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => {
                const busy = busyPlanId === plan.planId;
                const confirmable = plan.status === 'DRAFT' || plan.status === 'VALIDATED';
                const cancellable = !['CANCELLED', 'COMPLETED', 'IN_PROGRESS'].includes(plan.status);
                return (
                  <tr key={plan.planId}>
                    <td>
                      <button className="table-primary-link" onClick={() => void openDetails(plan.planId)}>
                        {plan.planNumber}
                      </button>
                      <div className="cell-sub">{plan.algorithm}</div>
                    </td>
                    <td>
                      <span className={`status-pill status-${statusClass(plan.status)}`}>
                        <i />{friendlyStatus(plan.status)}
                      </span>
                    </td>
                    <td className="muted-cell">
                      {formatDate(plan.planningStart)} → {formatDate(plan.planningEnd)}
                    </td>
                    <td>{plan.totalOrders}</td>
                    <td>{plan.scheduledOrders}</td>
                    <td className={plan.atRiskOrders > 0 ? 'text-warning' : ''}>{plan.atRiskOrders}</td>
                    <td>
                      <span className={plan.materialShortageOrders + plan.capacityShortageOrders > 0 ? 'text-danger' : ''}>
                        {plan.materialShortageOrders} mat · {plan.capacityShortageOrders} cap
                      </span>
                    </td>
                    <td className="muted-cell">{formatDateTime(plan.createdAt)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="mini-button" onClick={() => void openDetails(plan.planId)}>
                          View
                        </button>
                        {confirmable && (
                          <button className="mini-button mini-button-success" disabled={busy} onClick={() => void confirmPlan(plan)}>
                            <FontAwesomeIcon icon={faCheck} /> {busy ? 'Working' : 'Confirm'}
                          </button>
                        )}
                        <button className="mini-button" onClick={() => recalculate(plan)}>
                          <FontAwesomeIcon icon={faArrowsRotate} /> Recalc
                        </button>
                        {cancellable && (
                          <button className="mini-button mini-button-danger" disabled={busy} onClick={() => void cancelPlan(plan)}>
                            <FontAwesomeIcon icon={faBan} /> Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && plans.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      No production plans yet. Generate a plan to schedule the eligible orders.
                    </div>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={9}>
                    <div className="loading-inline"><span className="spinner" /> Loading production plans...</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {generateOpen && (
        <GeneratePlanForm
          seed={generateSeed}
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
            {(details.status === 'DRAFT' || details.status === 'VALIDATED') && (
              <button
                className="button button-primary"
                disabled={busyPlanId === details.planId}
                onClick={() => {
                  const plan = plans.find((item) => item.planId === details.planId);
                  if (plan) void confirmPlan(plan);
                }}
              >
                <FontAwesomeIcon icon={faCheck} /> Confirm plan
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

              <h3 className="detail-section-title">Production tasks</h3>
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
                              <td>#{task.orderId}</td>
                              <td>PRD-{task.productId}</td>
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
                                </div>
                              </td>
                            </tr>
                            {expanded && (
                              <tr className="expanded-row">
                                <td colSpan={10}>
                                  <div className="task-expanded">
                                    {task.statusReason && (
                                      <p className="task-reason">
                                        <FontAwesomeIcon icon={faCircleExclamation} /> {task.statusReason}
                                      </p>
                                    )}
                                    <div className="expanded-grid">
                                      <div>
                                        <h4>Resource assignments</h4>
                                        {task.assignments.length === 0 ? (
                                          <p className="empty-inline">No resources allocated.</p>
                                        ) : (
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
                                                  <td>PRD-{material.materialProductId}</td>
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
  onClose: () => void;
  onGenerated: (plan: PlanSummary) => void;
}

function GeneratePlanForm({ seed, onClose, onGenerated }: GenerateFormProps) {
  const [planningStart, setPlanningStart] = useState(seed?.planningStart ?? todayInput());
  const [planningEnd, setPlanningEnd] = useState(
    seed?.planningEnd ?? toDateInput(addDays(new Date(), 7)),
  );
  const [algorithm, setAlgorithm] = useState(seed?.algorithm ?? ALGORITHMS[0]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!planningStart || !planningEnd) {
      setFormError('Both planning dates are required.');
      return;
    }
    if (planningEnd < planningStart) {
      setFormError('Planning end must not be before planning start.');
      return;
    }
    setBusy(true);
    try {
      const plan = await api.generatePlan({ planningStart, planningEnd, algorithm });
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
          <label className="field-label form-span-2">
            Algorithm
            <select className="form-input" value={algorithm} onChange={(event) => setAlgorithm(event.target.value)}>
              {ALGORITHMS.map((item) => <option key={item} value={item}>{item.replace(/_/g, ' ')}</option>)}
            </select>
          </label>
        </div>
        {formError && <div className="form-error">{formError}</div>}
        <div className="plan-hint">
          <FontAwesomeIcon icon={faClipboardList} />
          <span>Generation retrieves eligible orders through gRPC and evaluates BOM, routing, employee and work-center capacity constraints.</span>
        </div>
      </form>
    </Modal>
  );
}
