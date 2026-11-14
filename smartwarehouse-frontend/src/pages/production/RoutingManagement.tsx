import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowsRotate, faCircleExclamation, faClock, faDiagramProject,
  faLayerGroup, faPlus, faRoute,
} from '@fortawesome/free-solid-svg-icons';
import Modal from '../../components/Modal';
import StatCard from '../../components/StatCard';
import Toast from '../../components/Toast';
import { api } from '../../services/api';
import type {
  ProductionRouting, RoutingOperation, WorkCenter,
} from '../../types';

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : 'Unexpected error';

export default function RoutingManagement() {
  const [routings, setRoutings] = useState<ProductionRouting[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [operations, setOperations] = useState<RoutingOperation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState<{ message: string; error: boolean } | null>(null);
  const [routingForm, setRoutingForm] = useState(false);
  const [operationForm, setOperationForm] = useState(false);

  const showFlash = useCallback(
    (message: string, isError = false) => setFlash({ message, error: isError }),
    [],
  );

  useEffect(() => {
    if (!flash) return;
    const timeout = window.setTimeout(() => setFlash(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [flash]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [routingData, centerData] = await Promise.all([
        api.getRoutings(),
        api.getWorkCenters(),
      ]);
      const nested = await Promise.all(
        routingData.map((routing) =>
          api.getRoutingOperations(routing.id).catch(() => [] as RoutingOperation[]),
        ),
      );
      setRoutings(routingData);
      setWorkCenters(centerData);
      setOperations(nested.flat());
      setSelectedId((current) => current ?? routingData[0]?.id ?? null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const workCenterNames = useMemo(
    () => new Map(workCenters.map((center) => [center.id, center.name])),
    [workCenters],
  );

  const selected = routings.find((routing) => routing.id === selectedId) ?? null;

  const selectedOperations = useMemo(
    () => operations
      .filter((operation) => operation.routingId === selectedId)
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber),
    [operations, selectedId],
  );

  const operationCount = (routingId: number) =>
    operations.filter((operation) => operation.routingId === routingId).length;

  const productsCovered = new Set(routings.map((routing) => routing.productId)).size;
  const nextSequence = selectedOperations.length
    ? Math.max(...selectedOperations.map((operation) => operation.sequenceNumber)) + 1
    : 1;

  return (
    <div>
      <div className="page-toolbar compact-toolbar">
        <div>
          <h2>Production routings</h2>
          <p>Ordered operations, required skills and per-unit processing times for each product.</p>
        </div>
        <div className="toolbar-actions">
          <button className="button button-secondary" onClick={() => void load()}>
            <FontAwesomeIcon icon={faArrowsRotate} /> Refresh
          </button>
          <button className="button button-primary" onClick={() => setRoutingForm(true)}>
            <FontAwesomeIcon icon={faPlus} /> Create routing
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

      <div className="stats-grid stats-grid-small stats-grid-three">
        <StatCard label="ROUTINGS" value={String(routings.length)} detail={`${routings.filter((item) => item.active).length} active`} icon={faRoute} tone="blue" />
        <StatCard label="OPERATIONS" value={String(operations.length)} detail="Across all routings" icon={faLayerGroup} tone="green" />
        <StatCard label="PRODUCTS COVERED" value={String(productsCovered)} detail="Distinct product IDs" icon={faDiagramProject} tone="violet" />
      </div>

      {loading ? (
        <div className="loading-panel"><span className="spinner" /><strong>Loading routings...</strong><span>Fetching operations and work centers</span></div>
      ) : (
        <>
          <div className="table-card">
            <div className="table-heading">
              <div><h3>Routings</h3><p>Select a routing to inspect its operation sequence</p></div>
            </div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>PRODUCT</th><th>ROUTING</th><th>OPERATIONS</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
                <tbody>
                  {routings.map((routing) => (
                    <tr key={routing.id} className={selectedId === routing.id ? 'row-expanded' : ''}>
                      <td><span className="product-cell"><span className="product-icon"><FontAwesomeIcon icon={faRoute} /></span><strong>PRD-{routing.productId}</strong></span></td>
                      <td>{routing.name}</td>
                      <td>{operationCount(routing.id)}</td>
                      <td>
                        <span className={`status-pill status-${routing.active ? 'confirmed' : 'cancelled'}`}>
                          <i />{routing.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button className="mini-button" onClick={() => setSelectedId(routing.id)}>
                          {selectedId === routing.id ? 'Selected' : 'View operations'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {routings.length === 0 && <tr><td colSpan={5}><div className="empty-state">No production routings configured.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {selected && (
            <div className="table-card">
              <div className="table-heading">
                <div>
                  <h3>{selected.name}</h3>
                  <p>Product PRD-{selected.productId} · {selectedOperations.length} operation{selectedOperations.length === 1 ? '' : 's'} in sequence</p>
                </div>
                <button className="button button-primary" onClick={() => setOperationForm(true)}>
                  <FontAwesomeIcon icon={faPlus} /> Add operation
                </button>
              </div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>SEQ</th><th>OPERATION</th><th>WORK CENTER</th><th>SKILL</th><th>MIN / UNIT</th><th>SETUP MIN</th></tr></thead>
                  <tbody>
                    {selectedOperations.map((operation) => (
                      <tr key={operation.id}>
                        <td><strong>{operation.sequenceNumber}</strong></td>
                        <td>{operation.operationName}</td>
                        <td>{workCenterNames.get(operation.workCenterId) ?? `WC #${operation.workCenterId}`}</td>
                        <td><span className="status-pill status-created">{operation.skillCode}</span></td>
                        <td>{operation.minutesPerUnit}</td>
                        <td>{operation.setupMinutes}</td>
                      </tr>
                    ))}
                    {selectedOperations.length === 0 && <tr><td colSpan={6}><div className="empty-state">No operations defined for this routing.</div></td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="gantt-footnote">
                <FontAwesomeIcon icon={faClock} /> Processing minutes per operation = setup minutes + (quantity × minutes per unit).
              </div>
            </div>
          )}
        </>
      )}

      {routingForm && (
        <RoutingForm
          onClose={() => setRoutingForm(false)}
          onCreated={(routing) => {
            setRoutings((current) => [...current, routing]);
            setSelectedId(routing.id);
            setRoutingForm(false);
            showFlash(`Routing ${routing.name} created.`);
          }}
        />
      )}

      {operationForm && selected && (
        <OperationForm
          routingId={selected.id}
          workCenters={workCenters}
          nextSequence={nextSequence}
          onClose={() => setOperationForm(false)}
          onCreated={(operation) => {
            setOperations((current) => [...current, operation]);
            setOperationForm(false);
            showFlash(`Operation ${operation.operationName} added to ${selected.name}.`);
          }}
        />
      )}

      {flash && <Toast message={flash.message} error={flash.error} />}
    </div>
  );
}

interface RoutingFormProps {
  onClose: () => void;
  onCreated: (routing: ProductionRouting) => void;
}

function RoutingForm({ onClose, onCreated }: RoutingFormProps) {
  const [productId, setProductId] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    setBusy(true);
    try {
      onCreated(await api.createRouting({
        productId: Number(productId),
        name: name.trim(),
        active: true,
      }));
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      eyebrow="PRODUCTION SETUP"
      title="Create routing"
      subtitle="A routing belongs to one product and contains an ordered list of operations."
      onClose={onClose}
      footer={<>
        <button type="button" className="button button-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" form="routing-form" className="button button-primary" disabled={busy}>{busy ? 'Creating...' : 'Create routing'}</button>
      </>}
    >
      <form id="routing-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="field-label">Product ID<input className="form-input" type="number" min="1" value={productId} onChange={(event) => setProductId(event.target.value)} placeholder="101" required /></label>
          <label className="field-label">Routing name<input className="form-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Laptop Standard Routing" required /></label>
        </div>
        {formError && <div className="form-error">{formError}</div>}
      </form>
    </Modal>
  );
}

interface OperationFormProps {
  routingId: number;
  workCenters: WorkCenter[];
  nextSequence: number;
  onClose: () => void;
  onCreated: (operation: RoutingOperation) => void;
}

function OperationForm({ routingId, workCenters, nextSequence, onClose, onCreated }: OperationFormProps) {
  const [sequenceNumber, setSequenceNumber] = useState(String(nextSequence));
  const [operationName, setOperationName] = useState('');
  const [workCenterId, setWorkCenterId] = useState(String(workCenters[0]?.id ?? ''));
  const [skillCode, setSkillCode] = useState('');
  const [minutesPerUnit, setMinutesPerUnit] = useState('1');
  const [setupMinutes, setSetupMinutes] = useState('0');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    setBusy(true);
    try {
      onCreated(await api.createRoutingOperation(routingId, {
        sequenceNumber: Number(sequenceNumber),
        operationName: operationName.trim(),
        workCenterId: Number(workCenterId),
        skillCode: skillCode.trim().toUpperCase(),
        minutesPerUnit: Number(minutesPerUnit),
        setupMinutes: Number(setupMinutes),
      }));
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      eyebrow="PRODUCTION SETUP"
      title="Add operation"
      subtitle="Operations execute in sequence and each requires a work center and skill."
      onClose={onClose}
      footer={<>
        <button type="button" className="button button-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" form="operation-form" className="button button-primary" disabled={busy || workCenters.length === 0}>{busy ? 'Adding...' : 'Add operation'}</button>
      </>}
    >
      <form id="operation-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="field-label">Sequence<input className="form-input" type="number" min="1" value={sequenceNumber} onChange={(event) => setSequenceNumber(event.target.value)} required /></label>
          <label className="field-label">Operation name<input className="form-input" value={operationName} onChange={(event) => setOperationName(event.target.value)} placeholder="Assembly" required /></label>
          <label className="field-label">
            Work center
            <select className="form-input" value={workCenterId} onChange={(event) => setWorkCenterId(event.target.value)} required>
              {workCenters.length === 0 && <option value="">No work centers</option>}
              {workCenters.map((center) => <option key={center.id} value={center.id}>{center.name} ({center.code})</option>)}
            </select>
          </label>
          <label className="field-label">Required skill<input className="form-input" value={skillCode} onChange={(event) => setSkillCode(event.target.value)} placeholder="ASSEMBLY" required /></label>
          <label className="field-label">Minutes per unit<input className="form-input" type="number" min="0" step="0.1" value={minutesPerUnit} onChange={(event) => setMinutesPerUnit(event.target.value)} required /></label>
          <label className="field-label">Setup minutes<input className="form-input" type="number" min="0" step="0.1" value={setupMinutes} onChange={(event) => setSetupMinutes(event.target.value)} /></label>
        </div>
        {formError && <div className="form-error">{formError}</div>}
        {workCenters.length === 0 && <div className="form-error">Create a work center before adding operations.</div>}
      </form>
    </Modal>
  );
}
