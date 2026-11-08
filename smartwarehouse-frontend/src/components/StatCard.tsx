import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

interface Props {
  label: string;
  value: string;
  detail: string;
  icon: IconDefinition;
  tone: 'blue' | 'green' | 'amber' | 'violet';
}

export default function StatCard({ label, value, detail, icon, tone }: Props) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon stat-${tone}`}><FontAwesomeIcon icon={icon} /></span></div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></article>;
}
