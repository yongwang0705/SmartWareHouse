import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowsRotate, faBusinessTime, faCalendarDays, faCalendarPlus,
  faCheck, faCircleExclamation, faClock, faGear, faPlus,
  faUserPlus, faUsers,
} from '@fortawesome/free-solid-svg-icons';
import Modal from '../../components/Modal';
import StatCard from '../../components/StatCard';
import Toast from '../../components/Toast';
import { api } from '../../services/api';
import {
  addDays, formatDate, formatTime, toDateInput, todayInput,
} from '../../utils/format';
import type {
  Employee, EmployeeShift, EmployeeSkill, EmployeeUnavailability,
  WorkCenter, WorkingCalendarEntry,
} from '../../types';

type Section = 'employees' | 'workCenters' | 'calendar';

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'employees', label: 'Employees & skills' },
  { id: 'workCenters', label: 'Work centers' },
  { id: 'calendar', label: 'Working calendar' },
];

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : 'Unexpected error';

export default function ResourceManagement() {
  const [section, setSection] = useState<Section>('employees');
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [calendar, setCalendar] = useState<WorkingCalendarEntry[]>([]);
  const [calendarFrom, setCalendarFrom] = useState(() => toDateInput(addDays(new Date(), -7)));
  const [calendarTo, setCalendarTo] = useState(() => toDateInput(addDays(new Date(), 30)));
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState<{ message: string; error: boolean } | null>(null);

  const [workCenterForm, setWorkCenterForm] = useState(false);
  const [employeeForm, setEmployeeForm] = useState(false);
  const [calendarForm, setCalendarForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

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
      const [centers, people] = await Promise.all([
        api.getWorkCenters(),
        api.getEmployees(),
      ]);
      setWorkCenters(centers);
      setEmployees(people);
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

  const activeWorkCenters = workCenters.filter((center) => center.active).length;
  const activeEmployees = employees.filter((employee) => employee.active).length;
  const workingDays = calendar.filter((entry) => entry.workingDay).length;

  const headerAction = (() => {
    if (section === 'workCenters') {
      return <button className="button button-primary" onClick={() => setWorkCenterForm(true)}><FontAwesomeIcon icon={faPlus} /> Add work center</button>;
    }
    if (section === 'calendar') {
      return <button className="button button-primary" onClick={() => setCalendarForm(true)}><FontAwesomeIcon icon={faCalendarPlus} /> Add calendar entry</button>;
    }
    return <button className="button button-primary" onClick={() => setEmployeeForm(true)}><FontAwesomeIcon icon={faUserPlus} /> Add employee</button>;
  })();

  return (
    <div>
      <div className="page-toolbar compact-toolbar">
        <div>
          <h2>Resource management</h2>
          <p>Employees, skills, shifts, work-center capacity and the plant working calendar.</p>
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
        <StatCard label="WORK CENTERS" value={String(workCenters.length)} detail={`${activeWorkCenters} active`} icon={faGear} tone="blue" />
        <StatCard label="EMPLOYEES" value={String(employees.length)} detail={`${activeEmployees} active`} icon={faUsers} tone="green" />
        <StatCard label="WORKING DAYS" value={String(workingDays)} detail={`${formatDate(calendarFrom)} → ${formatDate(calendarTo)}`} icon={faCalendarDays} tone="violet" />
      </div>

      <div className="segmented section-tabs">
        {SECTIONS.map((item) => (
          <button key={item.id} className={section === item.id ? 'segmented-active' : ''} onClick={() => setSection(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-panel"><span className="spinner" /><strong>Loading resources...</strong><span>Fetching work centers and employees</span></div>
      ) : (
        <>
          {section === 'workCenters' && (
            <div className="table-card">
              <div className="table-heading">
                <div><h3>Work centers</h3><p>Daily capacity available for operation scheduling</p></div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>CODE</th><th>NAME</th><th>CAPACITY / DAY</th><th>STATUS</th></tr></thead>
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
                    {workCenters.length === 0 && <tr><td colSpan={4}><div className="empty-state">No work centers configured.</div></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {section === 'employees' && (
            <>
              <div className="table-card">
                <div className="table-heading">
                  <div><h3>Employees</h3><p>Select an employee to manage skills, shifts and unavailability</p></div>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>EMPLOYEE</th><th>NUMBER</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
                    <tbody>
                      {employees.map((employee) => (
                        <tr key={employee.id} className={selectedEmployee?.id === employee.id ? 'row-expanded' : ''}>
                          <td><strong>{employee.name}</strong></td>
                          <td className="muted-cell">{employee.employeeNumber}</td>
                          <td>
                            <span className={`status-pill status-${employee.active ? 'confirmed' : 'cancelled'}`}>
                              <i />{employee.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <button className="mini-button" onClick={() => setSelectedEmployee(selectedEmployee?.id === employee.id ? null : employee)}>
                              {selectedEmployee?.id === employee.id ? 'Hide details' : 'Manage'}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {employees.length === 0 && <tr><td colSpan={4}><div className="empty-state">No employees configured.</div></td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
              {selectedEmployee && (
                <EmployeeDetail
                  employee={selectedEmployee}
                  onClose={() => setSelectedEmployee(null)}
                  onFlash={showFlash}
                />
              )}
            </>
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
      {employeeForm && (
        <EmployeeForm
          onClose={() => setEmployeeForm(false)}
          onCreated={(employee) => {
            setEmployees((current) => [...current, employee]);
            setEmployeeForm(false);
            showFlash(`Employee ${employee.name} created.`);
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

// ---------------------------------------------------------------------------
// Employee detail: skills, shifts and unavailability
// ---------------------------------------------------------------------------

interface EmployeeDetailProps {
  employee: Employee;
  onClose: () => void;
  onFlash: (message: string, isError?: boolean) => void;
}

function EmployeeDetail({ employee, onClose, onFlash }: EmployeeDetailProps) {
  const [skills, setSkills] = useState<EmployeeSkill[]>([]);
  const [shifts, setShifts] = useState<EmployeeShift[]>([]);
  const [unavailability, setUnavailability] = useState<EmployeeUnavailability[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDetails = useCallback(async () => {
    setLoading(true);
    try {
      const [skillData, shiftData, unavailableData] = await Promise.all([
        api.getEmployeeSkills(employee.id),
        api.getEmployeeShifts(employee.id),
        api.getEmployeeUnavailability(employee.id),
      ]);
      setSkills(skillData);
      setShifts(shiftData);
      setUnavailability(unavailableData);
    } catch (err) {
      onFlash(errorMessage(err), true);
    } finally {
      setLoading(false);
    }
  }, [employee.id, onFlash]);

  useEffect(() => { void loadDetails(); }, [loadDetails]);

  return (
    <div className="detail-panel">
      <div className="detail-panel-head">
        <div>
          <div className="eyebrow">EMPLOYEE #{employee.employeeNumber}</div>
          <h3>{employee.name}</h3>
        </div>
        <button className="mini-button" onClick={onClose}>Close</button>
      </div>

      {loading ? (
        <div className="loading-inline"><span className="spinner" /> Loading employee configuration...</div>
      ) : (
        <div className="resource-grid">
          <section className="resource-column">
            <h4><FontAwesomeIcon icon={faBusinessTime} /> Skills</h4>
            <ul className="resource-list">
              {skills.map((skill) => (
                <li key={skill.id}><span>{skill.skillCode}</span><small>{skill.proficiency}</small></li>
              ))}
              {skills.length === 0 && <li className="empty-inline">No skills recorded.</li>}
            </ul>
            <SkillForm
              employeeId={employee.id}
              onCreated={(skill) => {
                setSkills((current) => [
                  ...current.filter((item) => item.skillCode !== skill.skillCode),
                  skill,
                ]);
                onFlash(`Skill ${skill.skillCode} added.`);
              }}
              onError={(message) => onFlash(message, true)}
            />
          </section>

          <section className="resource-column">
            <h4><FontAwesomeIcon icon={faClock} /> Shifts</h4>
            <ul className="resource-list">
              {shifts.map((shift) => (
                <li key={shift.id}>
                  <span>{formatTime(shift.shiftStart)} – {formatTime(shift.shiftEnd)}</span>
                  <small>{shift.workingDays}</small>
                </li>
              ))}
              {shifts.length === 0 && <li className="empty-inline">No shifts recorded.</li>}
            </ul>
            <ShiftForm
              employeeId={employee.id}
              onCreated={(shift) => { setShifts((current) => [...current, shift]); onFlash('Shift added.'); }}
              onError={(message) => onFlash(message, true)}
            />
          </section>

          <section className="resource-column">
            <h4><FontAwesomeIcon icon={faCalendarDays} /> Unavailability</h4>
            <ul className="resource-list">
              {unavailability.map((item) => (
                <li key={item.id}>
                  <span>{formatDate(item.startTime)} → {formatDate(item.endTime)}</span>
                  <small>{item.reason || 'Leave'}</small>
                </li>
              ))}
              {unavailability.length === 0 && <li className="empty-inline">No unavailability recorded.</li>}
            </ul>
            <UnavailabilityForm
              employeeId={employee.id}
              onCreated={(item) => { setUnavailability((current) => [...current, item]); onFlash('Unavailability added.'); }}
              onError={(message) => onFlash(message, true)}
            />
          </section>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small inline forms
// ---------------------------------------------------------------------------

interface InlineFormProps<T> {
  employeeId: number;
  onCreated: (value: T) => void;
  onError: (message: string) => void;
}

function SkillForm({ employeeId, onCreated, onError }: InlineFormProps<EmployeeSkill>) {
  const [skillCode, setSkillCode] = useState('ASSEMBLY');
  const [proficiency, setProficiency] = useState('INTERMEDIATE');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      onCreated(await api.createEmployeeSkill(employeeId, { skillCode: skillCode.trim().toUpperCase(), proficiency }));
      setSkillCode('');
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="inline-form" onSubmit={submit}>
      <input className="form-input" placeholder="Skill code" value={skillCode} onChange={(event) => setSkillCode(event.target.value)} required />
      <select className="form-input" value={proficiency} onChange={(event) => setProficiency(event.target.value)}>
        {['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'].map((level) => <option key={level}>{level}</option>)}
      </select>
      <button className="mini-button mini-button-success" disabled={busy} type="submit">
        <FontAwesomeIcon icon={faPlus} /> Add
      </button>
    </form>
  );
}

function ShiftForm({ employeeId, onCreated, onError }: InlineFormProps<EmployeeShift>) {
  const [shiftStart, setShiftStart] = useState('08:00');
  const [shiftEnd, setShiftEnd] = useState('17:00');
  const [workingDays, setWorkingDays] = useState('MON,TUE,WED,THU,FRI');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      onCreated(await api.createEmployeeShift(employeeId, { shiftStart, shiftEnd, workingDays }));
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="inline-form inline-form-stack" onSubmit={submit}>
      <div className="inline-form-row">
        <input className="form-input" type="time" value={shiftStart} onChange={(event) => setShiftStart(event.target.value)} required />
        <input className="form-input" type="time" value={shiftEnd} onChange={(event) => setShiftEnd(event.target.value)} required />
      </div>
      <input className="form-input" placeholder="Working days" value={workingDays} onChange={(event) => setWorkingDays(event.target.value)} required />
      <button className="mini-button mini-button-success" disabled={busy} type="submit"><FontAwesomeIcon icon={faPlus} /> Add shift</button>
    </form>
  );
}

function UnavailabilityForm({ employeeId, onCreated, onError }: InlineFormProps<EmployeeUnavailability>) {
  const [startTime, setStartTime] = useState(`${todayInput()}T08:00`);
  const [endTime, setEndTime] = useState(`${todayInput()}T17:00`);
  const [reason, setReason] = useState('Leave');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      onCreated(await api.createEmployeeUnavailability(employeeId, { startTime, endTime, reason }));
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="inline-form inline-form-stack" onSubmit={submit}>
      <div className="inline-form-row">
        <input className="form-input" type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
        <input className="form-input" type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
      </div>
      <input className="form-input" placeholder="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
      <button className="mini-button mini-button-success" disabled={busy} type="submit"><FontAwesomeIcon icon={faPlus} /> Add leave</button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Modal forms
// ---------------------------------------------------------------------------

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
      subtitle="Capacity is the maximum number of production hours available per working day."
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

function EmployeeForm({ onClose, onCreated }: FormModalProps<Employee>) {
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    setBusy(true);
    try {
      onCreated(await api.createEmployee({
        employeeNumber: employeeNumber.trim().toUpperCase(),
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
      title="Create employee"
      subtitle="Add skills and shifts after creating the employee."
      onClose={onClose}
      footer={<>
        <button type="button" className="button button-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" form="employee-form" className="button button-primary" disabled={busy}>{busy ? 'Creating...' : 'Create employee'}</button>
      </>}
    >
      <form id="employee-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="field-label">Employee number<input className="form-input" value={employeeNumber} onChange={(event) => setEmployeeNumber(event.target.value)} placeholder="EMP-D" required /></label>
          <label className="field-label">Name<input className="form-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Employee D" required /></label>
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
        <div className="plan-hint"><FontAwesomeIcon icon={faCheck} /><span>The calendar drives shift-boundary validation in the scheduling engine.</span></div>
      </form>
    </Modal>
  );
}
