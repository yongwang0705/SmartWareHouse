const pad = (value: number) => String(value).padStart(2, '0');

/** Local calendar day (yyyy-MM-dd) without UTC shifting. */
export const toDateInput = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const todayInput = () => toDateInput(new Date());

export const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const parseValue = (value: string): Date => {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  return new Date(value);
};

export const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = parseValue(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = parseValue(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDay = (value: Date) =>
  value.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

/** LocalTime values arrive as "08:00:00"; LocalDateTime as "...T08:00:00". */
export const formatTime = (value?: string | null) => {
  if (!value) return '—';
  const withDate = /T(\d{2}:\d{2})/.exec(value);
  if (withDate) return withDate[1];
  const plain = /^(\d{2}:\d{2})/.exec(value);
  return plain ? plain[1] : value;
};

export const formatHours = (value?: number | string | null) => {
  const hours = Number(value ?? 0);
  return `${Number.isInteger(hours) ? hours : hours.toFixed(2)} h`;
};

export const statusClass = (status: string) =>
  status.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const friendlyStatus = (status: string) =>
  status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
