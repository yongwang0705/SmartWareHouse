import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowsRotate, faCalendarDays, faCalendarPlus, faCheck,
  faCircleExclamation, faGaugeHigh, faIndustry, faPlus,
} from '@fortawesome/free-solid-svg-icons';
import Modal from '../../components/Modal';
import StatCard from '../../components/StatCard';
import Toast from '../../components/Toast';
import { api } from '../../services/api';
import {
  addDays, formatDate, formatTime, toDateInput, todayInput,
} from '../../utils/format';
import type {
  CreateProductionLineRequest, ProductionLine, WorkCenter,
  WorkingCalendarEntry,
} from '../../types';

type Section = 'lines' | 'workCenters' | 'calendar';

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'lines', label: 'Production lines' },
  { id: 'workCenters', label: 'Work centers' },
  { id: 'calendar', label: 'Working calendar' },
];

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : 'Unexpected error';

export default function ResourceManagement() {
  const [section, setSection] = useState<Section>('lines');
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [calendar, setCalendar] = useState<WorkingCalendarEntry[]>([]);
  const [calendarFrom, setCalendarFrom] = useState(() => toDateInput(addDays(new Date(), -7)));
  const [calendarTo, setCalendarTo] = useState(() => toDateInput(addDays(new Date(), 30)));
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState<{ message: string; error: boolean } | null>(null);

  const [lineFormOpen, setLineFormOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<ProductionLine | null>(null);
  const [workCenterForm, setWorkCenterForm] = useState(false);
  const [calendarForm, setCalendarForm] = useState(false);

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
      const [lineData, centerData] = await Promise.all([
        api.getProductionLines(),
        api.getWorkCenters(),
      ]);
      setLines(Array.isArray(lineData) ? lineData : []);
      setWorkCenters(Array.isArray(centerData) ? centerData : []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCalendar = useCallback(async (from: string, to: string) => {
    setCalendarLoading(true);
    try {
      setCalendar(await api.getWorkingCalendar(from, to));
    } catch (err) {
      showFlash(errorMessage(err), true);
    } finally {
      setCalendarLoading(false);
    }
  }, [showFlash]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadCalendar(calendarFrom, calendarTo); }, [loadCalendar]); // initial range only

  const activeLines = lines.filter((line) => line.active).length;
  const totalEmployees = lines.reduce((sum, line) => sum + line.employees, 0);
  const hourlyCapacity = lines.reduce((sum, line) => sum + line.unitsPerHour, 0);
  const workingDays = calendar.filter((entry) => entry.workingDay).length;

  const headerAction = (() => {
    if (section === 'workCenters') {
      return <button className="button button-primary" onClick={() => setWorkCenterForm(true)}><FontAwesomeIcon icon={faPlus} /> Add work center</button>;
    }
    if (section === 'calendar') {
      return <button className="button button-primary" onClick={() => setCalendarForm(true)}><FontAwesomeIcon icon={faCalendarPlus} /> Add calendar entry</button>;
    }
    return (
      <button className="button button-primary" onClick={() => { setEditingLine(null); setLineFormOpen(true); }}>
        <FontAwesomeIcon icon={faPlus} /> Add production line
      </button>
    );
  })();

  return (
    <div>
      <div className="page-toolbar compact-toolbar">
        <div>
          <h2>Resource management</h2>
          <p>Production lines, work-center reference and the plant working calendar.</p>
        </div>
        <div className="toolbar-actions">
          <button className="button button-secondary" onClick={() => void load()}>
            <FontAwesomeIcon icon={faArrowsRotate} /> Refresh
          </button>
          {headerAction}
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
        <StatCard
          label="PRODUCTION LINES"
          value={String(lines.length)}
          detail={`${activeLines} active · ${totalEmployees} employees`}
          icon={faIndustry}
          tone="blue"
        />
        <StatCard
          label="HOURLY CAPACITY"
          value={`${hourlyCapacity.toLocaleString('en-CA')}`}
          detail="Units per hour across lines"
          icon={faGaugeHigh}
          tone="green"
        />
        <StatCard
          label="WORKING DAYS"
          value={String(workingDays)}
          detail={`${formatDate(calendarFrom)} → ${formatDate(calendarTo)}`}
          icon={faCalendarDays}
          tone="violet"
        />
      </div>

      <div className="segmented section-tabs">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            className={section === item.id ? 'segmented-active' : ''}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-panel">
          <span className="spinner" />
          <strong>Loading resources...</strong>
          <span>Fetching production lines and work centers</span>
        </div>
      ) : (
        <>
          {section === 'lines' && (
            <>
              <div className="table-card">
                <div className="table-heading">
                  <div>
                    <h3>Production lines</h3>
                    <p>Throughput is units assembled per hour; employee count is line headcount.</p>
                  </div>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>LINE</th>
                        <th>EMPLOYEES</th>
                        <th>UNITS / HOUR</th>
                        <th>STATUS</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => (
                        <tr key={line.id}>
                          <td>
                            <strong>{line.name}</strong>
                            <div className="cell-sub">{line.code}</div>
                          </td>
                          <td>{line.employees}</td>
                          <td><strong>{line.unitsPerHour}</strong> units/h</td>
                          <td>
                            <span className={`status-pill status-${line.active ? 'confirmed' : 'cancelled'}`}>
                              <i />{line.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <button
                              className="mini-button"
                              onClick={() => { setEditingLine(line); setLineFormOpen(true); }}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                      {lines.length === 0 && (
                        <tr>
                          <td colSpan={5}>
                            <div className="empty-state">No production lines configured.</div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="plan-hint">
                <FontAwesomeIcon icon={faIndustry} />
                <span>
                  A line's throughput converts units into production hours. For example,
                  a 200 units/hour line assembles 200 units every hour; a 50 units/hour
                  line needs four times as long for the same quantity.
                </span>
              </div>
            </>
          )}

          {section === 'workCenters' && (
            <div className="table-card">
              <div className="table-heading">
                <div>
                  <h3>Work centers</h3>
                  <p>Reference capacity used by routings; production lines drive scheduling.</p>
                </div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>CODE</th><th>NAME</th><th>CAPACITY / DAY</th><th>STATUS</th></tr>
                  </thead>
                  <tbody>
                    {workCenters.map((center) => (
                      <tr key={center.id}>
                        <td><strong>{center.code}</strong></td>
                        <td>{center.name}</td>
                        <td>{center.capacityHoursPerDay} h</td>
                        <td>
                          <span className={`status-pill status-${center.active ? 'confirmed' : 'cancelled'}`}>
                            <i />{center.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {workCenters.length === 0 && (
                      <tr><td colSpan={4}><div className="empty-state">No work centers configured.</div></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {section === 'calendar' && (
            <div className="table-card">
              <div className="table-heading">
                <div><h3>Working calendar</h3><p>Days available for production scheduling</p></div>
                <div className="calendar-controls">
                  <label className="inline-field"><span>From</span><input className="form-input" type="date" value={calendarFrom} onChange={(event) => setCalendarFrom(event.target.value)} /></label>
                  <label className="inline-field"><span>To</span><input className="form-input" type="date" value={calendarTo} onChange={(event) => setCalendarTo(event.target.value)} /></label>
                  <button
                    className="button button-secondary"
                    onClick={() => void loadCalendar(calendarFrom, calendarTo)}
                    disabled={calendarLoading}
                  >
                    <FontAwesomeIcon icon={faArrowsRotate} /> {calendarLoading ? 'Loading' : 'Load'}
                  </button>
                </div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>DATE</th><th>WORKING DAY</th><th>HOURS</th><th>DESCRIPTION</th></tr></thead>
                  <tbody>
                    {calendar.map((entry) => (
                      <tr key={entry.id}>
                        <td>{formatDate(entry.workDate)}</td>
                        <td>
                          <span className={`status-pill status-${entry.workingDay ? 'confirmed' : 'cancelled'}`}>
                            <i />{entry.workingDay ? 'Working' : 'Closed'}
                          </span>
                        </td>
                        <td>{entry.workingDay ? `${formatTime(entry.startTime)} – ${formatTime(entry.endTime)}` : '—'}</td>
                        <td className="muted-cell">{entry.description || '—'}</td>
                      </tr>
                    ))}
                    {calendar.length === 0 && !calendarLoading && <tr><td colSpan={4}><div className="empty-state">No calendar entries in this range.</div></td></tr>}
                    {calendarLoading && <tr><td colSpan={4}><div className="loading-inline"><span className="spinner" /> Loading calendar...</div></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {lineFormOpen && (
        <LineForm
          line={editingLine ?? undefined}
          onClose={() => { setLineFormOpen(false); setEditingLine(null); }}
          onSaved={(line) => {
            setLines((current) => [
              ...current.filter((item) => item.id !== line.id),
              line,
            ].sort((a, b) => a.code.localeCompare(b.code)));
            setLineFormOpen(false);
            setEditingLine(null);
            showFlash(`Production line ${line.code} saved.`);
          }}
        />
      )}
      {workCenterForm && (
        <WorkCenterForm
          onClose={() => setWorkCenterForm(false)}
          onCreated={(center) => {
            setWorkCenters((current) => [...current, center]);
            setWorkCenterForm(false);
            showFlash(`Work center ${center.code} created.`);
          }}
        />
      )}
      {calendarForm && (
        <CalendarEntryForm
          onClose={() => setCalendarForm(false)}
          onCreated={(entry) => {
            setCalendar((current) => [
              ...current.filter((item) => item.workDate !== entry.workDate),
              entry,
            ].sort((a, b) => a.workDate.localeCompare(b.workDate)));
            setCalendarForm(false);
            showFlash(`Calendar entry for ${formatDate(entry.workDate)} saved.`);
          }}
        />
      )}

      {flash && <Toast message={flash.message} error={flash.error} />}
    </div>
  );
}

interface LineFormProps {
  line?: ProductionLine;
  onClose: () => void;
  onSaved: (line: ProductionLine) => void;
}

function LineForm({ line, onClose, onSaved }: LineFormProps) {
  const editing = Boolean(line);
  const [code, setCode] = useState(line?.code ?? '');
  const [name, setName] = useState(line?.name ?? '');
  const [employees, setEmployees] = useState(String(line?.employees ?? 50));
  const [unitsPerHour, setUnitsPerHour] = useState(String(line?.unitsPerHour ?? 50));
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');

    const headcount = Number(employees);
    const throughput = Number(unitsPerHour);

    if (!code.trim() || !name.trim()) {
      setFormError('Code and name are required.');
      return;
    }
    if (!Number.isInteger(headcount) || headcount < 0) {
      setFormError('Employees must be a non-negative whole number.');
      return;
    }
    if (!Number.isInteger(throughput) || throughput <= 0) {
      setFormError('Units per hour must be a positive whole number.');
      return;
    }

    const payload: CreateProductionLineRequest = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      employees: headcount,
      unitsPerHour: throughput,
    };

    setBusy(true);
    try {
      onSaved(editing && line
        ? await api.updateProductionLine(line.id, payload)
        : await api.createProductionLine(payload));
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      eyebrow="PRODUCTION SETUP"
      title={editing ? 'Edit production line' : 'Add production line'}
      subtitle="Define the line's headcount and how many units it can assemble each hour."
      onClose={onClose}
      footer={<>
        <button type="button" className="button button-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" form="line-form" className="button button-primary" disabled={busy}>
          {busy ? 'Saving...' : editing ? 'Save line' : 'Add line'}
        </button>
      </>}
    >
      <form id="line-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="field-label">
            Line code
            <input
              className="form-input"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="LINE-C"
              disabled={editing}
              required
            />
          </label>
          <label className="field-label">
            Line name
            <input
              className="form-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Assembly Line C"
              required
            />
          </label>
          <label className="field-label">
            Employees
            <input
              className="form-input"
              type="number"
              min="0"
              step="1"
              value={employees}
              onChange={(event) => setEmployees(event.target.value)}
              required
            />
          </label>
          <label className="field-label">
            Units per hour
            <input
              className="form-input"
              type="number"
              min="1"
              step="1"
              value={unitsPerHour}
              onChange={(event) => setUnitsPerHour(event.target.value)}
              required
            />
          </label>
        </div>
        {formError && <div className="form-error">{formError}</div>}
        <div className="plan-hint">
          <FontAwesomeIcon icon={faIndustry} />
          <span>
            Throughput sets production duration: 200 units/hour means 200 units in
            one hour; 500 units take 2.5 hours on that line.
          </span>
        </div>
      </form>
    </Modal>
  );
}

interface FormModalProps<T> {
  onClose: () => void;
  onCreated: (value: T) => void;
}

function WorkCenterForm({ onClose, onCreated }: FormModalProps<WorkCenter>) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [capacityHoursPerDay, setCapacityHoursPerDay] = useState('8');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    setBusy(true);
    try {
      onCreated(await api.createWorkCenter({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        capacityHoursPerDay: Number(capacityHoursPerDay),
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
      title="Create work center"
      subtitle="Reference capacity for routings and operations."
      onClose={onClose}
      footer={<>
        <button type="button" className="button button-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" form="work-center-form" className="button button-primary" disabled={busy}>{busy ? 'Creating...' : 'Create work center'}</button>
      </>}
    >
      <form id="work-center-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="field-label">Code<input className="form-input" value={code} onChange={(event) => setCode(event.target.value)} placeholder="WC-ASSEMBLY" required /></label>
          <label className="field-label">Name<input className="form-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Assembly A" required /></label>
          <label className="field-label">Capacity hours / day<input className="form-input" type="number" min="0.5" step="0.5" value={capacityHoursPerDay} onChange={(event) => setCapacityHoursPerDay(event.target.value)} required /></label>
        </div>
        {formError && <div className="form-error">{formError}</div>}
      </form>
    </Modal>
  );
}

function CalendarEntryForm({ onClose, onCreated }: FormModalProps<WorkingCalendarEntry>) {
  const [workDate, setWorkDate] = useState(todayInput());
  const [workingDay, setWorkingDay] = useState(true);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [description, setDescription] = useState('Regular working day');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    setBusy(true);
    try {
      onCreated(await api.createWorkingCalendarEntry({
        workDate,
        workingDay,
        startTime: workingDay ? startTime : null,
        endTime: workingDay ? endTime : null,
        description: description || null,
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
      title="Save calendar entry"
      subtitle="Mark a date as a working day or a plant holiday."
      onClose={onClose}
      footer={<>
        <button type="button" className="button button-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" form="calendar-form" className="button button-primary" disabled={busy}>{busy ? 'Saving...' : 'Save entry'}</button>
      </>}
    >
      <form id="calendar-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="field-label">Date<input className="form-input" type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} required /></label>
          <label className="checkbox-field"><input type="checkbox" checked={workingDay} onChange={(event) => setWorkingDay(event.target.checked)} /> Working day</label>
          {workingDay && <>
            <label className="field-label">Start<input className="form-input" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
            <label className="field-label">End<input className="form-input" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
          </>}
          <label className="field-label form-span-2">Description<input className="form-input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Regular working day" /></label>
        </div>
        {formError && <div className="form-error">{formError}</div>}
        <div className="plan-hint"><FontAwesomeIcon icon={faCheck} /><span>The calendar controls production lines' available hours.</span></div>
      </form>
    </Modal>
  );
}
